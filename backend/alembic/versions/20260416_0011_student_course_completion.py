"""add student course completion tracking

Revision ID: 20260416_0012
Revises: 20260416_0011
Create Date: 2026-04-16 00:30:00
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = "20260416_0012"
down_revision = "20260416_0011"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    table_names = set(inspector.get_table_names())

    def has_index(table: str, index_name: str) -> bool:
        return any(index.get("name") == index_name for index in inspector.get_indexes(table))

    if "student_course_completions" not in table_names:
        op.create_table(
            "student_course_completions",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
            sa.Column("student_user_id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("lesson_id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("completed_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.ForeignKeyConstraint(["student_user_id"], ["users.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["lesson_id"], ["lessons.id"], ondelete="CASCADE"),
            sa.UniqueConstraint("student_user_id", "lesson_id", name="uq_student_course_completion"),
        )
        inspector = sa.inspect(bind)

    if "student_course_completions" in set(inspector.get_table_names()):
        if not has_index("student_course_completions", "ix_student_course_completions_student"):
            op.create_index(
                "ix_student_course_completions_student",
                "student_course_completions",
                ["student_user_id"],
            )
        if not has_index("student_course_completions", "ix_student_course_completions_lesson"):
            op.create_index(
                "ix_student_course_completions_lesson",
                "student_course_completions",
                ["lesson_id"],
            )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    table_names = set(inspector.get_table_names())

    if "student_course_completions" in table_names:
        index_names = {index.get("name") for index in inspector.get_indexes("student_course_completions")}
        if "ix_student_course_completions_lesson" in index_names:
            op.drop_index("ix_student_course_completions_lesson", table_name="student_course_completions")
        if "ix_student_course_completions_student" in index_names:
            op.drop_index("ix_student_course_completions_student", table_name="student_course_completions")
        op.drop_table("student_course_completions")
