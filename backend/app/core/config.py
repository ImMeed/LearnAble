from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "LearnAble API"
    app_env: str = "dev"

    # JWT
    jwt_secret_key: str = "change-me"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60

    # Database
    database_url: str = "postgresql+psycopg://learnable:learnable@localhost:5432/learnable"

    # External APIs
    gemini_api_key: str = ""

    # 2FA / TOTP
    totp_issuer: str = "LearnAble"

    # Login lockout
    lockout_max_attempts: int = 10
    lockout_minutes: int = 15

    # CORS — comma-separated list of allowed origins
    cors_origins: str = "http://localhost:5173"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    def get_cors_origins(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]
    settings = Settings()