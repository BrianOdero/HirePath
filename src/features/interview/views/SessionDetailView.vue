<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button default-href="/tabs/tab2" />
        </ion-buttons>
        <ion-title>{{ session?.role ?? 'Session' }}</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content :fullscreen="true" class="ion-padding">
      <div v-if="isLoading" class="detail-loading">
        <div v-for="n in 4" :key="n" class="detail-skeleton">
          <ion-skeleton-text animated style="width: 90%" />
          <ion-skeleton-text animated style="width: 60%" />
        </div>
      </div>

      <template v-else-if="session">
        <section class="meta card">
          <div class="meta-row">
            <h1>{{ session.role }}</h1>
            <ion-chip class="tier-chip" :class="plan?.tier">{{ plan?.tier === 'pro' ? 'Pro' : 'Free' }}</ion-chip>
          </div>
          <p class="meta-line">
            {{ session.company }} · {{ session.questions.length }} questions · {{ metaDate }}
          </p>
        </section>

        <ion-accordion-group>
          <ion-accordion v-for="question in session.questions" :key="question.id" :value="question.id">
            <ion-item slot="header" lines="none">
              <ion-icon slot="start" :icon="chatbubbleEllipsesOutline" class="q-icon" />
              <ion-label class="q-label">{{ question.question }}</ion-label>
            </ion-item>
            <div slot="content" class="ion-padding answer-content">
              <QuestionCard :question="question" />

              <div v-if="isPro" class="feedback-block">
                <FeedbackChat
                  :session-id="session.id"
                  :question-id="question.id"
                  :messages="feedbackFor(question.id)"
                />
              </div>

              <div v-else class="locked card">
                <p>Practice your answer and get AI coaching feedback — a Pro feature.</p>
                <ion-button expand="block" size="small" class="locked-btn" @click="openPaywall">
                  Upgrade to Pro
                </ion-button>
              </div>
            </div>
          </ion-accordion>
        </ion-accordion-group>
      </template>

      <div v-else class="not-found">
        <p>This session could not be found.</p>
        <ion-button router-link="/tabs/tab2" fill="clear">Back to history</ion-button>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { chatbubbleEllipsesOutline } from 'ionicons/icons';
import {
  IonAccordion,
  IonAccordionGroup,
  IonBackButton,
  IonButton,
  IonButtons,
  IonChip,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonPage,
  IonSkeletonText,
  IonTitle,
  IonToolbar,
} from '@ionic/vue';
import QuestionCard from '@/features/interview/components/QuestionCard.vue';
import FeedbackChat from '@/features/interview/components/FeedbackChat.vue';
import type { FeedbackMessage } from '@/core/types';
import {
  usePlan,
  useSession,
} from '@/features/interview/composables/useInterviewQuery';
import { usePaywall } from '@/features/subscription/composables/usePaywall';

const route = useRoute();
const { openPaywall } = usePaywall();
const sessionId = computed(() =>
  Array.isArray(route.params.id) ? route.params.id[0] : route.params.id ?? ''
);

const { data: session, isLoading } = useSession(sessionId.value);
const { data: plan } = usePlan();
const isPro = computed(() => plan.value?.tier === 'pro');

const metaDate = computed(() => {
  if (!session.value) return '';
  return new Date(session.value.createdAt).toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
});

function feedbackFor(questionId: string): FeedbackMessage[] {
  return session.value?.feedback?.[questionId] ?? [];
}
</script>

<style scoped>
.detail-loading {
  max-width: 560px;
  margin: 0 auto;
  padding: 32px 0;
}

.detail-skeleton {
  background: var(--ion-card-background);
  border: 1px solid var(--ion-border-color);
  border-radius: 12px;
  padding: 14px;
  margin-bottom: 12px;
}

.meta {
  max-width: 560px;
  margin: 0 auto 16px;
  background: var(--ion-card-background);
  border: 1px solid var(--ion-border-color);
  border-radius: 16px;
  padding: 16px;
}

.meta-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.meta h1 {
  margin: 0;
  font-size: 1.2rem;
}

.tier-chip {
  --background: var(--ion-color-light);
  margin: 0;
}

.tier-chip.pro {
  --background: var(--ion-color-secondary);
  color: #fff;
}

.meta-line {
  margin: 6px 0 0;
  font-size: 0.85rem;
  color: var(--ion-color-medium);
}

ion-accordion-group {
  max-width: 560px;
  margin: 0 auto;
}

ion-accordion {
  border: 1px solid var(--ion-border-color);
  border-radius: 12px;
  margin-bottom: 12px;
  overflow: hidden;
  background: var(--ion-card-background);
}

.q-icon {
  color: var(--ion-color-secondary);
}

.q-label {
  font-weight: 600;
  line-height: 1.4;
  white-space: normal;
}

.answer-content {
  border-top: 1px solid var(--ion-border-color);
}

.feedback-block {
  margin-top: 16px;
  padding-top: 14px;
  border-top: 1px dashed var(--ion-border-color);
}

.locked {
  margin-top: 16px;
  padding: 14px;
  border-radius: 12px;
  background: var(--ion-color-light);
  border: 1px solid var(--ion-border-color);
}

.locked p {
  margin: 0 0 10px;
  font-size: 0.88rem;
  color: var(--ion-color-medium);
}

.locked-btn {
  --border-radius: 10px;
  --background: var(--ion-color-secondary);
}

.not-found {
  text-align: center;
  padding: 48px 0;
  color: var(--ion-color-medium);
}
</style>
