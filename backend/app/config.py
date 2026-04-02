from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://corpmeet:changeme@db:5432/corpmeet"
    jwt_secret: str = "change-me-in-production"
    telegram_bot_token: str = ""
    bot_internal_secret: str = ""
    corpmeet_dev: str = ""
    frontend_url: str = "http://localhost:3000"
    app_timezone: str = "Asia/Tashkent"
    tg_bot_username: str = "corpmeetbot"

    class Config:
        env_file = ".env"


settings = Settings()
