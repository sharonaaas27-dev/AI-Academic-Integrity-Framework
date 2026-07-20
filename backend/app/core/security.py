from datetime import datetime, timedelta, timezone
from typing import Optional, Any
from uuid import UUID

import bcrypt
from jose import JWTError, jwt
from .config import settings


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode(), hashed_password.encode())


def create_access_token(
    subject: UUID | str,
    role: str,
    institution_id: UUID | str,
    session_id: UUID | str,
    expires_delta: Optional[timedelta] = None,
) -> str:
    if expires_delta is None:
        expires_delta = timedelta(minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES)

    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(subject),
        "role": role,
        "institution_id": str(institution_id),
        "session_id": str(session_id),
        "iat": now,
        "exp": now + expires_delta,
        "type": "access",
    }
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def create_refresh_token(
    subject: UUID | str,
    session_id: UUID | str,
    expires_delta: Optional[timedelta] = None,
) -> str:
    if expires_delta is None:
        expires_delta = timedelta(days=settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS)

    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(subject),
        "session_id": str(session_id),
        "iat": now,
        "exp": now + expires_delta,
        "type": "refresh",
    }
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_token(token: str) -> dict[str, Any]:
    try:
        payload = jwt.decode(
            token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM]
        )
        return payload
    except JWTError:
        return {}


def verify_token(token: str, expected_type: str = "access") -> Optional[dict[str, Any]]:
    payload = decode_token(token)
    if not payload or payload.get("type") != expected_type:
        return None
    if datetime.fromtimestamp(payload["exp"], tz=timezone.utc) < datetime.now(
        timezone.utc
    ):
        return None
    return payload
