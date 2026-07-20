from typing import Optional, Any, Set
import json
from datetime import timedelta

import redis.asyncio as aioredis

from .config import settings


class RedisCache:
    _instance: Optional["RedisCache"] = None
    _client: Optional[aioredis.Redis] = None

    def __new__(cls) -> "RedisCache":
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    async def connect(self) -> None:
        if self._client is None:
            try:
                client = aioredis.from_url(
                    str(settings.REDIS_URL),
                    encoding="utf-8",
                    decode_responses=True,
                    socket_connect_timeout=2,
                    retry_on_timeout=False,
                )
                await client.ping()
                self._client = client
            except Exception:
                self._client = None

    async def disconnect(self) -> None:
        if self._client:
            await self._client.close()
            self._client = None

    async def _call(self, method: str, *args, **kwargs):
        if not self._client:
            return None
        try:
            fn = getattr(self._client, method)
            return await fn(*args, **kwargs)
        except Exception:
            self._client = None
            return None

    async def get(self, key: str) -> Optional[Any]:
        value = await self._call("get", key)
        if value is None:
            return None
        try:
            return json.loads(value)
        except (json.JSONDecodeError, TypeError):
            return value

    async def set(
        self, key: str, value: Any, ttl: Optional[int] = None
    ) -> None:
        serialized = json.dumps(value, default=str)
        if ttl is not None:
            await self._call("setex", key, ttl, serialized)
        else:
            await self._call("set", key, serialized)

    async def delete(self, key: str) -> None:
        await self._call("delete", key)

    async def exists(self, key: str) -> bool:
        return bool(await self._call("exists", key))

    async def expire(self, key: str, ttl: int) -> None:
        await self._call("expire", key, ttl)

    async def sadd(self, key: str, *values: str) -> None:
        await self._call("sadd", key, *values)

    async def srem(self, key: str, *values: str) -> None:
        await self._call("srem", key, *values)

    async def smembers(self, key: str) -> Set[str]:
        result = await self._call("smembers", key)
        return set(result) if result else set()

    async def lpush(self, key: str, *values: Any) -> None:
        serialized = [json.dumps(v, default=str) for v in values]
        await self._call("lpush", key, *serialized)

    async def rpop(self, key: str, count: int = 1) -> list[Any]:
        values = await self._call("rpop", key, count)
        if not values:
            return []
        result = []
        for v in values:
            try:
                result.append(json.loads(v))
            except (json.JSONDecodeError, TypeError):
                result.append(v)
        return result

    async def llen(self, key: str) -> int:
        return await self._call("llen", key) or 0


cache = RedisCache()
