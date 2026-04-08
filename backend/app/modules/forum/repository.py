from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models.forum import (
    ForumComment,
    ForumPost,
    ForumPostStatus,
    ForumReport,
    ForumReportStatus,
    ForumSpace,
    ForumTargetType,
    ForumVote,
)


def list_spaces(session: Session, active_only: bool = True) -> list[ForumSpace]:
    stmt = select(ForumSpace).order_by(ForumSpace.created_at.asc())
    if active_only:
        stmt = stmt.where(ForumSpace.is_active.is_(True))
    return list(session.scalars(stmt))


def create_space(
    session: Session,
    slug: str,
    name_ar: str,
    name_en: str,
    description_ar: str,
    description_en: str,
) -> ForumSpace:
    space = ForumSpace(
        slug=slug,
        name_ar=name_ar,
        name_en=name_en,
        description_ar=description_ar,
        description_en=description_en,
        is_active=True,
    )
    session.add(space)
    session.flush()
    return space


def get_space_by_id(session: Session, space_id: UUID) -> ForumSpace | None:
    return session.get(ForumSpace, space_id)


def list_posts(session: Session, space_id: UUID, include_moderated: bool) -> list[ForumPost]:
    stmt = select(ForumPost).where(ForumPost.space_id == space_id).order_by(ForumPost.created_at.desc())
    if not include_moderated:
        stmt = stmt.where(ForumPost.status == ForumPostStatus.ACTIVE)
    return list(session.scalars(stmt))


def create_post(session: Session, space_id: UUID, author_user_id: UUID, title: str, content: str) -> ForumPost:
    post = ForumPost(
        space_id=space_id,
        author_user_id=author_user_id,
        title=title,
        content=content,
        status=ForumPostStatus.ACTIVE,
        is_locked=False,
    )
    session.add(post)
    session.flush()
    return post


def get_post_by_id(session: Session, post_id: UUID) -> ForumPost | None:
    return session.get(ForumPost, post_id)


def list_comments(session: Session, post_id: UUID, include_moderated: bool) -> list[ForumComment]:
    stmt = select(ForumComment).where(ForumComment.post_id == post_id).order_by(ForumComment.created_at.asc())
    if not include_moderated:
        stmt = stmt.where(ForumComment.status == ForumPostStatus.ACTIVE)
    return list(session.scalars(stmt))


def create_comment(session: Session, post_id: UUID, author_user_id: UUID, content: str) -> ForumComment:
    comment = ForumComment(
        post_id=post_id,
        author_user_id=author_user_id,
        content=content,
        status=ForumPostStatus.ACTIVE,
    )
    session.add(comment)
    session.flush()
    return comment


def get_comment_by_id(session: Session, comment_id: UUID) -> ForumComment | None:
    return session.get(ForumComment, comment_id)


def get_vote(session: Session, user_id: UUID, target_type: ForumTargetType, target_id: UUID) -> ForumVote | None:
    stmt = select(ForumVote).where(
        ForumVote.user_id == user_id,
        ForumVote.target_type == target_type,
        ForumVote.target_id == target_id,
    )
    return session.scalar(stmt)


def upsert_vote(
    session: Session,
    user_id: UUID,
    target_type: ForumTargetType,
    target_id: UUID,
    value: int,
) -> tuple[int | None, ForumVote]:
    existing = get_vote(session, user_id, target_type, target_id)
    previous_value = existing.value if existing else None
    if existing is None:
        existing = ForumVote(
            user_id=user_id,
            target_type=target_type,
            target_id=target_id,
            value=value,
        )
    else:
        existing.value = value
    session.add(existing)
    session.flush()
    return previous_value, existing


def update_post_vote_totals(session: Session, post: ForumPost, up_delta: int, down_delta: int) -> ForumPost:
    post.upvotes = max(0, post.upvotes + up_delta)
    post.downvotes = max(0, post.downvotes + down_delta)
    session.add(post)
    session.flush()
    return post


def update_comment_vote_totals(session: Session, comment: ForumComment, up_delta: int, down_delta: int) -> ForumComment:
    comment.upvotes = max(0, comment.upvotes + up_delta)
    comment.downvotes = max(0, comment.downvotes + down_delta)
    session.add(comment)
    session.flush()
    return comment


def create_report(
    session: Session,
    target_type: ForumTargetType,
    target_id: UUID,
    reporter_user_id: UUID,
    reason: str,
) -> ForumReport:
    report = ForumReport(
        target_type=target_type,
        target_id=target_id,
        reporter_user_id=reporter_user_id,
        reason=reason,
        status=ForumReportStatus.OPEN,
    )
    session.add(report)
    session.flush()
    return report


def list_reports(session: Session, status_filter: ForumReportStatus | None) -> list[ForumReport]:
    stmt = select(ForumReport).order_by(ForumReport.created_at.desc())
    if status_filter is not None:
        stmt = stmt.where(ForumReport.status == status_filter)
    return list(session.scalars(stmt))


def get_report_by_id(session: Session, report_id: UUID) -> ForumReport | None:
    return session.get(ForumReport, report_id)


def apply_report_resolution(
    session: Session,
    report: ForumReport,
    reviewer_user_id: UUID,
    report_status: ForumReportStatus,
    review_notes: str | None,
) -> ForumReport:
    report.status = report_status
    report.reviewed_by_user_id = reviewer_user_id
    report.review_notes = review_notes
    report.reviewed_at = datetime.now(timezone.utc)
    session.add(report)
    session.flush()
    return report
