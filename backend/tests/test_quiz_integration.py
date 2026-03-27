from uuid import UUID, uuid4

from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker

from app.core.roles import UserRole
from app.core.security import create_access_token
from app.db.base import Base
from app.db.models.economy import PointTransaction, PointTransactionType, PointsWallet, XpLedger
from app.db.models.quiz import Quiz, QuizQuestion
from app.db.models.users import User
from app.db.session import get_db_session
from app.main import app

TEST_DATABASE_URL = "postgresql+psycopg://learnable:learnable@localhost:5433/learnable"

engine = create_engine(TEST_DATABASE_URL, future=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
Base.metadata.create_all(bind=engine)


def _seed_user_and_quiz(session: Session, initial_points: int) -> tuple[str, UUID, UUID, UUID, UUID]:
    user = User(
        email=f"student-{uuid4()}@learnable.test",
        password_hash="integration-test-hash",
        role=UserRole.ROLE_STUDENT,
    )
    session.add(user)
    session.flush()

    session.add(PointsWallet(user_id=user.id, balance_points=initial_points))

    quiz = Quiz(
        title_ar="اختبار تكاملي",
        title_en="Integration Quiz",
        difficulty="EASY",
        reward_points=10,
        reward_xp=20,
        is_active=True,
    )
    session.add(quiz)
    session.flush()

    question_one = QuizQuestion(
        quiz_id=quiz.id,
        prompt_ar="اختر الحرف الصحيح",
        prompt_en="Pick the right letter",
        options_json=[
            {"key": "A", "text_ar": "أ", "text_en": "A"},
            {"key": "B", "text_ar": "ب", "text_en": "B"},
        ],
        correct_option="A",
        explanation_ar="الإجابة أ",
        explanation_en="Answer is A",
    )
    question_two = QuizQuestion(
        quiz_id=quiz.id,
        prompt_ar="اختر الكلمة الصحيحة",
        prompt_en="Pick the right word",
        options_json=[
            {"key": "A", "text_ar": "تفاحة", "text_en": "Apple"},
            {"key": "B", "text_ar": "قلم", "text_en": "Pen"},
        ],
        correct_option="A",
        explanation_ar="الإجابة تفاحة",
        explanation_en="Answer is Apple",
    )
    session.add_all([question_one, question_two])
    session.commit()

    token = create_access_token(user.id, str(user.role), user.email)
    return token, user.id, quiz.id, question_one.id, question_two.id


def _make_client(session: Session) -> TestClient:
    def override_get_db_session():
        yield session

    app.dependency_overrides[get_db_session] = override_get_db_session
    return TestClient(app)


def test_quiz_start_submit_and_hint_updates_ledger() -> None:
    session = SessionLocal()
    client = _make_client(session)
    try:
        token, user_id, quiz_id, q1_id, q2_id = _seed_user_and_quiz(session, initial_points=10)
        headers = {"Authorization": f"Bearer {token}", "x-lang": "en"}

        start_response = client.post(f"/quizzes/{quiz_id}/start", headers=headers)
        assert start_response.status_code == 200
        start_data = start_response.json()
        assert len(start_data["questions"]) == 2

        hint_response = client.post(
            f"/quizzes/{quiz_id}/hint",
            headers=headers,
            json={"question_id": str(q1_id)},
        )
        assert hint_response.status_code == 200
        hint_data = hint_response.json()
        assert hint_data["points_cost"] == 2
        assert hint_data["wallet_balance"] == 8

        submit_response = client.post(
            f"/quizzes/{quiz_id}/submit",
            headers=headers,
            json={
                "attempt_id": start_data["attempt_id"],
                "answers": [
                    {"question_id": str(q1_id), "option_key": "A"},
                    {"question_id": str(q2_id), "option_key": "B"},
                ],
            },
        )
        assert submit_response.status_code == 200
        submit_data = submit_response.json()
        assert submit_data["correct_answers"] == 1
        assert submit_data["earned_points"] == 5
        assert submit_data["earned_xp"] == 10
        assert submit_data["wallet_balance"] == 13

        wallet_balance = session.scalar(
            select(PointsWallet.balance_points).where(PointsWallet.user_id == user_id)
        )
        assert wallet_balance == 13

        transactions = list(
            session.scalars(
                select(PointTransaction)
                .where(PointTransaction.user_id == user_id)
                .order_by(PointTransaction.created_at.asc())
            )
        )
        assert len(transactions) >= 2
        assert any(t.type == PointTransactionType.HINT_PENALTY and t.points_delta == -2 for t in transactions)
        assert any(t.type == PointTransactionType.QUIZ_EARN and t.points_delta == 5 for t in transactions)

        xp_entries = list(
            session.scalars(select(XpLedger).where(XpLedger.user_id == user_id).order_by(XpLedger.created_at.asc()))
        )
        assert any(entry.xp_delta == 10 and entry.reason == "quiz_submit" for entry in xp_entries)
    finally:
        app.dependency_overrides.clear()
        client.close()
        session.close()


def test_quiz_hint_fails_when_points_insufficient() -> None:
    session = SessionLocal()
    client = _make_client(session)
    try:
        token, _, quiz_id, q1_id, _ = _seed_user_and_quiz(session, initial_points=1)
        headers = {"Authorization": f"Bearer {token}", "x-lang": "en"}

        response = client.post(
            f"/quizzes/{quiz_id}/hint",
            headers=headers,
            json={"question_id": str(q1_id)},
        )
        assert response.status_code == 409
        data = response.json()
        assert data["code"] == "INSUFFICIENT_POINTS"
    finally:
        app.dependency_overrides.clear()
        client.close()
        session.close()
