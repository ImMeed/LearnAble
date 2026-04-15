from uuid import UUID

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.core.i18n import get_request_locale
from app.core.roles import UserRole, require_roles
from app.core.security import CurrentUser
from app.db.session import get_db_session
from app.modules.classrooms.schemas import (
    ClassroomArchiveRequest,
    ClassroomAssignCourseRequest,
    ClassroomDetailResponse,
    ClassroomAssignedCourseListResponse,
    ClassroomCreateRequest,
    ClassroomItem,
    ClassroomJoinPreviewResponse,
    ClassroomJoinRequest,
    ClassroomJoinResponse,
    ClassroomLeaveResponse,
    ClassroomListResponse,
    ClassroomRegenerateCodeResponse,
    ClassroomRemoveStudentRequest,
    ClassroomStudentListResponse,
    ClassroomUpdateRequest,
    StudentClassroomListResponse,
    TeacherCourseAssignmentListResponse,
)
from app.modules.classrooms.service import (
    archive_teacher_classroom,
    assign_course_to_teacher_classroom,
    classroom_join,
    classroom_join_preview,
    create_teacher_classroom,
    get_teacher_classroom_courses,
    get_teacher_classroom_detail,
    get_teacher_classroom_students,
    list_student_classrooms,
    list_teacher_classrooms,
    list_teacher_course_assignments,
    regenerate_invite_code,
    remove_student_from_teacher_classroom,
    student_leave_classroom,
    update_teacher_classroom,
)


router = APIRouter(prefix="/classrooms", tags=["classrooms"])


@router.get("/teacher", response_model=ClassroomListResponse)
def teacher_list(
    request: Request,
    current_user: CurrentUser = Depends(require_roles(UserRole.ROLE_TUTOR)),
    session: Session = Depends(get_db_session),
) -> ClassroomListResponse:
    return list_teacher_classrooms(session, current_user, get_request_locale(request))


@router.post("/teacher", response_model=ClassroomItem)
def teacher_create(
    payload: ClassroomCreateRequest,
    request: Request,
    current_user: CurrentUser = Depends(require_roles(UserRole.ROLE_TUTOR)),
    session: Session = Depends(get_db_session),
) -> ClassroomItem:
    return create_teacher_classroom(session, payload, current_user, get_request_locale(request))


@router.put("/teacher/{classroom_id}", response_model=ClassroomItem)
def teacher_update(
    classroom_id: UUID,
    payload: ClassroomUpdateRequest,
    request: Request,
    current_user: CurrentUser = Depends(require_roles(UserRole.ROLE_TUTOR)),
    session: Session = Depends(get_db_session),
) -> ClassroomItem:
    return update_teacher_classroom(session, classroom_id, payload, current_user, get_request_locale(request))


@router.patch("/teacher/{classroom_id}/archive", response_model=ClassroomItem)
def teacher_archive(
    classroom_id: UUID,
    payload: ClassroomArchiveRequest,
    request: Request,
    current_user: CurrentUser = Depends(require_roles(UserRole.ROLE_TUTOR)),
    session: Session = Depends(get_db_session),
) -> ClassroomItem:
    return archive_teacher_classroom(session, classroom_id, payload, current_user, get_request_locale(request))


@router.post("/teacher/{classroom_id}/invite-code/regenerate", response_model=ClassroomRegenerateCodeResponse)
def teacher_regenerate_code(
    classroom_id: UUID,
    request: Request,
    current_user: CurrentUser = Depends(require_roles(UserRole.ROLE_TUTOR)),
    session: Session = Depends(get_db_session),
) -> ClassroomRegenerateCodeResponse:
    return regenerate_invite_code(session, classroom_id, current_user, get_request_locale(request))


@router.get("/teacher/{classroom_id}/students", response_model=ClassroomStudentListResponse)
def teacher_students(
    classroom_id: UUID,
    request: Request,
    current_user: CurrentUser = Depends(require_roles(UserRole.ROLE_TUTOR)),
    session: Session = Depends(get_db_session),
) -> ClassroomStudentListResponse:
    return get_teacher_classroom_students(session, classroom_id, current_user, get_request_locale(request))


@router.get("/teacher/{classroom_id}/detail", response_model=ClassroomDetailResponse)
def teacher_classroom_detail(
    classroom_id: UUID,
    request: Request,
    current_user: CurrentUser = Depends(require_roles(UserRole.ROLE_TUTOR)),
    session: Session = Depends(get_db_session),
) -> ClassroomDetailResponse:
    return get_teacher_classroom_detail(session, classroom_id, current_user, get_request_locale(request))


@router.post("/teacher/{classroom_id}/students/remove", response_model=ClassroomLeaveResponse)
def teacher_remove_student(
    classroom_id: UUID,
    payload: ClassroomRemoveStudentRequest,
    request: Request,
    current_user: CurrentUser = Depends(require_roles(UserRole.ROLE_TUTOR)),
    session: Session = Depends(get_db_session),
) -> ClassroomLeaveResponse:
    return remove_student_from_teacher_classroom(session, classroom_id, payload, current_user, get_request_locale(request))


@router.get("/teacher/{classroom_id}/courses", response_model=ClassroomAssignedCourseListResponse)
def teacher_courses(
    classroom_id: UUID,
    request: Request,
    current_user: CurrentUser = Depends(require_roles(UserRole.ROLE_TUTOR)),
    session: Session = Depends(get_db_session),
) -> ClassroomAssignedCourseListResponse:
    return get_teacher_classroom_courses(session, classroom_id, current_user, get_request_locale(request))


@router.post("/teacher/{classroom_id}/courses/assign", response_model=ClassroomAssignedCourseListResponse)
def teacher_assign_course(
    classroom_id: UUID,
    payload: ClassroomAssignCourseRequest,
    request: Request,
    current_user: CurrentUser = Depends(require_roles(UserRole.ROLE_TUTOR)),
    session: Session = Depends(get_db_session),
) -> ClassroomAssignedCourseListResponse:
    return assign_course_to_teacher_classroom(session, classroom_id, payload, current_user, get_request_locale(request))


@router.get("/teacher/course-assignments", response_model=TeacherCourseAssignmentListResponse)
def teacher_course_assignments(
    request: Request,
    current_user: CurrentUser = Depends(require_roles(UserRole.ROLE_TUTOR)),
    session: Session = Depends(get_db_session),
) -> TeacherCourseAssignmentListResponse:
    return list_teacher_course_assignments(session, current_user, get_request_locale(request))


@router.post("/student/join/preview", response_model=ClassroomJoinPreviewResponse)
def student_join_preview(
    payload: ClassroomJoinRequest,
    request: Request,
    current_user: CurrentUser = Depends(require_roles(UserRole.ROLE_STUDENT)),
    session: Session = Depends(get_db_session),
) -> ClassroomJoinPreviewResponse:
    return classroom_join_preview(session, payload, current_user, get_request_locale(request))


@router.post("/student/join", response_model=ClassroomJoinResponse)
def student_join(
    payload: ClassroomJoinRequest,
    request: Request,
    current_user: CurrentUser = Depends(require_roles(UserRole.ROLE_STUDENT)),
    session: Session = Depends(get_db_session),
) -> ClassroomJoinResponse:
    return classroom_join(session, payload, current_user, get_request_locale(request))


@router.get("/student/me", response_model=StudentClassroomListResponse)
def student_list(
    request: Request,
    current_user: CurrentUser = Depends(require_roles(UserRole.ROLE_STUDENT)),
    session: Session = Depends(get_db_session),
) -> StudentClassroomListResponse:
    return list_student_classrooms(session, current_user, get_request_locale(request))


@router.post("/student/{classroom_id}/leave", response_model=ClassroomLeaveResponse)
def student_leave(
    classroom_id: UUID,
    request: Request,
    current_user: CurrentUser = Depends(require_roles(UserRole.ROLE_STUDENT)),
    session: Session = Depends(get_db_session),
) -> ClassroomLeaveResponse:
    return student_leave_classroom(session, classroom_id, current_user, get_request_locale(request))
