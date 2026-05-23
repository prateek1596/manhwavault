import json
import asyncio
from pathlib import Path

from backend.core import extension_manager as em


def make_dummy_extension(dirpath: Path) -> None:
    dirpath.mkdir(parents=True, exist_ok=True)
    (dirpath / "__init__.py").write_text("")
    manifest = {
        "name": "test-sample",
        "version": "0.0.1",
        "entry": "scraper.py",
        "class": "SampleScraper",
        "base_url": "https://example.local",
    }
    (dirpath / "extension.json").write_text(json.dumps(manifest))
    scraper_code = '''
from backend.core.base_scraper import BaseScraper, Manhwa, Chapter


class SampleScraper(BaseScraper):
    name = "test-sample"
    base_url = "https://example.local"

    async def search(self, query: str):
        return [Manhwa(id="1", title="Dummy", url="/d/1", cover="", latest_chapter="c1", source=self.name)]

    async def get_detail(self, manhwa_url: str):
        return Manhwa(id="1", title="Dummy", url=manhwa_url, cover="", latest_chapter="c1", source=self.name)

    async def get_chapters(self, manhwa_url: str):
        return [Chapter(id="c1", title="Ch 1", url="/c/1", number=1.0)]

    async def get_images(self, chapter_url: str):
        return ["/img/1.jpg"]

'''
    (dirpath / "scraper.py").write_text(scraper_code)


def test_loads_dummy_extension(tmp_path, monkeypatch):
    tmp_exts = tmp_path / "extensions"
    sample = tmp_exts / "ext-test-sample"
    make_dummy_extension(sample)

    # Point manager to temp extensions directory
    monkeypatch.setattr(em, "EXTENSIONS_DIR", tmp_exts)

    mgr = em.ExtensionManager()
    scrapers = mgr.load_all()

    assert "test-sample" in scrapers


def test_get_latest_chapter(tmp_path, monkeypatch):
    tmp_exts = tmp_path / "extensions"
    sample = tmp_exts / "ext-test-sample"
    make_dummy_extension(sample)
    monkeypatch.setattr(em, "EXTENSIONS_DIR", tmp_exts)

    mgr = em.ExtensionManager()
    scrapers = mgr.load_all()
    scraper = scrapers.get("test-sample")
    assert scraper is not None

    latest = asyncio.run(scraper.get_latest_chapter("/d/1"))
    assert latest is not None
    assert latest.title == "Ch 1"
