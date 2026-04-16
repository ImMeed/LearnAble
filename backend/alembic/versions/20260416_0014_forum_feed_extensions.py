"""extend forum feed capabilities

Revision ID: 20260416_0014
Revises: 20260416_0013
Create Date: 2026-04-16 15:35:00
"""

import uuid

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20260416_0014"
down_revision = "20260416_0013"
branch_labels = None
depends_on = None


SEEDED_FORUM_SPACES: dict[str, dict[str, str]] = {
    "tips": {
        "name_ar": "نصائح",
        "name_en": "Tips",
        "description_ar": "شارك نصائح تعليمية تساعد المجتمع.",
        "description_en": "Share practical learning tips with the community.",
    },
    "ask": {
        "name_ar": "اسأل",
        "name_en": "Ask",
        "description_ar": "اطرح أسئلتك للحصول على دعم سريع.",
        "description_en": "Ask questions and get quick support.",
    },
    "resources": {
        "name_ar": "موارد",
        "name_en": "Resources",
        "description_ar": "شارك موارد تعليمية مفيدة.",
        "description_en": "Share useful educational resources.",
    },
}


def _table_names(inspector: sa.Inspector) -> set[str]:
    return set(inspector.get_table_names())


def _has_column(inspector: sa.Inspector, table_name: str, column_name: str) -> bool:
    return any(column.get("name") == column_name for column in inspector.get_columns(table_name))


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    table_names = _table_names(inspector)

    if "forum_posts" in table_names and not _has_column(inspector, "forum_posts", "is_pinned"):
        op.add_column(
            "forum_posts",
            sa.Column("is_pinned", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        )
        op.alter_column("forum_posts", "is_pinned", server_default=None)

    inspector = sa.inspect(bind)
    table_names = _table_names(inspector)

    if "forum_spaces" not in table_names:
        return

    existing_rows = bind.execute(sa.text("SELECT slug FROM forum_spaces"))
    existing_slugs = {str(row[0]) for row in existing_rows}

    for slug, labels in SEEDED_FORUM_SPACES.items():
        if slug in existing_slugs:
            continue
        bind.execute(
            sa.text(
                """
                INSERT INTO forum_spaces (
                    id,
                    slug,
                    name_ar,
                    name_en,
                    description_ar,
                    description_en,
                    is_active
                ) VALUES (
                    :id,
                    :slug,
                    :name_ar,
                    :name_en,
                    :description_ar,
                    :description_en,
                    true
                )
                """
            ),
            {
                "id": uuid.uuid4(),
                "slug": slug,
                "name_ar": labels["name_ar"],
                "name_en": labels["name_en"],
                "description_ar": labels["description_ar"],
                "description_en": labels["description_en"],
            },
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    table_names = _table_names(inspector)

    if "forum_spaces" in table_names:
        for slug in reversed(list(SEEDED_FORUM_SPACES.keys())):
            row = bind.execute(
                sa.text("SELECT id FROM forum_spaces WHERE slug = :slug"),
                {"slug": slug},
            ).mappings().first()
            if row is None:
                continue

            in_use = bind.execute(
                sa.text("SELECT 1 FROM forum_posts WHERE space_id = :space_id LIMIT 1"),
                {"space_id": row["id"]},
            ).first()
            if in_use is None:
                bind.execute(
                    sa.text("DELETE FROM forum_spaces WHERE id = :space_id"),
                    {"space_id": row["id"]},
                )

    inspector = sa.inspect(bind)
    table_names = _table_names(inspector)
    if "forum_posts" in table_names and _has_column(inspector, "forum_posts", "is_pinned"):
        op.drop_column("forum_posts", "is_pinned")
