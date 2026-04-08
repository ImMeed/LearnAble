from uuid import UUID

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.core.i18n import get_request_locale
from app.core.security import CurrentUser, get_current_user
from app.db.session import get_db_session
from app.modules.notifications.schemas import NotificationListResponse, NotificationReadResponse
from app.modules.notifications.service import get_notifications, mark_notification_read

router = APIRouter(tags=["notifications"])


@router.get("/notifications", response_model=NotificationListResponse)
def list_notifications(
    request: Request,
    current_user: CurrentUser = Depends(get_current_user),
    session: Session = Depends(get_db_session),
) -> NotificationListResponse:
    return NotificationListResponse(items=get_notifications(session, current_user, get_request_locale(request)))


@router.patch("/notifications/{notification_id}/read", response_model=NotificationReadResponse)
def read_notification(
    notification_id: UUID,
    request: Request,
    current_user: CurrentUser = Depends(get_current_user),
    session: Session = Depends(get_db_session),
) -> NotificationReadResponse:
    return mark_notification_read(session, notification_id, current_user, get_request_locale(request))
