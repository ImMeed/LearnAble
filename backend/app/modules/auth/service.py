from fastapi import HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.i18n import localized_http_exception
from app.core.roles import UserRole
from app.core.security import create_access_token, hash_password, verify_password
from app.db.models.economy import PointsWallet
from app.db.models.security_models import RoleChangeLog
from app.db.models.users import User
from app.modules.auth import lockout as lockout_service
from app.modules.auth import repository
from app.modules.auth import totp as totp_service
from app.modules.auth.schemas import (
    AuthResponse,
    Enable2FAResponse,
    LoginRequest,
    LoginWithOTPRequest,
    RegisterRequest,
    Verify2FARequest,
    Verify2FAResponse,
)


ALLOWED_SELF_REGISTER_ROLES = {
    UserRole.ROLE_STUDENT,
    UserRole.ROLE_PARENT,
    UserRole.ROLE_TUTOR,
    UserRole.ROLE_PSYCHOLOGIST,
}


def _normalized_display_name(value: str | None) -> str | None:
    if value is None:
        return None
    cleaned = value.strip()
    return cleaned or None


def _assert_linkable_student(session: Session, student_id, platform_track, locale: str) -> User:
    student = repository.get_user_by_id(session, student_id, platform_track)
    if student is None or student.role != UserRole.ROLE_STUDENT:
        raise localized_http_exception(status.HTTP_404_NOT_FOUND, "USER_NOT_FOUND", locale)
    return student


def _link_registered_observer_to_student(session: Session, payload: RegisterRequest, user: User, locale: str) -> None:
    if payload.student_id is None:
        return

    if payload.role not in {UserRole.ROLE_PARENT, UserRole.ROLE_PSYCHOLOGIST}:
        raise localized_http_exception(status.HTTP_422_UNPROCESSABLE_ENTITY, "FORBIDDEN", locale)

    student = _assert_linkable_student(session, payload.student_id, payload.platform_track, locale)
    if student.id == user.id:
        raise localized_http_exception(status.HTTP_422_UNPROCESSABLE_ENTITY, "FORBIDDEN", locale)

    if payload.role == UserRole.ROLE_PARENT:
        repository.create_student_parent_link(session, student.id, user.id)
    else:
        repository.create_student_psychologist_link(session, student.id, user.id)


def register_user(session: Session, payload: RegisterRequest, locale: str) -> AuthResponse:
    if payload.role not in ALLOWED_SELF_REGISTER_ROLES:
        raise localized_http_exception(status.HTTP_403_FORBIDDEN, "FORBIDDEN", locale)

    existing_user = repository.get_user_by_email(session, payload.email, payload.platform_track)
    if existing_user:
        raise localized_http_exception(status.HTTP_409_CONFLICT, "EMAIL_EXISTS", locale)

    user = repository.create_user(
        session=session,
        email=payload.email,
        password_hash=hash_password(payload.password),
        role=payload.role,
        platform_track=payload.platform_track,
        display_name=_normalized_display_name(payload.display_name),
    )
    session.add(PointsWallet(user_id=user.id, balance_points=0))

    if payload.role == UserRole.ROLE_STUDENT:
        psychologist_id = repository.get_first_psychologist_id(session, payload.platform_track)
        if psychologist_id is not None:
            repository.create_student_psychologist_link(session, user.id, psychologist_id)
    else:
        _link_registered_observer_to_student(session, payload, user, locale)

    session.commit()

    token = create_access_token(user.id, str(user.role), user.email, str(user.platform_track))
    return AuthResponse(
        access_token=token,
        role=user.role,
        platform_track=user.platform_track,
        user_id=user.id,
        display_name=user.display_name,
    )


def login_user(session: Session, payload: LoginRequest, locale: str, request: Request | None = None) -> AuthResponse:
    ip = request.client.host if request and request.client else None
    user = repository.get_user_by_email(session, payload.email, payload.platform_track)

    if not user:
        raise localized_http_exception(status.HTTP_401_UNAUTHORIZED, "INVALID_CREDENTIALS", locale)

    if lockout_service.is_account_locked(session, user):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={
                "code": "ACCOUNT_LOCKED",
                "message": "Too many failed attempts. Try again later.",
                "retry_after_seconds": lockout_service.seconds_until_unlock(user),
            },
        )

    if not verify_password(payload.password, user.password_hash):
        lockout_service.record_attempt(session, user.id, success=False, ip_address=ip)
        raise localized_http_exception(status.HTTP_401_UNAUTHORIZED, "INVALID_CREDENTIALS", locale)

    lockout_service.record_attempt(session, user.id, success=True, ip_address=ip)
    lockout_service.clear_failed_attempts(session, user)

    if user.totp_enabled:
        return AuthResponse(
            access_token="",
            role=user.role,
            platform_track=user.platform_track,
            user_id=user.id,
            display_name=user.display_name,
            totp_required=True,
        )

    token = create_access_token(user.id, str(user.role), user.email, str(user.platform_track))
    return AuthResponse(
        access_token=token,
        role=user.role,
        platform_track=user.platform_track,
        user_id=user.id,
        display_name=user.display_name,
    )


def login_with_otp(session: Session, payload: LoginWithOTPRequest, locale: str) -> Verify2FAResponse:
    user = repository.get_user_by_email(session, payload.email, payload.platform_track)
    if not user or not user.totp_enabled:
        raise localized_http_exception(status.HTTP_401_UNAUTHORIZED, "INVALID_CREDENTIALS", locale)

    secret_row = totp_service.get_totp_secret(session, user.id)
    if not secret_row:
        raise localized_http_exception(status.HTTP_401_UNAUTHORIZED, "INVALID_CREDENTIALS", locale)

    if totp_service.is_totp_code_used(session, user.id, payload.otp_code):
        raise localized_http_exception(status.HTTP_401_UNAUTHORIZED, "INVALID_OTP", locale)

    if not totp_service.verify_totp_code(secret_row.secret, payload.otp_code):
        raise localized_http_exception(status.HTTP_401_UNAUTHORIZED, "INVALID_OTP", locale)

    totp_service.consume_totp_code(session, user.id, payload.otp_code)
    token = create_access_token(user.id, str(user.role), user.email, str(user.platform_track))
    return Verify2FAResponse(
        access_token=token,
        role=user.role,
        platform_track=user.platform_track,
        user_id=user.id,
        display_name=user.display_name,
    )


def enable_2fa(session: Session, user_id, email: str) -> Enable2FAResponse:
    secret = totp_service.generate_totp_secret()
    totp_service.save_totp_secret(session, user_id, secret)

    uri = totp_service.get_provisioning_uri(secret, email)
    qr = totp_service.get_qr_base64(uri)

    return Enable2FAResponse(qr_code_base64=qr, secret=secret)


def confirm_2fa(session: Session, user_id, payload: Verify2FARequest, locale: str) -> dict:
    secret_row = totp_service.get_totp_secret(session, user_id)
    if not secret_row:
        raise localized_http_exception(status.HTTP_400_BAD_REQUEST, "TOTP_NOT_INITIALIZED", locale)

    if totp_service.is_totp_code_used(session, user_id, payload.code):
        raise localized_http_exception(status.HTTP_401_UNAUTHORIZED, "INVALID_OTP", locale)

    if not totp_service.verify_totp_code(secret_row.secret, payload.code):
        raise localized_http_exception(status.HTTP_401_UNAUTHORIZED, "INVALID_OTP", locale)

    totp_service.consume_totp_code(session, user_id, payload.code)
    user = session.get(User, user_id)
    user.totp_enabled = True
    session.commit()

    return {"message": "2FA enabled successfully."}


def disable_2fa(session: Session, user_id, payload: Verify2FARequest, locale: str) -> dict:
    secret_row = totp_service.get_totp_secret(session, user_id)
    if not secret_row:
        raise localized_http_exception(status.HTTP_400_BAD_REQUEST, "TOTP_NOT_INITIALIZED", locale)

    if totp_service.is_totp_code_used(session, user_id, payload.code):
        raise localized_http_exception(status.HTTP_401_UNAUTHORIZED, "INVALID_OTP", locale)

    if not totp_service.verify_totp_code(secret_row.secret, payload.code):
        raise localized_http_exception(status.HTTP_401_UNAUTHORIZED, "INVALID_OTP", locale)

    totp_service.consume_totp_code(session, user_id, payload.code)
    session.delete(secret_row)
    user = session.get(User, user_id)
    user.totp_enabled = False
    session.commit()

    return {"message": "2FA disabled successfully."}


def change_user_role(
    session: Session,
    requester_id,
    requester_role: str,
    target_user_id,
    new_role: str,
    locale: str,
) -> dict:
    if requester_role != UserRole.ROLE_ADMIN.value:
        raise localized_http_exception(status.HTTP_403_FORBIDDEN, "FORBIDDEN", locale)

    user = session.get(User, target_user_id)
    if not user:
        raise localized_http_exception(status.HTTP_404_NOT_FOUND, "USER_NOT_FOUND", locale)

    old_role = str(user.role)
    user.role = UserRole(new_role)

    session.add(
        RoleChangeLog(
            changed_by=requester_id,
            target_user_id=target_user_id,
            old_role=old_role,
            new_role=new_role,
        )
    )
    session.commit()

    return {"message": f"Role updated from {old_role} to {new_role}."}
