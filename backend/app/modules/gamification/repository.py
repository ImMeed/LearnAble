from uuid import UUID

from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session

from app.db.models.economy import XpLedger
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
