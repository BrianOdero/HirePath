<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button default-href="/tabs/tab3" />
        </ion-buttons>
        <ion-title>Payments</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content :fullscreen="true" class="ion-padding">
      <ion-refresher slot="fixed" @ion-refresh="onRefresh">
        <ion-refresher-content refreshing-text="Refreshing…" pulling-text="Pull to refresh" />
      </ion-refresher>

      <div v-if="isLoading" class="ion-padding-top">
        <div v-for="n in 4" :key="n" class="row-skeleton">
          <ion-skeleton-text animated style="width: 85%" />
          <ion-skeleton-text animated style="width: 45%" />
        </div>
      </div>

      <template v-else-if="payments?.length">
        <section class="summary card">
          <div class="summary-main">
            <span class="summary-label">Total paid</span>
            <span class="summary-total">KES {{ totalPaid }}</span>
            <span class="summary-count">{{ payments.length }} transaction{{ payments.length === 1 ? '' : 's' }}</span>
          </div>
          <div class="summary-stats">
            <span class="stat stat-paid">{{ counts.paid ?? 0 }} paid</span>
            <span class="stat stat-pending">{{ counts.pending ?? 0 }} pending</span>
            <span class="stat stat-failed">{{ counts.failed ?? 0 }} failed</span>
            <span class="stat">{{ counts.expired ?? 0 }} expired</span>
          </div>
          <ion-button expand="block" class="report-btn" :disabled="reporting" @click="downloadReport">
            <ion-spinner v-if="reporting" name="crescent" />
            <ion-icon v-else slot="start" :icon="downloadOutline" />
            {{ reporting ? 'Generating PDF…' : 'Download PDF report' }}
          </ion-button>
          <p v-if="reportError" class="report-error">{{ reportError }}</p>
        </section>

        <ion-list class="payments-list" :inset="false">
          <ion-item v-for="p in payments" :key="p.id" class="payment-row">
            <div class="payment-lines">
              <div class="line-top">
                <span class="amount">KES {{ p.amount }}</span>
                <ion-chip :class="['status-chip', `status-${p.status}`]" size="small">
                  <ion-label>{{ p.status }}</ion-label>
                </ion-chip>
              </div>
              <div class="line-meta">
                <span>{{ dateLabel(p.created_at) }}</span>
                <span class="dot">·</span>
                <span>+{{ p.phone }}</span>
              </div>
              <div class="line-ids">
                <span>Checkout: {{ shortId(p.checkout_request_id) }}</span>
                <span v-if="p.merchant_request_id">Merchant: {{ shortId(p.merchant_request_id) }}</span>
              </div>
              <p v-if="p.status === 'failed' && p.result_desc" class="result-desc">
                {{ p.result_desc }}
              </p>
            </div>
          </ion-item>
        </ion-list>
      </template>

      <div v-else class="empty">
        <ion-icon :icon="receiptOutline" />
        <h3>No payments yet</h3>
        <p>Upgrade to HirePath Pro and your M-Pesa transactions will show up here.</p>
        <ion-button router-link="/tabs/tab3" class="empty-btn">Go to Profile</ion-button>
      </div>
    </ion-content>

    <ion-toast
      :is-open="showToast"
      :message="toastMessage"
      :duration="4000"
      :color="toastColor"
      @did-dismiss="showToast = false"
    />
  </ion-page>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { downloadOutline, receiptOutline } from 'ionicons/icons';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonChip,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonPage,
  IonRefresher,
  IonRefresherContent,
  IonSkeletonText,
  IonSpinner,
  IonTitle,
  IonToast,
  IonToolbar,
} from '@ionic/vue';
import { usePayments } from '@/features/payments/composables/usePayments';
import { generatePaymentReportPdf } from '@/features/payments/services/pdfReport';
import type { PaymentStatus } from '@/core/services/paymentsApi';

const { data: payments, isLoading, refetch } = usePayments();
const reporting = ref(false);
const reportError = ref('');
const showToast = ref(false);
const toastMessage = ref('');
const toastColor = ref<'success' | 'danger'>('success');

const totalPaid = computed(() =>
  (payments.value ?? []).filter((p) => p.status === 'paid').reduce((sum, p) => sum + (p.amount ?? 0), 0)
);

const counts = computed(() =>
  (payments.value ?? []).reduce<Record<PaymentStatus, number>>(
    (acc, p) => {
      acc[p.status] += 1;
      return acc;
    },
    { pending: 0, paid: 0, failed: 0, expired: 0 }
  )
);

function dateLabel(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function shortId(id: string | null): string {
  const value = id ?? '—';
  if (value.length <= 24) return value;
  return `${value.slice(0, 10)}…${value.slice(-6)}`;
}

async function onRefresh(event: CustomEvent): Promise<void> {
  await refetch();
  (event.detail as { complete: () => void }).complete();
}

async function downloadReport(): Promise<void> {
  if (reporting.value) return;
  reporting.value = true;
  reportError.value = '';
  try {
    const { fileName } = await generatePaymentReportPdf();
    toastColor.value = 'success';
    toastMessage.value = `Payment report saved: ${fileName}`;
  } catch (err) {
    toastColor.value = 'danger';
    toastMessage.value = err instanceof Error ? err.message : 'Could not generate the report.';
  } finally {
    reporting.value = false;
    showToast.value = true;
  }
}
</script>

<style scoped>
.card {
  background: var(--ion-card-background);
  border: 1px solid var(--ion-border-color);
  border-radius: 16px;
  box-shadow: 0 1px 3px rgba(28, 36, 48, 0.06);
}

.summary {
  padding: 18px 18px 14px;
  margin-top: 4px;
}

.summary-label {
  display: block;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--ion-color-medium);
}

.summary-total {
  display: block;
  margin-top: 4px;
  font-size: 1.7rem;
  font-weight: 700;
  color: var(--ion-text-color);
}

.summary-count {
  display: block;
  margin-top: 2px;
  font-size: 0.8rem;
  color: var(--ion-color-medium);
}

.summary-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 14px 0 16px;
}

.stat {
  font-size: 0.78rem;
  font-weight: 600;
  padding: 4px 10px;
  border-radius: 999px;
  border: 1px solid var(--ion-border-color);
  color: var(--ion-color-medium);
}

.stat-paid {
  color: var(--ion-color-success);
  border-color: color-mix(in srgb, var(--ion-color-success) 45%, transparent);
}

.stat-pending {
  color: var(--ion-color-warning);
  border-color: color-mix(in srgb, var(--ion-color-warning) 45%, transparent);
}

.stat-failed {
  color: var(--ion-color-danger);
  border-color: color-mix(in srgb, var(--ion-color-danger) 45%, transparent);
}

.report-btn {
  --border-radius: 10px;
  min-height: 46px;
  font-weight: 600;
}

.report-error {
  margin: 10px 2px 0;
  font-size: 0.8rem;
  color: var(--ion-color-danger);
  text-align: center;
}

.payments-list {
  margin-top: 10px;
  background: transparent;
}

.payment-row {
  --padding-start: 16px;
  --padding-end: 16px;
  --padding-top: 6px;
  --padding-bottom: 6px;
  margin-bottom: 8px;
  border: 1px solid var(--ion-border-color);
  border-radius: 14px;
  background: var(--ion-card-background);
  --inner-border-width: 0;
}

.payment-lines {
  width: 100%;
  padding: 4px 0;
}

.line-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.amount {
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--ion-text-color);
}

.status-chip {
  margin: 0;
  height: 22px;
  font-weight: 600;
  --background: color-mix(in srgb, var(--ion-color-medium) 18%, transparent);
}

.status-paid {
  --background: color-mix(in srgb, var(--ion-color-success) 18%, transparent);
  color: var(--ion-color-success);
}

.status-pending {
  --background: color-mix(in srgb, var(--ion-color-warning) 18%, transparent);
  color: var(--ion-color-warning);
}

.status-failed {
  --background: color-mix(in srgb, var(--ion-color-danger) 18%, transparent);
  color: var(--ion-color-danger);
}

.line-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 4px;
  font-size: 0.82rem;
  color: var(--ion-color-medium);
}

.line-ids {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-top: 6px;
  font-size: 0.72rem;
  color: var(--ion-color-medium-tint, var(--ion-color-medium));
  font-family: var(--ion-font-family);
}

.result-desc {
  margin: 8px 0 0;
  font-size: 0.78rem;
  color: var(--ion-color-danger);
}

.row-skeleton {
  padding: 14px 16px;
  border: 1px solid var(--ion-border-color);
  border-radius: 14px;
  margin-bottom: 10px;
}

.empty {
  padding: 60px 24px;
  text-align: center;
}

.empty ion-icon {
  font-size: 3rem;
  color: var(--ion-color-medium);
}

.empty h3 {
  margin: 14px 0 6px;
  color: var(--ion-text-color);
}

.empty p {
  margin: 0 0 18px;
  font-size: 0.9rem;
  color: var(--ion-color-medium);
}

.empty-btn {
  --border-radius: 10px;
}
</style>