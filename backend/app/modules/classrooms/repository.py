import string
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.models.classroom import Classroom, ClassroomCourse, ClassroomEnrollment
from app.db.models.study import Lesson, StudentScreening
from app.db.models.users import User
from app.db.models.reading_lab import ReadingSupportProfile


def get_user(session: Session, user_id: UUID) -> User | None:
    return session.get(User, user_id)


def list_teacher_classrooms(session: Session, teacher_id: UUID) -> list[Classroom]:
    stmt = (
        select(Classroom)
        .where(Classroom.teacher_id == teacher_id)
        .order_by(Classroom.created_at.desc())
    )
    return list(session.scalars(stmt))


def get_teacher_classroom(session: Session, classroom_id: UUID, teacher_id: UUID) -> Classroom | None:
    stmt = select(Classroom).where(Classroom.id == classroom_id, Classroom.teacher_id == teacher_id)
    return session.scalar(stmt)


def get_classroom_by_id(session: Session, classroom_id: UUID) -> Classroom | None:
    return session.get(Classroom, classroom_id)


def get_classroom_by_invite_code(session: Session, normalized_code: str) -> Classroom | None:
    stmt = select(Classroom).where(func.upper(Classroom.invite_code) == normalized_code)
    return session.scalar(stmt)


def create_classroom(
    session: Session,
    *,
    teacher_id: UUID,
    name: str,
    description: str | None,
    grade_tag: str | None,
    invite_code: str,
) -> Classroom:
    record = Classroom(
        teacher_id=teacher_id,
        name=name,
        description=description,
        grade_tag=grade_tag,
        invite_code=invite_code,
        is_active=True,
    )
    session.add(record)
    session.flush()
    return record


def upsert_classroom_enrollment(
    session: Session,
    *,
    classroom_id: UUID,
    student_id: UUID,
) -> ClassroomEnrollment:
    stmt = select(ClassroomEnrollment).where(
        ClassroomEnrollment.classroom_id == classroom_id,
        ClassroomEnrollment.student_id == student_id,
    )
    record = session.scalar(stmt)
    if record is None:
        record = ClassroomEnrollment(
            classroom_id=classroom_id,
            student_id=student_id,
            is_active=True,
        )
        session.add(record)
    else:
        record.is_active = True
        session.add(record)
    session.flush()
    return record


def deactivate_classroom_enrollment(
    session: Session,
    *,
    classroom_id: UUID,
    student_id: UUID,
) -> ClassroomEnrollment | None:
    stmt = select(ClassroomEnrollment).where(
        ClassroomEnrollment.classroom_id == classroom_id,
        ClassroomEnrollment.student_id == student_id,
        ClassroomEnrollment.is_active.is_(True),
    )
    record = session.scalar(stmt)
    if record is None:
        return None
    record.is_active = False
    session.add(record)
    session.flush()
    return record


def list_active_classroom_enrollments(session: Session, classroom_id: UUID) -> list[ClassroomEnrollment]:
    stmt = (
        select(ClassroomEnrollment)
        .where(
            ClassroomEnrollment.classroom_id == classroom_id,
            ClassroomEnrollment.is_active.is_(True),
        )
        .order_by(ClassroomEnrollment.joined_at.asc())
    )
    return list(session.scalars(stmt))


def list_active_student_enrollments(session: Session, student_id: UUID) -> list[ClassroomEnrollment]:
    stmt = (
        select(ClassroomEnrollment)
        .where(
            ClassroomEnrollment.student_id == student_id,
            ClassroomEnrollment.is_active.is_(True),
        )
        .order_by(ClassroomEnrollment.joined_at.desc())
    )
    return list(session.scalars(stmt))


def list_active_teacher_student_ids(session: Session, teacher_id: UUID) -> list[UUID]:
    stmt = (
        select(ClassroomEnrollment.student_id)
        .join(Classroom, Classroom.id == ClassroomEnrollment.classroom_id)
        .where(
            Classroom.teacher_id == teacher_id,
            Classroom.is_active.is_(True),
            ClassroomEnrollment.is_active.is_(True),
        )
        .distinct()
    )
    return list(session.scalars(stmt))


def is_student_in_teacher_classrooms(session: Session, teacher_id: UUID, student_id: UUID) -> bool:
    stmt = (
        select(ClassroomEnrollment)
        .join(Classroom, Classroom.id == ClassroomEnrollment.classroom_id)
        .where(
            Classroom.teacher_id == teacher_id,
            Classroom.is_active.is_(True),
            ClassroomEnrollment.student_id == student_id,
            ClassroomEnrollment.is_active.is_(True),
        )
    )
    return session.scalar(stmt) is not None


def assign_course_to_classroom(session: Session, classroom_id: UUID, course_id: UUID) -> ClassroomCourse:
    stmt = select(ClassroomCourse).where(
        ClassroomCourse.classroom_id == classroom_id,
        ClassroomCourse.course_id == course_id,
    )
    record = session.scalar(stmt)
    if record is None:
        record = ClassroomCourse(classroom_id=classroom_id, course_id=course_id)
        session.add(record)
        session.flush()
    return record


def list_classroom_course_links(session: Session, classroom_id: UUID) -> list[ClassroomCourse]:
    stmt = (
        select(ClassroomCourse)
        .where(ClassroomCourse.classroom_id == classroom_id)
        .order_by(ClassroomCourse.assigned_at.desc())
    )
    return list(session.scalars(stmt))


def list_active_lessons_for_classroom(session: Session, classroom_id: UUID) -> list[Lesson]:
    stmt = (
        select(Lesson)
        .join(ClassroomCourse, ClassroomCourse.course_id == Lesson.id)
        .where(
            ClassroomCourse.classroom_id == classroom_id,
            Lesson.is_active.is_(True),
        )
        .order_by(Lesson.created_at.desc())
    )
    return list(session.scalars(stmt))


def list_active_lessons_for_student_by_classroom_membership(session: Session, student_id: UUID) -> list[Lesson]:
    stmt = (
        select(Lesson)
        .join(ClassroomCourse, ClassroomCourse.course_id == Lesson.id)
        .join(Classroom, Classroom.id == ClassroomCourse.classroom_id)
        .join(ClassroomEnrollment, ClassroomEnrollment.classroom_id == Classroom.id)
        .where(
            Lesson.is_active.is_(True),
            Classroom.is_active.is_(True),
            ClassroomEnrollment.student_id == student_id,
            ClassroomEnrollment.is_active.is_(True),
        )
        .distinct()
        .order_by(Lesson.created_at.desc())
    )
    return list(session.scalars(stmt))


def get_active_lesson_for_student_by_classroom_membership(
    session: Session,
    *,
    student_id: UUID,
    lesson_id: UUID,
) -> Lesson | None:
    stmt = (
        select(Lesson)
        .join(ClassroomCourse, ClassroomCourse.course_id == Lesson.id)
        .join(Classroom, Classroom.id == ClassroomCourse.classroom_id)
        .join(ClassroomEnrollment, ClassroomEnrollment.classroom_id == Classroom.id)
        .where(
            Lesson.id == lesson_id,
            Lesson.is_active.is_(True),
            Classroom.is_active.is_(True),
            ClassroomEnrollment.student_id == student_id,
            ClassroomEnrollment.is_active.is_(True),
        )
        .distinct()
    )
    return session.scalar(stmt)


def list_teacher_students_with_screening(session: Session, teacher_id: UUID) -> list[UUID]:
    stmt = (
        select(StudentScreening.user_id)
        .join(
            ClassroomEnrollment,
            ClassroomEnrollment.student_id == StudentScreening.user_id,
        )
        .join(Classroom, Classroom.id == ClassroomEnrollment.classroom_id)
        .where(
            Classroom.teacher_id == teacher_id,
            Classroom.is_active.is_(True),
            ClassroomEnrollment.is_active.is_(True),
        )
        .distinct()
        .order_by(StudentScreening.created_at.desc())
    )
    return list(session.scalars(stmt))


def list_teacher_students_with_reading_support(session: Session, teacher_id: UUID) -> list[UUID]:
    stmt = (
        select(ReadingSupportProfile.student_user_id)
        .join(
            ClassroomEnrollment,
            ClassroomEnrollment.student_id == ReadingSupportProfile.student_user_id,
        )
        .join(Classroom, Classroom.id == ClassroomEnrollment.classroom_id)
        .where(
            Classroom.teacher_id == teacher_id,
            Classroom.is_active.is_(True),
            ClassroomEnrollment.is_active.is_(True),
        )
        .distinct()
    )
    return list(session.scalars(stmt))


def get_student_screening(session: Session, student_id: UUID) -> StudentScreening | None:
    stmt = select(StudentScreening).where(StudentScreening.user_id == student_id)
    return session.scalar(stmt)


def get_reading_support_profile(session: Session, student_id: UUID) -> ReadingSupportProfile | None:
    stmt = select(ReadingSupportProfile).where(ReadingSupportProfile.student_user_id == student_id)
    return session.scalar(stmt)


def normalize_invite_code(value: str) -> str:
    return "".join(ch for ch in value.strip().upper() if ch in string.ascii_uppercase + string.digits)
