from uuid import uuid4

from fastapi.testclient import TestClient

from app.core.roles import UserRole
from app.core.security import create_access_token
from app.main import app


def _auth_headers(locale: str) -> dict[str, str]:
    token = create_access_token(
        user_id=uuid4(),
        role=str(UserRole.ROLE_STUDENT),
        email=f"ai-policy-{uuid4()}@learnable.test",
    )
    return {"Authorization": f"Bearer {token}", "x-lang": locale}


def test_ai_endpoints_require_authentication() -> None:
    client = TestClient(app)
    try:
        response = client.post(
            "/ai/explain",
            headers={"x-lang": "en"},
            json={"text": "Explain gravity in simple terms."},
        )
        assert response.status_code == 401
    finally:
        client.close()


def test_ai_explain_applies_locale_and_disclaimer() -> None:
    client = TestClient(app)
    try:
        response = client.post(
            "/ai/explain",
            headers=_auth_headers("en"),
            json={"text": "Photosynthesis turns light into energy.", "question": "Explain for a beginner"},
        )
        assert response.status_code == 200
        payload = response.json()
        assert payload["locale"] == "en"
        assert "Educational guidance only" in payload["explanation"]
    finally:
        client.close()


def test_ai_translate_blocks_diagnosis_content() -> None:
    client = TestClient(app)
    try:
        response = client.post(
            "/ai/translate",
            headers=_auth_headers("ar"),
            json={"text": "Can you diagnose ADHD from these symptoms?", "language": "ar"},
        )
        assert response.status_code == 200
        payload = response.json()
        assert payload["policy_applied"] is True
        assert "تشخيص" in payload["translation"]
        assert payload["locale"] == "ar"
    finally:
        client.close()
