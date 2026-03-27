from fastapi import status
from sqlalchemy.orm import Session

from app.core.i18n import localized_http_exception
from app.core.roles import UserRole
from app.core.security import CurrentUser
from app.modules.users import repository
from app.modules.users.schemas import MeResponse, ProfileResponse, ProfileUpdateRequest


def get_me(session: Session, current_user: CurrentUser, locale: str) -> MeResponse:
    user = repository.get_user_by_id(session, current_user.user_id)
    if not user:
        raise localized_http_exception(status.HTTP_404_NOT_FOUND, "USER_NOT_FOUND", locale)
    return MeResponse(id=str(user.id), email=user.email, role=user.role)


def get_profile(session: Session, current_user: CurrentUser, expected_role: UserRole, locale: str) -> ProfileResponse:
    if current_user.role != expected_role:
        raise localized_http_exception(status.HTTP_403_FORBIDDEN, "ROLE_MISMATCH", locale)

    user = repository.get_user_by_id(session, current_user.user_id)
    if not user:
        raise localized_http_exception(status.HTTP_404_NOT_FOUND, "USER_NOT_FOUND", locale)

    return ProfileResponse(id=str(user.id), email=user.email, role=user.role)


def update_profile(
    session: Session,
    current_user: CurrentUser,
    expected_role: UserRole,
    payload: ProfileUpdateRequest,
    locale: str,
) -> ProfileResponse:
    if current_user.role != expected_role:
        raise localized_http_exception(status.HTTP_403_FORBIDDEN, "ROLE_MISMATCH", locale)

    user = repository.get_user_by_id(session, current_user.user_id)
    if not user:
        raise localized_http_exception(status.HTTP_404_NOT_FOUND, "USER_NOT_FOUND", locale)

    existing_user = repository.get_user_by_email(session, payload.email)
    if existing_user and existing_user.id != user.id:
        raise localized_http_exception(status.HTTP_409_CONFLICT, "EMAIL_EXISTS", locale)

    user.email = payload.email.lower().strip()
    session.add(user)
    session.commit()
    session.refresh(user)
    return ProfileResponse(id=str(user.id), email=user.email, role=user.role)
