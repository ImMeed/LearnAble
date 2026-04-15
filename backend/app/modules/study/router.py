from uuid import UUID

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.core.i18n import get_request_locale
from app.core.roles import UserRole, require_roles
from app.core.security import CurrentUser
from app.db.session import get_db_session
from app.modules.study.schemas import (
	AssistRequest,
	AssistResponse,
	AwarenessResponse,
	FlashcardListResponse,
	LessonDetailResponse,
	LessonListResponse,
	ReadingGameListResponse,
	ScreeningRequest,
	ScreeningResponse,
	StudyStatusResponse,
)
from app.modules.study.service import (
	fetch_study_status,
	get_awareness,
	get_lesson_assist,
	get_lesson_detail,
	get_lesson_flashcards,
	get_lesson_reading_games,
	get_lessons_for_user,
	submit_screening,
)

router = APIRouter(prefix="/study", tags=["study"])


@router.get("/status", response_model=StudyStatusResponse)
def status(session: Session = Depends(get_db_session)) -> StudyStatusResponse:
	return StudyStatusResponse(status=fetch_study_status(session))


@router.post("/screening/complete", response_model=ScreeningResponse)
def complete_screening(
	payload: ScreeningRequest,
	request: Request,
	current_user: CurrentUser = Depends(require_roles(UserRole.ROLE_STUDENT)),
	session: Session = Depends(get_db_session),
) -> ScreeningResponse:
	return submit_screening(session, payload, current_user, get_request_locale(request))


@router.get("/lessons", response_model=LessonListResponse)
def list_lessons(
	request: Request,
	current_user: CurrentUser = Depends(require_roles(UserRole.ROLE_STUDENT, UserRole.ROLE_TUTOR)),
	session: Session = Depends(get_db_session),
) -> LessonListResponse:
	return get_lessons_for_user(session, get_request_locale(request), current_user)


@router.get("/lessons/{lesson_id}", response_model=LessonDetailResponse)
def lesson_detail(
	lesson_id: UUID,
	request: Request,
	current_user: CurrentUser = Depends(require_roles(UserRole.ROLE_STUDENT, UserRole.ROLE_TUTOR)),
	session: Session = Depends(get_db_session),
) -> LessonDetailResponse:
	return get_lesson_detail(session, lesson_id, get_request_locale(request), current_user)


@router.post("/lessons/{lesson_id}/assist", response_model=AssistResponse)
def lesson_assist(
	lesson_id: UUID,
	payload: AssistRequest,
	request: Request,
	current_user: CurrentUser = Depends(require_roles(UserRole.ROLE_STUDENT)),
	session: Session = Depends(get_db_session),
) -> AssistResponse:
	return get_lesson_assist(session, lesson_id, payload, get_request_locale(request), current_user)


@router.get("/lessons/{lesson_id}/flashcards", response_model=FlashcardListResponse)
def lesson_flashcards(
	lesson_id: UUID,
	request: Request,
	current_user: CurrentUser = Depends(require_roles(UserRole.ROLE_STUDENT, UserRole.ROLE_TUTOR)),
	session: Session = Depends(get_db_session),
) -> FlashcardListResponse:
	return get_lesson_flashcards(session, lesson_id, get_request_locale(request), current_user)


@router.get("/lessons/{lesson_id}/games", response_model=ReadingGameListResponse)
def lesson_games(
	lesson_id: UUID,
	request: Request,
	current_user: CurrentUser = Depends(require_roles(UserRole.ROLE_STUDENT, UserRole.ROLE_TUTOR)),
	session: Session = Depends(get_db_session),
) -> ReadingGameListResponse:
	return get_lesson_reading_games(session, lesson_id, get_request_locale(request), current_user)


@router.get("/awareness", response_model=AwarenessResponse)
def awareness(request: Request) -> AwarenessResponse:
	return get_awareness(get_request_locale(request))
