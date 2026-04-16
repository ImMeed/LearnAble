from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session

from app.core.i18n import get_request_locale
from app.core.roles import UserRole, require_roles
from app.core.security import CurrentUser, get_current_user
from app.db.session import get_db_session
from app.modules.forum.schemas import (
    ForumCategory,
    ForumCommentCreateRequest,
    ForumCommentItem,
    ForumCommentListResponse,
    ForumFeedPostCreateRequest,
    ForumFeedPostItem,
    ForumFeedPostListResponse,
    ForumModerationRequest,
    ForumModerationResponse,
    ForumPinRequest,
    ForumPinResponse,
    ForumPostDetailResponse,
    ForumPostCreateRequest,
    ForumPostItem,
    ForumPostListResponse,
    ForumReplyCreateRequest,
    ForumReplyItem,
    ForumReportCreateRequest,
    ForumReportItem,
    ForumReportListResponse,
    ForumSpaceCreateRequest,
    ForumSpaceItem,
    ForumVoteRequest,
    ForumVoteResponse,
    SpaceListResponse,
)
from app.modules.forum.service import (
    cast_vote,
    create_comment,
    create_feed_post,
    create_feed_reply,
    create_post,
    create_report,
    create_space,
    get_feed_post_detail,
    list_feed_posts,
    list_comments,
    list_posts,
    list_reports,
    list_spaces,
    moderate_report,
    set_post_pin,
)

router = APIRouter(prefix="/forum", tags=["forum"])


@router.get("/posts", response_model=ForumFeedPostListResponse)
def list_feed_forum_posts(
    request: Request,
    category: ForumCategory | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=50),
    include_moderated: bool = Query(default=False),
    current_user: CurrentUser = Depends(get_current_user),
    session: Session = Depends(get_db_session),
) -> ForumFeedPostListResponse:
    return list_feed_posts(
        session,
        current_user,
        get_request_locale(request),
        category=category,
        page=page,
        page_size=page_size,
        include_moderated=include_moderated,
    )


@router.post("/posts", response_model=ForumFeedPostItem)
def create_feed_forum_post(
    payload: ForumFeedPostCreateRequest,
    request: Request,
    current_user: CurrentUser = Depends(
        require_roles(
            UserRole.ROLE_STUDENT,
            UserRole.ROLE_PARENT,
            UserRole.ROLE_TUTOR,
            UserRole.ROLE_PSYCHOLOGIST,
        )
    ),
    session: Session = Depends(get_db_session),
) -> ForumFeedPostItem:
    return create_feed_post(session, payload, current_user, get_request_locale(request))


@router.get("/posts/{post_id}", response_model=ForumPostDetailResponse)
def get_feed_forum_post_detail(
    post_id: UUID,
    request: Request,
    include_moderated: bool = Query(default=False),
    current_user: CurrentUser = Depends(get_current_user),
    session: Session = Depends(get_db_session),
) -> ForumPostDetailResponse:
    return get_feed_post_detail(
        session,
        post_id,
        current_user,
        get_request_locale(request),
        include_moderated=include_moderated,
    )


@router.post("/posts/{post_id}/reply", response_model=ForumReplyItem)
def create_feed_forum_reply(
    post_id: UUID,
    payload: ForumReplyCreateRequest,
    request: Request,
    current_user: CurrentUser = Depends(
        require_roles(
            UserRole.ROLE_STUDENT,
            UserRole.ROLE_PARENT,
            UserRole.ROLE_TUTOR,
            UserRole.ROLE_PSYCHOLOGIST,
        )
    ),
    session: Session = Depends(get_db_session),
) -> ForumReplyItem:
    return create_feed_reply(session, post_id, payload, current_user, get_request_locale(request))


@router.patch("/posts/{post_id}/pin", response_model=ForumPinResponse)
def patch_feed_forum_post_pin(
    post_id: UUID,
    payload: ForumPinRequest,
    request: Request,
    current_user: CurrentUser = Depends(require_roles(UserRole.ROLE_TUTOR, UserRole.ROLE_PSYCHOLOGIST)),
    session: Session = Depends(get_db_session),
) -> ForumPinResponse:
    return set_post_pin(session, post_id, payload, current_user, get_request_locale(request))


@router.get("/spaces", response_model=SpaceListResponse)
def list_forum_spaces(
    request: Request,
    _current_user: CurrentUser = Depends(get_current_user),
    session: Session = Depends(get_db_session),
) -> SpaceListResponse:
    return list_spaces(session, get_request_locale(request))


@router.post("/spaces", response_model=ForumSpaceItem)
def create_forum_space(
    payload: ForumSpaceCreateRequest,
    request: Request,
    _current_user: CurrentUser = Depends(require_roles(UserRole.ROLE_ADMIN)),
    session: Session = Depends(get_db_session),
) -> ForumSpaceItem:
    return create_space(session, payload, get_request_locale(request))


@router.get("/spaces/{space_id}/posts", response_model=ForumPostListResponse)
def list_forum_posts(
    space_id: UUID,
    request: Request,
    include_moderated: bool = Query(default=False),
    current_user: CurrentUser = Depends(get_current_user),
    session: Session = Depends(get_db_session),
) -> ForumPostListResponse:
    return list_posts(session, space_id, current_user, get_request_locale(request), include_moderated)


@router.post("/spaces/{space_id}/posts", response_model=ForumPostItem)
def create_forum_post(
    space_id: UUID,
    payload: ForumPostCreateRequest,
    request: Request,
    current_user: CurrentUser = Depends(require_roles(UserRole.ROLE_STUDENT, UserRole.ROLE_TUTOR)),
    session: Session = Depends(get_db_session),
) -> ForumPostItem:
    return create_post(session, space_id, payload, current_user, get_request_locale(request))


@router.get("/posts/{post_id}/comments", response_model=ForumCommentListResponse)
def list_forum_comments(
    post_id: UUID,
    request: Request,
    include_moderated: bool = Query(default=False),
    current_user: CurrentUser = Depends(get_current_user),
    session: Session = Depends(get_db_session),
) -> ForumCommentListResponse:
    return list_comments(session, post_id, current_user, get_request_locale(request), include_moderated)


@router.post("/posts/{post_id}/comments", response_model=ForumCommentItem)
def create_forum_comment(
    post_id: UUID,
    payload: ForumCommentCreateRequest,
    request: Request,
    current_user: CurrentUser = Depends(require_roles(UserRole.ROLE_STUDENT, UserRole.ROLE_TUTOR)),
    session: Session = Depends(get_db_session),
) -> ForumCommentItem:
    return create_comment(session, post_id, payload, current_user, get_request_locale(request))


@router.post("/votes", response_model=ForumVoteResponse)
def vote_forum_target(
    payload: ForumVoteRequest,
    request: Request,
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
) -> ForumVoteResponse:
    return cast_vote(session, payload, current_user, get_request_locale(request))


@router.post("/reports", response_model=ForumReportItem)
def create_forum_report(
    payload: ForumReportCreateRequest,
    request: Request,
    current_user: CurrentUser = Depends(get_current_user),
    session: Session = Depends(get_db_session),
) -> ForumReportItem:
    return create_report(session, payload, current_user, get_request_locale(request))


@router.get("/reports", response_model=ForumReportListResponse)
def list_forum_reports(
    only_open: bool = Query(default=True),
    _current_user: CurrentUser = Depends(require_roles(UserRole.ROLE_TUTOR, UserRole.ROLE_ADMIN)),
    session: Session = Depends(get_db_session),
) -> ForumReportListResponse:
    return list_reports(session, only_open)


@router.post("/reports/{report_id}/moderate", response_model=ForumModerationResponse)
def moderate_forum_report(
    report_id: UUID,
    payload: ForumModerationRequest,
    request: Request,
    current_user: CurrentUser = Depends(require_roles(UserRole.ROLE_TUTOR, UserRole.ROLE_ADMIN)),
    session: Session = Depends(get_db_session),
) -> ForumModerationResponse:
    return moderate_report(session, report_id, payload, current_user, get_request_locale(request))
