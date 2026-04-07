# 🚀 Phase 4 - Deployment & Production

**Estimated Duration:** 1-2 weeks  
**Goal:** Deploy ManhwaVault to app stores and production infrastructure

---

## 📱 Mobile App Deployment

### Prerequisites
- [ ] Complete Phase 3 QA (all tests passing)
- [ ] Developer accounts created
- [ ] Certificates & provisioning profiles ready
- [ ] App signing keys configured

### 1. Google Play Store (Android)

#### Step 1: Generate Signed APK/AAB
```bash
cd mobile
eas build --platform android --profile production
```

#### Step 2: Setup Google Play Console
1. Go to https://play.google.com/console
2. Create new app: "ManhwaVault"
3. Fill in:
   - Category: Comics
   - Content rating questionnaire
   - Privacy policy URL
   - Target audience: 13+

#### Step 3: Create Release
```bash
# Generate app signing key (if not already done)
eas credentials

# Build production AAB
eas build --platform android --profile production

# Upload to Play Console
# Go to internal testing → create release → upload AAB
```

#### Step 4: Store Listing
- Set app name, description, screenshots
- Add short description (50 chars max)
- Add full description (4000 chars max)
- Add screenshots (5-8 images, 1080x1920px)
- Set release notes

#### Step 5: Submit for Review
- Click "Send to Review"
- Google reviews within 24-48 hours
- Go live!

**Estimated timeline:** 1 week

---

### 2. Apple App Store (iOS)

#### Prerequisites
- [ ] Developer Program membership ($99/year)
- [ ] Apple Developer account
- [ ] Mac with Xcode (for testing)

#### Step 1: Setup Certificates & Provisioning
```bash
eas credentials
# Select iOS
# Follow prompts to create dev & prod certificates
```

#### Step 2: Generate Signed IPA
```bash
eas build --platform ios --profile production
```

#### Step 3: App Store Connect Setup
1. Go to https://appstoreconnect.apple.com
2. Apps → New App
3. Fill in:
   - Name: ManhwaVault
   - Platforms: iOS, iPadOS
   - Category: Books
   - Bundle ID: com.manhwavault.app

#### Step 4: App Information
- Price: Free
- App Privacy Policy
- Contact email
- Support URL

#### Step 5: Prepare Screenshots
- Minimum 3 screenshots per device
- Maximum 5 per device
- Sizes:
  - iPhone 6.7": 1284x2778px
  - iPhone 6.5": 1242x2688px
- Include text: "Search", "Library", "Reading"

#### Step 6: Build Info
1. Create version (e.g., 1.0.0)
2. Upload TestFlight build (if you have IPA)
3. Test on TestFlight

#### Step 7: Submit for Review
- Set release date
- Click "Submit for Review"
- Apple typically reviews within 24 hours
- Go live!

**Estimated timeline:** 2-3 weeks (due to Apple's review process)

---

## 🖥️ Backend Deployment

### Option A: Self-Hosted (Recommended for MVP)

#### Step 1: Choose VPS Provider
- [ ] DigitalOcean ($5-10/month)
- [ ] Linode ($5/month)
- [ ] AWS EC2 ($5-15/month)
- [ ] Heroku (free tier limited)

Example: DigitalOcean
```bash
# 1. Create Ubuntu 22.04 LTS Droplet
# 2. SSH into droplet
# 3. Run:

sudo apt update
sudo apt install python3-pip python3-venv git

git clone https://github.com/YOUR_USERNAME/manhwavault.git
cd manhwavault/backend

python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Run with Gunicorn
pip install gunicorn
gunicorn main:app --workers 4 --worker-class uvicorn.workers.UvicornWorker
```

#### Step 2: Setup with Nginx Reverse Proxy
```bash
sudo apt install nginx

# Create /etc/nginx/sites-available/manhwavault
sudo tee /etc/nginx/sites-available/manhwavault > /dev/null << 'EOF'
server {
    listen 80;
    server_name manhwavault.example.com;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
EOF

sudo ln -s /etc/nginx/sites-available/manhwavault /etc/nginx/sites-enabled/
sudo systemctl restart nginx
```

#### Step 3: SSL Certificate (Free with Let's Encrypt)
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d manhwavault.example.com
```

#### Step 4: Setup Systemd Service
```bash
sudo tee /etc/systemd/system/manhwavault.service > /dev/null << 'EOF'
[Unit]
Description=ManhwaVault Backend
After=network.target

[Service]
Type=notify
User=ubuntu
WorkingDirectory=/home/ubuntu/manhwavault/backend
Environment="PATH=/home/ubuntu/manhwavault/backend/venv/bin"
ExecStart=/home/ubuntu/manhwavault/backend/venv/bin/gunicorn main:app --workers 4

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl start manhwavault
sudo systemctl enable manhwavault
```

### Option B: Containerized Deployment (Docker)

#### Step 1: Create Dockerfile
```dockerfile
FROM python:3.10

WORKDIR /app

COPY backend/requirements.txt .
RUN pip install -r requirements.txt

COPY backend/ .

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

#### Step 2: Build & Deploy
```bash
docker build -t manhwavault:latest .
docker run -d -p 8000:8000 manhwavault:latest
```

#### Step 3: Deploy to Docker Hub
```bash
docker tag manhwavault:latest username/manhwavault:latest
docker push username/manhwavault:latest

# Then deploy using Docker Compose or Kubernetes
```

### Option C: Heroku (Simplest, Free Tier Limited)

```bash
heroku create manhwavault-api
git push heroku main

# Set environment variables
heroku config:set PYTHONUNBUFFERED=1
```

---

## 🌍 Domain Setup

1. Purchase domain:
   - Namecheap, GoDaddy, Google Domains
   - Cost: $10-15/year

2. Point to VPS:
   ```bash
   # Add A record pointing to VPS IP
   A record: @ 123.45.67.89
   ```

3. Update mobile app:
   ```typescript
   // mobile/src/api/client.ts
   const BASE_URL = 'https://api.manhwavault.com';
   ```

---

## 📊 Monitoring & Logging

### Backend Monitoring
```bash
# Install monitoring (e.g., Datadog, New Relic free tier)
pip install python-datadog python-json-logger

# Or use open-source: Prometheus + Grafana
```

### Error Tracking
```bash
# Setup Sentry for error reporting
pip install sentry-sdk
```

### Logs
```bash
# View backend logs
journalctl -u manhwavault -f

# Monitor in real-time
tail -f /var/log/syslog | grep manhwavault
```

---

## 🔒 Security Checklist

- [ ] Backend uses HTTPS (not HTTP)
- [ ] Database credentials not in code (use env vars)
- [ ] API keys rotated regularly
- [ ] CORS properly restricted (in production)
- [ ] Rate limiting implemented
- [ ] SQL injection prevention (Pydantic validates input)
- [ ] CSRF tokens (FastAPI handles automatically)
- [ ] Headers security:
  ```python
  app.add_middleware(
      TrustedHostMiddleware,
      allowed_hosts=["api.manhwavault.com", "www.manhwavault.com"]
  )
  ```

---

## 📈 Release Notes Template

```markdown
# ManhwaVault v1.0.0

## Features
- [x] Multi-source manga search
- [x] Library management with persistence
- [x] Chapter reader with vertical/horizontal modes
- [x] Extension system for custom scrapers
- [x] Dark/Light theme support
- [x] Reading progress tracking

## Bug Fixes
- [x] Fixed Metro cache corruption
- [x] Fixed API timeout handling
- [x] Fixed theme switching on some devices

## Known Issues
- [ ] Offline mode not yet implemented
- [ ] Bookmarks feature coming soon

## Minimum Requirements
- iOS 14+
- Android 7+
```

---

## 🎯 Post-Launch Checklist

- [ ] Monitor app store reviews
- [ ] Track crash reports (Sentry)
- [ ] Monitor API performance (Datadog/Prometheus)
- [ ] Plan v1.1 features based on feedback
- [ ] Setup automated CI/CD for updates
- [ ] Create roadmap for future features

---

## 🔄 Continuous Deployment Setup

### GitHub Actions CI/CD
```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Deploy to VPS
        run: |
          ssh user@api.manhwavault.com
          cd manhwavault
          git pull origin main
          pip install -r requirements.txt
          systemctl restart manhwavault
```

---

## 💰 Cost Estimation (Monthly)

| Item | Cost |
|------|------|
| VPS (DigitalOcean) | $5-10 |
| Domain | $1 |
| SSL (Let's Encrypt) | $0 |
| Monitoring (Sentry) | Free (100k errors/mo) |
| Total | **$6-11/month** |

*Third-party scrapers may have rate limits that require premium hosting*

---

## ✅ Phase 4 Sign-Off Criteria

**Before Launch:**
- [ ] Both app stores approve app
- [ ] Backend is deployed and tested
- [ ] Custom domain configured
- [ ] HTTPS working correctly
- [ ] App connects to production backend
- [ ] Monitoring setup complete
- [ ] Error tracking functional
- [ ] Rate limiting configured
- [ ] Database backups automated
- [ ] Release notes published

**After Launch:**
- [ ] Monitor crash reports for 24 hours
- [ ] Respond to reviews within 48 hours
- [ ] Track user feedback
- [ ] Plan v1.1 roadmap

**Success:** 100+ downloads within 1 week

---

## 🎉 Deployment Checklist

```bash
# Final pre-launch verification
- [ ] Backend responding on https://api.manhwavault.com
- [ ] Mobile app builds without errors
- [ ] TestFlight/Play Console builds uploaded
- [ ] Release notes finalized
- [ ] All links in app settings working
- [ ] Privacy policy accessible
- [ ] Support email configured
- [ ] Monitoring dashboards configured
- [ ] First backup verified
- [ ] Team invited to TestFlight/internal testing
```

**READY TO LAUNCH! 🚀**
