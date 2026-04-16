from datetime import date
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.models.spelling import SpellingActivity, SpellingSession


def list_active_activities(session: Session, locale: str) -> list[SpellingActivity]:
    stmt = select(SpellingActivity).where(SpellingActivity.is_active.is_(True))
    if locale == "en":
        stmt = stmt.where(SpellingActivity.word_text_en.is_not(None))
    else:
        stmt = stmt.where(SpellingActivity.word_text_ar.is_not(None))
    stmt = stmt.order_by(SpellingActivity.created_at.asc())
    return list(session.scalars(stmt))


def get_activity_by_key(session: Session, key: str) -> SpellingActivity | None:
    stmt = select(SpellingActivity).where(SpellingActivity.key == key)
    return session.scalar(stmt)


def get_random_activity(session: Session, locale: str) -> SpellingActivity | None:
    stmt = select(SpellingActivity).where(SpellingActivity.is_active.is_(True))
    if locale == "en":
        stmt = stmt.where(SpellingActivity.word_text_en.is_not(None))
    else:
        stmt = stmt.where(SpellingActivity.word_text_ar.is_not(None))
    stmt = stmt.order_by(func.random()).limit(1)
    return session.scalar(stmt)


def create_session(session: Session, record: SpellingSession) -> SpellingSession:
    session.add(record)
    session.flush()
    return record


def get_session_for_student(
    session: Session,
    session_id: UUID,
    student_user_id: UUID,
    for_update: bool = False,
) -> SpellingSession | None:
    stmt = select(SpellingSession).where(
        SpellingSession.id == session_id,
        SpellingSession.student_user_id == student_user_id,
    )
    if for_update:
        stmt = stmt.with_for_update()
    return session.scalar(stmt)


def has_completed_session_on_date(session: Session, user_id: UUID, target_day: date) -> bool:
    stmt = select(func.count(SpellingSession.id)).where(
        SpellingSession.student_user_id == user_id,
        SpellingSession.completed_at.is_not(None),
        func.date(SpellingSession.completed_at) == target_day,
    )
    count = session.scalar(stmt)
    return bool(count and int(count) > 0)
