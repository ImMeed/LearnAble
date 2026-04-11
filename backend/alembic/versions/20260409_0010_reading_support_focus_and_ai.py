"""reading support focus fields and ai session source

Revision ID: 20260409_0010
Revises: 20260409_0009
Create Date: 2026-04-09 18:05:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "20260409_0010"
down_revision: Union[str, None] = "20260409_0009"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _has_column(table_name: str, column_name: str) -> bool:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    return any(column["name"] == column_name for column in inspector.get_columns(table_name))


def upgrade() -> None:
    if not _has_column("dyslexia_support_profiles", "focus_letters"):
        op.add_column(
            "dyslexia_support_profiles",
            sa.Column(
                "focus_letters",
                postgresql.JSONB(astext_type=sa.Text()),
                nullable=False,
                server_default=sa.text("'[]'::jsonb"),
            ),
        )
    if not _has_column("dyslexia_support_profiles", "focus_numbers"):
        op.add_column(
            "dyslexia_support_profiles",
            sa.Column(
                "focus_numbers",
                postgresql.JSONB(astext_type=sa.Text()),
                nullable=False,
                server_default=sa.text("'[]'::jsonb"),
            ),
        )
    if not _has_column("reading_lab_sessions", "content_source"):
        op.add_column(
            "reading_lab_sessions",
            sa.Column("content_source", sa.String(length=20), nullable=False, server_default="fallback"),
        )


def downgrade() -> None:
    if _has_column("reading_lab_sessions", "content_source"):
        op.drop_column("reading_lab_sessions", "content_source")
    if _has_column("dyslexia_support_profiles", "focus_numbers"):
        op.drop_column("dyslexia_support_profiles", "focus_numbers")
    if _has_column("dyslexia_support_profiles", "focus_letters"):
        op.drop_column("dyslexia_support_profiles", "focus_letters")
