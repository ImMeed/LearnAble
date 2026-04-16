from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.models.study import Lesson, LessonFlashcard, LessonReadingGame, StudentCourseCompletion, StudentScreening


def get_study_status(session: Session) -> str:
    _ = session
    return "ok"


def get_student_screening(session: Session, user_id: UUID) -> StudentScreening | None:
    stmt = select(StudentScreening).where(StudentScreening.user_id == user_id)
    return session.scalar(stmt)


def create_student_screening(
    session: Session,
    user_id: UUID,
    focus_score: int,
    reading_score: int,
    memory_score: int,
    support_level: str,
    indicators: dict,
) -> StudentScreening:
    record = StudentScreening(
        user_id=user_id,
        focus_score=focus_score,
        reading_score=reading_score,
        memory_score=memory_score,
        support_level=support_level,
        indicators_json=indicators,
    )
    session.add(record)
    session.flush()
    return record


def list_lessons(session: Session) -> list[Lesson]:
    stmt = select(Lesson).where(Lesson.is_active.is_(True)).order_by(Lesson.created_at.desc())
    return list(session.scalars(stmt))


def get_lesson(session: Session, lesson_id: UUID) -> Lesson | None:
    stmt = select(Lesson).where(Lesson.id == lesson_id, Lesson.is_active.is_(True))
    return session.scalar(stmt)


def list_flashcards(session: Session, lesson_id: UUID) -> list[LessonFlashcard]:
    stmt = select(LessonFlashcard).where(LessonFlashcard.lesson_id == lesson_id).order_by(LessonFlashcard.created_at.asc())
    return list(session.scalars(stmt))


def list_reading_games(session: Session, lesson_id: UUID) -> list[LessonReadingGame]:
    stmt = (
        select(LessonReadingGame)
        .where(LessonReadingGame.lesson_id == lesson_id)
        .order_by(LessonReadingGame.created_at.asc())
    )
    return list(session.scalars(stmt))


def get_course_completion(
    session: Session,
    *,
    student_user_id: UUID,
    lesson_id: UUID,
) -> StudentCourseCompletion | None:
    stmt = select(StudentCourseCompletion).where(
        StudentCourseCompletion.student_user_id == student_user_id,
        StudentCourseCompletion.lesson_id == lesson_id,
    )
    return session.scalar(stmt)


def mark_course_completed(
    session: Session,
    *,
    student_user_id: UUID,
    lesson_id: UUID,
) -> StudentCourseCompletion:
    record = get_course_completion(
        session,
        student_user_id=student_user_id,
        lesson_id=lesson_id,
    )
    if record is None:
        record = StudentCourseCompletion(student_user_id=student_user_id, lesson_id=lesson_id)
        session.add(record)
        session.flush()
    return record


def count_completed_courses_for_student(session: Session, student_user_id: UUID) -> int:
    stmt = select(func.count(StudentCourseCompletion.id)).where(
        StudentCourseCompletion.student_user_id == student_user_id
    )
    count = session.scalar(stmt)
    return int(count or 0)
