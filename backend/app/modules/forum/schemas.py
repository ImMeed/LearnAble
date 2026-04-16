from datetime import datetime
from enum import StrEnum
from uuid import UUID

from pydantic import BaseModel, Field

from app.db.models.forum import ForumPostStatus, ForumReportStatus, ForumTargetType


class ForumSpaceCreateRequest(BaseModel):
    slug: str = Field(min_length=3, max_length=80)
    name_ar: str = Field(min_length=2, max_length=160)
    name_en: str = Field(min_length=2, max_length=160)
    description_ar: str = Field(min_length=2, max_length=700)
    description_en: str = Field(min_length=2, max_length=700)


class ForumSpaceItem(BaseModel):
    id: UUID
    slug: str
    name: str
    description: str
    is_active: bool


class SpaceListResponse(BaseModel):
    items: list[ForumSpaceItem]


class ForumPostCreateRequest(BaseModel):
    title: str = Field(min_length=3, max_length=220)
    content: str = Field(min_length=3, max_length=4000)


class ForumPostItem(BaseModel):
    id: UUID
    space_id: UUID
    author_user_id: UUID
    title: str
    content: str
    status: ForumPostStatus
    is_locked: bool
    upvotes: int
    downvotes: int
    created_at: datetime


class ForumPostListResponse(BaseModel):
    items: list[ForumPostItem]


class ForumCommentCreateRequest(BaseModel):
    content: str = Field(min_length=2, max_length=2000)


class ForumCommentItem(BaseModel):
    id: UUID
    post_id: UUID
    author_user_id: UUID
    content: str
    status: ForumPostStatus
    upvotes: int
    downvotes: int
    created_at: datetime


class ForumCommentListResponse(BaseModel):
    items: list[ForumCommentItem]


class ForumVoteRequest(BaseModel):
    target_type: ForumTargetType
    target_id: UUID
    value: int = Field(ge=-1, le=1)


class ForumVoteResponse(BaseModel):
    target_type: ForumTargetType
    target_id: UUID
    value: int
    upvotes: int
    downvotes: int


class ForumReportCreateRequest(BaseModel):
    target_type: ForumTargetType
    target_id: UUID
    reason: str = Field(min_length=3, max_length=1000)


class ForumReportItem(BaseModel):
    id: UUID
    target_type: ForumTargetType
    target_id: UUID
    reporter_user_id: UUID
    reason: str
    status: ForumReportStatus
    reviewed_by_user_id: UUID | None
    review_notes: str | None
    created_at: datetime
    reviewed_at: datetime | None


class ForumReportListResponse(BaseModel):
    items: list[ForumReportItem]


class ForumModerationAction(StrEnum):
    HIDE = "HIDE"
    RESTORE = "RESTORE"
    REMOVE = "REMOVE"
    LOCK = "LOCK"
    UNLOCK = "UNLOCK"
    DISMISS = "DISMISS"


class ForumModerationRequest(BaseModel):
    action: ForumModerationAction
    review_notes: str | None = Field(default=None, max_length=1000)


class ForumModerationResponse(BaseModel):
    report_id: UUID
    report_status: ForumReportStatus
    target_type: ForumTargetType
    target_id: UUID
    target_status: ForumPostStatus | None
    is_locked: bool | None


class ForumCategory(StrEnum):
    TIPS = "tips"
    ASK = "ask"
    RESOURCES = "resources"


class ForumAuthorItem(BaseModel):
    id: UUID
    role: str
    display_name: str


class ForumFeedPostCreateRequest(BaseModel):
    category: ForumCategory
    title: str = Field(min_length=3, max_length=220)
    content: str = Field(min_length=3, max_length=4000)


class ForumReplyCreateRequest(BaseModel):
    content: str = Field(min_length=2, max_length=2000)


class ForumFeedPostItem(BaseModel):
    id: UUID
    category: ForumCategory
    title: str
    content: str
    status: ForumPostStatus
    is_pinned: bool
    is_locked: bool
    upvotes: int
    downvotes: int
    reply_count: int
    can_pin: bool
    author: ForumAuthorItem
    created_at: datetime


class ForumReplyItem(BaseModel):
    id: UUID
    content: str
    status: ForumPostStatus
    upvotes: int
    downvotes: int
    author: ForumAuthorItem
    created_at: datetime


class ForumFeedPostListResponse(BaseModel):
    items: list[ForumFeedPostItem]
    total: int
    page: int
    page_size: int
    total_pages: int


class ForumPostDetailResponse(BaseModel):
    post: ForumFeedPostItem
    replies: list[ForumReplyItem]


class ForumPinRequest(BaseModel):
    is_pinned: bool


class ForumPinResponse(BaseModel):
    post_id: UUID
    is_pinned: bool
