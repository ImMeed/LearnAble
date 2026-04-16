from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class SpellingActivityItem(BaseModel):
    key: str
    title: str
    difficulty: str


class SpellingActivityListResponse(BaseModel):
    items: list[SpellingActivityItem] = []


class StartSpellingSessionRequest(BaseModel):
    activity_key: str | None = Field(default=None, min_length=3, max_length=80)


class SpellingSessionResponse(BaseModel):
    session_id: UUID
    activity_key: str
    activity_title: str
    difficulty: str
    audio_text: str
    word_length: int
    hint_first_letter: str | None = None
    status: str
    attempt_count: int
    mistakes_count: int
    replay_count: int
    typed_playback_count: int
    started_at: datetime
    completed_at: datetime | None = None


class SpellingHintResponse(BaseModel):
    session_id: UUID
    first_letter: str
    hint_used: bool


class SpellingAnswerRequest(BaseModel):
    answer: str = Field(default="", max_length=255)


class SpellingAnswerResponse(BaseModel):
    session_id: UUID
    accepted: bool
    is_exact_match: bool
    is_near_match: bool
    solved: bool
    attempt_count: int
    mistakes_count: int
    feedback: str


class CompleteSpellingSessionRequest(BaseModel):
    replay_count: int = Field(default=0, ge=0, le=200)
    typed_playback_count: int = Field(default=0, ge=0, le=200)
    duration_ms: int | None = Field(default=None, ge=0, le=3_600_000)


class SpellingCompletionProgression(BaseModel):
    total_xp: int
    current_level: int
    next_level_xp: int
    leveled_up: bool
    new_badges: list[str] = []


class SpellingCompletionResponse(BaseModel):
    session_id: UUID
    solved: bool
    is_near_match: bool
    hint_used: bool
    attempt_count: int
    mistakes_count: int
    replay_count: int
    typed_playback_count: int
    earned_points: int
    earned_xp: int
    wallet_balance: int
    progression: SpellingCompletionProgression
    completed_at: datetime
