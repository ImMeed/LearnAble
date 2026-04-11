from typing import Annotated

from fastapi import APIRouter, Depends, Request, status ,Body
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.core.i18n import get_request_locale
from app.core.security import CurrentUser, get_current_user
from app.db.session import get_db_session
from app.modules.auth import service
from app.modules.auth.schemas import (
    AuthResponse,
    Enable2FAResponse,
    LoginRequest,
    LoginWithOTPRequest,
    RegisterRequest,
    Verify2FARequest,
    Verify2FAResponse,
)

router = APIRouter(prefix="/auth", tags=["auth"])

SessionDep = Annotated[Session, Depends(get_db_session)]
CurrentUserDep = Annotated[CurrentUser, Depends(get_current_user)]


# ── Public endpoints ──────────────────────────────────────────────────────────

@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, session: SessionDep, request: Request):
    locale = get_request_locale(request)
    return service.register_user(session, payload, locale)


@router.post("/login", response_model=AuthResponse)
def login(payload: LoginRequest, session: SessionDep, request: Request):
    """
    Step 1 of login. If totp_required=True in the response,
    the frontend must call /auth/login/otp next.
    """
    locale = get_request_locale(request)
    return service.login_user(session, payload, locale, request)


@router.post("/token", response_model=AuthResponse)
def login_swagger(
    session: SessionDep,
    form_data: OAuth2PasswordRequestForm = Depends(),
):
    """Token endpoint for Swagger UI (supports Form Data)."""
    payload = LoginRequest(
        email=form_data.username,
        password=form_data.password
    )
    return service.login_user(session, payload, "en")


@router.post("/login/otp", response_model=Verify2FAResponse)
def login_otp(payload: LoginWithOTPRequest, session: SessionDep, request: Request):
    """Step 2 of login when 2FA is enabled — submit the 6-digit OTP."""
    locale = get_request_locale(request)
    return service.login_with_otp(session, payload, locale)


# ── Authenticated endpoints (require valid JWT) ───────────────────────────────

@router.post("/2fa/enable", response_model=Enable2FAResponse)
def enable_2fa(session: SessionDep, current_user: CurrentUserDep):
    """
    Start 2FA setup. Returns a QR code image (base64 PNG) and the raw secret.
    The user must scan the QR code in their authenticator app,
    then call /2fa/confirm with their first OTP code.
    """
    return service.enable_2fa(session, current_user.user_id, current_user.email)


@router.post("/2fa/confirm", status_code=status.HTTP_200_OK)
def confirm_2fa(payload: Verify2FARequest, session: SessionDep, current_user: CurrentUserDep, request: Request):
    """Confirm the first OTP code to activate 2FA on the account."""
    locale = get_request_locale(request)
    return service.confirm_2fa(session, current_user.user_id, payload, locale)


@router.post("/2fa/disable", status_code=status.HTTP_200_OK)
def disable_2fa(payload: Verify2FARequest, session: SessionDep, current_user: CurrentUserDep, request: Request):
    """Disable 2FA. Requires a valid OTP code as confirmation."""
    locale = get_request_locale(request)
    return service.disable_2fa(session, current_user.user_id, payload, locale)


# ── Admin: role management ────────────────────────────────────────────────────

@router.patch("/users/{target_user_id}/role", status_code=status.HTTP_200_OK)
def change_role(
    target_user_id: str,
    new_role: str,
    session: SessionDep,
    current_user: CurrentUserDep,
    request: Request,
):
    """Change a user's role. Admin only. Change is logged in role_change_log."""
    locale = get_request_locale(request)
    return service.change_user_role(
        session=session,
        requester_id=current_user.user_id,
        requester_role=current_user.role,
        target_user_id=target_user_id,
        new_role=new_role,
        locale=locale,
    )
