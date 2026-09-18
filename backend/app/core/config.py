from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    PROJECT_NAME: str = "PackagePro"
    DATABASE_URL: str = "postgresql://packagepro_user:packagepro_password@localhost:5432/packagepro"
    REDIS_URL: str = "redis://localhost:6379/0"
    KAFKA_BOOTSTRAP_SERVERS: str = "localhost:9092"
    OPENAI_API_KEY: str = ""


settings = Settings()
