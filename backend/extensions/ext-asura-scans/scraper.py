import re
import hashlib
from typing import List
from urllib.parse import quote_plus
import httpx
from bs4 import BeautifulSoup
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent.parent / "core"))
from base_scraper import BaseScraper, Manhwa, Chapter
from http_fallback import fetch_html

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Referer": "https://asuracomic.net/",
}
def _make_id(url: str) -> str:
    return hashlib.md5(url.encode()).hexdigest()[:12]

class AsuraScraper(BaseScraper):
    name = "Asura Scans"
    base_url = "https://asuracomic.net"
    language = "en"
    nsfw = False
    version = "1.0.0"

    async def search(self, query: str) -> List[Manhwa]:
        candidate_urls = [
            f"{self.base_url}/series?name={quote_plus(query)}",
            f"{self.base_url}/?s={quote_plus(query)}&post_type=wp-manga",
            f"https://asurascans.com/?s={quote_plus(query)}&post_type=wp-manga",
            f"https://asurascans.com/?s={quote_plus(query)}",
        ]

        soup = None
        for url in candidate_urls:
            try:
                html = await fetch_html(url, HEADERS, timeout=15)
                candidate = BeautifulSoup(html, "html.parser")
                if candidate.select("div.bs, div.bsx, article.bs, div.utao"):
                    soup = candidate
                    break
            except Exception:
                continue

        if soup is None:
            return []

        results = []
        for card in soup.select("div.bs, div.bsx, article.bs"):
            try:
                a = card.select_one("a")
                if not a: continue
                url = a.get("href", "")
                if not url.startswith("http"): url = self.base_url + url
                title_el = card.select_one("div.tt, span.ntitle, h2, h3")
                title = title_el.get_text(strip=True) if title_el else "Unknown"
                cover_el = card.select_one("img")
                cover = cover_el.get("src", cover_el.get("data-src", "")) if cover_el else ""
                chapter_el = card.select_one("div.epxs, span.chapter, .epx")
                latest = chapter_el.get_text(strip=True) if chapter_el else ""
                results.append(Manhwa(id=_make_id(url), title=title, url=url, cover=cover, latest_chapter=latest, source=self.name))
            except Exception:
                continue
        return results

    async def get_detail(self, manhwa_url: str) -> Manhwa:
        async with httpx.AsyncClient(headers=HEADERS, timeout=15, follow_redirects=True) as client:
            r = await client.get(manhwa_url)
        soup = BeautifulSoup(r.text, "html.parser")
        title = (soup.select_one("h1.entry-title, h1") or soup.new_tag("x")).get_text(strip=True) or "Unknown"
        cover_el = soup.select_one("div.thumb img")
        cover = cover_el.get("src", "") if cover_el else ""
        desc_el = soup.select_one("div.entry-content p, .synp p")
        description = desc_el.get_text(strip=True) if desc_el else ""
        status_el = soup.select_one(".status, .spe span")
        status = status_el.get_text(strip=True) if status_el else None
        genres = [g.get_text(strip=True) for g in soup.select(".mgen a")]
        return Manhwa(id=_make_id(manhwa_url), title=title, url=manhwa_url, cover=cover, latest_chapter="", source=self.name, status=status, genres=genres, description=description)

    async def get_chapters(self, manhwa_url: str) -> List[Chapter]:
        async with httpx.AsyncClient(headers=HEADERS, timeout=15, follow_redirects=True) as client:
            r = await client.get(manhwa_url)
        soup = BeautifulSoup(r.text, "html.parser")
        chapters = []
        for li in soup.select("#chapterlist li, .eplister li"):
            try:
                a = li.select_one("a")
                if not a: continue
                url = a.get("href", "")
                if not url.startswith("http"): url = self.base_url + url
                num_el = li.select_one(".chapternum, span.chnum")
                raw = num_el.get_text(strip=True) if num_el else "0"
                m = re.search(r"[\d.]+", raw)
                number = float(m.group()) if m else 0.0
                date_el = li.select_one(".chapterdate, span.date")
                date = date_el.get_text(strip=True) if date_el else None
                chapters.append(Chapter(id=_make_id(url), title=f"Chapter {number}", url=url, number=number, uploaded_at=date))
            except Exception:
                continue
        return chapters

    async def get_images(self, chapter_url: str) -> List[str]:
        async with httpx.AsyncClient(headers=HEADERS, timeout=20, follow_redirects=True) as client:
            r = await client.get(chapter_url)
        soup = BeautifulSoup(r.text, "html.parser")
        images = []
        for img in soup.select("div#readerarea img, div.rdminimal img"):
            src = img.get("src") or img.get("data-src") or img.get("data-lazy-src", "")
            if src and any(src.endswith(e) for e in [".jpg", ".jpeg", ".png", ".webp"]):
                images.append(src)
        return images
