<template>
  <ion-page>
    <ion-content :fullscreen="true">
      <div class="login-container">
        <header class="brand">
          <div class="logo">
            <ion-icon :icon="briefcase" />
          </div>
          <h1>HirePath</h1>
          <p>Practice with tailored interview questions. Get feedback. Land the job.</p>
        </header>

        <section class="card">
          <AuthForm />
          <div class="divider"><span>or continue with</span></div>
          <GoogleSignInButton />
        </section>

        <footer class="fine-print">
          <p>By continuing, you agree to HirePath's Terms of Service and Privacy Policy.</p>
        </footer>
      </div>
    </ion-content>

    <ion-toast
      :is-open="showResetToast"
      :message="resetToastMessage"
      :duration="5000"
      color="success"
      @did-dismiss="showResetToast = false"
    />
  </ion-page>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { briefcase } from 'ionicons/icons';
import { IonContent, IonIcon, IonPage, IonToast } from '@ionic/vue';
import AuthForm from '@/features/authentication/components/AuthForm.vue';
import GoogleSignInButton from '@/features/authentication/components/GoogleSignInButton.vue';
import { useGoogleAuth } from '@/features/authentication/composables/useGoogleAuth';

const route = useRoute();
const router = useRouter();
const showResetToast = ref(false);
let resetToastMessage = '';

const { handleRedirectCallback } = useGoogleAuth();

onMounted(() => {
  void handleRedirectCallback();
  if (route.query.reset === '1') {
    resetToastMessage = 'Password updated. Sign in with your new password.';
    showResetToast.value = true;
    void router.replace({ path: '/login', query: {} });
  }
});
</script>

<style scoped>
.login-container {
  max-width: 420px;
  margin: 0 auto;
  padding: 48px 24px 24px;
  min-height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.brand {
  text-align: center;
  margin-bottom: 32px;
}

.logo {
  width: 64px;
  height: 64px;
  margin: 0 auto 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 16px;
  background: var(--ion-color-primary);
  color: #fff;
}

.logo ion-icon {
  font-size: 1.9rem;
}

.brand h1 {
  margin: 0 0 8px;
  font-size: 1.9rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--ion-text-color);
}

.brand p {
  margin: 0;
  font-size: 0.95rem;
  line-height: 1.5;
  color: var(--ion-color-medium);
}

.card {
  background: var(--ion-card-background);
  border: 1px solid var(--ion-border-color);
  border-radius: 16px;
  padding: 24px 20px 16px;
  box-shadow: 0 1px 3px rgba(28, 36, 48, 0.06);
}

.divider {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 20px 0 16px;
  color: var(--ion-color-medium);
  font-size: 0.8rem;
}

.divider::before,
.divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--ion-border-color);
}

.fine-print {
  margin-top: auto;
  padding-top: 28px;
  text-align: center;
}

.fine-print p {
  margin: 0;
  font-size: 0.75rem;
  line-height: 1.5;
  color: var(--ion-color-medium);
}
</style>
