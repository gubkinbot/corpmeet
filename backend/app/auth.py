import hashlib
import hmac
import json
import uuid
from datetime import datetime, timedelta, timezone
from urllib.parse import parse_qs

import bcrypt
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models import User

security = HTTPBearer()

JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_DAYS = 7


def create_jwt(user_id: uuid.UUID) -> str:
    payload = {
        "sub": str(user_id),
        "exp": datetime.now(timezone.utc) + timedelta(days=JWT_EXPIRATION_DAYS),
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=JWT_ALGORITHM)


def decode_jwt(token: str) -> dict:
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> User:
    payload = decode_jwt(credentials.credentials)
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload")

    result = await db.execute(select(User).where(User.id == uuid.UUID(user_id)))
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user


def verify_telegram_init_data(init_data: str, bot_token: str) -> dict:
    """Verify Telegram Mini App initData signature (HMAC-SHA256).

    Returns parsed user data if valid, raises HTTPException otherwise.
    """
    parsed = parse_qs(init_data)

    if "hash" not in parsed:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing hash in initData")

    received_hash = parsed.pop("hash")[0]

    # Build check string: sorted key=value pairs joined by newline
    check_string = "\n".join(
        f"{k}={v[0]}" for k, v in sorted(parsed.items())
    )

    # Compute secret key: HMAC-SHA256("WebAppData", bot_token)
    secret_key = hmac.new(b"WebAppData", bot_token.encode(), hashlib.sha256).digest()

    # Compute hash of check string
    computed_hash = hmac.new(secret_key, check_string.encode(), hashlib.sha256).hexdigest()

    if not hmac.compare_digest(computed_hash, received_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid initData signature")

    # Check auth_date freshness (5 minutes)
    auth_date_str = parsed.get("auth_date", [None])[0]
    if auth_date_str:
        auth_date = datetime.fromtimestamp(int(auth_date_str), tz=timezone.utc)
        if datetime.now(timezone.utc) - auth_date > timedelta(minutes=5):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="initData expired")

    # Parse user JSON
    user_data_str = parsed.get("user", [None])[0]
    if not user_data_str:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="No user data in initData")

    return json.loads(user_data_str)


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, password_hash: str) -> bool:
    return bcrypt.checkpw(password.encode(), password_hash.encode())
