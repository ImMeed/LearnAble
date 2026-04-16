from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


class ImageSchema(BaseModel):
    url: str
    caption: str


class ResourceSchema(BaseModel):
    title: str
    url: str


class SubsectionSchema(BaseModel):
    id: str = ""
    title: str
    content: str
    video_url: Optional[str] = None
    audio_url: Optional[str] = None
    resources: list[ResourceSchema] = []
    images: list[ImageSchema] = []


class SectionSchema(BaseModel):
    id: str = ""
    title: str
    content: str
    video_url: Optional[str] = None
    audio_url: Optional[str] = None
    resources: list[ResourceSchema] = []
    images: list[ImageSchema] = []
    subsections: list[SubsectionSchema] = []


class ChapterSchema(BaseModel):
    id: str = ""
    title: str
    sections: list[SectionSchema] = []


class CourseStructure(BaseModel):
    page_count: int
    chapters: list[ChapterSchema]


class CourseCreateResponse(BaseModel):
    id: UUID
    title: str
    language: str
    status: str
    source_filename: Optional[str]
    source_page_count: Optional[int]
    structure_json: Optional[dict]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class CourseListItem(BaseModel):
    id: UUID
    title: str
    language: str
    status: str
    source_page_count: Optional[int]
    created_at: datetime

    model_config = {"from_attributes": True}


class CourseDetailResponse(CourseCreateResponse):
    pass


class CourseStructureUpdate(BaseModel):
    title: Optional[str] = Field(default=None, max_length=255)
    structure_json: Optional[dict] = None


class AssistRequest(BaseModel):
    section_id: str
    question: str = Field(max_length=500)


class AssistResponse(BaseModel):
    answer: str


class BlankCourseRequest(BaseModel):
    title: str
    language: str


# ── Phase 2 schemas ────────────────────────────────────────────────────────────

class ProgressResponse(BaseModel):
    completed_section_ids: list[str]
    last_section_id: Optional[str]


class LastVisitedRequest(BaseModel):
    section_id: str


class QuizAttemptRequest(BaseModel):
    score: int
    total: int


class QuizAttemptResponse(BaseModel):
    id: UUID
    score: int
    total: int
    attempted_at: datetime

    model_config = {"from_attributes": True}
