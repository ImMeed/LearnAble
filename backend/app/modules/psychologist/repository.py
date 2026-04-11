from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.models.links import StudentParentLink, StudentPsychologistLink
from app.db.models.psychologist import PsychologistSupportConfirmation, TeacherQuestionnaire
from app.db.models.study import StudentScreening
from app.db.models.users import User


def is_student_linked_to_psychologist(session: Session, student_id: UUID, psychologist_id: UUID) -> bool:
    stmt = select(StudentPsychologistLink).where(
        StudentPsychologistLink.student_user_id == student_id,
        StudentPsychologistLink.psychologist_user_id == psychologist_id,
    )
    return session.scalar(stmt) is not None


def list_linked_student_ids_for_psychologist(session: Session, psychologist_id: UUID) -> list[UUID]:
    stmt = select(StudentPsychologistLink.student_user_id).where(
        StudentPsychologistLink.psychologist_user_id == psychologist_id
    )
    return list(session.scalars(stmt))


def list_student_ids_with_screenings(
    session: Session,
    search: str | None,
    limit: int,
    offset: int,
) -> tuple[list[UUID], int]:
    base = select(StudentScreening.user_id).join(User, User.id == StudentScreening.user_id)
    if search:
        base = base.where(
            func.coalesce(User.display_name, "").ilike(f"%{search}%")
            | func.split_part(User.email, "@", 1).ilike(f"%{search}%")
        )

    total_stmt = select(func.count()).select_from(base.subquery())
    total = session.scalar(total_stmt) or 0

    items_stmt = base.order_by(StudentScreening.created_at.desc()).limit(limit).offset(offset)
    items = list(session.scalars(items_stmt))
    return items, total


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


def get_student_email(session: Session, student_id: UUID) -> str | None:
    stmt = select(User.email).where(User.id == student_id)
    return session.scalar(stmt)


def get_student(session: Session, student_id: UUID) -> User | None:
    stmt = select(User).where(User.id == student_id)
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
