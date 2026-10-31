# Troubleshooting White Screen Issues

This document helps diagnose and fix white screen issues in the HirePath Android app.

## Quick Checklist

1. **Environment Variables** - Most common cause
2. **Asset Loading** - Base path configuration
3. **JavaScript Errors** - Runtime crashes
4. **Network Issues** - Supabase connectivity

## How to Debug

### 1. Enable Chrome DevTools for Android

To see console logs and errors from your Android device:

1. Connect your Android device via USB
2. Enable USB debugging on your device
3. Open Chrome on your computer
4. Navigate to `chrome://inspect`
5. Find your device and click "inspect" on the HirePath WebView
6. Check the Console tab for errors

### 2. Check Environment Variables

**Symptom:** Red error screen saying "Configuration Error" with missing variables

**Cause:** The app was built without required Supabase credentials

**Fix:**
```bash
# 1. Verify your .env file exists and has values
cat .env

# 2. It should contain:
VITE_SUPABASE_PROJECT_URL=https://yourproject.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
VITE_SITE_URL=http://localhost:5173
VITE_GOOGLE_WEB_CLIENT_ID=your-google-client-id

# 3. Rebuild with the environment variables
npm run build

# 4. Sync to Android
npx cap sync android

# 5. Rebuild the APK (or let CI/CD do it)
cd android && ./gradlew assembleDebug
```

### 3. Check Asset Loading

**Symptom:** Blank white screen, no errors in console

**Cause:** Assets not loading due to incorrect base path

**Status:** ✅ Fixed in commit 6c1c061 (vite.config.ts now uses `base: './'`)

**Verify Fix:**
- Open `dist/index.html` after building
- All script/CSS src attributes should start with `./` not `/`
- Example: `<script src="./assets/index-xxx.js">` ✅
- Not: `<script src="/assets/index-xxx.js">` ❌

### 4. Check Router Navigation

**Symptom:** App loads but gets stuck after splash screen

**Cause:** Router navigation guard errors or infinite redirect loops

**Status:** ✅ Enhanced with try-catch and logging in commit (current)

**Debug:**
- Check Chrome DevTools console for "Router navigation to:" logs
- Look for "Router guard error:" messages
- Check if auth store is throwing errors

### 5. Common Error Messages

#### "Missing Supabase environment variables"
→ See section 2 above

#### "Failed to fetch" or network errors
→ Check that VITE_SUPABASE_PROJECT_URL is correct and reachable

#### "Router guard error"
→ Issue with authentication check, look at auth store logs

#### Blank white screen, no error messages
→ Check Chrome DevTools console (see section 1)

## Debug Logging Added

The app now includes extensive debug logging:

**In Console:**
- `=== HirePath Debug Info ===` - Shows location, base URL, mode
- `Supabase config check` - Shows if env vars are loaded
- `Router ready, initializing theme...` - App startup progress
- `Router navigation to: /path` - Every navigation attempt

**On Screen (when errors occur):**
- Configuration errors show full instructions
- Runtime errors display with stack traces
- Promise rejections are caught and displayed

## Testing Locally

Before pushing to CI/CD, test the build locally:

```bash
# Build the app
npm run build

# Sync to Capacitor
npx cap sync android

# Open in Android Studio
npx cap open android

# Run on device/emulator from Android Studio
# Check logs in Chrome DevTools (chrome://inspect)
```

## CI/CD Specific Issues

If the app works locally but fails from CI/CD builds:

1. **Environment variables not in GitHub Secrets**
   - Add VITE_* variables as repository secrets
   - Update `.github/workflows/firebase-deploy.yml` to pass them

2. **Build cache issues**
   - Clear GitHub Actions cache
   - Force rebuild with clean checkout

3. **Different Node/npm versions**
   - CI uses Node 22 (check workflow file)
   - Match locally: `nvm use 22`

## Still Having Issues?

1. Check Chrome DevTools console (most informative)
2. Look for visible error screens with red text
3. Check the build logs for TypeScript errors
4. Verify all dependencies installed: `npm ci`
5. Try a clean build: `rm -rf dist node_modules && npm install && npm run build`

## Files Modified for Debugging

- `src/debug-loader.ts` - Error catching and env var validation
- `src/main.ts` - Wrapped initialization in try-catch
- `src/router/index.ts` - Added logging to navigation guards
- `src/core/services/supabase.ts` - Graceful error display for config issues
