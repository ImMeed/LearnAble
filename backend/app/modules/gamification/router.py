from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.core.i18n import get_request_locale
from app.core.roles import UserRole, require_roles
from app.core.security import CurrentUser
from app.db.session import get_db_session
from app.modules.gamification.schemas import GameListResponse, LeaderboardResponse, ProgressSummaryResponse, ProgressionResponse
from app.modules.gamification.service import get_games, get_progress_summary, get_progression, get_rankings

router = APIRouter(tags=["gamification"])


@router.get("/games", response_model=GameListResponse)
def list_games(session: Session = Depends(get_db_session)) -> GameListResponse:
    return GameListResponse(items=get_games(session))


@router.get("/leaderboard", response_model=LeaderboardResponse)
def get_leaderboard(session: Session = Depends(get_db_session)) -> LeaderboardResponse:
    return LeaderboardResponse(items=get_rankings(session))


@router.get("/gamification/progression/me", response_model=ProgressionResponse)
def my_progression(
    request: Request,
    current_user: CurrentUser = Depends(require_roles(UserRole.ROLE_STUDENT)),
    session: Session = Depends(get_db_session),
) -> ProgressionResponse:
    data = get_progression(session, current_user.user_id, get_request_locale(request))
    return ProgressionResponse(**data)


@router.get("/gamification/progress-summary/me", response_model=ProgressSummaryResponse)
def my_progress_summary(
    request: Request,
    current_user: CurrentUser = Depends(require_roles(UserRole.ROLE_STUDENT)),
    session: Session = Depends(get_db_session),
) -> ProgressSummaryResponse:
    data = get_progress_summary(session, current_user.user_id, get_request_locale(request))
    return ProgressSummaryResponse(**data)
