"""totp replay protection

Revision ID: 0007_totp_replay
Revises: 0006_security_tables
Create Date: 2026-04-06

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "0007_totp_replay"
down_revision = "0006_security_tables"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "used_totp_codes",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("code", sa.String(6), nullable=False),
        sa.Column(
            "used_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index("ix_used_totp_codes_user_id", "used_totp_codes", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_used_totp_codes_user_id", table_name="used_totp_codes")
    op.drop_table("used_totp_codes")
