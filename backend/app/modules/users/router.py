from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.core.i18n import get_request_locale
from app.core.roles import UserRole
from app.core.security import CurrentUser, get_current_user
from app.db.session import get_db_session
from app.modules.users.schemas import MeResponse, ProfileResponse, ProfileUpdateRequest
from app.modules.users.service import get_me, get_profile, update_profile

router = APIRouter(tags=["users"])


@router.get("/me", response_model=MeResponse)
def me(
    request: Request,
    current_user: CurrentUser = Depends(get_current_user),
    session: Session = Depends(get_db_session),
) -> MeResponse:
    return get_me(session, current_user, get_request_locale(request))


@router.get("/student/profile", response_model=ProfileResponse)
def get_student_profile(
    request: Request,
    current_user: CurrentUser = Depends(get_current_user),
    session: Session = Depends(get_db_session),
) -> ProfileResponse:
    return get_profile(session, current_user, UserRole.ROLE_STUDENT, get_request_locale(request))


@router.patch("/student/profile", response_model=ProfileResponse)
def patch_student_profile(
    payload: ProfileUpdateRequest,
    request: Request,
    current_user: CurrentUser = Depends(get_current_user),
    session: Session = Depends(get_db_session),
) -> ProfileResponse:
    return update_profile(session, current_user, UserRole.ROLE_STUDENT, payload, get_request_locale(request))


@router.get("/tutor/profile", response_model=ProfileResponse)
def get_tutor_profile(
    request: Request,
    current_user: CurrentUser = Depends(get_current_user),
    session: Session = Depends(get_db_session),
) -> ProfileResponse:
    return get_profile(session, current_user, UserRole.ROLE_TUTOR, get_request_locale(request))


@router.patch("/tutor/profile", response_model=ProfileResponse)
def patch_tutor_profile(
    payload: ProfileUpdateRequest,
    request: Request,
    current_user: CurrentUser = Depends(get_current_user),
    session: Session = Depends(get_db_session),
) -> ProfileResponse:
    return update_profile(session, current_user, UserRole.ROLE_TUTOR, payload, get_request_locale(request))


@router.get("/parent/profile", response_model=ProfileResponse)
def get_parent_profile(
    request: Request,
    current_user: CurrentUser = Depends(get_current_user),
    session: Session = Depends(get_db_session),
) -> ProfileResponse:
    return get_profile(session, current_user, UserRole.ROLE_PARENT, get_request_locale(request))


@router.patch("/parent/profile", response_model=ProfileResponse)
def patch_parent_profile(
    payload: ProfileUpdateRequest,
    request: Request,
    current_user: CurrentUser = Depends(get_current_user),
    session: Session = Depends(get_db_session),
) -> ProfileResponse:
    return update_profile(session, current_user, UserRole.ROLE_PARENT, payload, get_request_locale(request))


@router.get("/psychologist/profile", response_model=ProfileResponse)
def get_psychologist_profile(
    request: Request,
    current_user: CurrentUser = Depends(get_current_user),
    session: Session = Depends(get_db_session),
) -> ProfileResponse:
    return get_profile(session, current_user, UserRole.ROLE_PSYCHOLOGIST, get_request_locale(request))


@router.patch("/psychologist/profile", response_model=ProfileResponse)
def patch_psychologist_profile(
    payload: ProfileUpdateRequest,
    request: Request,
    current_user: CurrentUser = Depends(get_current_user),
    session: Session = Depends(get_db_session),
) -> ProfileResponse:
    return update_profile(session, current_user, UserRole.ROLE_PSYCHOLOGIST, payload, get_request_locale(request))
