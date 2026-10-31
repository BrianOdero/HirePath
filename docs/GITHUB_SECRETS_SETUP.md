# GitHub Secrets Setup Guide

This guide walks you through adding Supabase credentials as GitHub Secrets so the CI/CD pipeline can build the app with proper configuration.

## Why This Is Needed

The `.env` file containing your Supabase credentials is correctly excluded from Git (via `.gitignore`) for security. However, this means the CI/CD pipeline doesn't have access to these values when building the app.

By adding them as GitHub Secrets, the CI/CD workflow can inject them during the build process securely.

## Step-by-Step Instructions

### Step 1: Get Your Supabase Credentials

1. **Open your Supabase project settings:**
   - URL: https://supabase.com/dashboard/project/vdrdistisykdigqilnpc/settings/api

2. **Copy these values:**
   - **Project URL:** Should show `https://vdrdistisykdigqilnpc.supabase.co`
   - **anon public key:** A long JWT token starting with `eyJ...` (looks like: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`)

### Step 2: Add Secrets to GitHub Repository

1. **Go to your repository settings:**
   - URL: https://github.com/BrianOdero/HirePath/settings/secrets/actions

2. **Click "New repository secret"**

3. **Add each of the following secrets:**

#### Secret 1: VITE_SUPABASE_PROJECT_URL
- **Name:** `VITE_SUPABASE_PROJECT_URL`
- **Secret:** `https://vdrdistisykdigqilnpc.supabase.co`
- Click "Add secret"

#### Secret 2: VITE_SUPABASE_ANON_KEY
- **Name:** `VITE_SUPABASE_ANON_KEY`
- **Secret:** Paste the anon public key from your Supabase dashboard (the long `eyJ...` token)
- Click "Add secret"

#### Secret 3: VITE_SITE_URL
- **Name:** `VITE_SITE_URL`
- **Secret:** `http://localhost:5173`
  - (You can change this to your production URL later when you have one)
- Click "Add secret"

#### Secret 4: VITE_GOOGLE_WEB_CLIENT_ID (Optional)
- **Name:** `VITE_GOOGLE_WEB_CLIENT_ID`
- **Secret:** Leave empty for now, or add your Google OAuth client ID if you have one
- Click "Add secret"

### Step 3: Verify Secrets Are Added

After adding all secrets, you should see them listed at:
https://github.com/BrianOdero/HirePath/settings/secrets/actions

You should see:
- ✅ VITE_SUPABASE_PROJECT_URL
- ✅ VITE_SUPABASE_ANON_KEY
- ✅ VITE_SITE_URL
- ✅ VITE_GOOGLE_WEB_CLIENT_ID (if added)

**Note:** You won't be able to view the secret values after adding them (GitHub hides them for security).

### Step 4: Trigger a New Build

The workflow change has already been pushed (commit 3a62c3d). Once you add the secrets:

1. **Option A: Push any commit to trigger the workflow**
   ```bash
   git commit --allow-empty -m "chore: trigger build with secrets"
   git push origin main
   ```

2. **Option B: Wait for the next regular commit** - The workflow will automatically use the secrets

3. **Monitor the build:**
   - Go to: https://github.com/BrianOdero/HirePath/actions
   - Click on the latest workflow run
   - Check that the "Create .env file" step succeeds
   - Wait for the build to complete and deploy to Firebase

### Step 5: Test the Deployed App

Once the build completes:

1. **Install the new build** from Firebase App Distribution
2. **Launch the app**
3. **Expected result:** You should see the login screen (no more white screen!)

### Troubleshooting

#### Build Still Fails with "Missing Supabase environment variables"
- Double-check that all secrets are added with the exact names above (case-sensitive)
- Verify the secret values are correct (especially the anon key)
- Re-run the workflow after adding/fixing secrets

#### App Still Shows White Screen
- Check Chrome DevTools logs (connect device, go to `chrome://inspect`)
- Look for console errors
- Verify the "Create .env file" step ran in the GitHub Actions logs

#### App Shows Red Error Screen
- This is good! It means the debugging is working
- Read the error message - it will tell you which variables are missing
- Add the missing secrets and rebuild

## How It Works

When the CI/CD workflow runs:

1. GitHub Actions checks out the code
2. The "Create .env file" step creates a `.env` file from secrets:
   ```bash
   echo "VITE_SUPABASE_PROJECT_URL=https://..." >> .env
   echo "VITE_SUPABASE_ANON_KEY=eyJ..." >> .env
   ```
3. `npm ci` installs dependencies
4. `npm run build` reads the `.env` file and embeds the values into the app
5. The built app has the credentials baked in
6. Capacitor syncs the build to Android
7. APK is built and deployed to Firebase

## Security Notes

- ✅ The anon key is safe to embed in the client app (it's meant to be public)
- ✅ Never commit the `.env` file to Git
- ✅ Never add the service role key as a secret (it's server-only)
- ✅ GitHub Secrets are encrypted and only visible to repository admins

## Next Steps

After the app is working:
1. Set up a proper production URL and update `VITE_SITE_URL`
2. Add Google OAuth client ID when ready for Google sign-in
3. Test authentication flows thoroughly
4. Monitor Supabase usage and set up proper database indexes
