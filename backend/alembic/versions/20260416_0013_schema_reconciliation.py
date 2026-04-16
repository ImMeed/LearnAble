"""reconcile schema drift after merge

Revision ID: 20260416_0013
Revises: 20260416_0012
Create Date: 2026-04-16 12:05:00
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = "20260416_0013"
down_revision = "20260416_0012"
branch_labels = None
depends_on = None


def _table_names(inspector: sa.Inspector) -> set[str]:
    return set(inspector.get_table_names())


def _has_index(inspector: sa.Inspector, table_name: str, index_name: str) -> bool:
    return any(index.get("name") == index_name for index in inspector.get_indexes(table_name))


def _has_column(inspector: sa.Inspector, table_name: str, column_name: str) -> bool:
    return any(column.get("name") == column_name for column in inspector.get_columns(table_name))


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    table_names = _table_names(inspector)

    stale_security_tables: list[tuple[str, str | None]] = [
        ("role_change_log", "ix_role_change_log_target_user_id"),
        ("login_attempts", "ix_login_attempts_user_id"),
        ("used_totp_codes", "ix_used_totp_codes_user_id"),
        ("totp_secrets", None),
    ]

    for table_name, index_name in stale_security_tables:
        if table_name not in table_names:
            continue
        if index_name and _has_index(inspector, table_name, index_name):
            op.drop_index(index_name, table_name=table_name)
        op.drop_table(table_name)
        inspector = sa.inspect(bind)
        table_names = _table_names(inspector)

    stale_indexes = [
        ("classroom_courses", "ix_classroom_courses_classroom_id"),
        ("classroom_courses", "ix_classroom_courses_course_id"),
        ("classroom_enrollments", "ix_classroom_enrollments_classroom_id"),
        ("classroom_enrollments", "ix_classroom_enrollments_student_id"),
        ("student_course_completions", "ix_student_course_completions_lesson_id"),
        ("student_course_completions", "ix_student_course_completions_student_user_id"),
    ]

    for table_name, index_name in stale_indexes:
        if table_name in table_names and _has_index(inspector, table_name, index_name):
            op.drop_index(index_name, table_name=table_name)

    if "users" in table_names:
        if _has_column(inspector, "users", "totp_enabled"):
            op.drop_column("users", "totp_enabled")
        if _has_column(inspector, "users", "locked_until"):
            op.drop_column("users", "locked_until")


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    table_names = _table_names(inspector)

    if "users" in table_names:
        if not _has_column(inspector, "users", "totp_enabled"):
            op.add_column(
                "users",
                sa.Column("totp_enabled", sa.Boolean(), nullable=False, server_default=sa.text("false")),
            )
        inspector = sa.inspect(bind)
        if not _has_column(inspector, "users", "locked_until"):
            op.add_column("users", sa.Column("locked_until", sa.DateTime(timezone=True), nullable=True))

    if "classroom_courses" in table_names and not _has_index(
        inspector, "classroom_courses", "ix_classroom_courses_classroom_id"
    ):
        op.create_index("ix_classroom_courses_classroom_id", "classroom_courses", ["classroom_id"])
    if "classroom_courses" in table_names and not _has_index(inspector, "classroom_courses", "ix_classroom_courses_course_id"):
        op.create_index("ix_classroom_courses_course_id", "classroom_courses", ["course_id"])

    if "classroom_enrollments" in table_names and not _has_index(
        inspector, "classroom_enrollments", "ix_classroom_enrollments_classroom_id"
    ):
        op.create_index("ix_classroom_enrollments_classroom_id", "classroom_enrollments", ["classroom_id"])
    if "classroom_enrollments" in table_names and not _has_index(
        inspector, "classroom_enrollments", "ix_classroom_enrollments_student_id"
    ):
        op.create_index("ix_classroom_enrollments_student_id", "classroom_enrollments", ["student_id"])

    if "student_course_completions" in table_names and not _has_index(
        inspector, "student_course_completions", "ix_student_course_completions_lesson_id"
    ):
        op.create_index("ix_student_course_completions_lesson_id", "student_course_completions", ["lesson_id"])
    if "student_course_completions" in table_names and not _has_index(
        inspector, "student_course_completions", "ix_student_course_completions_student_user_id"
    ):
        op.create_index(
            "ix_student_course_completions_student_user_id",
            "student_course_completions",
            ["student_user_id"],
        )

    inspector = sa.inspect(bind)
    table_names = _table_names(inspector)

    if "totp_secrets" not in table_names:
        op.create_table(
            "totp_secrets",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
            sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("secret", sa.String(length=64), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        )
        inspector = sa.inspect(bind)

    if "login_attempts" not in _table_names(inspector):
        op.create_table(
            "login_attempts",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
            sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("attempted_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.Column("success", sa.Boolean(), nullable=False),
            sa.Column("ip_address", sa.String(length=45), nullable=True),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        )
        op.create_index("ix_login_attempts_user_id", "login_attempts", ["user_id"])
        inspector = sa.inspect(bind)

    if "used_totp_codes" not in _table_names(inspector):
        op.create_table(
            "used_totp_codes",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
            sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("code", sa.String(length=6), nullable=False),
            sa.Column("used_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        )
        op.create_index("ix_used_totp_codes_user_id", "used_totp_codes", ["user_id"])
        inspector = sa.inspect(bind)

    if "role_change_log" not in _table_names(inspector):
        op.create_table(
            "role_change_log",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
            sa.Column("changed_by", postgresql.UUID(as_uuid=True), nullable=True),
            sa.Column("target_user_id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("old_role", sa.String(length=50), nullable=False),
            sa.Column("new_role", sa.String(length=50), nullable=False),
            sa.Column("changed_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.ForeignKeyConstraint(["changed_by"], ["users.id"], ondelete="SET NULL"),
            sa.ForeignKeyConstraint(["target_user_id"], ["users.id"], ondelete="CASCADE"),
        )
        op.create_index("ix_role_change_log_target_user_id", "role_change_log", ["target_user_id"])
