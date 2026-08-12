<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>HirePath Pro</ion-title>
        <ion-buttons slot="end">
          <ion-button @click="dismiss">
            <ion-icon slot="icon-only" :icon="close" />
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <div class="paywall">
        <div class="pricing card">
          <p class="eyebrow">HirePath Pro</p>
          <h2 class="price"><span class="amount">KES 1</span><span class="period">/ month</span></h2>
          <p class="price-note">Unlimited AI practice. Cancel anytime.</p>
          <ul class="perks">
            <li><ion-icon :icon="checkmarkCircle" /> Unlimited practice sessions</li>
            <li><ion-icon :icon="checkmarkCircle" /> AI coaching feedback on your answers</li>
            <li><ion-icon :icon="checkmarkCircle" /> Follow-up questions to sharpen your responses</li>
            <li><ion-icon :icon="checkmarkCircle" /> Full session history and notes</li>
          </ul>
        </div>

        <ion-button expand="block" class="mpesa-btn" @click="openMpesa">
          <span class="mpesa-tag">Pay with</span>
          <svg viewBox="0 0 24 24" class="mpesa-logo" aria-hidden="true">
            <path fill="currentColor" d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm0 18c-4.4 0-8-3.6-8-8s3.6-8 8-8 8 3.6 8 8-3.6 8-8 8z" />
          </svg>
          M-Pesa
        </ion-button>

        <p class="fine-print">
          Payments are processed by Safaricom's M-Pesa. Subscription renews monthly; you can cancel
          anytime before renewal.
        </p>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { checkmarkCircle, close } from 'ionicons/icons';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonPage,
  IonTitle,
  IonToolbar,
  modalController,
} from '@ionic/vue';
import MpesaModal from '@/features/payments/components/MpesaModal.vue';

async function dismiss(): Promise<void> {
  await modalController.dismiss();
}

async function openMpesa(): Promise<void> {
  const modal = await modalController.create({
    component: MpesaModal,
  });
  await modal.present();
}
</script>

<style scoped>
.paywall {
  max-width: 440px;
  margin: 0 auto;
}

.card {
  background: var(--ion-card-background);
  border: 1px solid var(--ion-border-color);
  border-radius: 16px;
  padding: 22px;
  margin-top: 8px;
}

.eyebrow {
  margin: 0;
  font-size: 0.78rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--ion-color-secondary);
}

.price {
  margin: 8px 0 2px;
}

.amount {
  font-size: 2rem;
  font-weight: 700;
}

.period {
  font-size: 1rem;
  color: var(--ion-color-medium);
  font-weight: 500;
}

.price-note {
  margin: 0 0 14px;
  font-size: 0.88rem;
  color: var(--ion-color-medium);
}

.perks {
  list-style: none;
  padding: 0;
  margin: 0;
}

.perks li {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 0;
  font-size: 0.92rem;
}

.perks ion-icon {
  color: var(--ion-color-success);
  font-size: 1.1rem;
}

.mpesa-btn {
  margin-top: 18px;
  --border-radius: 12px;
  min-height: 52px;
  --background: #1dad5f;
  --background-hover: #18a056;
  font-weight: 600;
  display: flex;
  align-items: center;
}

.mpesa-logo {
  width: 20px;
  height: 20px;
  margin: 0 6px;
}

.mpesa-tag {
  font-weight: 500;
}

.fine-print {
  margin: 14px 0 0;
  font-size: 0.75rem;
  line-height: 1.5;
  color: var(--ion-color-medium);
}
</style>
