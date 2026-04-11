import re
from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field, field_validator


class ReadingSupportProgressByGame(BaseModel):
    game_key: str
    title: str
    play_count: int
    average_accuracy: int
    best_accuracy: int


class ReadingSupportRewardItem(BaseModel):
    code: str
    title: str
    unlocked_at: datetime | None = None


class ReadingSupportTrendPoint(BaseModel):
    session_id: UUID
    game_key: str
    title: str
    accuracy: int
    points_awarded: int
    xp_awarded: int
    duration_seconds: int
    completed_at: datetime


class ReadingSupportProgressResponse(BaseModel):
    completed_sessions: int
    average_accuracy: int
    best_accuracy: int
    total_points_earned: int
    total_xp_earned: int
    current_level: int
    next_level_xp: int
    average_session_seconds: int
    total_play_time_seconds: int
    unlocked_rewards: list[ReadingSupportRewardItem]
    last_played_at: datetime | None
    performance_trend: list[ReadingSupportTrendPoint]
    by_game: list[ReadingSupportProgressByGame]


class ReadingSupportProfileResponse(BaseModel):
    id: UUID
    student_user_id: UUID
    student_label: str | None = None
    declared_by_user_id: UUID
    declared_by_role: str
    notes: str
    focus_letters: list[str]
    focus_words: list[str]
    focus_numbers: list[str]
    is_active: bool
    activated_at: datetime
    updated_at: datetime


class ReadingSupportMeResponse(BaseModel):
    student_user_id: UUID
    student_label: str
    is_support_active: bool
    support_profile: ReadingSupportProfileResponse | None
    progress: ReadingSupportProgressResponse


class ReadingSupportStudentOverview(BaseModel):
    student_user_id: UUID
    student_label: str
    support_profile: ReadingSupportProfileResponse | None
    progress: ReadingSupportProgressResponse


class ReadingSupportStudentListResponse(BaseModel):
    items: list[ReadingSupportStudentOverview]


class UpdateReadingSupportRequest(BaseModel):
    is_active: bool = True
    notes: str = Field(default="", max_length=1000)
    focus_letters: list[str] = Field(default_factory=list, max_length=12)
    focus_words: list[str] = Field(default_factory=list, max_length=12)
    focus_numbers: list[str] = Field(default_factory=list, max_length=12)


class LinkReadingSupportStudentRequest(BaseModel):
    student_id: UUID


class CreateReadingSupportStudentRequest(BaseModel):
    display_name: str = Field(min_length=1, max_length=120)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)

    @field_validator("display_name")
    @classmethod
    def normalize_display_name(cls, value: str) -> str:
        return value.strip()

    @field_validator("password")
    @classmethod
    def password_strength(cls, value: str) -> str:
        errors = []
        if not re.search(r"[A-Z]", value):
            errors.append("one uppercase letter")
        if not re.search(r"[0-9]", value):
            errors.append("one digit")
        if not re.search(r'[!@#$%^&*()\-_=+\[\]{};:\'",.<>/?\\|`~]', value):
            errors.append("one special character")
        if errors:
            raise ValueError(f"Password must contain at least: {', '.join(errors)}")
        return value


class CreateReadingSupportStudentResponse(BaseModel):
    student_user_id: UUID
    student_label: str
    email: EmailStr
    linked_parent_user_id: UUID


class ReadingLabGameItem(BaseModel):
    key: str
    title: str
    description: str
    supports_audio: bool
    interaction: str
    reward_points: int
    reward_xp: int


class ReadingLabGameListResponse(BaseModel):
    items: list[ReadingLabGameItem]


class ReadingLabRoundPublic(BaseModel):
    index: int
    prompt: str
    display_text: str | None = None
    instruction: str | None = None
    items: list[str]
    interaction: Literal["single_choice", "ordered_tiles"]
    audio_text: str | None = None


class StartReadingLabSessionRequest(BaseModel):
    game_key: str


class StartReadingLabSessionResponse(BaseModel):
    session_id: UUID
    game: ReadingLabGameItem
    content_source: Literal["ai", "fallback"]
    focus_letters: list[str]
    focus_words: list[str]
    focus_numbers: list[str]
    rounds: list[ReadingLabRoundPublic]


class SubmitReadingLabAnswerRequest(BaseModel):
    round_index: int = Field(ge=0)
    answer: str | list[str]


class SubmitReadingLabAnswerResponse(BaseModel):
    round_index: int
    is_correct: bool
    correct_answer: str | list[str]
    feedback: str
    answered_rounds: int
    total_rounds: int


class ReadingLabProgressionSnapshot(BaseModel):
    total_xp: int
    current_level: int
    next_level_xp: int
    leveled_up: bool
    new_badges: list[str]


class CompleteReadingLabSessionResponse(BaseModel):
    session_id: UUID
    game_key: str
    accuracy: int
    correct_rounds: int
    total_rounds: int
    points_awarded: int
    xp_awarded: int
    progression: ReadingLabProgressionSnapshot
