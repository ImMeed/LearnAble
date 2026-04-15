from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class ClassroomCreateRequest(BaseModel):
    name: str = Field(min_length=2, max_length=255)
    description: str | None = Field(default=None, max_length=1000)
    grade_tag: str | None = Field(default=None, max_length=80)


class ClassroomUpdateRequest(BaseModel):
    name: str = Field(min_length=2, max_length=255)
    description: str | None = Field(default=None, max_length=1000)
    grade_tag: str | None = Field(default=None, max_length=80)


class ClassroomItem(BaseModel):
    id: UUID
    name: str
    description: str | None = None
    grade_tag: str | None = None
    invite_code: str
    is_active: bool
    created_at: datetime
    updated_at: datetime


class ClassroomListResponse(BaseModel):
    items: list[ClassroomItem] = []


class ClassroomArchiveRequest(BaseModel):
    is_active: bool


class ClassroomRegenerateCodeResponse(BaseModel):
    classroom_id: UUID
    invite_code: str


class ClassroomJoinPreviewResponse(BaseModel):
    classroom_id: UUID
    classroom_name: str
    teacher_name: str
    teacher_id: UUID


class ClassroomJoinRequest(BaseModel):
    invite_code: str = Field(min_length=4, max_length=20, pattern=r"^[A-Za-z0-9-]+$")


class ClassroomJoinResponse(BaseModel):
    classroom_id: UUID
    classroom_name: str
    joined: bool


class ClassroomLeaveResponse(BaseModel):
    classroom_id: UUID
    left: bool


class ClassroomStudentItem(BaseModel):
    student_id: UUID
    student_label: str
    joined_at: datetime
    is_active: bool
    reading_support_status: str | None = None
    screening_support_level: str | None = None
    screening_composite_score: int | None = None


class ClassroomStudentListResponse(BaseModel):
    items: list[ClassroomStudentItem] = []


class ClassroomRemoveStudentRequest(BaseModel):
    student_id: UUID


class ClassroomAssignCourseRequest(BaseModel):
    course_id: UUID


class ClassroomAssignedCourseItem(BaseModel):
    course_id: UUID
    title: str
    difficulty: str
    assigned_at: datetime


class ClassroomAssignedCourseListResponse(BaseModel):
    items: list[ClassroomAssignedCourseItem] = []


class ClassroomDetailResponse(BaseModel):
    classroom: ClassroomItem
    students: list[ClassroomStudentItem] = []
    courses: list[ClassroomAssignedCourseItem] = []


class TeacherCourseAssignmentItem(BaseModel):
    course_id: UUID
    title: str
    difficulty: str
    classroom_names: list[str] = []


class TeacherCourseAssignmentListResponse(BaseModel):
    items: list[TeacherCourseAssignmentItem] = []


class StudentClassroomItem(BaseModel):
    classroom_id: UUID
    classroom_name: str
    teacher_name: str
    joined_at: datetime
    courses: list[str] = []


class StudentClassroomListResponse(BaseModel):
    items: list[StudentClassroomItem] = []
