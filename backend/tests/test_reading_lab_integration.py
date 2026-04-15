import os
from uuid import UUID, uuid4

from fastapi.testclient import TestClient
from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import settings
from app.core.roles import UserRole
from app.core.security import create_access_token
from app.db.base import Base
from app.db.models.economy import PointTransaction
from app.db.models.links import StudentParentLink, StudentPsychologistLink
from app.db.models.psychologist import TeacherQuestionnaire
from app.db.models.study import StudentScreening
from app.db.models.users import User
from app.db.session import get_db_session
from app.main import app

TEST_DATABASE_URL = os.getenv("DATABASE_URL", settings.database_url)

engine = create_engine(TEST_DATABASE_URL, future=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


def _make_client(session: Session) -> TestClient:
    def override_get_db_session():
        yield session

    app.dependency_overrides[get_db_session] = override_get_db_session
    return TestClient(app)


def _seed_reading_lab_data(session: Session) -> tuple[str, str, str, tuple[UUID, UUID, UUID]]:
    student = User(
        email=f"readinglab-student-{uuid4()}@learnable.test",
        password_hash="integration-test-hash",
        role=UserRole.ROLE_STUDENT,
        student_age_years=9,
    )
    parent = User(
        email=f"readinglab-parent-{uuid4()}@learnable.test",
        password_hash="integration-test-hash",
        role=UserRole.ROLE_PARENT,
    )
    psychologist = User(
        email=f"readinglab-psych-{uuid4()}@learnable.test",
        password_hash="integration-test-hash",
        role=UserRole.ROLE_PSYCHOLOGIST,
    )
    session.add_all([student, parent, psychologist])
    session.flush()

    session.add(StudentParentLink(student_user_id=student.id, parent_user_id=parent.id))
    session.add(StudentPsychologistLink(student_user_id=student.id, psychologist_user_id=psychologist.id))
    session.add(
        TeacherQuestionnaire(
          student_user_id=student.id,
          tutor_user_id=psychologist.id,
          attention_score=62,
          engagement_score=70,
          notes="Teacher noticed letter reversals during reading practice.",
          cadence_days=14,
        )
    )
    session.add(
        StudentScreening(
            user_id=student.id,
            focus_score=60,
            reading_score=58,
            memory_score=64,
            support_level="MEDIUM",
            indicators_json={"source": "integration_seed"},
        )
    )
    session.commit()

    return (
        create_access_token(student.id, str(student.role), student.email),
        create_access_token(parent.id, str(parent.role), parent.email),
        create_access_token(psychologist.id, str(psychologist.role), psychologist.email),
        (student.id, parent.id, psychologist.id),
    )


def _cleanup_seed_users(session: Session, user_ids: tuple[UUID, ...]) -> None:
    for user_id in user_ids:
        user = session.get(User, user_id)
        if user is not None:
            session.delete(user)
    session.commit()


def test_reading_lab_tutor_students_live_data() -> None:
    previous_flag = settings.reading_lab_enabled
    settings.reading_lab_enabled = True
    Base.metadata.create_all(bind=engine)

    session = SessionLocal()
    client = _make_client(session)
    seeded_user_ids: tuple[UUID, UUID] | None = None
    try:
        student = User(
            email=f"readinglab-tutor-student-{uuid4()}@learnable.test",
            password_hash="integration-test-hash",
            role=UserRole.ROLE_STUDENT,
            student_age_years=10,
        )
        tutor = User(
            email=f"readinglab-tutor-{uuid4()}@learnable.test",
            password_hash="integration-test-hash",
            role=UserRole.ROLE_TUTOR,
        )
        session.add_all([student, tutor])
        session.flush()

        session.add(
            TeacherQuestionnaire(
                student_user_id=student.id,
                tutor_user_id=tutor.id,
                attention_score=68,
                engagement_score=72,
                notes="Needs guided reading pacing.",
                cadence_days=14,
            )
        )
        session.commit()
        seeded_user_ids = (student.id, tutor.id)

        tutor_token = create_access_token(tutor.id, str(tutor.role), tutor.email)
        tutor_headers = {"Authorization": f"Bearer {tutor_token}", "x-lang": "en"}

        response = client.get("/reading-lab/students/taught", headers=tutor_headers)
        assert response.status_code == 200
        payload = response.json()
        assert len(payload["items"]) >= 1
        student_item = next(item for item in payload["items"] if item["student_user_id"] == str(student.id))
        assert student_item["student_label"]
        assert "progress" in student_item
        assert "support_status" in student_item
    finally:
        settings.reading_lab_enabled = previous_flag
        if seeded_user_ids is not None:
            _cleanup_seed_users(session, seeded_user_ids)
        app.dependency_overrides.clear()
        client.close()
        session.close()


def test_reading_lab_link_by_student_link_id_for_parent_and_psychologist() -> None:
    previous_flag = settings.reading_lab_enabled
    settings.reading_lab_enabled = True
    Base.metadata.create_all(bind=engine)

    session = SessionLocal()
    client = _make_client(session)
    seeded_user_ids: tuple[UUID, UUID, UUID] | None = None
    try:
        student = User(
            email=f"readinglab-link-student-{uuid4()}@learnable.test",
            password_hash="integration-test-hash",
            role=UserRole.ROLE_STUDENT,
            student_age_years=10,
        )
        parent = User(
            email=f"readinglab-link-parent-{uuid4()}@learnable.test",
            password_hash="integration-test-hash",
            role=UserRole.ROLE_PARENT,
        )
        psychologist = User(
            email=f"readinglab-link-psych-{uuid4()}@learnable.test",
            password_hash="integration-test-hash",
            role=UserRole.ROLE_PSYCHOLOGIST,
        )
        session.add_all([student, parent, psychologist])
        session.commit()
        seeded_user_ids = (student.id, parent.id, psychologist.id)

        student_headers = {
            "Authorization": f"Bearer {create_access_token(student.id, str(student.role), student.email)}",
            "x-lang": "en",
        }
        parent_headers = {
            "Authorization": f"Bearer {create_access_token(parent.id, str(parent.role), parent.email)}",
            "x-lang": "en",
        }
        psych_headers = {
            "Authorization": f"Bearer {create_access_token(psychologist.id, str(psychologist.role), psychologist.email)}",
            "x-lang": "en",
        }

        link_id_response = client.get("/reading-lab/link-id/me", headers=student_headers)
        assert link_id_response.status_code == 200
        student_link_id = link_id_response.json()["student_link_id"]
        assert student_link_id.startswith("LB-")

        parent_link = client.post(
            "/reading-lab/children/link",
            headers=parent_headers,
            json={"student_link_id": student_link_id},
        )
        assert parent_link.status_code == 200

        psych_link = client.post(
            "/reading-lab/children/link",
            headers=psych_headers,
            json={"student_link_id": student_link_id},
        )
        assert psych_link.status_code == 200

        parent_children = client.get("/reading-lab/children", headers=parent_headers)
        assert parent_children.status_code == 200
        assert any(item["student_user_id"] == str(student.id) for item in parent_children.json()["items"])

        psych_children = client.get("/reading-lab/children", headers=psych_headers)
        assert psych_children.status_code == 200
        assert any(item["student_user_id"] == str(student.id) for item in psych_children.json()["items"])
    finally:
        settings.reading_lab_enabled = previous_flag
        if seeded_user_ids is not None:
            _cleanup_seed_users(session, seeded_user_ids)
        app.dependency_overrides.clear()
        client.close()
        session.close()


def test_reading_lab_tutor_can_update_student_support_plan() -> None:
    previous_flag = settings.reading_lab_enabled
    settings.reading_lab_enabled = True
    Base.metadata.create_all(bind=engine)

    session = SessionLocal()
    client = _make_client(session)
    seeded_user_ids: tuple[UUID, UUID] | None = None
    try:
        student = User(
            email=f"readinglab-plan-student-{uuid4()}@learnable.test",
            password_hash="integration-test-hash",
            role=UserRole.ROLE_STUDENT,
            student_age_years=11,
        )
        tutor = User(
            email=f"readinglab-plan-tutor-{uuid4()}@learnable.test",
            password_hash="integration-test-hash",
            role=UserRole.ROLE_TUTOR,
        )
        session.add_all([student, tutor])
        session.flush()
        session.add(
            TeacherQuestionnaire(
                student_user_id=student.id,
                tutor_user_id=tutor.id,
                attention_score=65,
                engagement_score=70,
                notes="Needs letter+digit focus",
                cadence_days=14,
            )
        )
        session.commit()
        seeded_user_ids = (student.id, tutor.id)

        tutor_headers = {
            "Authorization": f"Bearer {create_access_token(tutor.id, str(tutor.role), tutor.email)}",
            "x-lang": "en",
        }

        update_response = client.put(
            f"/reading-lab/support/students/{student.id}",
            headers=tutor_headers,
            json={
                "status": "ACTIVE",
                "notes": "Teacher adjusted this from dashboard",
                "focus_targets": ["b", "d", "4"],
            },
        )
        assert update_response.status_code == 200
        assert update_response.json()["status"] == "ACTIVE"
        assert "b" in update_response.json()["focus_targets"]

        get_response = client.get(f"/reading-lab/support/students/{student.id}", headers=tutor_headers)
        assert get_response.status_code == 200
        assert get_response.json()["status"] == "ACTIVE"
        assert "4" in get_response.json()["focus_targets"]
    finally:
        settings.reading_lab_enabled = previous_flag
        if seeded_user_ids is not None:
            _cleanup_seed_users(session, seeded_user_ids)
        app.dependency_overrides.clear()
        client.close()
        session.close()


def test_reading_lab_support_and_session_flow() -> None:
    previous_flag = settings.reading_lab_enabled
    settings.reading_lab_enabled = True
    Base.metadata.create_all(bind=engine)

    session = SessionLocal()
    client = _make_client(session)
    seeded_user_ids: tuple[UUID, UUID, UUID] | None = None
    try:
        student_token, parent_token, psych_token, seeded_user_ids = _seed_reading_lab_data(session)
        student_user_id = seeded_user_ids[0]
        student_headers = {"Authorization": f"Bearer {student_token}", "x-lang": "en"}
        parent_headers = {"Authorization": f"Bearer {parent_token}", "x-lang": "en"}
        psych_headers = {"Authorization": f"Bearer {psych_token}", "x-lang": "en"}

        parent_children = client.get("/reading-lab/children", headers=parent_headers)
        assert parent_children.status_code == 200
        child = parent_children.json()["items"][0]
        student_id = child["student_user_id"]

        psych_children = client.get("/reading-lab/children", headers=psych_headers)
        assert psych_children.status_code == 200
        assert psych_children.json()["items"][0]["student_user_id"] == student_id

        psych_update_plan = client.put(
            f"/reading-lab/support/students/{student_id}",
            headers=psych_headers,
            json={
                "status": "ACTIVE",
                "notes": "Structured reading support is recommended.",
                "focus_targets": ["b", "sun"],
            },
        )
        assert psych_update_plan.status_code == 200

        review_after_psych_update = client.get(
            f"/psychologist/reviews/students/{student_id}",
            headers=psych_headers,
        )
        assert review_after_psych_update.status_code == 200
        assert review_after_psych_update.json()["support_confirmation"] is not None

        parent_notifications = client.get("/notifications", headers=parent_headers)
        assert parent_notifications.status_code == 200
        assert any(
            item["type"] == "PSYCHOLOGIST_SUPPORT_CONFIRMED"
            for item in parent_notifications.json()["items"]
        )

        update_plan = client.put(
            f"/reading-lab/support/students/{student_id}",
            headers=parent_headers,
            json={
                "status": "ACTIVE",
                "notes": "Focus on letters b and d this week.",
                "focus_targets": ["b", "d", "book", "4"],
            },
        )
        assert update_plan.status_code == 200
        assert update_plan.json()["status"] == "ACTIVE"

        summary = client.get("/reading-lab/summary/me", headers=student_headers)
        assert summary.status_code == 200
        summary_payload = summary.json()
        assert summary_payload["prominence"] == "HIGHLY_PROMINENT"
        assert summary_payload["support_active"] is True
        assert "b" in summary_payload["focus_targets"]

        start = client.post(
            "/reading-lab/sessions/start",
            headers=student_headers,
            json={"activity_key": "letter_choice"},
        )
        assert start.status_code == 200
        session_payload = start.json()
        session_id = session_payload["session_id"]
        assert session_payload["total_rounds"] >= 1

        for round_item in session_payload["rounds"]:
            answer = client.post(
                f"/reading-lab/sessions/{session_id}/answer",
                headers=student_headers,
                json={
                    "round_index": round_item["index"],
                    "selected_option_key": round_item["options"][0]["key"],
                },
            )
            assert answer.status_code == 200

        complete = client.post(f"/reading-lab/sessions/{session_id}/complete", headers=student_headers)
        assert complete.status_code == 200
        completion_payload = complete.json()
        assert completion_payload["total_rounds"] == session_payload["total_rounds"]
        assert completion_payload["earned_xp"] >= 0

        repeat_complete = client.post(f"/reading-lab/sessions/{session_id}/complete", headers=student_headers)
        assert repeat_complete.status_code == 200
        transaction_count = session.scalar(
            select(func.count())
            .select_from(PointTransaction)
            .where(
                PointTransaction.user_id == student_user_id,
                PointTransaction.reason == "reading_lab_complete",
            )
        )
        assert transaction_count == 1
    finally:
        settings.reading_lab_enabled = previous_flag
        if seeded_user_ids is not None:
            _cleanup_seed_users(session, seeded_user_ids)
        app.dependency_overrides.clear()
        client.close()
        session.close()
