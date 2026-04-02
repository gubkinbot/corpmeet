import aiohttp
from typing import Optional

class ApiClient:
    def __init__(self, backend_url: str, bot_internal_secret: str):
        self._base = backend_url.rstrip("/")
        self._secret = bot_internal_secret
        self._session: Optional[aiohttp.ClientSession] = None

    async def _get_session(self) -> aiohttp.ClientSession:
        if self._session is None or self._session.closed:
            self._session = aiohttp.ClientSession()
        return self._session

    def _internal_headers(self) -> dict[str, str]:
        return {"X-Bot-Secret": self._secret}

    async def ensure_user(
        self,
        telegram_id: int,
        first_name: str,
        last_name: str,
        username: Optional[str] = None,

    ) -> dict:
        session = await self._get_session()
        payload = {
            "telegram_id": telegram_id,
            "first_name": first_name,
            "last_name": last_name,
            "username": username or "",
        }
        async with session.post(
            f"{self._base}/api/internal/users/ensure",
            json=payload,
            headers=self._internal_headers(),
        ) as resp:
            resp.raise_for_status()
            return await resp.json()

    async def consume_session(self, token: str, telegram_id: int) -> dict:
        session = await self._get_session()
        payload = {"token": token, "telegram_id": telegram_id}
        async with session.post(
            f"{self._base}/api/internal/auth/consume-session",
            json=payload,
            headers=self._internal_headers(),
        ) as resp:
            resp.raise_for_status()
            return await resp.json()

    async def create_qr_session(self) -> dict:
        session = await self._get_session()
        async with session.post(
            f"{self._base}/api/auth/qr-session",
        ) as resp:
            resp.raise_for_status()
            return await resp.json()

    async def close(self) -> None:
        if self._session and not self._session.closed:
            await self._session.close()
