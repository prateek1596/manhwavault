from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import List, Optional


@dataclass
class Manhwa:
    id: str
    title: str
    url: str
    cover: str
    latest_chapter: str
    source: str
    status: Optional[str] = None
    genres: List[str] = field(default_factory=list)
    description: Optional[str] = None


@dataclass
class Chapter:
    id: str
    title: str
    url: str
    number: float
    uploaded_at: Optional[str] = None


class BaseScraper(ABC):
    name: str = ""
    base_url: str = ""
    language: str = "en"
    nsfw: bool = False
    version: str = "1.0.0"

    @abstractmethod
    async def search(self, query: str) -> List[Manhwa]: ...

    @abstractmethod
    async def get_detail(self, manhwa_url: str) -> Manhwa: ...

    @abstractmethod
    async def get_chapters(self, manhwa_url: str) -> List[Chapter]: ...

    @abstractmethod
    async def get_images(self, chapter_url: str) -> List[str]: ...

    async def get_latest_chapter(self, manhwa_url: str) -> Optional[Chapter]:
        chapters = await self.get_chapters(manhwa_url)
        return chapters[0] if chapters else None
