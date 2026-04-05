from fastapi import Request, status
from sqlalchemy.orm import Session

from app.core.i18n import localized_http_exception
from app.core.security import create_access_token, hash_password, verify_password
from app.db.models.economy import PointsWallet
from app.db.models.security_models import RoleChangeLog
from app.db.models.users import User
from app.modules.auth import repository
from app.modules.auth import lockout as lockout_service
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


# ── Registration ──────────────────────────────────────────────────────────────

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


# ── Login (step 1 — password) ─────────────────────────────────────────────────

def login_user(session: Session, payload: LoginRequest, locale: str, request: Request | None = None) -> AuthResponse:
    ip = request.client.host if request and request.client else None

    user = repository.get_user_by_email(session, payload.email)

    # Unknown email — don't reveal whether the user exists
    if not user:
        raise localized_http_exception(status.HTTP_401_UNAUTHORIZED, "INVALID_CREDENTIALS", locale)

    # Check lockout BEFORE verifying password (avoids timing leak)
    if lockout_service.is_account_locked(session, user):
        from fastapi import HTTPException
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

    # Password correct
    lockout_service.record_attempt(session, user.id, success=True, ip_address=ip)
    lockout_service.clear_failed_attempts(session, user)

    # If 2FA is enabled, tell the frontend — don't issue a full token yet
    if user.totp_enabled:
        return AuthResponse(
            access_token="",
            role=user.role,
            totp_required=True,
        )

    token = create_access_token(user.id, str(user.role), user.email)
    return AuthResponse(access_token=token, role=user.role)


# ── Login (step 2 — OTP verification) ────────────────────────────────────────

def login_with_otp(session: Session, payload: LoginWithOTPRequest, locale: str) -> Verify2FAResponse:
    user = repository.get_user_by_email(session, payload.email)
    if not user or not user.totp_enabled:
        raise localized_http_exception(status.HTTP_401_UNAUTHORIZED, "INVALID_CREDENTIALS", locale)

    secret_row = totp_service.get_totp_secret(session, user.id)
    if not secret_row:
        raise localized_http_exception(status.HTTP_401_UNAUTHORIZED, "INVALID_CREDENTIALS", locale)

    if not totp_service.verify_totp_code(secret_row.secret, payload.otp_code):
        raise localized_http_exception(status.HTTP_401_UNAUTHORIZED, "INVALID_OTP", locale)

    token = create_access_token(user.id, str(user.role), user.email)
    return Verify2FAResponse(access_token=token, role=user.role)


# ── 2FA setup ─────────────────────────────────────────────────────────────────

def enable_2fa(session: Session, user_id, email: str) -> Enable2FAResponse:
    """Generate a TOTP secret and return a QR code. 2FA is NOT enabled yet — user must verify first."""
    secret = totp_service.generate_totp_secret()
    totp_service.save_totp_secret(session, user_id, secret)

    uri = totp_service.get_provisioning_uri(secret, email)
    qr = totp_service.get_qr_base64(uri)

    return Enable2FAResponse(qr_code_base64=qr, secret=secret)


def confirm_2fa(session: Session, user_id, payload: Verify2FARequest, locale: str) -> dict:
    """Verify the first OTP code to confirm the user scanned the QR correctly, then activate 2FA."""
    secret_row = totp_service.get_totp_secret(session, user_id)
    if not secret_row:
        raise localized_http_exception(status.HTTP_400_BAD_REQUEST, "TOTP_NOT_INITIALIZED", locale)

    if not totp_service.verify_totp_code(secret_row.secret, payload.code):
        raise localized_http_exception(status.HTTP_401_UNAUTHORIZED, "INVALID_OTP", locale)

    user = session.get(User, user_id)
    user.totp_enabled = True
    session.commit()

    return {"message": "2FA enabled successfully."}


def disable_2fa(session: Session, user_id, payload: Verify2FARequest, locale: str) -> dict:
    """Disable 2FA after the user proves they still have the authenticator."""
    secret_row = totp_service.get_totp_secret(session, user_id)
    if not secret_row:
        raise localized_http_exception(status.HTTP_400_BAD_REQUEST, "TOTP_NOT_INITIALIZED", locale)

    if not totp_service.verify_totp_code(secret_row.secret, payload.code):
        raise localized_http_exception(status.HTTP_401_UNAUTHORIZED, "INVALID_OTP", locale)

    session.delete(secret_row)
    user = session.get(User, user_id)
    user.totp_enabled = False
    session.commit()

    return {"message": "2FA disabled successfully."}


# ── Role change (admin only) ───────────────────────────────────────────────────

def change_user_role(
    session: Session,
    requester_id,
    requester_role: str,
    target_user_id,
    new_role: str,
    locale: str,
) -> dict:
    from app.core.roles import UserRole

    if requester_role != UserRole.ROLE_ADMIN.value:
        raise localized_http_exception(status.HTTP_403_FORBIDDEN, "FORBIDDEN", locale)

    user = session.get(User, target_user_id)
    if not user:
        raise localized_http_exception(status.HTTP_404_NOT_FOUND, "USER_NOT_FOUND", locale)

    old_role = str(user.role)
    user.role = UserRole(new_role)

    session.add(RoleChangeLog(
        changed_by=requester_id,
        target_user_id=target_user_id,
        old_role=old_role,
        new_role=new_role,
    ))
    session.commit()

    return {"message": f"Role updated from {old_role} to {new_role}."}