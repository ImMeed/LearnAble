from uuid import UUID

from fastapi import status
from sqlalchemy.orm import Session

from app.core.i18n import localized_http_exception
from app.core.security import CurrentUser
from app.modules.notifications import repository
from app.modules.notifications.schemas import NotificationItem, NotificationReadResponse


def get_notifications(session: Session, current_user: CurrentUser, locale: str) -> list[NotificationItem]:
    records = repository.list_notifications_for_user(session, current_user.user_id)
    items = []
    for record in records:
        title = record.metadata_json.get("title_en") if locale == "en" else record.title
        body = record.metadata_json.get("body_en") if locale == "en" else record.body
        items.append(
            NotificationItem(
                id=record.id,
                type=record.type,
                title=title or record.title,
                body=body or record.body,
                is_read=record.is_read,
                created_at=record.created_at,
            )
        )
    return items


def mark_notification_read(
    session: Session,
    notification_id: UUID,
    current_user: CurrentUser,
    locale: str,
) -> NotificationReadResponse:
    record = repository.get_notification_for_user(session, notification_id, current_user.user_id)
    if record is None:
        raise localized_http_exception(status.HTTP_404_NOT_FOUND, "NOTIFICATION_NOT_FOUND", locale)

    record.is_read = True
    session.add(record)
    session.commit()
    return NotificationReadResponse(id=record.id, is_read=record.is_read)
