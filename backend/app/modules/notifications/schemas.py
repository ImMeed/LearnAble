from pydantic import BaseModel


class NotificationListResponse(BaseModel):
    items: list[dict] = []
