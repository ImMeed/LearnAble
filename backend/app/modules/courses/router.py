from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, Request, UploadFile, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.i18n import get_request_locale
from app.core.roles import UserRole, require_roles
from app.core.security import CurrentUser, get_current_user
from app.db.session import get_db_session
from app.modules.courses.schemas import (
    AssistRequest,
    AssistResponse,
    BlankCourseRequest,
    CourseCreateResponse,
    CourseDetailResponse,
    CourseListItem,
    CourseStructureUpdate,
    LastVisitedRequest,
    ProgressResponse,
    QuizAttemptRequest,
    QuizAttemptResponse,
)
from app.modules.courses.service import (
    assist_service as course_assist,
    create_course_from_pdf,
    create_blank_course,
    delete_course,
    duplicate_course,
    get_flashcards_service as generate_course_flashcards,
    get_quiz_service as generate_course_quiz,
    get_course_for_teacher,
    get_progress,
    get_quiz_history,
    list_published_courses as list_published_courses_for_students,
    list_teacher_courses,
    mark_progress,
    publish_course,
    record_quiz_attempt,
    unmark_progress,
    update_course_structure,
    update_last_visited,
)

# ── Teacher router ─────────────────────────────────────────────────────────────
teacher_router = APIRouter(prefix="/teacher/courses", tags=["courses"])


@teacher_router.post("/", response_model=CourseCreateResponse, status_code=status.HTTP_201_CREATED)
def create_course(
    request: Request,
    file: UploadFile = File(...),
    title: str = Form(...),
    language: str = Form(...),
    session: Session = Depends(get_db_session),
    current_user: CurrentUser = Depends(require_roles(UserRole.ROLE_TUTOR)),
) -> CourseCreateResponse:
    locale = get_request_locale(request)
    course = create_course_from_pdf(
        session, file=file, title=title, language=language,
        current_user=current_user, locale=locale,
    )
    return CourseCreateResponse.model_validate(course)


@teacher_router.post("/blank", response_model=CourseCreateResponse, status_code=status.HTTP_201_CREATED)
def create_blank(
    request: Request,
    payload: BlankCourseRequest,
    session: Session = Depends(get_db_session),
    current_user: CurrentUser = Depends(require_roles(UserRole.ROLE_TUTOR)),
) -> CourseCreateResponse:
    locale = get_request_locale(request)
    course = create_blank_course(
        session, title=payload.title, language=payload.language,
        current_user=current_user, locale=locale,
    )
    return CourseCreateResponse.model_validate(course)


@teacher_router.get("/", response_model=list[CourseListItem])
def list_my_courses(
    session: Session = Depends(get_db_session),
    current_user: CurrentUser = Depends(require_roles(UserRole.ROLE_TUTOR)),
) -> list[CourseListItem]:
    courses = list_teacher_courses(session, current_user.user_id)
    return [CourseListItem.model_validate(c) for c in courses]


@teacher_router.get("/{course_id}", response_model=CourseDetailResponse)
def get_course(
    course_id: UUID,
    request: Request,
    session: Session = Depends(get_db_session),
    current_user: CurrentUser = Depends(require_roles(UserRole.ROLE_TUTOR)),
) -> CourseDetailResponse:
    locale = get_request_locale(request)
    course = get_course_for_teacher(session, course_id, current_user.user_id, locale)
    return CourseDetailResponse.model_validate(course)


@teacher_router.patch("/{course_id}", response_model=CourseDetailResponse)
def update_course(
    course_id: UUID,
    request: Request,
    payload: CourseStructureUpdate,
    session: Session = Depends(get_db_session),
    current_user: CurrentUser = Depends(require_roles(UserRole.ROLE_TUTOR)),
) -> CourseDetailResponse:
    locale = get_request_locale(request)
    course = update_course_structure(session, course_id, current_user.user_id, payload, locale)
    return CourseDetailResponse.model_validate(course)


@teacher_router.post("/{course_id}/publish", response_model=CourseDetailResponse)
def publish(
    course_id: UUID,
    request: Request,
    session: Session = Depends(get_db_session),
    current_user: CurrentUser = Depends(require_roles(UserRole.ROLE_TUTOR)),
) -> CourseDetailResponse:
    locale = get_request_locale(request)
    course = publish_course(session, course_id, current_user.user_id, locale)
    return CourseDetailResponse.model_validate(course)


@teacher_router.delete("/{course_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete(
    course_id: UUID,
    request: Request,
    session: Session = Depends(get_db_session),
    current_user: CurrentUser = Depends(require_roles(UserRole.ROLE_TUTOR)),
) -> None:
    locale = get_request_locale(request)
    delete_course(session, course_id, current_user.user_id, locale)


# ── Student router ─────────────────────────────────────────────────────────────
student_router = APIRouter(prefix="/courses", tags=["courses"])


@student_router.get("/", response_model=list[CourseListItem])
def list_published(
    language: str | None = None,
    session: Session = Depends(get_db_session),
    current_user: CurrentUser = Depends(get_current_user),
) -> list[CourseListItem]:
    courses = list_published_courses_for_students(session, language)
    return [CourseListItem.model_validate(c) for c in courses]


@student_router.get("/{course_id}", response_model=CourseDetailResponse)
def get_published_course(
    course_id: UUID,
    request: Request,
    session: Session = Depends(get_db_session),
    current_user: CurrentUser = Depends(get_current_user),
) -> CourseDetailResponse:
    from app.modules.courses import repository as repo
    from app.core.i18n import localized_http_exception
    from fastapi import status as http_status
    locale = get_request_locale(request)
    course = repo.get_course_by_id(session, course_id)
    if course is None:
        raise localized_http_exception(http_status.HTTP_404_NOT_FOUND, "COURSE_NOT_FOUND", locale)
    return CourseDetailResponse.model_validate(course)


@student_router.post("/{course_id}/assist", response_model=AssistResponse)
def assist(
    course_id: UUID,
    request: Request,
    payload: AssistRequest,
    session: Session = Depends(get_db_session),
    current_user: CurrentUser = Depends(get_current_user),
) -> AssistResponse:
    locale = get_request_locale(request)
    answer = course_assist(session, course_id, payload.section_id, payload.question, locale)
    return AssistResponse(answer=answer)


@student_router.post("/{course_id}/flashcards")
def flashcards(
    course_id: UUID,
    request: Request,
    session: Session = Depends(get_db_session),
    current_user: CurrentUser = Depends(get_current_user),
) -> list[dict]:
    locale = get_request_locale(request)
    return generate_course_flashcards(session, course_id, locale)


@student_router.post("/{course_id}/quiz")
def quiz(
    course_id: UUID,
    request: Request,
    session: Session = Depends(get_db_session),
    current_user: CurrentUser = Depends(get_current_user),
) -> list[dict]:
    locale = get_request_locale(request)
    return generate_course_quiz(session, course_id, locale)


# ── Phase 2: Progress & Quiz History endpoints ─────────────────────────────────

# Batch progress — must be defined BEFORE /{course_id}/... routes to avoid routing collision

class _BatchProgressRequest(BaseModel):
    course_ids: list[UUID]


class _CourseSummaryItem(BaseModel):
    course_id: UUID
    completed: int
    total: int
    percent: float


@student_router.post("/progress/batch", response_model=list[_CourseSummaryItem])
def get_batch_progress(
    payload: _BatchProgressRequest,
    session: Session = Depends(get_db_session),
    current_user: CurrentUser = Depends(get_current_user),
) -> list[_CourseSummaryItem]:
    from app.modules.courses import repository as repo
    result: list[_CourseSummaryItem] = []
    for cid in payload.course_ids:
        course = repo.get_course_by_id(session, cid)
        if course is None or course.structure_json is None:
            continue
        total = sum(
            1 + len(s.get("subsections", []))
            for ch in course.structure_json.get("chapters", [])
            for s in ch.get("sections", [])
        )
        completed_ids = repo.get_completed_section_ids(
            session, student_user_id=current_user.user_id, course_id=cid
        )
        completed = len(completed_ids)
        percent = round((completed / total * 100), 1) if total > 0 else 0.0
        result.append(_CourseSummaryItem(
            course_id=cid,
            completed=completed,
            total=total,
            percent=percent,
        ))
    return result


@student_router.get("/{course_id}/progress", response_model=ProgressResponse)
def get_my_progress(
    course_id: UUID,
    session: Session = Depends(get_db_session),
    current_user: CurrentUser = Depends(get_current_user),
) -> ProgressResponse:
    return get_progress(session, course_id, current_user.user_id)


@student_router.post("/{course_id}/progress/sections/{section_id}", status_code=status.HTTP_201_CREATED)
def mark_complete(
    course_id: UUID,
    section_id: str,
    request: Request,
    session: Session = Depends(get_db_session),
    current_user: CurrentUser = Depends(get_current_user),
):
    locale = get_request_locale(request)
    mark_progress(session, course_id, section_id, current_user.user_id, locale)
    return {"ok": True}


@student_router.delete("/{course_id}/progress/sections/{section_id}", status_code=status.HTTP_204_NO_CONTENT)
def unmark_complete(
    course_id: UUID,
    section_id: str,
    request: Request,
    session: Session = Depends(get_db_session),
    current_user: CurrentUser = Depends(get_current_user),
):
    locale = get_request_locale(request)
    unmark_progress(session, course_id, section_id, current_user.user_id, locale)


@student_router.patch("/{course_id}/progress/last-section", status_code=status.HTTP_204_NO_CONTENT)
def set_last_section(
    course_id: UUID,
    payload: LastVisitedRequest,
    request: Request,
    session: Session = Depends(get_db_session),
    current_user: CurrentUser = Depends(get_current_user),
):
    locale = get_request_locale(request)
    update_last_visited(session, course_id, payload.section_id, current_user.user_id, locale)


@student_router.post("/{course_id}/quiz-attempts", response_model=QuizAttemptResponse, status_code=status.HTTP_201_CREATED)
def save_quiz_attempt_endpoint(
    course_id: UUID,
    payload: QuizAttemptRequest,
    request: Request,
    session: Session = Depends(get_db_session),
    current_user: CurrentUser = Depends(get_current_user),
) -> QuizAttemptResponse:
    locale = get_request_locale(request)
    attempt = record_quiz_attempt(session, course_id, payload.score, payload.total, current_user.user_id, locale)
    return QuizAttemptResponse.model_validate(attempt)


@student_router.get("/{course_id}/quiz-attempts", response_model=list[QuizAttemptResponse])
def list_quiz_attempts_endpoint(
    course_id: UUID,
    session: Session = Depends(get_db_session),
    current_user: CurrentUser = Depends(get_current_user),
) -> list[QuizAttemptResponse]:
    attempts = get_quiz_history(session, course_id, current_user.user_id)
    return [QuizAttemptResponse.model_validate(a) for a in attempts]


# ── Phase 2: Teacher duplicate & analytics ─────────────────────────────────────

@teacher_router.post("/{course_id}/duplicate", response_model=CourseCreateResponse, status_code=status.HTTP_201_CREATED)
def duplicate(
    course_id: UUID,
    request: Request,
    session: Session = Depends(get_db_session),
    current_user: CurrentUser = Depends(require_roles(UserRole.ROLE_TUTOR)),
) -> CourseCreateResponse:
    locale = get_request_locale(request)
    course = duplicate_course(session, course_id, current_user.user_id, locale)
    return CourseCreateResponse.model_validate(course)


@teacher_router.get("/{course_id}/analytics")
def course_analytics(
    course_id: UUID,
    request: Request,
    session: Session = Depends(get_db_session),
    current_user: CurrentUser = Depends(require_roles(UserRole.ROLE_TUTOR)),
) -> dict:
    from app.db.models.section_progress import SectionProgress
    from app.db.models.quiz_attempt import CourseQuizAttempt
    from sqlalchemy import func as sqlfunc
    locale = get_request_locale(request)
    course = get_course_for_teacher(session, course_id, current_user.user_id, locale)

    structure = course.structure_json or {}
    total_sections = sum(
        len(ch.get("sections", [])) for ch in structure.get("chapters", [])
    )

    progress_rows = session.execute(
        select(
            SectionProgress.student_user_id,
            sqlfunc.count(SectionProgress.section_id).label("completed_sections"),
        )
        .where(SectionProgress.course_id == course_id)
        .group_by(SectionProgress.student_user_id)
    ).all()

    quiz_rows = session.execute(
        select(
            CourseQuizAttempt.student_user_id,
            sqlfunc.max(CourseQuizAttempt.score).label("best_score"),
            sqlfunc.max(CourseQuizAttempt.total).label("total_questions"),
            sqlfunc.count(CourseQuizAttempt.id).label("attempt_count"),
        )
        .where(CourseQuizAttempt.course_id == course_id)
        .group_by(CourseQuizAttempt.student_user_id)
    ).all()

    quiz_map = {str(row.student_user_id): row for row in quiz_rows}

    students = []
    for row in progress_rows:
        student_id = str(row.student_user_id)
        quiz = quiz_map.get(student_id)
        students.append({
            "student_user_id": student_id,
            "completed_sections": row.completed_sections,
            "total_sections": total_sections,
            "best_quiz_score": quiz.best_score if quiz else None,
            "quiz_total_questions": quiz.total_questions if quiz else None,
            "quiz_attempt_count": quiz.attempt_count if quiz else 0,
        })

    return {
        "course_id": str(course_id),
        "course_title": course.title,
        "total_sections": total_sections,
        "enrolled_students": len(students),
        "students": students,
    }
