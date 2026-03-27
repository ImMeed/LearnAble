from sqlalchemy.orm import Session


def list_notifications(session: Session) -> list[dict]:
    _ = session
    return []
