from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db_session
from app.modules.notifications.schemas import NotificationListResponse
from app.modules.notifications.service import get_notifications

router = APIRouter(tags=["notifications"])


@router.get("/notifications", response_model=NotificationListResponse)
def list_notifications(session: Session = Depends(get_db_session)) -> NotificationListResponse:
    return NotificationListResponse(items=get_notifications(session))
