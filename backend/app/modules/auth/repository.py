from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.platform_tracks import PlatformTrack
from app.core.roles import UserRole
from app.db.models.links import StudentParentLink, StudentPsychologistLink
from app.db.models.users import User


def get_user_by_email(session: Session, email: str, platform_track: PlatformTrack) -> User | None:
    return session.scalar(
        select(User).where(
            User.email == email.lower().strip(),
            User.platform_track == platform_track,
        )
    )


def create_user(
    session: Session,
    email: str,
    password_hash: str,
    role: str,
    platform_track: PlatformTrack,
    display_name: str | None = None,
) -> User:
    user = User(
        email=email.lower().strip(),
        display_name=display_name.strip() if display_name and display_name.strip() else None,
        password_hash=password_hash,
        role=role,
        platform_track=platform_track,
    )
    session.add(user)
    session.flush()
    return user


def get_user_by_id(session: Session, user_id: UUID, platform_track: PlatformTrack | None = None) -> User | None:
    stmt = select(User).where(User.id == user_id)
    if platform_track is not None:
        stmt = stmt.where(User.platform_track == platform_track)
    return session.scalar(stmt)


def get_first_psychologist_id(session: Session, platform_track: PlatformTrack) -> UUID | None:
    stmt = (
        select(User.id)
        .where(
            User.role == UserRole.ROLE_PSYCHOLOGIST,
            User.platform_track == platform_track,
        )
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


def create_student_parent_link(
    session: Session,
    student_user_id: UUID,
    parent_user_id: UUID,
) -> None:
    exists_stmt = select(StudentParentLink).where(
        StudentParentLink.student_user_id == student_user_id,
        StudentParentLink.parent_user_id == parent_user_id,
    )
    if session.scalar(exists_stmt) is not None:
        return

    session.add(
        StudentParentLink(
            student_user_id=student_user_id,
            parent_user_id=parent_user_id,
        )
    )
