import os
from fastapi import HTTPException, Security
from fastapi.security.api_key import APIKeyHeader

api_key_header = APIKeyHeader(name="X-API-KEY", auto_error=False)


def require_api_key(api_key: str = Security(api_key_header)) -> bool:
    configured = os.getenv("MANHWAVAULT_API_KEY")
    # If no API key configured, allow all actions (dev mode)
    if not configured:
        return True
    if api_key == configured:
        return True
    raise HTTPException(status_code=403, detail="Invalid or missing API Key")
