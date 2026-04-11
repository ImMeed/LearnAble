from uuid import UUID

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.core.i18n import get_request_locale
from app.core.roles import UserRole, require_roles
from app.core.security import CurrentUser
from app.db.session import get_db_session
from app.modules.reading_support.schemas import (
    CompleteReadingLabSessionResponse,
    CreateReadingSupportStudentRequest,
    CreateReadingSupportStudentResponse,
    LinkReadingSupportStudentRequest,
    ReadingLabGameListResponse,
    ReadingSupportMeResponse,
    ReadingSupportProfileResponse,
    ReadingSupportStudentListResponse,
    StartReadingLabSessionRequest,
    StartReadingLabSessionResponse,
    SubmitReadingLabAnswerRequest,
    SubmitReadingLabAnswerResponse,
    UpdateReadingSupportRequest,
)
from app.modules.reading_support.service import (
    complete_reading_lab_session,
    create_parent_managed_student,
    get_my_reading_support,
    get_reading_lab_games,
    link_observer_to_student,
    list_observer_students,
    start_reading_lab_session,
    submit_reading_lab_answer,
    update_student_reading_support,
)

router = APIRouter(prefix="/reading-support", tags=["reading-support"])


@router.get("/me", response_model=ReadingSupportMeResponse)
def my_support(
    request: Request,
    current_user: CurrentUser = Depends(require_roles(UserRole.ROLE_STUDENT)),
    session: Session = Depends(get_db_session),
) -> ReadingSupportMeResponse:
    return get_my_reading_support(session, current_user, get_request_locale(request))


@router.get("/students", response_model=ReadingSupportStudentListResponse)
def observer_students(
    request: Request,
    current_user: CurrentUser = Depends(require_roles(UserRole.ROLE_PARENT, UserRole.ROLE_PSYCHOLOGIST)),
    session: Session = Depends(get_db_session),
) -> ReadingSupportStudentListResponse:
    return list_observer_students(session, current_user, get_request_locale(request))


@router.post("/students/link", response_model=ReadingSupportProfileResponse | None)
def link_student(
    payload: LinkReadingSupportStudentRequest,
    request: Request,
    current_user: CurrentUser = Depends(require_roles(UserRole.ROLE_PARENT, UserRole.ROLE_PSYCHOLOGIST)),
    session: Session = Depends(get_db_session),
) -> ReadingSupportProfileResponse | None:
    return link_observer_to_student(session, payload.student_id, current_user, get_request_locale(request))


@router.post("/students", response_model=CreateReadingSupportStudentResponse, status_code=201)
def create_student(
    payload: CreateReadingSupportStudentRequest,
    request: Request,
    current_user: CurrentUser = Depends(require_roles(UserRole.ROLE_PARENT)),
    session: Session = Depends(get_db_session),
) -> CreateReadingSupportStudentResponse:
    return create_parent_managed_student(session, payload, current_user, get_request_locale(request))


@router.put("/students/{student_id}", response_model=ReadingSupportProfileResponse)
def upsert_support(
    student_id: UUID,
    payload: UpdateReadingSupportRequest,
    request: Request,
    current_user: CurrentUser = Depends(require_roles(UserRole.ROLE_PARENT, UserRole.ROLE_PSYCHOLOGIST)),
    session: Session = Depends(get_db_session),
) -> ReadingSupportProfileResponse:
    return update_student_reading_support(session, student_id, payload, current_user, get_request_locale(request))


@router.get("/games", response_model=ReadingLabGameListResponse)
def games(
    request: Request,
    current_user: CurrentUser = Depends(require_roles(UserRole.ROLE_STUDENT)),
    session: Session = Depends(get_db_session),
) -> ReadingLabGameListResponse:
    return get_reading_lab_games(session, current_user, get_request_locale(request))


@router.post("/sessions", response_model=StartReadingLabSessionResponse)
def start_session(
    payload: StartReadingLabSessionRequest,
    request: Request,
    current_user: CurrentUser = Depends(require_roles(UserRole.ROLE_STUDENT)),
    session: Session = Depends(get_db_session),
) -> StartReadingLabSessionResponse:
    return start_reading_lab_session(session, payload.game_key, current_user, get_request_locale(request))


@router.post("/sessions/{session_id}/answer", response_model=SubmitReadingLabAnswerResponse)
def submit_answer(
    session_id: UUID,
    payload: SubmitReadingLabAnswerRequest,
    request: Request,
    current_user: CurrentUser = Depends(require_roles(UserRole.ROLE_STUDENT)),
    session: Session = Depends(get_db_session),
) -> SubmitReadingLabAnswerResponse:
    return submit_reading_lab_answer(
        session,
        session_id,
        payload.round_index,
        payload.answer,
        current_user,
        get_request_locale(request),
    )


@router.post("/sessions/{session_id}/complete", response_model=CompleteReadingLabSessionResponse)
def complete_session(
    session_id: UUID,
    request: Request,
    current_user: CurrentUser = Depends(require_roles(UserRole.ROLE_STUDENT)),
    session: Session = Depends(get_db_session),
) -> CompleteReadingLabSessionResponse:
    return complete_reading_lab_session(session, session_id, current_user, get_request_locale(request))
