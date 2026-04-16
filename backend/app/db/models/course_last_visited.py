from datetime import datetime
import uuid
from sqlalchemy import DateTime, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base


class CourseLastVisited(Base):
    __tablename__ = "course_last_visited"

    student_user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    course_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    section_id: Mapped[str] = mapped_column(String(50), nullable=False)
    visited_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
