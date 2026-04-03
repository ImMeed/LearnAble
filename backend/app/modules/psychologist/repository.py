from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models.links import StudentParentLink, StudentPsychologistLink
from app.db.models.psychologist import PsychologistSupportConfirmation, TeacherQuestionnaire
from app.db.models.study import StudentScreening


def is_student_linked_to_psychologist(session: Session, student_id: UUID, psychologist_id: UUID) -> bool:
    stmt = select(StudentPsychologistLink).where(
        StudentPsychologistLink.student_user_id == student_id,
        StudentPsychologistLink.psychologist_user_id == psychologist_id,
    )
    return session.scalar(stmt) is not None


def list_parent_ids_for_student(session: Session, student_id: UUID) -> list[UUID]:
    stmt = select(StudentParentLink.parent_user_id).where(StudentParentLink.student_user_id == student_id)
    return list(session.scalars(stmt))


def create_teacher_questionnaire(
    session: Session,
    student_user_id: UUID,
    tutor_user_id: UUID,
    attention_score: int,
    engagement_score: int,
    notes: str,
    cadence_days: int,
) -> TeacherQuestionnaire:
    record = TeacherQuestionnaire(
        student_user_id=student_user_id,
        tutor_user_id=tutor_user_id,
        attention_score=attention_score,
        engagement_score=engagement_score,
        notes=notes,
        cadence_days=cadence_days,
    )
    session.add(record)
    session.flush()
    return record


def get_latest_questionnaire_for_student(session: Session, student_id: UUID) -> TeacherQuestionnaire | None:
    stmt = (
        select(TeacherQuestionnaire)
        .where(TeacherQuestionnaire.student_user_id == student_id)
        .order_by(TeacherQuestionnaire.submitted_at.desc())
    )
    return session.scalar(stmt)


def get_student_screening(session: Session, student_id: UUID) -> StudentScreening | None:
    stmt = select(StudentScreening).where(StudentScreening.user_id == student_id)
    return session.scalar(stmt)


def get_support_confirmation(session: Session, student_id: UUID) -> PsychologistSupportConfirmation | None:
    stmt = select(PsychologistSupportConfirmation).where(PsychologistSupportConfirmation.student_user_id == student_id)
    return session.scalar(stmt)


def upsert_support_confirmation(
    session: Session,
    student_user_id: UUID,
    psychologist_user_id: UUID,
    support_level: str,
    notes: str,
) -> PsychologistSupportConfirmation:
    record = get_support_confirmation(session, student_user_id)
    if record is None:
        record = PsychologistSupportConfirmation(
            student_user_id=student_user_id,
            psychologist_user_id=psychologist_user_id,
            support_level=support_level,
            notes=notes,
        )
        session.add(record)
    else:
        record.psychologist_user_id = psychologist_user_id
        record.support_level = support_level
        record.notes = notes
        session.add(record)
    session.flush()
    return record
