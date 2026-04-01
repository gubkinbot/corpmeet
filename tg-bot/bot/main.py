import asyncio
import os

from aiogram import Bot, Dispatcher, types
from aiogram.filters import CommandStart

TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")

bot = Bot(token=TOKEN)
dp = Dispatcher()


@dp.message(CommandStart())
async def cmd_start(message: types.Message):
    await message.answer("Привет! Я бот CorpMeet. Пока работаю в режиме пинг-понг.")


@dp.message()
async def echo(message: types.Message):
    await message.answer(message.text or "🤔")


async def main():
    await dp.start_polling(bot)


if __name__ == "__main__":
    asyncio.run(main())
