"""reading support lab

Revision ID: 20260409_0009
Revises: 20260408_0008_merge_heads
Create Date: 2026-04-09 11:00:00
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "20260409_0009"
down_revision = "20260408_0008_merge_heads"
branch_labels = None
depends_on = None


def _has_table(table_name: str) -> bool:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    return table_name in inspector.get_table_names()


def _has_index(table_name: str, index_name: str) -> bool:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    return any(index["name"] == index_name for index in inspector.get_indexes(table_name))


def upgrade() -> None:
    if not _has_table("dyslexia_support_profiles"):
        op.create_table(
            "dyslexia_support_profiles",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
            sa.Column("student_user_id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("declared_by_user_id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("declared_by_role", sa.String(length=30), nullable=False),
            sa.Column("notes", sa.String(length=1000), nullable=False, server_default=""),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
            sa.Column("activated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.ForeignKeyConstraint(["student_user_id"], ["users.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["declared_by_user_id"], ["users.id"], ondelete="CASCADE"),
            sa.UniqueConstraint("student_user_id", name="uq_dyslexia_support_student"),
        )

    if not _has_table("reading_lab_sessions"):
        op.create_table(
            "reading_lab_sessions",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
            sa.Column("student_user_id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("game_key", sa.String(length=50), nullable=False),
            sa.Column("locale", sa.String(length=5), nullable=False, server_default="ar"),
            sa.Column("round_payload", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
            sa.Column("answers", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
            sa.Column("status", sa.String(length=30), nullable=False, server_default="IN_PROGRESS"),
            sa.Column("total_rounds", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("correct_rounds", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("points_awarded", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("xp_awarded", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("started_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
            sa.ForeignKeyConstraint(["student_user_id"], ["users.id"], ondelete="CASCADE"),
        )
    if not _has_index("reading_lab_sessions", "ix_reading_lab_sessions_student"):
        op.create_index("ix_reading_lab_sessions_student", "reading_lab_sessions", ["student_user_id"])
    if not _has_index("reading_lab_sessions", "ix_reading_lab_sessions_game_key"):
        op.create_index("ix_reading_lab_sessions_game_key", "reading_lab_sessions", ["game_key"])


def downgrade() -> None:
    if _has_index("reading_lab_sessions", "ix_reading_lab_sessions_game_key"):
        op.drop_index("ix_reading_lab_sessions_game_key", table_name="reading_lab_sessions")
    if _has_index("reading_lab_sessions", "ix_reading_lab_sessions_student"):
        op.drop_index("ix_reading_lab_sessions_student", table_name="reading_lab_sessions")
    if _has_table("reading_lab_sessions"):
        op.drop_table("reading_lab_sessions")
    if _has_table("dyslexia_support_profiles"):
        op.drop_table("dyslexia_support_profiles")
