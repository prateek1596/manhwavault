import asyncio
import logging
import re
import string
from contextlib import asynccontextmanager
from typing import List, Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from core.extension_manager import ExtensionManager
from core.base_scraper import BaseScraper

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

manager = ExtensionManager()
scrapers: dict[str, BaseScraper] = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    global scrapers
    scrapers = manager.load_all()
    logger.info(f"Loaded {len(scrapers)} extension(s): {list(scrapers.keys())}")
    yield


app = FastAPI(title="ManhwaVault API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_scraper(source: str) -> BaseScraper:
    if source not in scrapers:
        raise HTTPException(404, f"Extension '{source}' not found. Installed: {list(scrapers.keys())}")
    return scrapers[source]


# ── Search ────────────────────────────────────────────────────────────────────

SEARCH_TIMEOUT_SECONDS = 8
MANGADEX_UUID_RE = re.compile(r"^[0-9a-f\-]{20,}$", re.IGNORECASE)


def _is_mangadex_uuid(value: str) -> bool:
    return bool(value and MANGADEX_UUID_RE.match(value.strip()))


def _get_mangadex_scraper() -> Optional[BaseScraper]:
    return scrapers.get("MangaDex")


async def _search_via_mangadex_fallback(query: str, source_name: str):
    """Fallback used when a source returns no results because of anti-bot or layout changes."""
    md = _get_mangadex_scraper()
    if not md:
        return []

    md_results = await search_with_timeout(md, query)
    mapped = []
    for i, item in enumerate(md_results[:20]):
        # Keep URL as MangaDex ID so detail/chapters/images can be proxied.
        mapped.append(
            {
                "id": f"{item.id}-{source_name.lower().replace(' ', '-')}-{i}",
                "title": item.title,
                "url": item.url,
                "cover": item.cover,
                "latest_chapter": item.latest_chapter,
                "source": source_name,
                "status": item.status,
                "genres": item.genres,
                "description": item.description,
            }
        )
    return mapped


def _build_query_variants(query: str) -> list[str]:
    """Generate looser query variants for titles that fail exact phrase matching."""
    cleaned = query.strip()
    if not cleaned:
        return []

    variants: list[str] = [cleaned]

    # Normalize punctuation and repeated spaces.
    normalized = cleaned.translate(str.maketrans({c: " " for c in string.punctuation}))
    normalized = " ".join(normalized.split())
    if normalized and normalized not in variants:
        variants.append(normalized)

    words = normalized.lower().split()
    stop = {"the", "of", "a", "an", "in", "to", "and", "for"}
    key_words = [w for w in words if w not in stop]

    if key_words:
        key_phrase = " ".join(key_words)
        if key_phrase not in variants:
            variants.append(key_phrase)

    # Fallbacks that usually work well in manga/manhwa indexes.
    if len(key_words) >= 2:
        first_two = " ".join(key_words[:2])
        if first_two not in variants:
            variants.append(first_two)

    if key_words:
        first_one = key_words[0]
        if first_one not in variants:
            variants.append(first_one)

    # Keep it bounded and ordered.
    return variants[:5]


def _dedupe_results(items: list) -> list:
    seen = set()
    deduped = []
    for item in items:
        if isinstance(item, dict):
            key = (item.get("source"), item.get("url"), item.get("title"))
        else:
            key = (getattr(item, "source", ""), getattr(item, "url", ""), getattr(item, "title", ""))
        if key in seen:
            continue
        seen.add(key)
        deduped.append(item)
    return deduped


def _interleave_by_source(items: list) -> list:
    buckets: dict[str, list] = {}
    order: list[str] = []
    for item in items:
        src = item.get("source") if isinstance(item, dict) else getattr(item, "source", "")
        if src not in buckets:
            buckets[src] = []
            order.append(src)
        buckets[src].append(item)

    result: list = []
    while True:
        progressed = False
        for src in order:
            if buckets[src]:
                result.append(buckets[src].pop(0))
                progressed = True
        if not progressed:
            break

    return result


async def search_with_timeout(scraper: BaseScraper, query: str):
    try:
        return await asyncio.wait_for(scraper.search(query), timeout=SEARCH_TIMEOUT_SECONDS)
    except asyncio.TimeoutError:
        raise TimeoutError(f"Search timed out after {SEARCH_TIMEOUT_SECONDS}s")

@app.get("/search")
async def search(q: str = Query(..., min_length=1), source: str = "all"):
    if not scrapers:
        raise HTTPException(503, "No extensions installed. Install one first.")
    
    variants = _build_query_variants(q)
    primary_query = variants[0]
    query_used = primary_query

    # For all-sources mode, prefer a fast/reliable index path via MangaDex,
    # then mirror to additional sources. This avoids site timeouts causing
    # empty overall search responses.
    if source == "all":
        md = _get_mangadex_scraper()
        if not md:
            raise HTTPException(503, "MangaDex extension is required for all-source indexing.")

        md_results = []
        for variant in variants:
            try:
                md_results = await search_with_timeout(md, variant)
                md_results = _dedupe_results(md_results)
                if md_results:
                    query_used = variant
                    break
            except Exception as e:
                logger.warning(f"All-source MangaDex index failed ({variant}): {e}")

        if not md_results:
            return []

        mirror_sources = ["Asura Scans", "Flame Scans", "Reaper Scans", "Jinx Manga", "Toonily", "GGManga"]
        mirrored = []
        for src in mirror_sources:
            mirrored.extend(await _search_via_mangadex_fallback(query_used, src))

        merged = _dedupe_results(md_results + mirrored)
        return _interleave_by_source(merged)

    targets = [get_scraper(source)]

    results = await asyncio.gather(*[search_with_timeout(s, primary_query) for s in targets], return_exceptions=True)

    combined = []
    for i, result in enumerate(results):
        if isinstance(result, Exception):
            logger.warning(f"Search failed for {targets[i].name}: {result}")
        else:
            combined.extend(result)

    combined = _dedupe_results(combined)

    # If exact query yielded nothing, try relaxed variants before fallback mapping.
    # Keep this only for MangaDex to avoid long waits on blocked HTML sources.
    if source == "MangaDex" and len(combined) == 0 and len(variants) > 1:
        for variant in variants[1:]:
            relaxed = await asyncio.gather(*[search_with_timeout(s, variant) for s in targets], return_exceptions=True)
            relaxed_combined = []
            for i, result in enumerate(relaxed):
                if isinstance(result, Exception):
                    logger.warning(f"Relaxed search failed for {targets[i].name} ({variant}): {result}")
                else:
                    relaxed_combined.extend(result)

            relaxed_combined = _dedupe_results(relaxed_combined)
            if relaxed_combined:
                combined = relaxed_combined
                query_used = variant
                break

    # In all-sources mode, if everything timed out or returned empty,
    # force a direct MangaDex-only fallback with relaxed variants.
    if source == "all" and len(combined) == 0:
        md = _get_mangadex_scraper()
        if md:
            for variant in variants:
                try:
                    md_only = await search_with_timeout(md, variant)
                    md_only = _dedupe_results(md_only)
                    if md_only:
                        combined = md_only
                        query_used = variant
                        break
                except Exception as e:
                    logger.warning(f"All-mode direct MangaDex fallback failed ({variant}): {e}")

    # If a specific source has zero results, provide a proxy fallback via MangaDex
    # so the app remains usable even when that source blocks scraping.
    if source != "all" and len(combined) == 0:
        for variant in variants:
            fallback = await _search_via_mangadex_fallback(variant, source)
            if fallback:
                return _dedupe_results(fallback)

    # In all-sources mode, if only MangaDex returns results, provide mirrored
    # fallbacks for other sources so users can still enter reader flow.
    if source == "all" and len(combined) > 0:
        has_non_md = any(getattr(item, "source", "") != "MangaDex" for item in combined)
        if not has_non_md:
            mirror_sources = ["Asura Scans", "Flame Scans", "Reaper Scans", "Jinx Manga", "Toonily", "GGManga"]
            mirrored = []
            for src in mirror_sources:
                mirrored.extend(await _search_via_mangadex_fallback(query_used, src))
            if mirrored:
                return _dedupe_results(combined + mirrored)

    return combined


# ── Manhwa detail ─────────────────────────────────────────────────────────────

@app.get("/manhwa/detail")
async def manhwa_detail(url: str, source: str):
    scraper = get_scraper(source)
    if source != "MangaDex" and _is_mangadex_uuid(url):
        md = _get_mangadex_scraper()
        if md:
            scraper = md
    try:
        return await scraper.get_detail(url)
    except Exception as e:
        raise HTTPException(500, str(e))


@app.get("/manhwa/chapters")
async def manhwa_chapters(url: str, source: str):
    scraper = get_scraper(source)
    if source != "MangaDex" and _is_mangadex_uuid(url):
        md = _get_mangadex_scraper()
        if md:
            scraper = md
    try:
        return await scraper.get_chapters(url)
    except Exception as e:
        raise HTTPException(500, str(e))


# ── Chapter images ────────────────────────────────────────────────────────────

@app.get("/chapter/images")
async def chapter_images(url: str, source: str):
    scraper = get_scraper(source)
    if source != "MangaDex" and _is_mangadex_uuid(url):
        md = _get_mangadex_scraper()
        if md:
            scraper = md
    try:
        return await scraper.get_images(url)
    except Exception as e:
        raise HTTPException(500, str(e))


# ── Updates ───────────────────────────────────────────────────────────────────

class SeriesEntry(BaseModel):
    url: str
    source: str

class UpdatesRequest(BaseModel):
    series: List[SeriesEntry]

@app.post("/updates")
async def get_updates(body: UpdatesRequest):
    async def check_one(entry: SeriesEntry):
        scraper = scrapers.get(entry.source)
        if not scraper:
            return {"manhwaUrl": entry.url, "newChapters": []}
        try:
            chapters = await scraper.get_chapters(entry.url)
            # Return latest 3 chapters as "new" (client tracks what's read)
            return {"manhwaUrl": entry.url, "newChapters": [
                {
                    "id": c.id, "title": c.title, "url": c.url,
                    "number": c.number, "uploadedAt": c.uploaded_at,
                }
                for c in chapters[:3]
            ]}
        except Exception as e:
            logger.warning(f"Update check failed for {entry.url}: {e}")
            return {"manhwaUrl": entry.url, "newChapters": []}

    results = await asyncio.gather(*[check_one(e) for e in body.series])
    return results


# ── Extensions ────────────────────────────────────────────────────────────────

@app.get("/extensions")
async def list_extensions():
    return manager.list_installed()


@app.post("/extensions/install")
async def install_extension(git_url: str):
    try:
        name = manager.install(git_url)
        scrapers.update(manager.load_all())
        return {"installed": name}
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        raise HTTPException(500, f"Install failed: {e}")


@app.post("/extensions/update/{name}")
async def update_extension(name: str):
    try:
        manager.update(name)
        scrapers.update(manager.load_all())
        return {"updated": name}
    except ValueError as e:
        raise HTTPException(404, str(e))
    except Exception as e:
        raise HTTPException(500, f"Update failed: {e}")


@app.delete("/extensions/{name}")
async def remove_extension(name: str):
    try:
        manager.remove(name)
        scrapers.pop(name, None)
        return {"removed": name}
    except ValueError as e:
        raise HTTPException(404, str(e))


@app.get("/extensions/check-updates")
async def check_extension_updates():
    return manager.check_updates()


@app.get("/health")
async def health():
    return {"status": "ok", "extensions": list(scrapers.keys())}
