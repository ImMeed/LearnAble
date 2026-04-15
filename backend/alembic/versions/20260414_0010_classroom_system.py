"""add classroom system tables

Revision ID: 20260414_0010
Revises: 20260414_0009
Create Date: 2026-04-14 17:30:00
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = "20260414_0010"
down_revision = "20260414_0009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    table_names = set(inspector.get_table_names())

    def has_index(table: str, index_name: str) -> bool:
        return any(index.get("name") == index_name for index in inspector.get_indexes(table))

    if "classrooms" not in table_names:
        op.create_table(
            "classrooms",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
            sa.Column("name", sa.String(length=255), nullable=False),
            sa.Column("description", sa.String(length=1000), nullable=True),
            sa.Column("grade_tag", sa.String(length=80), nullable=True),
            sa.Column("teacher_id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("invite_code", sa.String(length=20), nullable=False),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.ForeignKeyConstraint(["teacher_id"], ["users.id"], ondelete="CASCADE"),
            sa.UniqueConstraint("invite_code", name="uq_classrooms_invite_code"),
        )
        inspector = sa.inspect(bind)

    if "classrooms" in set(inspector.get_table_names()) and not has_index("classrooms", "ix_classrooms_teacher_active"):
        op.create_index("ix_classrooms_teacher_active", "classrooms", ["teacher_id", "is_active"])

    if "classroom_enrollments" not in set(inspector.get_table_names()):
        op.create_table(
            "classroom_enrollments",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
            sa.Column("classroom_id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("student_id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("joined_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
            sa.ForeignKeyConstraint(["classroom_id"], ["classrooms.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["student_id"], ["users.id"], ondelete="CASCADE"),
            sa.UniqueConstraint("classroom_id", "student_id", name="uq_classroom_student_enrollment"),
        )
        inspector = sa.inspect(bind)

    if "classroom_enrollments" in set(inspector.get_table_names()):
        if not has_index("classroom_enrollments", "ix_classroom_enrollments_classroom_active"):
            op.create_index(
                "ix_classroom_enrollments_classroom_active",
                "classroom_enrollments",
                ["classroom_id", "is_active"],
            )
        if not has_index("classroom_enrollments", "ix_classroom_enrollments_student_active"):
            op.create_index(
                "ix_classroom_enrollments_student_active",
                "classroom_enrollments",
                ["student_id", "is_active"],
            )

    if "classroom_courses" not in set(inspector.get_table_names()):
        op.create_table(
            "classroom_courses",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
            sa.Column("classroom_id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("course_id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("assigned_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.ForeignKeyConstraint(["classroom_id"], ["classrooms.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["course_id"], ["lessons.id"], ondelete="CASCADE"),
            sa.UniqueConstraint("classroom_id", "course_id", name="uq_classroom_course_assignment"),
        )
        inspector = sa.inspect(bind)

    if "classroom_courses" in set(inspector.get_table_names()):
        if not has_index("classroom_courses", "ix_classroom_courses_classroom"):
            op.create_index("ix_classroom_courses_classroom", "classroom_courses", ["classroom_id"])
        if not has_index("classroom_courses", "ix_classroom_courses_course"):
            op.create_index("ix_classroom_courses_course", "classroom_courses", ["course_id"])


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    table_names = set(inspector.get_table_names())

    if "classroom_courses" in table_names:
        index_names = {index.get("name") for index in inspector.get_indexes("classroom_courses")}
        if "ix_classroom_courses_course" in index_names:
            op.drop_index("ix_classroom_courses_course", table_name="classroom_courses")
        if "ix_classroom_courses_classroom" in index_names:
            op.drop_index("ix_classroom_courses_classroom", table_name="classroom_courses")
        op.drop_table("classroom_courses")

    inspector = sa.inspect(bind)
    table_names = set(inspector.get_table_names())
    if "classroom_enrollments" in table_names:
        index_names = {index.get("name") for index in inspector.get_indexes("classroom_enrollments")}
        if "ix_classroom_enrollments_student_active" in index_names:
            op.drop_index("ix_classroom_enrollments_student_active", table_name="classroom_enrollments")
        if "ix_classroom_enrollments_classroom_active" in index_names:
            op.drop_index("ix_classroom_enrollments_classroom_active", table_name="classroom_enrollments")
        op.drop_table("classroom_enrollments")

    inspector = sa.inspect(bind)
    table_names = set(inspector.get_table_names())
    if "classrooms" in table_names:
        index_names = {index.get("name") for index in inspector.get_indexes("classrooms")}
        if "ix_classrooms_teacher_active" in index_names:
            op.drop_index("ix_classrooms_teacher_active", table_name="classrooms")
        op.drop_table("classrooms")
