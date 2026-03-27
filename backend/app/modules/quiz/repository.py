from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models.quiz import Quiz, QuizAttempt, QuizQuestion


def list_quizzes(session: Session) -> list[Quiz]:
    stmt = select(Quiz).where(Quiz.is_active.is_(True)).order_by(Quiz.created_at.desc())
    return list(session.scalars(stmt))


def get_quiz(session: Session, quiz_id: UUID) -> Quiz | None:
    return session.scalar(select(Quiz).where(Quiz.id == quiz_id, Quiz.is_active.is_(True)))


def get_quiz_questions(session: Session, quiz_id: UUID) -> list[QuizQuestion]:
    stmt = select(QuizQuestion).where(QuizQuestion.quiz_id == quiz_id).order_by(QuizQuestion.created_at.asc())
    return list(session.scalars(stmt))


def get_quiz_question(session: Session, quiz_id: UUID, question_id: UUID) -> QuizQuestion | None:
    stmt = select(QuizQuestion).where(QuizQuestion.quiz_id == quiz_id, QuizQuestion.id == question_id)
    return session.scalar(stmt)


def create_attempt(session: Session, user_id: UUID, quiz_id: UUID) -> QuizAttempt:
    attempt = QuizAttempt(user_id=user_id, quiz_id=quiz_id)
    session.add(attempt)
    session.flush()
    return attempt


def get_attempt_for_user(session: Session, attempt_id: UUID, user_id: UUID) -> QuizAttempt | None:
    return session.scalar(select(QuizAttempt).where(QuizAttempt.id == attempt_id, QuizAttempt.user_id == user_id))
