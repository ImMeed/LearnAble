"""security tables

Revision ID: 0006_security_tables
Revises: 20260327_0005_t
Create Date: 2026-03-27

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "0006_security_tables"
down_revision = "20260327_0005_t"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "login_attempts",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("attempted_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("success", sa.Boolean(), nullable=False, default=False),
        sa.Column("ip_address", sa.String(45), nullable=True),
    )
    op.create_index("ix_login_attempts_user_id", "login_attempts", ["user_id"])

    op.create_table(
        "totp_secrets",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("secret", sa.String(64), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "role_change_log",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("changed_by", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("target_user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("old_role", sa.String(50), nullable=False),
        sa.Column("new_role", sa.String(50), nullable=False),
        sa.Column("changed_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_role_change_log_target_user_id", "role_change_log", ["target_user_id"])

    op.add_column("users", sa.Column("totp_enabled", sa.Boolean(), nullable=False, server_default="false"))
    op.add_column("users", sa.Column("locked_until", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "locked_until")
    op.drop_column("users", "totp_enabled")
    op.drop_index("ix_role_change_log_target_user_id", table_name="role_change_log")
    op.drop_table("role_change_log")
    op.drop_table("totp_secrets")
    op.drop_index("ix_login_attempts_user_id", table_name="login_attempts")
    op.drop_table("login_attempts")