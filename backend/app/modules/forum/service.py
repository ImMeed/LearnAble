from uuid import UUID

from fastapi import status
from sqlalchemy.orm import Session

from app.core.i18n import localized_http_exception
from app.core.roles import UserRole
from app.core.security import CurrentUser
from app.db.models.forum import ForumPostStatus, ForumReportStatus, ForumTargetType
from app.modules.forum import repository
from app.modules.forum.schemas import (
    ForumCommentCreateRequest,
    ForumCommentItem,
    ForumCommentListResponse,
    ForumModerationAction,
    ForumModerationRequest,
    ForumModerationResponse,
    ForumPostCreateRequest,
    ForumPostItem,
    ForumPostListResponse,
    ForumReportCreateRequest,
    ForumReportItem,
    ForumReportListResponse,
    ForumSpaceCreateRequest,
    ForumSpaceItem,
    ForumVoteRequest,
    ForumVoteResponse,
    SpaceListResponse,
)


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
