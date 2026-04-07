# 🎭 ManhwaVault

A personal manhwa reader combining React Native mobile app (iOS + Android) with FastAPI Python backend and a Git-based extension system for custom sources.

**Status:** ✅ Phase 2 Complete - Ready for QA Testing  
**Last Updated:** April 6, 2026

---

## 📊 Quick Status

| Component | Status | Details |
|-----------|--------|---------|
| Backend API | ✅ Online | 11 endpoints, 2 scrapers |
| Mobile App | ✅ Running | 6 screens, full integration |
| Extensions | ✅ Active | Asura Scans, MangaDex |
| Web Access | ✅ Working | http://localhost:8085 |

---

## 📚 Documentation

- **[PROJECT_STATUS.md](./PROJECT_STATUS.md)** — Overall project roadmap & status
- **[SETUP.md](./SETUP.md)** — Development setup guide
- **[PHASE_1_SUMMARY.md](./PHASE_1_SUMMARY.md)** — Backend completion
- **[PHASE_2_COMPLETION.md](./PHASE_2_COMPLETION.md)** — Frontend implementation  
- **[PHASE_3_POLISH_QA.md](./PHASE_3_POLISH_QA.md)** — QA & testing plan
- **[PHASE_4_DEPLOYMENT.md](./PHASE_4_DEPLOYMENT.md)** — App store & production deployment

---

## 🎯 Project Structure

```
manhwavault/
├── backend/                    # Python FastAPI server
│   ├── main.py                # 11 REST API endpoints
│   ├── requirements.txt
│   ├── core/
│   │   ├── base_scraper.py   # Abstract scraper class
│   │   └── extension_manager.py
│   └── extensions/
│       └── ext-asura-scans/   # Bundled extension
│
├── mobile/                    # React Native Expo app  
│   ├── App.tsx               # Entry point
│   ├── package.json
│   └── src/
│       ├── api/client.ts     # API integration
│       ├── screens/          # 6 implementation screens
│       ├── components/       # Shared UI components
│       ├── store/            # Zustand state
│       ├── theme/            # Dark/light theme
│       └── types/            # TypeScript definitions
│
├── .venv/                    # Python venv
├── .git/                     # Git repository
└── [Docs]
```

---

## 🚀 Quick Start

### 1. Backend

```bash
# Create and activate conda env
conda create -n manhwavault python=3.10
conda activate manhwavault

# Install dependencies
cd backend
pip install -r requirements.txt

# Run the server
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Visit http://localhost:8000/docs to see the API.

---

### 2. Mobile app

```bash
cd mobile
npm install
npx expo start
```

- Press `a` to open Android emulator
- Press `i` to open iOS simulator
- Scan QR code with Expo Go on your phone

**If testing on a physical device**, update `src/api/client.ts`:
```ts
const BASE_URL = 'http://YOUR_PC_IP:8000';
```
Find your IP with `ipconfig` (Windows) → IPv4 Address.

---

### 3. Install your first extension

#### Option A — Local (fastest for development)
Copy the `ext-asura-scans` folder into `backend/extensions/` and restart the backend.

#### Option B — From GitHub (production flow)
1. Create a new GitHub repo named `ext-asura-scans`
2. Push the contents of `ext-asura-scans/` to it
3. In the app → Extensions tab → tap `+ Install`
4. Paste your GitHub repo URL

---

## Adding a new extension

1. Create a new folder (or GitHub repo) with:
   - `extension.json` — manifest
   - `scraper.py` — your scraper class

2. `scraper.py` must subclass `BaseScraper` from `backend/core/base_scraper.py` and implement:
   - `search(query)` → `List[Manhwa]`
   - `get_detail(url)` → `Manhwa`
   - `get_chapters(url)` → `List[Chapter]`
   - `get_images(url)` → `List[str]`

3. Push to GitHub → install via the app.

---

## Tech stack

| Layer | Tech |
|---|---|
| Mobile | React Native + Expo SDK 51 |
| Navigation | React Navigation 6 |
| State | Zustand + AsyncStorage |
| Data fetching | TanStack React Query |
| Backend | FastAPI + Uvicorn |
| Scraping | httpx + BeautifulSoup4 |
| Extensions | gitpython |
| Scheduling | APScheduler |

---

## Build phases

- [x] Phase 1 — Scaffolding, navigation, theme, backend skeleton
- [ ] Phase 2 — First extension + search UI
- [ ] Phase 3 — Reader screen (vertical + horizontal)
- [ ] Phase 4 — Library + read tracking
- [ ] Phase 5 — Extension manager screen
- [ ] Phase 6 — Updates + push notifications
