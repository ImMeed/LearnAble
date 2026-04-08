import os


# Enforce explicit test-time JWT key now that backend config rejects placeholders.
os.environ.setdefault(
    "JWT_SECRET_KEY",
    "learnable-tests-jwt-secret-key-2026-min32chars",
)
