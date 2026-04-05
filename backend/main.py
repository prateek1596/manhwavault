import os
import asyncio
import logging
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict
from extensions import ExtensionManager

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="ManhwaVault Backend",
    description="Backend API for ManhwaVault manga reader",
    version="0.1.0"
)

# Add CORS middleware for React Native app
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Extension manager
extensions_dir = os.path.join(os.path.dirname(__file__), "extensions_installed")
os.makedirs(extensions_dir, exist_ok=True)
manager = ExtensionManager(extensions_dir)

# Load extensions on startup
manager.load_all()


# ============ Pydantic Models ============

class SearchRequest(BaseModel):
    query: str
    page: int = 1


class ExtensionInstallRequest(BaseModel):
    git_url: str
    extension_name: str


class ExtensionResponse(BaseModel):
    name: str
    source_id: str
    version: str
    language: str


# ============ Endpoints ============

@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "status": "online",
        "app": "ManhwaVault Backend",
        "version": "0.1.0"
    }


@app.get("/extensions")
async def list_extensions() -> Dict[str, ExtensionResponse]:
    """List all loaded read scrapers"""
    scrapers_info = manager.list_scrapers()
    return {
        source_id: ExtensionResponse(**metadata)
        for source_id, metadata in scrapers_info.items()
    }


@app.post("/extensions/install")
async def install_extension(request: ExtensionInstallRequest) -> Dict[str, str]:
    """Install a new extension from git repository"""
    success = await manager.install_extension(
        request.git_url,
        request.extension_name
    )
    
    if not success:
        raise HTTPException(
            status_code=400,
            detail=f"Failed to install extension: {request.extension_name}"
        )
    
    return {
        "status": "installed",
        "extension": request.extension_name
    }


@app.put("/extensions/{ext_name}/update")
async def update_extension(ext_name: str) -> Dict[str, str]:
    """Update an installed extension"""
    success = await manager.update_extension(ext_name)
    
    if not success:
        raise HTTPException(
            status_code=400,
            detail=f"Failed to update extension: {ext_name}"
        )
    
    return {
        "status": "updated",
        "extension": ext_name
    }


@app.delete("/extensions/{ext_name}")
async def uninstall_extension(ext_name: str) -> Dict[str, str]:
    """Uninstall an extension"""
    success = await manager.uninstall_extension(ext_name)
    
    if not success:
        raise HTTPException(
            status_code=400,
            detail=f"Failed to uninstall extension: {ext_name}"
        )
    
    return {
        "status": "uninstalled",
        "extension": ext_name
    }


@app.get("/extensions/check-updates")
async def check_extension_updates() -> Dict[str, dict]:
    """Check for available updates for all extensions"""
    return await manager.check_updates()


@app.post("/search/{source_id}")
async def search(source_id: str, request: SearchRequest):
    """Search for manga using a specific scraper"""
    scraper = manager.get_scraper(source_id)
    
    if not scraper:
        raise HTTPException(
            status_code=404,
            detail=f"Source not found: {source_id}"
        )
    
    try:
        results = await scraper.search(request.query, request.page)
        return {
            "source": source_id,
            "query": request.query,
            "page": request.page,
            "results": [
                {
                    "id": m.id,
                    "title": m.title,
                    "author": m.author,
                    "description": m.description,
                    "cover_url": m.cover_url,
                    "status": m.status,
                    "genres": m.genres,
                    "rating": m.rating,
                    "url": m.url,
                }
                for m in results
            ]
        }
    except Exception as e:
        logger.error(f"Search error in {source_id}: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Search failed: {str(e)}"
        )


@app.post("/manga/{source_id}/chapters")
async def get_chapters(source_id: str, manga_url: str):
    """Get all chapters for a manga"""
    scraper = manager.get_scraper(source_id)
    
    if not scraper:
        raise HTTPException(
            status_code=404,
            detail=f"Source not found: {source_id}"
        )
    
    try:
        chapters = await scraper.get_chapters(manga_url)
        return {
            "source": source_id,
            "manga_url": manga_url,
            "chapters": [
                {
                    "id": c.id,
                    "title": c.title,
                    "chapter_num": c.chapter_num,
                    "url": c.url,
                    "manga_id": c.manga_id,
                    "manga_title": c.manga_title,
                    "published_date": c.published_date,
                    "scanlator": c.scanlator,
                }
                for c in chapters
            ]
        }
    except Exception as e:
        logger.error(f"Get chapters error in {source_id}: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get chapters: {str(e)}"
        )


@app.post("/chapter/{source_id}/images")
async def get_chapter_images(source_id: str, chapter_url: str):
    """Get all images for a chapter"""
    scraper = manager.get_scraper(source_id)
    
    if not scraper:
        raise HTTPException(
            status_code=404,
            detail=f"Source not found: {source_id}"
        )
    
    try:
        images = await scraper.get_chapter_images(chapter_url)
        return {
            "source": source_id,
            "chapter_url": chapter_url,
            "images": [
                {
                    "url": img.url,
                    "page_num": img.page_num,
                    "type": img.image_type,
                }
                for img in images
            ]
        }
    except Exception as e:
        logger.error(f"Get chapter images error in {source_id}: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get chapter images: {str(e)}"
        )


@app.get("/latest/{source_id}")
async def get_latest_chapters(source_id: str, limit: int = 10):
    """Get latest updated chapters from a source"""
    scraper = manager.get_scraper(source_id)
    
    if not scraper:
        raise HTTPException(
            status_code=404,
            detail=f"Source not found: {source_id}"
        )
    
    try:
        chapters = await scraper.get_latest_chapters(limit)
        return {
            "source": source_id,
            "latest": [
                {
                    "id": c.id,
                    "title": c.title,
                    "chapter_num": c.chapter_num,
                    "url": c.url,
                    "published_date": c.published_date,
                }
                for c in chapters
            ]
        }
    except Exception as e:
        logger.error(f"Get latest error in {source_id}: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get latest chapters: {str(e)}"
        )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )
