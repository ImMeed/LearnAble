"""study flow core tables

Revision ID: 20260327_0004
Revises: 20260327_0003
Create Date: 2026-03-27 01:00:00
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "20260327_0004"
down_revision = "20260327_0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "student_screenings",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("focus_score", sa.Integer(), nullable=False),
        sa.Column("reading_score", sa.Integer(), nullable=False),
        sa.Column("memory_score", sa.Integer(), nullable=False),
        sa.Column("support_level", sa.String(length=30), nullable=False),
        sa.Column("indicators", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("user_id", name="uq_student_screening_user"),
    )

    op.create_table(
        "lessons",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("title_ar", sa.String(length=255), nullable=False),
        sa.Column("title_en", sa.String(length=255), nullable=False),
        sa.Column("body_ar", sa.String(length=4000), nullable=False),
        sa.Column("body_en", sa.String(length=4000), nullable=False),
        sa.Column("difficulty", sa.String(length=30), nullable=False, server_default="BEGINNER"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "lesson_flashcards",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("lesson_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("front_ar", sa.String(length=255), nullable=False),
        sa.Column("front_en", sa.String(length=255), nullable=False),
        sa.Column("back_ar", sa.String(length=500), nullable=False),
        sa.Column("back_en", sa.String(length=500), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["lesson_id"], ["lessons.id"], ondelete="CASCADE"),
    )

    op.create_table(
        "lesson_reading_games",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("lesson_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name_ar", sa.String(length=255), nullable=False),
        sa.Column("name_en", sa.String(length=255), nullable=False),
        sa.Column("objective_ar", sa.String(length=500), nullable=False),
        sa.Column("objective_en", sa.String(length=500), nullable=False),
        sa.Column("words", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["lesson_id"], ["lessons.id"], ondelete="CASCADE"),
    )

    op.create_index("ix_lesson_flashcards_lesson_id", "lesson_flashcards", ["lesson_id"])
    op.create_index("ix_lesson_reading_games_lesson_id", "lesson_reading_games", ["lesson_id"])


def downgrade() -> None:
    op.drop_index("ix_lesson_reading_games_lesson_id", table_name="lesson_reading_games")
    op.drop_index("ix_lesson_flashcards_lesson_id", table_name="lesson_flashcards")
    op.drop_table("lesson_reading_games")
    op.drop_table("lesson_flashcards")
    op.drop_table("lessons")
    op.drop_table("student_screenings")
