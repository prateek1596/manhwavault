import hashlib
import re
from typing import Any, List, Optional
import sys
from pathlib import Path

import httpx

sys.path.insert(0, str(Path(__file__).parent.parent.parent / "core"))
from base_scraper import BaseScraper, Chapter, Manhwa


HEADERS = {
    "User-Agent": "ManhwaVault/1.0 (+https://github.com/local/manhwavault)",
}


def _make_id(value: str) -> str:
    return hashlib.md5(value.encode("utf-8")).hexdigest()[:12]


def _first_text(localized: dict[str, str] | None) -> str:
    if not localized:
        return "Unknown"
    if localized.get("en"):
        return localized["en"]
    return next(iter(localized.values()), "Unknown")


def _extract_manga_id(manhwa_url: str) -> str:
    # Accept plain id or a full MangaDex URL.
    m = re.search(r"/title/([0-9a-f\-]{20,})", manhwa_url)
    return m.group(1) if m else manhwa_url.strip()


def _extract_chapter_id(chapter_url: str) -> str:
    # Accept plain id or a full MangaDex URL.
    m = re.search(r"/chapter/([0-9a-f\-]{20,})", chapter_url)
    return m.group(1) if m else chapter_url.strip()


class MangaDexEnglishPack097Scraper(BaseScraper):
    name = "English Pack 097"
    base_url = "https://api.mangadex.org"
    language = "en"
    nsfw = False
    version = "1.0.0"

    async def _get(self, path: str, params: Optional[dict[str, Any]] = None) -> dict[str, Any]:
        async with httpx.AsyncClient(headers=HEADERS, timeout=20, follow_redirects=True) as client:
            resp = await client.get(f"{self.base_url}{path}", params=params)
            resp.raise_for_status()
            return resp.json()

    @staticmethod
    def _cover_url(manga_id: str, item: dict[str, Any]) -> str:
        for rel in item.get("relationships", []):
            if rel.get("type") == "cover_art":
                file_name = rel.get("attributes", {}).get("fileName")
                if file_name:
                    return f"https://uploads.mangadex.org/covers/{manga_id}/{file_name}.256.jpg"
        return ""

    async def search(self, query: str) -> List[Manhwa]:
        data = await self._get(
            "/manga",
            params={
                "title": query,
                "limit": 20,
                "includes[]": ["cover_art"],
                "availableTranslatedLanguage[]": ["en"],
            },
        )

        results: List[Manhwa] = []
        for item in data.get("data", []):
            manga_id = item.get("id", "")
            attrs = item.get("attributes", {})
            title = _first_text(attrs.get("title"))
            cover = self._cover_url(manga_id, item)
            results.append(
                Manhwa(
                    id=_make_id(f"md:{manga_id}"),
                    title=title,
                    url=manga_id,
                    cover=cover,
                    latest_chapter="",
                    source=self.name,
                    status=(attrs.get("status") or None),
                    genres=[
                        _first_text(tag.get("attributes", {}).get("name"))
                        for tag in attrs.get("tags", [])
                    ],
                    description=_first_text(attrs.get("description")) if attrs.get("description") else None,
                )
            )
        return results

    async def get_detail(self, manhwa_url: str) -> Manhwa:
        manga_id = _extract_manga_id(manhwa_url)
        data = await self._get(f"/manga/{manga_id}", params={"includes[]": ["cover_art"]})

        item = data.get("data", {})
        attrs = item.get("attributes", {})
        title = _first_text(attrs.get("title"))
        cover = self._cover_url(manga_id, item)

        return Manhwa(
            id=_make_id(f"md:{manga_id}"),
            title=title,
            url=manga_id,
            cover=cover,
            latest_chapter="",
            source=self.name,
            status=(attrs.get("status") or None),
            genres=[
                _first_text(tag.get("attributes", {}).get("name"))
                for tag in attrs.get("tags", [])
            ],
            description=_first_text(attrs.get("description")) if attrs.get("description") else None,
        )

    async def get_chapters(self, manhwa_url: str) -> List[Chapter]:
        manga_id = _extract_manga_id(manhwa_url)

        async def fetch_chapters(translated_lang: Optional[str]) -> List[Chapter]:
            chapters: List[Chapter] = []
            offset = 0
            limit = 100

            while True:
                params: dict[str, Any] = {
                    "manga": manga_id,
                    "order[chapter]": "desc",
                    "limit": limit,
                    "offset": offset,
                }
                if translated_lang:
                    params["translatedLanguage[]"] = [translated_lang]

                data = await self._get("/chapter", params=params)
                rows = data.get("data", [])
                if not rows:
                    break

                for item in rows:
                    chapter_id = item.get("id", "")
                    attrs = item.get("attributes", {})

                    # Skip external chapters that are not hosted on MangaDex At-Home.
                    if attrs.get("externalUrl"):
                        continue

                    raw_num = attrs.get("chapter")
                    try:
                        number = float(raw_num) if raw_num is not None else 0.0
                    except Exception:
                        number = 0.0

                    display_num = raw_num if raw_num is not None else "?"
                    title_suffix = f": {attrs.get('title')}" if attrs.get("title") else ""

                    chapters.append(
                        Chapter(
                            id=_make_id(f"mdc:{chapter_id}"),
                            title=f"Chapter {display_num}{title_suffix}",
                            url=chapter_id,
                            number=number,
                            uploaded_at=attrs.get("readableAt") or attrs.get("publishAt"),
                        )
                    )

                total = data.get("total", 0)
                offset += len(rows)
                if offset >= total or offset >= 300:
                    break

            return chapters

        chapters = await fetch_chapters("en")
        if chapters:
            return chapters

        # Some series expose stale language metadata; fallback to any language
        # so users can still open chapters and read.
        return await fetch_chapters(None)

    async def get_images(self, chapter_url: str) -> List[str]:
        chapter_id = _extract_chapter_id(chapter_url)

        async with httpx.AsyncClient(headers=HEADERS, timeout=20, follow_redirects=True) as client:
            resp = await client.get(f"https://api.mangadex.org/at-home/server/{chapter_id}")
            resp.raise_for_status()
            data = resp.json()

        chapter = data.get("chapter", {})
        base = data.get("baseUrl", "")
        chapter_hash = chapter.get("hash", "")
        files = chapter.get("data", []) or chapter.get("dataSaver", [])

        if not base or not chapter_hash:
            return []

        return [f"{base}/data/{chapter_hash}/{f}" for f in files]