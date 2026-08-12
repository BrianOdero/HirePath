<template>
  <ion-page>
    <ion-content :fullscreen="true" class="ion-padding">
      <div class="practice">
        <header class="greeting">
          <div>
            <p class="greeting-sub">{{ dateLine }}</p>
            <h1 class="greeting-title">Good {{ timeOfDay }}, {{ firstName }}</h1>
          </div>
          <div v-if="plan" class="plan-pill" :class="plan.tier">
            {{ plan.tier === 'pro' ? 'Pro' : 'Free' }}
          </div>
        </header>

        <section v-if="plan" class="usage card">
          <div class="usage-row">
            <span class="usage-label">
              {{ plan.tier === 'pro'
                ? 'Unlimited practice sessions'
                : `${plan.usedThisMonth} of ${plan.freeLimit} free sessions used` }}
            </span>
            <span class="usage-amount">{{ plan.tier === 'free' ? `${plan.freeLimit - plan.usedThisMonth} left` : '' }}</span>
          </div>
          <div class="usage-track">
            <div
              class="usage-fill"
              :class="{ 'usage-fill-warn': plan.tier === 'free' && plan.freeLimit - plan.usedThisMonth <= 1 }"
              :style="{ width: usagePercent }"
            ></div>
          </div>
          <p class="usage-note">
            Resets on the 1st of each month. Upgrade to Pro for unlimited sessions.
          </p>
        </section>

        <section class="jd card">
          <div class="jd-head">
            <h2>New practice session</h2>
            <p>Paste the job description you want to prep for.</p>
          </div>
          <ion-textarea
            v-model="jobDescription"
            fill="outline"
            :rows="8"
            placeholder="Paste the job description here…"
            :maxlength="6000"
            class="jd-input"
            ref="jdInput"
          />
          <div class="jd-foot">
            <span class="char-count">{{ jobDescription.length }}/6000</span>
            <ion-button
              fill="clear"
              size="small"
              class="paste-btn"
              @click="parseClipboard"
            >
              Paste from clipboard
            </ion-button>
          </div>
        </section>

        <section v-if="limitReached" class="limit card">
          <h3>You've used all {{ plan?.freeLimit }} free sessions</h3>
          <p>
            Upgrade to Pro for unlimited sessions and AI coaching feedback on your answers.
          </p>
          <ion-button expand="block" class="upgrade-btn" @click="openPaywall">
            Upgrade to Pro
          </ion-button>
        </section>

        <ion-button
          v-else
          expand="block"
          class="generate-btn"
          :disabled="!canGenerate || generating"
          @click="generate"
        >
          <ion-spinner v-if="generating" name="crescent" />
          <span v-else>Generate practice questions</span>
        </ion-button>

        <p class="privacy-note">
          Your session and answers stay private to your account.
        </p>

        <div v-if="generating" class="skeletons">
          <div v-for="n in 5" :key="n" class="skeleton">
            <ion-skeleton-text animated style="width: 96%" />
            <ion-skeleton-text animated style="width: 70%" />
          </div>
        </div>

        <p v-if="errorMessage" class="generate-error">{{ errorMessage }}</p>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import {
  IonButton,
  IonContent,
  IonPage,
  IonSkeletonText,
  IonSpinner,
  IonTextarea,
} from '@ionic/vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/features/authentication/stores/useAuthStore';
import {
  useGenerateQuestions,
  usePlan,
} from '@/features/interview/composables/useInterviewQuery';
import { usePaywall } from '@/features/subscription/composables/usePaywall';

const router = useRouter();
const authStore = useAuthStore();
const { openPaywall } = usePaywall();
const { data: plan } = usePlan();
const { mutate: performGenerate, isPending: generating, error } = useGenerateQuestions();

const jobDescription = ref('');

const firstName = computed(() => authStore.displayName?.split(' ')[0] ?? 'there');
const timeOfDay = computed(() => {
  const hour = new Date().getHours();
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
});
const dateLine = computed(() =>
  new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })
);

const limitReached = computed(
  () =>
    plan.value?.tier === 'free' &&
    (plan.value.usedThisMonth ?? 0) >= (plan.value.freeLimit ?? 0)
);
const canGenerate = computed(() => jobDescription.value.trim().length >= 40);
const errorMessage = computed(() => {
  const message = error.value?.message ?? '';
  if (message.includes('FREE_LIMIT_REACHED') || message.includes('free_limit')) {
    return 'You have used all your free sessions this month. Upgrade to Pro to continue practicing.';
  }
  return message || '';
});
const usagePercent = computed(() => {
  if (!plan.value) return '0%';
  if (plan.value.tier === 'pro') return '100%';
  return `${Math.min(100, (plan.value.usedThisMonth / plan.value.freeLimit) * 100)}%`;
});

async function parseClipboard() {
  try {
    const text = await navigator.clipboard.readText();
    if (text) jobDescription.value = text.slice(0, 6000);
  } catch {
    /* clipboard permission denied — user can paste manually */
  }
}

function generate() {
  if (!canGenerate.value) return;
  performGenerate(jobDescription.value.trim(), {
    onSuccess: ({ session }) => {
      jobDescription.value = '';
      void router.push(`/tabs/session/${session.id}`);
    },
  });
}
</script>

<style scoped>
.practice {
  max-width: 560px;
  margin: 0 auto;
  padding-top: 12px;
}

.greeting {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.greeting-sub {
  margin: 0 0 2px;
  font-size: 0.85rem;
  color: var(--ion-color-medium);
}

.greeting-title {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 700;
  letter-spacing: -0.01em;
}

.plan-pill {
  padding: 4px 12px;
  border-radius: 999px;
  font-size: 0.78rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  white-space: nowrap;
}

.plan-pill.free {
  background: var(--ion-color-light);
  color: var(--ion-color-medium);
  border: 1px solid var(--ion-border-color);
}

.plan-pill.pro {
  background: var(--ion-color-secondary);
  color: #fff;
}

.card {
  background: var(--ion-card-background);
  border: 1px solid var(--ion-border-color);
  border-radius: 16px;
  padding: 18px;
  margin-top: 16px;
}

.usage-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 8px;
}

.usage-label {
  font-weight: 600;
  font-size: 0.95rem;
}

.usage-amount {
  font-size: 0.8rem;
  color: var(--ion-color-medium);
  white-space: nowrap;
}

.usage-track {
  margin-top: 10px;
  height: 6px;
  border-radius: 999px;
  background: var(--ion-color-step-100);
  overflow: hidden;
}

.usage-fill {
  height: 100%;
  border-radius: 999px;
  background: var(--ion-color-primary);
  transition: width 0.3s ease;
}

.usage-fill-warn {
  background: var(--ion-color-secondary);
}

.usage-note {
  margin: 10px 0 0;
  font-size: 0.78rem;
  color: var(--ion-color-medium);
}

.jd-head h2 {
  margin: 0 0 4px;
  font-size: 1.1rem;
}

.jd-head p {
  margin: 0 0 12px;
  font-size: 0.88rem;
  color: var(--ion-color-medium);
}

.jd-input {
  --background: var(--ion-color-light);
  border-radius: 10px;
}

.jd-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 6px;
}

.char-count {
  font-size: 0.78rem;
  color: var(--ion-color-medium);
}

.generate-btn {
  margin-top: 20px;
  --border-radius: 12px;
  min-height: 50px;
  font-weight: 600;
}

.privacy-note {
  text-align: center;
  font-size: 0.78rem;
  color: var(--ion-color-medium);
  margin: 12px 0 0;
}

.limit h3 {
  margin: 0 0 6px;
  font-size: 1.05rem;
}

.limit p {
  margin: 0 0 14px;
  font-size: 0.9rem;
  line-height: 1.5;
  color: var(--ion-color-medium);
}

.upgrade-btn {
  --border-radius: 12px;
  --background: var(--ion-color-secondary);
}

.skeletons {
  margin-top: 16px;
}

.skeleton {
  background: var(--ion-card-background);
  border: 1px solid var(--ion-border-color);
  border-radius: 12px;
  padding: 14px;
  margin-bottom: 10px;
}

.generate-error {
  margin: 14px 0 0;
  color: var(--ion-color-danger);
}
</style>
