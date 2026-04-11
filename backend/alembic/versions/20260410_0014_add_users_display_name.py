"""add users.display_name for reading lab child labels

Revision ID: 20260410_0014
Revises: 20260410_0013
Create Date: 2026-04-10 15:20:00.000000
"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "20260410_0014"
down_revision: Union[str, None] = "20260410_0013"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name VARCHAR(120)")


def downgrade() -> None:
    op.drop_column("users", "display_name")
