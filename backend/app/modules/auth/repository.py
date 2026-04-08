from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.roles import UserRole
from app.db.models.links import StudentPsychologistLink
from app.db.models.users import User


def get_user_by_email(session: Session, email: str) -> User | None:
    return session.scalar(select(User).where(User.email == email.lower().strip()))


def create_user(session: Session, email: str, password_hash: str, role: str) -> User:
    user = User(email=email.lower().strip(), password_hash=password_hash, role=role)
    session.add(user)
    session.flush()
    return user


def get_first_psychologist_id(session: Session) -> UUID | None:
    stmt = (
        select(User.id)
        .where(User.role == UserRole.ROLE_PSYCHOLOGIST)
        .order_by(User.created_at.asc())
        .limit(1)
    )
    return session.scalar(stmt)


def create_student_psychologist_link(
    session: Session,
    student_user_id: UUID,
    psychologist_user_id: UUID,
) -> None:
    exists_stmt = select(StudentPsychologistLink).where(
        StudentPsychologistLink.student_user_id == student_user_id,
        StudentPsychologistLink.psychologist_user_id == psychologist_user_id,
    )
    if session.scalar(exists_stmt) is not None:
        return

    session.add(
        StudentPsychologistLink(
            student_user_id=student_user_id,
            psychologist_user_id=psychologist_user_id,
        )
    )
