from aiogram import Bot, Router, types
from aiogram.filters import CommandStart, CommandObject
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from aiogram.types import InlineKeyboardButton, InlineKeyboardMarkup, WebAppInfo

from bot.api_client import ApiClient
from bot.config import Config

router = Router()


class Registration(StatesGroup):
    waiting_first_name = State()
    waiting_last_name = State()


async def check_group_member(bot: Bot, group_id: int, user_id: int) -> bool:
    try:
        member = await bot.get_chat_member(chat_id=group_id, user_id=user_id)
        return member.status not in ("left", "kicked")
    except Exception:
        return False


def main_keyboard(webapp_url: str) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(
            text="Открыть Telegram App",
            web_app=WebAppInfo(url=webapp_url),
        )],
        [InlineKeyboardButton(
            text="Открыть Web",
            callback_data="open_web",
        )],
    ])


@router.message(CommandStart(deep_link=True))
async def cmd_start_token(
    message: types.Message,
    command: CommandObject,
    bot: Bot,
    config: Config,
    api_client: ApiClient,
):
    token = command.args
    user_id = message.from_user.id

    if not await check_group_member(bot, config.group_id, user_id):
        await message.answer("У вас нет доступа. Вы не состоите в рабочей группе.")
        return

    try:
        await api_client.consume_session(token=token, telegram_id=user_id)
        await message.answer("Вы авторизованы. Вернитесь в браузер.")
    except Exception:
        await message.answer("Ссылка недействительна или истекла. Попробуйте заново.")


@router.message(CommandStart())
async def cmd_start(
    message: types.Message,
    bot: Bot,
    state: FSMContext,
    config: Config,
    api_client: ApiClient,
):
    user_id = message.from_user.id

    if not await check_group_member(bot, config.group_id, user_id):
        await message.answer("У вас нет доступа. Вы не состоите в рабочей группе.")
        return

    try:
        await api_client.ensure_user(
            telegram_id=user_id,
            first_name=message.from_user.first_name or "Unknown",
            last_name=message.from_user.last_name or "",
            username=message.from_user.username,
        )
        await message.answer(
            "Добро пожаловать в CorpMeet!",
            reply_markup=main_keyboard(config.webapp_url),
        )
    except Exception:
        await message.answer("Введите ваше имя (латиницей):")
        await state.set_state(Registration.waiting_first_name)


@router.message(Registration.waiting_first_name)
async def process_first_name(message: types.Message, state: FSMContext):
    first_name = message.text.strip()
    if not first_name.isascii() or not first_name.isalpha():
        await message.answer("Имя должно быть на латинице. Попробуйте ещё раз:")
        return
    await state.update_data(first_name=first_name)
    await message.answer("Введите вашу фамилию (латиницей):")
    await state.set_state(Registration.waiting_last_name)


@router.message(Registration.waiting_last_name)
async def process_last_name(
    message: types.Message,
    state: FSMContext,
    config: Config,
    api_client: ApiClient,
):
    last_name = message.text.strip()
    if not last_name.isascii() or not last_name.isalpha():
        await message.answer("Фамилия должна быть на латинице. Попробуйте ещё раз:")
        return

    data = await state.get_data()
    first_name = data["first_name"]

    try:
        await api_client.ensure_user(
            telegram_id=message.from_user.id,
            first_name=first_name,
            last_name=last_name,
            username=message.from_user.username,
        )
    except Exception:
        await state.clear()
        await message.answer("Ошибка связи с сервером. Попробуйте /start позже.")
        return

    await state.clear()
    await message.answer(
        f"Регистрация завершена, {first_name} {last_name}!",
        reply_markup=main_keyboard(config.webapp_url),
    )



@router.callback_query(lambda c: c.data == "open_web")
async def on_open_web(
    callback: types.CallbackQuery,
    config: Config,
    api_client: ApiClient,
):
    user_id = callback.from_user.id

    try:
        qr = await api_client.create_qr_session()
        token = qr["token"]

        await api_client.consume_session(token=token, telegram_id=user_id)

        url = f"https://corpmeet.uz/auth/session/{token}"
        keyboard = InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(text="Перейти на сайт", url=url)],
        ])
        await callback.message.answer("Нажмите кнопку для перехода:", reply_markup=keyboard)
    except Exception:
        await callback.message.answer("Не удалось создать сессию. Попробуйте позже.")

    await callback.answer()
