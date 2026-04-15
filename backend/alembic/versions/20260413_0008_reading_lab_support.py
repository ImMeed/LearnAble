"""reading lab support domain

Revision ID: 20260413_0008
Revises: 20260327_0007
Create Date: 2026-04-13 16:00:00
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "20260413_0008"
down_revision = "20260327_0007"
branch_labels = None
depends_on = None


reading_support_status = postgresql.ENUM(
    "INACTIVE",
    "ACTIVE",
    "PAUSED",
    name="reading_support_status",
    create_type=False,
)

reading_lab_session_status = postgresql.ENUM(
    "IN_PROGRESS",
    "COMPLETED",
    name="reading_lab_session_status",
    create_type=False,
)


def upgrade() -> None:
    reading_support_status.create(op.get_bind(), checkfirst=True)
    reading_lab_session_status.create(op.get_bind(), checkfirst=True)

    op.add_column("users", sa.Column("student_age_years", sa.Integer(), nullable=True))

    op.create_table(
        "reading_support_profiles",
        sa.Column("student_user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("status", reading_support_status, nullable=False, server_default="INACTIVE"),
        sa.Column("notes", sa.String(length=1000), nullable=False, server_default=""),
        sa.Column("focus_targets", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("updated_by_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("updated_by_role", sa.String(length=40), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["student_user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["updated_by_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("student_user_id"),
    )

    op.create_table(
        "reading_lab_sessions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("student_user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("activity_key", sa.String(length=80), nullable=False),
        sa.Column("activity_title_ar", sa.String(length=255), nullable=False),
        sa.Column("activity_title_en", sa.String(length=255), nullable=False),
        sa.Column("interaction_type", sa.String(length=30), nullable=False),
        sa.Column("rounds", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("answers", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("focus_targets", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("support_active_at_start", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("current_round_index", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("correct_answers", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("total_rounds", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("reward_points", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("reward_xp", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("status", reading_lab_session_status, nullable=False, server_default="IN_PROGRESS"),
        sa.Column("started_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["student_user_id"], ["users.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_reading_lab_sessions_student_started", "reading_lab_sessions", ["student_user_id", "started_at"])


def downgrade() -> None:
    op.drop_index("ix_reading_lab_sessions_student_started", table_name="reading_lab_sessions")
    op.drop_table("reading_lab_sessions")
    op.drop_table("reading_support_profiles")
    op.drop_column("users", "student_age_years")

    reading_lab_session_status.drop(op.get_bind(), checkfirst=True)
    reading_support_status.drop(op.get_bind(), checkfirst=True)
