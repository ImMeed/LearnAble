from pydantic import BaseModel


class GameListResponse(BaseModel):
    items: list[dict] = []


class LeaderboardResponse(BaseModel):
    items: list[dict] = []
