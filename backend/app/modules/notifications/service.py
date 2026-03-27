from sqlalchemy.orm import Session

from app.modules.notifications import repository


def get_notifications(session: Session) -> list[dict]:
    return repository.list_notifications(session)
