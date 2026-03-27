from uuid import UUID

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.core.i18n import get_request_locale
from app.core.roles import UserRole, require_roles
from app.core.security import CurrentUser
from app.db.session import get_db_session
from app.modules.teacher.schemas import (
    AssistanceActionResponse,
    AssistanceRequestCreate,
    AssistanceRequestItem,
    AssistanceRequestListResponse,
    AssistanceScheduleRequest,
    EmitFeedbackResponse,
    FeedbackPromptAnswerRequest,
    FeedbackPromptAnswerResponse,
    FeedbackPromptListResponse,
    PresenceUpdateRequest,
    TeacherDashboardResponse,
    TeacherPresenceListResponse,
)
from app.modules.teacher.service import (
    answer_feedback_prompt,
    complete_assistance_request,
    create_assistance_request,
    emit_assessment_feedback_prompt,
    emit_lesson_feedback_prompt,
    get_active_teacher_presence,
    get_teacher_dashboard,
    list_assistance_requests,
    list_feedback_prompts,
    schedule_assistance_request,
    set_teacher_presence,
)

router = APIRouter(prefix="/teacher", tags=["teacher"])


@router.get("/dashboard", response_model=TeacherDashboardResponse)
def dashboard(
    current_user: CurrentUser = Depends(require_roles(UserRole.ROLE_TUTOR)),
    session: Session = Depends(get_db_session),
) -> TeacherDashboardResponse:
    return get_teacher_dashboard(session, current_user)


@router.put("/presence", response_model=dict)
def update_presence(
    payload: PresenceUpdateRequest,
    current_user: CurrentUser = Depends(require_roles(UserRole.ROLE_TUTOR)),
    session: Session = Depends(get_db_session),
) -> dict:
    item = set_teacher_presence(session, payload, current_user)
    return {"tutor_user_id": str(item.tutor_user_id), "updated_at": item.updated_at.isoformat()}


@router.get("/presence/active", response_model=TeacherPresenceListResponse)
def active_presence(
    current_user: CurrentUser = Depends(require_roles(UserRole.ROLE_STUDENT)),
    session: Session = Depends(get_db_session),
) -> TeacherPresenceListResponse:
    _ = current_user
    return get_active_teacher_presence(session)


@router.post("/assistance/requests", response_model=AssistanceRequestItem)
def request_assistance(
    payload: AssistanceRequestCreate,
    request: Request,
    current_user: CurrentUser = Depends(require_roles(UserRole.ROLE_STUDENT)),
    session: Session = Depends(get_db_session),
) -> AssistanceRequestItem:
    return create_assistance_request(session, payload, current_user, get_request_locale(request))


@router.get("/assistance/requests", response_model=AssistanceRequestListResponse)
def tutor_requests(
    current_user: CurrentUser = Depends(require_roles(UserRole.ROLE_TUTOR)),
    session: Session = Depends(get_db_session),
) -> AssistanceRequestListResponse:
    return list_assistance_requests(session, current_user)


@router.patch("/assistance/requests/{request_id}/schedule", response_model=AssistanceActionResponse)
def schedule_request(
    request_id: UUID,
    payload: AssistanceScheduleRequest,
    request: Request,
    current_user: CurrentUser = Depends(require_roles(UserRole.ROLE_TUTOR)),
    session: Session = Depends(get_db_session),
) -> AssistanceActionResponse:
    return schedule_assistance_request(
        session,
        request_id,
        payload.scheduled_at,
        payload.meeting_url,
        current_user,
        get_request_locale(request),
    )


@router.patch("/assistance/requests/{request_id}/complete", response_model=AssistanceActionResponse)
def complete_request(
    request_id: UUID,
    request: Request,
    current_user: CurrentUser = Depends(require_roles(UserRole.ROLE_TUTOR)),
    session: Session = Depends(get_db_session),
) -> AssistanceActionResponse:
    return complete_assistance_request(session, request_id, current_user, get_request_locale(request))


@router.post("/feedback/prompts/lesson/{lesson_id}", response_model=EmitFeedbackResponse)
def emit_lesson_prompt(
    lesson_id: UUID,
    request: Request,
    current_user: CurrentUser = Depends(require_roles(UserRole.ROLE_STUDENT)),
    session: Session = Depends(get_db_session),
) -> EmitFeedbackResponse:
    record = emit_lesson_feedback_prompt(session, lesson_id, current_user, get_request_locale(request))
    return EmitFeedbackResponse(id=record.id, source_type=record.source_type.value, source_id=record.source_id)


@router.post("/feedback/prompts/assessment/{attempt_id}", response_model=EmitFeedbackResponse)
def emit_assessment_prompt(
    attempt_id: UUID,
    request: Request,
    current_user: CurrentUser = Depends(require_roles(UserRole.ROLE_STUDENT)),
    session: Session = Depends(get_db_session),
) -> EmitFeedbackResponse:
    record = emit_assessment_feedback_prompt(session, attempt_id, current_user, get_request_locale(request))
    return EmitFeedbackResponse(id=record.id, source_type=record.source_type.value, source_id=record.source_id)


@router.get("/feedback/prompts/me", response_model=FeedbackPromptListResponse)
def my_feedback_prompts(
    request: Request,
    current_user: CurrentUser = Depends(require_roles(UserRole.ROLE_STUDENT)),
    session: Session = Depends(get_db_session),
) -> FeedbackPromptListResponse:
    return list_feedback_prompts(session, current_user, get_request_locale(request))


@router.post("/feedback/prompts/{prompt_id}/answer", response_model=FeedbackPromptAnswerResponse)
def answer_prompt(
    prompt_id: UUID,
    payload: FeedbackPromptAnswerRequest,
    request: Request,
    current_user: CurrentUser = Depends(require_roles(UserRole.ROLE_STUDENT)),
    session: Session = Depends(get_db_session),
) -> FeedbackPromptAnswerResponse:
    return answer_feedback_prompt(session, prompt_id, payload, current_user, get_request_locale(request))
