from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://corpmeet:changeme@db:5432/corpmeet"

    class Config:
        env_file = ".env"


settings = Settings()
