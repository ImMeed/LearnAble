from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field


class StudyStatusResponse(BaseModel):
    status: str = "ok"


class ScreeningRequest(BaseModel):
    focus_score: int = Field(ge=0, le=100)
    reading_score: int = Field(ge=0, le=100)
    memory_score: int = Field(ge=0, le=100)
    notes: str | None = Field(default=None, max_length=300)


class ScreeningResponse(BaseModel):
    support_level: str
    indicators: dict


class LessonSummary(BaseModel):
    id: UUID
    title: str
    difficulty: str


class LessonListResponse(BaseModel):
    items: list[LessonSummary] = []


class LessonDetailResponse(BaseModel):
    id: UUID
    title: str
    body: str
    difficulty: str


class AssistRequest(BaseModel):
    mode: Literal["voice", "summary", "explain", "qa"]
    question: str | None = Field(default=None, max_length=300)


class AssistResponse(BaseModel):
    mode: str
    content: str


class FlashcardItem(BaseModel):
    front: str
    back: str


class FlashcardListResponse(BaseModel):
    items: list[FlashcardItem] = []


class ReadingGameItem(BaseModel):
    id: UUID
    name: str
    objective: str
    words: list[str]


class ReadingGameListResponse(BaseModel):
    items: list[ReadingGameItem] = []


class AwarenessTopic(BaseModel):
    key: str
    title: str
    body: str


class AwarenessResponse(BaseModel):
    items: list[AwarenessTopic]
