<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>History</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content :fullscreen="true">
      <ion-refresher slot="fixed" @ion-refresh="onRefresh">
        <ion-refresher-content refreshing-text="Refreshing…" pulling-text="Pull to refresh" />
      </ion-refresher>

      <div v-if="isLoading" class="ion-padding">
        <div v-for="n in 4" :key="n" class="row-skeleton">
          <ion-skeleton-text animated style="width: 85%" />
          <ion-skeleton-text animated style="width: 45%" />
        </div>
      </div>

      <div v-else-if="!sessions?.length" class="empty">
        <ion-icon :icon="documentsOutline" />
        <h3>No practice sessions yet</h3>
        <p>Paste your first job description to unlock tailored questions.</p>
        <ion-button router-link="/tabs/tab1" class="empty-btn">Start practising</ion-button>
      </div>

      <ion-list v-else class="ion-padding-top" :inset="false">
        <template v-for="group in groups" :key="group.label">
          <ion-list-header>{{ group.label }}</ion-list-header>
          <ion-item-sliding v-for="session in group.items" :key="session.id">
            <ion-item button @click="openSession(session.id)">
              <ion-icon slot="start" :icon="documentTextOutline" class="row-icon" />
              <ion-label>
                <h2>{{ session.role }}</h2>
                <p>{{ summary(session) }}</p>
              </ion-label>
              <span class="row-time">{{ timeLabel(session.createdAt) }}</span>
              <ion-icon slot="end" :icon="chevronForward" class="chevron" />
            </ion-item>
            <ion-item-options side="end">
              <ion-item-option color="danger" expandable @click="remove(session.id)">
                <ion-icon slot="icon-only" :icon="trashOutline" />
              </ion-item-option>
            </ion-item-options>
          </ion-item-sliding>
        </template>
      </ion-list>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import {
  chevronForward,
  documentTextOutline,
  documentsOutline,
  trashOutline,
} from 'ionicons/icons';
import {
  IonButton,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonItemOption,
  IonItemOptions,
  IonItemSliding,
  IonLabel,
  IonList,
  IonListHeader,
  IonPage,
  IonRefresher,
  IonRefresherContent,
  IonSkeletonText,
  IonTitle,
  IonToolbar,
} from '@ionic/vue';
import type { InterviewSession } from '@/core/types';
import {
  useDeleteSession,
  useSessions,
} from '@/features/interview/composables/useInterviewQuery';

type GroupKey = 'Today' | 'Yesterday' | 'Earlier';

function groupKeyFor(iso: string): GroupKey {
  const date = new Date(iso);
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);
  if (date >= startOfToday) return 'Today';
  if (date >= startOfYesterday) return 'Yesterday';
  return 'Earlier';
}

const router = useRouter();
const { data: sessions, isLoading } = useSessions();
const { mutate: removeSession } = useDeleteSession();

const groups = computed(() => {
  const order: GroupKey[] = ['Today', 'Yesterday', 'Earlier'];
  const map: Record<GroupKey, InterviewSession[]> = { Today: [], Yesterday: [], Earlier: [] };
  (sessions.value ?? []).forEach((session) => {
    map[groupKeyFor(session.createdAt)].push(session);
  });
  return order
    .filter((key) => map[key].length)
    .map((key) => ({ label: key, items: map[key] }));
});

function summary(session: InterviewSession): string {
  const parts = [session.company];
  parts.push(`${session.questions.length} question${session.questions.length === 1 ? '' : 's'}`);
  return parts.join(' · ');
}

function timeLabel(iso: string): string {
  const date = new Date(iso);
  const key = groupKeyFor(iso);
  if (key === 'Today') {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString([], { day: 'numeric', month: 'short' });
}

function openSession(id: string): void {
  void router.push(`/tabs/session/${id}`);
}

function remove(id: string): void {
  removeSession(id);
}

async function onRefresh(event: CustomEvent): Promise<void> {
  const { refetch } = useSessions();
  await refetch();
  (event.target as HTMLIonRefresherElement).complete();
}
</script>

<style scoped>
.row-icon {
  color: var(--ion-color-secondary);
}

.row-time {
  font-size: 0.78rem;
  color: var(--ion-color-medium);
  white-space: nowrap;
}

.chevron {
  color: var(--ion-color-step-400);
}

.row-skeleton {
  background: var(--ion-card-background);
  border: 1px solid var(--ion-border-color);
  border-radius: 12px;
  padding: 14px;
  margin-bottom: 10px;
}

.empty {
  text-align: center;
  padding: 64px 28px 0;
}

.empty ion-icon {
  font-size: 3.4rem;
  color: var(--ion-color-step-300);
}

.empty h3 {
  margin: 12px 0 4px;
}

.empty p {
  margin: 0 0 18px;
  color: var(--ion-color-medium);
  font-size: 0.9rem;
}

.empty-btn {
  --border-radius: 10px;
}
</style>
