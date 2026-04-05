# ManhwaVault

A mobile app for reading manhwa/manga with multi-source scraping, daily updates, and intelligent recommendations.

## Tech Stack

### Frontend
- **React Native** (Expo)
- Navigation: React Navigation
- State: Zustand
- HTTP: Axios
- Theming: System/Light/Dark mode support

### Backend
- **FastAPI** (Python 3.10+)
- Async HTTP: httpx
- Web Scraping: BeautifulSoup4
- Extension Management: GitPython
- Task Scheduling: APScheduler
- ORM: SQLAlchemy

## Project Structure

```
manhwavault/
├── backend/
│   ├── main.py                 # FastAPI application
│   ├── extensions/
│   │   ├── base_scraper.py     # Base class for scrapers
│   │   ├── extension_manager.py # Extension loader & manager
│   │   └── __init__.py
│   ├── extensions_installed/   # Dynamically installed extensions
│   ├── models/                 # Pydantic models
│   ├── db/                     # Database models & migrations
│   └── requirements.txt
├── frontend/
│   ├── App/
│   │   ├── index.js            # App entry point
│   │   ├── screens/            # Screen components
│   │   ├── navigation/         # Navigation structure
│   │   ├── components/         # Reusable components
│   │   └── theme/              # Theme system
│   ├── app.json                # Expo config
│   ├── package.json
│   ├── babel.config.js
│   ├── index.js
│   └── assets/
├── .gitignore
└── README.md
```

## Setup

### Prerequisites
- Node.js >= 18
- Python 3.10
- Git
- Expo CLI: `npm install -g expo-cli`

### Backend Setup

```bash
# Activate Python environment
conda activate manhwavault

# Install dependencies
cd backend
pip install fastapi uvicorn httpx beautifulsoup4 gitpython apscheduler

# Run development server
python main.py
```

Backend will be available at `http://localhost:8000`

### Frontend Setup

```bash
# Install dependencies
cd frontend
npm install

# Start Expo development server
npm start

# To run on Android
npm run android

# To run on iOS
npm run ios
```

## Phase 1: MVP Features (✅ Complete)

- [x] Backend scaffolding with extension system
- [x] React Native navigation structure
- [x] Theme system (light/dark mode)
- [x] **Asura Scans** scraper extension
- [x] **Flame Scans** scraper extension
- [x] **Reaper Scans** scraper extension
- [x] Multi-source search support
- [ ] SQLite database schema
- [ ] Chapter list & reading interface
- [ ] User library (favorites)
- [ ] Update notifications
- [ ] Reader preferences (vertical/horizontal scroll)

## Extension Development

### Available Scrapers

3 scrapers are already built and ready to use:

| Scraper | Source ID | Site | Status |
|---------|-----------|------|--------|
| Asura Scans | `asura` | asurascans.com | ✅ Ready |
| Flame Scans | `flame` | flamescans.org | ✅ Ready |
| Reaper Scans | `reaper` | reaperscans.com | ✅ Ready |

### Quick Start: Search All Sources

```python
# Search all sources simultaneously
import httpx
import asyncio

async def search_all(query):
    async with httpx.AsyncClient() as client:
        sources = ["asura", "flame", "reaper"]
        tasks = [
            client.post(
                f"http://localhost:8000/search/{source}",
                json={"query": query, "page": 1}
            )
            for source in sources
        ]
        responses = await asyncio.gather(*tasks)
        return [r.json() for r in responses]

results = asyncio.run(search_all("solo leveling"))
```

### Quick Scraper API Usage

```bash
# List all scrapers
curl http://localhost:8000/extensions

# Search Asura Scans
curl -X POST http://localhost:8000/search/asura \
  -H "Content-Type: application/json" \
  -d '{"query":"solo leveling","page":1}'

# Get chapters from Asura
curl -X POST http://localhost:8000/manga/asura/chapters \
  -H "Content-Type: application/json" \
  -d '{"manga_url":"https://asurascans.com/manga/solo-leveling/"}'

# Get chapter images
curl -X POST http://localhost:8000/chapter/asura/images \
  -H "Content-Type: application/json" \
  -d '{"chapter_url":"https://asurascans.com/..."}'

# Get latest chapters
curl http://localhost:8000/latest/asura
```

## API Endpoints

### Extensions
- `GET /extensions` - List all loaded scrapers
- `POST /extensions/install` - Install extension from git
- `PUT /extensions/{name}/update` - Update extension
- `DELETE /extensions/{name}` - Uninstall extension
- `GET /extensions/check-updates` - Check for updates

### Search & Reading
- `POST /search/{source_id}` - Search manga
- `POST /manga/{source_id}/chapters` - Get chapters
- `POST /chapter/{source_id}/images` - Get chapter images
- `GET /latest/{source_id}` - Get latest chapters

## Adding Custom Scrapers

### Overview

Want to add support for more sites? The extension system makes it easy:

1. **Copy template**: `backend/extensions_installed/template_scraper.py`
2. **Customize CSS selectors** using browser DevTools (F12)
3. **Update source_id** (lowercase, unique identifier)
4. **Save as new .py file** - backend auto-loads it!

### Step-by-Step Guide

**Full guide:** See [/backend/extensions_installed/SCRAPER_GUIDE.md](backend/extensions_installed/SCRAPER_GUIDE.md)

Quick example: Create `mangadex_scraper.py`:

```python
from extensions import BaseScraper, Manga, Chapter, ChapterImage

class MangaDex(BaseScraper):
    def __init__(self):
        super().__init__()
        self.name = "MangaDex"
        self.source_id = "mangadex"
        self.base_url = "https://mangadex.org"
    
    async def search(self, query: str, page: int = 1) -> List[Manga]:
        # Use browser DevTools to find CSS selectors
        # Parse HTML with BeautifulSoup
        # Return list of Manga objects
        pass
    
    async def get_chapters(self, manga_url: str) -> List[Chapter]:
        # Parse chapter list
        pass
    
    async def get_chapter_images(self, chapter_url: str) -> List[ChapterImage]:
        # Parse chapter images
        pass
```

**No restart needed** - just save and it's instantly available at `/search/mangadex`!

### Popular Sites To Add

- MangaDex (API available!)
- Luminous Scans
- Void Scans
- Manhua Plus
- Webtoon
- And more...

### Git-Based Extensions

You can also create extensions in separate Git repos and install them:

```bash
POST /extensions/install
{
    "git_url": "https://github.com/user/mangadex-scraper.git",
    "extension_name": "mangadex"
}
```

## License

MIT
