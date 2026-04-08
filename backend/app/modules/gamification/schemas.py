from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class GameItem(BaseModel):
    key: str
    title: str
    description: str


class GameListResponse(BaseModel):
    items: list[GameItem] = []


class LeaderboardItem(BaseModel):
    user_id: UUID
    label: str
    total_xp: int
    current_level: int


class LeaderboardResponse(BaseModel):
    items: list[LeaderboardItem] = []


class ProgressBadgeItem(BaseModel):
    code: str
    title: str
    description: str
    threshold_xp: int
    unlocked: bool
    unlocked_at: datetime | None = None


class ProgressionResponse(BaseModel):
    total_xp: int
    current_level: int
    next_level_xp: int
    badges: list[ProgressBadgeItem] = []
