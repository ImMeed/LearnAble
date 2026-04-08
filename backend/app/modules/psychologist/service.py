from uuid import UUID

from fastapi import status
from sqlalchemy.orm import Session

from app.core.i18n import localized_http_exception
from app.core.security import CurrentUser
from app.modules.notifications import repository as notifications_repository
from app.modules.psychologist import repository
from app.modules.psychologist.schemas import (
    PsychologistReviewListResponse,
    PsychologistReviewResponse,
    SupportConfirmRequest,
    SupportConfirmResponse,
    TeacherQuestionnaireCreateRequest,
    TeacherQuestionnaireResponse,
)


def _build_review_response(session: Session, student_id: UUID) -> PsychologistReviewResponse:
    screening = repository.get_student_screening(session, student_id)
    questionnaire = repository.get_latest_questionnaire_for_student(session, student_id)
    confirmation = repository.get_support_confirmation(session, student_id)
    student_email = repository.get_student_email(session, student_id)
    student_label = student_email.split("@", 1)[0] if student_email else str(student_id)

    screening_summary = None
    screening_composite_score = None
    if screening is not None:
        screening_composite_score = round(
            (screening.focus_score + screening.reading_score + screening.memory_score) / 3
        )
        screening_summary = {
            "focus_score": screening.focus_score,
            "reading_score": screening.reading_score,
            "memory_score": screening.memory_score,
            "support_level": screening.support_level,
            "indicators": screening.indicators_json,
            "created_at": screening.created_at,
        }

    latest_questionnaire = None
    if questionnaire is not None:
        latest_questionnaire = {
            "attention_score": questionnaire.attention_score,
            "engagement_score": questionnaire.engagement_score,
            "notes": questionnaire.notes,
            "cadence_days": questionnaire.cadence_days,
            "submitted_at": questionnaire.submitted_at,
        }

    support_confirmation = None
    if confirmation is not None:
        support_confirmation = {
            "support_level": confirmation.support_level,
            "notes": confirmation.notes,
            "confirmed_at": confirmation.confirmed_at,
        }

    return PsychologistReviewResponse(
        student_user_id=student_id,
        student_label=student_label,
        screening_composite_score=screening_composite_score,
        screening_summary=screening_summary,
        latest_questionnaire=latest_questionnaire,
        support_confirmation=support_confirmation,
    )


def submit_teacher_questionnaire(
    session: Session,
    student_id: UUID,
    payload: TeacherQuestionnaireCreateRequest,
    current_user: CurrentUser,
) -> TeacherQuestionnaireResponse:
    record = repository.create_teacher_questionnaire(
        session=session,
        student_user_id=student_id,
        tutor_user_id=current_user.user_id,
        attention_score=payload.attention_score,
        engagement_score=payload.engagement_score,
        notes=payload.notes,
        cadence_days=payload.cadence_days,
    )
    session.commit()
    return TeacherQuestionnaireResponse(
        id=record.id,
        student_user_id=record.student_user_id,
        tutor_user_id=record.tutor_user_id,
        attention_score=record.attention_score,
        engagement_score=record.engagement_score,
        notes=record.notes,
        cadence_days=record.cadence_days,
        submitted_at=record.submitted_at,
    )


def review_student_profile(
    session: Session,
    student_id: UUID,
    current_user: CurrentUser,
    locale: str,
) -> PsychologistReviewResponse:
    _ = current_user
    if repository.get_student_screening(session, student_id) is None:
        raise localized_http_exception(status.HTTP_404_NOT_FOUND, "STUDENT_SCREENING_NOT_FOUND", locale)

    return _build_review_response(session, student_id)


def list_linked_student_reviews(
    session: Session,
    current_user: CurrentUser,
    search: str | None,
    limit: int,
    offset: int,
) -> PsychologistReviewListResponse:
    _ = current_user
    student_ids, total = repository.list_student_ids_with_screenings(session, search=search, limit=limit, offset=offset)
    items = [_build_review_response(session, student_id) for student_id in student_ids]
    return PsychologistReviewListResponse(items=items, total=total, limit=limit, offset=offset, query=search)


def confirm_student_support(
    session: Session,
    student_id: UUID,
    payload: SupportConfirmRequest,
    current_user: CurrentUser,
    locale: str,
) -> SupportConfirmResponse:
    if not repository.is_student_linked_to_psychologist(session, student_id, current_user.user_id):
        raise localized_http_exception(status.HTTP_403_FORBIDDEN, "STUDENT_PSYCHOLOGIST_LINK_NOT_FOUND", locale)

    confirmation = repository.upsert_support_confirmation(
        session=session,
        student_user_id=student_id,
        psychologist_user_id=current_user.user_id,
        support_level=payload.support_level,
        notes=payload.notes,
    )

    parent_ids = repository.list_parent_ids_for_student(session, student_id)
    for parent_id in parent_ids:
        notifications_repository.create_notification(
            session=session,
            user_id=parent_id,
            type="PSYCHOLOGIST_SUPPORT_CONFIRMED",
            title="تأكيد خطة دعم تعليمية",
            body="تم تأكيد خطة دعم تعليمية للطالب المرتبط بك من قبل المختص النفسي.",
            metadata={
                "student_user_id": str(student_id),
                "support_level": payload.support_level,
                "title_en": "Educational support plan confirmed",
                "body_en": "The psychologist has confirmed an educational support plan for your linked student.",
            },
        )

    session.commit()
    return SupportConfirmResponse(
        id=confirmation.id,
        student_user_id=confirmation.student_user_id,
        psychologist_user_id=confirmation.psychologist_user_id,
        support_level=confirmation.support_level,
        confirmed_at=confirmation.confirmed_at,
        parent_notifications_sent=len(parent_ids),
    )
