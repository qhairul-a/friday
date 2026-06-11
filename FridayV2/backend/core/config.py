from pydantic_settings import BaseSettings
from functools import lru_cache
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    # Anthropic
    ANTHROPIC_API_KEY: str

    # Supabase
    SUPABASE_URL: str
    SUPABASE_KEY: str

    # Telegram
    TELEGRAM_BOT_TOKEN: str
    TELEGRAM_USER_ID: int

    # LiveKit
    LIVEKIT_API_KEY: str
    LIVEKIT_API_SECRET: str
    LIVEKIT_URL: str

    # Deepgram
    DEEPGRAM_API_KEY: str

    # Tavily
    TAVILY_API_KEY: str

    # Finance
    FINANCE_FOLDER_ID: str = "1Ei0A9dlWroT_V5WAzjE9IjPzHhM0c7Zm"
    CURRENCY: str = "SGD"

    # Garmin
    GARMIN_EMAIL: str = ""
    GARMIN_PASSWORD: str = ""
    GARMIN_TOKEN_DIR: Path = BASE_DIR / "secrets" / "garmin_tokens"
    GARMIN_DAILY_PUSH_TIME: str = "08:00"

    # Google
    GOOGLE_CLIENT_SECRET_FILE: Path = BASE_DIR / "secrets" / "google-client-secret.json"
    GDRIVE_TOKEN_FILE: Path = BASE_DIR / "secrets" / "gdrive_token.json"
    GDRIVE_VAULT_NAME: str = "Q _obsidian"
    GOOGLE_TTS_CREDENTIALS: Path = BASE_DIR / "secrets" / "google_tts_key.json"

    # Models — Haiku by default; upgrade to Sonnet in Phase 2+ for multi-agent chains
    FRIDAY_MODEL: str = "claude-haiku-4-5-20251001"
    NOTES_AGENT_MODEL: str = "claude-haiku-4-5-20251001"

    # OpenWeather
    OPENWEATHER_API_KEY: str = ""
    HOME_LAT: float = 1.3521
    HOME_LON: float = 103.8198

    # App
    TIMEZONE: str = "Asia/Singapore"
    CLOUD_RUN_URL: str = "https://friday-v2-bot-942269771056.asia-southeast1.run.app"

    class Config:
        env_file = BASE_DIR / ".env"
        env_file_encoding = "utf-8"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
