
import time
import asyncio
import os
from typing import Any, Dict, Optional

try:
    import redis.asyncio as aioredis  # type: ignore
except Exception:
    aioredis = None


class SimpleCache:
    def __init__(self, ttl: int = 300):
        self.ttl = ttl
        self._store: Dict[str, tuple[Any, float]] = {}
        self._lock = asyncio.Lock()
        self.redis_url = os.getenv("REDIS_URL")
        self._redis = None
        if self.redis_url and aioredis:
            try:
                self._redis = aioredis.from_url(self.redis_url)
            except Exception:
                self._redis = None

    async def get(self, key: str) -> Optional[Any]:
        if self._redis:
            try:
                v = await self._redis.get(key)
                return None if v is None else v
            except Exception:
                pass

        async with self._lock:
            item = self._store.get(key)
            if not item:
                return None
            value, expires = item
            if time.time() > expires:
                del self._store[key]
                return None
            return value

    async def set(self, key: str, value: Any) -> None:
        if self._redis:
            try:
                await self._redis.set(key, value, ex=self.ttl)
                return
            except Exception:
                pass

        async with self._lock:
            self._store[key] = (value, time.time() + self.ttl)

    async def delete(self, key: str) -> None:
        if self._redis:
            try:
                await self._redis.delete(key)
                return
            except Exception:
                pass

        async with self._lock:
            if key in self._store:
                del self._store[key]

    async def clear(self) -> None:
        if self._redis:
            try:
                await self._redis.flushdb()
                return
            except Exception:
                pass
        async with self._lock:
            self._store.clear()
