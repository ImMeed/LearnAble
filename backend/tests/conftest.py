import os

from sqlalchemy import create_engine

from app.core.config import settings

# Enforce explicit test-time JWT key now that backend config rejects placeholders.
os.environ.setdefault(
    "JWT_SECRET_KEY",
    "learnable-tests-jwt-secret-key-2026-min32chars",
)


def _ensure_test_schema() -> None:
    try:
        engine = create_engine(settings.database_url, future=True)
        with engine.begin() as connection:
            connection.exec_driver_sql(
                "ALTER TABLE users "
                "ADD COLUMN IF NOT EXISTS display_name VARCHAR(120)"
            )
    except Exception:
        # Keep tests importable even if the database is not available yet.
        pass


_ensure_test_schema()
