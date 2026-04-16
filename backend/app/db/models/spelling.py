import uuid
from datetime import datetime
from enum import StrEnum

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Index, Integer, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class SpellingSessionStatus(StrEnum):
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"


class SpellingActivity(Base):
    __tablename__ = "spelling_activities"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    key: Mapped[str] = mapped_column(String(80), nullable=False, unique=True)
    title_ar: Mapped[str] = mapped_column(String(255), nullable=False)
    title_en: Mapped[str] = mapped_column(String(255), nullable=False)
    difficulty: Mapped[str] = mapped_column(String(20), nullable=False, default="MEDIUM", server_default="MEDIUM")
    word_text_ar: Mapped[str | None] = mapped_column(String(255), nullable=True)
    word_text_en: Mapped[str | None] = mapped_column(String(255), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class SpellingSession(Base):
    __tablename__ = "spelling_sessions"
    __table_args__ = (Index("ix_spelling_sessions_student_status", "student_user_id", "status"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    student_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    activity_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("spelling_activities.id", ondelete="CASCADE"), nullable=False
    )
    activity_key: Mapped[str] = mapped_column(String(80), nullable=False)
    activity_title_ar: Mapped[str] = mapped_column(String(255), nullable=False)
    activity_title_en: Mapped[str] = mapped_column(String(255), nullable=False)
    difficulty: Mapped[str] = mapped_column(String(20), nullable=False, default="MEDIUM", server_default="MEDIUM")
    locale: Mapped[str] = mapped_column(String(5), nullable=False, default="ar", server_default="ar")
    target_word: Mapped[str] = mapped_column(String(255), nullable=False)
    normalized_target: Mapped[str] = mapped_column(String(255), nullable=False)
    typed_answer: Mapped[str] = mapped_column(String(255), nullable=False, default="", server_default="")
    normalized_answer: Mapped[str] = mapped_column(String(255), nullable=False, default="", server_default="")
    solved: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    near_match_used: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    hint_used: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    replay_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    typed_playback_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    attempt_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    mistakes_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    reward_points: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    reward_xp: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    duration_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    status: Mapped[SpellingSessionStatus] = mapped_column(
        Enum(SpellingSessionStatus, name="spelling_session_status"),
        nullable=False,
        default=SpellingSessionStatus.IN_PROGRESS,
        server_default=SpellingSessionStatus.IN_PROGRESS.value,
    )
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
