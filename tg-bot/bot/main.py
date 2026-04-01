import asyncio
import os

from aiogram import Bot, Dispatcher, types
from aiogram.filters import CommandStart
from aiogram.types import InlineKeyboardButton, InlineKeyboardMarkup, WebAppInfo

TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
WEBAPP_URL = os.getenv("WEBAPP_URL", "https://tg.corpmeet.uz")

bot = Bot(token=TOKEN)
dp = Dispatcher()


@dp.message(CommandStart())
async def cmd_start(message: types.Message):
    keyboard = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(
            text="Открыть CorpMeet",
            web_app=WebAppInfo(url=WEBAPP_URL),
        )]
    ])
    await message.answer(
        "Привет! Я бот CorpMeet. Нажми кнопку, чтобы открыть приложение.",
        reply_markup=keyboard,
    )


@dp.message()
async def echo(message: types.Message):
    await message.answer(message.text or "🤔")


async def main():
    await dp.start_polling(bot)


if __name__ == "__main__":
    asyncio.run(main())
