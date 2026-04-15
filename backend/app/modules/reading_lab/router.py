from uuid import UUID

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.core.i18n import get_request_locale
from app.core.roles import UserRole, require_roles
from app.core.security import CurrentUser
from app.db.session import get_db_session
from app.modules.reading_lab.schemas import (
    LinkedStudentListResponse,
    LinkStudentRequest,
    LinkStudentResponse,
    ReadingLabAnswerRequest,
    ReadingLabAnswerResponse,
    ReadingLabCompletionResponse,
    ReadingLabSessionResponse,
    ReadingLabSummaryResponse,
    ReadingSupportPlanResponse,
    ReadingSupportPlanUpdateRequest,
    StartReadingLabSessionRequest,
    StudentLinkIdResponse,
)
from app.modules.reading_lab.service import (
    complete_session,
    get_student_link_id,
    get_session,
    get_student_summary,
    get_support_plan,
    link_student,
    list_linked_students,
    list_tutor_students,
    regenerate_student_link_id,
    start_session,
    submit_answer,
    update_support_plan,
)

router = APIRouter(prefix="/reading-lab", tags=["reading-lab"])


@router.get("/summary/me", response_model=ReadingLabSummaryResponse)
def summary_me(
    request: Request,
    current_user: CurrentUser = Depends(require_roles(UserRole.ROLE_STUDENT)),
    session: Session = Depends(get_db_session),
) -> ReadingLabSummaryResponse:
    return get_student_summary(session, current_user, get_request_locale(request))


@router.get("/link-id/me", response_model=StudentLinkIdResponse)
def link_id_me(
    request: Request,
    current_user: CurrentUser = Depends(require_roles(UserRole.ROLE_STUDENT)),
    session: Session = Depends(get_db_session),
) -> StudentLinkIdResponse:
    return get_student_link_id(session, current_user, get_request_locale(request))


@router.post("/link-id/me/regenerate", response_model=StudentLinkIdResponse)
def regenerate_link_id_me(
    request: Request,
    current_user: CurrentUser = Depends(require_roles(UserRole.ROLE_STUDENT)),
    session: Session = Depends(get_db_session),
) -> StudentLinkIdResponse:
    return regenerate_student_link_id(session, current_user, get_request_locale(request))


@router.get("/children", response_model=LinkedStudentListResponse)
def children(
    request: Request,
    current_user: CurrentUser = Depends(require_roles(UserRole.ROLE_PARENT, UserRole.ROLE_PSYCHOLOGIST)),
    session: Session = Depends(get_db_session),
) -> LinkedStudentListResponse:
    return list_linked_students(session, current_user, get_request_locale(request))


@router.post("/children/link", response_model=LinkStudentResponse)
def link_children(
    payload: LinkStudentRequest,
    request: Request,
    current_user: CurrentUser = Depends(require_roles(UserRole.ROLE_PARENT, UserRole.ROLE_PSYCHOLOGIST)),
    session: Session = Depends(get_db_session),
) -> LinkStudentResponse:
    return link_student(session, payload, current_user, get_request_locale(request))


@router.get("/students/taught", response_model=LinkedStudentListResponse)
def taught_students(
    request: Request,
    current_user: CurrentUser = Depends(require_roles(UserRole.ROLE_TUTOR)),
    session: Session = Depends(get_db_session),
) -> LinkedStudentListResponse:
    return list_tutor_students(session, current_user, get_request_locale(request))


@router.get("/support/students/{student_id}", response_model=ReadingSupportPlanResponse)
def support_plan(
    student_id: UUID,
    request: Request,
    current_user: CurrentUser = Depends(
        require_roles(UserRole.ROLE_PARENT, UserRole.ROLE_PSYCHOLOGIST, UserRole.ROLE_TUTOR)
    ),
    session: Session = Depends(get_db_session),
) -> ReadingSupportPlanResponse:
    return get_support_plan(session, student_id, current_user, get_request_locale(request))


@router.put("/support/students/{student_id}", response_model=ReadingSupportPlanResponse)
def update_plan(
    student_id: UUID,
    payload: ReadingSupportPlanUpdateRequest,
    request: Request,
    current_user: CurrentUser = Depends(
        require_roles(UserRole.ROLE_PARENT, UserRole.ROLE_PSYCHOLOGIST, UserRole.ROLE_TUTOR)
    ),
    session: Session = Depends(get_db_session),
) -> ReadingSupportPlanResponse:
    return update_support_plan(session, student_id, payload, current_user, get_request_locale(request))


@router.post("/sessions/start", response_model=ReadingLabSessionResponse)
def start(
    payload: StartReadingLabSessionRequest,
    request: Request,
    current_user: CurrentUser = Depends(require_roles(UserRole.ROLE_STUDENT)),
    session: Session = Depends(get_db_session),
) -> ReadingLabSessionResponse:
    return start_session(session, payload, current_user, get_request_locale(request))


@router.get("/sessions/{session_id}", response_model=ReadingLabSessionResponse)
def get_existing_session(
    session_id: UUID,
    request: Request,
    current_user: CurrentUser = Depends(require_roles(UserRole.ROLE_STUDENT)),
    session: Session = Depends(get_db_session),
) -> ReadingLabSessionResponse:
    return get_session(session, session_id, current_user, get_request_locale(request))


@router.post("/sessions/{session_id}/answer", response_model=ReadingLabAnswerResponse)
def answer(
    session_id: UUID,
    payload: ReadingLabAnswerRequest,
    request: Request,
    current_user: CurrentUser = Depends(require_roles(UserRole.ROLE_STUDENT)),
    session: Session = Depends(get_db_session),
) -> ReadingLabAnswerResponse:
    return submit_answer(session, session_id, payload, current_user, get_request_locale(request))


@router.post("/sessions/{session_id}/complete", response_model=ReadingLabCompletionResponse)
def complete(
    session_id: UUID,
    request: Request,
    current_user: CurrentUser = Depends(require_roles(UserRole.ROLE_STUDENT)),
    session: Session = Depends(get_db_session),
) -> ReadingLabCompletionResponse:
    return complete_session(session, session_id, current_user, get_request_locale(request))
