import pytest
import pytest_asyncio

from unittest.mock import AsyncMock, MagicMock, patch

from aiogram.fsm.context import FSMContext
from aiogram.fsm.storage.base import StorageKey
from aiogram.fsm.storage.memory import MemoryStorage
from aiogram import Bot

from bot.config import Config
from bot.api_client import ApiClient
from bot.handlers.start import (
    check_group_member,
    cmd_start,
    cmd_start_token,
    process_first_name,
    process_last_name,
    on_open_web,
    Registration,
)


@pytest.fixture
def config():
    return Config(
        bot_token="test-token",
        bot_internal_secret="test-secret",
        group_id=-1001234567890,
        backend_url="http://localhost:8000",
        webapp_url="https://tg.corpmeet.uz",
    )


@pytest.fixture
def api_client():
    client = AsyncMock(spec=ApiClient)
    client.ensure_user.return_value = {
        "id": "uuid-1",
        "telegram_id": 111,
        "first_name": "Artem",
        "last_name": "Ivanov",
        "username": "artem",
    }
    client.consume_session.return_value = {"ok": True}
    client.create_qr_session.return_value = {
        "token": "abc123",
        "bot_url": "https://t.me/corpmeetbot?start=abc123",
        "expires_in": 300,
    }
    return client


@pytest.fixture
def bot():
    return AsyncMock(spec=Bot)

@pytest_asyncio.fixture
async def state():
    storage = MemoryStorage()
    key = StorageKey(bot_id=1, chat_id=1, user_id=1)
    return FSMContext(storage=storage, key=key)

def make_message(user_id: int = 111, text: str = "", username: str = "artem"):
    message = AsyncMock()
    message.from_user = MagicMock()
    message.from_user.id = user_id
    message.from_user.first_name = "Artem"
    message.from_user.last_name = "Ivanov"
    message.from_user.username = username
    message.text = text
    message.answer = AsyncMock()
    return message


def make_callback(user_id: int = 111):
    callback = AsyncMock()
    callback.from_user = MagicMock()
    callback.from_user.id = user_id
    callback.message = AsyncMock()
    callback.message.answer = AsyncMock()
    callback.answer = AsyncMock()
    callback.data = "open_web"
    return callback


# --- check_group_member ---

@pytest.mark.asyncio
async def test_group_member_ok(bot):
    member = MagicMock()
    member.status = "member"
    bot.get_chat_member.return_value = member

    result = await check_group_member(bot, -100123, 111)
    assert result is True


@pytest.mark.asyncio
async def test_group_member_left(bot):
    member = MagicMock()
    member.status = "left"
    bot.get_chat_member.return_value = member

    result = await check_group_member(bot, -100123, 111)
    assert result is False


@pytest.mark.asyncio
async def test_group_member_exception(bot):
    bot.get_chat_member.side_effect = Exception("API error")

    result = await check_group_member(bot, -100123, 111)
    assert result is False


# --- /start (no token) ---

@pytest.mark.asyncio
async def test_start_not_in_group(bot, state, config, api_client):
    bot.get_chat_member.side_effect = Exception("not found")
    message = make_message()

    await cmd_start(message, bot, state, config, api_client)

    message.answer.assert_called_once_with("У вас нет доступа. Вы не состоите в рабочей группе.")


@pytest.mark.asyncio
async def test_start_existing_user(bot, state, config, api_client):
    member = MagicMock()
    member.status = "member"
    bot.get_chat_member.return_value = member
    message = make_message()

    await cmd_start(message, bot, state, config, api_client)

    api_client.ensure_user.assert_called_once()
    assert "Добро пожаловать" in message.answer.call_args_list[-1].args[0]


@pytest.mark.asyncio
async def test_start_new_user_triggers_fsm(bot, state, config, api_client):
    member = MagicMock()
    member.status = "member"
    bot.get_chat_member.return_value = member
    api_client.ensure_user.side_effect = Exception("404")
    message = make_message()

    await cmd_start(message, bot, state, config, api_client)

    current_state = await state.get_state()
    assert current_state == Registration.waiting_first_name


# --- FSM: first_name / last_name ---

@pytest.mark.asyncio
async def test_first_name_valid(state):
    message = make_message(text="Artem")
    await state.set_state(Registration.waiting_first_name)

    await process_first_name(message, state)

    data = await state.get_data()
    assert data["first_name"] == "Artem"
    current = await state.get_state()
    assert current == Registration.waiting_last_name


@pytest.mark.asyncio
async def test_first_name_cyrillic_rejected(state):
    message = make_message(text="Артём")
    await state.set_state(Registration.waiting_first_name)

    await process_first_name(message, state)

    message.answer.assert_called_with("Имя должно быть на латинице. Попробуйте ещё раз:")
    current = await state.get_state()
    assert current == Registration.waiting_first_name


@pytest.mark.asyncio
async def test_last_name_completes_registration(state, config, api_client):
    await state.set_state(Registration.waiting_last_name)
    await state.update_data(first_name="Artem")
    message = make_message(text="Ivanov")

    await process_last_name(message, state, config, api_client)

    api_client.ensure_user.assert_called_once_with(
        telegram_id=111,
        first_name="Artem",
        last_name="Ivanov",
        username="artem",
    )
    assert "Регистрация завершена" in message.answer.call_args_list[-1].args[0]
    current = await state.get_state()
    assert current is None


# --- /start <token> (QR flow) ---

@pytest.mark.asyncio
async def test_start_token_ok(bot, config, api_client):
    member = MagicMock()
    member.status = "member"
    bot.get_chat_member.return_value = member
    message = make_message()
    command = MagicMock()
    command.args = "abc123"

    await cmd_start_token(message, command, bot, config, api_client)

    api_client.consume_session.assert_called_once_with(token="abc123", telegram_id=111)
    message.answer.assert_called_with("Вы авторизованы. Вернитесь в браузер.")


@pytest.mark.asyncio
async def test_start_token_expired(bot, config, api_client):
    member = MagicMock()
    member.status = "member"
    bot.get_chat_member.return_value = member
    api_client.consume_session.side_effect = Exception("410 Gone")
    message = make_message()
    command = MagicMock()
    command.args = "expired_token"

    await cmd_start_token(message, command, bot, config, api_client)

    message.answer.assert_called_with("Ссылка недействительна или истекла. Попробуйте заново.")


# --- open_web callback ---

@pytest.mark.asyncio
async def test_open_web_ok(config, api_client):
    callback = make_callback()

    await on_open_web(callback, config, api_client)

    api_client.create_qr_session.assert_called_once()
    api_client.consume_session.assert_called_once_with(token="abc123", telegram_id=111)
    callback.message.answer.assert_called_once()
    call_kwargs = callback.message.answer.call_args
    assert "reply_markup" in call_kwargs.kwargs
    callback.answer.assert_called_once()


@pytest.mark.asyncio
async def test_open_web_error(config, api_client):
    api_client.create_qr_session.side_effect = Exception("backend down")
    callback = make_callback()

    await on_open_web(callback, config, api_client)

    callback.message.answer.assert_called_with("Не удалось создать сессию. Попробуйте позже.")
    callback.answer.assert_called_once()
