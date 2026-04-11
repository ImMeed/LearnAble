import re
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.core.platform_tracks import PlatformTrack
from app.core.roles import UserRole


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    role: UserRole
    platform_track: PlatformTrack = PlatformTrack.PLUS_TEN
    display_name: str = Field(default="", max_length=120)
    student_id: UUID | None = None

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

    @field_validator("display_name")
    @classmethod
    def normalize_display_name(cls, value: str) -> str:
        return value.strip()


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    platform_track: PlatformTrack = PlatformTrack.PLUS_TEN


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: UserRole
    platform_track: PlatformTrack = PlatformTrack.PLUS_TEN
    user_id: UUID | None = None
    display_name: str | None = None
    totp_required: bool = False


class Enable2FAResponse(BaseModel):
    qr_code_base64: str
    secret: str


class Verify2FARequest(BaseModel):
    code: str = Field(min_length=6, max_length=6, pattern=r"^\d{6}$")


class Verify2FAResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: UserRole
    platform_track: PlatformTrack = PlatformTrack.PLUS_TEN
    user_id: UUID | None = None
    display_name: str | None = None


class LoginWithOTPRequest(BaseModel):
    email: EmailStr
    otp_code: str = Field(min_length=6, max_length=6, pattern=r"^\d{6}$")
    platform_track: PlatformTrack = PlatformTrack.PLUS_TEN


class LockoutResponse(BaseModel):
    code: str = "ACCOUNT_LOCKED"
    message: str
    retry_after_seconds: int
