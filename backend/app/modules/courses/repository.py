from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models.course import Course, CourseStatus


def create_course(
    session: Session,
    *,
    owner_id: UUID,
    title: str,
    language: str,
    source_filename: str,
    source_page_count: int,
    structure_json: dict,
) -> Course:
    course = Course(
        owner_user_id=owner_id,
        title=title,
        language=language,
        source_filename=source_filename,
        source_page_count=source_page_count,
        structure_json=structure_json,
        status=CourseStatus.DRAFT.value,
    )
    session.add(course)
    session.flush()
    return course


def get_course_by_id(session: Session, course_id: UUID) -> Course | None:
    return session.get(Course, course_id)


def list_courses_by_owner(session: Session, owner_id: UUID) -> list[Course]:
    stmt = select(Course).where(Course.owner_user_id == owner_id).order_by(Course.created_at.desc())
    return list(session.scalars(stmt))


def list_published_courses(session: Session, language: str | None = None) -> list[Course]:
    stmt = select(Course).where(Course.status == CourseStatus.PUBLISHED.value)
    if language is not None:
        stmt = stmt.where(Course.language == language)
    stmt = stmt.order_by(Course.created_at.desc())
    return list(session.scalars(stmt))


def update_course(session: Session, course: Course, **fields: object) -> Course:
    for key, value in fields.items():
        setattr(course, key, value)
    session.add(course)
    session.flush()
    return course


def delete_course(session: Session, course: Course) -> None:
    session.delete(course)
    session.flush()
