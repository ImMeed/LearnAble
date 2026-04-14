from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "LearnAble API"
    app_env: str = "dev"
    jwt_secret_key: str
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60

    # Database
    database_url: str = "postgresql+psycopg://learnable:learnable@localhost:5433/learnable"

    # External APIs
    gemini_api_key: str = ""
    require_call_auth: bool = True

    @field_validator("jwt_secret_key")
    @classmethod
    def validate_jwt_secret_key(cls, value: str) -> str:
        secret = value.strip()
        weak_values = {
            "change-me",
            "changeme",
            "default",
            "secret",
            "jwt-secret",
            "learnable",
            "test",
        }
        if not secret:
            raise ValueError("JWT_SECRET_KEY is required and cannot be empty.")
        if secret.lower() in weak_values:
            raise ValueError("JWT_SECRET_KEY uses an insecure placeholder value.")
        if len(secret) < 32:
            raise ValueError("JWT_SECRET_KEY must be at least 32 characters long.")
        return secret

    # 2FA / TOTP
    totp_issuer: str = "LearnAble"
    totp_encryption_key: str  # required — Fernet key (44-char base64url)

    @field_validator("totp_encryption_key")
    @classmethod
    def validate_totp_encryption_key(cls, v: str) -> str:
        from cryptography.fernet import Fernet, InvalidToken
        try:
            Fernet(v.encode())
        except Exception:
            raise ValueError(
                "TOTP_ENCRYPTION_KEY must be a valid Fernet key. "
                "Generate one with: python -c \"from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())\""
            )
        return v

    # Login lockout
    lockout_max_attempts: int = 10
    lockout_minutes: int = 15

    # CORS — comma-separated list of allowed origins
    cors_origins: str = "http://localhost:5173"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    def get_cors_origins(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]
settings = Settings()