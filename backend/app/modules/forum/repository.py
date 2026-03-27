from sqlalchemy.orm import Session


def list_spaces(session: Session) -> list[dict]:
    _ = session
    return []
