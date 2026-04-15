from fastapi import status
from sqlalchemy.orm import Session

from app.core.i18n import localized_http_exception
from app.core.roles import UserRole
from app.core.security import create_access_token, hash_password, verify_password
from app.db.models.economy import PointsWallet
from app.modules.auth import repository
from app.modules.auth.schemas import AuthResponse, LoginRequest, RegisterRequest


ALLOWED_SELF_REGISTER_ROLES = {
    UserRole.ROLE_STUDENT,
    UserRole.ROLE_PARENT,
    UserRole.ROLE_TUTOR,
}


def register_user(session: Session, payload: RegisterRequest, locale: str) -> AuthResponse:
    if payload.role not in ALLOWED_SELF_REGISTER_ROLES:
        raise localized_http_exception(status.HTTP_403_FORBIDDEN, "FORBIDDEN", locale)
    if payload.role == UserRole.ROLE_STUDENT and payload.student_age_years is None:
        raise localized_http_exception(status.HTTP_422_UNPROCESSABLE_ENTITY, "STUDENT_AGE_REQUIRED", locale)
    if payload.role != UserRole.ROLE_STUDENT:
        payload.student_age_years = None

    existing_user = repository.get_user_by_email(session, payload.email)
    if existing_user:
        raise localized_http_exception(status.HTTP_409_CONFLICT, "EMAIL_EXISTS", locale)

    user = repository.create_user(
        session=session,
        email=payload.email,
        password_hash=hash_password(payload.password),
        role=payload.role,
        student_age_years=payload.student_age_years,
    )
    session.add(PointsWallet(user_id=user.id, balance_points=0))

    if payload.role == UserRole.ROLE_STUDENT:
        psychologist_id = repository.get_first_psychologist_id(session)
        if psychologist_id is not None:
            repository.create_student_psychologist_link(session, user.id, psychologist_id)

    session.commit()

    token = create_access_token(user.id, str(user.role), user.email)
    return AuthResponse(access_token=token, role=user.role)


def login_user(session: Session, payload: LoginRequest, locale: str) -> AuthResponse:
    user = repository.get_user_by_email(session, payload.email)
    if not user or not verify_password(payload.password, user.password_hash):
        raise localized_http_exception(status.HTTP_401_UNAUTHORIZED, "INVALID_CREDENTIALS", locale)

    token = create_access_token(user.id, str(user.role), user.email)
    return AuthResponse(access_token=token, role=user.role)
