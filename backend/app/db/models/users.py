import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.platform_tracks import PlatformTrack
from app.core.roles import UserRole
from app.db.base import Base


class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        UniqueConstraint("email", "platform_track", name="uq_users_email_platform_track"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    display_name: Mapped[str] = mapped_column(String(120), nullable=True, default=None)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(Enum(UserRole, name="user_role"), nullable=False)
    platform_track: Mapped[PlatformTrack] = mapped_column(
        Enum(PlatformTrack, name="platform_track"),
        nullable=False,
        default=PlatformTrack.PLUS_TEN,
        server_default=PlatformTrack.PLUS_TEN.value,
    )

    # ── Security fields (added in migration 0006) ─────────────────────────────
    totp_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    locked_until: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True, default=None)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
