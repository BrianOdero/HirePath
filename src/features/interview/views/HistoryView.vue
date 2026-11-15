<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>Readiness</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content :fullscreen="true">
      <ion-refresher slot="fixed" @ion-refresh="onRefresh">
        <ion-refresher-content refreshing-text="Refreshing…" pulling-text="Pull to refresh" />
      </ion-refresher>

      <div class="history-container">
        <div v-if="isLoading">
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

        <template v-else>
          <!-- KPI cards -->
          <div class="kpi-grid">
            <div class="kpi-card kpi-index">
              <div class="kpi-label">Readiness Index</div>
              <div class="kpi-value">
                {{ stats.readinessIndex ?? '—' }}<span v-if="stats.readinessIndex !== null" class="kpi-of">/100</span>
              </div>
              <div class="kpi-trend" :class="trendClass">
                <ion-icon v-if="stats.trend !== null" :icon="stats.trend >= 0 ? trendingUpOutline : trendingDownOutline" />
                {{ trendLabel }}
              </div>
            </div>
            <div class="kpi-card">
              <div class="kpi-label">Sessions completed</div>
              <div class="kpi-value">{{ stats.sessionsCompleted }}</div>
              <div class="kpi-trend kpi-muted">{{ stats.answersGiven }} answers given</div>
            </div>
            <div class="kpi-card">
              <div class="kpi-label">Questions generated</div>
              <div class="kpi-value">{{ stats.questionsGenerated }}</div>
              <div class="kpi-trend kpi-muted">across {{ stats.sessionsCompleted }} simulations</div>
            </div>
            <div class="kpi-card">
              <div class="kpi-label">Scored answers</div>
              <div class="kpi-value">{{ stats.scoredCount }}</div>
              <div class="kpi-trend kpi-muted">{{ stats.scoredCount ? 'feedback rated 1–10' : 'none yet' }}</div>
            </div>
          </div>

          <!-- Competency radar -->
          <div class="radar-card">
            <div class="radar-head">
              <span class="radar-title">Competency Radar</span>
              <span class="radar-note">mean of scored answers</span>
            </div>

            <svg v-if="stats.competencies" class="radar-svg" viewBox="0 0 260 200">
              <polygon :points="ring" v-for="ring in radarRings" :key="ring" class="radar-ring" />
              <line :x1="130" y1="100" x2="130" y2="10" class="radar-axis" />
              <line :x1="130" y1="100" x2="220" y2="100" class="radar-axis" />
              <line :x1="130" y1="100" x2="130" y2="190" class="radar-axis" />
              <line :x1="130" y1="100" x2="40" y2="100" class="radar-axis" />
              <polygon :points="radarShape" class="radar-shape" />
              <circle v-for="(point, i) in radarPoints" :key="i" :cx="point.x" :cy="point.y" r="3.5" class="radar-dot" />
              <text x="130" y="8" text-anchor="middle" class="radar-label">{{ axisLabel('clarity') }}</text>
              <text x="226" y="96" text-anchor="start" class="radar-label">{{ axisLabel('structure') }}</text>
              <text x="130" y="200" text-anchor="middle" class="radar-label">{{ axisLabel('depth') }}</text>
              <text x="34" y="96" text-anchor="end" class="radar-label">{{ axisLabel('communication') }}</text>
            </svg>

            <div v-else class="radar-fallback">
              <ion-icon :icon="statsChartOutline" />
              <p>Keep practising — the radar unlocks once your first answers are scored.</p>
            </div>
          </div>

          <!-- Historical sessions -->
          <div class="list-head">Recent mock simulations</div>
          <ion-list :inset="false">
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
        </template>
      </div>
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
  statsChartOutline,
  trendingDownOutline,
  trendingUpOutline,
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
import type { CompetencyScores, InterviewSession } from '@/core/types';
import {
  useDeleteSession,
  useSessions,
} from '@/features/interview/composables/useInterviewQuery';
import { computeReadiness } from '@/features/interview/utils/readiness';

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

const stats = computed(() => computeReadiness(sessions.value ?? []));

const trendClass = computed(() => {
  if (stats.value.trend === null) return 'kpi-muted';
  return stats.value.trend >= 0 ? 'trend-up' : 'trend-down';
});

const trendLabel = computed(() => {
  const trend = stats.value.trend;
  if (trend === null) return stats.value.scoredCount ? 'not enough history yet' : 'answer questions to score';
  const sign = trend >= 0 ? '+' : '';
  return `${sign}${trend} this month`;
});

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

// ---- radar geometry (4 axes: top, right, bottom, left; viewBox 260x200)
const AXES: Array<keyof CompetencyScores> = ['clarity', 'structure', 'depth', 'communication'];
const CENTER = { x: 130, y: 100 };
const MAX_RADIUS = 85;

function radarVertex(axisIndex: number, value: number): { x: number; y: number } {
  const radius = (value / 10) * MAX_RADIUS;
  const angle = -Math.PI / 2 + (axisIndex * Math.PI) / 2;
  return {
    x: CENTER.x + radius * Math.cos(angle),
    y: CENTER.y + radius * Math.sin(angle),
  };
}

const radarRings = [10, 6.7, 3.3].map((value) =>
  [0, 1, 2, 3]
    .map((axis) => {
      const point = radarVertex(axis, value);
      return `${point.x.toFixed(1)},${point.y.toFixed(1)}`;
    })
    .join(' ')
);

const radarPoints = computed(() =>
  AXES.map((axis, index) => radarVertex(index, stats.value.competencies?.[axis] ?? 0))
);

const radarShape = computed(() =>
  radarPoints.value.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' ')
);

function axisLabel(axis: keyof CompetencyScores): string {
  const value = stats.value.competencies?.[axis];
  const percent = value !== undefined ? Math.round(value * 10) : '—';
  return `${axis[0].toUpperCase()}${axis.slice(1)} (${percent}%)`;
}

function summary(session: InterviewSession): string {
  const threads = Object.values(session.feedback ?? {});
  const answered = threads.filter((thread) => thread.some((m) => m.role === 'user')).length;
  const parts = [session.company];
  parts.push(
    answered
      ? `${answered}/${session.questions.length} answered`
      : `${session.questions.length} question${session.questions.length === 1 ? '' : 's'}`
  );
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
.history-container {
  max-width: 600px;
  margin: 0 auto;
  padding: clamp(16px, 3vh, 32px) 16px 32px;
  min-height: 100%;
  box-sizing: border-box;
}

/* ---- KPI cards (showcase stats-kpi-grid, ported to house tokens) */
.kpi-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-bottom: 14px;
}

.kpi-card {
  background: var(--ion-card-background);
  border: 1px solid var(--ion-border-color);
  border-radius: 16px;
  padding: 14px;
}

.kpi-label {
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--ion-color-medium);
}

.kpi-value {
  margin-top: 6px;
  font-size: 1.7rem;
  font-weight: 800;
  line-height: 1.1;
}

.kpi-index .kpi-value {
  color: var(--hp-gold-500);
}

.kpi-of {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--ion-color-medium);
}

.kpi-trend {
  margin-top: 6px;
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.76rem;
  font-weight: 600;
}

.kpi-muted {
  color: var(--ion-color-medium);
  font-weight: 500;
}

.trend-up {
  color: var(--ion-color-success);
}

.trend-down {
  color: var(--ion-color-danger);
}

/* ---- radar */
.radar-card {
  background: var(--ion-card-background);
  border: 1px solid var(--ion-border-color);
  border-radius: 16px;
  padding: 14px;
  margin-bottom: 16px;
}

.radar-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}

.radar-title {
  font-size: 0.82rem;
  font-weight: 700;
}

.radar-note {
  font-size: 0.68rem;
  color: var(--ion-color-medium);
}

.radar-svg {
  display: block;
  width: 100%;
  max-width: 320px;
  margin: 6px auto 0;
}

.radar-ring,
.radar-axis {
  fill: none;
  stroke: var(--ion-border-color);
  stroke-width: 1;
}

.radar-shape {
  fill: rgba(245, 158, 11, 0.25);
  stroke: var(--hp-gold-500);
  stroke-width: 2;
}

.radar-dot {
  fill: var(--hp-gold-500);
}

.radar-label {
  fill: var(--ion-color-medium);
  font-size: 9px;
  font-weight: 700;
}

.radar-fallback {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 18px 8px;
  color: var(--ion-color-medium);
}

.radar-fallback ion-icon {
  font-size: 2rem;
  color: var(--ion-color-step-300);
}

.radar-fallback p {
  margin: 8px 0 0;
  font-size: 0.85rem;
  max-width: 34ch;
}

/* ---- session list */
.list-head {
  font-size: 0.82rem;
  font-weight: 700;
  margin: 4px 0 6px;
}

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
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
  text-align: center;
  padding: 32px;
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
