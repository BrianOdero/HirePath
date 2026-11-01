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
            <ion-icon :icon="briefcase" />
          </div>
          <h1>Reset your password</h1>
          <p>Enter the email linked to your HirePath account and we'll send you a reset link.</p>
        </header>

        <section class="card">
          <div v-if="sent" class="sent-state">
            <ion-icon :icon="mailOutline" class="sent-icon" />
            <h2>Check your inbox</h2>
            <p>
              We emailed a password reset link to <strong>{{ email.trim() }}</strong>. Use it
              within the next few hours to choose a new password.
            </p>
            <ion-button expand="block" fill="outline" class="action-btn" @click="goToLogin">
              Back to sign in
            </ion-button>
          </div>

          <form v-else @submit.prevent="handleSubmit" novalidate>
            <div class="field">
              <ion-label class="field-label">Email</ion-label>
              <div class="input-wrap" :class="{ 'has-error': errors.email }">
                <ion-input
                  v-model="email"
                  type="email"
                  autocomplete="email"
                  placeholder="you@example.com"
                  aria-label="Email"
                  @ion-input="clearError"
                />
              </div>
              <p v-if="errors.email" class="field-error">{{ errors.email }}</p>
            </div>

            <ion-text v-if="formError" color="danger">
              <p class="form-error">{{ formError }}</p>
            </ion-text>

            <ion-button expand="block" type="submit" :disabled="loading" class="submit-btn">
              <ion-spinner v-if="loading" name="crescent" />
              <span v-else>Send reset link</span>
            </ion-button>
          </form>
        </section>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { arrowBack, briefcase, mailOutline } from 'ionicons/icons';
import { IonButton, IonContent, IonIcon, IonInput, IonLabel, IonPage, IonSpinner, IonText } from '@ionic/vue';
import { useAuthStore } from '../stores/useAuthStore';
import { authErrorMessage } from '../utils/authErrors';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const router = useRouter();
const authStore = useAuthStore();
const email = ref('');
const loading = ref(false);
const sent = ref(false);
const formError = ref('');
const errors = ref<{ email?: string }>({});

function clearError() {
  errors.value = {};
  formError.value = '';
}

function validate(): boolean {
  const trimmed = email.value.trim();
  const next: typeof errors.value = {};
  if (!trimmed) {
    next.email = 'Enter your email address.';
  } else if (!EMAIL_PATTERN.test(trimmed)) {
    next.email = 'Enter a valid email address, e.g. you@example.com.';
  }
  errors.value = next;
  return Object.values(next).every((message) => !message);
}

async function handleSubmit() {
  formError.value = '';
  if (!validate()) return;
  loading.value = true;
  try {
    await authStore.requestPasswordReset(email.value.trim());
    sent.value = true;
  } catch (err) {
    formError.value = authErrorMessage(err);
  } finally {
    loading.value = false;
  }
}

function goToLogin() {
  void router.push('/login');
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
  margin: 0 0 8px;
  font-size: 1.6rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--ion-text-color);
}

.head p {
  margin: 0;
  font-size: 0.9rem;
  line-height: 1.5;
  color: var(--ion-color-medium);
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

.sent-state {
  text-align: center;
  padding: 8px 4px;
}

.sent-icon {
  font-size: 2.6rem;
  color: var(--ion-color-primary);
  margin-bottom: 12px;
}

.sent-state h2 {
  margin: 0 0 8px;
  font-size: 1.2rem;
  color: var(--ion-text-color);
}

.sent-state p {
  margin: 0 0 20px;
  font-size: 0.9rem;
  line-height: 1.5;
  color: var(--ion-color-medium);
}

.action-btn {
  --border-radius: 10px;
  min-height: 48px;
}
</style>