from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import List, Dict, Any
from enum import Enum


class ImageType(str, Enum):
    JPEG = "jpeg"
    PNG = "png"
    WEBP = "webp"


@dataclass
class Manga:
    """Represents a manhwa/manga series"""
    id: str
    title: str
    author: str
    description: str
    cover_url: str
    status: str  # ongoing, completed, hiatus
    genres: List[str]
    rating: float
    url: str
    source: str


@dataclass
class Chapter:
    """Represents a chapter in a series"""
    id: str
    title: str
    chapter_num: float
    url: str
    manga_id: str
    manga_title: str
    published_date: str
    scanlator: str


@dataclass
class ChapterImage:
    """Represents an image in a chapter"""
    url: str
    page_num: int
    image_type: ImageType


class BaseScraper(ABC):
    """Base class for all scraper extensions"""

    def __init__(self):
        self.name: str = "Base Scraper"
        self.source_id: str = "base"
        self.version: str = "1.0.0"
        self.language: str = "en"

    @abstractmethod
    async def search(self, query: str, page: int = 1) -> List[Manga]:
        """
        Search for manga by query

        Args:
            query: Search term
            page: Page number for pagination

        Returns:
            List of Manga objects matching the query
        """
        pass

    @abstractmethod
    async def get_chapters(self, manga_url: str) -> List[Chapter]:
        """
        Get all chapters for a manga

        Args:
            manga_url: URL of the manga page

        Returns:
            List of Chapter objects
        """
        pass

    @abstractmethod
    async def get_chapter_images(self, chapter_url: str) -> List[ChapterImage]:
        """
        Get all images for a chapter

        Args:
            chapter_url: URL of the chapter page

        Returns:
            List of ChapterImage objects
        """
        pass

    async def get_latest_chapters(self, limit: int = 10) -> List[Chapter]:
        """
        Get latest updated chapters (optional override)

        Args:
            limit: Number of latest chapters to return

        Returns:
            List of latest Chapter objects
        """
        return []

    async def get_latest_manga(self, limit: int = 10) -> List[Manga]:
        """
        Get latest added manga (optional override)

        Args:
            limit: Number of latest manga to return

        Returns:
            List of latest Manga objects
        """
        return []
