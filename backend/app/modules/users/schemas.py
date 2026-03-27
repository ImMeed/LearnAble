from pydantic import BaseModel, EmailStr

from app.core.roles import UserRole


class MeResponse(BaseModel):
    id: str
    email: EmailStr
    role: UserRole


class ProfileResponse(BaseModel):
    id: str
    email: EmailStr
    role: UserRole


class ProfileUpdateRequest(BaseModel):
    email: EmailStr
