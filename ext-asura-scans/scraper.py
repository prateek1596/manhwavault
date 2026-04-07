import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

import re
import httpx
from bs4 import BeautifulSoup
from typing import List, Optional
from core.base_scraper import BaseScraper, Manhwa, Chapter

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Referer": "https://asuracomic.net/",
}


def _slug_to_id(url: str) -> str:
    """Extract a stable ID from a series URL slug."""
    return re.sub(r"[^a-z0-9]+", "-", url.rstrip("/").split("/")[-1].lower())


def _parse_number(title: str) -> float:
    """Extract chapter number from title string like 'Chapter 42' or 'Ch. 42.5'."""
    m = re.search(r"(\d+(?:\.\d+)?)", title)
    return float(m.group(1)) if m else 0.0


class AsuraScraper(BaseScraper):
    name = "Asura Scans"
    base_url = "https://asuracomic.net"
    language = "en"
    nsfw = False
    version = "1.0.0"

    async def _get(self, url: str) -> BeautifulSoup:
        async with httpx.AsyncClient(headers=HEADERS, follow_redirects=True, timeout=20) as client:
            r = await client.get(url)
            r.raise_for_status()
        return BeautifulSoup(r.text, "lxml")

    async def search(self, query: str) -> List[Manhwa]:
        soup = await self._get(f"{self.base_url}/series?name={query}")
        results = []

        for card in soup.select("div.grid > a, div.listupd a.series"):
            title_el = card.select_one("span.block, h3, .tt")
            cover_el = card.select_one("img")
            chapter_el = card.select_one(".epxs, .chapter, span.text-\\[13px\\]")

            if not title_el:
                continue

            href = card.get("href", "")
            if not href.startswith("http"):
                href = self.base_url + href

            results.append(Manhwa(
                id=_slug_to_id(href),
                title=title_el.get_text(strip=True),
                url=href,
                cover=cover_el.get("src", cover_el.get("data-src", "")) if cover_el else "",
                latest_chapter=chapter_el.get_text(strip=True) if chapter_el else "Unknown",
                source=self.name,
            ))

        return results

    async def get_detail(self, manhwa_url: str) -> Manhwa:
        soup = await self._get(manhwa_url)

        title = soup.select_one("span.text-xl.font-bold, h1.entry-title")
        cover = soup.select_one("img.rounded, div.thumb img")
        status = soup.select_one("div.status, .imptdt i")
        desc = soup.select_one("div.wd-full p, div.entry-content p, div[class*='description'] p")
        genres = [g.get_text(strip=True) for g in soup.select("span.mgen a, div.gnr a, a[rel='tag']")]
        latest = soup.select_one("div.eplister li:first-child a, ul.clstyle li:first-child .chapternum")

        return Manhwa(
            id=_slug_to_id(manhwa_url),
            title=title.get_text(strip=True) if title else "Unknown",
            url=manhwa_url,
            cover=cover.get("src", cover.get("data-src", "")) if cover else "",
            latest_chapter=latest.get_text(strip=True) if latest else "Unknown",
            source=self.name,
            status=status.get_text(strip=True) if status else None,
            genres=genres,
            description=desc.get_text(strip=True) if desc else None,
        )

    async def get_chapters(self, manhwa_url: str) -> List[Chapter]:
        soup = await self._get(manhwa_url)
        chapters = []

        for item in soup.select("div.eplister li, ul.clstyle li"):
            link = item.select_one("a")
            if not link:
                continue

            href = link.get("href", "")
            if not href.startswith("http"):
                href = self.base_url + href

            num_el = item.select_one(".chapternum, span.epcurlain, .chnum")
            date_el = item.select_one(".chapterdate, .epdate, time")
            title = num_el.get_text(strip=True) if num_el else link.get_text(strip=True)
            number = _parse_number(title)

            chapters.append(Chapter(
                id=_slug_to_id(href),
                title=title,
                url=href,
                number=number,
                uploaded_at=date_el.get_text(strip=True) if date_el else None,
            ))

        return chapters

    async def get_images(self, chapter_url: str) -> List[str]:
        soup = await self._get(chapter_url)
        images = []

        # Asura serves images inside a reader div
        for img in soup.select("div#readerarea img, div.rdminimal img, div[id*='content'] img"):
            src = img.get("src") or img.get("data-src") or img.get("data-lazy-src", "")
            if src and src.startswith("http") and any(
                ext in src.lower() for ext in [".jpg", ".jpeg", ".png", ".webp"]
            ):
                images.append(src)

        return images
