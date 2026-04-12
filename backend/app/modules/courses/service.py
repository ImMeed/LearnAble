from __future__ import annotations

from uuid import UUID

from fastapi import HTTPException, UploadFile, status
from pydantic import ValidationError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import CurrentUser
from app.db.models.course import CourseStatus
from app.modules.ai import repository as ai_repository
from app.modules.courses import repository
from app.modules.courses.schemas import (
    CourseCreateResponse,
    CourseDetailResponse,
    CourseListItem,
    CourseStructure,
    CourseStructureUpdate,
)

_MAX_UPLOAD_BYTES = 10 * 1024 * 1024
_MAX_PDF_PAGES = 50


def _http_error(status_code: int, code: str, message: str) -> HTTPException:
    return HTTPException(status_code=status_code, detail={"code": code, "message": message})


def _get_owned_course(session: Session, current_user: CurrentUser, course_id: UUID):
    course = repository.get_course_by_id(session, course_id)
    if course is None:
        raise _http_error(status.HTTP_404_NOT_FOUND, "COURSE_NOT_FOUND", "Course not found")
    if course.owner_user_id != current_user.user_id:
        raise _http_error(status.HTTP_403_FORBIDDEN, "FORBIDDEN", "You do not own this course")
    return course


def assign_ids(structure: CourseStructure) -> dict:
    """Assign deterministic hierarchical IDs to chapters, sections, and subsections."""
    out = {"chapters": []}
    for c_idx, chapter in enumerate(structure.chapters, start=1):
        chapter_id = f"c{c_idx}"
        sections_out = []
        for s_idx, section in enumerate(chapter.sections, start=1):
            section_id = f"{chapter_id}s{s_idx}"
            subs_out = []
            for k_idx, sub in enumerate(section.subsections, start=1):
                subs_out.append(
                    {
                        "id": f"{section_id}_{k_idx}",
                        "title": sub.title,
                        "content": sub.content,
                    }
                )
            sections_out.append(
                {
                    "id": section_id,
                    "title": section.title,
                    "content": section.content,
                    "subsections": subs_out,
                }
            )
        out["chapters"].append(
            {
                "id": chapter_id,
                "title": chapter.title,
                "sections": sections_out,
            }
        )
    return out


def _mock_course_structure(title: str) -> dict:
    """Return a realistic fake structure for testing without Gemini."""
    return {
        "page_count": 7,
        "chapters": [
            {
                "title": f"Chapter 1: Introduction to {title}",
                "sections": [
                    {
                        "title": "1.1 Overview",
                        "content": f"This section provides an overview of {title} and its key concepts.",
                        "subsections": [
                            {"title": "Background", "content": "Historical context and motivation behind this topic."},
                            {"title": "Key Concepts", "content": "Core terminology and definitions used throughout."},
                        ],
                    },
                    {
                        "title": "1.2 Prerequisites",
                        "content": "Required knowledge and tools before getting started.",
                        "subsections": [],
                    },
                ],
            },
            {
                "title": "Chapter 2: Core Concepts",
                "sections": [
                    {
                        "title": "2.1 Architecture",
                        "content": "Detailed explanation of the internal architecture and components.",
                        "subsections": [
                            {"title": "Components", "content": "Description of each major component."},
                            {"title": "Data Flow", "content": "How data moves through the system."},
                        ],
                    },
                    {
                        "title": "2.2 Configuration",
                        "content": "How to configure and set up the system for different use cases.",
                        "subsections": [],
                    },
                ],
            },
            {
                "title": "Chapter 3: Practical Examples",
                "sections": [
                    {
                        "title": "3.1 Getting Started",
                        "content": "Step-by-step guide to your first implementation.",
                        "subsections": [],
                    },
                    {
                        "title": "3.2 Advanced Usage",
                        "content": "Advanced patterns and best practices for production use.",
                        "subsections": [
                            {"title": "Performance Tuning", "content": "Tips for optimizing performance."},
                            {"title": "Error Handling", "content": "How to handle common errors gracefully."},
                        ],
                    },
                ],
            },
        ],
    }


async def create_course_from_pdf(
    session: Session,
    current_user: CurrentUser,
    *,
    file: UploadFile,
    title: str,
    language: str,
) -> CourseCreateResponse:
    """
    Create a draft course from an uploaded PDF.

    Raises:
        HTTPException(400): invalid language, title, or file type.
        HTTPException(413): file exceeds size/page limits.
        HTTPException(502): Gemini unavailable or invalid response structure.
    """
    if language not in {"ar", "en"}:
        raise _http_error(status.HTTP_400_BAD_REQUEST, "INVALID_LANGUAGE", "Language must be 'ar' or 'en'")

    clean_title = title.strip()
    if not clean_title or len(clean_title) > 255:
        raise _http_error(status.HTTP_400_BAD_REQUEST, "INVALID_TITLE", "Title is required and must be <= 255 chars")

    filename = (file.filename or "").strip()
    if file.content_type != "application/pdf" or not filename.lower().endswith(".pdf"):
        raise _http_error(status.HTTP_400_BAD_REQUEST, "INVALID_FILE_TYPE", "File must be a PDF")

    pdf_bytes = await file.read()
    if len(pdf_bytes) > _MAX_UPLOAD_BYTES:
        raise _http_error(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "FILE_TOO_LARGE", "File exceeds 10 MB size limit")

    if settings.gemini_mock:
        raw_structure = _mock_course_structure(clean_title)
    else:
        try:
            raw_structure = ai_repository.extract_course_structure(pdf_bytes, language)
        except ai_repository.GeminiParseError:
            raise _http_error(
                status.HTTP_502_BAD_GATEWAY,
                "COURSE_STRUCTURE_PARSE_FAILED",
                "Failed to parse course structure, please try again",
            )
        except ai_repository.GeminiError:
            raise _http_error(
                status.HTTP_502_BAD_GATEWAY,
                "COURSE_ANALYSIS_UNAVAILABLE",
                "Course analysis service unavailable",
            )

    try:
        validated = CourseStructure.model_validate(raw_structure)
    except ValidationError as exc:
        raise _http_error(
            status.HTTP_502_BAD_GATEWAY,
            "COURSE_STRUCTURE_PARSE_FAILED",
            "Failed to parse course structure, please try again",
        ) from exc

    if validated.page_count > _MAX_PDF_PAGES:
        raise _http_error(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "PDF_TOO_LONG", "PDF exceeds 30 page limit")

    structure_json = assign_ids(validated)
    course = repository.create_course(
        session,
        owner_id=current_user.user_id,
        title=clean_title,
        language=language,
        source_filename=filename,
        source_page_count=validated.page_count,
        structure_json=structure_json,
    )
    session.commit()
    session.refresh(course)
    return CourseCreateResponse.model_validate(course)


def get_course_for_teacher(session: Session, current_user: CurrentUser, course_id: UUID) -> CourseDetailResponse:
    """
    Return full course detail for the owning teacher.

    Raises:
        HTTPException(404): course does not exist.
        HTTPException(403): current teacher does not own the course.
    """
    course = _get_owned_course(session, current_user, course_id)
    return CourseDetailResponse.model_validate(course)


def list_teacher_courses(session: Session, current_user: CurrentUser) -> list[CourseListItem]:
    """
    List teacher-owned courses ordered by newest first.

    Raises:
        No HTTP exceptions for normal flow.
    """
    courses = repository.list_courses_by_owner(session, current_user.user_id)
    return [CourseListItem.model_validate(course) for course in courses]


def update_course_structure(
    session: Session,
    current_user: CurrentUser,
    course_id: UUID,
    payload: CourseStructureUpdate,
) -> CourseDetailResponse:
    """
    Update course title and/or structure for the owning teacher.

    Raises:
        HTTPException(404): course does not exist.
        HTTPException(403): current teacher does not own the course.
        HTTPException(400): invalid title.
        HTTPException(502): provided structure is invalid.
    """
    course = _get_owned_course(session, current_user, course_id)
    updates: dict[str, object] = {}

    if payload.title is not None:
        clean_title = payload.title.strip()
        if not clean_title or len(clean_title) > 255:
            raise _http_error(
                status.HTTP_400_BAD_REQUEST,
                "INVALID_TITLE",
                "Title is required and must be <= 255 chars",
            )
        updates["title"] = clean_title

    if payload.structure_json is not None:
        try:
            validated = CourseStructure.model_validate(payload.structure_json)
        except ValidationError as exc:
            raise _http_error(
                status.HTTP_502_BAD_GATEWAY,
                "COURSE_STRUCTURE_PARSE_FAILED",
                "Failed to parse course structure, please try again",
            ) from exc
        updates["structure_json"] = assign_ids(validated)

    if updates:
        course = repository.update_course(session, course, **updates)
        session.commit()
        session.refresh(course)
    return CourseDetailResponse.model_validate(course)


def publish_course(session: Session, current_user: CurrentUser, course_id: UUID) -> CourseDetailResponse:
    """
    Publish a teacher-owned course.

    Raises:
        HTTPException(404): course does not exist.
        HTTPException(403): current teacher does not own the course.
    """
    course = _get_owned_course(session, current_user, course_id)
    if course.status == CourseStatus.PUBLISHED.value:
        return CourseDetailResponse.model_validate(course)

    course = repository.update_course(session, course, status=CourseStatus.PUBLISHED.value)
    session.commit()
    session.refresh(course)
    return CourseDetailResponse.model_validate(course)


def delete_course(session: Session, current_user: CurrentUser, course_id: UUID) -> None:
    """
    Delete a teacher-owned course.

    Raises:
        HTTPException(404): course does not exist.
        HTTPException(403): current teacher does not own the course.
    """
    course = _get_owned_course(session, current_user, course_id)
    repository.delete_course(session, course)
    session.commit()


def course_assist(
    session: Session,
    course_id: UUID,
    question: str,
    section_title: str,
    section_content: str,
    locale: str,
) -> str:
    """
    Answer a student question scoped to a specific section of a published course.

    Raises:
        HTTPException(404): course missing or not published.
    """
    course = repository.get_course_by_id(session, course_id)
    if course is None or course.status != CourseStatus.PUBLISHED.value:
        raise _http_error(status.HTTP_404_NOT_FOUND, "COURSE_NOT_FOUND", "Course not found")

    try:
        answer = ai_repository.generate_course_assist(
            question=question,
            course_title=course.title,
            section_title=section_title,
            section_content=section_content,
            locale=locale,
        )
    except ai_repository.GeminiError as exc:
        raise _http_error(status.HTTP_502_BAD_GATEWAY, "AI_UNAVAILABLE", str(exc)) from exc
    return answer


def list_published_courses_for_students(session: Session, language: str | None) -> list[CourseListItem]:
    """
    List published courses for authenticated users with optional language filter.

    Raises:
        HTTPException(400): invalid language filter value.
    """
    if language is not None and language not in {"ar", "en"}:
        raise _http_error(status.HTTP_400_BAD_REQUEST, "INVALID_LANGUAGE", "Language must be 'ar' or 'en'")
    courses = repository.list_published_courses(session, language=language)
    return [CourseListItem.model_validate(course) for course in courses]


def get_published_course(session: Session, course_id: UUID) -> CourseDetailResponse:
    """
    Return course detail only when published.

    Raises:
        HTTPException(404): course missing or not published.
    """
    course = repository.get_course_by_id(session, course_id)
    if course is None or course.status != CourseStatus.PUBLISHED.value:
        raise _http_error(status.HTTP_404_NOT_FOUND, "COURSE_NOT_FOUND", "Course not found")
    return CourseDetailResponse.model_validate(course)
