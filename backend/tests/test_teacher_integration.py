from datetime import datetime, timezone
from uuid import UUID, uuid4

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.roles import UserRole
from app.core.security import create_access_token
from app.db.base import Base
from app.db.models.quiz import Quiz, QuizAttempt
from app.db.models.study import Lesson
from app.db.models.users import User
from app.db.session import get_db_session
from app.main import app

TEST_DATABASE_URL = "postgresql+psycopg://learnable:learnable@localhost:5433/learnable"

engine = create_engine(TEST_DATABASE_URL, future=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
Base.metadata.create_all(bind=engine)


def _make_client(session: Session) -> TestClient:
    def override_get_db_session():
        yield session

    app.dependency_overrides[get_db_session] = override_get_db_session
    return TestClient(app)


def _seed_teacher_flow_data(session: Session) -> tuple[str, str, UUID, UUID]:
    student = User(
        email=f"teacher-student-{uuid4()}@learnable.test",
        password_hash="integration-test-hash",
        role=UserRole.ROLE_STUDENT,
    )
    tutor = User(
        email=f"teacher-tutor-{uuid4()}@learnable.test",
        password_hash="integration-test-hash",
        role=UserRole.ROLE_TUTOR,
    )
    session.add_all([student, tutor])
    session.flush()

    lesson = Lesson(
        title_ar="درس المتابعة",
        title_en="Follow-up Lesson",
        body_ar="محتوى متابعة",
        body_en="Follow-up content",
        difficulty="BEGINNER",
        is_active=True,
    )
    session.add(lesson)
    session.flush()

    quiz = Quiz(
        title_ar="اختبار قصير",
        title_en="Quick Quiz",
        difficulty="EASY",
        reward_points=10,
        reward_xp=20,
        is_active=True,
    )
    session.add(quiz)
    session.flush()

    attempt = QuizAttempt(
        user_id=student.id,
        quiz_id=quiz.id,
        score=80,
        total_questions=5,
        earned_points=8,
        earned_xp=16,
        answers_json={"q1": "A"},
        completed_at=datetime.now(timezone.utc),
    )
    session.add(attempt)
    session.commit()

    student_token = create_access_token(student.id, str(student.role), student.email)
    tutor_token = create_access_token(tutor.id, str(tutor.role), tutor.email)
    return student_token, tutor_token, lesson.id, attempt.id


def test_teacher_assistance_presence_dashboard_flow() -> None:
    session = SessionLocal()
    client = _make_client(session)
    try:
        student_token, tutor_token, lesson_id, _ = _seed_teacher_flow_data(session)
        student_headers = {"Authorization": f"Bearer {student_token}", "x-lang": "en"}
        tutor_headers = {"Authorization": f"Bearer {tutor_token}", "x-lang": "en"}

        create_response = client.post(
            "/teacher/assistance/requests",
            headers=student_headers,
            json={
                "lesson_id": str(lesson_id),
                "topic": "Need one-to-one support",
                "message": "I need help understanding the last section.",
            },
        )
        assert create_response.status_code == 200
        request_id = create_response.json()["id"]

        list_response = client.get("/teacher/assistance/requests", headers=tutor_headers)
        assert list_response.status_code == 200
        assert any(item["id"] == request_id for item in list_response.json()["items"])

        schedule_response = client.patch(
            f"/teacher/assistance/requests/{request_id}/schedule",
            headers=tutor_headers,
            json={
                "scheduled_at": datetime.now(timezone.utc).isoformat(),
                "meeting_url": "https://meet.learnable.test/room-1",
            },
        )
        assert schedule_response.status_code == 200
        assert schedule_response.json()["status"] == "SCHEDULED"

        dashboard_response = client.get("/teacher/dashboard", headers=tutor_headers)
        assert dashboard_response.status_code == 200
        dashboard_data = dashboard_response.json()
        assert dashboard_data["assigned_requests"] >= 1
        assert dashboard_data["scheduled_sessions"] >= 1

        presence_response = client.put(
            "/teacher/presence",
            headers=tutor_headers,
            json={"is_online": True},
        )
        assert presence_response.status_code == 200

        active_response = client.get("/teacher/presence/active", headers=student_headers)
        assert active_response.status_code == 200
        assert len(active_response.json()["items"]) >= 1
    finally:
        app.dependency_overrides.clear()
        client.close()
        session.close()


def test_student_feedback_prompt_emit_and_answer() -> None:
    session = SessionLocal()
    client = _make_client(session)
    try:
        student_token, _, lesson_id, attempt_id = _seed_teacher_flow_data(session)
        student_headers = {"Authorization": f"Bearer {student_token}", "x-lang": "en"}

        lesson_prompt_response = client.post(
            f"/teacher/feedback/prompts/lesson/{lesson_id}",
            headers=student_headers,
        )
        assert lesson_prompt_response.status_code == 200

        assessment_prompt_response = client.post(
            f"/teacher/feedback/prompts/assessment/{attempt_id}",
            headers=student_headers,
        )
        assert assessment_prompt_response.status_code == 200

        list_prompts_response = client.get("/teacher/feedback/prompts/me", headers=student_headers)
        assert list_prompts_response.status_code == 200
        prompts = list_prompts_response.json()["items"]
        assert len(prompts) >= 2

        prompt_id = prompts[0]["id"]
        answer_response = client.post(
            f"/teacher/feedback/prompts/{prompt_id}/answer",
            headers=student_headers,
            json={"response_text": "I need more examples next time."},
        )
        assert answer_response.status_code == 200
        assert answer_response.json()["is_answered"] is True
    finally:
        app.dependency_overrides.clear()
        client.close()
        session.close()
