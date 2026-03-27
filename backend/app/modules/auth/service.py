from fastapi import status
from sqlalchemy.orm import Session

from app.core.i18n import localized_http_exception
from app.core.security import create_access_token, hash_password, verify_password
from app.db.models.economy import PointsWallet
from app.modules.auth import repository
from app.modules.auth.schemas import AuthResponse, LoginRequest, RegisterRequest


def register_user(session: Session, payload: RegisterRequest, locale: str) -> AuthResponse:
    existing_user = repository.get_user_by_email(session, payload.email)
    if existing_user:
        raise localized_http_exception(status.HTTP_409_CONFLICT, "EMAIL_EXISTS", locale)

    user = repository.create_user(
        session=session,
        email=payload.email,
        password_hash=hash_password(payload.password),
        role=payload.role,
    )
    session.add(PointsWallet(user_id=user.id, balance_points=0))
    session.commit()

    token = create_access_token(user.id, str(user.role), user.email)
    return AuthResponse(access_token=token, role=user.role)


def login_user(session: Session, payload: LoginRequest, locale: str) -> AuthResponse:
    user = repository.get_user_by_email(session, payload.email)
    if not user or not verify_password(payload.password, user.password_hash):
        raise localized_http_exception(status.HTTP_401_UNAUTHORIZED, "INVALID_CREDENTIALS", locale)

    token = create_access_token(user.id, str(user.role), user.email)
    return AuthResponse(access_token=token, role=user.role)
