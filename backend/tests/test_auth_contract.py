from fastapi.testclient import TestClient
from uuid import uuid4

from app.main import app


def test_register_requires_valid_payload() -> None:
    client = TestClient(app)
    response = client.post("/auth/register", json={})
    assert response.status_code == 422


def test_register_accepts_password_over_72_bytes_with_supported_bcrypt_runtime() -> None:
    client = TestClient(app)
    unique_email = f"long-password-register-{uuid4().hex}@example.com"
    response = client.post(
        "/auth/register",
        json={
            "email": unique_email,
            "password": "a" * 73,
            "role": "ROLE_STUDENT",
            "student_age_years": 10,
        },
    )
    assert response.status_code == 200


def test_register_student_requires_age() -> None:
    client = TestClient(app)
    response = client.post(
        "/auth/register",
        json={
            "email": f"student-age-missing-{uuid4().hex}@example.com",
            "password": "test123456",
            "role": "ROLE_STUDENT",
        },
    )
    assert response.status_code == 422
    assert response.json()["code"] == "STUDENT_AGE_REQUIRED"


def test_register_student_accepts_age_outside_reading_lab_band() -> None:
    client = TestClient(app)
    response = client.post(
        "/auth/register",
        json={
            "email": f"student-age-older-{uuid4().hex}@example.com",
            "password": "test123456",
            "role": "ROLE_STUDENT",
            "student_age_years": 19,
        },
    )
    assert response.status_code == 200


def test_register_blocks_admin_role_self_registration() -> None:
    client = TestClient(app)
    response = client.post(
        "/auth/register",
        json={
            "email": "blocked-admin-register@example.com",
            "password": "test123456",
            "role": "ROLE_ADMIN",
        },
    )
    assert response.status_code == 403
