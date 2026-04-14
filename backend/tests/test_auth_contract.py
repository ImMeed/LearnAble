from fastapi.testclient import TestClient
from uuid import uuid4

from app.main import app


def test_register_requires_valid_payload() -> None:
    client = TestClient(app)
    response = client.post("/auth/register", json={})
    assert response.status_code == 422


def test_register_accepts_password_over_72_bytes_with_supported_bcrypt_runtime() -> None:
    from unittest.mock import patch
    from app.core.roles import UserRole
    from app.modules.auth.schemas import AuthResponse

    client = TestClient(app)
    unique_email = f"long-password-register-{uuid4().hex}@example.com"
    long_strong_password = "Secure@1" + "a" * 65  # 73 chars, passes strength validation

    fake_response = AuthResponse(
        access_token="fake-token",
        token_type="bearer",
        role=UserRole.ROLE_STUDENT,
    )
    with patch("app.modules.auth.service.register_user", return_value=fake_response):
        response = client.post(
            "/auth/register",
            json={
                "email": unique_email,
                "password": long_strong_password,
                "role": "ROLE_STUDENT",
            },
        )
    assert response.status_code == 201


def test_register_blocks_admin_role_self_registration() -> None:
    client = TestClient(app)
    response = client.post(
        "/auth/register",
        json={
            "email": "blocked-admin-register@example.com",
            "password": "Secure@123",
            "role": "ROLE_ADMIN",
        },
    )
    assert response.status_code == 403
