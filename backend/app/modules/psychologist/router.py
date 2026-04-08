from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session

from app.core.i18n import get_request_locale
from app.core.roles import UserRole, require_roles
from app.core.security import CurrentUser
from app.db.session import get_db_session
from app.modules.psychologist.schemas import (
    PsychologistReviewListResponse,
    PsychologistReviewResponse,
    SupportConfirmRequest,
    SupportConfirmResponse,
    TeacherQuestionnaireCreateRequest,
    TeacherQuestionnaireResponse,
)
from app.modules.psychologist.service import (
    confirm_student_support,
    list_linked_student_reviews,
    review_student_profile,
    submit_teacher_questionnaire,
)

router = APIRouter(prefix="/psychologist", tags=["psychologist"])


@router.post("/questionnaires/students/{student_id}", response_model=TeacherQuestionnaireResponse)
def submit_questionnaire(
    student_id: UUID,
    payload: TeacherQuestionnaireCreateRequest,
    current_user: CurrentUser = Depends(require_roles(UserRole.ROLE_TUTOR)),
    session: Session = Depends(get_db_session),
) -> TeacherQuestionnaireResponse:
    return submit_teacher_questionnaire(session, student_id, payload, current_user)


@router.get("/reviews/students/{student_id}", response_model=PsychologistReviewResponse)
def review_student(
    student_id: UUID,
    request: Request,
    current_user: CurrentUser = Depends(require_roles(UserRole.ROLE_PSYCHOLOGIST)),
    session: Session = Depends(get_db_session),
) -> PsychologistReviewResponse:
    return review_student_profile(session, student_id, current_user, get_request_locale(request))


@router.get("/reviews/students", response_model=PsychologistReviewListResponse)
def list_reviews(
    search: str | None = Query(default=None, min_length=1, max_length=100),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    current_user: CurrentUser = Depends(require_roles(UserRole.ROLE_PSYCHOLOGIST)),
    session: Session = Depends(get_db_session),
) -> PsychologistReviewListResponse:
    return list_linked_student_reviews(session, current_user, search=search, limit=limit, offset=offset)


@router.post("/support/{student_id}/confirm", response_model=SupportConfirmResponse)
def confirm_support(
    student_id: UUID,
    payload: SupportConfirmRequest,
    request: Request,
    current_user: CurrentUser = Depends(require_roles(UserRole.ROLE_PSYCHOLOGIST)),
    session: Session = Depends(get_db_session),
) -> SupportConfirmResponse:
    return confirm_student_support(session, student_id, payload, current_user, get_request_locale(request))
