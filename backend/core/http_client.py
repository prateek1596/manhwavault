import asyncio
import logging
from typing import Any, Dict, Optional

import httpx

logger = logging.getLogger(__name__)


async def get(
    url: str,
    params: Optional[Dict[str, Any]] = None,
    headers: Optional[Dict[str, str]] = None,
    timeout: int = 20,
    retries: int = 2,
    follow_redirects: bool = True,
):
    last_exc = None
    for attempt in range(1, retries + 2):
        try:
            async with httpx.AsyncClient(timeout=timeout, follow_redirects=follow_redirects) as client:
                resp = await client.get(url, params=params, headers=headers)
                resp.raise_for_status()
                return resp
        except Exception as e:
            last_exc = e
            logger.debug(f"HTTP GET attempt {attempt} failed for {url}: {e}")
            if attempt <= retries:
                await asyncio.sleep(0.5 * attempt)
                continue
            raise


async def fetch_json(*args, **kwargs):
    resp = await get(*args, **kwargs)
    return resp.json()
