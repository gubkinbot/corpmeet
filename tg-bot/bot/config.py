from dataclasses import dataclass
import os
from dotenv import load_dotenv

load_dotenv()


@dataclass
class Config:
    bot_token: str
    bot_internal_secret: str
    group_id: int
    backend_url: str
    webapp_url: str


def load_config() -> Config:
    return Config(
        bot_token=os.environ["TELEGRAM_BOT_TOKEN"],
        bot_internal_secret=os.environ["BOT_INTERNAL_SECRET"],
        group_id=int(os.environ["GROUP_ID"]),
        backend_url=os.environ.get("BACKEND_URL", "http://backend:8000"),
        webapp_url=os.environ.get("WEBAPP_URL", "https://tg.corpmeet.uz"),
    )
