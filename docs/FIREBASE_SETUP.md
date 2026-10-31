# Firebase CI/CD Setup Guide

Quick setup guide for the HirePath Firebase CI/CD pipeline with Crashlytics and Performance Monitoring.

---

## What's Included

✅ **Automated Testing** - Runs ESLint, unit tests, and build verification on every push to main  
✅ **Firebase App Distribution** - Automatically distributes debug APK to testers  
✅ **Firebase Crashlytics** - Real-time crash reporting and analysis  
✅ **Firebase Performance Monitoring** - App performance tracking and insights  

---

## Setup Steps

### 1. Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project" or select existing project
3. Enter project name (e.g., "HirePath")
4. Enable Google Analytics (recommended)
5. Create project

### 2. Add Android App to Firebase

1. In Firebase Console, click "Add app" → Android icon
2. Register app:
   - **Android package name**: `io.ionic.starter`
   - **App nickname**: HirePath (optional)
   - **Debug signing certificate SHA-1**: Optional for now
3. Download `google-services.json`
4. Place it in `android/app/google-services.json`

### 3. Enable Firebase Services

In Firebase Console, enable these services:

#### Crashlytics
1. Go to **Crashlytics** in left menu
2. Click "Enable Crashlytics"
3. Follow setup wizard

#### Performance Monitoring
1. Go to **Performance** in left menu
2. Click "Get started"
3. Enable Performance Monitoring

#### App Distribution
1. Go to **App Distribution** in left menu
2. Click "Get started"
3. Add testers or create tester groups:
   - Click "Testers & Groups"
   - Create group called "testers"
   - Add tester email addresses

### 4. Get Firebase Credentials

#### Firebase App ID
1. Firebase Console → Project Settings → General
2. Scroll to "Your apps"
3. Copy **App ID** (format: `1:123456789:android:abcdef123456`)

#### Firebase Token (for CI/CD)
```bash
# Install Firebase CLI
npm install -g firebase-tools

# Login and generate token
firebase login:ci
```
Copy the token displayed (starts with `1//`)

### 5. Configure GitHub Secrets

Go to your GitHub repository:
1. **Settings** → **Secrets and variables** → **Actions**
2. Click **"New repository secret"**
3. Add these secrets:

| Secret Name | Value | How to Get |
|------------|-------|------------|
| `GOOGLE_SERVICES_JSON` | Full contents of `google-services.json` | Copy entire file content |
| `FIREBASE_APP_ID` | Firebase App ID | From Firebase Console → Project Settings |
| `FIREBASE_TOKEN` | Firebase CI token | Run `firebase login:ci` |

#### Adding GOOGLE_SERVICES_JSON:
```bash
# Display the file content
cat android/app/google-services.json

# Copy the ENTIRE output including all brackets and quotes
# Paste into GitHub Secret value field
```

### 6. Install Local Dependencies

```bash
# Install Ruby dependencies for Fastlane
bundle install

# Install npm dependencies (if not already done)
npm install
```

### 7. Test Locally (Optional)

```bash
# Test the pipeline locally
bundle exec fastlane android test

# Test Firebase deployment (requires google-services.json)
# Set environment variables first:
export FIREBASE_APP_ID="your-app-id"
export FIREBASE_TOKEN="your-token"

bundle exec fastlane android deploy_firebase
```

---

## How It Works

### Automatic Pipeline (Push to Main)

When you push to the `main` branch:

1. **Checkout** - Gets your code
2. **Setup** - Installs Node.js 20, Java 17, Ruby 3.2
3. **Install** - Installs dependencies
4. **Test** - Runs:
   - ESLint (code quality)
   - Unit tests (vitest)
   - TypeScript build (production build)
5. **Configure** - Creates `google-services.json` from secret
6. **Deploy** - Builds debug APK and uploads to Firebase App Distribution
7. **Archive** - Saves APK as GitHub artifact
8. **Cleanup** - Removes `google-services.json`

### Firebase App Distribution

- Testers receive email notification when new build is ready
- Download APK directly from email or Firebase Console
- View release notes with build timestamp
- Install on Android devices (enable "Install from unknown sources")

---

## Firebase Integration in Your App

### Crashlytics (Crash Reporting)

Crashes are automatically reported. Firebase SDK is already configured in `android/app/build.gradle`.

To add manual error logging (optional), install Capacitor plugin:

```bash
npm install @capacitor-firebase/crashlytics
npx cap sync
```

Then use in your code:

```typescript
import { FirebaseCrashlytics } from '@capacitor-firebase/crashlytics';

// Log custom error
await FirebaseCrashlytics.recordException({
  message: 'Payment failed',
  stacktrace: error.stack
});

// Set user ID for crash reports
await FirebaseCrashlytics.setUserId({ userId: user.id });

// Add custom key-value data
await FirebaseCrashlytics.setCustomKey({
  key: 'user_tier',
  value: 'pro',
  type: 'string'
});
```

### Performance Monitoring

Automatically tracks:
- App startup time
- Screen rendering performance  
- Network requests (HTTP/HTTPS)

For custom metrics (optional), install plugin:

```bash
npm install @capacitor-firebase/performance
npx cap sync
```

Use in code:

```typescript
import { FirebasePerformance } from '@capacitor-firebase/performance';

// Start custom trace
await FirebasePerformance.startTrace({ traceName: 'generate_questions' });

// ... your code ...

// Stop trace
await FirebasePerformance.stopTrace({ traceName: 'generate_questions' });
```

---

## View Your Data

### Crashlytics Dashboard
https://console.firebase.google.com/project/YOUR_PROJECT/crashlytics

- View crash-free users percentage
- See crash details with stack traces
- Filter by app version, device, OS version
- Track crash trends over time

### Performance Dashboard
https://console.firebase.google.com/project/YOUR_PROJECT/performance

- Monitor app startup time
- View screen rendering performance
- Check network request durations
- Track custom traces

### App Distribution
https://console.firebase.google.com/project/YOUR_PROJECT/appdistribution

- View all releases
- See download statistics
- Manage testers and groups
- View release notes

---

## Testing the Pipeline

### First Deploy

1. Commit your changes:
```bash
git add .
git commit -m "feat: add Firebase CI/CD pipeline"
git push origin main
```

2. Watch the GitHub Action:
   - Go to repository → **Actions** tab
   - Click on the running workflow
   - Monitor each step in real-time

3. Check Firebase App Distribution:
   - Testers receive email notification
   - APK available for download
   - Install and test on Android device

### Force a Test Crash (Development)

To verify Crashlytics is working:

```typescript
// In your code (development only)
if (import.meta.env.DEV) {
  throw new Error('Test crash for Firebase Crashlytics');
}
```

After crash, check Firebase Console → Crashlytics (may take 5-10 minutes to appear).

---

## Fastlane Commands

```bash
# Run tests only
bundle exec fastlane android test

# Build and deploy to Firebase
bundle exec fastlane android deploy_firebase
```

---

## Troubleshooting

### "google-services.json not found"

**Problem**: Pipeline fails looking for Firebase config.

**Solution**: 
1. Verify `GOOGLE_SERVICES_JSON` secret exists in GitHub
2. Ensure you copied the ENTIRE file content including brackets
3. Test locally: `cat android/app/google-services.json | jq .`

### "Firebase token invalid or expired"

**Problem**: `FIREBASE_TOKEN` is expired.

**Solution**:
```bash
firebase login:ci
# Copy new token and update GitHub secret
```

### "App ID not found"

**Problem**: Wrong `FIREBASE_APP_ID`.

**Solution**:
1. Go to Firebase Console → Project Settings
2. Find your Android app
3. Copy the App ID (format: `1:123456789:android:abcdef`)
4. Update GitHub secret

### Crashlytics not showing crashes

**Possible causes**:
- Wait 5-10 minutes for first crash to appear
- Ensure app has `google-services.json` 
- Check app is using release or debug build (not running in IDE)
- Verify Crashlytics is enabled in Firebase Console

### Can't find testers group

**Solution**:
1. Go to Firebase Console → App Distribution
2. Click "Testers & Groups"
3. Create group named "testers" (lowercase)
4. Add tester emails

---

## File Structure

```
HirePath/
├── .github/
│   └── workflows/
│       └── firebase-deploy.yml    # GitHub Actions workflow
├── fastlane/
│   ├── Appfile                     # App configuration
│   └── Fastfile                    # Automation lanes
├── android/
│   ├── build.gradle                # Added Firebase Crashlytics plugin
│   └── app/
│       ├── build.gradle            # Added Firebase dependencies
│       └── google-services.json    # Firebase config (not in git)
├── Gemfile                         # Ruby dependencies
└── docs/
    └── FIREBASE_SETUP.md           # This file
```

---

## Security Notes

⚠️ **Never commit these files:**
- `google-services.json` (use GitHub Secrets)
- Firebase service account keys
- API tokens

✅ **Safe to commit:**
- GitHub Actions workflow files
- Fastlane configuration files
- This documentation

---

## Next Steps

After setup:

1. ✅ Push to main and verify pipeline runs
2. ✅ Check Firebase App Distribution for build
3. ✅ Test app installation on Android device
4. ✅ Verify Crashlytics dashboard shows data
5. ✅ Check Performance Monitoring metrics
6. 📱 Share download link with testers
7. 🔍 Monitor crashes and performance in Firebase Console

---

## Support Resources

- [Firebase Documentation](https://firebase.google.com/docs)
- [Fastlane Documentation](https://docs.fastlane.tools/)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Capacitor Firebase Plugins](https://github.com/capawesome-team/capacitor-firebase)

---

## Questions?

Common questions:

**Q: How often does the pipeline run?**  
A: Every time you push to the `main` branch.

**Q: Can I run it manually?**  
A: Yes, go to GitHub Actions → Select workflow → "Run workflow" button.

**Q: How do testers get the app?**  
A: They receive an email with a download link from Firebase.

**Q: Is this for production releases?**  
A: No, this is for testing. For production, use Google Play Store deployment.

**Q: Does this use release signing?**  
A: No, uses debug builds for faster testing. Add signing for release builds.

**Q: How much does Firebase cost?**  
A: Firebase free tier includes Crashlytics, Performance, and App Distribution. Check [pricing](https://firebase.google.com/pricing) for limits.
