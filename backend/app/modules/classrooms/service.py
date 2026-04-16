import secrets
import string
from uuid import UUID

from fastapi import status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.i18n import localized_http_exception
from app.core.roles import UserRole
from app.core.security import CurrentUser
from app.modules.classrooms import repository
from app.modules.classrooms.schemas import (
    ClassroomAssignedCourseItem,
    ClassroomAssignedCourseListResponse,
    ClassroomAssignCourseRequest,
    ClassroomArchiveRequest,
    ClassroomCourseRef,
    ClassroomCreateRequest,
    ClassroomDetailResponse,
    ClassroomItem,
    ClassroomJoinPreviewResponse,
    ClassroomJoinRequest,
    ClassroomJoinResponse,
    ClassroomLeaveResponse,
    ClassroomListResponse,
    ClassroomRegenerateCodeResponse,
    ClassroomRemoveStudentRequest,
    ClassroomStudentItem,
    ClassroomStudentListResponse,
    ClassroomUpdateRequest,
    StudentClassroomItem,
    StudentClassroomListResponse,
    TeacherCourseAssignmentItem,
    TeacherCourseAssignmentListResponse,
)


INVITE_CODE_ALPHABET = string.ascii_uppercase + string.digits
INVITE_CODE_LENGTH = 8


def _ensure_enabled(locale: str) -> None:
    if not settings.classroom_system_enabled:
        raise localized_http_exception(status.HTTP_404_NOT_FOUND, "CLASSROOM_SYSTEM_DISABLED", locale)


def _require_teacher(current_user: CurrentUser, locale: str) -> None:
    if current_user.role != UserRole.ROLE_TUTOR:
        raise localized_http_exception(status.HTTP_403_FORBIDDEN, "FORBIDDEN", locale)


def _require_student(current_user: CurrentUser, locale: str) -> None:
    if current_user.role != UserRole.ROLE_STUDENT:
        raise localized_http_exception(status.HTTP_403_FORBIDDEN, "FORBIDDEN", locale)


def _classroom_item(record) -> ClassroomItem:
    return ClassroomItem(
        id=record.id,
        name=record.name,
        description=record.description,
        grade_tag=record.grade_tag,
        invite_code=record.invite_code,
        is_active=record.is_active,
        created_at=record.created_at,
        updated_at=record.updated_at,
    )


def _issue_invite_code(session: Session) -> str:
    for _ in range(20):
        code = "".join(secrets.choice(INVITE_CODE_ALPHABET) for _ in range(INVITE_CODE_LENGTH))
        normalized = repository.normalize_invite_code(code)
        if not normalized:
            continue
        existing = repository.get_classroom_by_invite_code(session, normalized)
        if existing is None:
            return normalized
    raise RuntimeError("invite code generation exhausted")


def _resolve_course_summary(
    session: Session,
    *,
    course_id: UUID,
    locale: str,
    teacher_id: UUID,
    include_unpublished_course: bool,
) -> tuple[str, str] | None:
    from app.modules.study import repository as study_repository

    lesson = study_repository.get_lesson(session, course_id)
    if lesson is not None:
        return (lesson.title_en if locale == "en" else lesson.title_ar, lesson.difficulty)

    from app.modules.courses import repository as courses_repository

    course = courses_repository.get_course_by_id(session, course_id)
    if course is None or course.owner_user_id != teacher_id:
        return None
    if not include_unpublished_course and course.status != "PUBLISHED":
        return None

    return (course.title, "CUSTOM")


def list_teacher_classrooms(
    session: Session,
    current_user: CurrentUser,
    locale: str,
) -> ClassroomListResponse:
    _ensure_enabled(locale)
    _require_teacher(current_user, locale)
    items = repository.list_teacher_classrooms(session, current_user.user_id)
    return ClassroomListResponse(items=[_classroom_item(item) for item in items])


def create_teacher_classroom(
    session: Session,
    payload: ClassroomCreateRequest,
    current_user: CurrentUser,
    locale: str,
) -> ClassroomItem:
    _ensure_enabled(locale)
    _require_teacher(current_user, locale)

    try:
        invite_code = _issue_invite_code(session)
    except RuntimeError as exc:
        raise localized_http_exception(status.HTTP_500_INTERNAL_SERVER_ERROR, "CLASSROOM_INVITE_GENERATION_FAILED", locale) from exc

    record = repository.create_classroom(
        session,
        teacher_id=current_user.user_id,
        name=payload.name.strip(),
        description=payload.description.strip() if payload.description else None,
        grade_tag=payload.grade_tag.strip() if payload.grade_tag else None,
        invite_code=invite_code,
    )
    session.commit()
    return _classroom_item(record)


def update_teacher_classroom(
    session: Session,
    classroom_id: UUID,
    payload: ClassroomUpdateRequest,
    current_user: CurrentUser,
    locale: str,
) -> ClassroomItem:
    _ensure_enabled(locale)
    _require_teacher(current_user, locale)

    record = repository.get_teacher_classroom(session, classroom_id, current_user.user_id)
    if record is None:
        raise localized_http_exception(status.HTTP_404_NOT_FOUND, "CLASSROOM_NOT_FOUND", locale)

    record.name = payload.name.strip()
    record.description = payload.description.strip() if payload.description else None
    record.grade_tag = payload.grade_tag.strip() if payload.grade_tag else None
    session.add(record)
    session.commit()
    return _classroom_item(record)


def archive_teacher_classroom(
    session: Session,
    classroom_id: UUID,
    payload: ClassroomArchiveRequest,
    current_user: CurrentUser,
    locale: str,
) -> ClassroomItem:
    _ensure_enabled(locale)
    _require_teacher(current_user, locale)

    record = repository.get_teacher_classroom(session, classroom_id, current_user.user_id)
    if record is None:
        raise localized_http_exception(status.HTTP_404_NOT_FOUND, "CLASSROOM_NOT_FOUND", locale)

    record.is_active = payload.is_active
    session.add(record)

    if not payload.is_active:
        enrollments = repository.list_active_classroom_enrollments(session, classroom_id)
        for enrollment in enrollments:
            enrollment.is_active = False
            session.add(enrollment)

    session.commit()
    return _classroom_item(record)


def regenerate_invite_code(
    session: Session,
    classroom_id: UUID,
    current_user: CurrentUser,
    locale: str,
) -> ClassroomRegenerateCodeResponse:
    _ensure_enabled(locale)
    _require_teacher(current_user, locale)

    record = repository.get_teacher_classroom(session, classroom_id, current_user.user_id)
    if record is None:
        raise localized_http_exception(status.HTTP_404_NOT_FOUND, "CLASSROOM_NOT_FOUND", locale)

    try:
        record.invite_code = _issue_invite_code(session)
    except RuntimeError as exc:
        raise localized_http_exception(status.HTTP_500_INTERNAL_SERVER_ERROR, "CLASSROOM_INVITE_GENERATION_FAILED", locale) from exc

    session.add(record)
    session.commit()
    return ClassroomRegenerateCodeResponse(classroom_id=record.id, invite_code=record.invite_code)


def classroom_join_preview(
    session: Session,
    payload: ClassroomJoinRequest,
    current_user: CurrentUser,
    locale: str,
) -> ClassroomJoinPreviewResponse:
    _ensure_enabled(locale)
    _require_student(current_user, locale)

    normalized = repository.normalize_invite_code(payload.invite_code)
    classroom = repository.get_classroom_by_invite_code(session, normalized)
    if classroom is None:
        raise localized_http_exception(status.HTTP_404_NOT_FOUND, "CLASSROOM_INVITE_NOT_FOUND", locale)
    if not classroom.is_active:
        raise localized_http_exception(status.HTTP_409_CONFLICT, "CLASSROOM_INACTIVE", locale)

    teacher = repository.get_user(session, classroom.teacher_id)
    if teacher is None:
        raise localized_http_exception(status.HTTP_404_NOT_FOUND, "USER_NOT_FOUND", locale)

    teacher_name = teacher.email.split("@", 1)[0]
    return ClassroomJoinPreviewResponse(
        classroom_id=classroom.id,
        classroom_name=classroom.name,
        teacher_name=teacher_name,
        teacher_id=teacher.id,
    )


def classroom_join(
    session: Session,
    payload: ClassroomJoinRequest,
    current_user: CurrentUser,
    locale: str,
) -> ClassroomJoinResponse:
    _ensure_enabled(locale)
    _require_student(current_user, locale)

    normalized = repository.normalize_invite_code(payload.invite_code)
    classroom = repository.get_classroom_by_invite_code(session, normalized)
    if classroom is None:
        raise localized_http_exception(status.HTTP_404_NOT_FOUND, "CLASSROOM_INVITE_NOT_FOUND", locale)
    if not classroom.is_active:
        raise localized_http_exception(status.HTTP_409_CONFLICT, "CLASSROOM_INACTIVE", locale)

    try:
        repository.upsert_classroom_enrollment(
            session,
            classroom_id=classroom.id,
            student_id=current_user.user_id,
        )
        session.commit()
    except IntegrityError:
        session.rollback()
        raise localized_http_exception(status.HTTP_409_CONFLICT, "CLASSROOM_ALREADY_JOINED", locale)

    return ClassroomJoinResponse(
        classroom_id=classroom.id,
        classroom_name=classroom.name,
        joined=True,
    )


def list_student_classrooms(
    session: Session,
    current_user: CurrentUser,
    locale: str,
) -> StudentClassroomListResponse:
    _ensure_enabled(locale)
    _require_student(current_user, locale)

    enrollments = repository.list_active_student_enrollments(session, current_user.user_id)
    items: list[StudentClassroomItem] = []
    for enrollment in enrollments:
        classroom = repository.get_classroom_by_id(session, enrollment.classroom_id)
        if classroom is None or not classroom.is_active:
            continue
        teacher = repository.get_user(session, classroom.teacher_id)
        teacher_name = teacher.email.split("@", 1)[0] if teacher is not None else str(classroom.teacher_id)
        course_refs: list[ClassroomCourseRef] = []
        links = repository.list_classroom_course_links(session, classroom.id)
        for link in links:
            # Try PDF course first (has navigable ID)
            from app.modules.courses import repository as courses_repository
            course = courses_repository.get_course_by_id(session, link.course_id)
            if course is not None:
                course_refs.append(ClassroomCourseRef(
                    id=course.id,
                    title=course.title,
                    language=course.language,
                    kind="course",
                ))
                continue
            # Fall back to legacy lesson lookup
            summary = _resolve_course_summary(
                session,
                course_id=link.course_id,
                locale=locale,
                teacher_id=classroom.teacher_id,
                include_unpublished_course=False,
            )
            if summary is None:
                continue
            title, _ = summary
            course_refs.append(ClassroomCourseRef(
                id=link.course_id,
                title=title,
                language="ar",
                kind="lesson",
            ))
        items.append(
            StudentClassroomItem(
                classroom_id=classroom.id,
                classroom_name=classroom.name,
                teacher_name=teacher_name,
                joined_at=enrollment.joined_at,
                courses=course_refs,
            )
        )

    return StudentClassroomListResponse(items=items)


def student_leave_classroom(
    session: Session,
    classroom_id: UUID,
    current_user: CurrentUser,
    locale: str,
) -> ClassroomLeaveResponse:
    _ensure_enabled(locale)
    _require_student(current_user, locale)

    enrollment = repository.deactivate_classroom_enrollment(
        session,
        classroom_id=classroom_id,
        student_id=current_user.user_id,
    )
    if enrollment is None:
        raise localized_http_exception(status.HTTP_404_NOT_FOUND, "CLASSROOM_ENROLLMENT_NOT_FOUND", locale)

    session.commit()
    return ClassroomLeaveResponse(classroom_id=classroom_id, left=True)


def get_teacher_classroom_students(
    session: Session,
    classroom_id: UUID,
    current_user: CurrentUser,
    locale: str,
) -> ClassroomStudentListResponse:
    _ensure_enabled(locale)
    _require_teacher(current_user, locale)

    classroom = repository.get_teacher_classroom(session, classroom_id, current_user.user_id)
    if classroom is None:
        raise localized_http_exception(status.HTTP_404_NOT_FOUND, "CLASSROOM_NOT_FOUND", locale)

    enrollments = repository.list_active_classroom_enrollments(session, classroom.id)
    items: list[ClassroomStudentItem] = []
    for enrollment in enrollments:
        student = repository.get_user(session, enrollment.student_id)
        if student is None:
            continue
        screening = repository.get_student_screening(session, student.id)
        support_profile = repository.get_reading_support_profile(session, student.id)
        screening_composite_score = None
        screening_support_level = None
        if screening is not None:
            screening_support_level = screening.support_level
            screening_composite_score = round(
                (screening.focus_score + screening.reading_score + screening.memory_score) / 3
            )
        items.append(
            ClassroomStudentItem(
                student_id=student.id,
                student_label=student.email.split("@", 1)[0],
                joined_at=enrollment.joined_at,
                is_active=enrollment.is_active,
                reading_support_status=support_profile.status.value if support_profile is not None else None,
                screening_support_level=screening_support_level,
                screening_composite_score=screening_composite_score,
            )
        )

    return ClassroomStudentListResponse(items=items)


def remove_student_from_teacher_classroom(
    session: Session,
    classroom_id: UUID,
    payload: ClassroomRemoveStudentRequest,
    current_user: CurrentUser,
    locale: str,
) -> ClassroomLeaveResponse:
    _ensure_enabled(locale)
    _require_teacher(current_user, locale)

    classroom = repository.get_teacher_classroom(session, classroom_id, current_user.user_id)
    if classroom is None:
        raise localized_http_exception(status.HTTP_404_NOT_FOUND, "CLASSROOM_NOT_FOUND", locale)

    enrollment = repository.deactivate_classroom_enrollment(
        session,
        classroom_id=classroom.id,
        student_id=payload.student_id,
    )
    if enrollment is None:
        raise localized_http_exception(status.HTTP_404_NOT_FOUND, "CLASSROOM_ENROLLMENT_NOT_FOUND", locale)

    session.commit()
    return ClassroomLeaveResponse(classroom_id=classroom.id, left=True)


def assign_course_to_teacher_classroom(
    session: Session,
    classroom_id: UUID,
    payload: ClassroomAssignCourseRequest,
    current_user: CurrentUser,
    locale: str,
) -> ClassroomAssignedCourseListResponse:
    _ensure_enabled(locale)
    _require_teacher(current_user, locale)

    classroom = repository.get_teacher_classroom(session, classroom_id, current_user.user_id)
    if classroom is None:
        raise localized_http_exception(status.HTTP_404_NOT_FOUND, "CLASSROOM_NOT_FOUND", locale)

    summary = _resolve_course_summary(
        session,
        course_id=payload.course_id,
        locale=locale,
        teacher_id=current_user.user_id,
        include_unpublished_course=True,
    )

    if summary is None:
        raise localized_http_exception(status.HTTP_404_NOT_FOUND, "LESSON_NOT_FOUND", locale)

    from app.modules.courses import repository as courses_repository
    from app.modules.study import repository as study_repository

    lesson = study_repository.get_lesson(session, payload.course_id)
    if lesson is None:
        teacher_course = courses_repository.get_course_by_id(session, payload.course_id)
        if teacher_course is None or teacher_course.owner_user_id != current_user.user_id:
            raise localized_http_exception(status.HTTP_404_NOT_FOUND, "LESSON_NOT_FOUND", locale)
        if teacher_course.status != "PUBLISHED":
            raise localized_http_exception(status.HTTP_409_CONFLICT, "COURSE_NOT_PUBLISHED", locale)

    repository.assign_course_to_classroom(session, classroom.id, payload.course_id)
    session.commit()
    return get_teacher_classroom_courses(session, classroom.id, current_user, locale)


def get_teacher_classroom_courses(
    session: Session,
    classroom_id: UUID,
    current_user: CurrentUser,
    locale: str,
) -> ClassroomAssignedCourseListResponse:
    _ensure_enabled(locale)
    _require_teacher(current_user, locale)

    classroom = repository.get_teacher_classroom(session, classroom_id, current_user.user_id)
    if classroom is None:
        raise localized_http_exception(status.HTTP_404_NOT_FOUND, "CLASSROOM_NOT_FOUND", locale)

    links = repository.list_classroom_course_links(session, classroom.id)
    items: list[ClassroomAssignedCourseItem] = []
    for link in links:
        summary = _resolve_course_summary(
            session,
            course_id=link.course_id,
            locale=locale,
            teacher_id=current_user.user_id,
            include_unpublished_course=True,
        )
        if summary is None:
            continue
        title, difficulty = summary
        items.append(
            ClassroomAssignedCourseItem(
                course_id=link.course_id,
                title=title,
                difficulty=difficulty,
                assigned_at=link.assigned_at,
            )
        )

    return ClassroomAssignedCourseListResponse(items=items)


def get_teacher_classroom_detail(
    session: Session,
    classroom_id: UUID,
    current_user: CurrentUser,
    locale: str,
) -> ClassroomDetailResponse:
    _ensure_enabled(locale)
    _require_teacher(current_user, locale)

    classroom = repository.get_teacher_classroom(session, classroom_id, current_user.user_id)
    if classroom is None:
        raise localized_http_exception(status.HTTP_404_NOT_FOUND, "CLASSROOM_NOT_FOUND", locale)

    students = get_teacher_classroom_students(session, classroom.id, current_user, locale)
    courses = get_teacher_classroom_courses(session, classroom.id, current_user, locale)
    return ClassroomDetailResponse(
        classroom=_classroom_item(classroom),
        students=students.items,
        courses=courses.items,
    )


def list_teacher_course_assignments(
    session: Session,
    current_user: CurrentUser,
    locale: str,
) -> TeacherCourseAssignmentListResponse:
    _ensure_enabled(locale)
    _require_teacher(current_user, locale)

    classrooms = repository.list_teacher_classrooms(session, current_user.user_id)
    by_course: dict[UUID, TeacherCourseAssignmentItem] = {}

    for classroom in classrooms:
        links = repository.list_classroom_course_links(session, classroom.id)
        for link in links:
            summary = _resolve_course_summary(
                session,
                course_id=link.course_id,
                locale=locale,
                teacher_id=current_user.user_id,
                include_unpublished_course=True,
            )
            if summary is None:
                continue
            title, difficulty = summary

            existing = by_course.get(link.course_id)
            if existing is None:
                by_course[link.course_id] = TeacherCourseAssignmentItem(
                    course_id=link.course_id,
                    title=title,
                    difficulty=difficulty,
                    classroom_names=[classroom.name],
                )
            elif classroom.name not in existing.classroom_names:
                existing.classroom_names.append(classroom.name)

    return TeacherCourseAssignmentListResponse(items=list(by_course.values()))
