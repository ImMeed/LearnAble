from sqlalchemy.orm import Session

from app.modules.forum import repository


def get_spaces(session: Session) -> list[dict]:
    return repository.list_spaces(session)
