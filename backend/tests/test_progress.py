import json
from fastapi.testclient import TestClient

from backend.main import app


client = TestClient(app)


def test_put_and_get_progress():
    payload = {
        "user_id": "testuser",
        "manga_id": "manga-123",
        "chapter_url": "https://example.com/ch/1",
        "page_num": 5,
        "position": 0.0,
    }

    resp = client.put("/progress", json=payload)
    assert resp.status_code == 200
    body = resp.json()
    assert body.get("ok") is True
    assert body.get("saved", {}).get("page_num") == 5

    # Now fetch by chapter_url
    get_resp = client.get("/progress", params={"chapter_url": payload["chapter_url"], "user_id": "testuser"})
    assert get_resp.status_code == 200
    fetched = get_resp.json()
    assert fetched.get("page_num") == 5

    # Fetch by manga_id fallback
    get_resp2 = client.get("/progress", params={"manga_id": payload["manga_id"], "user_id": "testuser"})
    assert get_resp2.status_code == 200
    fetched2 = get_resp2.json()
    # either chapter-level or manga-level stored under key; ensure structure exists
    assert isinstance(fetched2, dict)
