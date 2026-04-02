import asyncio
import logging

from aiogram import Bot, Dispatcher

from bot.config import load_config
from bot.api_client import ApiClient
from bot.handlers import setup_routers

logging.basicConfig(level=logging.INFO)


async def main():
    config = load_config()
    bot = Bot(token=config.bot_token)
    api_client = ApiClient(
        backend_url=config.backend_url,
        bot_internal_secret=config.bot_internal_secret,
    )

    dp = Dispatcher()
    dp.include_router(setup_routers())

    dp["config"] = config
    dp["api_client"] = api_client

    try:
        await dp.start_polling(bot)
    finally:
        await api_client.close()
        await bot.session.close()


if __name__ == "__main__":
    asyncio.run(main())
