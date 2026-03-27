from uuid import UUID, uuid4

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.roles import UserRole
from app.core.security import create_access_token
from app.db.base import Base
from app.db.models.study import Lesson, LessonFlashcard, LessonReadingGame
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


def _seed_student_and_lesson(session: Session) -> tuple[str, UUID]:
    user = User(
        email=f"study-student-{uuid4()}@learnable.test",
        password_hash="integration-test-hash",
        role=UserRole.ROLE_STUDENT,
    )
    session.add(user)
    session.flush()

    lesson = Lesson(
        title_ar="درس القراءة",
        title_en="Reading Lesson",
        body_ar="هذا نص تجريبي لتدريب القراءة.",
        body_en="This is sample text for reading practice.",
        difficulty="BEGINNER",
        is_active=True,
    )
    session.add(lesson)
    session.flush()

    session.add(
        LessonFlashcard(
            lesson_id=lesson.id,
            front_ar="كلمة",
            front_en="Word",
            back_ar="وحدة لغوية",
            back_en="A language unit",
        )
    )
    session.add(
        LessonReadingGame(
            lesson_id=lesson.id,
            name_ar="لعبة الحروف",
            name_en="Letter Game",
            objective_ar="تمييز الحروف",
            objective_en="Letter recognition",
            words_json=["cat", "sun", "book"],
        )
    )

    session.commit()
    token = create_access_token(user.id, str(user.role), user.email)
    return token, lesson.id


def test_screening_single_submission_and_awareness() -> None:
    session = SessionLocal()
    client = _make_client(session)
    try:
        token, lesson_id = _seed_student_and_lesson(session)
        headers = {"Authorization": f"Bearer {token}", "x-lang": "en"}

        screening_response = client.post(
            "/study/screening/complete",
            headers=headers,
            json={"focus_score": 50, "reading_score": 70, "memory_score": 60, "notes": "baseline"},
        )
        assert screening_response.status_code == 200
        screening_data = screening_response.json()
        assert screening_data["support_level"] == "MEDIUM"

        second_response = client.post(
            "/study/screening/complete",
            headers=headers,
            json={"focus_score": 50, "reading_score": 70, "memory_score": 60},
        )
        assert second_response.status_code == 409
        assert second_response.json()["code"] == "SCREENING_ALREADY_COMPLETED"

        awareness_response = client.get("/study/awareness", headers=headers)
        assert awareness_response.status_code == 200
        assert len(awareness_response.json()["items"]) == 3

        lesson_response = client.get(f"/study/lessons/{lesson_id}", headers=headers)
        assert lesson_response.status_code == 200

        assist_response = client.post(
            f"/study/lessons/{lesson_id}/assist",
            headers=headers,
            json={"mode": "summary"},
        )
        assert assist_response.status_code == 200
        assert assist_response.json()["mode"] == "summary"

        cards_response = client.get(f"/study/lessons/{lesson_id}/flashcards", headers=headers)
        assert cards_response.status_code == 200
        assert len(cards_response.json()["items"]) == 1

        games_response = client.get(f"/study/lessons/{lesson_id}/games", headers=headers)
        assert games_response.status_code == 200
        assert len(games_response.json()["items"]) == 1
    finally:
        app.dependency_overrides.clear()
        client.close()
        session.close()


def test_study_assist_requires_auth() -> None:
    client = TestClient(app)
    response = client.post(
        f"/study/lessons/{uuid4()}/assist",
        json={"mode": "qa", "question": "What is this lesson about?"},
    )
    assert response.status_code == 401
    client.close()
