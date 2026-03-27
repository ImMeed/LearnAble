from sqlalchemy.orm import Session

from app.modules.gamification import repository


def get_games(session: Session) -> list[dict]:
    return repository.list_games(session)


def get_rankings(session: Session) -> list[dict]:
    return repository.get_leaderboard(session)
