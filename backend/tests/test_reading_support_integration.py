from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import settings
from app.core.platform_tracks import PlatformTrack
from app.core.roles import UserRole
from app.core.security import create_access_token
from app.db.base import Base
from app.db.models.links import StudentParentLink, StudentPsychologistLink
from app.db.models.reading_support import ReadingLabSession
from app.db.models.users import User
from app.db.session import get_db_session
from app.main import app

TEST_DATABASE_URL = "postgresql+psycopg://learnable:learnable@localhost:5433/learnable"

engine = create_engine(TEST_DATABASE_URL, future=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
Base.metadata.create_all(bind=engine)
with engine.begin() as connection:
    connection.exec_driver_sql(
        "ALTER TABLE dyslexia_support_profiles "
        "ADD COLUMN IF NOT EXISTS focus_words JSONB NOT NULL DEFAULT '[]'::jsonb"
    )


@pytest.fixture(autouse=True)
def _disable_live_gemini(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(settings, "gemini_api_key", "")


def _make_client(session: Session) -> TestClient:
    def override_get_db_session():
        yield session

    app.dependency_overrides[get_db_session] = override_get_db_session
    return TestClient(app)


def _seed_reading_support_users(session: Session) -> tuple[str, str, str, UUID]:
    student = User(
        display_name="Mia Reader",
        email=f"reading-student-{uuid4()}@learnable.test",
        password_hash="integration-test-hash",
        role=UserRole.ROLE_STUDENT,
        platform_track=PlatformTrack.READING_LAB,
    )
    parent = User(
        display_name="Parent One",
        email=f"reading-parent-{uuid4()}@learnable.test",
        password_hash="integration-test-hash",
        role=UserRole.ROLE_PARENT,
        platform_track=PlatformTrack.READING_LAB,
    )
    psychologist = User(
        display_name="Dr Noor",
        email=f"reading-psych-{uuid4()}@learnable.test",
        password_hash="integration-test-hash",
        role=UserRole.ROLE_PSYCHOLOGIST,
        platform_track=PlatformTrack.READING_LAB,
    )
    session.add_all([student, parent, psychologist])
    session.flush()

    session.add(StudentParentLink(student_user_id=student.id, parent_user_id=parent.id))
    session.add(StudentPsychologistLink(student_user_id=student.id, psychologist_user_id=psychologist.id))
    session.commit()

    student_token = create_access_token(student.id, str(student.role), student.email, PlatformTrack.READING_LAB.value)
    parent_token = create_access_token(parent.id, str(parent.role), parent.email, PlatformTrack.READING_LAB.value)
    psych_token = create_access_token(psychologist.id, str(psychologist.role), psychologist.email, PlatformTrack.READING_LAB.value)
    return student_token, parent_token, psych_token, student.id


def _seed_unlinked_parent(session: Session) -> str:
    parent = User(
        display_name="Parent Unlinked",
        email=f"reading-parent-unlinked-{uuid4()}@learnable.test",
        password_hash="integration-test-hash",
        role=UserRole.ROLE_PARENT,
        platform_track=PlatformTrack.READING_LAB,
    )
    session.add(parent)
    session.commit()
    return create_access_token(parent.id, str(parent.role), parent.email, PlatformTrack.READING_LAB.value)


def _seed_unlinked_psychologist(session: Session) -> str:
    psychologist = User(
        display_name="Psych Unlinked",
        email=f"reading-psych-unlinked-{uuid4()}@learnable.test",
        password_hash="integration-test-hash",
        role=UserRole.ROLE_PSYCHOLOGIST,
        platform_track=PlatformTrack.READING_LAB,
    )
    session.add(psychologist)
    session.commit()
    return create_access_token(psychologist.id, str(psychologist.role), psychologist.email, PlatformTrack.READING_LAB.value)


def _seed_student_only(session: Session) -> tuple[str, UUID]:
    student = User(
        display_name="Kid Solo",
        email=f"reading-student-only-{uuid4()}@learnable.test",
        password_hash="integration-test-hash",
        role=UserRole.ROLE_STUDENT,
        platform_track=PlatformTrack.READING_LAB,
    )
    session.add(student)
    session.commit()
    return create_access_token(student.id, str(student.role), student.email, PlatformTrack.READING_LAB.value), student.id


def test_parent_can_activate_reading_support_and_student_can_finish_game_session() -> None:
    session = SessionLocal()
    client = _make_client(session)
    try:
        student_token, parent_token, psych_token, student_id = _seed_reading_support_users(session)
        student_headers = {"Authorization": f"Bearer {student_token}", "x-lang": "en"}
        parent_headers = {"Authorization": f"Bearer {parent_token}", "x-lang": "en"}
        psych_headers = {"Authorization": f"Bearer {psych_token}", "x-lang": "en"}

        before_games = client.get("/reading-support/games", headers=student_headers)
        assert before_games.status_code == 403
        assert before_games.json()["code"] == "READING_SUPPORT_NOT_ENABLED"

        activate_response = client.put(
            f"/reading-support/students/{student_id}",
            headers=parent_headers,
            json={
                "is_active": True,
                "notes": "Observed reading reversals at home.",
                "focus_letters": ["b", "d"],
                "focus_words": ["cat", "train", "book", "sun"],
                "focus_numbers": ["3", "8"],
            },
        )
        assert activate_response.status_code == 200
        assert activate_response.json()["is_active"] is True
        assert activate_response.json()["declared_by_role"] == "ROLE_PARENT"
        assert activate_response.json()["focus_letters"] == ["b", "d"]
        assert activate_response.json()["focus_words"] == ["cat", "train", "book", "sun"]
        assert activate_response.json()["focus_numbers"] == ["3", "8"]

        psych_view = client.get("/reading-support/students", headers=psych_headers)
        assert psych_view.status_code == 200
        assert any(item["student_user_id"] == str(student_id) for item in psych_view.json()["items"])

        me_response = client.get("/reading-support/me", headers=student_headers)
        assert me_response.status_code == 200
        me_payload = me_response.json()
        assert me_payload["is_support_active"] is True
        assert me_payload["student_label"] == "Mia Reader"
        assert me_payload["support_profile"]["declared_by_role"] == "ROLE_PARENT"
        assert me_payload["support_profile"]["focus_letters"] == ["b", "d"]
        assert me_payload["support_profile"]["focus_words"] == ["cat", "train", "book", "sun"]
        assert me_payload["support_profile"]["focus_numbers"] == ["3", "8"]
        assert me_payload["progress"]["completed_sessions"] == 0

        games_response = client.get("/reading-support/games", headers=student_headers)
        assert games_response.status_code == 200
        items = games_response.json()["items"]
        assert len(items) == 5
        assert any(item["key"] == "letter_discrimination" for item in items)

        start_response = client.post(
            "/reading-support/sessions",
            headers=student_headers,
            json={"game_key": "letter_discrimination"},
        )
        assert start_response.status_code == 200
        session_id = UUID(start_response.json()["session_id"])
        assert start_response.json()["content_source"] == "fallback"
        assert start_response.json()["focus_letters"] == ["b", "d"]
        assert start_response.json()["focus_words"] == ["cat", "train", "book", "sun"]
        assert start_response.json()["focus_numbers"] == ["3", "8"]
        assert len(start_response.json()["rounds"]) == 4

        saved_session = session.get(ReadingLabSession, session_id)
        assert saved_session is not None
        rounds = saved_session.round_payload_json

        for index, round_payload in enumerate(rounds):
            answer_response = client.post(
                f"/reading-support/sessions/{session_id}/answer",
                headers=student_headers,
                json={"round_index": index, "answer": round_payload["correct_answer"]},
            )
            assert answer_response.status_code == 200
            assert answer_response.json()["is_correct"] is True

        complete_response = client.post(
            f"/reading-support/sessions/{session_id}/complete",
            headers=student_headers,
        )
        assert complete_response.status_code == 200
        complete_payload = complete_response.json()
        assert complete_payload["accuracy"] == 100
        assert complete_payload["correct_rounds"] == 4
        assert complete_payload["points_awarded"] > 0
        assert complete_payload["xp_awarded"] > 0

        refreshed_me = client.get("/reading-support/me", headers=student_headers)
        assert refreshed_me.status_code == 200
        progress = refreshed_me.json()["progress"]
        assert progress["completed_sessions"] == 1
        assert progress["average_accuracy"] == 100
        assert progress["current_level"] >= 1
        assert progress["average_session_seconds"] >= 0
        assert progress["total_play_time_seconds"] >= progress["average_session_seconds"]
        assert len(progress["performance_trend"]) == 1
        assert any(item["game_key"] == "letter_discrimination" and item["play_count"] == 1 for item in progress["by_game"])

        student_notifications = client.get("/notifications", headers=student_headers)
        assert student_notifications.status_code == 200
        assert any(item["type"] == "READING_SUPPORT_ACTIVATED" for item in student_notifications.json()["items"])
    finally:
        app.dependency_overrides.clear()
        client.close()
        session.close()


def test_unlinked_parent_cannot_toggle_reading_support() -> None:
    session = SessionLocal()
    client = _make_client(session)
    try:
        _, _, _, student_id = _seed_reading_support_users(session)
        unlinked_parent_token = _seed_unlinked_parent(session)
        headers = {"Authorization": f"Bearer {unlinked_parent_token}", "x-lang": "en"}

        response = client.put(
            f"/reading-support/students/{student_id}",
            headers=headers,
            json={"is_active": True, "notes": "Should fail for unlinked parent."},
        )
        assert response.status_code == 403
        assert response.json()["code"] == "STUDENT_PARENT_LINK_NOT_FOUND"
    finally:
        app.dependency_overrides.clear()
        client.close()
        session.close()


def test_parent_can_link_student_by_id_and_use_exact_focus_words() -> None:
    session = SessionLocal()
    client = _make_client(session)
    try:
        parent_token = _seed_unlinked_parent(session)
        student_token, student_id = _seed_student_only(session)
        parent_headers = {"Authorization": f"Bearer {parent_token}", "x-lang": "en"}
        student_headers = {"Authorization": f"Bearer {student_token}", "x-lang": "en"}
        focus_words = ["cat", "train", "book", "sun"]

        link_response = client.post(
            "/reading-support/students/link",
            headers=parent_headers,
            json={"student_id": str(student_id)},
        )
        assert link_response.status_code == 200
        assert link_response.json()["is_active"] is True

        student_me_response = client.get("/reading-support/me", headers=student_headers)
        assert student_me_response.status_code == 200
        assert student_me_response.json()["is_support_active"] is True

        activate_response = client.put(
            f"/reading-support/students/{student_id}",
            headers=parent_headers,
            json={
                "is_active": True,
                "notes": "Use these exact practice words.",
                "focus_words": focus_words,
            },
        )
        assert activate_response.status_code == 200
        assert activate_response.json()["focus_words"] == focus_words

        overview_response = client.get("/reading-support/students", headers=parent_headers)
        assert overview_response.status_code == 200
        assert any(item["student_user_id"] == str(student_id) for item in overview_response.json()["items"])

        start_response = client.post(
            "/reading-support/sessions",
            headers=student_headers,
            json={"game_key": "word_building"},
        )
        assert start_response.status_code == 200
        assert start_response.json()["focus_words"] == focus_words
        assert [round_item["audio_text"] for round_item in start_response.json()["rounds"]] == focus_words
    finally:
        app.dependency_overrides.clear()
        client.close()
        session.close()


def test_psychologist_can_link_multiple_students_by_id_for_dashboard_overview() -> None:
    session = SessionLocal()
    client = _make_client(session)
    try:
        psych_token = _seed_unlinked_psychologist(session)
        _, first_student_id = _seed_student_only(session)
        _, second_student_id = _seed_student_only(session)
        headers = {"Authorization": f"Bearer {psych_token}", "x-lang": "en"}

        for student_id in (first_student_id, second_student_id):
            response = client.post(
                "/reading-support/students/link",
                headers=headers,
                json={"student_id": str(student_id)},
            )
            assert response.status_code == 200

        overview_response = client.get("/reading-support/students", headers=headers)
        assert overview_response.status_code == 200
        linked_ids = {item["student_user_id"] for item in overview_response.json()["items"]}
        assert {str(first_student_id), str(second_student_id)}.issubset(linked_ids)
    finally:
        app.dependency_overrides.clear()
        client.close()
        session.close()


def test_parent_can_create_child_account_and_get_linked_student_id() -> None:
    session = SessionLocal()
    client = _make_client(session)
    try:
        parent_token = _seed_unlinked_parent(session)
        headers = {"Authorization": f"Bearer {parent_token}", "x-lang": "en"}

        response = client.post(
            "/reading-support/students",
            headers=headers,
            json={
                "display_name": "Lina",
                "email": f"lina-{uuid4()}@example.com",
                "password": "LinaPass123!",
            },
        )
        assert response.status_code == 201
        payload = response.json()
        assert payload["student_label"] == "Lina"
        assert payload["student_user_id"]

        students_response = client.get("/reading-support/students", headers=headers)
        assert students_response.status_code == 200
        matching_student = next(item for item in students_response.json()["items"] if item["student_label"] == "Lina")
        assert matching_student["support_profile"]["is_active"] is True

        created_student = session.get(User, UUID(payload["student_user_id"]))
        assert created_student is not None
        student_token = create_access_token(
            created_student.id,
            str(created_student.role),
            created_student.email,
            PlatformTrack.READING_LAB.value,
        )
        student_headers = {"Authorization": f"Bearer {student_token}", "x-lang": "en"}

        me_response = client.get("/reading-support/me", headers=student_headers)
        assert me_response.status_code == 200
        assert me_response.json()["is_support_active"] is True
    finally:
        app.dependency_overrides.clear()
        client.close()
        session.close()
