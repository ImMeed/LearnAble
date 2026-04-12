from datetime import datetime, timezone
from uuid import uuid4

from fastapi import UploadFile
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from starlette.datastructures import Headers

from app.core.roles import UserRole
from app.core.security import CurrentUser, create_access_token
from app.db.base import Base
from app.db.models.course import CourseStatus
from app.db.models.users import User
from app.db.session import get_db_session
from app.main import app
from app.modules.ai.repository import GeminiError, GeminiParseError
from app.modules.courses import repository as courses_repository
from app.modules.courses.schemas import CourseStructureUpdate
from app.modules.courses.service import (
    create_course_from_pdf,
    delete_course,
    get_published_course,
    publish_course,
    update_course_structure,
)

TEST_DATABASE_URL = "postgresql+psycopg://learnable:learnable@localhost:5433/learnable"

engine = create_engine(TEST_DATABASE_URL, future=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
Base.metadata.create_all(bind=engine)

_FAKE_STRUCTURE = {
    "page_count": 3,
    "chapters": [
        {
            "title": "Chapter 1",
            "sections": [
                {
                    "title": "Section 1.1",
                    "content": "Body of 1.1",
                    "subsections": [
                        {"title": "Sub 1.1.1", "content": "Deep text"},
                    ],
                }
            ],
        }
    ],
}


def _make_client(session: Session) -> TestClient:
    def override_get_db_session():
        yield session

    app.dependency_overrides[get_db_session] = override_get_db_session
    return TestClient(app)


def _seed_user(session: Session, role: UserRole, prefix: str) -> User:
    user = User(
        email=f"{prefix}-{uuid4()}@learnable.test",
        password_hash="integration-test-hash",
        role=role,
    )
    session.add(user)
    session.flush()
    return user


def _headers_for(user: User, locale: str = "en") -> dict[str, str]:
    token = create_access_token(user.id, str(user.role), user.email)
    return {"Authorization": f"Bearer {token}", "x-lang": locale}


def _make_upload_file(
    content: bytes,
    filename: str = "test.pdf",
    content_type: str = "application/pdf",
) -> UploadFile:
    return UploadFile(
        file=__import__("io").BytesIO(content),
        filename=filename,
        headers=Headers({"content-type": content_type}),
    )


def _current_user(user: User) -> CurrentUser:
    return CurrentUser(user_id=user.id, role=str(user.role), email=user.email)


def test_create_course_round_trip() -> None:
    session = SessionLocal()
    try:
        owner = _seed_user(session, UserRole.ROLE_TUTOR, "repo-owner")
        course = courses_repository.create_course(
            session,
            owner_id=owner.id,
            title="Intro Algebra",
            language="en",
            source_filename="algebra.pdf",
            source_page_count=3,
            structure_json={"chapters": [{"id": "c1", "title": "A", "sections": []}]},
        )
        fetched = courses_repository.get_course_by_id(session, course.id)
        assert fetched is not None
        assert fetched.title == "Intro Algebra"
        assert fetched.language == "en"
        assert fetched.structure_json["chapters"][0]["id"] == "c1"
    finally:
        session.rollback()
        session.close()


def test_list_courses_by_owner() -> None:
    session = SessionLocal()
    try:
        owner_a = _seed_user(session, UserRole.ROLE_TUTOR, "repo-owner-a")
        owner_b = _seed_user(session, UserRole.ROLE_TUTOR, "repo-owner-b")
        session.flush()
        for idx in range(3):
            courses_repository.create_course(
                session,
                owner_id=owner_a.id,
                title=f"A-{idx}",
                language="en",
                source_filename=f"a-{idx}.pdf",
                source_page_count=1,
                structure_json={"chapters": []},
            )
        courses_repository.create_course(
            session,
            owner_id=owner_b.id,
            title="B-0",
            language="en",
            source_filename="b-0.pdf",
            source_page_count=1,
            structure_json={"chapters": []},
        )
        session.flush()

        owner_a_courses = courses_repository.list_courses_by_owner(session, owner_a.id)
        owner_b_courses = courses_repository.list_courses_by_owner(session, owner_b.id)
        assert len(owner_a_courses) == 3
        assert len(owner_b_courses) == 1
        assert owner_a_courses[0].created_at >= owner_a_courses[1].created_at >= owner_a_courses[2].created_at
    finally:
        session.rollback()
        session.close()


def test_list_published_courses_filters_drafts() -> None:
    session = SessionLocal()
    try:
        owner = _seed_user(session, UserRole.ROLE_TUTOR, "repo-pub-owner")
        draft = courses_repository.create_course(
            session,
            owner_id=owner.id,
            title="Draft",
            language="en",
            source_filename="draft.pdf",
            source_page_count=1,
            structure_json={"chapters": []},
        )
        published = courses_repository.create_course(
            session,
            owner_id=owner.id,
            title="Published",
            language="en",
            source_filename="published.pdf",
            source_page_count=1,
            structure_json={"chapters": []},
        )
        courses_repository.update_course(session, published, status=CourseStatus.PUBLISHED.value)
        session.flush()

        listed = courses_repository.list_published_courses(session)
        owner_listed = [c for c in listed if c.owner_user_id == owner.id]
        assert [c.id for c in owner_listed] == [published.id]
        assert draft.id not in [c.id for c in owner_listed]
    finally:
        session.rollback()
        session.close()


def test_list_published_courses_language_filter() -> None:
    session = SessionLocal()
    try:
        owner = _seed_user(session, UserRole.ROLE_TUTOR, "repo-lang-owner")
        ar_course = courses_repository.create_course(
            session,
            owner_id=owner.id,
            title="Arabic",
            language="ar",
            source_filename="ar.pdf",
            source_page_count=1,
            structure_json={"chapters": []},
        )
        en_course = courses_repository.create_course(
            session,
            owner_id=owner.id,
            title="English",
            language="en",
            source_filename="en.pdf",
            source_page_count=1,
            structure_json={"chapters": []},
        )
        courses_repository.update_course(session, ar_course, status=CourseStatus.PUBLISHED.value)
        courses_repository.update_course(session, en_course, status=CourseStatus.PUBLISHED.value)
        session.flush()

        listed = courses_repository.list_published_courses(session, language="ar")
        owner_listed = [c for c in listed if c.owner_user_id == owner.id]
        assert [c.id for c in owner_listed] == [ar_course.id]
    finally:
        session.rollback()
        session.close()


def test_update_course() -> None:
    session = SessionLocal()
    try:
        owner = _seed_user(session, UserRole.ROLE_TUTOR, "repo-update-owner")
        course = courses_repository.create_course(
            session,
            owner_id=owner.id,
            title="Old",
            language="en",
            source_filename="x.pdf",
            source_page_count=1,
            structure_json={"chapters": []},
        )
        courses_repository.update_course(session, course, title="New")
        fetched = courses_repository.get_course_by_id(session, course.id)
        assert fetched is not None
        assert fetched.title == "New"
    finally:
        session.rollback()
        session.close()


def test_delete_course() -> None:
    session = SessionLocal()
    try:
        owner = _seed_user(session, UserRole.ROLE_TUTOR, "repo-delete-owner")
        course = courses_repository.create_course(
            session,
            owner_id=owner.id,
            title="Delete me",
            language="en",
            source_filename="x.pdf",
            source_page_count=1,
            structure_json={"chapters": []},
        )
        courses_repository.delete_course(session, course)
        assert courses_repository.get_course_by_id(session, course.id) is None
    finally:
        session.rollback()
        session.close()


def test_create_course_happy_path(monkeypatch) -> None:
    session = SessionLocal()
    try:
        owner = _seed_user(session, UserRole.ROLE_TUTOR, "svc-happy-owner")
        monkeypatch.setattr("app.modules.ai.repository.extract_course_structure", lambda *_: dict(_FAKE_STRUCTURE))
        file = _make_upload_file(b"%PDF-1.4 fake")
        response = __import__("asyncio").run(
            create_course_from_pdf(session, _current_user(owner), file=file, title="Course A", language="en")
        )
        assert response.status == "DRAFT"
        assert response.source_page_count == 3
        assert response.structure_json["chapters"][0]["id"] == "c1"
        assert response.structure_json["chapters"][0]["sections"][0]["id"] == "c1s1"
        assert response.structure_json["chapters"][0]["sections"][0]["subsections"][0]["id"] == "c1s1_1"
    finally:
        session.rollback()
        session.close()


def test_create_course_rejects_non_pdf(monkeypatch) -> None:
    session = SessionLocal()
    try:
        owner = _seed_user(session, UserRole.ROLE_TUTOR, "svc-nonpdf-owner")
        monkeypatch.setattr("app.modules.ai.repository.extract_course_structure", lambda *_: dict(_FAKE_STRUCTURE))
        file = _make_upload_file(b"plain text", filename="bad.txt", content_type="text/plain")
        try:
            __import__("asyncio").run(
                create_course_from_pdf(session, _current_user(owner), file=file, title="Course A", language="en")
            )
            assert False, "expected HTTPException"
        except Exception as exc:
            assert getattr(exc, "status_code", None) == 400
    finally:
        session.rollback()
        session.close()


def test_create_course_rejects_oversize(monkeypatch) -> None:
    session = SessionLocal()
    try:
        owner = _seed_user(session, UserRole.ROLE_TUTOR, "svc-oversize-owner")
        monkeypatch.setattr("app.modules.ai.repository.extract_course_structure", lambda *_: dict(_FAKE_STRUCTURE))
        file = _make_upload_file(b"\x00" * (10 * 1024 * 1024 + 1))
        try:
            __import__("asyncio").run(
                create_course_from_pdf(session, _current_user(owner), file=file, title="Course A", language="en")
            )
            assert False, "expected HTTPException"
        except Exception as exc:
            assert getattr(exc, "status_code", None) == 413
    finally:
        session.rollback()
        session.close()


def test_create_course_rejects_too_many_pages(monkeypatch) -> None:
    session = SessionLocal()
    try:
        owner = _seed_user(session, UserRole.ROLE_TUTOR, "svc-pages-owner")
        structure = dict(_FAKE_STRUCTURE)
        structure["page_count"] = 31
        monkeypatch.setattr("app.modules.ai.repository.extract_course_structure", lambda *_: structure)
        file = _make_upload_file(b"%PDF-1.4 fake")
        try:
            __import__("asyncio").run(
                create_course_from_pdf(session, _current_user(owner), file=file, title="Course A", language="en")
            )
            assert False, "expected HTTPException"
        except Exception as exc:
            assert getattr(exc, "status_code", None) == 413
    finally:
        session.rollback()
        session.close()


def test_create_course_gemini_parse_error(monkeypatch) -> None:
    session = SessionLocal()
    try:
        owner = _seed_user(session, UserRole.ROLE_TUTOR, "svc-parse-owner")

        def _raise(*_args, **_kwargs):
            raise GeminiParseError("bad json")

        monkeypatch.setattr("app.modules.ai.repository.extract_course_structure", _raise)
        file = _make_upload_file(b"%PDF-1.4 fake")
        try:
            __import__("asyncio").run(
                create_course_from_pdf(session, _current_user(owner), file=file, title="Course A", language="en")
            )
            assert False, "expected HTTPException"
        except Exception as exc:
            assert getattr(exc, "status_code", None) == 502
            assert exc.detail["message"] == "Failed to parse course structure, please try again"
    finally:
        session.rollback()
        session.close()


def test_create_course_gemini_error(monkeypatch) -> None:
    session = SessionLocal()
    try:
        owner = _seed_user(session, UserRole.ROLE_TUTOR, "svc-generic-owner")

        def _raise(*_args, **_kwargs):
            raise GeminiError("boom")

        monkeypatch.setattr("app.modules.ai.repository.extract_course_structure", _raise)
        file = _make_upload_file(b"%PDF-1.4 fake")
        try:
            __import__("asyncio").run(
                create_course_from_pdf(session, _current_user(owner), file=file, title="Course A", language="en")
            )
            assert False, "expected HTTPException"
        except Exception as exc:
            assert getattr(exc, "status_code", None) == 502
            assert exc.detail["message"] == "Course analysis service unavailable"
    finally:
        session.rollback()
        session.close()


def test_non_owner_cannot_patch() -> None:
    session = SessionLocal()
    try:
        owner = _seed_user(session, UserRole.ROLE_TUTOR, "svc-owner-a")
        other = _seed_user(session, UserRole.ROLE_TUTOR, "svc-owner-b")
        course = courses_repository.create_course(
            session,
            owner_id=owner.id,
            title="Owner Course",
            language="en",
            source_filename="x.pdf",
            source_page_count=2,
            structure_json={"chapters": []},
        )
        try:
            update_course_structure(
                session,
                _current_user(other),
                course.id,
                CourseStructureUpdate(title="Hack"),
            )
            assert False, "expected HTTPException"
        except Exception as exc:
            assert getattr(exc, "status_code", None) == 403
    finally:
        session.rollback()
        session.close()


def test_non_owner_cannot_delete() -> None:
    session = SessionLocal()
    try:
        owner = _seed_user(session, UserRole.ROLE_TUTOR, "svc-del-owner-a")
        other = _seed_user(session, UserRole.ROLE_TUTOR, "svc-del-owner-b")
        course = courses_repository.create_course(
            session,
            owner_id=owner.id,
            title="Owner Course",
            language="en",
            source_filename="x.pdf",
            source_page_count=2,
            structure_json={"chapters": []},
        )
        try:
            delete_course(session, _current_user(other), course.id)
            assert False, "expected HTTPException"
        except Exception as exc:
            assert getattr(exc, "status_code", None) == 403
    finally:
        session.rollback()
        session.close()


def test_publish_is_idempotent() -> None:
    session = SessionLocal()
    try:
        owner = _seed_user(session, UserRole.ROLE_TUTOR, "svc-pub-owner")
        course = courses_repository.create_course(
            session,
            owner_id=owner.id,
            title="To Publish",
            language="en",
            source_filename="x.pdf",
            source_page_count=2,
            structure_json={"chapters": []},
        )
        first = publish_course(session, _current_user(owner), course.id)
        second = publish_course(session, _current_user(owner), course.id)
        assert first.status == "PUBLISHED"
        assert second.status == "PUBLISHED"
    finally:
        session.rollback()
        session.close()


def test_get_published_course_hides_drafts() -> None:
    session = SessionLocal()
    try:
        owner = _seed_user(session, UserRole.ROLE_TUTOR, "svc-draft-owner")
        course = courses_repository.create_course(
            session,
            owner_id=owner.id,
            title="Draft",
            language="en",
            source_filename="x.pdf",
            source_page_count=2,
            structure_json={"chapters": []},
        )
        try:
            get_published_course(session, course.id)
            assert False, "expected HTTPException"
        except Exception as exc:
            assert getattr(exc, "status_code", None) == 404
    finally:
        session.rollback()
        session.close()


def test_teacher_upload_flow(monkeypatch) -> None:
    session = SessionLocal()
    client = _make_client(session)
    try:
        monkeypatch.setattr("app.modules.ai.repository.extract_course_structure", lambda *_: dict(_FAKE_STRUCTURE))
        teacher = _seed_user(session, UserRole.ROLE_TUTOR, "http-upload-teacher")
        headers = _headers_for(teacher)
        response = client.post(
            "/teacher/courses",
            headers=headers,
            data={"title": "Course Upload", "language": "en"},
            files={"file": ("test.pdf", b"%PDF-1.4 fake", "application/pdf")},
        )
        assert response.status_code == 200
        payload = response.json()
        assert payload["id"]
        assert payload["status"] == "DRAFT"
    finally:
        app.dependency_overrides.clear()
        client.close()
        session.close()


def test_teacher_list_returns_own_courses_only(monkeypatch) -> None:
    session = SessionLocal()
    client = _make_client(session)
    try:
        monkeypatch.setattr("app.modules.ai.repository.extract_course_structure", lambda *_: dict(_FAKE_STRUCTURE))
        teacher_a = _seed_user(session, UserRole.ROLE_TUTOR, "http-list-a")
        teacher_b = _seed_user(session, UserRole.ROLE_TUTOR, "http-list-b")

        client.post(
            "/teacher/courses",
            headers=_headers_for(teacher_a),
            data={"title": "A Course", "language": "en"},
            files={"file": ("a.pdf", b"%PDF-1.4 fake", "application/pdf")},
        )
        client.post(
            "/teacher/courses",
            headers=_headers_for(teacher_b),
            data={"title": "B Course", "language": "en"},
            files={"file": ("b.pdf", b"%PDF-1.4 fake", "application/pdf")},
        )

        list_a = client.get("/teacher/courses", headers=_headers_for(teacher_a))
        list_b = client.get("/teacher/courses", headers=_headers_for(teacher_b))
        assert list_a.status_code == 200 and len(list_a.json()) == 1
        assert list_b.status_code == 200 and len(list_b.json()) == 1
        assert list_a.json()[0]["title"] == "A Course"
        assert list_b.json()[0]["title"] == "B Course"
    finally:
        app.dependency_overrides.clear()
        client.close()
        session.close()


def test_teacher_patch_then_publish(monkeypatch) -> None:
    session = SessionLocal()
    client = _make_client(session)
    try:
        monkeypatch.setattr("app.modules.ai.repository.extract_course_structure", lambda *_: dict(_FAKE_STRUCTURE))
        teacher = _seed_user(session, UserRole.ROLE_TUTOR, "http-patch-teacher")
        student = _seed_user(session, UserRole.ROLE_STUDENT, "http-patch-student")
        teacher_headers = _headers_for(teacher)
        student_headers = _headers_for(student)

        create = client.post(
            "/teacher/courses",
            headers=teacher_headers,
            data={"title": "Original", "language": "en"},
            files={"file": ("test.pdf", b"%PDF-1.4 fake", "application/pdf")},
        )
        course_id = create.json()["id"]

        patch = client.patch(
            f"/teacher/courses/{course_id}",
            headers=teacher_headers,
            json={"title": "Renamed"},
        )
        assert patch.status_code == 200
        assert patch.json()["title"] == "Renamed"

        publish = client.post(f"/teacher/courses/{course_id}/publish", headers=teacher_headers)
        assert publish.status_code == 200
        assert publish.json()["status"] == "PUBLISHED"

        student_get = client.get(f"/courses/{course_id}", headers=student_headers)
        assert student_get.status_code == 200
        assert student_get.json()["id"] == course_id
    finally:
        app.dependency_overrides.clear()
        client.close()
        session.close()


def test_student_cannot_see_draft(monkeypatch) -> None:
    session = SessionLocal()
    client = _make_client(session)
    try:
        monkeypatch.setattr("app.modules.ai.repository.extract_course_structure", lambda *_: dict(_FAKE_STRUCTURE))
        teacher = _seed_user(session, UserRole.ROLE_TUTOR, "http-draft-teacher")
        student = _seed_user(session, UserRole.ROLE_STUDENT, "http-draft-student")

        create = client.post(
            "/teacher/courses",
            headers=_headers_for(teacher),
            data={"title": "Draft", "language": "en"},
            files={"file": ("test.pdf", b"%PDF-1.4 fake", "application/pdf")},
        )
        course_id = create.json()["id"]

        response = client.get(f"/courses/{course_id}", headers=_headers_for(student))
        assert response.status_code == 404
    finally:
        app.dependency_overrides.clear()
        client.close()
        session.close()


def test_student_list_filters_by_language(monkeypatch) -> None:
    session = SessionLocal()
    client = _make_client(session)
    try:
        monkeypatch.setattr("app.modules.ai.repository.extract_course_structure", lambda *_: dict(_FAKE_STRUCTURE))
        teacher = _seed_user(session, UserRole.ROLE_TUTOR, "http-lang-teacher")
        student = _seed_user(session, UserRole.ROLE_STUDENT, "http-lang-student")
        teacher_headers = _headers_for(teacher)

        create_ar = client.post(
            "/teacher/courses",
            headers=teacher_headers,
            data={"title": "Arabic Course", "language": "ar"},
            files={"file": ("ar.pdf", b"%PDF-1.4 fake", "application/pdf")},
        )
        create_en = client.post(
            "/teacher/courses",
            headers=teacher_headers,
            data={"title": "English Course", "language": "en"},
            files={"file": ("en.pdf", b"%PDF-1.4 fake", "application/pdf")},
        )
        client.post(f"/teacher/courses/{create_ar.json()['id']}/publish", headers=teacher_headers)
        client.post(f"/teacher/courses/{create_en.json()['id']}/publish", headers=teacher_headers)

        response = client.get("/courses?language=ar", headers=_headers_for(student))
        assert response.status_code == 200
        items = response.json()
        returned_ids = {item["id"] for item in items}
        assert create_ar.json()["id"] in returned_ids
        assert create_en.json()["id"] not in returned_ids
        assert all(item["language"] == "ar" for item in items)
    finally:
        app.dependency_overrides.clear()
        client.close()
        session.close()


def test_non_pdf_rejected_at_router(monkeypatch) -> None:
    session = SessionLocal()
    client = _make_client(session)
    try:
        monkeypatch.setattr("app.modules.ai.repository.extract_course_structure", lambda *_: dict(_FAKE_STRUCTURE))
        teacher = _seed_user(session, UserRole.ROLE_TUTOR, "http-nonpdf-teacher")
        response = client.post(
            "/teacher/courses",
            headers=_headers_for(teacher),
            data={"title": "Bad Upload", "language": "en"},
            files={"file": ("bad.zip", b"PK\x03\x04", "application/zip")},
        )
        assert response.status_code == 400
    finally:
        app.dependency_overrides.clear()
        client.close()
        session.close()
