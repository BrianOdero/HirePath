import { Capacitor } from '@capacitor/core';
import { useRouter } from 'vue-router';
import { GoogleSignIn } from '@capawesome/capacitor-google-sign-in';
import { useAuthStore } from '../stores/useAuthStore';

const legacyClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
const clientId = (import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID as string | undefined) ?? legacyClientId;
const siteUrl = (import.meta.env.VITE_SITE_URL as string | undefined) ?? window.location.origin;

export function useGoogleAuth() {
  const router = useRouter();

  async function initialize(): Promise<void> {
    if (!clientId) throw new Error('Google sign-in is not configured. Set VITE_GOOGLE_WEB_CLIENT_ID in .env');
    await GoogleSignIn.initialize({
      clientId,
      redirectUrl: `${siteUrl}/login`,
    });
  }

  async function signInWithGoogle(): Promise<void> {
    const authStore = useAuthStore();
    await initialize();
    if (Capacitor.isNativePlatform()) {
      const result = await GoogleSignIn.signIn();
      await authStore.signInWithGoogleIdToken(result.idToken);
      await router.push('/tabs/tab1');
      return;
    }
    await GoogleSignIn.signIn();
  }

  async function handleRedirectCallback(): Promise<void> {
    if (Capacitor.isNativePlatform()) return;
    if (!window.location.hash.includes('id_token')) return;
    const authStore = useAuthStore();
    await initialize();
    const result = await GoogleSignIn.handleRedirectCallback();
    await authStore.signInWithGoogleIdToken(result.idToken);
    await router.push('/tabs/tab1');
  }

  return {
    configured: Boolean(clientId),
    signInWithGoogle,
    handleRedirectCallback,
  };
}
