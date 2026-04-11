from uuid import uuid4

from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker

from app.core.platform_tracks import PlatformTrack
from app.core.roles import UserRole
from app.db.models.links import StudentParentLink
from app.db.models.users import User
from app.main import app
from app.modules.auth.repository import create_user
from app.core.security import hash_password


TEST_DATABASE_URL = "postgresql+psycopg://learnable:learnable@localhost:5433/learnable"
engine = create_engine(TEST_DATABASE_URL, future=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


def test_same_email_can_register_once_per_platform_track() -> None:
    client = TestClient(app)
    email = f"track-split-{uuid4().hex}@example.com"
    password = "TrackSplit123!"

    plus_ten_response = client.post(
        "/auth/register",
        json={
            "email": email,
            "password": password,
            "role": "ROLE_PARENT",
            "platform_track": "PLUS_TEN",
        },
    )
    assert plus_ten_response.status_code == 201
    assert plus_ten_response.json()["platform_track"] == "PLUS_TEN"

    reading_lab_response = client.post(
        "/auth/register",
        json={
            "email": email,
            "password": password,
            "role": "ROLE_PARENT",
            "platform_track": "READING_LAB",
        },
    )
    assert reading_lab_response.status_code == 201
    assert reading_lab_response.json()["platform_track"] == "READING_LAB"


def test_login_rejects_wrong_platform_track_and_accepts_matching_track() -> None:
    client = TestClient(app)
    email = f"track-login-{uuid4().hex}@example.com"
    password = "TrackLogin123!"

    register_response = client.post(
        "/auth/register",
        json={
            "email": email,
            "password": password,
            "role": "ROLE_STUDENT",
            "platform_track": "READING_LAB",
        },
    )
    assert register_response.status_code == 201

    wrong_track_response = client.post(
        "/auth/login",
        json={
            "email": email,
            "password": password,
            "platform_track": "PLUS_TEN",
        },
    )
    assert wrong_track_response.status_code == 401

    correct_track_response = client.post(
        "/auth/login",
        json={
            "email": email,
            "password": password,
            "platform_track": "READING_LAB",
        },
    )
    assert correct_track_response.status_code == 200
    assert correct_track_response.json()["platform_track"] == "READING_LAB"


def test_parent_can_register_with_specific_student_id_in_reading_lab() -> None:
    session = SessionLocal()
    try:
        parent_email = f"parent-link-{uuid4().hex}@example.com"
        student = create_user(
            session=session,
            email=f"kid-link-{uuid4().hex}@example.com",
            password_hash=hash_password("KidLink123!"),
            role=UserRole.ROLE_STUDENT,
            platform_track=PlatformTrack.READING_LAB,
            display_name="Kid Link",
        )
        session.commit()

        client = TestClient(app)
        response = client.post(
            "/auth/register",
            json={
                "email": parent_email,
                "password": "ParentLink123!",
                "role": "ROLE_PARENT",
                "platform_track": "READING_LAB",
                "display_name": "Parent Link",
                "student_id": str(student.id),
            },
        )
        assert response.status_code == 201
        payload = response.json()
        assert payload["platform_track"] == "READING_LAB"
        assert payload["display_name"] == "Parent Link"

        linked_parent = session.scalar(
            select(User).where(
                User.email == parent_email
            )
        )
        assert linked_parent is not None

        link = session.scalar(
            select(StudentParentLink).where(
                StudentParentLink.student_user_id == student.id,
                StudentParentLink.parent_user_id == linked_parent.id,
            )
        )
        assert link is not None
    finally:
        session.close()
