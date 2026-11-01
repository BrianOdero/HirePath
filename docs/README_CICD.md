# HirePath CI/CD Pipeline

Automated testing and Firebase deployment pipeline for HirePath.

## Quick Start

### Prerequisites
- GitHub repository with main branch
- Firebase project created
- Firebase CLI installed: `npm install -g firebase-tools`

### Setup (5 minutes)

1. **Get Firebase credentials:**
   ```bash
   firebase login:ci
   ```

2. **Add GitHub Secrets:**
   - Repository → Settings → Secrets → Actions
   - Add `GOOGLE_SERVICES_JSON` (copy android/app/google-services.json)
   - Add `FIREBASE_APP_ID` (from Firebase Console)
   - Add `FIREBASE_TOKEN` (from firebase login:ci)

3. **Push to main:**
   ```bash
   git push origin main
   ```

4. **Watch it work:**
   - GitHub → Actions tab → See pipeline running
   - Firebase Console → App Distribution → See new release

## What Happens on Every Push

```
Push to main
    ↓
Run Tests (lint, unit tests, build)
    ↓
Build Android APK
    ↓
Deploy to Firebase App Distribution
    ↓
Testers notified via email
```

## Pipeline Features

✅ Automated testing  
✅ Firebase App Distribution  
✅ Crashlytics crash reporting  
✅ Performance monitoring  
✅ Build artifacts saved  
✅ Automatic tester notifications  

## View Your App Data

- **Releases**: https://console.firebase.google.com/project/YOUR_PROJECT/appdistribution
- **Crashes**: https://console.firebase.google.com/project/YOUR_PROJECT/crashlytics
- **Performance**: https://console.firebase.google.com/project/YOUR_PROJECT/performance

## Local Testing

```bash
# Install dependencies
bundle install

# Run tests
bundle exec fastlane android test

# Deploy to Firebase (requires env vars)
export FIREBASE_APP_ID="your-app-id"
export FIREBASE_TOKEN="your-token"
bundle exec fastlane android deploy_firebase
```

## Full Documentation

See [docs/FIREBASE_SETUP.md](docs/FIREBASE_SETUP.md) for complete setup guide.

## Files Added

- `.github/workflows/firebase-deploy.yml` - GitHub Actions workflow
- `fastlane/Fastfile` - Deployment automation
- `fastlane/Appfile` - App configuration
- `Gemfile` - Ruby dependencies
- `docs/FIREBASE_SETUP.md` - Detailed setup guide

## Troubleshooting

**Pipeline fails with "google-services.json not found"**
- Add `GOOGLE_SERVICES_JSON` secret in GitHub

**"Firebase token invalid"**
- Regenerate: `firebase login:ci` and update secret

**Testers not receiving emails**
- Check Firebase Console → App Distribution → Testers & Groups
- Ensure "testers" group exists with email addresses

---

Ready to deploy? Push to main! 🚀
