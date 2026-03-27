from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class TeacherDashboardResponse(BaseModel):
    assigned_requests: int
    pending_requests: int
    scheduled_sessions: int
    completed_sessions: int
    active_tutors_online: int


class PresenceUpdateRequest(BaseModel):
    is_online: bool


class TeacherPresenceItem(BaseModel):
    tutor_user_id: UUID
    updated_at: datetime


class TeacherPresenceListResponse(BaseModel):
    items: list[TeacherPresenceItem]


class AssistanceRequestCreate(BaseModel):
    lesson_id: UUID | None = None
    topic: str = Field(min_length=3, max_length=255)
    message: str = Field(min_length=5, max_length=1000)
    preferred_at: datetime | None = None


class AssistanceRequestItem(BaseModel):
    id: UUID
    student_user_id: UUID
    tutor_user_id: UUID | None
    lesson_id: UUID | None
    topic: str
    message: str
    preferred_at: datetime | None
    status: str
    scheduled_at: datetime | None
    meeting_url: str | None


class AssistanceRequestListResponse(BaseModel):
    items: list[AssistanceRequestItem]


class AssistanceScheduleRequest(BaseModel):
    scheduled_at: datetime
    meeting_url: str = Field(min_length=5, max_length=500)


class AssistanceActionResponse(BaseModel):
    id: UUID
    status: str


class FeedbackPromptItem(BaseModel):
    id: UUID
    source_type: str
    source_id: UUID
    prompt: str
    response_text: str | None
    is_answered: bool


class FeedbackPromptListResponse(BaseModel):
    items: list[FeedbackPromptItem]


class FeedbackPromptAnswerRequest(BaseModel):
    response_text: str = Field(min_length=2, max_length=1000)


class FeedbackPromptAnswerResponse(BaseModel):
    id: UUID
    is_answered: bool


class EmitFeedbackResponse(BaseModel):
    id: UUID
    source_type: str
    source_id: UUID
