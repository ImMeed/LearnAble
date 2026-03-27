from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db_session
from app.modules.gamification.schemas import GameListResponse, LeaderboardResponse
from app.modules.gamification.service import get_games, get_rankings

router = APIRouter(tags=["gamification"])


@router.get("/games", response_model=GameListResponse)
def list_games(session: Session = Depends(get_db_session)) -> GameListResponse:
    return GameListResponse(items=get_games(session))


@router.get("/leaderboard", response_model=LeaderboardResponse)
def get_leaderboard(session: Session = Depends(get_db_session)) -> LeaderboardResponse:
    return LeaderboardResponse(items=get_rankings(session))
