import os
from fastapi.testclient import TestClient

from backend import main as appmod


def test_protected_endpoints_require_api_key(monkeypatch):
    # set an API key
    monkeypatch.setenv("MANHWAVAULT_API_KEY", "secret123")
    client = TestClient(appmod.app)

    # /extensions/list is public; installation is protected
    r = client.get("/extensions/list")
    assert r.status_code == 200

    r2 = client.post("/extensions/install", json={"git_url": "https://x"})
    assert r2.status_code == 403

    r3 = client.post("/extensions/install", headers={"X-API-KEY": "secret123"}, json={"git_url": "https://x"})
    # since install performs git clone and may fail in test, allow 200 or 400 but not 403
    assert r3.status_code != 403
