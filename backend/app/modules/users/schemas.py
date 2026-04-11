from pydantic import BaseModel, EmailStr

from app.core.roles import UserRole


class MeResponse(BaseModel):
    id: str
    email: EmailStr
    role: UserRole
    display_name: str | None = None


class ProfileResponse(BaseModel):
    id: str
    email: EmailStr
    role: UserRole
    display_name: str | None = None


class ProfileUpdateRequest(BaseModel):
    email: EmailStr
    display_name: str | None = None
