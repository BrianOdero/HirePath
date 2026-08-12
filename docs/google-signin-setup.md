# Phase C — Google Sign-In Setup Guide

The app code is Google-ready:

- `GoogleSignInButton.vue` + `useGoogleAuth` (`@capawesome/capacitor-google-sign-in`): native Google Sign-In on Android, OAuth redirect flow on the web.
- `useAuthStore.signInWithGoogleIdToken` exchanges the Google ID token for a Supabase session (`auth.signInWithIdToken`).
- Web flow: Google redirects back to `http://localhost:5173/login#id_token=...`, and `LoginView.vue` picks it up via `handleRedirectCallback()` in `onMounted`.
- Client reads `VITE_GOOGLE_WEB_CLIENT_ID` from `.env` (currently empty). If only `VITE_GOOGLE_CLIENT_ID` is set, it is used as a fallback.

Two sides must be configured: **Google Cloud Console** (create the OAuth client) and **Supabase dashboard** (enable the Google provider). Roughly 10 minutes.

---

## 1. Google Cloud Console — create OAuth client

1. Open https://console.cloud.google.com and select (or create) a project for HirePath.
2. Configure the **OAuth consent screen** (APIs & Services → OAuth consent screen):
   - User type: **External** (fine for dev).
   - App name: `HirePath`, support email: yours.
   - Scopes: defaults are fine.
   - Test users: add *your own* Google account (until the app is verified/published, only test users can sign in).
3. **Credentials → Create credentials → OAuth client ID**:
   - Application type: **Web application**.
   - **Authorized JavaScript origins**: `http://localhost:5173`
   - **Authorized redirect URIs**: `http://localhost:5173/login`
     (This is the web flow redirect used by capawesome: `siteUrl + /login`.)
   - Create → copy the **Client ID** and **Client secret**.

> Android (later, for the native app): create a *second* credential of type **Android**, using your app's package name (`io.ionic.starter` unless changed) + the SHA-1 of your debug keystore. Not needed yet — web-only dev.

## 2. Supabase dashboard — enable Google provider

1. Open https://supabase.com/dashboard/project/vdrdistisykdigqilnpc/auth/providers
2. **Google → Enable** and paste:
   - **Client ID** = the Web client's Client ID
   - **Client Secret** = its Client secret
3. Save.

## 3. Local `.env`

Add the Web client's Client ID (not the secret — it must never ship in a client app):

```
VITE_GOOGLE_WEB_CLIENT_ID=1234567890-abcd.apps.googleusercontent.com
```

## 4. Verify

```bash
npm run dev    # http://localhost:5173
```

Log out, tap **Continue with Google** → consent screen → back on `/login` you
should be signed in with your profile name shown on the Practice tab.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `redirect_uri_mismatch` | The allowed redirect URI must exactly match `http://localhost:5173/login` in Google Console. |
| "Error 403: access_configured" | Your account isn't in **Test users** (step 2), or consent screen is in a bad state. |
| Supabase `invalid_claims` / token errors | Provider Client ID/Secret mis-pasted, or the Supabase Google provider wasn't saved. |
| Config error button in app | `VITE_GOOGLE_WEB_CLIENT_ID` (and `VITE_GOOGLE_CLIENT_ID` fallback) still empty in `.env`. |
| Sign-in works on web but `GoogleSignIn` errors on Android | Android credential (package + SHA-1) missing in Google Console — defer to the native build phase |