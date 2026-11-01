<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>Profile</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content :fullscreen="true" class="ion-padding">
      <div class="profile">
        <header class="account card">
          <div class="avatar">{{ initials }}</div>
          <div class="account-info">
            <h1>{{ displayName }}</h1>
            <p>{{ authStore.user?.email }}</p>
          </div>
        </header>

        <section class="plan card">
          <div class="plan-head">
            <span class="plan-name" :class="plan?.tier">{{ plan?.tier === 'pro' ? 'Pro plan' : 'Free plan' }}</span>
            <span v-if="plan?.tier === 'pro'" class="renew">Renews {{ renewDate }}</span>
          </div>
          <p class="plan-desc">
            {{ plan?.tier === 'pro'
              ? 'Unlimited sessions and AI coaching feedback.'
              : `${plan?.freeLimit ?? 3} free sessions per month.` }}
          </p>
          <ion-button
            v-if="plan?.tier !== 'pro'"
            expand="block"
            class="upgrade-btn"
            @click="openPaywall"
          >
            Upgrade to Pro — KES {{ plan?.proPriceKes }}/mo
          </ion-button>
        </section>

        <section class="usage card">
          <div class="usage-row">
            <span class="usage-label">Usage this month</span>
            <span class="usage-value">
              {{ plan?.tier === 'pro' ? 'Unlimited' : `${plan?.usedThisMonth ?? 0} / ${plan?.freeLimit ?? 3} sessions` }}
            </span>
          </div>
        </section>

        <section class="payments card" @click="goToPayments">
          <div class="section-head">
            <ion-icon :icon="receiptOutline" />
            <h2>Payments</h2>
            <ion-icon :icon="chevronForward" class="chevron" />
          </div>
          <p class="section-sub">Track M-Pesa transactions and download PDF reports.</p>
        </section>

        <section class="appearance card">
          <div class="section-head">
            <ion-icon :icon="contrastOutline" />
            <h2>Appearance</h2>
          </div>
          <div class="segment-wrap">
            <ion-segment :value="themeMode" @ion-change="onSegmentChange">
              <ion-segment-button value="light">
                <ion-label>Light</ion-label>
              </ion-segment-button>
              <ion-segment-button value="dark">
                <ion-label>Dark</ion-label>
              </ion-segment-button>
              <ion-segment-button value="system">
                <ion-label>System</ion-label>
              </ion-segment-button>
            </ion-segment>
          </div>
          <p class="system-hint">
            {{ themeMode === 'system'
              ? `Following your device (currently ${themeResolved})`
              : `Manual override set to ${themeMode[0].toUpperCase()}${themeMode.slice(1)}` }}
          </p>
        </section>

        <ion-button expand="block" fill="outline" class="signout-btn" @click="confirmSignOut">
          Sign out
        </ion-button>

        <p class="fine-print">HirePath v0.1 · Terms · Privacy</p>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { alertController } from '@ionic/vue';
import { chevronForward, contrastOutline, receiptOutline } from 'ionicons/icons';
import {
  IonButton,
  IonContent,
  IonHeader,
  IonIcon,
  IonLabel,
  IonPage,
  IonSegment,
  IonSegmentButton,
  IonTitle,
  IonToolbar,
} from '@ionic/vue';
import { useAuthStore } from '@/features/authentication/stores/useAuthStore';
import { useThemeStore, type ThemeMode } from '@/core/stores/useThemeStore';
import { usePlan } from '@/features/interview/composables/useInterviewQuery';
import { usePaywall } from '@/features/subscription/composables/usePaywall';

const router = useRouter();
const authStore = useAuthStore();
const themeStore = useThemeStore();
const { openPaywall } = usePaywall();
const { data: plan } = usePlan();

const displayName = computed(() => authStore.displayName ?? 'HirePath member');
const initials = computed(() => {
  const name = displayName.value;
  const parts = name.split(' ');
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase();
});
const themeMode = computed(() => themeStore.mode);
const themeResolved = computed(() => themeStore.resolved);

const renewDate = computed(() => {
  if (!plan.value?.renewsAt) return 'soon';
  return new Date(plan.value.renewsAt).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
  });
});

async function onSegmentChange(event: CustomEvent): Promise<void> {
  const value = event.detail?.value as ThemeMode;
  if (value) await themeStore.setMode(value);
}

function goToPayments(): void {
  void router.push('/payments');
}

async function confirmSignOut(): Promise<void> {
  const alert = await alertController.create({
    header: 'Sign out',
    message: 'Are you sure you want to sign out?',
    buttons: [
      { text: 'Cancel', role: 'cancel' },
      {
        text: 'Sign out',
        role: 'destructive',
        handler: async () => {
          await authStore.signOut();
          void router.push('/login');
        },
      },
    ],
  });
  await alert.present();
}
</script>

<style scoped>
.profile {
  max-width: 520px;
  margin: 0 auto;
  padding: 32px 0;
}

.card {
  background: var(--ion-card-background);
  border: 1px solid var(--ion-border-color);
  border-radius: 16px;
  padding: 18px;
  margin-bottom: 14px;
}

.account {
  display: flex;
  align-items: center;
  gap: 16px;
}

.avatar {
  width: 58px;
  height: 58px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--ion-color-primary);
  color: var(--ion-color-primary-contrast);
  font-size: 1.3rem;
  font-weight: 600;
}

.account-info h1 {
  margin: 0;
  font-size: 1.2rem;
}

.account-info p {
  margin: 2px 0 0;
  font-size: 0.88rem;
  color: var(--ion-color-medium);
}

.plan-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.plan-name {
  font-weight: 700;
  font-size: 1rem;
}

.plan-name.pro {
  color: var(--ion-color-secondary);
}

.renew {
  font-size: 0.8rem;
  color: var(--ion-color-medium);
}

.plan-desc {
  margin: 6px 0 14px;
  font-size: 0.9rem;
  color: var(--ion-color-medium);
}

.upgrade-btn {
  --border-radius: 12px;
  --background: var(--ion-color-secondary);
}

.usage-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}

.usage-label {
  font-weight: 600;
}

.usage-value {
  font-size: 0.88rem;
  color: var(--ion-color-medium);
}

.appearance .section-head {
  display: flex;
  align-items: center;
  gap: 8px;
}

.appearance .section-head ion-icon {
  color: var(--ion-color-primary);
  font-size: 1.2rem;
}

.appearance h2 {
  margin: 0;
  font-size: 1rem;
}

.payments {
  cursor: pointer;
}

.payments .section-head {
  display: flex;
  align-items: center;
  gap: 8px;
}

.payments .section-head ion-icon {
  color: var(--ion-color-primary);
  font-size: 1.2rem;
}

.payments .chevron {
  margin-left: auto;
  color: var(--ion-color-medium);
  font-size: 1rem;
}

.payments h2 {
  margin: 0;
  font-size: 1rem;
}

.section-sub {
  margin: 6px 0 0;
  font-size: 0.8rem;
  color: var(--ion-color-medium);
}

.segment-wrap {
  margin-top: 14px;
}

.system-hint {
  margin: 12px 0 0;
  font-size: 0.8rem;
  color: var(--ion-color-medium);
}

.signout-btn {
  margin-top: 8px;
  --border-radius: 12px;
}

.fine-print {
  text-align: center;
  font-size: 0.75rem;
  color: var(--ion-color-step-400);
  margin: 18px 0 0;
}
</style>
