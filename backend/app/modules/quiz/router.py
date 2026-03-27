from uuid import UUID

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.core.i18n import get_request_locale
from app.core.security import CurrentUser, get_current_user
from app.db.session import get_db_session
from app.modules.quiz.schemas import HintRequest, HintResponse, QuizListResponse, StartQuizResponse, SubmitQuizRequest, SubmitQuizResponse
from app.modules.quiz.service import get_quizzes, get_quiz_hint, start_quiz, submit_quiz

router = APIRouter(prefix="/quizzes", tags=["quiz"])


@router.get("", response_model=QuizListResponse)
def list_quizzes(request: Request, session: Session = Depends(get_db_session)) -> QuizListResponse:
    return get_quizzes(session, get_request_locale(request))


@router.post("/{quiz_id}/start", response_model=StartQuizResponse)
def start_quiz_attempt(
    quiz_id: UUID,
    request: Request,
    current_user: CurrentUser = Depends(get_current_user),
    session: Session = Depends(get_db_session),
) -> StartQuizResponse:
    return start_quiz(session, quiz_id, current_user, get_request_locale(request))


@router.post("/{quiz_id}/submit", response_model=SubmitQuizResponse)
def submit_quiz_attempt(
    quiz_id: UUID,
    payload: SubmitQuizRequest,
    request: Request,
    current_user: CurrentUser = Depends(get_current_user),
    session: Session = Depends(get_db_session),
) -> SubmitQuizResponse:
    return submit_quiz(session, quiz_id, payload, current_user, get_request_locale(request))


@router.post("/{quiz_id}/hint", response_model=HintResponse)
def quiz_hint(
    quiz_id: UUID,
    payload: HintRequest,
    request: Request,
    current_user: CurrentUser = Depends(get_current_user),
    session: Session = Depends(get_db_session),
) -> HintResponse:
    return get_quiz_hint(session, quiz_id, payload, current_user, get_request_locale(request))
