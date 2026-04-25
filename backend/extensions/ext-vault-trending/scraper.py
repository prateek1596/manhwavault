from typing import List

from core.base_scraper import BaseScraper, Chapter, Manhwa


CATALOG = [
    {
        "id": "trend-nano-machine",
        "title": "Nano Machine",
        "url": "vault-trending://nano-machine",
        "cover": "https://uploads.mangadex.org/covers/5e11f256-4f36-4a97-8be2-eb3ebf8a18f8/1fd1c6fd-8ddf-4860-8cab-f89c5be1f7bb.256.jpg",
        "latest_chapter": "Chapter 246",
        "genres": ["Action", "Martial Arts", "Manhwa"],
        "description": "A deterministic trending-source sample shipped with the backend.",
    },
    {
        "id": "trend-eleceed",
        "title": "Eleceed",
        "url": "vault-trending://eleceed",
        "cover": "https://uploads.mangadex.org/covers/00f5d0cf-89b6-4dda-af1f-b3f755f22f36/18f3254f-4a2f-4ee3-bddf-91ef4f6cb252.256.jpg",
        "latest_chapter": "Chapter 356",
        "genres": ["Action", "Comedy", "Manhwa"],
        "description": "Fast and stable source for smoke-testing discovery carousels.",
    },
    {
        "id": "trend-orv",
        "title": "Omniscient Reader's Viewpoint",
        "url": "vault-trending://omniscient-reader-viewpoint",
        "cover": "https://uploads.mangadex.org/covers/a07320a4-b73c-4f8f-905e-234ecfcd5f30/fd4a4ea5-fd28-42f3-a172-1f5f9d106f59.256.jpg",
        "latest_chapter": "Chapter 258",
        "genres": ["Action", "Fantasy", "Manhwa"],
        "description": "A high-demand title used for deterministic recommendation seeds.",
    },
    {
        "id": "trend-devil-return",
        "title": "The Heavenly Demon Can't Live a Normal Life",
        "url": "vault-trending://heavenly-demon-normal-life",
        "cover": "https://uploads.mangadex.org/covers/0f4f0f8f-16aa-4fca-bf82-c249cb81933f/d13e45e8-c75f-40bb-bb16-420c954d74a2.256.jpg",
        "latest_chapter": "Chapter 162",
        "genres": ["Action", "Fantasy", "Manhwa"],
        "description": "Synthetic trend feed entry for fallback and UX verification.",
    },
]


class VaultTrendingScraper(BaseScraper):
    name = "Vault Trending"
    base_url = "https://trending.vault.local"
    language = "en"
    nsfw = False
    version = "1.0.0"

    async def search(self, query: str) -> List[Manhwa]:
        q = query.strip().lower()
        if not q:
            matched = CATALOG
        else:
            matched = [
                item
                for item in CATALOG
                if q in item["title"].lower() or any(q in genre.lower() for genre in item["genres"])
            ]

        return [self._to_manhwa(item) for item in matched]

    async def get_detail(self, manhwa_url: str) -> Manhwa:
        item = self._find(manhwa_url)
        return self._to_manhwa(item)

    async def get_chapters(self, manhwa_url: str) -> List[Chapter]:
        item = self._find(manhwa_url)
        return [
            Chapter(
                id=f"{item['id']}-ch-{num}",
                title=f"Chapter {num}",
                url=f"{manhwa_url}/chapter-{num}",
                number=float(num),
                uploaded_at="2026-04-25",
            )
            for num in range(5, 0, -1)
        ]

    async def get_images(self, chapter_url: str) -> List[str]:
        seed = chapter_url.replace("/", "-")
        return [
            f"https://picsum.photos/seed/{seed}-1/1200/1800",
            f"https://picsum.photos/seed/{seed}-2/1200/1800",
            f"https://picsum.photos/seed/{seed}-3/1200/1800",
        ]

    def _find(self, manhwa_url: str) -> dict:
        for item in CATALOG:
            if item["url"] == manhwa_url:
                return item
        return CATALOG[0]

    def _to_manhwa(self, item: dict) -> Manhwa:
        return Manhwa(
            id=item["id"],
            title=item["title"],
            url=item["url"],
            cover=item["cover"],
            latest_chapter=item["latest_chapter"],
            source=self.name,
            status="ongoing",
            genres=item["genres"],
            description=item["description"],
        )
