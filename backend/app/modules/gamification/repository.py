from datetime import datetime
from uuid import UUID

from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session

from app.db.models.economy import XpLedger
from app.db.models.quiz import QuizAttempt
from app.db.models.reading_lab import ReadingLabSession
from app.db.models.study import StudentCourseCompletion
from app.db.models.users import User
from app.modules.notifications import repository as notifications_repository


def list_games(session: Session) -> list[dict]:
    _ = session
    return []


def get_leaderboard(session: Session) -> list[dict]:
    stmt = (
        select(
            User.id.label("user_id"),
            User.email.label("email"),
            func.coalesce(func.sum(XpLedger.xp_delta), 0).label("total_xp"),
        )
        .join(XpLedger, XpLedger.user_id == User.id, isouter=True)
        .group_by(User.id)
        .order_by(desc("total_xp"), User.created_at.asc())
        .limit(20)
    )
    rows = session.execute(stmt).all()
    return [{"user_id": row.user_id, "email": row.email, "total_xp": int(row.total_xp)} for row in rows]


def get_total_xp_for_user(session: Session, user_id: UUID) -> int:
    stmt = select(func.coalesce(func.sum(XpLedger.xp_delta), 0)).where(XpLedger.user_id == user_id)
    total = session.scalar(stmt)
    return int(total or 0)


def has_level_up_notification(session: Session, user_id: UUID, level: int) -> bool:
    return notifications_repository.has_notification_with_metadata(
        session=session,
        user_id=user_id,
        type="LEVEL_UP",
        metadata_key="level",
        metadata_value=level,
    )


def has_badge_unlock_notification(session: Session, user_id: UUID, badge_code: str) -> bool:
    return notifications_repository.has_notification_with_metadata(
        session=session,
        user_id=user_id,
        type="BADGE_UNLOCKED",
        metadata_key="badge_code",
        metadata_value=badge_code,
    )


def get_badge_unlock_notifications(session: Session, user_id: UUID) -> list[dict]:
    records = notifications_repository.list_notifications_by_type(session, user_id, "BADGE_UNLOCKED")
    return [{"created_at": record.created_at, "badge_code": record.metadata_json.get("badge_code", "")} for record in records]


def get_completed_reading_lab_stats_for_user(session: Session, user_id: UUID) -> dict[str, int]:
    stmt = select(
        func.count(ReadingLabSession.id),
        func.coalesce(func.sum(ReadingLabSession.total_rounds), 0),
    ).where(
        ReadingLabSession.student_user_id == user_id,
        ReadingLabSession.completed_at.is_not(None),
    )
    completed_sessions, total_rounds = session.execute(stmt).one()
    return {
        "completed_sessions": int(completed_sessions or 0),
        "total_rounds_completed": int(total_rounds or 0),
    }


def get_completed_quiz_count_for_user(session: Session, user_id: UUID) -> int:
    stmt = select(func.count(QuizAttempt.id)).where(
        QuizAttempt.user_id == user_id,
        QuizAttempt.completed_at.is_not(None),
    )
    count = session.scalar(stmt)
    return int(count or 0)


def list_completed_reading_lab_windows_for_user(session: Session, user_id: UUID) -> list[tuple[datetime, datetime]]:
    stmt = select(ReadingLabSession.started_at, ReadingLabSession.completed_at).where(
        ReadingLabSession.student_user_id == user_id,
        ReadingLabSession.completed_at.is_not(None),
    )
    rows = session.execute(stmt).all()
    return [(row.started_at, row.completed_at) for row in rows if row.started_at and row.completed_at]


def list_completed_quiz_windows_for_user(session: Session, user_id: UUID) -> list[tuple[datetime, datetime]]:
    stmt = select(QuizAttempt.started_at, QuizAttempt.completed_at).where(
        QuizAttempt.user_id == user_id,
        QuizAttempt.completed_at.is_not(None),
    )
    rows = session.execute(stmt).all()
    return [(row.started_at, row.completed_at) for row in rows if row.started_at and row.completed_at]


def count_completed_courses_for_user(session: Session, user_id: UUID) -> int:
    stmt = select(func.count(StudentCourseCompletion.id)).where(
        StudentCourseCompletion.student_user_id == user_id
    )
    count = session.scalar(stmt)
    return int(count or 0)
