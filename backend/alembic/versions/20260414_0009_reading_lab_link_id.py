"""add reading lab student link id

Revision ID: 20260414_0009
Revises: 20260413_0008
Create Date: 2026-04-14 10:30:00
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20260414_0009"
down_revision = "20260413_0008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("reading_lab_link_id", sa.String(length=24), nullable=True))
    op.create_index("ix_users_reading_lab_link_id", "users", ["reading_lab_link_id"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_users_reading_lab_link_id", table_name="users")
    op.drop_column("users", "reading_lab_link_id")
