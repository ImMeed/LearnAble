"""separate account pools by platform track

Revision ID: 20260410_0012
Revises: 20260409_0011
Create Date: 2026-04-10 11:20:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "20260410_0012"
down_revision: Union[str, None] = "20260409_0011"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


PLATFORM_TRACK_ENUM = postgresql.ENUM("PLUS_TEN", "READING_LAB", name="platform_track")
USERS_PLATFORM_UNIQUE = "uq_users_email_platform_track"


def _has_column(table_name: str, column_name: str) -> bool:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    return any(column["name"] == column_name for column in inspector.get_columns(table_name))


def _unique_constraints(table_name: str) -> list[dict]:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    return inspector.get_unique_constraints(table_name)


def upgrade() -> None:
    bind = op.get_bind()
    PLATFORM_TRACK_ENUM.create(bind, checkfirst=True)

    if not _has_column("users", "platform_track"):
        op.add_column(
            "users",
            sa.Column(
                "platform_track",
                PLATFORM_TRACK_ENUM,
                nullable=False,
                server_default="PLUS_TEN",
            ),
        )

    # Preserve previously created reading-lab/demo-style accounts where possible.
    op.execute(
        """
        UPDATE users
        SET platform_track = 'READING_LAB'
        WHERE email LIKE 'reading.demo.%'
           OR email LIKE 'reading-%@learnable.test'
        """
    )

    for constraint in _unique_constraints("users"):
        columns = constraint.get("column_names") or []
        name = constraint.get("name")
        if columns == ["email"] and name:
            op.drop_constraint(name, "users", type_="unique")

    existing_names = {constraint.get("name") for constraint in _unique_constraints("users")}
    if USERS_PLATFORM_UNIQUE not in existing_names:
        op.create_unique_constraint(
            USERS_PLATFORM_UNIQUE,
            "users",
            ["email", "platform_track"],
        )

    op.execute("DROP INDEX IF EXISTS ix_users_email")
    op.execute("CREATE INDEX IF NOT EXISTS ix_users_email ON users (email)")


def downgrade() -> None:
    existing_names = {constraint.get("name") for constraint in _unique_constraints("users")}
    if USERS_PLATFORM_UNIQUE in existing_names:
        op.drop_constraint(USERS_PLATFORM_UNIQUE, "users", type_="unique")

    if not any((constraint.get("column_names") or []) == ["email"] for constraint in _unique_constraints("users")):
        op.create_unique_constraint("users_email_key", "users", ["email"])

    if _has_column("users", "platform_track"):
        op.drop_column("users", "platform_track")

    op.execute("DROP INDEX IF EXISTS ix_users_email")
    op.execute("CREATE UNIQUE INDEX IF NOT EXISTS ix_users_email ON users (email)")

    PLATFORM_TRACK_ENUM.drop(op.get_bind(), checkfirst=True)
