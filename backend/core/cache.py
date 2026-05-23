import time
import asyncio
from typing import Any, Dict, Optional


class SimpleCache:
    def __init__(self, ttl: int = 300):
        self.ttl = ttl
        self._store: Dict[str, tuple[Any, float]] = {}
        self._lock = asyncio.Lock()

    async def get(self, key: str) -> Optional[Any]:
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
        async with self._lock:
            self._store[key] = (value, time.time() + self.ttl)

    async def delete(self, key: str) -> None:
        async with self._lock:
            if key in self._store:
                del self._store[key]

    async def clear(self) -> None:
        async with self._lock:
            self._store.clear()
