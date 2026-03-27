from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.core.i18n import get_request_locale
from app.db.session import get_db_session
from app.modules.auth.schemas import AuthResponse, LoginRequest, RegisterRequest
from app.modules.auth.service import login_user, register_user

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=AuthResponse)
def register(
    payload: RegisterRequest,
    request: Request,
    session: Session = Depends(get_db_session),
) -> AuthResponse:
    return register_user(session, payload, get_request_locale(request))


@router.post("/login", response_model=AuthResponse)
def login(
    payload: LoginRequest,
    request: Request,
    session: Session = Depends(get_db_session),
) -> AuthResponse:
    return login_user(session, payload, get_request_locale(request))
