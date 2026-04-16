from uuid import UUID

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.core.i18n import get_request_locale
from app.core.roles import UserRole, require_roles
from app.core.security import CurrentUser
from app.db.session import get_db_session
from app.modules.spelling.schemas import (
    CompleteSpellingSessionRequest,
    SpellingActivityListResponse,
    SpellingAnswerRequest,
    SpellingAnswerResponse,
    SpellingCompletionResponse,
    SpellingHintResponse,
    SpellingSessionResponse,
    StartSpellingSessionRequest,
)
from app.modules.spelling.service import complete_session, get_hint, get_session, list_activities, start_session, submit_answer

router = APIRouter(prefix="/spelling", tags=["spelling"])


@router.get("/activities", response_model=SpellingActivityListResponse)
def activities(
    request: Request,
    current_user: CurrentUser = Depends(require_roles(UserRole.ROLE_STUDENT)),
    session: Session = Depends(get_db_session),
) -> SpellingActivityListResponse:
    return list_activities(session, get_request_locale(request))


@router.post("/sessions/start", response_model=SpellingSessionResponse)
def start(
    payload: StartSpellingSessionRequest,
    request: Request,
    current_user: CurrentUser = Depends(require_roles(UserRole.ROLE_STUDENT)),
    session: Session = Depends(get_db_session),
) -> SpellingSessionResponse:
    return start_session(session, payload, current_user, get_request_locale(request))


@router.get("/sessions/{session_id}", response_model=SpellingSessionResponse)
def get_existing(
    session_id: UUID,
    request: Request,
    current_user: CurrentUser = Depends(require_roles(UserRole.ROLE_STUDENT)),
    session: Session = Depends(get_db_session),
) -> SpellingSessionResponse:
    return get_session(session, session_id, current_user, get_request_locale(request))


@router.post("/sessions/{session_id}/hint", response_model=SpellingHintResponse)
def hint(
    session_id: UUID,
    request: Request,
    current_user: CurrentUser = Depends(require_roles(UserRole.ROLE_STUDENT)),
    session: Session = Depends(get_db_session),
) -> SpellingHintResponse:
    return get_hint(session, session_id, current_user, get_request_locale(request))


@router.post("/sessions/{session_id}/answer", response_model=SpellingAnswerResponse)
def answer(
    session_id: UUID,
    payload: SpellingAnswerRequest,
    request: Request,
    current_user: CurrentUser = Depends(require_roles(UserRole.ROLE_STUDENT)),
    session: Session = Depends(get_db_session),
) -> SpellingAnswerResponse:
    return submit_answer(session, session_id, payload, current_user, get_request_locale(request))


@router.post("/sessions/{session_id}/complete", response_model=SpellingCompletionResponse)
def complete(
    session_id: UUID,
    payload: CompleteSpellingSessionRequest,
    request: Request,
    current_user: CurrentUser = Depends(require_roles(UserRole.ROLE_STUDENT)),
    session: Session = Depends(get_db_session),
) -> SpellingCompletionResponse:
    return complete_session(session, session_id, payload, current_user, get_request_locale(request))
