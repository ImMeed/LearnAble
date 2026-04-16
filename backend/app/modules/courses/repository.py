from uuid import UUID

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from app.db.models.course import Course, CourseStatus
from app.db.models.section_progress import SectionProgress
from app.db.models.course_last_visited import CourseLastVisited
from app.db.models.quiz_attempt import CourseQuizAttempt


def create_course(
    session: Session,
    *,
    title: str,
    language: str,
    owner_user_id: UUID,
    source_filename: str | None,
    source_page_count: int | None,
    structure_json: dict,
) -> Course:
    course = Course(
        title=title,
        language=language,
        owner_user_id=owner_user_id,
        source_filename=source_filename,
        source_page_count=source_page_count,
        structure_json=structure_json,
        status=CourseStatus.DRAFT,
    )
    session.add(course)
    session.flush()
    return course


def get_course_by_id(session: Session, course_id: UUID) -> Course | None:
    return session.scalar(select(Course).where(Course.id == course_id))


def list_courses_by_owner(session: Session, owner_user_id: UUID) -> list[Course]:
    stmt = select(Course).where(Course.owner_user_id == owner_user_id).order_by(Course.created_at.desc())
    return list(session.scalars(stmt))


def list_published_courses(session: Session, language: str | None) -> list[Course]:
    stmt = select(Course).where(Course.status == CourseStatus.PUBLISHED)
    if language:
        stmt = stmt.where(Course.language == language)
    stmt = stmt.order_by(Course.created_at.desc())
    return list(session.scalars(stmt))


def update_course(session: Session, course: Course, **fields) -> Course:
    for key, value in fields.items():
        setattr(course, key, value)
    session.flush()
    return course


def delete_course(session: Session, course: Course) -> None:
    session.delete(course)
    session.flush()


# ── Progress ───────────────────────────────────────────────────────────────────

def mark_section_complete(
    session: Session, *, student_user_id: UUID, course_id: UUID, section_id: str
) -> SectionProgress:
    record = SectionProgress(
        student_user_id=student_user_id,
        course_id=course_id,
        section_id=section_id,
    )
    session.add(record)
    session.flush()
    return record


def unmark_section_complete(
    session: Session, *, student_user_id: UUID, course_id: UUID, section_id: str
) -> bool:
    record = session.scalar(
        select(SectionProgress).where(
            SectionProgress.student_user_id == student_user_id,
            SectionProgress.course_id == course_id,
            SectionProgress.section_id == section_id,
        )
    )
    if record is None:
        return False
    session.delete(record)
    session.flush()
    return True


def get_completed_section_ids(
    session: Session, *, student_user_id: UUID, course_id: UUID
) -> list[str]:
    rows = session.scalars(
        select(SectionProgress.section_id).where(
            SectionProgress.student_user_id == student_user_id,
            SectionProgress.course_id == course_id,
        )
    )
    return list(rows)


def upsert_last_visited(
    session: Session, *, student_user_id: UUID, course_id: UUID, section_id: str
) -> None:
    stmt = (
        pg_insert(CourseLastVisited)
        .values(student_user_id=student_user_id, course_id=course_id, section_id=section_id)
        .on_conflict_do_update(
            index_elements=["student_user_id", "course_id"],
            set_={"section_id": section_id},
        )
    )
    session.execute(stmt)
    session.flush()


def get_last_visited(
    session: Session, *, student_user_id: UUID, course_id: UUID
) -> str | None:
    return session.scalar(
        select(CourseLastVisited.section_id).where(
            CourseLastVisited.student_user_id == student_user_id,
            CourseLastVisited.course_id == course_id,
        )
    )


# ── Quiz Attempts ──────────────────────────────────────────────────────────────

def save_quiz_attempt(
    session: Session, *, student_user_id: UUID, course_id: UUID, score: int, total: int
) -> CourseQuizAttempt:
    attempt = CourseQuizAttempt(
        student_user_id=student_user_id,
        course_id=course_id,
        score=score,
        total=total,
    )
    session.add(attempt)
    session.flush()
    return attempt


def list_quiz_attempts(
    session: Session, *, student_user_id: UUID, course_id: UUID
) -> list[CourseQuizAttempt]:
    return list(
        session.scalars(
            select(CourseQuizAttempt)
            .where(
                CourseQuizAttempt.student_user_id == student_user_id,
                CourseQuizAttempt.course_id == course_id,
            )
            .order_by(CourseQuizAttempt.attempted_at.desc())
        )
    )
