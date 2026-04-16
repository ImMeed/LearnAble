from uuid import UUID

from fastapi import status
from sqlalchemy.orm import Session

from app.core.i18n import localized_http_exception
from app.core.roles import UserRole
from app.core.security import CurrentUser
from app.db.models.forum import ForumPostStatus, ForumReportStatus, ForumSpace, ForumTargetType
from app.db.models.users import User
from app.modules.forum import repository
from app.modules.forum.schemas import (
    ForumAuthorItem,
    ForumCategory,
    ForumCommentCreateRequest,
    ForumCommentItem,
    ForumCommentListResponse,
    ForumFeedPostCreateRequest,
    ForumFeedPostItem,
    ForumFeedPostListResponse,
    ForumModerationAction,
    ForumModerationRequest,
    ForumModerationResponse,
    ForumPinRequest,
    ForumPinResponse,
    ForumPostCreateRequest,
    ForumPostDetailResponse,
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


_CATEGORY_TO_SPACE_SLUG: dict[ForumCategory, str] = {
    ForumCategory.TIPS: "tips",
    ForumCategory.ASK: "ask",
    ForumCategory.RESOURCES: "resources",
}

_SPACE_SLUG_TO_CATEGORY: dict[str, ForumCategory] = {slug: category for category, slug in _CATEGORY_TO_SPACE_SLUG.items()}

_CATEGORY_WRITE_ROLES: dict[ForumCategory, set[UserRole]] = {
    ForumCategory.TIPS: {UserRole.ROLE_PARENT, UserRole.ROLE_TUTOR, UserRole.ROLE_PSYCHOLOGIST},
    ForumCategory.ASK: {
        UserRole.ROLE_STUDENT,
        UserRole.ROLE_PARENT,
        UserRole.ROLE_TUTOR,
        UserRole.ROLE_PSYCHOLOGIST,
    },
    ForumCategory.RESOURCES: {UserRole.ROLE_TUTOR, UserRole.ROLE_PSYCHOLOGIST},
}

_PIN_ROLES = {UserRole.ROLE_TUTOR, UserRole.ROLE_PSYCHOLOGIST}


def _is_moderator(current_user: CurrentUser) -> bool:
    return current_user.role in {UserRole.ROLE_TUTOR, UserRole.ROLE_ADMIN}


def _map_space(locale: str, item) -> ForumSpaceItem:
    return ForumSpaceItem(
        id=item.id,
        slug=item.slug,
        name=item.name_en if locale == "en" else item.name_ar,
        description=item.description_en if locale == "en" else item.description_ar,
        is_active=item.is_active,
    )


def _map_post(item) -> ForumPostItem:
    return ForumPostItem(
        id=item.id,
        space_id=item.space_id,
        author_user_id=item.author_user_id,
        title=item.title,
        content=item.content,
        status=item.status,
        is_locked=item.is_locked,
        upvotes=item.upvotes,
        downvotes=item.downvotes,
        created_at=item.created_at,
    )


def _map_comment(item) -> ForumCommentItem:
    return ForumCommentItem(
        id=item.id,
        post_id=item.post_id,
        author_user_id=item.author_user_id,
        content=item.content,
        status=item.status,
        upvotes=item.upvotes,
        downvotes=item.downvotes,
        created_at=item.created_at,
    )


def _map_report(item) -> ForumReportItem:
    return ForumReportItem(
        id=item.id,
        target_type=item.target_type,
        target_id=item.target_id,
        reporter_user_id=item.reporter_user_id,
        reason=item.reason,
        status=item.status,
        reviewed_by_user_id=item.reviewed_by_user_id,
        review_notes=item.review_notes,
        created_at=item.created_at,
        reviewed_at=item.reviewed_at,
    )


def _resolve_role(current_user: CurrentUser, locale: str) -> UserRole:
    try:
        return UserRole(current_user.role)
    except ValueError as exc:
        raise localized_http_exception(status.HTTP_403_FORBIDDEN, "FORBIDDEN", locale) from exc


def _display_name_from_email(email: str) -> str:
    local = email.split("@", maxsplit=1)[0].strip()
    return local or "learnable-user"


def _map_author(user_id: UUID, user: User | None) -> ForumAuthorItem:
    if user is None:
        return ForumAuthorItem(id=user_id, role="ROLE_STUDENT", display_name="learnable-user")
    return ForumAuthorItem(id=user.id, role=str(user.role), display_name=_display_name_from_email(user.email))


def _map_feed_post(
    *,
    post,
    category: ForumCategory,
    author: ForumAuthorItem,
    reply_count: int,
    can_pin: bool,
) -> ForumFeedPostItem:
    return ForumFeedPostItem(
        id=post.id,
        category=category,
        title=post.title,
        content=post.content,
        status=post.status,
        is_pinned=post.is_pinned,
        is_locked=post.is_locked,
        upvotes=post.upvotes,
        downvotes=post.downvotes,
        reply_count=reply_count,
        can_pin=can_pin,
        author=author,
        created_at=post.created_at,
    )


def _category_from_space_slug(slug: str) -> ForumCategory | None:
    return _SPACE_SLUG_TO_CATEGORY.get(slug)


def _validate_category_write_access(category: ForumCategory, current_user: CurrentUser, locale: str) -> UserRole:
    role = _resolve_role(current_user, locale)
    if role not in _CATEGORY_WRITE_ROLES[category]:
        raise localized_http_exception(status.HTTP_403_FORBIDDEN, "FORUM_CATEGORY_FORBIDDEN", locale)
    return role


def _forum_spaces_by_category(session: Session) -> dict[ForumCategory, ForumSpace]:
    spaces = repository.list_spaces_by_slugs(session, list(_CATEGORY_TO_SPACE_SLUG.values()))
    mapping: dict[ForumCategory, ForumSpace] = {}
    for space in spaces:
        category = _category_from_space_slug(space.slug)
        if category is not None:
            mapping[category] = space
    return mapping


def list_spaces(session: Session, locale: str) -> SpaceListResponse:
    spaces = repository.list_spaces(session, active_only=True)
    return SpaceListResponse(items=[_map_space(locale, item) for item in spaces])


def create_space(session: Session, payload: ForumSpaceCreateRequest, locale: str) -> ForumSpaceItem:
    space = repository.create_space(
        session=session,
        slug=payload.slug.strip().lower(),
        name_ar=payload.name_ar.strip(),
        name_en=payload.name_en.strip(),
        description_ar=payload.description_ar.strip(),
        description_en=payload.description_en.strip(),
    )
    session.commit()
    return _map_space(locale, space)


def list_posts(
    session: Session,
    space_id: UUID,
    current_user: CurrentUser,
    locale: str,
    include_moderated: bool,
) -> ForumPostListResponse:
    space = repository.get_space_by_id(session, space_id)
    if space is None or (not space.is_active and not _is_moderator(current_user)):
        raise localized_http_exception(status.HTTP_404_NOT_FOUND, "FORUM_SPACE_NOT_FOUND", locale)

    moderated = include_moderated and _is_moderator(current_user)
    posts = repository.list_posts(session, space_id, include_moderated=moderated)
    return ForumPostListResponse(items=[_map_post(item) for item in posts])


def create_post(
    session: Session,
    space_id: UUID,
    payload: ForumPostCreateRequest,
    current_user: CurrentUser,
    locale: str,
) -> ForumPostItem:
    space = repository.get_space_by_id(session, space_id)
    if space is None or not space.is_active:
        raise localized_http_exception(status.HTTP_404_NOT_FOUND, "FORUM_SPACE_NOT_FOUND", locale)

    post = repository.create_post(
        session=session,
        space_id=space_id,
        author_user_id=current_user.user_id,
        title=payload.title.strip(),
        content=payload.content.strip(),
    )
    session.commit()
    return _map_post(post)


def list_comments(
    session: Session,
    post_id: UUID,
    current_user: CurrentUser,
    locale: str,
    include_moderated: bool,
) -> ForumCommentListResponse:
    post = repository.get_post_by_id(session, post_id)
    if post is None:
        raise localized_http_exception(status.HTTP_404_NOT_FOUND, "FORUM_POST_NOT_FOUND", locale)

    if post.status != ForumPostStatus.ACTIVE and not _is_moderator(current_user):
        raise localized_http_exception(status.HTTP_404_NOT_FOUND, "FORUM_POST_NOT_FOUND", locale)

    moderated = include_moderated and _is_moderator(current_user)
    comments = repository.list_comments(session, post_id, include_moderated=moderated)
    return ForumCommentListResponse(items=[_map_comment(item) for item in comments])


def create_comment(
    session: Session,
    post_id: UUID,
    payload: ForumCommentCreateRequest,
    current_user: CurrentUser,
    locale: str,
) -> ForumCommentItem:
    post = repository.get_post_by_id(session, post_id)
    if post is None or post.status != ForumPostStatus.ACTIVE:
        raise localized_http_exception(status.HTTP_404_NOT_FOUND, "FORUM_POST_NOT_FOUND", locale)
    if post.is_locked:
        raise localized_http_exception(status.HTTP_400_BAD_REQUEST, "FORUM_POST_LOCKED", locale)

    comment = repository.create_comment(
        session=session,
        post_id=post_id,
        author_user_id=current_user.user_id,
        content=payload.content.strip(),
    )
    session.commit()
    return _map_comment(comment)


def cast_vote(session: Session, payload: ForumVoteRequest, current_user: CurrentUser, locale: str) -> ForumVoteResponse:
    if payload.value not in (-1, 1):
        raise localized_http_exception(status.HTTP_400_BAD_REQUEST, "FORUM_VOTE_VALUE_INVALID", locale)

    up_delta = 0
    down_delta = 0
    if payload.target_type == ForumTargetType.POST:
        target = repository.get_post_by_id(session, payload.target_id)
        if target is None:
            raise localized_http_exception(status.HTTP_404_NOT_FOUND, "FORUM_POST_NOT_FOUND", locale)
    elif payload.target_type == ForumTargetType.COMMENT:
        target = repository.get_comment_by_id(session, payload.target_id)
        if target is None:
            raise localized_http_exception(status.HTTP_404_NOT_FOUND, "FORUM_COMMENT_NOT_FOUND", locale)
    else:
        raise localized_http_exception(status.HTTP_400_BAD_REQUEST, "FORUM_TARGET_TYPE_INVALID", locale)

    previous_value, vote = repository.upsert_vote(
        session=session,
        user_id=current_user.user_id,
        target_type=payload.target_type,
        target_id=payload.target_id,
        value=payload.value,
    )
    if previous_value is None:
        if payload.value == 1:
            up_delta = 1
        else:
            down_delta = 1
    elif previous_value != payload.value:
        if payload.value == 1:
            up_delta = 1
            down_delta = -1
        else:
            up_delta = -1
            down_delta = 1

    if payload.target_type == ForumTargetType.POST:
        target = repository.update_post_vote_totals(session, target, up_delta, down_delta)
    else:
        target = repository.update_comment_vote_totals(session, target, up_delta, down_delta)

    session.commit()
    return ForumVoteResponse(
        target_type=vote.target_type,
        target_id=vote.target_id,
        value=vote.value,
        upvotes=target.upvotes,
        downvotes=target.downvotes,
    )


def create_report(
    session: Session,
    payload: ForumReportCreateRequest,
    current_user: CurrentUser,
    locale: str,
) -> ForumReportItem:
    if payload.target_type == ForumTargetType.POST:
        if repository.get_post_by_id(session, payload.target_id) is None:
            raise localized_http_exception(status.HTTP_404_NOT_FOUND, "FORUM_POST_NOT_FOUND", locale)
    elif payload.target_type == ForumTargetType.COMMENT:
        if repository.get_comment_by_id(session, payload.target_id) is None:
            raise localized_http_exception(status.HTTP_404_NOT_FOUND, "FORUM_COMMENT_NOT_FOUND", locale)
    else:
        raise localized_http_exception(status.HTTP_400_BAD_REQUEST, "FORUM_TARGET_TYPE_INVALID", locale)

    report = repository.create_report(
        session=session,
        target_type=payload.target_type,
        target_id=payload.target_id,
        reporter_user_id=current_user.user_id,
        reason=payload.reason.strip(),
    )
    session.commit()
    return _map_report(report)


def list_reports(session: Session, only_open: bool) -> ForumReportListResponse:
    records = repository.list_reports(session, ForumReportStatus.OPEN if only_open else None)
    return ForumReportListResponse(items=[_map_report(item) for item in records])


def moderate_report(
    session: Session,
    report_id: UUID,
    payload: ForumModerationRequest,
    current_user: CurrentUser,
    locale: str,
) -> ForumModerationResponse:
    report = repository.get_report_by_id(session, report_id)
    if report is None:
        raise localized_http_exception(status.HTTP_404_NOT_FOUND, "FORUM_REPORT_NOT_FOUND", locale)

    target_status = None
    is_locked = None
    if report.target_type == ForumTargetType.POST:
        target = repository.get_post_by_id(session, report.target_id)
        if target is None:
            raise localized_http_exception(status.HTTP_404_NOT_FOUND, "FORUM_POST_NOT_FOUND", locale)
        if payload.action == ForumModerationAction.HIDE:
            target.status = ForumPostStatus.HIDDEN
        elif payload.action == ForumModerationAction.RESTORE:
            target.status = ForumPostStatus.ACTIVE
        elif payload.action == ForumModerationAction.REMOVE:
            target.status = ForumPostStatus.REMOVED
        elif payload.action == ForumModerationAction.LOCK:
            target.is_locked = True
        elif payload.action == ForumModerationAction.UNLOCK:
            target.is_locked = False
        elif payload.action == ForumModerationAction.DISMISS:
            pass
        else:
            raise localized_http_exception(status.HTTP_400_BAD_REQUEST, "FORUM_MODERATION_ACTION_INVALID", locale)
        repository.update_post_vote_totals(session, target, 0, 0)
        target_status = target.status
        is_locked = target.is_locked
    elif report.target_type == ForumTargetType.COMMENT:
        target = repository.get_comment_by_id(session, report.target_id)
        if target is None:
            raise localized_http_exception(status.HTTP_404_NOT_FOUND, "FORUM_COMMENT_NOT_FOUND", locale)
        if payload.action == ForumModerationAction.HIDE:
            target.status = ForumPostStatus.HIDDEN
        elif payload.action == ForumModerationAction.RESTORE:
            target.status = ForumPostStatus.ACTIVE
        elif payload.action == ForumModerationAction.REMOVE:
            target.status = ForumPostStatus.REMOVED
        elif payload.action in {ForumModerationAction.LOCK, ForumModerationAction.UNLOCK}:
            raise localized_http_exception(status.HTTP_400_BAD_REQUEST, "FORUM_MODERATION_ACTION_INVALID", locale)
        elif payload.action == ForumModerationAction.DISMISS:
            pass
        else:
            raise localized_http_exception(status.HTTP_400_BAD_REQUEST, "FORUM_MODERATION_ACTION_INVALID", locale)
        repository.update_comment_vote_totals(session, target, 0, 0)
        target_status = target.status

    report_status = ForumReportStatus.DISMISSED if payload.action == ForumModerationAction.DISMISS else ForumReportStatus.RESOLVED
    report = repository.apply_report_resolution(
        session=session,
        report=report,
        reviewer_user_id=current_user.user_id,
        report_status=report_status,
        review_notes=payload.review_notes,
    )
    session.commit()
    return ForumModerationResponse(
        report_id=report.id,
        report_status=report.status,
        target_type=report.target_type,
        target_id=report.target_id,
        target_status=target_status,
        is_locked=is_locked,
    )


def list_feed_posts(
    session: Session,
    current_user: CurrentUser,
    locale: str,
    *,
    category: ForumCategory | None,
    page: int,
    page_size: int,
    include_moderated: bool,
) -> ForumFeedPostListResponse:
    role = _resolve_role(current_user, locale)
    can_pin = role in _PIN_ROLES
    moderated = include_moderated and _is_moderator(current_user)

    spaces_by_category = _forum_spaces_by_category(session)
    if category is not None:
        target_space = spaces_by_category.get(category)
        if target_space is None:
            raise localized_http_exception(status.HTTP_404_NOT_FOUND, "FORUM_CATEGORY_NOT_FOUND", locale)
        spaces = [target_space]
    else:
        spaces = list(spaces_by_category.values())

    if not spaces:
        return ForumFeedPostListResponse(items=[], total=0, page=1, page_size=page_size, total_pages=1)

    space_ids = [space.id for space in spaces]
    space_to_category = {space.id: _category_from_space_slug(space.slug) for space in spaces}

    total = repository.count_posts_for_spaces(session, space_ids, include_moderated=moderated)
    total_pages = max(1, ((total - 1) // page_size) + 1) if total > 0 else 1
    safe_page = min(page, total_pages)
    offset = (safe_page - 1) * page_size

    posts = repository.list_posts_for_spaces(
        session,
        space_ids,
        include_moderated=moderated,
        limit=page_size,
        offset=offset,
    )
    post_ids = [item.id for item in posts]
    author_ids = list({item.author_user_id for item in posts})

    comment_counts = repository.count_comments_for_posts(session, post_ids, include_moderated=moderated)
    users_by_id = repository.list_users_by_ids(session, author_ids)

    items: list[ForumFeedPostItem] = []
    for post in posts:
        post_category = space_to_category.get(post.space_id)
        if post_category is None:
            continue
        author = _map_author(post.author_user_id, users_by_id.get(post.author_user_id))
        items.append(
            _map_feed_post(
                post=post,
                category=post_category,
                author=author,
                reply_count=comment_counts.get(post.id, 0),
                can_pin=can_pin,
            )
        )

    return ForumFeedPostListResponse(
        items=items,
        total=total,
        page=safe_page,
        page_size=page_size,
        total_pages=total_pages,
    )


def create_feed_post(
    session: Session,
    payload: ForumFeedPostCreateRequest,
    current_user: CurrentUser,
    locale: str,
) -> ForumFeedPostItem:
    _validate_category_write_access(payload.category, current_user, locale)

    slug = _CATEGORY_TO_SPACE_SLUG[payload.category]
    space = repository.get_space_by_slug(session, slug)
    if space is None:
        raise localized_http_exception(status.HTTP_404_NOT_FOUND, "FORUM_CATEGORY_NOT_FOUND", locale)

    post = repository.create_post(
        session=session,
        space_id=space.id,
        author_user_id=current_user.user_id,
        title=payload.title.strip(),
        content=payload.content.strip(),
    )

    author = repository.list_users_by_ids(session, [post.author_user_id]).get(post.author_user_id)
    session.commit()

    return _map_feed_post(
        post=post,
        category=payload.category,
        author=_map_author(post.author_user_id, author),
        reply_count=0,
        can_pin=_resolve_role(current_user, locale) in _PIN_ROLES,
    )


def get_feed_post_detail(
    session: Session,
    post_id: UUID,
    current_user: CurrentUser,
    locale: str,
    *,
    include_moderated: bool,
) -> ForumPostDetailResponse:
    role = _resolve_role(current_user, locale)
    moderated = include_moderated and _is_moderator(current_user)

    post = repository.get_post_by_id(session, post_id)
    if post is None:
        raise localized_http_exception(status.HTTP_404_NOT_FOUND, "FORUM_POST_NOT_FOUND", locale)

    if post.status != ForumPostStatus.ACTIVE and not _is_moderator(current_user):
        raise localized_http_exception(status.HTTP_404_NOT_FOUND, "FORUM_POST_NOT_FOUND", locale)

    space = repository.get_space_by_id(session, post.space_id)
    if space is None:
        raise localized_http_exception(status.HTTP_404_NOT_FOUND, "FORUM_CATEGORY_NOT_FOUND", locale)
    category = _category_from_space_slug(space.slug)
    if category is None:
        raise localized_http_exception(status.HTTP_404_NOT_FOUND, "FORUM_CATEGORY_NOT_FOUND", locale)

    replies = repository.list_comments(session, post.id, include_moderated=moderated)
    author_ids = list({post.author_user_id, *[reply.author_user_id for reply in replies]})
    users_by_id = repository.list_users_by_ids(session, author_ids)

    mapped_post = _map_feed_post(
        post=post,
        category=category,
        author=_map_author(post.author_user_id, users_by_id.get(post.author_user_id)),
        reply_count=len(replies),
        can_pin=role in _PIN_ROLES,
    )

    mapped_replies = [
        ForumReplyItem(
            id=reply.id,
            content=reply.content,
            status=reply.status,
            upvotes=reply.upvotes,
            downvotes=reply.downvotes,
            author=_map_author(reply.author_user_id, users_by_id.get(reply.author_user_id)),
            created_at=reply.created_at,
        )
        for reply in replies
    ]
    return ForumPostDetailResponse(post=mapped_post, replies=mapped_replies)


def create_feed_reply(
    session: Session,
    post_id: UUID,
    payload: ForumReplyCreateRequest,
    current_user: CurrentUser,
    locale: str,
) -> ForumReplyItem:
    post = repository.get_post_by_id(session, post_id)
    if post is None or post.status != ForumPostStatus.ACTIVE:
        raise localized_http_exception(status.HTTP_404_NOT_FOUND, "FORUM_POST_NOT_FOUND", locale)
    if post.is_locked:
        raise localized_http_exception(status.HTTP_400_BAD_REQUEST, "FORUM_POST_LOCKED", locale)

    space = repository.get_space_by_id(session, post.space_id)
    if space is None:
        raise localized_http_exception(status.HTTP_404_NOT_FOUND, "FORUM_CATEGORY_NOT_FOUND", locale)
    category = _category_from_space_slug(space.slug)
    if category is None:
        raise localized_http_exception(status.HTTP_404_NOT_FOUND, "FORUM_CATEGORY_NOT_FOUND", locale)
    _validate_category_write_access(category, current_user, locale)

    reply = repository.create_comment(
        session=session,
        post_id=post_id,
        author_user_id=current_user.user_id,
        content=payload.content.strip(),
    )

    author = repository.list_users_by_ids(session, [reply.author_user_id]).get(reply.author_user_id)
    session.commit()

    return ForumReplyItem(
        id=reply.id,
        content=reply.content,
        status=reply.status,
        upvotes=reply.upvotes,
        downvotes=reply.downvotes,
        author=_map_author(reply.author_user_id, author),
        created_at=reply.created_at,
    )


def set_post_pin(
    session: Session,
    post_id: UUID,
    payload: ForumPinRequest,
    current_user: CurrentUser,
    locale: str,
) -> ForumPinResponse:
    role = _resolve_role(current_user, locale)
    if role not in _PIN_ROLES:
        raise localized_http_exception(status.HTTP_403_FORBIDDEN, "FORBIDDEN", locale)

    post = repository.get_post_by_id(session, post_id)
    if post is None:
        raise localized_http_exception(status.HTTP_404_NOT_FOUND, "FORUM_POST_NOT_FOUND", locale)

    repository.set_post_pin(session, post, payload.is_pinned)
    session.commit()
    return ForumPinResponse(post_id=post.id, is_pinned=post.is_pinned)
