from uuid import UUID

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.db.models.links import StudentParentLink, StudentPsychologistLink
from app.db.models.psychologist import PsychologistSupportConfirmation, TeacherQuestionnaire
from app.db.models.reading_lab import ReadingLabSession, ReadingSupportProfile, ReadingSupportStatus
from app.db.models.study import StudentScreening
from app.db.models.teacher import AssistanceRequestStatus, TeacherAssistanceRequest
from app.db.models.users import User


def get_user(session: Session, user_id: UUID) -> User | None:
    return session.get(User, user_id)


def list_parent_linked_student_ids(session: Session, parent_user_id: UUID) -> list[UUID]:
    stmt = select(StudentParentLink.student_user_id).where(StudentParentLink.parent_user_id == parent_user_id)
    return list(session.scalars(stmt))


def list_psychologist_linked_student_ids(session: Session, psychologist_user_id: UUID) -> list[UUID]:
    stmt = select(StudentPsychologistLink.student_user_id).where(
        StudentPsychologistLink.psychologist_user_id == psychologist_user_id
    )
    return list(session.scalars(stmt))


def list_tutor_student_ids(session: Session, tutor_user_id: UUID) -> list[UUID]:
    questionnaire_stmt = select(TeacherQuestionnaire.student_user_id).where(
        TeacherQuestionnaire.tutor_user_id == tutor_user_id
    )
    request_stmt = select(TeacherAssistanceRequest.student_user_id).where(
        or_(
            TeacherAssistanceRequest.tutor_user_id == tutor_user_id,
            TeacherAssistanceRequest.status == AssistanceRequestStatus.REQUESTED,
        )
    )
    screening_stmt = select(StudentScreening.user_id)

    seen: set[UUID] = set()
    student_ids: list[UUID] = []
    for student_id in (
        list(session.scalars(questionnaire_stmt))
        + list(session.scalars(request_stmt))
        + list(session.scalars(screening_stmt))
    ):
        if student_id in seen:
            continue
        seen.add(student_id)
        student_ids.append(student_id)
    return student_ids


def get_user_by_email(session: Session, email: str) -> User | None:
    stmt = select(User).where(User.email == email.lower().strip())
    return session.scalar(stmt)


def get_user_by_student_link_id(session: Session, student_link_id: str) -> User | None:
    stmt = select(User).where(User.reading_lab_link_id == student_link_id.upper().strip())
    return session.scalar(stmt)


def create_parent_student_link(session: Session, parent_user_id: UUID, student_user_id: UUID) -> None:
    session.add(StudentParentLink(parent_user_id=parent_user_id, student_user_id=student_user_id))
    session.flush()


def create_psychologist_student_link(session: Session, psychologist_user_id: UUID, student_user_id: UUID) -> None:
    session.add(StudentPsychologistLink(psychologist_user_id=psychologist_user_id, student_user_id=student_user_id))
    session.flush()


def is_parent_linked_to_student(session: Session, parent_user_id: UUID, student_user_id: UUID) -> bool:
    stmt = select(StudentParentLink).where(
        StudentParentLink.parent_user_id == parent_user_id,
        StudentParentLink.student_user_id == student_user_id,
    )
    return session.scalar(stmt) is not None


def is_psychologist_linked_to_student(session: Session, psychologist_user_id: UUID, student_user_id: UUID) -> bool:
    stmt = select(StudentPsychologistLink).where(
        StudentPsychologistLink.psychologist_user_id == psychologist_user_id,
        StudentPsychologistLink.student_user_id == student_user_id,
    )
    return session.scalar(stmt) is not None


def get_support_profile(session: Session, student_user_id: UUID) -> ReadingSupportProfile | None:
    return session.get(ReadingSupportProfile, student_user_id)


def upsert_support_profile(
    session: Session,
    student_user_id: UUID,
    status: str,
    notes: str,
    focus_targets: list[str],
    updated_by_user_id: UUID,
    updated_by_role: str,
) -> ReadingSupportProfile:
    record = get_support_profile(session, student_user_id)
    if record is None:
        record = ReadingSupportProfile(
            student_user_id=student_user_id,
            status=ReadingSupportStatus(status),
            notes=notes,
            focus_targets_json=focus_targets,
            updated_by_user_id=updated_by_user_id,
            updated_by_role=updated_by_role,
        )
        session.add(record)
    else:
        record.status = ReadingSupportStatus(status)
        record.notes = notes
        record.focus_targets_json = focus_targets
        record.updated_by_user_id = updated_by_user_id
        record.updated_by_role = updated_by_role
        session.add(record)
    session.flush()
    return record


def get_student_screening(session: Session, student_user_id: UUID) -> StudentScreening | None:
    stmt = select(StudentScreening).where(StudentScreening.user_id == student_user_id)
    return session.scalar(stmt)


def get_latest_teacher_questionnaire(session: Session, student_user_id: UUID) -> TeacherQuestionnaire | None:
    stmt = (
        select(TeacherQuestionnaire)
        .where(TeacherQuestionnaire.student_user_id == student_user_id)
        .order_by(TeacherQuestionnaire.submitted_at.desc())
    )
    return session.scalar(stmt)


def get_psychologist_support_confirmation(session: Session, student_user_id: UUID) -> PsychologistSupportConfirmation | None:
    stmt = select(PsychologistSupportConfirmation).where(
        PsychologistSupportConfirmation.student_user_id == student_user_id
    )
    return session.scalar(stmt)


def create_session(
    session: Session,
    student_user_id: UUID,
    activity_key: str,
    activity_title_ar: str,
    activity_title_en: str,
    interaction_type: str,
    rounds: list[dict],
    focus_targets: list[str],
    support_active_at_start: bool,
) -> ReadingLabSession:
    record = ReadingLabSession(
        student_user_id=student_user_id,
        activity_key=activity_key,
        activity_title_ar=activity_title_ar,
        activity_title_en=activity_title_en,
        interaction_type=interaction_type,
        rounds_json=rounds,
        answers_json=[],
        focus_targets_json=focus_targets,
        support_active_at_start=support_active_at_start,
        current_round_index=0,
        total_rounds=len(rounds),
    )
    session.add(record)
    session.flush()
    return record


def get_session_for_student(
    session: Session,
    session_id: UUID,
    student_user_id: UUID,
    *,
    for_update: bool = False,
) -> ReadingLabSession | None:
    stmt = select(ReadingLabSession).where(
        ReadingLabSession.id == session_id,
        ReadingLabSession.student_user_id == student_user_id,
    )
    if for_update:
        stmt = stmt.with_for_update()
    return session.scalar(stmt)


def list_completed_sessions_for_student(session: Session, student_user_id: UUID) -> list[ReadingLabSession]:
    stmt = (
        select(ReadingLabSession)
        .where(
            ReadingLabSession.student_user_id == student_user_id,
            ReadingLabSession.completed_at.is_not(None),
        )
        .order_by(ReadingLabSession.completed_at.desc())
    )
    return list(session.scalars(stmt))
