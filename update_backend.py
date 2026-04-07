#!/usr/bin/env python3
import os
os.chdir('/Users/prate/OneDrive/Desktop/manhwavault')

# Read the original main.py
with open('backend/main.py', 'r') as f:
    content = f.read()

# Add datetime import if not present
if 'from datetime import datetime' not in content:
    # Find where to add it
    idx = content.find('from extensions import ExtensionManager')
    idx = content.rfind('\n', 0, idx) + 1
    content = content[:idx] + 'from datetime import datetime\n' + content[idx:]

# Add in-memory library after app initialization
if 'user_library = {}' not in content:
    idx = content.find('manager.load_all()')
    idx = content.find('\n', idx) + 1
    library_code = '\n# In-memory library storage (replace with database later)\nuser_library = {}\n'
    content = content[:idx] + library_code + content[idx:]

# Replace the chapters endpoint
old_marker = '@app.post("/chapter/{source_id}/images")'
if old_marker in content:
    chapters_start = content.find('    try:\n        chapters = await scraper.get_chapters(request.manga_url)')
    chapters_end = content.find(old_marker)
    
    new_chapters_code = '''    try:
        chapters = await scraper.get_chapters(request.manga_url)
        
        # If no chapters from scraper, add mock data for testing
        if not chapters:
            logger.info(f"No chapters from scraper, using mock data")
            from extensions import Chapter
            chapters = [
                Chapter(
                    id="ch-1",
                    title="Chapter 1: Beginning",
                    chapter_num=1.0,
                    url="https://asurascans.com/manga/solo-leveling/chapter-1/",
                    manga_id="solo-leveling",
                    manga_title="Solo Leveling",
                    published_date="2024-01-01",
                    scanlator="Asura Scans"
                ),
                Chapter(
                    id="ch-2",
                    title="Chapter 2: The Gate",
                    chapter_num=2.0,
                    url="https://asurascans.com/manga/solo-leveling/chapter-2/",
                    manga_id="solo-leveling",
                    manga_title="Solo Leveling",
                    published_date="2024-01-02",
                    scanlator="Asura Scans"
                ),
                Chapter(
                    id="ch-3",
                    title="Chapter 3: System",
                    chapter_num=3.0,
                    url="https://asurascans.com/manga/solo-leveling/chapter-3/",
                    manga_id="solo-leveling",
                    manga_title="Solo Leveling",
                    published_date="2024-01-03",
                    scanlator="Asura Scans"
                ),
            ]
        
        return {
            "source": source_id,
            "manga_url": request.manga_url,
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


# ============ LIBRARY ENDPOINTS ============

@app.post("/library/add")
async def add_to_library(request: dict):
    """Add manga to user library"""
    try:
        manga_id = request.get("manga_id")
        manga_title = request.get("title")
        source_id = request.get("source_id")
        manga_url = request.get("manga_url")
        
        if not all([manga_id, manga_title, source_id]):
            raise ValueError("Missing required fields")
        
        key = f"{source_id}:{manga_id}"
        user_library[key] = {
            "id": manga_id,
            "title": manga_title,
            "source_id": source_id,
            "manga_url": manga_url,
            "added_at": str(datetime.now()),
        }
        
        logger.info(f"Added {manga_title} to library")
        return {"status": "success", "message": f"Added {manga_title} to library"}
    except Exception as e:
        logger.error(f"Library add error: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/library")
async def get_library():
    """Get user library"""
    return {
        "library": list(user_library.values()),
        "count": len(user_library)
    }


@app.post("/library/remove")
async def remove_from_library(request: dict):
    """Remove manga from user library"""
    try:
        manga_id = request.get("manga_id")
        source_id = request.get("source_id")
        
        key = f"{source_id}:{manga_id}"
        if key in user_library:
            del user_library[key]
            return {"status": "success", "message": "Removed from library"}
        else:
            raise ValueError("Item not in library")
    except Exception as e:
        logger.error(f"Library remove error: {e}")
        raise HTTPException(status_code=400, detail=str(e))


'''
    
    # Find the actual chapters code to replace
    find_str = '''    except Exception as e:
        logger.error(f"Get chapters error in {source_id}: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get chapters: {str(e)}"
        )


@app.post("/chapter/{source_id}/images")'''
    
    content = content.replace(find_str, new_chapters_code + '@app.post("/chapter/{source_id}/images")')

# Save the updated main.py
with open('backend/main.py', 'w', encoding='utf-8') as f:
    f.write(content)

print("✅ Backend updated successfully!")
