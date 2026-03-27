from uuid import UUID

from fastapi import status
from sqlalchemy.orm import Session

from app.core.i18n import localized_http_exception
from app.core.roles import UserRole
from app.core.security import CurrentUser
from app.modules.teacher import repository
from app.modules.teacher.schemas import (
    AssistanceActionResponse,
    AssistanceRequestCreate,
    AssistanceRequestItem,
    AssistanceRequestListResponse,
    FeedbackPromptAnswerRequest,
    FeedbackPromptAnswerResponse,
    FeedbackPromptItem,
    FeedbackPromptListResponse,
    PresenceUpdateRequest,
    TeacherDashboardResponse,
    TeacherPresenceItem,
    TeacherPresenceListResponse,
)
from app.db.models.teacher import AssistanceRequestStatus, FeedbackSourceType


def _request_item(record) -> AssistanceRequestItem:
    return AssistanceRequestItem(
        id=record.id,
        student_user_id=record.student_user_id,
        tutor_user_id=record.tutor_user_id,
        lesson_id=record.lesson_id,
        topic=record.topic,
        message=record.message,
        preferred_at=record.preferred_at,
        status=record.status.value,
        scheduled_at=record.scheduled_at,
        meeting_url=record.meeting_url,
    )


def get_teacher_dashboard(session: Session, current_user: CurrentUser) -> TeacherDashboardResponse:
    counts = repository.count_tutor_requests_by_status(session, current_user.user_id)
    online_teachers = repository.list_online_teachers(session)
    assigned = sum(counts.values())
    return TeacherDashboardResponse(
        assigned_requests=assigned,
        pending_requests=counts.get(AssistanceRequestStatus.REQUESTED.value, 0),
        scheduled_sessions=counts.get(AssistanceRequestStatus.SCHEDULED.value, 0),
        completed_sessions=counts.get(AssistanceRequestStatus.COMPLETED.value, 0),
        active_tutors_online=len(online_teachers),
    )


def set_teacher_presence(session: Session, payload: PresenceUpdateRequest, current_user: CurrentUser) -> TeacherPresenceItem:
    record = repository.upsert_teacher_presence(session, current_user.user_id, payload.is_online)
    session.commit()
    return TeacherPresenceItem(tutor_user_id=record.user_id, updated_at=record.updated_at)


def get_active_teacher_presence(session: Session) -> TeacherPresenceListResponse:
    records = repository.list_online_teachers(session)
    return TeacherPresenceListResponse(
        items=[TeacherPresenceItem(tutor_user_id=record.user_id, updated_at=record.updated_at) for record in records]
    )


def create_assistance_request(
    session: Session,
    payload: AssistanceRequestCreate,
    current_user: CurrentUser,
    locale: str,
) -> AssistanceRequestItem:
    if payload.lesson_id is not None and repository.get_lesson(session, payload.lesson_id) is None:
        raise localized_http_exception(status.HTTP_404_NOT_FOUND, "LESSON_OR_ATTEMPT_NOT_FOUND", locale)

    record = repository.create_assistance_request(
        session=session,
        student_user_id=current_user.user_id,
        lesson_id=payload.lesson_id,
        topic=payload.topic,
        message=payload.message,
        preferred_at=payload.preferred_at,
    )
    session.commit()
    return _request_item(record)


def list_assistance_requests(session: Session, current_user: CurrentUser) -> AssistanceRequestListResponse:
    if current_user.role == UserRole.ROLE_TUTOR:
        records = repository.list_requests_for_tutor(session, current_user.user_id)
    else:
        records = []
    return AssistanceRequestListResponse(items=[_request_item(record) for record in records])


def schedule_assistance_request(
    session: Session,
    request_id: UUID,
    scheduled_at,
    meeting_url: str,
    current_user: CurrentUser,
    locale: str,
) -> AssistanceActionResponse:
    record = repository.get_assistance_request(session, request_id)
    if record is None:
        raise localized_http_exception(status.HTTP_404_NOT_FOUND, "ASSISTANCE_REQUEST_NOT_FOUND", locale)

    record.tutor_user_id = current_user.user_id
    record.status = AssistanceRequestStatus.SCHEDULED
    record.scheduled_at = scheduled_at
    record.meeting_url = meeting_url
    session.add(record)
    session.commit()
    return AssistanceActionResponse(id=record.id, status=record.status.value)


def complete_assistance_request(
    session: Session,
    request_id: UUID,
    current_user: CurrentUser,
    locale: str,
) -> AssistanceActionResponse:
    record = repository.get_assistance_request(session, request_id)
    if record is None:
        raise localized_http_exception(status.HTTP_404_NOT_FOUND, "ASSISTANCE_REQUEST_NOT_FOUND", locale)

    if record.tutor_user_id not in (None, current_user.user_id):
        raise localized_http_exception(status.HTTP_403_FORBIDDEN, "FORBIDDEN", locale)

    record.tutor_user_id = current_user.user_id
    record.status = AssistanceRequestStatus.COMPLETED
    session.add(record)
    session.commit()
    return AssistanceActionResponse(id=record.id, status=record.status.value)


def emit_lesson_feedback_prompt(session: Session, lesson_id: UUID, current_user: CurrentUser, locale: str):
    lesson = repository.get_lesson(session, lesson_id)
    if lesson is None:
        raise localized_http_exception(status.HTTP_404_NOT_FOUND, "LESSON_OR_ATTEMPT_NOT_FOUND", locale)

    record = repository.create_feedback_prompt(
        session=session,
        student_user_id=current_user.user_id,
        source_type=FeedbackSourceType.LESSON,
        source_id=lesson_id,
        prompt_ar="كيف كانت صعوبة الدرس؟ وما الخطوة القادمة التي تحتاجها؟",
        prompt_en="How difficult was this lesson, and what support do you need next?",
    )
    session.commit()
    return record


def emit_assessment_feedback_prompt(session: Session, attempt_id: UUID, current_user: CurrentUser, locale: str):
    attempt = repository.get_quiz_attempt(session, attempt_id, current_user.user_id)
    if attempt is None:
        raise localized_http_exception(status.HTTP_404_NOT_FOUND, "LESSON_OR_ATTEMPT_NOT_FOUND", locale)

    record = repository.create_feedback_prompt(
        session=session,
        student_user_id=current_user.user_id,
        source_type=FeedbackSourceType.ASSESSMENT,
        source_id=attempt_id,
        prompt_ar="بعد التقييم، ما أكثر سؤال كان صعباً عليك؟",
        prompt_en="After the assessment, which question felt most difficult for you?",
    )
    session.commit()
    return record


def list_feedback_prompts(session: Session, current_user: CurrentUser, locale: str) -> FeedbackPromptListResponse:
    records = repository.list_feedback_prompts_for_student(session, current_user.user_id)
    items = [
        FeedbackPromptItem(
            id=record.id,
            source_type=record.source_type.value,
            source_id=record.source_id,
            prompt=record.prompt_en if locale == "en" else record.prompt_ar,
            response_text=record.response_text,
            is_answered=record.is_answered,
        )
        for record in records
    ]
    return FeedbackPromptListResponse(items=items)


def answer_feedback_prompt(
    session: Session,
    prompt_id: UUID,
    payload: FeedbackPromptAnswerRequest,
    current_user: CurrentUser,
    locale: str,
) -> FeedbackPromptAnswerResponse:
    record = repository.get_feedback_prompt(session, prompt_id)
    if record is None:
        raise localized_http_exception(status.HTTP_404_NOT_FOUND, "FEEDBACK_PROMPT_NOT_FOUND", locale)

    if record.student_user_id != current_user.user_id:
        raise localized_http_exception(status.HTTP_403_FORBIDDEN, "FORBIDDEN", locale)

    record.response_text = payload.response_text
    record.is_answered = True
    session.add(record)
    session.commit()
    return FeedbackPromptAnswerResponse(id=record.id, is_answered=record.is_answered)
