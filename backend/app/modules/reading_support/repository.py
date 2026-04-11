from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.platform_tracks import PlatformTrack
from app.db.models.links import StudentParentLink, StudentPsychologistLink
from app.db.models.reading_support import DyslexiaSupportProfile, ReadingLabSession
from app.db.models.users import User


def get_student(session: Session, student_id: UUID, platform_track: str | PlatformTrack | None = None) -> User | None:
    stmt = select(User).where(User.id == student_id)
    if platform_track is not None:
        stmt = stmt.where(User.platform_track == platform_track)
    return session.scalar(stmt)


def get_student_by_email(
    session: Session,
    email: str,
    platform_track: str | PlatformTrack | None = None,
) -> User | None:
    stmt = select(User).where(User.email == email.lower().strip())
    if platform_track is not None:
        stmt = stmt.where(User.platform_track == platform_track)
    return session.scalar(stmt)


def get_support_profile(session: Session, student_id: UUID) -> DyslexiaSupportProfile | None:
    stmt = select(DyslexiaSupportProfile).where(DyslexiaSupportProfile.student_user_id == student_id)
    return session.scalar(stmt)


def is_student_linked_to_parent(session: Session, student_id: UUID, parent_id: UUID) -> bool:
    stmt = select(StudentParentLink).where(
        StudentParentLink.student_user_id == student_id,
        StudentParentLink.parent_user_id == parent_id,
    )
    return session.scalar(stmt) is not None


def is_student_linked_to_psychologist(session: Session, student_id: UUID, psychologist_id: UUID) -> bool:
    stmt = select(StudentPsychologistLink).where(
        StudentPsychologistLink.student_user_id == student_id,
        StudentPsychologistLink.psychologist_user_id == psychologist_id,
    )
    return session.scalar(stmt) is not None


def list_students_for_parent(
    session: Session,
    parent_id: UUID,
    platform_track: str | PlatformTrack | None = None,
) -> list[User]:
    stmt = (
        select(User)
        .join(StudentParentLink, StudentParentLink.student_user_id == User.id)
        .where(StudentParentLink.parent_user_id == parent_id)
        .order_by(User.created_at.asc())
    )
    if platform_track is not None:
        stmt = stmt.where(User.platform_track == platform_track)
    return list(session.scalars(stmt))


def list_students_for_psychologist(
    session: Session,
    psychologist_id: UUID,
    platform_track: str | PlatformTrack | None = None,
) -> list[User]:
    stmt = (
        select(User)
        .join(StudentPsychologistLink, StudentPsychologistLink.student_user_id == User.id)
        .where(StudentPsychologistLink.psychologist_user_id == psychologist_id)
        .order_by(User.created_at.asc())
    )
    if platform_track is not None:
        stmt = stmt.where(User.platform_track == platform_track)
    return list(session.scalars(stmt))


def create_student_parent_link(session: Session, student_user_id: UUID, parent_user_id: UUID) -> None:
    stmt = select(StudentParentLink).where(
        StudentParentLink.student_user_id == student_user_id,
        StudentParentLink.parent_user_id == parent_user_id,
    )
    if session.scalar(stmt) is not None:
        return

    session.add(
        StudentParentLink(
            student_user_id=student_user_id,
            parent_user_id=parent_user_id,
        )
    )


def create_student_psychologist_link(session: Session, student_user_id: UUID, psychologist_user_id: UUID) -> None:
    stmt = select(StudentPsychologistLink).where(
        StudentPsychologistLink.student_user_id == student_user_id,
        StudentPsychologistLink.psychologist_user_id == psychologist_user_id,
    )
    if session.scalar(stmt) is not None:
        return

    session.add(
        StudentPsychologistLink(
            student_user_id=student_user_id,
            psychologist_user_id=psychologist_user_id,
        )
    )


def upsert_support_profile(
    session: Session,
    student_user_id: UUID,
    declared_by_user_id: UUID,
    declared_by_role: str,
    notes: str,
    focus_letters: list[str],
    focus_words: list[str],
    focus_numbers: list[str],
    is_active: bool,
) -> DyslexiaSupportProfile:
    record = get_support_profile(session, student_user_id)
    if record is None:
        record = DyslexiaSupportProfile(
            student_user_id=student_user_id,
            declared_by_user_id=declared_by_user_id,
            declared_by_role=declared_by_role,
            notes=notes,
            focus_letters_json=focus_letters,
            focus_words_json=focus_words,
            focus_numbers_json=focus_numbers,
            is_active=is_active,
        )
        session.add(record)
    else:
        record.declared_by_user_id = declared_by_user_id
        record.declared_by_role = declared_by_role
        record.notes = notes
        record.focus_letters_json = focus_letters
        record.focus_words_json = focus_words
        record.focus_numbers_json = focus_numbers
        record.is_active = is_active
        session.add(record)
    session.flush()
    return record


def create_reading_lab_session(
    session: Session,
    student_user_id: UUID,
    game_key: str,
    content_source: str,
    locale: str,
    round_payload: list[dict],
) -> ReadingLabSession:
    record = ReadingLabSession(
        student_user_id=student_user_id,
        game_key=game_key,
        content_source=content_source,
        locale=locale,
        round_payload_json=round_payload,
        answers_json=[],
        total_rounds=len(round_payload),
        correct_rounds=0,
        status="IN_PROGRESS",
    )
    session.add(record)
    session.flush()
    return record


def get_reading_lab_session_for_student(
    session: Session,
    session_id: UUID,
    student_user_id: UUID,
) -> ReadingLabSession | None:
    stmt = select(ReadingLabSession).where(
        ReadingLabSession.id == session_id,
        ReadingLabSession.student_user_id == student_user_id,
    )
    return session.scalar(stmt)


def list_completed_sessions_for_student(session: Session, student_user_id: UUID) -> list[ReadingLabSession]:
    stmt = (
        select(ReadingLabSession)
        .where(
            ReadingLabSession.student_user_id == student_user_id,
            ReadingLabSession.status == "COMPLETED",
        )
        .order_by(ReadingLabSession.completed_at.desc())
    )
    return list(session.scalars(stmt))
