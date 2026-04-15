from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field, model_validator


class ReadingLabActivityItem(BaseModel):
    key: str
    title: str
    description: str
    interaction_type: str
    estimated_minutes: int


class ReadingLabNoteItem(BaseModel):
    source: str
    label: str
    note: str


class ReadingLabProgressMetrics(BaseModel):
    completed_sessions: int
    total_rounds_completed: int
    average_accuracy: int
    last_completed_at: datetime | None = None


class ReadingLabSummaryResponse(BaseModel):
    student_user_id: UUID
    student_link_id: str | None = None
    student_age_years: int | None = None
    support_status: str
    support_active: bool
    prominence: Literal["HIGHLY_PROMINENT", "PROMINENT", "FEATURED", "OPTIONAL"]
    focus_targets: list[str] = []
    notes: list[ReadingLabNoteItem] = []
    progress: ReadingLabProgressMetrics
    activities: list[ReadingLabActivityItem] = []


class LinkedStudentItem(BaseModel):
    student_user_id: UUID
    student_label: str
    student_age_years: int | None = None
    support_status: str
    support_active: bool
    prominence: Literal["HIGHLY_PROMINENT", "PROMINENT", "FEATURED", "OPTIONAL"]
    focus_targets: list[str] = []
    progress: ReadingLabProgressMetrics


class LinkedStudentListResponse(BaseModel):
    items: list[LinkedStudentItem] = []


class LinkStudentRequest(BaseModel):
    student_link_id: str = Field(min_length=6, max_length=24, pattern=r"^[A-Za-z0-9-]+$")


class LinkStudentResponse(BaseModel):
    student_user_id: UUID
    student_label: str
    linked_by_role: str


class StudentLinkIdResponse(BaseModel):
    student_user_id: UUID
    student_link_id: str


class ReadingSupportPlanResponse(BaseModel):
    student_user_id: UUID
    status: str
    notes: str
    focus_targets: list[str] = []
    updated_at: datetime | None = None
    updated_by_role: str | None = None


class ReadingSupportPlanUpdateRequest(BaseModel):
    status: Literal["INACTIVE", "ACTIVE", "PAUSED"]
    notes: str = Field(default="", max_length=1000)
    focus_targets: list[str] = Field(default_factory=list, max_length=12)


class ReadingLabOptionItem(BaseModel):
    key: str
    text: str


class ReadingLabRoundItem(BaseModel):
    index: int
    prompt: str
    instructions: str
    interaction_type: str
    options: list[ReadingLabOptionItem] | None = None
    tiles: list[str] | None = None
    reference_text: str | None = None
    audio_text: str | None = None


class ReadingLabAnswerItem(BaseModel):
    round_index: int
    is_correct: bool
    selected_option_key: str | None = None
    ordered_tiles: list[str] | None = None
    submitted_at: datetime


class ReadingLabSessionResponse(BaseModel):
    session_id: UUID
    activity_key: str
    activity_title: str
    interaction_type: str
    support_active_at_start: bool
    focus_targets: list[str] = []
    status: str
    current_round_index: int
    total_rounds: int
    completed_all_rounds: bool
    rounds: list[ReadingLabRoundItem] = []
    answers: list[ReadingLabAnswerItem] = []
    started_at: datetime
    completed_at: datetime | None = None


class StartReadingLabSessionRequest(BaseModel):
    activity_key: str = Field(min_length=3, max_length=80)


class ReadingLabAnswerRequest(BaseModel):
    round_index: int = Field(ge=0)
    selected_option_key: str | None = Field(default=None, min_length=1, max_length=40)
    ordered_tiles: list[str] | None = None

    @model_validator(mode="after")
    def validate_payload(self) -> "ReadingLabAnswerRequest":
        has_single = bool(self.selected_option_key)
        has_ordered = bool(self.ordered_tiles)
        if has_single == has_ordered:
            raise ValueError("Provide either selected_option_key or ordered_tiles.")
        return self


class ReadingLabAnswerResponse(BaseModel):
    session_id: UUID
    round_index: int
    is_correct: bool
    feedback: str
    next_round_index: int
    completed_all_rounds: bool
    answer: ReadingLabAnswerItem


class ReadingLabCompletionResponse(BaseModel):
    session_id: UUID
    correct_answers: int
    total_rounds: int
    accuracy: int
    earned_points: int
    earned_xp: int
    wallet_balance: int
    completed_at: datetime
