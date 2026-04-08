from uuid import uuid4

from fastapi.testclient import TestClient

from app.main import app


def test_quiz_start_requires_auth() -> None:
    client = TestClient(app)
    response = client.post(f"/quizzes/{uuid4()}/start")
    assert response.status_code == 401


def test_quiz_submit_requires_auth() -> None:
    client = TestClient(app)
    response = client.post(
        f"/quizzes/{uuid4()}/submit",
        json={"attempt_id": str(uuid4()), "answers": []},
    )
    assert response.status_code == 401


def test_quiz_hint_requires_auth() -> None:
    client = TestClient(app)
    response = client.post(
        f"/quizzes/{uuid4()}/hint",
        json={"question_id": str(uuid4())},
    )
    assert response.status_code == 401


def test_quiz_play_init_requires_auth() -> None:
    client = TestClient(app)
    response = client.post(f"/quizzes/{uuid4()}/play/init")
    assert response.status_code == 401


def test_quiz_play_answer_requires_auth() -> None:
    client = TestClient(app)
    response = client.post(
        f"/quizzes/{uuid4()}/play/answer",
        json={"attempt_id": str(uuid4()), "answers": []},
    )
    assert response.status_code == 401
