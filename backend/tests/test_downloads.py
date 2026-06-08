from pathlib import Path

import pytest
from fastapi.testclient import TestClient

import main as appmod
from core.base_scraper import BaseScraper


class FakeScraper(BaseScraper):
    def __init__(self):
        self.name = "Fake Source"
        self.base_url = "https://fake.example"
        self.language = "en"
        self.nsfw = False
        self.version = "1.0.0"

    async def get_images(self, chapter_url: str):
        return [
            f"{chapter_url}/page-1.jpg",
            f"{chapter_url}/page-2.jpg",
        ]

    async def search(self, query: str):
        return []

    async def get_detail(self, manhwa_url: str):
        raise NotImplementedError

    async def get_chapters(self, manhwa_url: str):
        return []


@pytest.fixture()
def client(monkeypatch: pytest.MonkeyPatch, tmp_path: Path):
    fake_scrapers = {"Fake Source": FakeScraper()}
    monkeypatch.setattr(appmod.manager, "load_all", lambda: fake_scrapers.copy())
    monkeypatch.setattr(appmod.manager, "list_installed", lambda: [{"name": "Fake Source", "installed": True}])
    monkeypatch.setattr(appmod, "offline_dir", tmp_path / "offline")
    appmod.offline_dir.mkdir(parents=True, exist_ok=True)

    with TestClient(appmod.app) as test_client:
        yield test_client


def test_delete_downloaded_chapter_removes_server_folder(client: TestClient):
    folder = appmod.offline_dir / "chapter-1"
    folder.mkdir(parents=True, exist_ok=True)
    (folder / "page_001.jpg").write_bytes(b"fake-image")

    resp = client.delete("/download/chapter", params={"title": "chapter-1"})
    assert resp.status_code == 200
    payload = resp.json()
    assert payload["ok"] is True
    assert payload["removed"] is True
    assert not folder.exists()


def test_delete_downloaded_chapter_is_idempotent(client: TestClient):
    resp = client.delete("/download/chapter", params={"title": "missing-chapter"})
    assert resp.status_code == 200
    payload = resp.json()
    assert payload["ok"] is True
    assert payload["removed"] is False
