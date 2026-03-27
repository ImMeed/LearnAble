import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class StudentScreening(Base):
    __tablename__ = "student_screenings"
    __table_args__ = (UniqueConstraint("user_id", name="uq_student_screening_user"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    focus_score: Mapped[int] = mapped_column(Integer, nullable=False)
    reading_score: Mapped[int] = mapped_column(Integer, nullable=False)
    memory_score: Mapped[int] = mapped_column(Integer, nullable=False)
    support_level: Mapped[str] = mapped_column(String(30), nullable=False)
    indicators_json: Mapped[dict] = mapped_column("indicators", JSONB, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class Lesson(Base):
    __tablename__ = "lessons"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title_ar: Mapped[str] = mapped_column(String(255), nullable=False)
    title_en: Mapped[str] = mapped_column(String(255), nullable=False)
    body_ar: Mapped[str] = mapped_column(String(4000), nullable=False)
    body_en: Mapped[str] = mapped_column(String(4000), nullable=False)
    difficulty: Mapped[str] = mapped_column(String(30), nullable=False, default="BEGINNER")
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class LessonFlashcard(Base):
    __tablename__ = "lesson_flashcards"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    lesson_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("lessons.id", ondelete="CASCADE"), nullable=False)
    front_ar: Mapped[str] = mapped_column(String(255), nullable=False)
    front_en: Mapped[str] = mapped_column(String(255), nullable=False)
    back_ar: Mapped[str] = mapped_column(String(500), nullable=False)
    back_en: Mapped[str] = mapped_column(String(500), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class LessonReadingGame(Base):
    __tablename__ = "lesson_reading_games"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    lesson_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("lessons.id", ondelete="CASCADE"), nullable=False)
    name_ar: Mapped[str] = mapped_column(String(255), nullable=False)
    name_en: Mapped[str] = mapped_column(String(255), nullable=False)
    objective_ar: Mapped[str] = mapped_column(String(500), nullable=False)
    objective_en: Mapped[str] = mapped_column(String(500), nullable=False)
    words_json: Mapped[list[str]] = mapped_column("words", JSONB, nullable=False, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
