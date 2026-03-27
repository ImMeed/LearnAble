from pydantic import BaseModel


class SpaceListResponse(BaseModel):
    items: list[dict] = []
