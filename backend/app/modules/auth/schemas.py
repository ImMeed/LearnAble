import re

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.core.roles import UserRole


# ── Registration / Login ──────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    role: UserRole

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        errors = []
        if not re.search(r"[A-Z]", v):
            errors.append("one uppercase letter")
        if not re.search(r"[0-9]", v):
            errors.append("one digit")
        if not re.search(r'[!@#$%^&*()\-_=+\[\]{};:\'",.<>/?\\|`~]', v):
            errors.append("one special character")
        if errors:
            raise ValueError(f"Password must contain at least: {', '.join(errors)}")
        return v


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: UserRole
    totp_required: bool = False  # True when 2FA is enabled — frontend must ask for OTP


# ── Two-Factor Authentication ─────────────────────────────────────────────────

class Enable2FAResponse(BaseModel):
    """Returned when a user starts 2FA setup — contains QR code to scan."""
    qr_code_base64: str   # PNG image encoded as base64 string
    secret: str           # Raw secret — shown once so user can enter manually


class Verify2FARequest(BaseModel):
    """User submits the 6-digit code from their authenticator app."""
    code: str = Field(min_length=6, max_length=6, pattern=r"^\d{6}$")


class Verify2FAResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: UserRole


class LoginWithOTPRequest(BaseModel):
    """Second step of login when 2FA is enabled."""
    email: EmailStr
    otp_code: str = Field(min_length=6, max_length=6, pattern=r"^\d{6}$")


# ── Lockout ───────────────────────────────────────────────────────────────────

class LockoutResponse(BaseModel):
    """Returned when an account is locked after too many failed attempts."""
    code: str = "ACCOUNT_LOCKED"
    message: str
    retry_after_seconds: int