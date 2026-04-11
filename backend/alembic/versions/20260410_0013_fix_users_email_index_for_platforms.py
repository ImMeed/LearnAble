"""replace legacy unique users.email index with non-unique index

Revision ID: 20260410_0013
Revises: 20260410_0012
Create Date: 2026-04-10 13:10:00.000000
"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "20260410_0013"
down_revision: Union[str, None] = "20260410_0012"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_users_email")
    op.execute("CREATE INDEX IF NOT EXISTS ix_users_email ON users (email)")


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_users_email")
    op.execute("CREATE UNIQUE INDEX IF NOT EXISTS ix_users_email ON users (email)")
