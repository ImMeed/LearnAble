import hashlib
from datetime import datetime, timedelta, timezone
from typing import Annotated
from uuid import UUID

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel

from app.core.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/token")


class CurrentUser(BaseModel):
    user_id: UUID
    role: str
    email: str


def hash_password(password: str) -> str:
    password = hashlib.sha256(password.encode("utf-8")).hexdigest()
    return pwd_context.hash(password)


def verify_password(password: str, hashed_password: str) -> bool:
    password = hashlib.sha256(password.encode("utf-8")).hexdigest()
    return pwd_context.verify(password, hashed_password)


def create_access_token(user_id: UUID, role: str, email: str) -> str:
    now = datetime.now(timezone.utc)
    expire = now + timedelta(minutes=settings.jwt_expire_minutes)
    payload = {
        "sub": str(user_id),
        "role": role,
        "email": email,
        "iat": int(now.timestamp()),
        "exp": int(expire.timestamp()),
    }
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


async def get_current_user(token: Annotated[str, Depends(oauth2_scheme)]) -> CurrentUser:
    unauthorized = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail={"code": "UNAUTHORIZED", "message": "Invalid or expired token."},
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
        user_id = payload.get("sub")
        role = payload.get("role")
        email = payload.get("email")
    except JWTError as exc:
        raise unauthorized from exc

    if not user_id or not role or not email:
        raise unauthorized

    return CurrentUser(user_id=UUID(user_id), role=role, email=email)
