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


def _seed_phase8_users(session: Session) -> tuple[str, str, str, str, str]:
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
    psychologist = User(
        email=f"phase8-psychologist-{uuid4()}@learnable.test",
        password_hash="integration-test-hash",
        role=UserRole.ROLE_PSYCHOLOGIST,
    )
    session.add_all([student, tutor, parent, admin, psychologist])
    session.commit()

    return (
        create_access_token(student.id, str(student.role), student.email),
        create_access_token(tutor.id, str(tutor.role), tutor.email),
        create_access_token(parent.id, str(parent.role), parent.email),
        create_access_token(admin.id, str(admin.role), admin.email),
        create_access_token(psychologist.id, str(psychologist.role), psychologist.email),
    )


def test_phase8_forum_collaboration_and_moderation_flow() -> None:
    session = SessionLocal()
    client = _make_client(session)
    try:
        student_token, tutor_token, parent_token, admin_token, psychologist_token = _seed_phase8_users(session)
        student_headers = {"Authorization": f"Bearer {student_token}", "x-lang": "en"}
        tutor_headers = {"Authorization": f"Bearer {tutor_token}", "x-lang": "en"}
        parent_headers = {"Authorization": f"Bearer {parent_token}", "x-lang": "en"}
        admin_headers = {"Authorization": f"Bearer {admin_token}", "x-lang": "en"}
        psychologist_headers = {"Authorization": f"Bearer {psychologist_token}", "x-lang": "en"}

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

        student_resources_forbidden = client.post(
            "/forum/posts",
            headers=student_headers,
            json={
                "category": "resources",
                "title": "Student resources request",
                "content": "Can students post here?",
            },
        )
        assert student_resources_forbidden.status_code == 403
        forbidden_payload = student_resources_forbidden.json()
        forbidden_code = (
            forbidden_payload.get("detail", {}).get("code")
            if isinstance(forbidden_payload.get("detail"), dict)
            else forbidden_payload.get("code")
        )
        assert forbidden_code == "FORUM_CATEGORY_FORBIDDEN"

        parent_tips_post = client.post(
            "/forum/posts",
            headers=parent_headers,
            json={
                "category": "tips",
                "title": "Parent study tip",
                "content": "Short daily reading blocks helped us.",
            },
        )
        assert parent_tips_post.status_code == 200

        tutor_resources_post = client.post(
            "/forum/posts",
            headers=tutor_headers,
            json={
                "category": "resources",
                "title": "Teacher resource",
                "content": "Use guided reading checklists.",
            },
        )
        assert tutor_resources_post.status_code == 200
        tutor_resource_post_id = tutor_resources_post.json()["id"]

        ask_posts: list[str] = []
        for idx in range(11):
            response = client.post(
                "/forum/posts",
                headers=student_headers,
                json={
                    "category": "ask",
                    "title": f"Question {idx}",
                    "content": f"I need help with topic {idx}",
                },
            )
            assert response.status_code == 200
            ask_posts.append(response.json()["id"])

        first_ask_id = ask_posts[0]
        reply_response = client.post(
            f"/forum/posts/{first_ask_id}/reply",
            headers=tutor_headers,
            json={"content": "Start with smaller chunks and a timer."},
        )
        assert reply_response.status_code == 200
        assert reply_response.json()["author"]["role"] == "ROLE_TUTOR"

        detail_response = client.get(f"/forum/posts/{first_ask_id}", headers=student_headers)
        assert detail_response.status_code == 200
        assert detail_response.json()["post"]["reply_count"] == 1
        assert len(detail_response.json()["replies"]) == 1

        tutor_pin_response = client.patch(
            f"/forum/posts/{tutor_resource_post_id}/pin",
            headers=tutor_headers,
            json={"is_pinned": True},
        )
        assert tutor_pin_response.status_code == 200
        assert tutor_pin_response.json()["is_pinned"] is True

        parent_pin_forbidden = client.patch(
            f"/forum/posts/{tutor_resource_post_id}/pin",
            headers=parent_headers,
            json={"is_pinned": False},
        )
        assert parent_pin_forbidden.status_code == 403

        psychologist_unpin_response = client.patch(
            f"/forum/posts/{tutor_resource_post_id}/pin",
            headers=psychologist_headers,
            json={"is_pinned": False},
        )
        assert psychologist_unpin_response.status_code == 200
        assert psychologist_unpin_response.json()["is_pinned"] is False

        paged_ask_response = client.get("/forum/posts?category=ask&page=5&page_size=10", headers=student_headers)
        assert paged_ask_response.status_code == 200
        ask_payload = paged_ask_response.json()
        assert ask_payload["total"] >= 11
        assert ask_payload["page"] == ask_payload["total_pages"]
        assert 1 <= len(ask_payload["items"]) <= 10

        resources_feed_response = client.get("/forum/posts?category=resources&page=1&page_size=10", headers=tutor_headers)
        assert resources_feed_response.status_code == 200
        assert resources_feed_response.json()["items"][0]["can_pin"] is True
    finally:
        app.dependency_overrides.clear()
        client.close()
        session.close()
