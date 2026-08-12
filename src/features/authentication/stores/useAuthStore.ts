import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/core/services/supabase';
import type { Profile } from '@/core/types';

const siteUrl = (import.meta.env.VITE_SITE_URL as string | undefined) ?? window.location.origin;

export const useAuthStore = defineStore('auth', () => {
  const session = ref<Session | null>(null);
  const user = ref<User | null>(null);
  const profile = ref<Profile | null>(null);
  const initialized = ref(false);
  const isRecoveringPassword = ref(false);

  async function fetchProfile(): Promise<void> {
    const id = user.value?.id;
    if (!id) {
      profile.value = null;
      return;
    }
    try {
      const { data } = await supabase.from('profiles').select('*').eq('id', id).maybeSingle();
      profile.value = (data as Profile | null) ?? null;
    } catch (error) {
      console.warn('Failed to load profile (profiles table may not exist yet):', error);
      profile.value = null;
    }
  }

  async function ensureSession(): Promise<void> {
    if (initialized.value) return;
    const { data } = await supabase.auth.getSession();
    session.value = data.session;
    user.value = data.session?.user ?? null;
    if (user.value) await fetchProfile();
    initialized.value = true;
  }

  async function signInWithEmail(email: string, password: string): Promise<void> {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    session.value = data.session;
    user.value = data.user;
    await fetchProfile();
  }

  async function signUpWithEmail(email: string, password: string, fullName?: string): Promise<void> {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName?.trim() || null,
        },
      },
    });
    if (error) throw error;
    if (data.session) {
      session.value = data.session;
      user.value = data.user;
      await fetchProfile();
    }
  }

  async function signInWithGoogleIdToken(idToken: string): Promise<void> {
    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'google',
      token: idToken,
    });
    if (error) throw error;
    session.value = data.session;
    user.value = data.user;
    await fetchProfile();
  }

  async function resendEmailConfirmation(email: string): Promise<void> {
    const { error } = await supabase.auth.resend({ type: 'signup', email });
    if (error) throw error;
  }

  async function requestPasswordReset(email: string): Promise<void> {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${siteUrl}/reset-password`,
    });
    if (error) throw error;
  }

  async function updatePassword(newPassword: string): Promise<void> {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
  }

  async function signOut(): Promise<void> {
    await supabase.auth.signOut();
    session.value = null;
    user.value = null;
    profile.value = null;
  }

  supabase.auth.onAuthStateChange((event, newSession) => {
    session.value = newSession;
    user.value = newSession?.user ?? null;
    isRecoveringPassword.value = event === 'PASSWORD_RECOVERY';
    if (newSession) {
      void fetchProfile();
    } else {
      profile.value = null;
    }
  });

  const displayName = computed(() => {
    const metadataName = user.value?.user_metadata?.full_name as string | undefined;
    return profile.value?.full_name ?? metadataName?.trim() ?? null;
  });

  return {
    session,
    user,
    profile,
    displayName,
    initialized,
    isRecoveringPassword,
    ensureSession,
    signInWithEmail,
    signUpWithEmail,
    signInWithGoogleIdToken,
    resendEmailConfirmation,
    requestPasswordReset,
    updatePassword,
    signOut,
  };
});
