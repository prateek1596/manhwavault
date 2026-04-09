import httpx

try:
    from curl_cffi.requests import AsyncSession
except Exception:  # pragma: no cover - optional dependency at runtime
    AsyncSession = None


BLOCKED_STATUS_CODES = {403, 429, 502}


async def _fetch_with_curl_cffi(url: str, headers: dict, timeout: int) -> str:
    if AsyncSession is None:
        raise RuntimeError("curl_cffi is not installed")

    async with AsyncSession() as session:
        response = await session.get(
            url,
            headers=headers,
            timeout=timeout,
            impersonate="chrome",
            allow_redirects=True,
        )
        status_code = int(getattr(response, "status_code", 0))
        if status_code >= 400:
            raise RuntimeError(f"HTTP {status_code}")
        return response.text


async def fetch_html(url: str, headers: dict, timeout: int = 20) -> str:
    try:
        async with httpx.AsyncClient(headers=headers, timeout=timeout, follow_redirects=True) as client:
            response = await client.get(url)
            if response.status_code in BLOCKED_STATUS_CODES and AsyncSession is not None:
                return await _fetch_with_curl_cffi(url, headers, timeout)
            response.raise_for_status()
            return response.text
    except httpx.HTTPStatusError as e:
        status_code = e.response.status_code if e.response is not None else 0
        if status_code in BLOCKED_STATUS_CODES and AsyncSession is not None:
            return await _fetch_with_curl_cffi(url, headers, timeout)
        raise
    except Exception:
        if AsyncSession is not None:
            return await _fetch_with_curl_cffi(url, headers, timeout)
        raise
