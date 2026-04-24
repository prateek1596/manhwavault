from typing import Dict, List

import pytest
from fastapi.testclient import TestClient

import main as api_main
from core.base_scraper import BaseScraper, Chapter, Manhwa


class FakeScraper(BaseScraper):
    def __init__(self, name: str, base_url: str, nsfw: bool = False):
        self.name = name
        self.base_url = base_url
        self.language = "en"
        self.nsfw = nsfw
        self.version = "1.0.0"

    async def search(self, query: str) -> List[Manhwa]:
        slug = query.lower().replace(" ", "-")
        return [
            Manhwa(
                id=f"{self.name}-{slug}",
                title=f"{self.name} {query}",
                url=f"{self.base_url}/series/{slug}",
                cover=f"{self.base_url}/cover.jpg",
                latest_chapter="Chapter 10",
                source=self.name,
                status="ongoing",
                genres=["Action", "Manhwa"],
                description="Synthetic smoke-test entry",
            )
        ]

    async def get_detail(self, manhwa_url: str) -> Manhwa:
        return Manhwa(
            id=f"detail-{self.name}",
            title=f"Detail for {self.name}",
            url=manhwa_url,
            cover=f"{self.base_url}/cover.jpg",
            latest_chapter="Chapter 10",
            source=self.name,
            status="ongoing",
            genres=["Action", "Manhwa"],
            description="Synthetic detail",
        )

    async def get_chapters(self, manhwa_url: str) -> List[Chapter]:
        return [
            Chapter(
                id=f"{self.name}-ch-10",
                title="Chapter 10",
                url=f"{manhwa_url}/chapter-10",
                number=10,
                uploaded_at="2026-04-14",
            ),
            Chapter(
                id=f"{self.name}-ch-9",
                title="Chapter 9",
                url=f"{manhwa_url}/chapter-9",
                number=9,
                uploaded_at="2026-04-10",
            ),
        ]

    async def get_images(self, chapter_url: str) -> List[str]:
        return [
            f"{chapter_url}/1.jpg",
            f"{chapter_url}/2.jpg",
        ]


@pytest.fixture()
def fake_scrapers() -> Dict[str, BaseScraper]:
    return {
        "MangaDex": FakeScraper("MangaDex", "https://api.mangadex.org"),
        "Safe Source": FakeScraper("Safe Source", "https://safe.example"),
        "Vault Picks": FakeScraper("Vault Picks", "https://vault.local"),
        "NSFW Source": FakeScraper("NSFW Source", "https://nsfw.example", nsfw=True),
    }


@pytest.fixture()
def client(monkeypatch: pytest.MonkeyPatch, fake_scrapers: Dict[str, BaseScraper]):
    installed = [
        {
            "name": name,
            "version": scraper.version,
            "baseUrl": scraper.base_url,
            "language": scraper.language,
            "nsfw": scraper.nsfw,
            "iconUrl": "",
            "repoUrl": "",
            "installed": True,
        }
        for name, scraper in fake_scrapers.items()
    ]

    monkeypatch.setattr(api_main.manager, "load_all", lambda: fake_scrapers.copy())
    monkeypatch.setattr(api_main.manager, "list_installed", lambda: installed)
    monkeypatch.setattr(api_main.manager, "check_updates", lambda: [{"name": "Safe Source", "hasUpdate": False}])
    monkeypatch.setattr(api_main.manager, "install", lambda git_url: "ext-smoke")
    monkeypatch.setattr(api_main.manager, "update", lambda name: name)
    monkeypatch.setattr(api_main.manager, "remove", lambda name: name)

    with TestClient(api_main.app) as test_client:
        yield test_client


def test_health_and_extensions(client: TestClient):
    health = client.get("/health")
    assert health.status_code == 200
    payload = health.json()
    assert payload["status"] == "ok"
    assert "MangaDex" in payload["extensions"]

    extensions = client.get("/extensions")
    assert extensions.status_code == 200
    assert len(extensions.json()) == 4

    stats = client.get("/extensions/stats")
    assert stats.status_code == 200
    stats_payload = stats.json()
    assert stats_payload["total"] == 4
    assert stats_payload["safe"] == 3
    assert stats_payload["nsfw"] == 1


def test_sources_filtering(client: TestClient):
    safe_only = client.get("/sources")
    assert safe_only.status_code == 200
    names = {item["name"] for item in safe_only.json()}
    assert "Safe Source" in names
    assert "NSFW Source" not in names

    with_nsfw = client.get("/sources?include_nsfw=true")
    assert with_nsfw.status_code == 200
    names = {item["name"] for item in with_nsfw.json()}
    assert "NSFW Source" in names


def test_search_detail_reader_flow(client: TestClient):
    search = client.get("/search?q=solo leveling&source=MangaDex&limit=5")
    assert search.status_code == 200
    results = search.json()
    assert len(results) >= 1

    first = results[0]
    detail = client.get("/manhwa/detail", params={"url": first["url"], "source": first["source"]})
    assert detail.status_code == 200
    assert detail.json()["source"] == "MangaDex"

    chapters = client.get("/manhwa/chapters", params={"url": first["url"], "source": first["source"]})
    assert chapters.status_code == 200
    chapter_items = chapters.json()
    assert len(chapter_items) >= 1

    images = client.get("/chapter/images", params={"url": chapter_items[0]["url"], "source": first["source"]})
    assert images.status_code == 200
    assert len(images.json()) == 2


def test_search_by_source_and_updates_shape(client: TestClient):
    grouped = client.get("/search/by-source?q=tower")
    assert grouped.status_code == 200
    groups = grouped.json()
    assert len(groups) >= 2
    assert all("source" in g and "results" in g for g in groups)

    updates = client.post(
        "/updates",
        json={
            "series": [
                {"url": "https://safe.example/series/smoke", "source": "Safe Source"},
            ]
        },
    )
    assert updates.status_code == 200
    payload = updates.json()
    assert len(payload) == 1
    assert payload[0]["source"] == "Safe Source"
    assert isinstance(payload[0]["newChapters"], list)


def test_search_suggestions(client: TestClient):
    suggestions = client.get("/search/suggestions")
    assert suggestions.status_code == 200
    payload = suggestions.json()
    assert len(payload) >= 1
    assert all("title" in item and "source" in item for item in payload)

    filtered = client.get("/search/suggestions", params={"source": "Safe Source", "q": "tower"})
    assert filtered.status_code == 200
    items = filtered.json()
    assert len(items) >= 1
    assert all(item["source"] == "Safe Source" for item in items)


def test_extension_action_endpoints(client: TestClient):
    reload_resp = client.post("/extensions/reload")
    assert reload_resp.status_code == 200
    assert reload_resp.json()["loaded"] == 4

    install_resp = client.post("/extensions/install", params={"git_url": "https://github.com/example/ext-smoke"})
    assert install_resp.status_code == 200
    assert install_resp.json()["installed"] == "ext-smoke"

    update_resp = client.post("/extensions/update/Safe%20Source")
    assert update_resp.status_code == 200
    assert update_resp.json()["updated"] == "Safe Source"

    remove_resp = client.delete("/extensions/Safe%20Source")
    assert remove_resp.status_code == 200
    assert remove_resp.json()["removed"] == "Safe Source"

    check_updates = client.get("/extensions/check-updates")
    assert check_updates.status_code == 200
    assert check_updates.json() == [{"name": "Safe Source", "hasUpdate": False}]
