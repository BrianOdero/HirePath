<template>
  <form @submit.prevent="handleSubmit" novalidate>
    <div v-if="isSignUp" class="field">
      <ion-label class="field-label">Full name</ion-label>
      <ion-input
        v-model="fullName"
        type="text"
        autocomplete="name"
        placeholder="e.g. Wanjiku Kamau"
        aria-label="Full name"
        :class="{ 'has-error': errors.fullName }"
        @ion-input="clearError('fullName')"
      />
      <p v-if="errors.fullName" class="field-error">{{ errors.fullName }}</p>
    </div>

    <div class="field">
      <ion-label class="field-label">Email</ion-label>
      <ion-input
        v-model="email"
        type="email"
        :class="{ 'has-error': errors.email }"
        autocomplete="email"
        placeholder="you@example.com"
        aria-label="Email"
        @ion-input="clearError('email')"
      />
      <p v-if="errors.email" class="field-error">{{ errors.email }}</p>
    </div>

    <div class="field">
      <ion-label class="field-label">Password</ion-label>
      <div class="input-wrap" :class="{ 'has-error': errors.password }">
        <ion-input
          v-model="password"
          type="password"
          :clear-on-edit="false"
          autocomplete="current-password"
          :placeholder="isSignUp ? 'At least 8 characters' : 'Your password'"
          aria-label="Password"
          @ion-input="clearError('password')"
        >
          <ion-input-password-toggle slot="end"></ion-input-password-toggle>
        </ion-input>
      </div>
      <p v-if="isSignUp" class="field-hint" :class="{ 'has-error': errors.password }">
        Use at least 8 characters.
      </p>
      <p v-if="errors.password" class="field-error">{{ errors.password }}</p>
      <div v-if="!isSignUp" class="password-row">
        <ion-button
          v-if="needsConfirmation"
          fill="clear"
          size="small"
          type="button"
          class="inline-action"
          :disabled="loading || resending"
          @click="handleResendConfirmation"
        >
          {{ resending ? 'Sending…' : 'Resend verification email' }}
        </ion-button>
        <span class="spacer" />
        <ion-button
          fill="clear"
          size="small"
          type="button"
          class="inline-action"
          @click="goToForgotPassword"
        >
          Forgot password?
        </ion-button>
      </div>
    </div>

    <div v-if="isSignUp" class="field">
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
      <span v-else>{{ isSignUp ? 'Create account' : 'Sign in' }}</span>
    </ion-button>

    <div class="switch-row">
      <span>{{ isSignUp ? 'Already have an account?' : 'New to HirePath?' }}</span>
      <ion-button fill="clear" size="small" type="button" :disabled="loading" @click="toggleMode">
        {{ isSignUp ? 'Sign in' : 'Create an account' }}
      </ion-button>
    </div>
  </form>

  <ion-toast
    :is-open="showToast"
    :message="toastMessage"
    :duration="4000"
    color="success"
    @did-dismiss="showToast = false"
  />
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import {
  IonButton,
  IonInput,
  IonInputPasswordToggle,
  IonLabel,
  IonSpinner,
  IonText,
  IonToast,
} from '@ionic/vue';
import { useAuthStore } from '../stores/useAuthStore';
import { authErrorMessage, isAuthErrorCode } from '../utils/authErrors';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const authStore = useAuthStore();
const router = useRouter();
const fullName = ref('');
const email = ref('');
const password = ref('');
const confirmPassword = ref('');
const isSignUp = ref(false);
const loading = ref(false);
const resending = ref(false);
const formError = ref('');
const showToast = ref(false);
const toastMessage = ref('');
const needsConfirmation = ref(false);

const errors = ref<{
  fullName?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
}>({});

function clearError(field: keyof typeof errors.value) {
  errors.value[field] = undefined;
  formError.value = '';
}

function toggleMode() {
  isSignUp.value = !isSignUp.value;
  errors.value = {};
  formError.value = '';
  needsConfirmation.value = false;
  confirmPassword.value = '';
}

function goToForgotPassword() {
  void router.push('/forgot-password');
}

function validate(): boolean {
  const next: typeof errors.value = {};
  const trimmedName = fullName.value.trim();
  const trimmedEmail = email.value.trim();

  if (isSignUp.value) {
    if (!trimmedName) {
      next.fullName = 'Enter your full name.';
    } else if (trimmedName.length < 2) {
      next.fullName = 'Name must be at least 2 characters.';
    }
  }

  if (!trimmedEmail) {
    next.email = 'Enter your email address.';
  } else if (!EMAIL_PATTERN.test(trimmedEmail)) {
    next.email = 'Enter a valid email address, e.g. you@example.com.';
  }

  if (!password.value) {
    next.password = 'Enter your password.';
  } else if (isSignUp.value && password.value.length < 8) {
    next.password = 'Password must be at least 8 characters.';
  }

  if (isSignUp.value) {
    if (!confirmPassword.value) {
      next.confirmPassword = 'Re-enter your password.';
    } else if (confirmPassword.value !== password.value) {
      next.confirmPassword = 'Passwords do not match.';
    }
  }

  errors.value = next;
  return Object.values(next).every((message) => !message);
}

async function handleResendConfirmation() {
  if (!email.value.trim()) return;
  resending.value = true;
  formError.value = '';
  try {
    await authStore.resendEmailConfirmation(email.value.trim());
    toastMessage.value = 'Verification email sent. Check your inbox.';
    showToast.value = true;
    needsConfirmation.value = false;
  } catch (err) {
    formError.value = authErrorMessage(err);
  } finally {
    resending.value = false;
  }
}

async function handleSubmit() {
  formError.value = '';
  needsConfirmation.value = false;
  if (!validate()) return;

  loading.value = true;
  try {
    if (isSignUp.value) {
      await authStore.signUpWithEmail(email.value.trim(), password.value, fullName.value);
      if (!authStore.user) {
        toastMessage.value = 'Account created! Check your inbox to confirm your email.';
        showToast.value = true;
        isSignUp.value = false;
        password.value = '';
        confirmPassword.value = '';
      } else {
        await router.push('/tabs/tab1');
      }
    } else {
      await authStore.signInWithEmail(email.value.trim(), password.value);
      await router.push('/tabs/tab1');
    }
  } catch (err) {
    needsConfirmation.value = isAuthErrorCode(err, 'email_not_confirmed');
    formError.value = authErrorMessage(err);
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
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

.field-error {
  margin: 6px 2px 0;
  font-size: 0.8rem;
  color: var(--ion-color-danger);
}

.field-hint {
  margin: 6px 2px 0;
  font-size: 0.8rem;
  color: var(--ion-color-medium);
}

.field-hint.has-error {
  color: var(--ion-color-danger);
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

.switch-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  margin-top: 4px;
  font-size: 0.85rem;
  color: var(--ion-color-medium);
}

.password-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 2px;
}

.password-row .spacer {
  flex: 1;
}

.password-row .inline-action {
  margin: 0;
  font-size: 0.8rem;
  --padding-start: 4px;
  --padding-end: 4px;
}
</style>
