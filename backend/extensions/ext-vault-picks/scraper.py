from typing import List

from core.base_scraper import BaseScraper, Chapter, Manhwa


CATALOG = [
    {
        "id": "vault-solo-max-level",
        "title": "Solo Max-Level Newbie",
        "url": "vault://solo-max-level-newbie",
        "cover": "https://uploads.mangadex.org/covers/1f8ea9f0-a8ec-4d4f-9b8c-6cc1f2fd56a2/dca0f92e-86e1-4e99-9886-008e7f51f945.256.jpg",
        "latest_chapter": "Chapter 182",
        "genres": ["Action", "Fantasy", "Manhwa"],
        "description": "A curated fallback source bundled with the app for smoke tests and offline UI checks.",
    },
    {
        "id": "vault-latna-saga",
        "title": "The Survival Story of a Sword King in a Fantasy World",
        "url": "vault://latna-saga",
        "cover": "https://uploads.mangadex.org/covers/6b8a35f6-735a-4f06-89cb-95d77f076d13/5e60b789-14bb-4558-9df9-f95be16bcaea.256.jpg",
        "latest_chapter": "Chapter 225",
        "genres": ["Adventure", "Fantasy", "Manhwa"],
        "description": "Power fantasy with survival mechanics and long-form world progression.",
    },
    {
        "id": "vault-returning-hero",
        "title": "The Returning Hero Remains the Strongest",
        "url": "vault://returning-hero-remains-strongest",
        "cover": "https://uploads.mangadex.org/covers/ea6f7df9-f55f-4cc6-bf57-6758e1e8b4d2/0557bfd6-bafe-4d31-bff8-fd04d14f0de3.256.jpg",
        "latest_chapter": "Chapter 98",
        "genres": ["Action", "Regression", "Manhwa"],
        "description": "A fast-paced returner story used as a deterministic sample in development builds.",
    },
]


class VaultPicksScraper(BaseScraper):
    name = "Vault Picks"
    base_url = "https://vault.local"
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
        match = self._find(manhwa_url)
        return self._to_manhwa(match)

    async def get_chapters(self, manhwa_url: str) -> List[Chapter]:
        match = self._find(manhwa_url)
        return [
            Chapter(
                id=f"{match['id']}-ch-{num}",
                title=f"Chapter {num}",
                url=f"{manhwa_url}/chapter-{num}",
                number=float(num),
                uploaded_at="2026-04-24",
            )
            for num in range(3, 0, -1)
        ]

    async def get_images(self, chapter_url: str) -> List[str]:
        # The source is deterministic and intentionally synthetic.
        return [
            f"https://picsum.photos/seed/{chapter_url.replace('/', '-')}-1/1200/1800",
            f"https://picsum.photos/seed/{chapter_url.replace('/', '-')}-2/1200/1800",
            f"https://picsum.photos/seed/{chapter_url.replace('/', '-')}-3/1200/1800",
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
