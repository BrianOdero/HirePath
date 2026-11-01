<template>
  <ion-page>
    <ion-content :fullscreen="true">
      <div class="page-container">
        <header class="head">
          <ion-button fill="clear" size="small" class="back-btn" @click="goToLogin">
            <ion-icon :icon="arrowBack" slot="start" />
            Back to sign in
          </ion-button>
          <div class="logo">
            <ion-icon :icon="lockClosed" />
          </div>
          <h1>Choose a new password</h1>
        </header>

        <section class="card">
          <div v-if="checking" class="checking-state">
            <ion-spinner name="crescent" />
            <p>Checking your reset link…</p>
          </div>

          <div v-else-if="expired" class="expired-state">
            <ion-icon :icon="alertCircleOutline" class="expired-icon" />
            <h2>Link invalid or expired</h2>
            <p>Password reset links expire after a few hours. Request a new one to continue.</p>
            <ion-button expand="block" class="action-btn" @click="goToForgotPassword">
              Request a new link
            </ion-button>
            <ion-button expand="block" fill="clear" class="action-btn secondary" @click="goToLogin">
              Back to sign in
            </ion-button>
          </div>

          <form v-else @submit.prevent="handleSubmit" novalidate>
            <div class="field">
              <ion-label class="field-label">New password</ion-label>
              <div class="input-wrap" :class="{ 'has-error': errors.password }">
                <ion-input
                  v-model="password"
                  type="password"
                  :clear-on-edit="false"
                  autocomplete="new-password"
                  placeholder="At least 8 characters"
                  aria-label="New password"
                  @ion-input="clearError('password')"
                >
                  <ion-input-password-toggle slot="end"></ion-input-password-toggle>
                </ion-input>
              </div>
              <p class="field-hint">Use at least 8 characters.</p>
              <p v-if="errors.password" class="field-error">{{ errors.password }}</p>
            </div>

            <div class="field">
              <ion-label class="field-label">Confirm password</ion-label>
              <div class="input-wrap" :class="{ 'has-error': errors.confirmPassword }">
                <ion-input
                  v-model="confirmPassword"
                  type="password"
                  :clear-on-edit="false"
                  autocomplete="new-password"
                  placeholder="Re-enter your password"
                  aria-label="Confirm password"
                  @ion-input="clearError('confirmPassword')"
                >
                  <ion-input-password-toggle slot="end"></ion-input-password-toggle>
                </ion-input>
              </div>
              <p v-if="errors.confirmPassword" class="field-error">{{ errors.confirmPassword }}</p>
            </div>

            <ion-text v-if="formError" color="danger">
              <p class="form-error">{{ formError }}</p>
            </ion-text>

            <ion-button expand="block" type="submit" :disabled="loading" class="submit-btn">
              <ion-spinner v-if="loading" name="crescent" />
              <span v-else>Update password</span>
            </ion-button>
          </form>
        </section>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { alertCircleOutline, arrowBack, lockClosed } from 'ionicons/icons';
import {
  IonButton,
  IonContent,
  IonIcon,
  IonInput,
  IonInputPasswordToggle,
  IonLabel,
  IonPage,
  IonSpinner,
  IonText,
} from '@ionic/vue';
import { useAuthStore } from '../stores/useAuthStore';
import { authErrorMessage } from '../utils/authErrors';

const router = useRouter();
const authStore = useAuthStore();
const checking = ref(true);
const expired = ref(false);
const password = ref('');
const confirmPassword = ref('');
const loading = ref(false);
const formError = ref('');
const errors = ref<{ password?: string; confirmPassword?: string }>({});

function clearError(field: keyof typeof errors.value) {
  errors.value[field] = undefined;
  formError.value = '';
}

function actuallyExpired(): void {
  clearInterval(pollId);
  checking.value = false;
  expired.value = true;
}

function onRecovery(): void {
  clearInterval(pollId);
  checking.value = false;
}

let pollId = -1;
onMounted(() => {
  if (authStore.isRecoveringPassword) {
    onRecovery();
    return;
  }
  pollId = window.setInterval(() => {
    if (authStore.isRecoveringPassword) {
      onRecovery();
    }
  }, 300);
  window.setTimeout(actuallyExpired, 10_000);
});

onBeforeUnmount(() => clearInterval(pollId));

function validate(): boolean {
  const next: typeof errors.value = {};
  if (!password.value) {
    next.password = 'Enter a new password.';
  } else if (password.value.length < 8) {
    next.password = 'Password must be at least 8 characters.';
  }
  if (!confirmPassword.value) {
    next.confirmPassword = 'Re-enter your password.';
  } else if (confirmPassword.value !== password.value) {
    next.confirmPassword = 'Passwords do not match.';
  }
  errors.value = next;
  return Object.values(next).every((message) => !message);
}

async function handleSubmit() {
  formError.value = '';
  if (!validate()) return;
  loading.value = true;
  try {
    await authStore.updatePassword(password.value);
    await authStore.signOut();
    errors.value = {};
    password.value = '';
    confirmPassword.value = '';
    await router.push({ path: '/login', query: { reset: '1' } });
  } catch (err) {
    formError.value = authErrorMessage(err);
  } finally {
    loading.value = false;
  }
}

function goToLogin() {
  void router.push('/login');
}

function goToForgotPassword() {
  void router.push('/forgot-password');
}
</script>

<style scoped>
.page-container {
  max-width: 420px;
  margin: 0 auto;
  padding: 40px 24px 24px;
  min-height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.head {
  margin-bottom: 24px;
}

.back-btn {
  margin: 0 0 20px -8px;
  --padding-start: 8px;
  --padding-end: 8px;
}

.logo {
  width: 56px;
  height: 56px;
  margin: 0 0 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 16px;
  background: var(--ion-color-primary);
  color: #fff;
}

.logo ion-icon {
  font-size: 1.7rem;
}

.head h1 {
  margin: 0;
  font-size: 1.6rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--ion-text-color);
}

.card {
  background: var(--ion-card-background);
  border: 1px solid var(--ion-border-color);
  border-radius: 16px;
  padding: 24px 20px;
  box-shadow: 0 1px 3px rgba(28, 36, 48, 0.06);
}

.field {
  margin-bottom: 18px;
}

.field-label {
  display: block;
  margin-bottom: 8px;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--ion-color-primary);
}

.input-wrap {
  position: relative;
  display: flex;
  align-items: center;
  border: 1px solid var(--ion-border-color);
  border-radius: 10px;
  background: var(--ion-item-background);
  overflow: hidden;
}

.input-wrap:focus-within {
  border-color: var(--ion-color-primary);
}

.input-wrap.has-error {
  border-color: var(--ion-color-danger);
}

.input-wrap ion-input {
  flex: 1;
  --padding-start: 14px;
  --padding-end: 8px;
  min-height: 48px;
}

.field-hint {
  margin: 6px 2px 0;
  font-size: 0.8rem;
  color: var(--ion-color-medium);
}

.field-error {
  margin: 6px 2px 0;
  font-size: 0.8rem;
  color: var(--ion-color-danger);
}

.form-error {
  margin: 0 0 10px;
  font-size: 0.85rem;
  color: var(--ion-color-danger);
}

.submit-btn {
  margin-top: 8px;
  --border-radius: 10px;
  min-height: 48px;
  font-weight: 600;
}

.checking-state {
  text-align: center;
  padding: 16px 4px;
}

.checking-state p {
  margin: 12px 0 0;
  font-size: 0.85rem;
  color: var(--ion-color-medium);
}

.expired-state {
  text-align: center;
  padding: 8px 4px;
}

.expired-icon {
  font-size: 2.6rem;
  color: var(--ion-color-warning);
  margin-bottom: 12px;
}

.expired-state h2 {
  margin: 0 0 8px;
  font-size: 1.2rem;
  color: var(--ion-text-color);
}

.expired-state p {
  margin: 0 0 20px;
  font-size: 0.9rem;
  line-height: 1.5;
  color: var(--ion-color-medium);
}

.action-btn {
  --border-radius: 10px;
  min-height: 48px;
}

.action-btn.secondary {
  --color: var(--ion-color-medium);
}
</style>