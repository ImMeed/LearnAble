"""teacher supervision and assistance tables

Revision ID: 20260327_0005
Revises: 20260327_0004
Create Date: 2026-03-27 02:00:00
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "20260327_0005"
down_revision = "20260327_0004"
branch_labels = None
depends_on = None


assistance_request_status = postgresql.ENUM(
    "REQUESTED",
    "SCHEDULED",
    "COMPLETED",
    name="assistance_request_status",
    create_type=False,
)

feedback_source_type = postgresql.ENUM(
    "LESSON",
    "ASSESSMENT",
    name="feedback_source_type",
    create_type=False,
)


def upgrade() -> None:
    assistance_request_status.create(op.get_bind(), checkfirst=True)
    feedback_source_type.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "teacher_presence",
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("is_online", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("user_id"),
    )

    op.create_table(
        "teacher_assistance_requests",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("student_user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("tutor_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("lesson_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("topic", sa.String(length=255), nullable=False),
        sa.Column("message", sa.String(length=1000), nullable=False),
        sa.Column("preferred_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("status", assistance_request_status, nullable=False),
        sa.Column("scheduled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("meeting_url", sa.String(length=500), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["student_user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["tutor_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["lesson_id"], ["lessons.id"], ondelete="SET NULL"),
    )

    op.create_table(
        "student_feedback_prompts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("student_user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("source_type", feedback_source_type, nullable=False),
        sa.Column("source_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("prompt_ar", sa.String(length=700), nullable=False),
        sa.Column("prompt_en", sa.String(length=700), nullable=False),
        sa.Column("response_text", sa.String(length=1000), nullable=True),
        sa.Column("is_answered", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["student_user_id"], ["users.id"], ondelete="CASCADE"),
    )

    op.create_index("ix_teacher_assistance_requests_status", "teacher_assistance_requests", ["status"])
    op.create_index("ix_teacher_assistance_requests_tutor", "teacher_assistance_requests", ["tutor_user_id"])
    op.create_index("ix_feedback_prompts_student", "student_feedback_prompts", ["student_user_id"])


def downgrade() -> None:
    op.drop_index("ix_feedback_prompts_student", table_name="student_feedback_prompts")
    op.drop_index("ix_teacher_assistance_requests_tutor", table_name="teacher_assistance_requests")
    op.drop_index("ix_teacher_assistance_requests_status", table_name="teacher_assistance_requests")
    op.drop_table("student_feedback_prompts")
    op.drop_table("teacher_assistance_requests")
    op.drop_table("teacher_presence")

    feedback_source_type.drop(op.get_bind(), checkfirst=True)
    assistance_request_status.drop(op.get_bind(), checkfirst=True)
