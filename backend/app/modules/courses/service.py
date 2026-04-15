from uuid import UUID

from fastapi import HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.core.i18n import localized_http_exception
from app.core.security import CurrentUser
from app.db.models.course import CourseStatus
from app.modules.ai.repository import (
    GeminiError,
    GeminiParseError,
    extract_course_structure,
    generate_course_assist,
    generate_flashcards,
    generate_quiz,
)
from app.modules.courses import repository
from app.modules.courses.schemas import CourseStructure, CourseStructureUpdate

_MAX_FILE_BYTES = 10 * 1024 * 1024  # 10 MB
_MAX_PAGES = 50


def _assign_ids(structure: CourseStructure) -> None:
    """Mutate structure in-place, assigning hierarchical IDs."""
    for ci, chapter in enumerate(structure.chapters, start=1):
        chapter.id = f"c{ci}"
        for si, section in enumerate(chapter.sections, start=1):
            section.id = f"c{ci}s{si}"
            for ki, subsection in enumerate(section.subsections, start=1):
                subsection.id = f"c{ci}s{si}_{ki}"


def _extract_all_content(course) -> str:
    """Flatten course structure_json into a markdown string."""
    structure = course.structure_json or {}
    lines = []
    for chapter in structure.get("chapters", []):
        lines.append(f"# {chapter.get('title', '')}")
        for section in chapter.get("sections", []):
            lines.append(f"## {section.get('title', '')}")
            lines.append(section.get("content", ""))
            for subsection in section.get("subsections", []):
                lines.append(f"### {subsection.get('title', '')}")
                lines.append(subsection.get("content", ""))
    return "\n".join(lines)


def _find_section(course, section_id: str) -> dict | None:
    """Find a section/subsection by ID scanning the entire structure."""
    for chapter in (course.structure_json or {}).get("chapters", []):
        for section in chapter.get("sections", []):
            if section.get("id") == section_id:
                return section
            for subsection in section.get("subsections", []):
                if subsection.get("id") == section_id:
                    return subsection
    return None


def create_course_from_pdf(
    session: Session,
    *,
    file: UploadFile,
    title: str,
    language: str,
    current_user: CurrentUser,
    locale: str,
):
    if not title or not title.strip():
        raise localized_http_exception(status.HTTP_400_BAD_REQUEST, "VALIDATION_ERROR", locale)
    if len(title) > 255:
        raise localized_http_exception(status.HTTP_400_BAD_REQUEST, "VALIDATION_ERROR", locale)
    if language not in ("ar", "en"):
        raise localized_http_exception(status.HTTP_400_BAD_REQUEST, "INVALID_COURSE_LANGUAGE", locale)
    if file.content_type not in ("application/pdf", "application/octet-stream"):
        if not (file.filename or "").lower().endswith(".pdf"):
            raise localized_http_exception(status.HTTP_400_BAD_REQUEST, "INVALID_FILE_TYPE", locale)

    pdf_bytes = file.file.read()
    if len(pdf_bytes) > _MAX_FILE_BYTES:
        raise localized_http_exception(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "PDF_TOO_LARGE", locale)

    try:
        raw_structure = extract_course_structure(pdf_bytes, language)
    except (GeminiError, GeminiParseError) as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={"code": "AI_EXTRACTION_FAILED", "message": str(exc), "locale": locale},
        ) from exc

    try:
        structure = CourseStructure.model_validate(raw_structure)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={"code": "AI_EXTRACTION_FAILED", "message": "Invalid structure from AI.", "locale": locale},
        ) from exc

    if structure.page_count > _MAX_PAGES:
        raise localized_http_exception(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "PDF_TOO_MANY_PAGES", locale)

    _assign_ids(structure)

    course = repository.create_course(
        session,
        title=title.strip(),
        language=language,
        owner_user_id=current_user.user_id,
        source_filename=file.filename,
        source_page_count=structure.page_count,
        structure_json=structure.model_dump(),
    )
    
    try:
        session.commit()
    except Exception:
        session.rollback()
        raise
        
    return course


def create_blank_course(
    session: Session,
    *,
    title: str,
    language: str,
    current_user: CurrentUser,
    locale: str,
):
    if not title or not title.strip():
        raise localized_http_exception(status.HTTP_400_BAD_REQUEST, "VALIDATION_ERROR", locale)
    if len(title) > 255:
        raise localized_http_exception(status.HTTP_400_BAD_REQUEST, "VALIDATION_ERROR", locale)
    if language not in ("ar", "en"):
        raise localized_http_exception(status.HTTP_400_BAD_REQUEST, "INVALID_COURSE_LANGUAGE", locale)

    structure = CourseStructure(
        page_count=0,
        chapters=[
            {
                "id": "c1",
                "title": "Chapter 1",
                "sections": [
                    {
                        "id": "c1s1",
                        "title": "Section 1",
                        "content": "",
                        "subsections": []
                    }
                ]
            }
        ]
    )

    course = repository.create_course(
        session,
        title=title.strip(),
        language=language,
        owner_user_id=current_user.user_id,
        source_filename=None,
        source_page_count=0,
        structure_json=structure.model_dump(),
    )
    
    try:
        session.commit()
    except Exception:
        session.rollback()
        raise
        
    return course


def get_course_for_teacher(session: Session, course_id: UUID, teacher_user_id: UUID, locale: str):
    course = repository.get_course_by_id(session, course_id)
    if course is None:
        raise localized_http_exception(status.HTTP_404_NOT_FOUND, "COURSE_NOT_FOUND", locale)
    if course.owner_user_id != teacher_user_id:
        raise localized_http_exception(status.HTTP_403_FORBIDDEN, "COURSE_FORBIDDEN", locale)
    return course


def list_teacher_courses(session: Session, teacher_user_id: UUID):
    return repository.list_courses_by_owner(session, teacher_user_id)


def update_course_structure(
    session: Session,
    course_id: UUID,
    teacher_user_id: UUID,
    update: CourseStructureUpdate,
    locale: str,
):
    course = get_course_for_teacher(session, course_id, teacher_user_id, locale)
    fields = {}
    if update.title is not None:
        fields["title"] = update.title.strip()
    if update.structure_json is not None:
        try:
            CourseStructure.model_validate(update.structure_json)
        except Exception as exc:
            raise localized_http_exception(status.HTTP_400_BAD_REQUEST, "VALIDATION_ERROR", locale) from exc
        fields["structure_json"] = update.structure_json
    
    if fields:
        repository.update_course(session, course, **fields)
        try:
            session.commit()
        except Exception:
            session.rollback()
            raise
    return course


def publish_course(session: Session, course_id: UUID, teacher_user_id: UUID, locale: str):
    course = get_course_for_teacher(session, course_id, teacher_user_id, locale)
    repository.update_course(session, course, status=CourseStatus.PUBLISHED)
    try:
        session.commit()
    except Exception:
        session.rollback()
        raise
    return course


def delete_course(session: Session, course_id: UUID, teacher_user_id: UUID, locale: str):
    course = get_course_for_teacher(session, course_id, teacher_user_id, locale)
    repository.delete_course(session, course)
    try:
        session.commit()
    except Exception:
        session.rollback()
        raise


def get_published_course(session: Session, course_id: UUID, locale: str):
    course = repository.get_course_by_id(session, course_id)
    if course is None:
        raise localized_http_exception(status.HTTP_404_NOT_FOUND, "COURSE_NOT_FOUND", locale)
    if course.status != CourseStatus.PUBLISHED:
        raise localized_http_exception(status.HTTP_404_NOT_FOUND, "COURSE_NOT_PUBLISHED", locale)
    return course


def list_published_courses(session: Session, language: str | None):
    return repository.list_published_courses(session, language)


def get_flashcards_service(session: Session, course_id: UUID, locale: str):
    course = get_published_course(session, course_id, locale)
    content = _extract_all_content(course)
    return generate_flashcards(course.title, content, locale)


def get_quiz_service(session: Session, course_id: UUID, locale: str):
    course = get_published_course(session, course_id, locale)
    content = _extract_all_content(course)
    return generate_quiz(course.title, content, locale)


def assist_service(session: Session, course_id: UUID, section_id: str, question: str, locale: str):
    course = get_published_course(session, course_id, locale)
    section = _find_section(course, section_id)
    if not section:
        raise localized_http_exception(status.HTTP_404_NOT_FOUND, "SECTION_NOT_FOUND", locale)
    
    return generate_course_assist(
        question,
        course.title,
        section.get("title", ""),
        section.get("content", ""),
        locale
    )


# ── Phase 2: Progress, Quiz History, Duplication ───────────────────────────────

from app.db.models.section_progress import SectionProgress
from app.db.models.quiz_attempt import CourseQuizAttempt


def mark_progress(
    session: Session,
    course_id: UUID,
    section_id: str,
    student_user_id: UUID,
    locale: str,
) -> SectionProgress:
    course = repository.get_course_by_id(session, course_id)
    if course is None or course.status != CourseStatus.PUBLISHED:
        raise localized_http_exception(status.HTTP_404_NOT_FOUND, "COURSE_NOT_FOUND", locale)
    try:
        record = repository.mark_section_complete(
            session, student_user_id=student_user_id, course_id=course_id, section_id=section_id
        )
        session.commit()
        return record
    except Exception:
        session.rollback()
        raise localized_http_exception(status.HTTP_409_CONFLICT, "PROGRESS_CONFLICT", locale)


def unmark_progress(
    session: Session,
    course_id: UUID,
    section_id: str,
    student_user_id: UUID,
    locale: str,
) -> None:
    course = repository.get_course_by_id(session, course_id)
    if course is None or course.status != CourseStatus.PUBLISHED:
        raise localized_http_exception(status.HTTP_404_NOT_FOUND, "COURSE_NOT_FOUND", locale)
    repository.unmark_section_complete(
        session, student_user_id=student_user_id, course_id=course_id, section_id=section_id
    )
    session.commit()


def get_progress(session: Session, course_id: UUID, student_user_id: UUID) -> dict:
    completed = repository.get_completed_section_ids(
        session, student_user_id=student_user_id, course_id=course_id
    )
    last_section = repository.get_last_visited(
        session, student_user_id=student_user_id, course_id=course_id
    )
    return {"completed_section_ids": completed, "last_section_id": last_section}


def update_last_visited(
    session: Session, course_id: UUID, section_id: str, student_user_id: UUID, locale: str
) -> None:
    course = repository.get_course_by_id(session, course_id)
    if course is None or course.status != CourseStatus.PUBLISHED:
        raise localized_http_exception(status.HTTP_404_NOT_FOUND, "COURSE_NOT_FOUND", locale)
    repository.upsert_last_visited(
        session, student_user_id=student_user_id, course_id=course_id, section_id=section_id
    )
    session.commit()


def record_quiz_attempt(
    session: Session, course_id: UUID, score: int, total: int, student_user_id: UUID, locale: str
) -> CourseQuizAttempt:
    course = repository.get_course_by_id(session, course_id)
    if course is None or course.status != CourseStatus.PUBLISHED:
        raise localized_http_exception(status.HTTP_404_NOT_FOUND, "COURSE_NOT_FOUND", locale)
    attempt = repository.save_quiz_attempt(
        session, student_user_id=student_user_id, course_id=course_id, score=score, total=total
    )
    session.commit()
    return attempt


def get_quiz_history(session: Session, course_id: UUID, student_user_id: UUID) -> list[CourseQuizAttempt]:
    return repository.list_quiz_attempts(
        session, student_user_id=student_user_id, course_id=course_id
    )


def duplicate_course(
    session: Session, course_id: UUID, teacher_user_id: UUID, locale: str
):
    original = get_course_for_teacher(session, course_id, teacher_user_id, locale)
    cloned = repository.create_course(
        session,
        title=f"{original.title} (copy)",
        language=original.language,
        owner_user_id=teacher_user_id,
        source_filename=original.source_filename,
        source_page_count=original.source_page_count,
        structure_json=original.structure_json,
    )
    session.commit()
    return cloned
