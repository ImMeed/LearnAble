import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class DyslexiaSupportProfile(Base):
    __tablename__ = "dyslexia_support_profiles"
    __table_args__ = (UniqueConstraint("student_user_id", name="uq_dyslexia_support_student"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    student_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    declared_by_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    declared_by_role: Mapped[str] = mapped_column(String(30), nullable=False)
    notes: Mapped[str] = mapped_column(String(1000), nullable=False, default="", server_default="")
    focus_letters_json: Mapped[list[str]] = mapped_column("focus_letters", JSONB, nullable=False, default=list)
    focus_words_json: Mapped[list[str]] = mapped_column("focus_words", JSONB, nullable=False, default=list)
    focus_numbers_json: Mapped[list[str]] = mapped_column("focus_numbers", JSONB, nullable=False, default=list)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")
    activated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class ReadingLabSession(Base):
    __tablename__ = "reading_lab_sessions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    student_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    game_key: Mapped[str] = mapped_column(String(50), nullable=False)
    content_source: Mapped[str] = mapped_column(String(20), nullable=False, default="fallback", server_default="fallback")
    locale: Mapped[str] = mapped_column(String(5), nullable=False, default="ar", server_default="ar")
    round_payload_json: Mapped[list[dict]] = mapped_column("round_payload", JSONB, nullable=False, default=list)
    answers_json: Mapped[list[dict]] = mapped_column("answers", JSONB, nullable=False, default=list)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="IN_PROGRESS", server_default="IN_PROGRESS")
    total_rounds: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    correct_rounds: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    points_awarded: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    xp_awarded: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    completed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True, default=None)
