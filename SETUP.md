# ManhwaVault — Setup Guide

## Prerequisites
- Node.js >= 18
- Python 3.10
- Git
- Android Studio (for emulator) OR Expo Go app on your phone

---

## 1. Backend setup

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

Open http://localhost:8000/docs to see the API explorer.

---

## 2. Mobile app setup

```bash
cd mobile
npm install

# If testing on physical device, update the IP in src/api/client.ts:
# const BASE_URL = 'http://YOUR_LOCAL_IP:8000'
# Find your IP: ipconfig (Windows) or ifconfig (Mac/Linux)

# Start Expo
npx expo start
```

- Press `a` for Android emulator
- Press `i` for iOS simulator  
- Scan QR code with Expo Go app on your phone

---

## 3. Install your first extension

The Asura Scans extension is already bundled locally in `backend/extensions/ext-asura-scans/`.
It loads automatically when the backend starts.

To install more extensions from GitHub, use the Extensions tab in the app.

---

## 4. Project structure

```
manhwavault/
├── mobile/                  # React Native (Expo) app
│   ├── App.tsx              # Entry point
│   └── src/
│       ├── api/client.ts    # All API calls
│       ├── components/      # Shared UI components
│       ├── navigation/      # Tab + stack navigation
│       ├── screens/         # All screens
│       ├── store/           # Zustand state (library, settings)
│       ├── theme/           # Light/dark theme system
│       └── types/           # TypeScript types
│
└── backend/                 # FastAPI server
    ├── main.py              # All API endpoints
    ├── requirements.txt
    ├── core/
    │   ├── base_scraper.py      # Abstract scraper class
    │   └── extension_manager.py # Git clone/load/update/remove
    └── extensions/
        └── ext-asura-scans/     # Bundled extension
            ├── extension.json
            ├── scraper.py
            └── README.md
```

---

## 5. Creating a new scraper extension

1. Create a new GitHub repo named `ext-sitename`
2. Add `extension.json` (copy from ext-asura-scans, update fields)
3. Add `scraper.py` — subclass `BaseScraper`, implement 4 methods
4. Push to GitHub
5. In the app: Extensions → Install → paste the repo URL

---

## 6. Physical device tip (Windows)

Find your local IP:
```
ipconfig
```
Look for `IPv4 Address` under your WiFi adapter (e.g. `192.168.1.5`).

Update `mobile/src/api/client.ts`:
```ts
const BASE_URL = 'http://192.168.1.5:8000';
```

Both your PC and phone must be on the same WiFi network.
