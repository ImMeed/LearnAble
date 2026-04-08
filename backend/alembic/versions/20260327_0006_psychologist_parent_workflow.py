"""psychologist parent workflow tables

Revision ID: 20260327_0006
Revises: 20260327_0005
Create Date: 2026-03-27 03:00:00
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "20260327_0006"
down_revision = "20260327_0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "teacher_questionnaires",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("student_user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("tutor_user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("attention_score", sa.Integer(), nullable=False),
        sa.Column("engagement_score", sa.Integer(), nullable=False),
        sa.Column("notes", sa.String(length=1000), nullable=False),
        sa.Column("cadence_days", sa.Integer(), nullable=False, server_default="14"),
        sa.Column("submitted_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["student_user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["tutor_user_id"], ["users.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_teacher_questionnaires_student", "teacher_questionnaires", ["student_user_id"])

    op.create_table(
        "psychologist_support_confirmations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("student_user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("psychologist_user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("support_level", sa.String(length=30), nullable=False),
        sa.Column("notes", sa.String(length=1000), nullable=False),
        sa.Column("confirmed_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["student_user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["psychologist_user_id"], ["users.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("student_user_id", name="uq_support_confirmation_student"),
    )


def downgrade() -> None:
    op.drop_table("psychologist_support_confirmations")
    op.drop_index("ix_teacher_questionnaires_student", table_name="teacher_questionnaires")
    op.drop_table("teacher_questionnaires")
