<template>
  <div class="feedback">
    <div class="draft-toolbar">
      <span class="draft-title">Practice your answer</span>
      <span class="draft-hint">Coach reads it and responds</span>
    </div>

    <div v-if="messages.length" class="thread">
      <div
        v-for="message in messages"
        :key="message.id"
        class="bubble"
        :class="message.role"
      >
        <p>{{ message.content }}</p>
        <span class="bubble-time">{{ timeOf(message.createdAt) }}</span>
      </div>
      <ion-spinner v-if="submitting" name="crescent" class="thread-spinner" />
      <div v-if="error" class="submit-error">{{ error }}</div>
    </div>
    <p v-else class="empty-hint">
      Submit your answer below and the coach will critique it and point you to a stronger response.
    </p>

    <div class="reply-box">
      <ion-textarea
        v-model="draft"
        :rows="3"
        fill="outline"
        placeholder="Type your answer…"
        :maxlength="3000"
      />
      <ion-button
        expand="block"
        size="small"
        class="send-btn"
        :disabled="!draft.trim() || submitting"
        @click="send"
      >
        Send for feedback
      </ion-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { IonButton, IonSpinner, IonTextarea } from '@ionic/vue';
import type { FeedbackMessage } from '@/core/types';
import { useSubmitAnswer } from '../composables/useInterviewQuery';

const props = defineProps<{
  sessionId: string;
  questionId: string;
  messages: FeedbackMessage[];
}>();

const draft = ref('');
const { mutate, isPending: submitting, error } = useSubmitAnswer(props.sessionId, props.questionId);

function timeOf(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function send() {
  const value = draft.value.trim();
  if (!value) return;
  mutate(value);
  draft.value = '';
}
</script>

<style scoped>
.feedback {
  margin-top: 8px;
}

.draft-toolbar {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 4px;
}

.draft-title {
  font-weight: 600;
}

.draft-hint {
  font-size: 0.8rem;
  color: var(--ion-color-medium);
}

.thread {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin: 14px 0;
}

.bubble {
  max-width: 86%;
  padding: 10px 14px;
  border-radius: 14px;
  line-height: 1.5;
  font-size: 0.92rem;
}

.bubble.user {
  align-self: flex-end;
  background: var(--ion-color-primary);
  color: var(--ion-color-primary-contrast);
  border-bottom-right-radius: 4px;
}

.bubble.coach {
  align-self: flex-start;
  background: var(--ion-color-light);
  border: 1px solid var(--ion-border-color);
  border-bottom-left-radius: 4px;
}

.bubble p {
  margin: 0 0 4px;
  white-space: pre-wrap;
}

.bubble-time {
  font-size: 0.7rem;
  opacity: 0.7;
}

.thread-spinner {
  align-self: center;
}

.submit-error {
  font-size: 0.82rem;
  color: var(--ion-color-danger);
}

.empty-hint {
  margin: 14px 0;
  font-size: 0.9rem;
  color: var(--ion-color-medium);
  line-height: 1.5;
}

.reply-box {
  margin-top: 4px;
}

.send-btn {
  margin-top: 10px;
  --border-radius: 10px;
}
</style>
