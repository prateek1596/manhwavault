# 🔗 Quick Reference Guide

**Fast navigation for developers and testers**

---

## 🎬 Start Development

```bash
# Terminal 1: Backend
cd backend
source .venv/bin/activate  # Windows: .venv\Scripts\activate
python -m uvicorn main:app --reload

# Terminal 2: Mobile  
cd mobile
npx expo start
```

**Backend:** http://127.0.0.1:8000  
**Frontend:** http://localhost:8085  
**Docs:** http://127.0.0.1:8000/docs

---

## 🧪 Test API Endpoints

### Search
```bash
curl "http://127.0.0.1:8000/search?q=solo&source=all" | jq '.[] | {title, source, cover}'
```

### Extensions
```bash
curl "http://127.0.0.1:8000/extensions" | jq '.[] | {name, version, language}'
```

### Health
```bash
curl "http://127.0.0.1:8000/health" | jq '.extensions'
```

---

## 📱 Mobile Access

| Method | Steps |
|--------|-------|
| **Web** | Open http://localhost:8085 in browser |
| **Android** | Run app, press `a` in expo terminal |
| **iOS** | Run app, press `i` in expo terminal |
| **Physical** | Scan QR code with Expo Go app |

---

## 🐛 Debugging

### Backend Errors
```bash
# Verbose logging
python -m uvicorn main:app --log-level debug

# Check extensions loaded
curl http://127.0.0.1:8000/health
```

### Mobile Errors
```bash
# Verbose Expo
npx expo start --verbose

# Clear all caches
rm -rf node_modules .metro node_modules/.cache
npx expo start --clear

# TypeScript check
npx tsc --noEmit
```

---

## 🔄 Common Tasks

### Add New Scraper
1. Create folder: `backend/extensions/ext-sitename/`
2. Add `extension.json` and `scraper.py`
3. Restart backend
4. Auto-loads on startup

### Fix Metro Cache
```bash
cd mobile
rm -rf .metro node_modules/.cache
npx expo start --clear
```

### Test on Physical Device
```bash
# Find your PC IP
ipconfig  # Look for IPv4 Address

# Update mobile/src/api/client.ts
const BASE_URL = 'http://192.168.1.X:8000';

# Scan QR code
```

---

## 📊 Project Commands

```bash
# Check backend is running
curl http://127.0.0.1:8000/health

# Test search
curl "http://127.0.0.1:8000/search?q=solo&source=all"

# List extensions
curl http://127.0.0.1:8000/extensions

# Rebuild mobile app
npx expo start --clear

# Run TypeScript check
npx tsc --noEmit

# Build apk/ipa
eas build --platform android  # or ios
```

---

## 📂 Key Files Reference

| File | Purpose |
|------|---------|
| `backend/main.py` | All 11 API endpoints |
| `backend/core/base_scraper.py` | Scraper interface |
| `backend/core/extension_manager.py` | Extension loader |
| `mobile/src/api/client.ts` | Backend wrapper |
| `mobile/src/screens/TabScreens.tsx` | 5 main screens |
| `mobile/src/store/index.ts` | Zustand stores |
| `mobile/App.tsx` | Theme + navigation |

---

## ⚠️ Troubleshooting Matrix

| Problem | Solution |
|---------|----------|
| Backend won't start | Activate venv, check Python path |
| Metro cache error | `npx expo start --clear` |
| Port 8085 taken | Expo auto-switches to 8086+ |
| API connection fails | Check backend is running, verify URL |
| Build fails | `npm install --legacy-peer-deps` |
| Theme not switching | Check `useAppTheme()` context |
| Library not persisting | Verify `react-native-mmkv` installed |
| Images not loading | Check URL encoding in API client |

---

## 📈 Performance Targets

- Search response: < 1 second
- App load time: < 3 seconds
- Reader performance: 60 fps
- Memory usage: < 150 MB
- API latency: < 500ms

---

## 🎓 Architecture Quick View

```
┌─────────────────────────────────────────┐
│         EXPO MOBILE APP                 │
│  ┌─────────────────────────────────┐    │
│  │  React Native                   │    │
│  │  ├─ 6 Screens                  │    │
│  │  ├─ Zustand Store              │    │
│  │  └─ React Query                │    │
│  └─────────────────────────────────┘    │
│           ↓ (API calls)                  │
└─────────────────────────────────────────┘
           ↕ HTTP
┌─────────────────────────────────────────┐
│       FASTAPI BACKEND                   │
│  ┌─────────────────────────────────┐    │
│  │  FastAPI + Uvicorn              │    │
│  │  ├─ 11 Endpoints               │    │
│  │  └─ Extension Manager           │    │
│  └─────────────────────────────────┘    │
│           ↓ (Scraping)                   │
│  ┌─────────────────────────────────┐    │
│  │  Installed Scrapers             │    │
│  │  ├─ Asura Scans                │    │
│  │  ├─ MangaDex                   │    │
│  │  └─ Custom (Git-based)         │    │
│  └─────────────────────────────────┘    │
│           ↓ (Scraping)                   │
│  ┌─────────────────────────────────┐    │
│  │  Manga Websites                 │    │
│  │  ├─ asuracomic.com              │    │
│  │  ├─ mangadex.org                │    │
│  │  └─ Custom sites                │    │
│  └─────────────────────────────────┘    │
└─────────────────────────────────────────┘
```

---

## 💾 Data Flow

```
User Action → React Component
    ↓
useQuery / useMutation (React Query)
    ↓
API Client (api/client.ts)
    ↓
Zustand Store (if needed)
    ↓
AsyncStorage (persistent)
```

---

## 🔐 Security Notes

- API accepts all origins (CORS: `allow_origins=["*"]`)
- No authentication yet (add in v1.1)
- No rate limiting (add in v1.1)
- No HTTPS on local (add in production)

---

## 📦 Dependency Info

**Backend:** 10+ packages  
**Mobile:** 756 packages (managed by npm)

To update:
```bash
# Backend
pip list --outdated

# Mobile
npm outdated
```

---

## 🎉 Success Indicators

You'll know everything works when:
1. ✅ Backend shows "Application startup complete"
2. ✅ Mobile shows metro QR code
3. ✅ Web load at http://localhost:8085
4. ✅ Can search for manga
5. ✅ Can add to library
6. ✅ Library persists after app close

---

## 📞 Next Steps

1. **Now:** Review [PHASE_2_COMPLETION.md](./PHASE_2_COMPLETION.md)
2. **Then:** Follow [PHASE_3_POLISH_QA.md](./PHASE_3_POLISH_QA.md) for testing
3. **Next:** Deploy using [PHASE_4_DEPLOYMENT.md](./PHASE_4_DEPLOYMENT.md)

---

## 🎯 Current Status

**Phase 1:** ✅ COMPLETE  
**Phase 2:** ✅ COMPLETE  
**Phase 3:** 📋 READY TO START  
**Phase 4:** 📋 PLANNED

**Next Action:** Begin Phase 3 QA testing with emulator

---

*Keep this guide open while developing!*
