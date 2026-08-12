<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>Pay with M-Pesa</ion-title>
        <ion-buttons slot="end">
          <ion-button @click="dismiss">
            <ion-icon slot="icon-only" :icon="close" />
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <div class="mpesa">
        <div class="amount-card">
          <p class="amount-label">HirePath Pro — monthly</p>
          <p class="amount">KES 1</p>
        </div>

        <div class="field">
          <ion-label class="field-label">M-Pesa phone number</ion-label>
          <div class="phone-wrap" :class="{ 'has-error': errors.phone }">
            <span class="prefix">+254</span>
            <ion-input
              v-model="phone"
              type="tel"
              inputmode="numeric"
              placeholder="712 345 678"
              aria-label="M-Pesa phone number"
              :disabled="status !== 'idle'"
              @ion-input="errors.phone = ''"
            />
          </div>
          <p v-if="errors.phone" class="field-error">{{ errors.phone }}</p>
        </div>

        <ion-text v-if="formError" color="danger">
          <p class="form-error">{{ formError }}</p>
        </ion-text>

        <ion-button
          v-if="status === 'idle'"
          expand="block"
          class="send-btn"
          :disabled="!phone.trim() || starting"
          @click="sendPush"
        >
          <ion-spinner v-if="starting" name="crescent" />
          <span v-else>Send STK push</span>
        </ion-button>

        <div v-if="status === 'pending'" class="state state-pending">
          <ion-spinner name="crescent" />
          <p>Check your phone and enter your M-Pesa PIN to approve the payment.</p>
        </div>

        <div v-if="status === 'success'" class="state state-success">
          <ion-icon :icon="checkmarkCircle" />
          <h3>Welcome to Pro!</h3>
          <p>Your subscription is active. Unlimited practice sessions are now unlocked.</p>
          <ion-button expand="block" class="done-btn" @click="startPractising">Start practising</ion-button>
          <ion-button expand="block" fill="clear" class="ghost-btn" @click="viewTransactions">
            View transactions
          </ion-button>
        </div>

        <div v-if="status === 'failed'" class="state state-failed">
          <ion-icon :icon="alertCircle" />
          <h3>Payment unsuccessful</h3>
          <p>{{ failureMessage }}</p>
          <ion-button expand="block" fill="outline" class="retry-btn" @click="status = 'idle'">
            Try again
          </ion-button>
          <p class="fine-print">Check your M-Pesa messages — if you paid, Pro will activate automatically.</p>
        </div>

        <p v-if="status === 'idle'" class="demo-note">
          Sandbox mode: M-Pesa prompts only reach registered test numbers. Live payments
          launch once the production shortcode is configured.
        </p>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue';
import { useRouter } from 'vue-router';
import { alertCircle, checkmarkCircle, close } from 'ionicons/icons';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonInput,
  IonLabel,
  IonPage,
  IonSpinner,
  IonText,
  IonTitle,
  IonToolbar,
  modalController,
} from '@ionic/vue';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@/core/services/supabase';
import { subscribeOnce } from '@/core/services/realtime';

type Status = 'idle' | 'pending' | 'success' | 'failed';

const PENDING_TIMEOUT_MS = 90_000;

const router = useRouter();
const phone = ref('');
const status = ref<Status>('idle');
const starting = ref(false);
const formError = ref('');
const failureMessage = ref('Your payment was not completed. You can try again — no charge was made.');
const errors = ref<{ phone?: string }>({});

let checkoutRequestId = '';
let paymentId = '';
let watchdogId = -1;
const paymentChannels = new Map<string, RealtimeChannel>();
let unsubscribePayment: (() => void) | null = null;

async function dismiss(): Promise<void> {
  if (status.value === 'pending' || starting.value) return;
  await modalController.dismiss();
}

function normalisePhone(raw: string): string | null {
  let digits = raw.replace(/\D/g, '');
  if (digits.startsWith('0')) digits = digits.slice(1);
  if (!/^7\d{8}$/.test(digits)) return null;
  return `254${digits}`;
}

async function invokeJsonError(err: unknown): Promise<string> {
  const candidate = err as { context?: { json?: () => Promise<{ error?: unknown }> } };
  if (typeof candidate?.context?.json === 'function') {
    try {
      const body = await candidate.context.json();
      if (typeof body?.error === 'string' && body.error) return body.error;
    } catch {
      /* fall back to message */
    }
  }
  return err instanceof Error ? err.message : 'Something went wrong. Please try again.';
}

function friendlyPushError(code: string): string {
  switch (code) {
    case 'daraja_push_failed':
      return "M-Pesa couldn't start the payment. Check the number and try again.";
    case 'daraja_token_failed':
      return 'Could not reach M-Pesa. Check your sandbox credentials.';
    case 'daraja_query_failed':
      return "M-Pesa didn't return a payment status. Try again in a moment.";
    case 'unauthorized':
      return 'Your session expired. Sign in again and retry.';
    case 'payment_insert_failed':
      return 'We could not record the payment. Please try again.';
    default:
      if (code.includes('Missing Deno env')) {
        return "Payments aren't fully configured on the server yet. Please try again later.";
      }
      return code.replace(/_/g, ' ');
  }
}

async function queryStatus(): Promise<void> {
  if (!checkoutRequestId) return;
  try {
    const { data, error } = await supabase.functions.invoke('stk-query', {
      method: 'POST',
      body: { checkoutRequestId },
    });
    if (error) throw error;
    const payment = (data as { payment?: { status?: string; resultDesc?: string | null } })?.payment;
    if (payment?.status === 'paid') {
      settleSuccess();
    } else if (payment?.status === 'failed') {
      settleFailed(payment.resultDesc ?? null);
    } else {
      settleUnresolved();
    }
  } catch {
    settleUnresolved();
  }
}

function settleSuccess(): void {
  clearWatchdog();
  status.value = 'success';
}

function settleFailed(resultDesc: string | null): void {
  clearWatchdog();
  status.value = 'failed';
  failureMessage.value =
    resultDesc ??
    'Your payment was not completed. You can try again — no charge was made.';
}

function settleUnresolved(): void {
  clearWatchdog();
  status.value = 'failed';
  failureMessage.value =
    "We haven't received confirmation from M-Pesa yet. If you entered your PIN, Pro will activate automatically — check M-Pesa messages.";
}

function clearWatchdog(): void {
  window.clearTimeout(watchdogId);
  watchdogId = -1;
}

function stopWatching(): void {
  clearWatchdog();
  if (unsubscribePayment) {
    unsubscribePayment();
    unsubscribePayment = null;
  }
}

async function watchPayment(): Promise<void> {
  stopWatching();
  unsubscribePayment = subscribeOnce(
    paymentChannels,
    paymentId,
    `payment:${paymentId}`,
    { event: '*', schema: 'public', table: 'payments', filter: `id=eq.${paymentId}` },
    async () => {
      const { data: row } = await supabase
        .from('payments')
        .select('status, result_desc')
        .eq('id', paymentId)
        .maybeSingle();
      const rec = row as { status?: string; result_desc?: string | null } | null;
      if (rec?.status === 'paid') settleSuccess();
      else if (rec?.status === 'failed') settleFailed(rec.result_desc ?? null);
    }
  );
  watchdogId = window.setTimeout(() => void queryStatus(), PENDING_TIMEOUT_MS);
}

async function sendPush() {
  const normalized = normalisePhone(phone.value);
  if (!normalized) {
    errors.value.phone = 'Enter a valid M-Pesa number, e.g. 712345678.';
    return;
  }
  errors.value.phone = '';
  formError.value = '';
  starting.value = true;
  try {
    const { data, error } = await supabase.functions.invoke('stk-push', {
      method: 'POST',
      body: { phone: normalized },
    });
    if (error) throw error;
    const payment = (data as { payment?: { id?: string; checkoutRequestId?: string } })?.payment;
    if (!payment?.id || !payment.checkoutRequestId) {
      throw new Error('stk_push_no_payment');
    }
    paymentId = payment.id;
    checkoutRequestId = payment.checkoutRequestId;
    status.value = 'pending';
    await watchPayment();
  } catch (err) {
    const code = await invokeJsonError(err);
    formError.value = friendlyPushError(code);
  } finally {
    starting.value = false;
  }
}

async function startPractising(): Promise<void> {
  await modalController.dismiss();
  void router.push('/tabs/tab1');
}

async function viewTransactions(): Promise<void> {
  await modalController.dismiss();
  void router.push('/payments');
}

onBeforeUnmount(stopWatching);
</script>

<style scoped>
.mpesa {
  max-width: 420px;
  margin: 0 auto;
}

.amount-card {
  background: var(--ion-card-background);
  border: 1px solid var(--ion-border-color);
  border-radius: 16px;
  padding: 18px;
  text-align: center;
  margin-top: 8px;
}

.amount-label {
  margin: 0 0 4px;
  font-size: 0.85rem;
  color: var(--ion-color-medium);
}

.amount {
  margin: 0;
  font-size: 2rem;
  font-weight: 700;
}

.field {
  margin-top: 20px;
}

.field-label {
  display: block;
  margin-bottom: 8px;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--ion-color-primary);
}

.phone-wrap {
  display: flex;
  align-items: center;
  border: 1px solid var(--ion-border-color);
  border-radius: 10px;
  background: var(--ion-item-background);
  overflow: hidden;
}

.phone-wrap:focus-within {
  border-color: var(--ion-color-primary);
}

.phone-wrap.has-error {
  border-color: var(--ion-color-danger);
}

.phone-wrap ion-input {
  flex: 1;
  --padding-start: 12px;
  min-height: 48px;
}

.prefix {
  padding-left: 14px;
  font-weight: 600;
  color: var(--ion-color-medium);
}

.field-error {
  margin: 6px 2px 0;
  font-size: 0.8rem;
  color: var(--ion-color-danger);
}

.form-error {
  margin: 12px 0 0;
  color: var(--ion-color-danger);
  font-size: 0.85rem;
}

.send-btn {
  margin-top: 20px;
  --border-radius: 12px;
  min-height: 50px;
  --background: #1dad5f;
  --background-hover: #18a056;
  font-weight: 600;
}

.state {
  margin-top: 20px;
  padding: 22px 16px;
  border-radius: 14px;
  text-align: center;
  background: var(--ion-card-background);
  border: 1px solid var(--ion-border-color);
}

.state ion-icon {
  font-size: 2.4rem;
}

.state h3 {
  margin: 10px 0 4px;
}

.state p {
  margin: 0 0 14px;
  font-size: 0.9rem;
  line-height: 1.5;
  color: var(--ion-color-medium);
}

.state-pending {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.state-pending p {
  margin: 0;
}

.state-success ion-icon {
  color: var(--ion-color-success);
}

.state-failed ion-icon {
  color: var(--ion-color-danger);
}

.done-btn {
  --border-radius: 10px;
}

.ghost-btn {
  --border-radius: 10px;
  margin-top: 2px;
}

.retry-btn {
  --border-radius: 10px;
}

.fine-print {
  margin-top: 12px;
  font-size: 0.75rem;
  color: var(--ion-color-medium);
}

.demo-note {
  margin-top: 14px;
  text-align: center;
  font-size: 0.75rem;
  color: var(--ion-color-medium);
}
</style>