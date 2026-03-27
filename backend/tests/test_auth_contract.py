from fastapi.testclient import TestClient

from app.main import app


def test_register_requires_valid_payload() -> None:
    client = TestClient(app)
    response = client.post("/auth/register", json={})
    assert response.status_code == 422
