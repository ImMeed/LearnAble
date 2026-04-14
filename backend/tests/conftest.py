import os


# Enforce explicit test-time JWT key now that backend config rejects placeholders.
os.environ.setdefault(
    "JWT_SECRET_KEY",
    "learnable-tests-jwt-secret-key-2026-min32chars",
)

# Valid Fernet key for tests (32 null bytes, base64url-encoded — dev/test only).
os.environ.setdefault(
    "TOTP_ENCRYPTION_KEY",
    "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
)
