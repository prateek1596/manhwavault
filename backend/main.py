import asyncio
from collections import defaultdict, deque
import collections
from datetime import datetime, timezone
import logging
import re
import string
from contextlib import asynccontextmanager
from typing import List, Optional
from urllib.parse import quote

from fastapi import FastAPI, HTTPException, Query, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import httpx
import io
from PIL import Image
from core import http_client, cache, scheduler
from core.auth import require_api_key
from prometheus_client import Counter as PromCounter, generate_latest, CONTENT_TYPE_LATEST
from fastapi.responses import Response
import json
from pathlib import Path
from difflib import SequenceMatcher
from bs4 import BeautifulSoup
from pydantic import BaseModel
from fastapi import Body

from core.extension_manager import ExtensionManager, EXTENSIONS_DIR
from core.base_scraper import BaseScraper

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

manager = ExtensionManager()
scrapers: dict[str, BaseScraper] = {}
_cache = cache.SimpleCache(ttl=300)
_jobs_file = Path(__file__).parent / "jobs.json"
_progress_file = Path(__file__).parent / "reading_progress.json"


class ReadingProgress(BaseModel):
    user_id: str | None = None
    manga_id: str | None = None
    chapter_url: str | None = None
    page_num: int | None = None
    position: float | None = None
    updated_at: Optional[str] = None


def _load_progress() -> dict:
    try:
        if not _progress_file.exists():
            return {}
        return json.loads(_progress_file.read_text()) or {}
    except Exception:
        logger.exception("Failed to load reading progress file")
        return {}


def _save_progress(data: dict):
    try:
        _progress_file.write_text(json.dumps(data, indent=2))
    except Exception:
        logger.exception("Failed to save reading progress file")


def _safe_download_title(title: str) -> str:
    safe_title = re.sub(r"[^A-Za-z0-9_-]", "-", title or "chapter").strip("-")[:120]
    return safe_title or "chapter"

# Prometheus metrics
METRIC_EXTENSION_INSTALLS = PromCounter("manhwavault_extension_installs_total", "Total extension installs")
METRIC_TEST_RUNS = PromCounter("manhwavault_test_runs_total", "Total extension test runs")
suggestion_refresh_counters = collections.Counter()
suggestion_click_counters = collections.Counter()
suggestion_client_counters = collections.Counter()
suggestion_surface_counters = collections.Counter()
suggestion_client_event_counters = defaultdict(collections.Counter)
suggestion_surface_event_counters = defaultdict(collections.Counter)
suggestion_recent_events: deque = deque(maxlen=100)


@asynccontextmanager
async def lifespan(app: FastAPI):
    global scrapers
    scrapers = manager.load_all()
    logger.info(f"Loaded {len(scrapers)} extension(s): {list(scrapers.keys())}")
    # Scheduler: load persisted jobs and schedule them
    if _jobs_file.exists():
        try:
            body = json.loads(_jobs_file.read_text())
            for meta in body:
                name = meta.get("name")
                scraper_name = meta.get("scraper")
                method = meta.get("method")
                interval = int(meta.get("interval_seconds", 300))

                async def _make_job(sname=scraper_name, m=method, n=name):
                    try:
                        s = get_scraper(sname)
                        fn = getattr(s, m)
                        if m == "search":
                            res = await fn("test")
                        else:
                            res = await fn()
                        await _cache.set(f"job:{n}", res)
                    except Exception as e:
                        logger.exception(e)

                try:
                    scheduler.schedule_job(name, _make_job, interval)
                except Exception:
                    logger.exception(f"Could not schedule persisted job {name}")
        except Exception:
            logger.exception("Failed to load jobs.json")
    yield


app = FastAPI(title="ManhwaVault API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve offline downloads
offline_dir = Path(__file__).parent / "offline"
offline_dir.mkdir(parents=True, exist_ok=True)
app.mount("/offline", StaticFiles(directory=str(offline_dir)), name="offline")


@app.get("/health")
def health():
    return {
        "status": "ok",
        "loaded_extensions": [s.get("name") if isinstance(s, dict) else getattr(s, "name", "") for s in manager.list_installed()],
        "scrapers": list(scrapers.keys()),
    }


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


def _get_primary_index_scraper() -> Optional[BaseScraper]:
    direct = _get_mangadex_scraper()
    if direct:
        return direct

    for scraper in scrapers.values():
        if getattr(scraper, "base_url", "") == "https://api.mangadex.org":
            return scraper
    return None


def _supports_relaxed_variants(scraper: BaseScraper) -> bool:
    return getattr(scraper, "base_url", "") == "https://api.mangadex.org"


def _resolve_scraper_for_url(source: str, url: str) -> Optional[BaseScraper]:
    scraper = scrapers.get(source)
    if not scraper:
        return None

    if source != "MangaDex" and _is_mangadex_uuid(url):
        md = _get_mangadex_scraper()
        if md:
            return md

    return scraper


async def _search_via_mangadex_fallback(query: str, source_name: str, max_items: int = 20):
    """Fallback used when a source returns no results because of anti-bot or layout changes."""
    md = _get_primary_index_scraper()
    if not md:
        return []

    md_results = await search_with_timeout(md, query)
    return _map_mangadex_results_to_source(md_results, source_name, max_items=max_items)


def _map_mangadex_results_to_source(md_results: list, source_name: str, max_items: int = 20):
    mapped = []
    for i, item in enumerate(md_results[:max_items]):
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


async def _mirrored_fallback_for_source(
    source_name: str,
    query_variants: list[str],
    max_items: int,
    content_type: str,
) -> list:
    for variant in query_variants:
        mirrored = await _search_via_mangadex_fallback(variant, source_name, max_items=max_items)
        mirrored = _filter_content_type(_dedupe_results(mirrored), content_type)
        if mirrored:
            return mirrored
    return []


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


def _suggestion_seeds_for_source(source_name: str, content_type: str) -> list[str]:
    lower_name = (source_name or "").lower()
    generic_manhwa = ["solo leveling", "murim", "villainess", "academy", "regressor"]
    generic_all = ["action", "romance", "adventure", "fantasy"]
    seeds = generic_manhwa if content_type == "manhwa" else generic_all

    source_hints = {
        "asura": ["murim", "regressor", "return of"],
        "reaper": ["player", "tower", "hunter"],
        "flame": ["academy", "magic", "action"],
        "toonily": ["romance", "drama", "webtoon"],
        "ggmanga": ["action", "adventure", "fantasy"],
        "mangadex": ["solo leveling", "omniscient reader", "martial"],
        "vault picks": ["solo leveling", "latna", "returning hero"],
    }

    tuned = []
    for key, values in source_hints.items():
        if key in lower_name:
            tuned.extend(values)

    if not tuned:
        tuned = seeds[:3]

    merged = tuned + seeds
    return list(dict.fromkeys(merged))[:8]


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


def _is_manhwa_item(item) -> bool:
    title = (item.get("title", "") if isinstance(item, dict) else getattr(item, "title", "") or "").lower()
    description = (item.get("description", "") if isinstance(item, dict) else getattr(item, "description", "") or "").lower()
    genres = item.get("genres", []) if isinstance(item, dict) else (getattr(item, "genres", []) or [])
    genres_lower = [str(g).lower() for g in genres]

    hints = [
        "manhwa", "webtoon", "long strip", "full color", "murim", "regressor", "villainess", "hunter",
    ]
    if any(h in " ".join(genres_lower) for h in hints):
        return True
    text_blob = f"{title} {description}"
    return any(h in text_blob for h in hints)


def _filter_content_type(items: list, content_type: str) -> list:
    if content_type != "manhwa":
        return items

    preferred = [item for item in items if _is_manhwa_item(item)]
    if preferred:
        return preferred

    # If no explicit manhwa signals were detected, keep original items
    # rather than returning an empty response.
    return items


def _first_localized_text(localized: dict | None, preferred: Optional[str] = None) -> str:
    if not localized:
        return "Unknown"
    if preferred and localized.get(preferred):
        return localized[preferred]
    if localized.get("en"):
        return localized["en"]
    return next(iter(localized.values()), "Unknown")


def _mangadex_cover_url(manga_id: str, item: dict) -> str:
    for rel in item.get("relationships", []):
        if rel.get("type") == "cover_art":
            file_name = rel.get("attributes", {}).get("fileName")
            if file_name:
                return f"https://uploads.mangadex.org/covers/{manga_id}/{file_name}.256.jpg"
    return ""


def _source_icon_url(base_url: str) -> str:
    if not base_url:
        return ""
    return f"https://www.google.com/s2/favicons?sz=128&domain_url={quote(base_url, safe=':/')}"


async def _fetch_mangadex_catalog(
    scraper: BaseScraper,
    page: int,
    limit: int,
    include_nsfw: bool,
    content_type: str,
):
    offset = max(0, (page - 1) * limit)
    params = {
        "limit": limit,
        "offset": offset,
        "includes[]": ["cover_art"],
        "order[latestUploadedChapter]": "desc",
    }

    language = getattr(scraper, "language", "en")
    if language and language not in {"multi", "*"}:
        if language == "es":
            params["availableTranslatedLanguage[]"] = ["es", "es-la"]
        elif language == "pt-br":
            params["availableTranslatedLanguage[]"] = ["pt-br", "pt"]
        else:
            params["availableTranslatedLanguage[]"] = [language]

    if include_nsfw:
        params["contentRating[]"] = ["safe", "suggestive", "erotica", "pornographic"]
    else:
        params["contentRating[]"] = ["safe", "suggestive"]

    if content_type == "manhwa":
        params["originalLanguage[]"] = ["ko"]

    payload = await http_client.fetch_json("https://api.mangadex.org/manga", params=params, timeout=20)

    data = payload.get("data", [])
    total = int(payload.get("total", 0))
    items = []
    for item in data:
        manga_id = item.get("id", "")
        attrs = item.get("attributes", {})
        items.append(
            {
                "id": f"catalog-{manga_id}",
                "title": _first_localized_text(attrs.get("title"), preferred=language if language != "multi" else None),
                "url": manga_id,
                "cover": _mangadex_cover_url(manga_id, item),
                "latest_chapter": "",
                "source": scraper.name,
                "status": attrs.get("status"),
                "genres": [
                    _first_localized_text(tag.get("attributes", {}).get("name"))
                    for tag in attrs.get("tags", [])
                ],
                "description": _first_localized_text(attrs.get("description")) if attrs.get("description") else None,
            }
        )

    has_more = offset + len(items) < total
    return {
        "items": _filter_content_type(items, content_type),
        "page": page,
        "limit": limit,
        "total": total,
        "hasMore": has_more,
    }


async def _fetch_generic_source_catalog(
    scraper: BaseScraper,
    page: int,
    limit: int,
    content_type: str,
):
    manhwa_queries = [
        "regressor",
        "villainess",
        "murim",
        "academy",
        "hunter",
        "tower",
        "return of",
        "player",
    ]
    generic_queries = ["hero", "magic", "action", "romance", "school", "adventure"]
    seed_queries = manhwa_queries if content_type == "manhwa" else generic_queries

    tasks = [search_with_timeout(scraper, q) for q in seed_queries]
    gathered = await asyncio.gather(*tasks, return_exceptions=True)

    merged = []
    for result in gathered:
        if isinstance(result, Exception):
            continue
        merged.extend(result)

    merged = _dedupe_results(merged)
    merged = _filter_content_type(merged, content_type)

    start = max(0, (page - 1) * limit)
    end = start + limit
    paged = merged[start:end]

    return {
        "items": paged,
        "page": page,
        "limit": limit,
        "total": len(merged),
        "hasMore": end < len(merged),
    }


async def _fetch_html_catalog_from_source(scraper: BaseScraper, page: int, limit: int, content_type: str):
    # Attempt common list URLs used by Madara/WordPress manga themes.
    base = getattr(scraper, "base_url", "").rstrip("/")
    if not base:
        return {"items": [], "page": page, "limit": limit, "total": 0, "hasMore": False}

    candidate_urls = [
        f"{base}/series?page={page}",
        f"{base}/series/?page={page}",
        f"{base}/manga/?page={page}",
        f"{base}/?post_type=wp-manga&page={page}",
    ]

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Referer": f"{base}/",
    }

    html = ""
    for url in candidate_urls:
        try:
            resp = await http_client.get(url, headers=headers, timeout=20)
            if resp.status_code == 200 and resp.text:
                html = resp.text
                break
        except Exception:
            continue

    if not html:
        return {"items": [], "page": page, "limit": limit, "total": 0, "hasMore": False}

    soup = BeautifulSoup(html, "html.parser")
    items = []
    seen = set()
    selectors = ["div.bs", "article.bs", "div.utao", "div.bsx", ".post-title a"]

    for sel in selectors:
        for node in soup.select(sel):
            a = node if node.name == "a" else node.select_one("a")
            if not a:
                continue
            href = (a.get("href") or "").strip()
            if not href:
                continue
            if not href.startswith("http"):
                href = f"{base}{href if href.startswith('/') else '/' + href}"
            if href in seen:
                continue
            seen.add(href)

            title = (a.get("title") or "").strip() or a.get_text(strip=True)
            if not title:
                title_el = node.select_one("div.tt, h2, h3")
                title = title_el.get_text(strip=True) if title_el else "Unknown"

            img = node.select_one("img") if node.name != "a" else None
            cover = ""
            if img:
                cover = img.get("src", "") or img.get("data-src", "") or img.get("data-lazy-src", "")

            items.append(
                {
                    "id": f"catalog-{abs(hash(href)) % 10_000_000_000}",
                    "title": title,
                    "url": href,
                    "cover": cover,
                    "latest_chapter": "",
                    "source": scraper.name,
                    "status": None,
                    "genres": [],
                    "description": None,
                }
            )
            if len(items) >= limit * 2:
                break
        if len(items) >= limit * 2:
            break

    items = _filter_content_type(_dedupe_results(items), content_type)
    return {
        "items": items[:limit],
        "page": page,
        "limit": limit,
        "total": len(items),
        "hasMore": len(items) > limit,
    }


@app.post("/jobs/schedule", dependencies=[Depends(require_api_key)])
def schedule_job_endpoint(name: str, scraper: str, method: str = "search", interval_seconds: int = 300, *args):
    if name in scheduler.list_jobs():
        raise HTTPException(status_code=400, detail=f"Job '{name}' already exists")

    async def _job():
        try:
            s = get_scraper(scraper)
            fn = getattr(s, method)
            # run with a default example arg when none provided
            if method == "search":
                res = await fn("test")
            else:
                res = await fn(*args)
            await _cache.set(f"job:{name}", res)
        except Exception as e:
            logger.exception(f"Scheduled job '{name}' failed: {e}")

    scheduler.schedule_job(name, _job, interval_seconds)
    # persist job metadata
    try:
        data = []
        if _jobs_file.exists():
            data = json.loads(_jobs_file.read_text())
        data.append({"name": name, "scraper": scraper, "method": method, "interval_seconds": interval_seconds})
        _jobs_file.write_text(json.dumps(data, indent=2))
    except Exception:
        logger.exception("Failed to persist job metadata")
    return {"scheduled": name}


@app.get("/jobs/list")
def list_jobs_endpoint():
    return scheduler.list_jobs()


@app.post("/jobs/remove", dependencies=[Depends(require_api_key)])
def remove_jobs_endpoint(name: str):
    ok = scheduler.remove_job(name)
    if not ok:
        raise HTTPException(status_code=404, detail=f"Job '{name}' not found")
    # remove from persisted file
    try:
        if _jobs_file.exists():
            data = json.loads(_jobs_file.read_text())
            data = [d for d in data if d.get("name") != name]
            _jobs_file.write_text(json.dumps(data, indent=2))
    except Exception:
        logger.exception("Failed to update jobs.json on remove")
    return {"removed": name}


@app.post("/jobs/run-now", dependencies=[Depends(require_api_key)])
async def run_job_now(name: str):
    # run job once and return cached result
    j = scheduler.list_jobs().get(name)
    if not j:
        raise HTTPException(status_code=404, detail=f"Job '{name}' not found")
    # we don't have direct access to job coro here; run cached value if present
    val = await _cache.get(f"job:{name}")
    return {"result_cached": val}


@app.post("/extensions/test-run", dependencies=[Depends(require_api_key)])
async def test_run_extension(name: str, method: str = "search", q: str = "test"):
    s = get_scraper(name)
    if not s:
        raise HTTPException(status_code=404, detail=f"Extension '{name}' not found")
    if not hasattr(s, method):
        raise HTTPException(status_code=400, detail=f"Method '{method}' not supported on '{name}'")
    fn = getattr(s, method)
    try:
        if method == "search":
            res = await asyncio.wait_for(fn(q), timeout=10)
        else:
            res = await asyncio.wait_for(fn(q), timeout=10)
        METRIC_TEST_RUNS.inc()
        return {"ok": True, "result": res}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/metrics")
def metrics():
    data = generate_latest()
    return Response(content=data, media_type=CONTENT_TYPE_LATEST)


@app.get("/progress")
def get_progress(manga_id: str | None = None, chapter_url: str | None = None, user_id: str | None = None):
    """Get saved reading progress for a user. If no `user_id` provided, returns anonymous data (if any)."""
    store = _load_progress()
    uid = user_id or "anonymous"
    user_data = store.get(uid, {})

    # Prefer chapter-level progress when available
    if chapter_url:
        p = user_data.get(chapter_url)
        if p:
            return p

    # Fallback to manga-level progress
    if manga_id:
        p = user_data.get(manga_id)
        if p:
            return p

    return {}


@app.put("/progress", dependencies=[])
def put_progress(payload: ReadingProgress = Body(...)):
    """Save reading progress. Uses `user_id` if provided, otherwise `anonymous`."""
    data = _load_progress()
    uid = payload.user_id or "anonymous"
    if uid not in data:
        data[uid] = {}

    key = payload.chapter_url or payload.manga_id or "unknown"
    entry = {
        "manga_id": payload.manga_id,
        "chapter_url": payload.chapter_url,
        "page_num": payload.page_num,
        "position": payload.position,
        "updated_at": payload.updated_at or datetime.now(timezone.utc).isoformat(),
    }

    data[uid][key] = entry
    _save_progress(data)
    return {"ok": True, "saved": entry}


async def search_with_timeout(scraper: BaseScraper, query: str):
    try:
        return await asyncio.wait_for(scraper.search(query), timeout=SEARCH_TIMEOUT_SECONDS)
    except asyncio.TimeoutError:
        raise TimeoutError(f"Search timed out after {SEARCH_TIMEOUT_SECONDS}s")


@app.get("/search/suggestions")
async def search_suggestions(
    q: str = "",
    source: str = "all",
    include_nsfw: bool = False,
    limit: int = Query(12, ge=1, le=40),
    content_type: str = Query("manhwa", pattern="^(manhwa|all)$"),
):
    """Return quick-pick suggestions for discovery surfaces in web/mobile clients."""
    if not scrapers:
        raise HTTPException(503, "No extensions installed. Install one first.")

    if source == "all":
        targets = [
            s for s in sorted(scrapers.values(), key=lambda item: item.name.lower())
            if include_nsfw or not getattr(s, "nsfw", False)
        ]
        targets = targets[:12]
    else:
        scraper = get_scraper(source)
        if not include_nsfw and getattr(scraper, "nsfw", False):
            raise HTTPException(403, f"Source '{source}' is NSFW. Set include_nsfw=true to use it.")
        targets = [scraper]

    if q.strip():
        seeded_queries = _build_query_variants(q)
    elif source == "all":
        seeds = []
        for target in targets[:6]:
            seeds.extend(_suggestion_seeds_for_source(target.name, content_type)[:2])
        seeds.extend(["solo leveling", "omniscient reader", "murim", "villainess"])
        seeded_queries = list(dict.fromkeys(seeds))[:8]
    else:
        seeded_queries = _suggestion_seeds_for_source(source, content_type)

    collected = []
    deferred = []
    source_counts = collections.Counter()
    per_source_cap = max(1, min(4, (limit + 3) // 4)) if source == "all" else limit

    for query in seeded_queries:
        results = await asyncio.gather(*[search_with_timeout(s, query) for s in targets], return_exceptions=True)
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                logger.warning(f"Suggestion search failed for {targets[i].name}: {result}")
                continue
            for item in result[: min(8, limit)]:
                source_name = (item.get("source") if isinstance(item, dict) else getattr(item, "source", "unknown")) or "unknown"
                if source == "all" and source_counts[source_name] >= per_source_cap:
                    deferred.append(item)
                    continue
                collected.append(item)
                source_counts[source_name] += 1

        collected = _filter_content_type(_dedupe_results(collected), content_type)
        if len(collected) >= limit:
            break

    if len(collected) < limit and deferred:
        collected = _filter_content_type(_dedupe_results(collected + deferred), content_type)

    return _interleave_by_source(collected)[:limit]

@app.get("/search")
async def search(
    q: str = Query(..., min_length=1),
    source: str = "all",
    include_nsfw: bool = False,
    limit: int = Query(60, ge=1, le=200),
    content_type: str = Query("manhwa", pattern="^(manhwa|all)$"),
):
    if not scrapers:
        raise HTTPException(503, "No extensions installed. Install one first.")
    
    variants = _build_query_variants(q)
    primary_query = variants[0]

    fallback_seed_results = []
    fallback_seed_scraper = _get_primary_index_scraper()
    if fallback_seed_scraper:
        for variant in variants:
            try:
                seeded = await search_with_timeout(fallback_seed_scraper, variant)
                seeded = _filter_content_type(_dedupe_results(seeded), content_type)
                if seeded:
                    fallback_seed_results = seeded
                    break
            except Exception:
                continue
    query_used = primary_query

    # For all-sources mode, prefer a fast/reliable index path via MangaDex,
    # then mirror to additional sources. This avoids site timeouts causing
    # empty overall search responses.
    if source == "all":
        md = _get_primary_index_scraper()
        if not md:
            raise HTTPException(503, "A MangaDex-based extension is required for all-source indexing.")

        md_results = []
        for variant in variants:
            try:
                md_results = await search_with_timeout(md, variant)
                md_results = _dedupe_results(md_results)
                md_results = _filter_content_type(md_results, content_type)
                if md_results:
                    query_used = variant
                    break
            except Exception as e:
                logger.warning(f"All-source MangaDex index failed ({variant}): {e}")

        if not md_results:
            return []

        mirror_sources = [
            s.name
            for s in scrapers.values()
            if s.name != md.name and (include_nsfw or not getattr(s, "nsfw", False))
        ]
        mirrored = []
        for src in mirror_sources:
            mirrored.extend(await _search_via_mangadex_fallback(query_used, src, max_items=min(20, limit)))

        merged = _dedupe_results(md_results + mirrored)
        merged = _filter_content_type(merged, content_type)
        return _interleave_by_source(merged)[:limit]

    target_scraper = get_scraper(source)
    if not include_nsfw and getattr(target_scraper, "nsfw", False):
        raise HTTPException(403, f"Source '{source}' is NSFW. Set include_nsfw=true to use it.")

    targets = [target_scraper]

    results = await asyncio.gather(*[search_with_timeout(s, primary_query) for s in targets], return_exceptions=True)

    combined = []
    for i, result in enumerate(results):
        if isinstance(result, Exception):
            logger.warning(f"Search failed for {targets[i].name}: {result}")
        else:
            combined.extend(result)

    combined = _dedupe_results(combined)
    combined = _filter_content_type(combined, content_type)

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
            relaxed_combined = _filter_content_type(relaxed_combined, content_type)
            if relaxed_combined:
                combined = relaxed_combined
                query_used = variant
                break

    # In all-sources mode, if everything timed out or returned empty,
    # force a direct MangaDex-only fallback with relaxed variants.
    if source == "all" and len(combined) == 0:
        md = _get_primary_index_scraper()
        if md:
            for variant in variants:
                try:
                    md_only = await search_with_timeout(md, variant)
                    md_only = _dedupe_results(md_only)
                    md_only = _filter_content_type(md_only, content_type)
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
                return _filter_content_type(_dedupe_results(fallback), content_type)

    # In all-sources mode, if only MangaDex returns results, provide mirrored
    # fallbacks for other sources so users can still enter reader flow.
    if source == "all" and len(combined) > 0:
        mangadex_family = {
            s.name for s in scrapers.values() if getattr(s, "base_url", "") == "https://api.mangadex.org"
        }
        has_non_md = any(getattr(item, "source", "") not in mangadex_family for item in combined)
        if not has_non_md:
            mirror_sources = [
                s.name
                for s in scrapers.values()
                if s.name not in mangadex_family and (include_nsfw or not getattr(s, "nsfw", False))
            ]
            mirrored = []
            for src in mirror_sources:
                mirrored.extend(await _search_via_mangadex_fallback(query_used, src, max_items=min(20, limit)))
            if mirrored:
                return _filter_content_type(_dedupe_results(combined + mirrored), content_type)[:limit]

    return _filter_content_type(combined, content_type)[:limit]


@app.get("/search/by-source")
async def search_by_source(
    q: str = Query(..., min_length=1),
    include_nsfw: bool = False,
    limit_per_source: int = Query(6, ge=1, le=30),
    content_type: str = Query("manhwa", pattern="^(manhwa|all)$"),
):
    if not scrapers:
        raise HTTPException(503, "No extensions installed. Install one first.")

    variants = _build_query_variants(q)
    primary_query = variants[0]

    fallback_seed_results = []
    fallback_seed_scraper = _get_primary_index_scraper()
    if fallback_seed_scraper:
        for variant in variants:
            try:
                seeded = await search_with_timeout(fallback_seed_scraper, variant)
                seeded = _filter_content_type(_dedupe_results(seeded), content_type)
                if seeded:
                    fallback_seed_results = seeded
                    break
            except Exception:
                continue

    sources = [
        s for s in sorted(scrapers.values(), key=lambda item: item.name.lower())
        if include_nsfw or not getattr(s, "nsfw", False)
    ]

    grouped = []
    for scraper in sources:
        icon_url = _source_icon_url(getattr(scraper, "base_url", ""))
        try:
            results = await search_with_timeout(scraper, primary_query)
            results = _filter_content_type(_dedupe_results(results), content_type)

            if not results and len(variants) > 1 and _supports_relaxed_variants(scraper):
                for variant in variants[1:]:
                    relaxed = await search_with_timeout(scraper, variant)
                    relaxed = _filter_content_type(_dedupe_results(relaxed), content_type)
                    if relaxed:
                        results = relaxed
                        break

            if not results and not _supports_relaxed_variants(scraper):
                if fallback_seed_results:
                    mirrored = _filter_content_type(
                        _dedupe_results(
                            _map_mangadex_results_to_source(
                                fallback_seed_results,
                                scraper.name,
                                max_items=limit_per_source,
                            )
                        ),
                        content_type,
                    )
                else:
                    mirrored = await _mirrored_fallback_for_source(
                        source_name=scraper.name,
                        query_variants=variants,
                        max_items=limit_per_source,
                        content_type=content_type,
                    )
                if mirrored:
                    grouped.append(
                        {
                            "source": scraper.name,
                            "iconUrl": icon_url,
                            "status": "ok",
                            "message": "Showing mirrored results while this source is rate-limited.",
                            "results": mirrored[:limit_per_source],
                            "total": len(mirrored),
                        }
                    )
                    continue

            grouped.append(
                {
                    "source": scraper.name,
                    "iconUrl": icon_url,
                    "status": "ok",
                    "message": "No matches found." if not results else None,
                    "results": results[:limit_per_source],
                    "total": len(results),
                }
            )
        except Exception as e:
            if fallback_seed_results:
                mirrored = _filter_content_type(
                    _dedupe_results(
                        _map_mangadex_results_to_source(
                            fallback_seed_results,
                            scraper.name,
                            max_items=limit_per_source,
                        )
                    ),
                    content_type,
                )
            else:
                mirrored = await _mirrored_fallback_for_source(
                    source_name=scraper.name,
                    query_variants=variants,
                    max_items=limit_per_source,
                    content_type=content_type,
                )
            if mirrored:
                grouped.append(
                    {
                        "source": scraper.name,
                        "iconUrl": icon_url,
                        "status": "ok",
                        "message": "Showing mirrored results while this source is temporarily unavailable.",
                        "results": mirrored[:limit_per_source],
                        "total": len(mirrored),
                    }
                )
                continue
            grouped.append(
                {
                    "source": scraper.name,
                    "iconUrl": icon_url,
                    "status": "error",
                    "message": str(e),
                    "results": [],
                    "total": 0,
                }
            )

    return grouped


@app.get("/search/fuzzy")
async def search_fuzzy(q: str = Query(..., min_length=1), source: str = "all", limit: int = Query(10, ge=1, le=50)):
    """Return fuzzy-matched titles across sources using SequenceMatcher."""
    if not scrapers:
        raise HTTPException(503, "No extensions installed. Install one first.")

    if source == "all":
        targets = [s for s in scrapers.values() if s]
    else:
        targets = [get_scraper(source)]

    # gather search results from targets
    tasks = [search_with_timeout(s, q) for s in targets]
    gathered = await asyncio.gather(*tasks, return_exceptions=True)

    candidates = []
    for res in gathered:
        if isinstance(res, Exception):
            continue
        for item in res:
            title = item.get("title") if isinstance(item, dict) else getattr(item, "title", "")
            score = SequenceMatcher(None, q.lower(), (title or "").lower()).ratio()
            candidates.append({"id": item.get("id") if isinstance(item, dict) else getattr(item, "id", ""), "title": title, "url": item.get("url") if isinstance(item, dict) else getattr(item, "url", ""), "source": item.get("source") if isinstance(item, dict) else getattr(item, "source", ""), "score": score})

    candidates = sorted(candidates, key=lambda x: x["score"], reverse=True)
    return candidates[:limit]


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


@app.post("/download/chapter")
async def download_chapter(url: str, source: str, title: str = "chapter"):
    """Download chapter images to server `offline` folder and return URLs.

    Returns list of file URLs under `/offline/...`.
    """
    scraper = get_scraper(source)
    if source != "MangaDex" and _is_mangadex_uuid(url):
        md = _get_mangadex_scraper()
        if md:
            scraper = md

    try:
        images = await scraper.get_images(url)
        if not images:
            raise HTTPException(404, "No images found for chapter")

        # Normalize images list
        urls = [img if isinstance(img, str) else img.get("url") for img in images]
        safe_title = _safe_download_title(title)
        dest = offline_dir / safe_title
        dest.mkdir(parents=True, exist_ok=True)

        async with httpx.AsyncClient(timeout=30) as client:
            tasks = []
            for i, img_url in enumerate(urls):
                if not img_url:
                    continue

                async def _fetch_and_write(i=i, img_url=img_url):
                    try:
                        resp = await client.get(img_url)
                        if resp.status_code == 200 and resp.content:
                            ext = Path(img_url).suffix.split("?")[0] or ".jpg"
                            fname = f"page_{i+1:03d}{ext}"
                            (dest / fname).write_bytes(resp.content)
                            return f"/offline/{safe_title}/{fname}"
                    except Exception:
                        logger.exception(f"Failed to download {img_url}")
                    return None

                tasks.append(_fetch_and_write())

            results = await asyncio.gather(*tasks)

        file_urls = [r for r in results if r]
        if not file_urls:
            raise HTTPException(500, "Failed to download any images")

        # Attempt to generate a small thumbnail from the first successfully downloaded image
        thumb_url = None
        try:
            first_file = dest / Path(file_urls[0]).name
            if first_file.exists():
                with Image.open(first_file) as im:
                    im = im.convert('RGB')
                    im.thumbnail((320, 320))
                    thumb_path = dest / 'thumb.jpg'
                    im.save(thumb_path, format='JPEG', quality=80)
                    thumb_url = f"/offline/{safe_title}/thumb.jpg"
        except Exception:
            logger.exception("Failed to create thumbnail for %s", safe_title)

        resp = {"title": safe_title, "files": file_urls, "path": f"/offline/{safe_title}/"}
        if thumb_url:
            resp["thumb"] = thumb_url
        return resp
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(e)
        raise HTTPException(500, str(e))


@app.delete("/download/chapter")
async def delete_downloaded_chapter(title: str):
    """Delete a server-side downloaded chapter folder."""
    safe_title = _safe_download_title(title)
    dest = offline_dir / safe_title

    if not dest.exists():
        return {"ok": True, "removed": False, "title": safe_title}

    try:
        for child in dest.iterdir():
            if child.is_file() or child.is_symlink():
                child.unlink(missing_ok=True)
            elif child.is_dir():
                import shutil

                shutil.rmtree(child, ignore_errors=True)
        dest.rmdir()
        return {"ok": True, "removed": True, "title": safe_title}
    except Exception as e:
        logger.exception("Failed to delete downloaded chapter folder")
        raise HTTPException(500, str(e))


@app.get("/source/catalog")
async def source_catalog(
    source: str,
    q: str = "",
    page: int = Query(1, ge=1),
    limit: int = Query(30, ge=1, le=100),
    include_nsfw: bool = False,
    content_type: str = Query("manhwa", pattern="^(manhwa|all)$"),
):
    scraper = get_scraper(source)
    if not include_nsfw and getattr(scraper, "nsfw", False):
        raise HTTPException(403, f"Source '{source}' is NSFW. Set include_nsfw=true to use it.")

    query = q.strip()
    if query:
        results = await search_with_timeout(scraper, query)
        results = _dedupe_results(results)
        results = _filter_content_type(results, content_type)
        return {
            "items": results[:limit],
            "page": 1,
            "limit": limit,
            "total": len(results),
            "hasMore": len(results) > limit,
        }

    if getattr(scraper, "base_url", "") == "https://api.mangadex.org":
        return await _fetch_mangadex_catalog(
            scraper,
            page=page,
            limit=limit,
            include_nsfw=include_nsfw,
            content_type=content_type,
        )

    html_catalog = await _fetch_html_catalog_from_source(scraper, page=page, limit=limit, content_type=content_type)
    if html_catalog["items"]:
        return html_catalog

    generic = await _fetch_generic_source_catalog(scraper, page=page, limit=limit, content_type=content_type)
    if generic["items"]:
        return generic

    # Final fallback: provide source-labeled MangaDex proxy feed so catalog UI
    # remains usable when an HTML source blocks scraping.
    fallback_queries = ["regressor", "villainess", "murim", "academy"]
    mirrored = []
    for seed in fallback_queries:
        try:
            mirrored.extend(await _search_via_mangadex_fallback(seed, source, max_items=limit))
            if len(mirrored) >= limit:
                break
        except Exception:
            continue
    mirrored = _filter_content_type(_dedupe_results(mirrored), content_type)
    if mirrored:
        start = max(0, (page - 1) * limit)
        end = start + limit
        paged = mirrored[start:end]
        return {
            "items": paged,
            "page": page,
            "limit": limit,
            "total": len(mirrored),
            "hasMore": end < len(mirrored),
            "message": "Showing proxy catalog while source limits browsing.",
        }

    generic["message"] = "Catalog is limited for this source. Use search for best results."
    return generic


# ── Updates ───────────────────────────────────────────────────────────────────

class SeriesEntry(BaseModel):
    url: str
    source: str

class UpdatesRequest(BaseModel):
    series: List[SeriesEntry]


class SuggestionTelemetryEvent(BaseModel):
    event: str
    source: str = "unknown"
    client: str = "unknown"
    surface: str = "unknown"

@app.post("/updates")
async def get_updates(body: UpdatesRequest):
    async def check_one(entry: SeriesEntry):
        scraper = _resolve_scraper_for_url(entry.source, entry.url)
        if not scraper:
            return {"manhwaUrl": entry.url, "source": entry.source, "newChapters": []}
        try:
            chapters = await scraper.get_chapters(entry.url)
            # Return latest 3 chapters as "new" (client tracks what's read)
            return {"manhwaUrl": entry.url, "source": entry.source, "newChapters": [
                {
                    "id": c.id, "title": c.title, "url": c.url,
                    "number": c.number, "uploadedAt": c.uploaded_at,
                }
                for c in chapters[:3]
            ]}
        except Exception as e:
            logger.warning(f"Update check failed for {entry.source} ({entry.url}): {e}")
            return {"manhwaUrl": entry.url, "source": entry.source, "newChapters": []}

    results = await asyncio.gather(*[check_one(e) for e in body.series])
    return results


# ── Telemetry ────────────────────────────────────────────────────────────────

@app.post("/telemetry/suggestions/event")
async def track_suggestion_event(body: SuggestionTelemetryEvent):
    event_name = (body.event or "").strip().lower()
    source_name = (body.source or "unknown").strip() or "unknown"
    client_name = (body.client or "unknown").strip() or "unknown"
    surface_name = (body.surface or "unknown").strip() or "unknown"

    if event_name not in {"refresh", "click"}:
        raise HTTPException(400, "event must be one of: refresh, click")

    if event_name == "refresh":
        suggestion_refresh_counters[source_name] += 1
    else:
        suggestion_click_counters[source_name] += 1

    suggestion_client_counters[client_name] += 1
    suggestion_surface_counters[surface_name] += 1
    suggestion_client_event_counters[client_name][event_name] += 1
    suggestion_surface_event_counters[surface_name][event_name] += 1

    timestamp = datetime.now(timezone.utc).isoformat()
    suggestion_recent_events.append(
        {
            "event": event_name,
            "source": source_name,
            "client": client_name,
            "surface": surface_name,
            "timestamp": timestamp,
        }
    )

    return {
        "ok": True,
        "event": event_name,
        "source": source_name,
        "client": client_name,
        "surface": surface_name,
        "timestamp": timestamp,
    }


@app.get("/telemetry/suggestions")
async def suggestion_telemetry():
    sources = sorted(set(suggestion_refresh_counters.keys()) | set(suggestion_click_counters.keys()))
    by_source = {
        source: {
            "refresh": suggestion_refresh_counters[source],
            "click": suggestion_click_counters[source],
        }
        for source in sources
    }

    total_refresh = sum(suggestion_refresh_counters.values())
    total_click = sum(suggestion_click_counters.values())

    by_client_detailed = {
        name: {
            "events": suggestion_client_counters[name],
            "refresh": counters["refresh"],
            "click": counters["click"],
        }
        for name, counters in suggestion_client_event_counters.items()
    }

    by_surface_detailed = {
        name: {
            "events": suggestion_surface_counters[name],
            "refresh": counters["refresh"],
            "click": counters["click"],
        }
        for name, counters in suggestion_surface_event_counters.items()
    }

    top_sources = sorted(
        (
            {
                "name": source,
                "refresh": stats["refresh"],
                "click": stats["click"],
                "events": stats["refresh"] + stats["click"],
            }
            for source, stats in by_source.items()
        ),
        key=lambda item: item["events"],
        reverse=True,
    )[:8]

    return {
        "total": {
            "refresh": total_refresh,
            "click": total_click,
            "events": total_refresh + total_click,
            "sources": len(by_source),
            "clients": len(by_client_detailed),
            "surfaces": len(by_surface_detailed),
        },
        "bySource": by_source,
        "byClient": dict(suggestion_client_counters),
        "bySurface": dict(suggestion_surface_counters),
        "byClientDetailed": by_client_detailed,
        "bySurfaceDetailed": by_surface_detailed,
        "topSources": top_sources,
        "recent": list(reversed(suggestion_recent_events)),
    }


@app.post("/telemetry/suggestions/reset")
async def reset_suggestion_telemetry():
    suggestion_refresh_counters.clear()
    suggestion_click_counters.clear()
    suggestion_client_counters.clear()
    suggestion_surface_counters.clear()
    suggestion_client_event_counters.clear()
    suggestion_surface_event_counters.clear()
    suggestion_recent_events.clear()
    return {"ok": True, "reset": True}


# ── Extensions ────────────────────────────────────────────────────────────────

@app.get("/extensions")
async def list_extensions():
    return manager.list_installed()


@app.post("/extensions/reload")
async def reload_extensions():
    global scrapers
    scrapers = manager.load_all()
    return {
        "loaded": len(scrapers),
        "extensions": sorted(scrapers.keys()),
    }


@app.get("/extensions/stats")
async def extension_stats():
    sources = list(scrapers.values())
    by_language = collections.Counter(getattr(s, "language", "unknown") for s in sources)
    return {
        "total": len(sources),
        "nsfw": sum(1 for s in sources if getattr(s, "nsfw", False)),
        "safe": sum(1 for s in sources if not getattr(s, "nsfw", False)),
        "byLanguage": dict(by_language),
    }


@app.get("/sources")
async def list_sources(include_nsfw: bool = False):
    payload = []
    for scraper in sorted(scrapers.values(), key=lambda s: s.name.lower()):
        if not include_nsfw and getattr(scraper, "nsfw", False):
            continue
        payload.append(
            {
                "name": scraper.name,
                "baseUrl": scraper.base_url,
                "language": scraper.language,
                "nsfw": scraper.nsfw,
                "version": scraper.version,
                "iconUrl": _source_icon_url(scraper.base_url),
            }
        )
    return payload


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


@app.post("/extensions/auto-update", dependencies=[Depends(require_api_key)])
def extensions_auto_update(enable: bool = True, interval_seconds: int = 60 * 60 * 24):
    """Enable or disable periodic auto-updates for installed extensions.
    When enabled, a background job will attempt to update all installed extensions at the given interval.
    """
    job_name = "auto-update-extensions"
    if not enable:
        ok = scheduler.remove_job(job_name)
        if not ok:
            raise HTTPException(status_code=404, detail="Auto-update job not found")
        return {"removed": job_name}

    async def _job():
        for entry in manager.list_installed():
            try:
                manager.update(entry.get("name"))
            except Exception:
                logger.exception(f"Auto-update failed for {entry.get('name')}")

    try:
        scheduler.schedule_job(job_name, _job, interval_seconds)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Job '{job_name}' already scheduled")
    return {"scheduled": job_name}


@app.get("/health")
async def health():
    return {"status": "ok", "extensions": list(scrapers.keys())}


@app.get("/health/details")
async def health_details():
    """Detailed health showing installed extensions and load errors."""
    installed = manager.list_installed()
    failures = []
    for ext_dir in EXTENSIONS_DIR.iterdir():
        if not ext_dir.is_dir() or ext_dir.name.startswith("_"):
            continue
        manifest_path = ext_dir / "extension.json"
        if not manifest_path.exists():
            continue
        try:
            manifest = manager._read_manifest(ext_dir)
            try:
                # attempt to load to capture load-time errors
                manager._load_class(ext_dir, manifest)
            except Exception as e:
                failures.append({"name": manifest.get("name", ext_dir.name), "error": str(e)})
        except Exception as e:
            failures.append({"name": ext_dir.name, "error": f"manifest read error: {e}"})

    return {"status": "ok", "extensions": installed, "loadErrors": failures}
