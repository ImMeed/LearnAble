from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class SubsectionSchema(BaseModel):
    title: str
    content: str = ""


class SectionSchema(BaseModel):
    title: str
    content: str = ""
    subsections: list[SubsectionSchema] = Field(default_factory=list)


class ChapterSchema(BaseModel):
    title: str
    sections: list[SectionSchema] = Field(default_factory=list)


class CourseStructure(BaseModel):
    page_count: int
    chapters: list[ChapterSchema] = Field(default_factory=list)


class CourseCreateResponse(BaseModel):
    id: UUID
    title: str
    language: str
    status: str
    source_filename: str
    source_page_count: int
    structure_json: dict
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class CourseListItem(BaseModel):
    id: UUID
    title: str
    language: str
    status: str
    source_page_count: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class CourseDetailResponse(BaseModel):
    id: UUID
    title: str
    language: str
    status: str
    source_filename: str
    source_page_count: int
    structure_json: dict
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class CourseMetadataUpdate(BaseModel):
    title: str | None = None


class CourseStructureUpdate(BaseModel):
    title: str | None = None
    structure_json: dict | None = None
