"""add spelling game tables

Revision ID: 20260416_0011
Revises: 20260414_0010
Create Date: 2026-04-16 09:30:00
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = "20260416_0011"
down_revision = "20260414_0010"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    table_names = set(inspector.get_table_names())

    status_enum = sa.Enum("IN_PROGRESS", "COMPLETED", name="spelling_session_status", create_type=False)
    status_enum.create(bind, checkfirst=True)

    if "spelling_activities" not in table_names:
        op.create_table(
            "spelling_activities",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
            sa.Column("key", sa.String(length=80), nullable=False),
            sa.Column("title_ar", sa.String(length=255), nullable=False),
            sa.Column("title_en", sa.String(length=255), nullable=False),
            sa.Column("difficulty", sa.String(length=20), nullable=False, server_default="MEDIUM"),
            sa.Column("word_text_ar", sa.String(length=255), nullable=True),
            sa.Column("word_text_en", sa.String(length=255), nullable=True),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.UniqueConstraint("key", name="uq_spelling_activities_key"),
        )
        inspector = sa.inspect(bind)

    if "spelling_sessions" not in set(inspector.get_table_names()):
        op.create_table(
            "spelling_sessions",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
            sa.Column("student_user_id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("activity_id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("activity_key", sa.String(length=80), nullable=False),
            sa.Column("activity_title_ar", sa.String(length=255), nullable=False),
            sa.Column("activity_title_en", sa.String(length=255), nullable=False),
            sa.Column("difficulty", sa.String(length=20), nullable=False, server_default="MEDIUM"),
            sa.Column("locale", sa.String(length=5), nullable=False, server_default="ar"),
            sa.Column("target_word", sa.String(length=255), nullable=False),
            sa.Column("normalized_target", sa.String(length=255), nullable=False),
            sa.Column("typed_answer", sa.String(length=255), nullable=False, server_default=""),
            sa.Column("normalized_answer", sa.String(length=255), nullable=False, server_default=""),
            sa.Column("solved", sa.Boolean(), nullable=False, server_default=sa.text("false")),
            sa.Column("near_match_used", sa.Boolean(), nullable=False, server_default=sa.text("false")),
            sa.Column("hint_used", sa.Boolean(), nullable=False, server_default=sa.text("false")),
            sa.Column("replay_count", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("typed_playback_count", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("attempt_count", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("mistakes_count", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("reward_points", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("reward_xp", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("duration_ms", sa.Integer(), nullable=True),
            sa.Column("status", status_enum, nullable=False, server_default="IN_PROGRESS"),
            sa.Column("started_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
            sa.ForeignKeyConstraint(["student_user_id"], ["users.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["activity_id"], ["spelling_activities.id"], ondelete="CASCADE"),
        )
        inspector = sa.inspect(bind)

    session_indexes = {index.get("name") for index in inspector.get_indexes("spelling_sessions")} if "spelling_sessions" in set(inspector.get_table_names()) else set()
    if "spelling_sessions" in set(inspector.get_table_names()) and "ix_spelling_sessions_student_status" not in session_indexes:
        op.create_index(
            "ix_spelling_sessions_student_status",
            "spelling_sessions",
            ["student_user_id", "status"],
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    table_names = set(inspector.get_table_names())

    if "spelling_sessions" in table_names:
        index_names = {index.get("name") for index in inspector.get_indexes("spelling_sessions")}
        if "ix_spelling_sessions_student_status" in index_names:
            op.drop_index("ix_spelling_sessions_student_status", table_name="spelling_sessions")
        op.drop_table("spelling_sessions")

    inspector = sa.inspect(bind)
    table_names = set(inspector.get_table_names())
    if "spelling_activities" in table_names:
        op.drop_table("spelling_activities")

    status_enum = sa.Enum("IN_PROGRESS", "COMPLETED", name="spelling_session_status", create_type=False)
    status_enum.drop(bind, checkfirst=True)
