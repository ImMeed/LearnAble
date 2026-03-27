from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models.users import User


def get_user_by_email(session: Session, email: str) -> User | None:
    return session.scalar(select(User).where(User.email == email.lower().strip()))


def create_user(session: Session, email: str, password_hash: str, role: str) -> User:
    user = User(email=email.lower().strip(), password_hash=password_hash, role=role)
    session.add(user)
    session.flush()
    return user
