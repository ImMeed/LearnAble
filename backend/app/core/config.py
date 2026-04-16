from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "LearnAble API"
    app_env: str = "dev"
    jwt_secret_key: str
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60
    database_url: str = "postgresql+psycopg://learnable:learnable@localhost:5433/learnable"
    gemini_api_key: str = ""
    gemini_mock: bool = False
    require_call_auth: bool = True
    reading_lab_enabled: bool = False
    classroom_system_enabled: bool = False

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

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")


settings = Settings()
