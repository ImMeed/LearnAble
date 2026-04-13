import os
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.roles import UserRole
from app.core.security import hash_password
from app.db.base import Base
from app.db.models.economy import PointsWallet
from app.db.models.users import User
from app.db.session import get_db_session
from app.main import app

TEST_DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+psycopg://learnable:learnable@localhost:5433/learnable",
)

engine = create_engine(TEST_DATABASE_URL, future=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
Base.metadata.create_all(bind=engine)


def _make_client(session: Session) -> TestClient:
    def override_get_db_session():
        yield session

    app.dependency_overrides[get_db_session] = override_get_db_session
    return TestClient(app)


def _seed_psychologist_user(session: Session, email: str, password: str) -> None:
    user = User(
        email=email,
        password_hash=hash_password(password),
        role=UserRole.ROLE_PSYCHOLOGIST,
    )
    session.add(user)
    session.flush()
    session.add(PointsWallet(user_id=user.id, balance_points=0))
    session.commit()


def _provision_and_login(client: TestClient, session: Session, role: str) -> dict[str, str]:
    email = f"{role.lower()}-{uuid4().hex}@example.com"
    password = "RoleFlowPass123!"

    if role == "ROLE_PSYCHOLOGIST":
        _seed_psychologist_user(session, email, password)
    else:
        register_response = client.post(
            "/auth/register",
            json={"email": email, "password": password, "role": role},
        )
        assert register_response.status_code == 200
        register_payload = register_response.json()
        assert register_payload["role"] == role
        assert register_payload["token_type"] == "bearer"

    login_response = client.post(
        "/auth/login",
        json={"email": email, "password": password},
    )
    assert login_response.status_code == 200
    login_payload = login_response.json()
    assert login_payload["role"] == role
    assert login_payload["token_type"] == "bearer"

    return {
        "email": email,
        "password": password,
        "access_token": login_payload["access_token"],
    }


@pytest.mark.parametrize(
    "role, own_profile_path",
    [
        ("ROLE_STUDENT", "/student/profile"),
        # The teacher role is represented as ROLE_TUTOR in the backend model.
        ("ROLE_TUTOR", "/tutor/profile"),
        ("ROLE_PARENT", "/parent/profile"),
        ("ROLE_PSYCHOLOGIST", "/psychologist/profile"),
    ],
)
def test_role_user_workflow_register_login_and_own_profile_access(
    role: str,
    own_profile_path: str,
) -> None:
    session = SessionLocal()
    client = _make_client(session)
    try:
        auth = _provision_and_login(client, session, role)
        headers = {
            "Authorization": f"Bearer {auth['access_token']}",
            "x-lang": "en",
        }

        me_response = client.get("/me", headers=headers)
        assert me_response.status_code == 200
        me_payload = me_response.json()
        assert me_payload["email"] == auth["email"]
        assert me_payload["role"] == role

        own_profile_response = client.get(own_profile_path, headers=headers)
        assert own_profile_response.status_code == 200
        own_profile_payload = own_profile_response.json()
        assert own_profile_payload["email"] == auth["email"]
        assert own_profile_payload["role"] == role
    finally:
        app.dependency_overrides.clear()
        client.close()
        session.close()


@pytest.mark.parametrize(
    "role, forbidden_profile_path",
    [
        ("ROLE_STUDENT", "/parent/profile"),
        ("ROLE_TUTOR", "/psychologist/profile"),
        ("ROLE_PARENT", "/tutor/profile"),
        ("ROLE_PSYCHOLOGIST", "/student/profile"),
    ],
)
def test_role_user_workflow_blocks_cross_role_profile_access(
    role: str,
    forbidden_profile_path: str,
) -> None:
    session = SessionLocal()
    client = _make_client(session)
    try:
        auth = _provision_and_login(client, session, role)
        headers = {
            "Authorization": f"Bearer {auth['access_token']}",
            "x-lang": "en",
        }

        forbidden_response = client.get(forbidden_profile_path, headers=headers)
        assert forbidden_response.status_code == 403
        payload = forbidden_response.json()
        assert payload["code"] == "ROLE_MISMATCH"
    finally:
        app.dependency_overrides.clear()
        client.close()
        session.close()