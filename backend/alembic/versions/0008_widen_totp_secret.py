"""widen totp_secrets.secret from VARCHAR(64) to VARCHAR(256)

Revision ID: 0008_widen_totp_secret
Revises: 0007_totp_replay
Create Date: 2026-04-14

"""
from alembic import op
import sqlalchemy as sa

revision = "0008_widen_totp_secret"
down_revision = "0007_totp_replay"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column(
        "totp_secrets",
        "secret",
        existing_type=sa.String(64),
        type_=sa.String(256),
        existing_nullable=False,
    )


def downgrade() -> None:
    op.alter_column(
        "totp_secrets",
        "secret",
        existing_type=sa.String(256),
        type_=sa.String(64),
        existing_nullable=False,
    )
