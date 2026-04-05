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

## Phase 1: MVP Features (In Progress)

- [x] Backend scaffolding with extension system
- [x] React Native navigation structure
- [x] Theme system (light/dark mode)
- [ ] Asura Scans scraper extension
- [ ] SQLite database schema
- [ ] Multi-source search
- [ ] Chapter list & reading interface
- [ ] User library (favorites)
- [ ] Update notifications
- [ ] Reader preferences (vertical/horizontal scroll)

## Extension Development

### Creating a New Scraper

1. Create a new Python file in `extensions_installed/` directory
2. Inherit from `BaseScraper`
3. Implement required methods: `search()`, `get_chapters()`, `get_chapter_images()`
4. Restart backend to auto-load

```python
from extensions import BaseScraper, Manga, Chapter, ChapterImage

class AsuraReader(BaseScraper):
    def __init__(self):
        super().__init__()
        self.name = "Asura Scans"
        self.source_id = "asura"
        self.version = "1.0.0"
    
    async def search(self, query: str, page: int = 1) -> List[Manga]:
        # Implementation
        pass
    
    async def get_chapters(self, manga_url: str) -> List[Chapter]:
        # Implementation
        pass
    
    async def get_chapter_images(self, chapter_url: str) -> List[ChapterImage]:
        # Implementation
        pass
```

### Installing from Git

```python
POST /extensions/install
{
    "git_url": "https://github.com/user/asura-scraper.git",
    "extension_name": "asura_scans"
}
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

## Next Steps (Phase 2+)

- Build first scraper extension (Asura Scans)
- Implement SQLite database
- Add user library & reading history
- Set up update notification system
- Implement offline reading support
- Add search filters & recommendations

## License

MIT
