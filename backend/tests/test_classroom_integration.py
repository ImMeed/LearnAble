from uuid import uuid4

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import settings
from app.core.roles import UserRole
from app.core.security import create_access_token
from app.db.base import Base
from app.db.models.study import Lesson
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


def _seed_users_and_lesson(session: Session):
    teacher = User(
        email=f"classroom-teacher-{uuid4()}@learnable.test",
        password_hash="integration-test-hash",
        role=UserRole.ROLE_TUTOR,
    )
    student_a = User(
        email=f"classroom-student-a-{uuid4()}@learnable.test",
        password_hash="integration-test-hash",
        role=UserRole.ROLE_STUDENT,
        student_age_years=10,
    )
    student_b = User(
        email=f"classroom-student-b-{uuid4()}@learnable.test",
        password_hash="integration-test-hash",
        role=UserRole.ROLE_STUDENT,
        student_age_years=11,
    )
    lesson = Lesson(
        title_ar="درس الصف",
        title_en="Classroom Lesson",
        body_ar="محتوى درس الصف",
        body_en="Classroom lesson content",
        difficulty="BEGINNER",
        is_active=True,
    )

    session.add_all([teacher, student_a, student_b, lesson])
    session.commit()

    teacher_token = create_access_token(teacher.id, str(teacher.role), teacher.email)
    student_a_token = create_access_token(student_a.id, str(student_a.role), student_a.email)
    student_b_token = create_access_token(student_b.id, str(student_b.role), student_b.email)

    return {
        "teacher": teacher,
        "student_a": student_a,
        "student_b": student_b,
        "lesson": lesson,
        "teacher_token": teacher_token,
        "student_a_token": student_a_token,
        "student_b_token": student_b_token,
    }


def test_classroom_join_and_course_gate_flow() -> None:
    previous_flag = settings.classroom_system_enabled
    settings.classroom_system_enabled = True

    session = SessionLocal()
    client = _make_client(session)
    try:
        seeded = _seed_users_and_lesson(session)

        teacher_headers = {"Authorization": f"Bearer {seeded['teacher_token']}", "x-lang": "en"}
        student_a_headers = {"Authorization": f"Bearer {seeded['student_a_token']}", "x-lang": "en"}
        student_b_headers = {"Authorization": f"Bearer {seeded['student_b_token']}", "x-lang": "en"}

        empty_lessons = client.get("/study/lessons", headers=student_a_headers)
        assert empty_lessons.status_code == 200
        assert empty_lessons.json()["items"] == []

        create_classroom = client.post(
            "/classrooms/teacher",
            headers=teacher_headers,
            json={"name": "Class A", "description": "Main class", "grade_tag": "G4"},
        )
        assert create_classroom.status_code == 200
        classroom_id = create_classroom.json()["id"]
        invite_code = create_classroom.json()["invite_code"]

        preview_join = client.post(
            "/classrooms/student/join/preview",
            headers=student_a_headers,
            json={"invite_code": invite_code.lower()},
        )
        assert preview_join.status_code == 200
        assert preview_join.json()["classroom_id"] == classroom_id

        join = client.post(
            "/classrooms/student/join",
            headers=student_a_headers,
            json={"invite_code": invite_code.lower()},
        )
        assert join.status_code == 200
        assert join.json()["joined"] is True

        assign_course = client.post(
            f"/classrooms/teacher/{classroom_id}/courses/assign",
            headers=teacher_headers,
            json={"course_id": str(seeded["lesson"].id)},
        )
        assert assign_course.status_code == 200
        assert any(item["course_id"] == str(seeded["lesson"].id) for item in assign_course.json()["items"])

        student_a_lessons = client.get("/study/lessons", headers=student_a_headers)
        assert student_a_lessons.status_code == 200
        assert any(item["id"] == str(seeded["lesson"].id) for item in student_a_lessons.json()["items"])

        student_b_lessons = client.get("/study/lessons", headers=student_b_headers)
        assert student_b_lessons.status_code == 200
        assert student_b_lessons.json()["items"] == []

        my_classrooms = client.get("/classrooms/student/me", headers=student_a_headers)
        assert my_classrooms.status_code == 200
        assert len(my_classrooms.json()["items"]) == 1
        assert "Classroom Lesson" in my_classrooms.json()["items"][0]["courses"]

        leave = client.post(f"/classrooms/student/{classroom_id}/leave", headers=student_a_headers)
        assert leave.status_code == 200

        lessons_after_leave = client.get("/study/lessons", headers=student_a_headers)
        assert lessons_after_leave.status_code == 200
        assert lessons_after_leave.json()["items"] == []
    finally:
        settings.classroom_system_enabled = previous_flag
        app.dependency_overrides.clear()
        client.close()
        session.close()


def test_teacher_student_scope_blocks_outside_classroom_access() -> None:
    previous_classroom_flag = settings.classroom_system_enabled
    previous_reading_lab_flag = settings.reading_lab_enabled
    settings.classroom_system_enabled = True
    settings.reading_lab_enabled = True

    session = SessionLocal()
    client = _make_client(session)
    try:
        seeded = _seed_users_and_lesson(session)
        teacher_headers = {"Authorization": f"Bearer {seeded['teacher_token']}", "x-lang": "en"}
        student_a_headers = {"Authorization": f"Bearer {seeded['student_a_token']}", "x-lang": "en"}

        create_classroom = client.post(
            "/classrooms/teacher",
            headers=teacher_headers,
            json={"name": "Scoped Class", "description": "Scope test"},
        )
        assert create_classroom.status_code == 200
        classroom_id = create_classroom.json()["id"]
        invite_code = create_classroom.json()["invite_code"]

        join = client.post(
            "/classrooms/student/join",
            headers=student_a_headers,
            json={"invite_code": invite_code},
        )
        assert join.status_code == 200

        denied_questionnaire = client.post(
            f"/psychologist/questionnaires/students/{seeded['student_b'].id}",
            headers=teacher_headers,
            json={
                "attention_score": 65,
                "engagement_score": 70,
                "notes": "Outside classroom",
                "cadence_days": 14,
            },
        )
        assert denied_questionnaire.status_code == 403
        assert denied_questionnaire.json()["code"] == "CLASSROOM_SCOPE_ACCESS_DENIED"

        allowed_questionnaire = client.post(
            f"/psychologist/questionnaires/students/{seeded['student_a'].id}",
            headers=teacher_headers,
            json={
                "attention_score": 67,
                "engagement_score": 72,
                "notes": "In classroom",
                "cadence_days": 14,
            },
        )
        assert allowed_questionnaire.status_code == 200

        denied_support = client.get(
            f"/reading-lab/support/students/{seeded['student_b'].id}",
            headers=teacher_headers,
        )
        assert denied_support.status_code == 403
        assert denied_support.json()["code"] == "READING_SUPPORT_ACCESS_DENIED"

        allowed_support = client.get(
            f"/reading-lab/support/students/{seeded['student_a'].id}",
            headers=teacher_headers,
        )
        assert allowed_support.status_code == 200
    finally:
        settings.classroom_system_enabled = previous_classroom_flag
        settings.reading_lab_enabled = previous_reading_lab_flag
        app.dependency_overrides.clear()
        client.close()
        session.close()
