# ManhwaVault

ManhwaVault is a multi-client manhwa reader stack with:

- FastAPI backend scraper API
- React Native frontend app (`frontend/`)
- Expo + TypeScript mobile app (`mobile/`)
- Extension-based source scraping architecture

## Quick Start

### 1) Backend

```powershell
./run_backend.ps1
```

Backend runs on `http://127.0.0.1:8000` by default.

### 2) Mobile (Expo)

```powershell
./run_mobile.ps1
```

If your device cannot reach localhost, set `EXPO_PUBLIC_API_BASE_URL` for the mobile app.

## API Highlights

- `GET /health` - backend health + loaded extensions
- `GET /search` - unified search
- `GET /search/by-source` - grouped source results
- `GET /search/suggestions` - curated/discovery suggestion feed
- `GET /sources` - list available sources
- `GET /source/catalog` - browse source content

## Extension System

Backend extensions live in `backend/extensions/*` and must include:

- `extension.json`
- scraper entry module (for example `scraper.py`)

A bundled sample deterministic source is included:

- `backend/extensions/ext-vault-picks`

This source helps with local UI/testing flows even when public sources are rate-limited.

## Tests

Run backend smoke tests:

```powershell
cd backend
pytest -q
```

## Notes

- Mobile search supports grouped source mode and source-specific mode.
- Backend normalizes fallback behavior when sources are temporarily unavailable.
- If extensions fail to load, verify backend dependencies from `backend/requirements.txt` are installed.
