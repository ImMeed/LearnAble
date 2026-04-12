from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, Query, UploadFile, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.roles import UserRole, require_roles
from app.core.security import CurrentUser
from app.db.session import get_db_session
from app.modules.courses.schemas import CourseCreateResponse, CourseDetailResponse, CourseListItem, CourseStructureUpdate
from app.modules.courses.service import (
    course_assist,
    create_course_from_pdf,
    delete_course,
    get_course_for_teacher,
    get_published_course,
    list_published_courses_for_students,
    list_teacher_courses,
    publish_course,
    update_course_structure,
)


class CourseAssistRequest(BaseModel):
    question: str
    section_title: str = ""
    section_content: str = ""
    locale: str = "en"


class CourseAssistResponse(BaseModel):
    answer: str

teacher_router = APIRouter(prefix="/teacher/courses", tags=["courses"])
student_router = APIRouter(prefix="/courses", tags=["courses"])


@teacher_router.post("", response_model=CourseCreateResponse)
async def create_teacher_course(
    file: UploadFile = File(...),
    title: str = Form(...),
    language: str = Form(...),
    current_user: CurrentUser = Depends(require_roles(UserRole.ROLE_TUTOR)),
    session: Session = Depends(get_db_session),
) -> CourseCreateResponse:
    return await create_course_from_pdf(
        session,
        current_user,
        file=file,
        title=title,
        language=language,
    )


@teacher_router.get("", response_model=list[CourseListItem])
def list_teacher_courses_endpoint(
    current_user: CurrentUser = Depends(require_roles(UserRole.ROLE_TUTOR)),
    session: Session = Depends(get_db_session),
) -> list[CourseListItem]:
    return list_teacher_courses(session, current_user)


@teacher_router.get("/{course_id}", response_model=CourseDetailResponse)
def get_teacher_course(
    course_id: UUID,
    current_user: CurrentUser = Depends(require_roles(UserRole.ROLE_TUTOR)),
    session: Session = Depends(get_db_session),
) -> CourseDetailResponse:
    return get_course_for_teacher(session, current_user, course_id)


@teacher_router.patch("/{course_id}", response_model=CourseDetailResponse)
def patch_teacher_course(
    course_id: UUID,
    payload: CourseStructureUpdate,
    current_user: CurrentUser = Depends(require_roles(UserRole.ROLE_TUTOR)),
    session: Session = Depends(get_db_session),
) -> CourseDetailResponse:
    return update_course_structure(session, current_user, course_id, payload)


@teacher_router.post("/{course_id}/publish", response_model=CourseDetailResponse)
def publish_teacher_course(
    course_id: UUID,
    current_user: CurrentUser = Depends(require_roles(UserRole.ROLE_TUTOR)),
    session: Session = Depends(get_db_session),
) -> CourseDetailResponse:
    return publish_course(session, current_user, course_id)


@teacher_router.delete("/{course_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_teacher_course(
    course_id: UUID,
    current_user: CurrentUser = Depends(require_roles(UserRole.ROLE_TUTOR)),
    session: Session = Depends(get_db_session),
) -> None:
    delete_course(session, current_user, course_id)
    return None


@student_router.get("", response_model=list[CourseListItem])
def list_courses_endpoint(
    language: str | None = Query(None),
    current_user: CurrentUser = Depends(
        require_roles(
            UserRole.ROLE_STUDENT,
            UserRole.ROLE_TUTOR,
            UserRole.ROLE_PARENT,
            UserRole.ROLE_PSYCHOLOGIST,
            UserRole.ROLE_ADMIN,
        )
    ),
    session: Session = Depends(get_db_session),
) -> list[CourseListItem]:
    _ = current_user
    return list_published_courses_for_students(session, language)


@student_router.get("/{course_id}", response_model=CourseDetailResponse)
def get_course_endpoint(
    course_id: UUID,
    current_user: CurrentUser = Depends(
        require_roles(
            UserRole.ROLE_STUDENT,
            UserRole.ROLE_TUTOR,
            UserRole.ROLE_PARENT,
            UserRole.ROLE_PSYCHOLOGIST,
            UserRole.ROLE_ADMIN,
        )
    ),
    session: Session = Depends(get_db_session),
) -> CourseDetailResponse:
    _ = current_user
    return get_published_course(session, course_id)


@student_router.post("/{course_id}/assist", response_model=CourseAssistResponse)
def course_assist_endpoint(
    course_id: UUID,
    payload: CourseAssistRequest,
    current_user: CurrentUser = Depends(
        require_roles(
            UserRole.ROLE_STUDENT,
            UserRole.ROLE_TUTOR,
            UserRole.ROLE_PARENT,
            UserRole.ROLE_PSYCHOLOGIST,
            UserRole.ROLE_ADMIN,
        )
    ),
    session: Session = Depends(get_db_session),
) -> CourseAssistResponse:
    _ = current_user
    answer = course_assist(
        session,
        course_id=course_id,
        question=payload.question,
        section_title=payload.section_title,
        section_content=payload.section_content,
        locale=payload.locale,
    )
    return CourseAssistResponse(answer=answer)
