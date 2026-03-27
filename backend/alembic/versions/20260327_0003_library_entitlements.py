"""library and digital entitlements

Revision ID: 20260327_0003
Revises: 20260326_0002
Create Date: 2026-03-27 00:00:00
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "20260327_0003"
down_revision = "20260326_0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "books",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("title_ar", sa.String(length=255), nullable=False),
        sa.Column("title_en", sa.String(length=255), nullable=False),
        sa.Column("author_ar", sa.String(length=255), nullable=False),
        sa.Column("author_en", sa.String(length=255), nullable=False),
        sa.Column("summary_ar", sa.String(length=1200), nullable=False),
        sa.Column("summary_en", sa.String(length=1200), nullable=False),
        sa.Column("cover_image_url", sa.String(length=500), nullable=True),
        sa.Column("reader_url", sa.String(length=500), nullable=False),
        sa.Column("points_cost", sa.Integer(), nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "digital_purchases",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("book_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("points_spent", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["book_id"], ["books.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("user_id", "book_id", name="uq_digital_purchase_user_book"),
    )


def downgrade() -> None:
    op.drop_table("digital_purchases")
    op.drop_table("books")
