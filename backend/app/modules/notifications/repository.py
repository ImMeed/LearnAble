from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models.notifications import Notification


def list_notifications_for_user(session: Session, user_id: UUID) -> list[Notification]:
    stmt = select(Notification).where(Notification.user_id == user_id).order_by(Notification.created_at.desc())
    return list(session.scalars(stmt))


def create_notification(
    session: Session,
    user_id: UUID,
    type: str,
    title: str,
    body: str,
    metadata: dict,
) -> Notification:
    notification = Notification(
        user_id=user_id,
        type=type,
        title=title,
        body=body,
        metadata_json=metadata,
        is_read=False,
    )
    session.add(notification)
    session.flush()
    return notification


def list_notifications_by_type(session: Session, user_id: UUID, type: str) -> list[Notification]:
    stmt = (
        select(Notification)
        .where(Notification.user_id == user_id, Notification.type == type)
        .order_by(Notification.created_at.desc())
    )
    return list(session.scalars(stmt))


def has_notification_with_metadata(
    session: Session,
    user_id: UUID,
    type: str,
    metadata_key: str,
    metadata_value: str | int,
) -> bool:
    records = list_notifications_by_type(session, user_id, type)
    return any(record.metadata_json.get(metadata_key) == metadata_value for record in records)


def get_notification_for_user(session: Session, notification_id: UUID, user_id: UUID) -> Notification | None:
    stmt = select(Notification).where(Notification.id == notification_id, Notification.user_id == user_id)
    return session.scalar(stmt)
