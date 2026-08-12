<template>
  <div class="google-wrap">
    <button class="google-btn" :disabled="!configured || loading" @click="handleSignIn">
      <span class="google-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="18" height="18">
          <path
            fill="#4285F4"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"
          />
          <path
            fill="#34A853"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"
          />
          <path
            fill="#FBBC05"
            d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z"
          />
          <path
            fill="#EA4335"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A11 11 0 0 0 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
          />
        </svg>
      </span>
      <span class="google-label">Continue with Google</span>
    </button>
    <p v-if="!configured" class="google-hint">
      Google sign-in will be available once VITE_GOOGLE_WEB_CLIENT_ID is configured.
    </p>
    <p v-if="error" class="google-error">{{ error }}</p>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useGoogleAuth } from '../composables/useGoogleAuth';

const { configured, signInWithGoogle } = useGoogleAuth();
const loading = ref(false);
const error = ref('');

async function handleSignIn() {
  if (!configured) return;
  loading.value = true;
  error.value = '';
  try {
    await signInWithGoogle();
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Google sign-in failed. Please try again.';
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.google-wrap {
  text-align: center;
}

.google-btn {
  width: 100%;
  min-height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  border: 1px solid var(--ion-border-color);
  border-radius: 10px;
  background: var(--ion-item-background);
  color: var(--ion-text-color);
  font-size: 0.95rem;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  transition: background 0.15s ease;
}

.google-btn:hover:not(:disabled) {
  background: var(--ion-color-light);
}

.google-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.google-hint {
  margin: 10px 0 0;
  font-size: 0.75rem;
  color: var(--ion-color-medium);
}

.google-error {
  margin: 10px 0 0;
  font-size: 0.8rem;
  color: var(--ion-color-danger);
}
</style>
