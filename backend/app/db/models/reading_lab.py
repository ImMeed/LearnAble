import uuid
from datetime import datetime
from enum import StrEnum

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, String, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class ReadingSupportStatus(StrEnum):
    INACTIVE = "INACTIVE"
    ACTIVE = "ACTIVE"
    PAUSED = "PAUSED"


class ReadingLabSessionStatus(StrEnum):
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"


class ReadingSupportProfile(Base):
    __tablename__ = "reading_support_profiles"

    student_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    status: Mapped[ReadingSupportStatus] = mapped_column(
        Enum(ReadingSupportStatus, name="reading_support_status"),
        nullable=False,
        default=ReadingSupportStatus.INACTIVE,
        server_default=ReadingSupportStatus.INACTIVE.value,
    )
    notes: Mapped[str] = mapped_column(String(1000), nullable=False, default="", server_default="")
    focus_targets_json: Mapped[list[str]] = mapped_column("focus_targets", JSONB, nullable=False, default=list)
    updated_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    updated_by_role: Mapped[str | None] = mapped_column(String(40), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class ReadingLabSession(Base):
    __tablename__ = "reading_lab_sessions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    student_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    activity_key: Mapped[str] = mapped_column(String(80), nullable=False)
    activity_title_ar: Mapped[str] = mapped_column(String(255), nullable=False)
    activity_title_en: Mapped[str] = mapped_column(String(255), nullable=False)
    interaction_type: Mapped[str] = mapped_column(String(30), nullable=False)
    rounds_json: Mapped[list[dict]] = mapped_column("rounds", JSONB, nullable=False, default=list)
    answers_json: Mapped[list[dict]] = mapped_column("answers", JSONB, nullable=False, default=list)
    focus_targets_json: Mapped[list[str]] = mapped_column("focus_targets", JSONB, nullable=False, default=list)
    support_active_at_start: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    current_round_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    correct_answers: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    total_rounds: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    reward_points: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    reward_xp: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    status: Mapped[ReadingLabSessionStatus] = mapped_column(
        Enum(ReadingLabSessionStatus, name="reading_lab_session_status"),
        nullable=False,
        default=ReadingLabSessionStatus.IN_PROGRESS,
        server_default=ReadingLabSessionStatus.IN_PROGRESS.value,
    )
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
