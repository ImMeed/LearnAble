from uuid import UUID, uuid4

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.roles import UserRole
from app.core.security import create_access_token
from app.db.base import Base
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


def _seed_phase8_users(session: Session) -> tuple[str, str, str, str]:
    student = User(
        email=f"phase8-student-{uuid4()}@learnable.test",
        password_hash="integration-test-hash",
        role=UserRole.ROLE_STUDENT,
    )
    tutor = User(
        email=f"phase8-tutor-{uuid4()}@learnable.test",
        password_hash="integration-test-hash",
        role=UserRole.ROLE_TUTOR,
    )
    parent = User(
        email=f"phase8-parent-{uuid4()}@learnable.test",
        password_hash="integration-test-hash",
        role=UserRole.ROLE_PARENT,
    )
    admin = User(
        email=f"phase8-admin-{uuid4()}@learnable.test",
        password_hash="integration-test-hash",
        role=UserRole.ROLE_ADMIN,
    )
    session.add_all([student, tutor, parent, admin])
    session.commit()

    return (
        create_access_token(student.id, str(student.role), student.email),
        create_access_token(tutor.id, str(tutor.role), tutor.email),
        create_access_token(parent.id, str(parent.role), parent.email),
        create_access_token(admin.id, str(admin.role), admin.email),
    )


def test_phase8_forum_collaboration_and_moderation_flow() -> None:
    session = SessionLocal()
    client = _make_client(session)
    try:
        student_token, tutor_token, parent_token, admin_token = _seed_phase8_users(session)
        student_headers = {"Authorization": f"Bearer {student_token}", "x-lang": "en"}
        tutor_headers = {"Authorization": f"Bearer {tutor_token}", "x-lang": "en"}
        parent_headers = {"Authorization": f"Bearer {parent_token}", "x-lang": "en"}
        admin_headers = {"Authorization": f"Bearer {admin_token}", "x-lang": "en"}

        create_space_response = client.post(
            "/forum/spaces",
            headers=admin_headers,
            json={
                "slug": f"phase8-space-{uuid4().hex[:8]}",
                "name_ar": "مساحة نقاش",
                "name_en": "Discussion Space",
                "description_ar": "وصف المساحة",
                "description_en": "Space description",
            },
        )
        assert create_space_response.status_code == 200
        space_id = create_space_response.json()["id"]

        create_post_response = client.post(
            f"/forum/spaces/{space_id}/posts",
            headers=student_headers,
            json={"title": "Need study tips", "content": "How can I improve reading pace?"},
        )
        assert create_post_response.status_code == 200
        post_id = create_post_response.json()["id"]

        create_comment_response = client.post(
            f"/forum/posts/{post_id}/comments",
            headers=tutor_headers,
            json={"content": "Use short timed reading sessions and track progress."},
        )
        assert create_comment_response.status_code == 200
        comment_id = create_comment_response.json()["id"]
        _ = comment_id

        vote_response = client.post(
            "/forum/votes",
            headers=student_headers,
            json={"target_type": "POST", "target_id": post_id, "value": 1},
        )
        assert vote_response.status_code == 200
        assert vote_response.json()["upvotes"] == 1

        report_response = client.post(
            "/forum/reports",
            headers=parent_headers,
            json={"target_type": "POST", "target_id": post_id, "reason": "Needs moderator check."},
        )
        assert report_response.status_code == 200
        report_id = report_response.json()["id"]

        list_reports_response = client.get("/forum/reports", headers=tutor_headers)
        assert list_reports_response.status_code == 200
        assert any(item["id"] == report_id for item in list_reports_response.json()["items"])

        moderate_response = client.post(
            f"/forum/reports/{report_id}/moderate",
            headers=tutor_headers,
            json={"action": "HIDE", "review_notes": "Temporarily hidden pending review."},
        )
        assert moderate_response.status_code == 200
        assert moderate_response.json()["report_status"] == "RESOLVED"

        visible_posts_response = client.get(f"/forum/spaces/{space_id}/posts", headers=student_headers)
        assert visible_posts_response.status_code == 200
        assert visible_posts_response.json()["items"] == []

        moderated_posts_response = client.get(
            f"/forum/spaces/{space_id}/posts?include_moderated=true",
            headers=tutor_headers,
        )
        assert moderated_posts_response.status_code == 200
        assert len(moderated_posts_response.json()["items"]) == 1
        assert moderated_posts_response.json()["items"][0]["status"] == "HIDDEN"
    finally:
        app.dependency_overrides.clear()
        client.close()
        session.close()
