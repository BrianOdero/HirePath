<template>
  <ion-chip size="small" class="focus-chip">{{ question.focus }}</ion-chip>
  <p class="sample-label">Sample answer</p>
  <p class="sample-text">{{ question.sampleAnswer }}</p>
</template>

<script setup lang="ts">
import { IonChip } from '@ionic/vue';
import type { InterviewQuestion } from '@/core/types';

defineProps<{
  question: InterviewQuestion;
}>();
</script>

<style scoped>
.focus-chip {
  --background: var(--ion-color-light);
  margin-left: 0;
  color: var(--ion-color-medium);
}

.sample-label {
  margin: 8px 0 4px;
  font-size: 0.78rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  color: var(--ion-color-secondary);
}

.sample-text {
  margin: 0;
  line-height: 1.6;
  color: var(--ion-text-color);
}
</style>
