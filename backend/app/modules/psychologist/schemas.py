from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class TeacherQuestionnaireCreateRequest(BaseModel):
    attention_score: int = Field(ge=0, le=100)
    engagement_score: int = Field(ge=0, le=100)
    notes: str = Field(min_length=3, max_length=1000)
    cadence_days: int = Field(default=14, ge=7, le=30)


class TeacherQuestionnaireResponse(BaseModel):
    id: UUID
    student_user_id: UUID
    tutor_user_id: UUID
    attention_score: int
    engagement_score: int
    notes: str
    cadence_days: int
    submitted_at: datetime


class PsychologistReviewResponse(BaseModel):
    student_user_id: UUID
    student_label: str
    screening_composite_score: int | None
    screening_summary: dict | None
    latest_questionnaire: dict | None
    support_confirmation: dict | None


class PsychologistReviewListResponse(BaseModel):
    items: list[PsychologistReviewResponse] = []
    total: int = 0
    limit: int = 20
    offset: int = 0
    query: str | None = None


class SupportConfirmRequest(BaseModel):
    support_level: str = Field(min_length=2, max_length=30)
    notes: str = Field(min_length=3, max_length=1000)


class SupportConfirmResponse(BaseModel):
    id: UUID
    student_user_id: UUID
    psychologist_user_id: UUID
    support_level: str
    confirmed_at: datetime
    parent_notifications_sent: int
