from uuid import UUID, uuid4

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.roles import UserRole
from app.core.security import create_access_token
from app.db.base import Base
from app.db.models.links import StudentParentLink, StudentPsychologistLink
from app.db.models.study import StudentScreening
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


def _seed_phase7_data(session: Session) -> tuple[str, str, str, UUID]:
    student = User(
        email=f"phase7-student-{uuid4()}@learnable.test",
        password_hash="integration-test-hash",
        role=UserRole.ROLE_STUDENT,
    )
    parent = User(
        email=f"phase7-parent-{uuid4()}@learnable.test",
        password_hash="integration-test-hash",
        role=UserRole.ROLE_PARENT,
    )
    tutor = User(
        email=f"phase7-tutor-{uuid4()}@learnable.test",
        password_hash="integration-test-hash",
        role=UserRole.ROLE_TUTOR,
    )
    psychologist = User(
        email=f"phase7-psych-{uuid4()}@learnable.test",
        password_hash="integration-test-hash",
        role=UserRole.ROLE_PSYCHOLOGIST,
    )
    session.add_all([student, parent, tutor, psychologist])
    session.flush()

    session.add(StudentParentLink(student_user_id=student.id, parent_user_id=parent.id))
    session.add(StudentPsychologistLink(student_user_id=student.id, psychologist_user_id=psychologist.id))
    session.add(
        StudentScreening(
            user_id=student.id,
            focus_score=40,
            reading_score=55,
            memory_score=50,
            support_level="MEDIUM",
            indicators_json={"policy": "educational_signals_only_no_diagnosis"},
        )
    )
    session.commit()

    student_token = create_access_token(student.id, str(student.role), student.email)
    parent_token = create_access_token(parent.id, str(parent.role), parent.email)
    tutor_token = create_access_token(tutor.id, str(tutor.role), tutor.email)
    psych_token = create_access_token(psychologist.id, str(psychologist.role), psychologist.email)
    _ = student_token

    return parent_token, tutor_token, psych_token, student.id


def test_phase7_parent_notified_only_after_psychologist_confirmation() -> None:
    session = SessionLocal()
    client = _make_client(session)
    try:
        parent_token, tutor_token, psych_token, student_id = _seed_phase7_data(session)
        parent_headers = {"Authorization": f"Bearer {parent_token}", "x-lang": "en"}
        tutor_headers = {"Authorization": f"Bearer {tutor_token}", "x-lang": "en"}
        psych_headers = {"Authorization": f"Bearer {psych_token}", "x-lang": "en"}

        before_notifications = client.get("/notifications", headers=parent_headers)
        assert before_notifications.status_code == 200
        assert before_notifications.json()["items"] == []

        questionnaire_response = client.post(
            f"/psychologist/questionnaires/students/{student_id}",
            headers=tutor_headers,
            json={
                "attention_score": 45,
                "engagement_score": 60,
                "notes": "Bi-weekly check-in summary",
                "cadence_days": 14,
            },
        )
        assert questionnaire_response.status_code == 200

        review_response = client.get(f"/psychologist/reviews/students/{student_id}", headers=psych_headers)
        assert review_response.status_code == 200
        review_data = review_response.json()
        assert review_data["screening_summary"] is not None
        assert review_data["latest_questionnaire"] is not None

        confirm_response = client.post(
            f"/psychologist/support/{student_id}/confirm",
            headers=psych_headers,
            json={"support_level": "MEDIUM", "notes": "Structured support plan approved."},
        )
        assert confirm_response.status_code == 200
        assert confirm_response.json()["parent_notifications_sent"] == 1

        after_notifications = client.get("/notifications", headers=parent_headers)
        assert after_notifications.status_code == 200
        items = after_notifications.json()["items"]
        assert len(items) == 1
        assert items[0]["type"] == "PSYCHOLOGIST_SUPPORT_CONFIRMED"

        read_response = client.patch(
            f"/notifications/{items[0]['id']}/read",
            headers=parent_headers,
        )
        assert read_response.status_code == 200
        assert read_response.json()["is_read"] is True
    finally:
        app.dependency_overrides.clear()
        client.close()
        session.close()
