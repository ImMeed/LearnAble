from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.db.models.quiz import QuizAttempt
from app.db.models.study import Lesson
from app.db.models.teacher import (
    AssistanceRequestStatus,
    FeedbackSourceType,
    StudentFeedbackPrompt,
    TeacherAssistanceRequest,
    TeacherPresence,
)


def upsert_teacher_presence(session: Session, tutor_user_id: UUID, is_online: bool) -> TeacherPresence:
    record = session.get(TeacherPresence, tutor_user_id)
    if record is None:
        record = TeacherPresence(user_id=tutor_user_id, is_online=is_online)
        session.add(record)
    else:
        record.is_online = is_online
    session.flush()
    return record


def list_online_teachers(session: Session) -> list[TeacherPresence]:
    stmt = select(TeacherPresence).where(TeacherPresence.is_online.is_(True)).order_by(TeacherPresence.updated_at.desc())
    return list(session.scalars(stmt))


def create_assistance_request(
    session: Session,
    student_user_id: UUID,
    lesson_id: UUID | None,
    topic: str,
    message: str,
    preferred_at,
) -> TeacherAssistanceRequest:
    record = TeacherAssistanceRequest(
        student_user_id=student_user_id,
        lesson_id=lesson_id,
        topic=topic,
        message=message,
        preferred_at=preferred_at,
        status=AssistanceRequestStatus.REQUESTED,
    )
    session.add(record)
    session.flush()
    return record


def list_requests_for_student(session: Session, student_user_id: UUID) -> list[TeacherAssistanceRequest]:
    stmt = (
        select(TeacherAssistanceRequest)
        .where(TeacherAssistanceRequest.student_user_id == student_user_id)
        .order_by(TeacherAssistanceRequest.created_at.desc())
    )
    return list(session.scalars(stmt))


def list_requests_for_tutor(session: Session, tutor_user_id: UUID) -> list[TeacherAssistanceRequest]:
    stmt = (
        select(TeacherAssistanceRequest)
        .where(
            or_(
                TeacherAssistanceRequest.tutor_user_id == tutor_user_id,
                TeacherAssistanceRequest.status == AssistanceRequestStatus.REQUESTED,
            )
        )
        .order_by(TeacherAssistanceRequest.created_at.desc())
    )
    return list(session.scalars(stmt))


def get_assistance_request(session: Session, request_id: UUID) -> TeacherAssistanceRequest | None:
    return session.get(TeacherAssistanceRequest, request_id)


def count_tutor_requests_by_status(session: Session, tutor_user_id: UUID) -> dict[str, int]:
    stmt = (
        select(TeacherAssistanceRequest.status, func.count(TeacherAssistanceRequest.id))
        .where(TeacherAssistanceRequest.tutor_user_id == tutor_user_id)
        .group_by(TeacherAssistanceRequest.status)
    )
    rows = list(session.execute(stmt).all())
    return {status.value: count for status, count in rows}


def create_feedback_prompt(
    session: Session,
    student_user_id: UUID,
    source_type: FeedbackSourceType,
    source_id: UUID,
    prompt_ar: str,
    prompt_en: str,
) -> StudentFeedbackPrompt:
    record = StudentFeedbackPrompt(
        student_user_id=student_user_id,
        source_type=source_type,
        source_id=source_id,
        prompt_ar=prompt_ar,
        prompt_en=prompt_en,
    )
    session.add(record)
    session.flush()
    return record


def list_feedback_prompts_for_student(session: Session, student_user_id: UUID) -> list[StudentFeedbackPrompt]:
    stmt = (
        select(StudentFeedbackPrompt)
        .where(StudentFeedbackPrompt.student_user_id == student_user_id)
        .order_by(StudentFeedbackPrompt.created_at.desc())
    )
    return list(session.scalars(stmt))


def get_feedback_prompt(session: Session, prompt_id: UUID) -> StudentFeedbackPrompt | None:
    return session.get(StudentFeedbackPrompt, prompt_id)


def get_lesson(session: Session, lesson_id: UUID) -> Lesson | None:
    stmt = select(Lesson).where(Lesson.id == lesson_id, Lesson.is_active.is_(True))
    return session.scalar(stmt)


def get_quiz_attempt(session: Session, attempt_id: UUID, student_user_id: UUID) -> QuizAttempt | None:
    stmt = select(QuizAttempt).where(QuizAttempt.id == attempt_id, QuizAttempt.user_id == student_user_id)
    return session.scalar(stmt)
