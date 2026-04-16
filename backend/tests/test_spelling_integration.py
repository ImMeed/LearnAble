from uuid import UUID, uuid4

from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker

from app.core.roles import UserRole
from app.core.security import create_access_token
from app.db.base import Base
from app.db.models.economy import PointsWallet
from app.db.models.spelling import SpellingSession
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


def _seed_student(session: Session) -> tuple[str, UUID]:
    student = User(
        email=f"spelling-student-{uuid4()}@learnable.test",
        password_hash="integration-test-hash",
        role=UserRole.ROLE_STUDENT,
    )
    session.add(student)
    session.flush()
    session.add(PointsWallet(user_id=student.id, balance_points=0))
    session.commit()
    token = create_access_token(student.id, str(student.role), student.email)
    return token, student.id


def _seed_tutor(session: Session) -> str:
    tutor = User(
        email=f"spelling-tutor-{uuid4()}@learnable.test",
        password_hash="integration-test-hash",
        role=UserRole.ROLE_TUTOR,
    )
    session.add(tutor)
    session.commit()
    return create_access_token(tutor.id, str(tutor.role), tutor.email)


def _near_match_for(word: str) -> str:
    if len(word) < 1:
        return word
    replacement = "b" if word[0].lower() != "b" else "c"
    return f"{replacement}{word[1:]}"


def test_spelling_session_near_match_flow_awards_reward() -> None:
    session = SessionLocal()
    client = _make_client(session)
    try:
        token, student_id = _seed_student(session)
        headers = {"Authorization": f"Bearer {token}", "x-lang": "en"}

        activities_res = client.get("/spelling/activities", headers=headers)
        assert activities_res.status_code == 200
        assert len(activities_res.json()["items"]) >= 1

        start_res = client.post("/spelling/sessions/start", headers=headers, json={})
        assert start_res.status_code == 200
        start_data = start_res.json()
        session_id = start_data["session_id"]

        hint_res = client.post(f"/spelling/sessions/{session_id}/hint", headers=headers)
        assert hint_res.status_code == 200
        assert hint_res.json()["hint_used"] is True

        candidate = _near_match_for(start_data["audio_text"])
        answer_res = client.post(
            f"/spelling/sessions/{session_id}/answer",
            headers=headers,
            json={"answer": candidate},
        )
        assert answer_res.status_code == 200
        answer_data = answer_res.json()
        assert answer_data["accepted"] is True
        assert answer_data["is_near_match"] is True

        complete_res = client.post(
            f"/spelling/sessions/{session_id}/complete",
            headers=headers,
            json={"replay_count": 2, "typed_playback_count": 1, "duration_ms": 9000},
        )
        assert complete_res.status_code == 200
        payload = complete_res.json()
        assert payload["solved"] is True
        assert payload["is_near_match"] is True
        assert payload["earned_xp"] >= 12
        assert payload["wallet_balance"] >= 8

        stored = session.scalar(select(SpellingSession).where(SpellingSession.id == UUID(session_id)))
        assert stored is not None
        assert stored.student_user_id == student_id
        assert stored.hint_used is True
        assert stored.near_match_used is True
        assert stored.replay_count == 2
        assert stored.typed_playback_count == 1
        assert stored.duration_ms == 9000
    finally:
        app.dependency_overrides.clear()
        client.close()
        session.close()


def test_spelling_routes_require_student_role() -> None:
    session = SessionLocal()
    client = _make_client(session)
    try:
        tutor_token = _seed_tutor(session)
        headers = {"Authorization": f"Bearer {tutor_token}", "x-lang": "en"}
        response = client.post("/spelling/sessions/start", headers=headers, json={})
        assert response.status_code == 403
    finally:
        app.dependency_overrides.clear()
        client.close()
        session.close()
