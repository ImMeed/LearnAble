"""reading support focus words

Revision ID: 20260409_0011
Revises: 20260409_0010
Create Date: 2026-04-09 19:10:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "20260409_0011"
down_revision: Union[str, None] = "20260409_0010"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _has_column(table_name: str, column_name: str) -> bool:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    return any(column["name"] == column_name for column in inspector.get_columns(table_name))


def upgrade() -> None:
    if not _has_column("dyslexia_support_profiles", "focus_words"):
        op.add_column(
            "dyslexia_support_profiles",
            sa.Column(
                "focus_words",
                postgresql.JSONB(astext_type=sa.Text()),
                nullable=False,
                server_default=sa.text("'[]'::jsonb"),
            ),
        )


def downgrade() -> None:
    if _has_column("dyslexia_support_profiles", "focus_words"):
        op.drop_column("dyslexia_support_profiles", "focus_words")
