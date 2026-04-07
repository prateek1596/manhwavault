# 🎯 Phase 3 - Polish & Quality Assurance

**Estimated Duration:** 3-5 days  
**Goal:** Ensure app is production-ready with no crashes, smooth performance, and excellent UX

---

## 📋 Testing Strategy

### 1. Unit Testing
- [ ] API client normalization functions
- [ ] State management (Zustand stores)
- [ ] Date/time formatting utilities
- [ ] Error parsing logic

**Command to run:**
```bash
cd mobile
npm test
# (requires Jest setup - add to package.json if needed)
```

### 2. Integration Testing
- [ ] Search → Detail → Reader flow
- [ ] Add to Library → Persist → Retrieve
- [ ] Extension install/update/remove
- [ ] Settings persistence across app restart

### 3. Manual E2E Testing

#### iOS Simulator
```bash
cd mobile
npx expo start
# Press: i
```

Test cases:
- [ ] App launches without crashes
- [ ] Theme toggle works
- [ ] Search returns results
- [ ] Add to library works
- [ ] Removed items don't reappear after restart
- [ ] Reader scrolling is smooth (60fps)
- [ ] Settings persist after app close
- [ ] Extensions tab shows installed scrapers

#### Android Emulator
```bash
cd mobile
npx expo start
# Press: a
# Or: emulator -avd <name>
```

Test cases:
- [ ] Same as iOS + Back button behavior
- [ ] Long-press context menus
- [ ] Keyboard handling (search input)
- [ ] Battery usage (test with screen brightness)

#### Physical Device (Android/iOS)
```bash
# Scan QR code with Expo Go
```

Test cases:
- [ ] Same as emulators
- [ ] Network switching (WiFi → 4G → WiFi)
- [ ] Background/foreground lifecycle
- [ ] Notification permissions (if implemented)

---

## ⚡ Performance Optimization

### Frontend Performance
- [ ] Profile with React DevTools Profiler
- [ ] Check component render counts
- [ ] Memoize expensive components
- [ ] Optimize images (lazy loading for library grid)
- [ ] Check bundle size: `npx expo-cli bundle-analyzer`

**Target Metrics:**
- Initial load time: < 3 seconds
- Search results display: < 1 second
- Reader page transitions: < 500ms
- Library grid rendering: 60fps

### Backend Performance
```bash
# Monitor backend while testing
# Check for:
# - Slow API responses > 2 seconds
# - Memory leaks
# - CPU spikes
```

Commands:
```bash
# Test search performance
curl "http://127.0.0.1:8000/search?q=solo&source=all" | jq '.[] | .title'

# Monitor response time
time curl -s "http://127.0.0.1:8000/search?q=solo&source=all" > /dev/null
```

---

## 🐛 Bug Hunting Checklist

### Crashes & Errors
- [ ] No crashes when searching
- [ ] No crashes when adding to library
- [ ] No crashes when navigating tabs
- [ ] No crashes when adding/removing extensions
- [ ] Handle network timeouts gracefully
- [ ] Handle 404s (extension not found)
- [ ] Handle 500s (server errors)

### Network Issues
- [ ] Offline detection and messaging
- [ ] Request timeout handling (> 10 seconds)
- [ ] Retry logic for failed requests
- [ ] Connection recovery after network switch

### UI Issues
- [ ] Text doesn't overflow in any screen
- [ ] Images load correctly (no blank spaces)
- [ ] Buttons respond to all touch events
- [ ] Navigation doesn't stutter
- [ ] Theme switching doesn't cause flicker
- [ ] Keyboard doesn't cover important UI

### State Issues
- [ ] Library persists after app close
- [ ] Settings persist after app close
- [ ] No duplicate entries in library
- [ ] Unfollow removes from library immediately
- [ ] Last read chapter tracked correctly

---

## 💾 Memory & Storage

### Memory Profile Test
```bash
# On physical device:
# 1. Open DevTools in Expo Go
# 2. Open app
# 3. Search 10 times
# 4. Add 20 items to library
# 5. Check Android Settings > Apps > Memory
# 6. Should not exceed 150MB
```

### Storage Test
- [ ] Library data persists correctly
- [ ] No duplicate data after re-adding
- [ ] Remove item → Search for it → Re-add works
- [ ] Settings storage is < 1MB

---

## 🔐 Security Checklist

- [ ] No hardcoded API keys/secrets
- [ ] API URL uses HTTPS in production (ws, not wss for Expo)
- [ ] No sensitive data in logs
- [ ] Request/response objects don't expose internals
- [ ] CORS properly configured

---

## ♿ Accessibility

- [ ] Text is readable at smallest font size setting
- [ ] Touch targets are at least 44x44 pts
- [ ] Color contrasts meet WCAG AA standards
- [ ] Screen reader supports main user flows (iOS/Android)

---

## 🎨 UI/UX Review

### Visual Polish
- [ ] Consistent spacing throughout app
- [ ] Font sizes are readable
- [ ] Colors match the theme
- [ ] Animations don't feel jittery
- [ ] Loading states are clear

### User Experience
- [ ] Error messages are helpful
- [ ] Empty states have clear CTAs
- [ ] Search results are sortable/filterable
- [ ] "No results" doesn't feel broken
- [ ] Loading indicators appear immediately

---

## 📊 Testing Report Template

```markdown
# Test Run: [Date]

## Environment
- Device: [iOS/Android, emulator/physical]
- OS Version: [version]
- App Version: [commit hash]
- Backend: [running/offline]

## Results Summary
- **Total Tests:** XX
- **Passed:** XX
- **Failed:** XX
- **Blocked:** XX

## Critical Bugs Found
- [ ] None found / Listed below:

## Minor Issues
- [ ] None found / Listed below:

## Performance Notes
- Memory: XX MB
- Load time: XX ms
- FPS: XX (during scrolling)

## Test Date & Tester
Date: [YYYY-MM-DD]
Tester: [Name/Role]
```

---

## ✅ Phase 3 Sign-Off Criteria

- [ ] No crashes after 30 minutes of normal use
- [ ] All screens are responsive
- [ ] Search works across all installed extensions
- [ ] Library persistence works flawlessly
- [ ] Settings persist correctly
- [ ] Error messages are helpful (not cryptic)
- [ ] Reader performs at 60fps
- [ ] App uses < 150MB of memory
- [ ] Network errors handled gracefully
- [ ] Code review passed

**Once all above are checked:** → Proceed to Phase 4 (Deployment)

---

## 🔗 Phase 3 Checklist Quick Links

- Run tests: `cd mobile && npm test`
- Profile: Open DevTools in Expo Go
- Monitor backend: Keep terminal open during tests
- File bugs: Create GitHub Issues with repro steps
- Document findings: Update PHASE_3_QA_REPORT.md
