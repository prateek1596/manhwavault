import hashlib
import re
from typing import List
from urllib.parse import quote_plus, urljoin
import sys
from pathlib import Path

import httpx
from bs4 import BeautifulSoup

sys.path.insert(0, str(Path(__file__).parent.parent.parent / "core"))
from base_scraper import BaseScraper, Chapter, Manhwa
from http_fallback import fetch_html


HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Referer": "https://reaperscans.com/",
}
def _make_id(value: str) -> str:
    return hashlib.md5(value.encode("utf-8")).hexdigest()[:12]


class ReaperScansScraper(BaseScraper):
    name = "Reaper Scans"
    base_url = "https://reaperscans.com"
    language = "en"
    nsfw = False
    version = "1.0.0"

    async def _get_html(self, url: str) -> str:
        return await fetch_html(url, HEADERS, timeout=20)

    def _absolute(self, href: str) -> str:
        return urljoin(self.base_url, href)

    async def search(self, query: str) -> List[Manhwa]:
        candidate_urls = [
            f"{self.base_url}/series?name={quote_plus(query)}",
            f"{self.base_url}/?s={quote_plus(query)}&post_type=wp-manga",
        ]

        soup = None
        for url in candidate_urls:
            try:
                html = await self._get_html(url)
                soup = BeautifulSoup(html, "html.parser")
                if soup.select("div.bs, article.bs, div.utao, div.bsx"):
                    break
            except Exception:
                continue

        if soup is None:
            return []

        results: List[Manhwa] = []
        seen: set[str] = set()

        for card in soup.select("div.bs, article.bs, div.utao, div.bsx"):
            a = card.select_one("a")
            if not a:
                continue

            href = a.get("href", "").strip()
            if not href:
                continue

            url = self._absolute(href)
            if url in seen:
                continue
            seen.add(url)

            title_el = card.select_one("div.tt, h2, h3, a[title]")
            title = (
                (title_el.get("title", "").strip() if title_el and title_el.has_attr("title") else "")
                or (title_el.get_text(strip=True) if title_el else "")
                or "Unknown"
            )

            img = card.select_one("img")
            cover = ""
            if img:
                cover = img.get("src", "") or img.get("data-src", "") or img.get("data-lazy-src", "")

            latest_el = card.select_one("div.epxs, span.chapter, .epx")
            latest = latest_el.get_text(strip=True) if latest_el else ""

            results.append(
                Manhwa(
                    id=_make_id(url),
                    title=title,
                    url=url,
                    cover=cover,
                    latest_chapter=latest,
                    source=self.name,
                )
            )

        return results

    async def get_detail(self, manhwa_url: str) -> Manhwa:
        html = await self._get_html(manhwa_url)
        soup = BeautifulSoup(html, "html.parser")

        title_el = soup.select_one("h1.entry-title, h1")
        title = title_el.get_text(strip=True) if title_el else "Unknown"

        cover_el = soup.select_one("div.thumb img, .seriestucon img, .thumb img")
        cover = ""
        if cover_el:
            cover = cover_el.get("src", "") or cover_el.get("data-src", "")

        desc_el = soup.select_one("div.entry-content p, .synp p, .summary__content")
        description = desc_el.get_text(strip=True) if desc_el else None

        status_el = soup.select_one(".status, .imptdt i")
        status = status_el.get_text(strip=True) if status_el else None

        genres = [g.get_text(strip=True) for g in soup.select(".mgen a, .genres-content a")]

        return Manhwa(
            id=_make_id(manhwa_url),
            title=title,
            url=manhwa_url,
            cover=cover,
            latest_chapter="",
            source=self.name,
            status=status,
            genres=genres,
            description=description,
        )

    async def get_chapters(self, manhwa_url: str) -> List[Chapter]:
        html = await self._get_html(manhwa_url)
        soup = BeautifulSoup(html, "html.parser")
        chapters: List[Chapter] = []

        for li in soup.select("#chapterlist li, .eplister li, .listing-chapters_wrap li"):
            a = li.select_one("a")
            if not a:
                continue

            href = a.get("href", "").strip()
            if not href:
                continue

            url = self._absolute(href)
            raw_title = a.get_text(" ", strip=True) or "Chapter"
            num_match = re.search(r"(\d+(?:\.\d+)?)", raw_title)
            number = float(num_match.group(1)) if num_match else 0.0

            date_el = li.select_one(".chapterdate, .date, time")
            uploaded = date_el.get_text(strip=True) if date_el else None

            chapters.append(
                Chapter(
                    id=_make_id(url),
                    title=raw_title,
                    url=url,
                    number=number,
                    uploaded_at=uploaded,
                )
            )

        return chapters

    async def get_images(self, chapter_url: str) -> List[str]:
        html = await self._get_html(chapter_url)
        soup = BeautifulSoup(html, "html.parser")
        images: List[str] = []

        for img in soup.select("div#readerarea img, div.rdminimal img, .reading-content img"):
            src = (
                img.get("src", "")
                or img.get("data-src", "")
                or img.get("data-lazy-src", "")
            )
            if src and src.startswith("http"):
                images.append(src)

        return images
