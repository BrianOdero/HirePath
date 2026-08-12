import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import { computed, onMounted, onUnmounted } from 'vue';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { interviewApi } from '@/core/services/interviewApi';
import { useAuthStore } from '@/features/authentication/stores/useAuthStore';
import { subscribeOnce } from '@/core/services/realtime';

export const SESSION_KEYS = {
  all: ['sessions'] as const,
  list: () => [...SESSION_KEYS.all, 'list'] as const,
  detail: (id: string) => [...SESSION_KEYS.all, 'detail', id] as const,
  plan: ['plan'] as const,
};

/**
 * Realtime channels are shared per concern (one channel per user/plan and
 * one per session). Multiple components mount the same composable (e.g.
 * Practice + Profile both watch the plan), and supabase-js returns the
 * SAME channel for a repeated topic — adding .on() callbacks after
 * subscribe() throws and can wedge navigation. Registry + cleanup live
 * in src/core/services/realtime.ts (subscribeOnce).
 */
const planChannels = new Map<string, RealtimeChannel>();
const sessionChannels = new Map<string, RealtimeChannel>();

export function useSessions() {
  return useQuery({
    queryKey: SESSION_KEYS.list(),
    queryFn: () => interviewApi.getSessions(),
  });
}

export function useSession(id: string | undefined) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: SESSION_KEYS.detail(id ?? ''),
    queryFn: () => interviewApi.getSession(id ?? ''),
    enabled: computed(() => Boolean(id)),
  });

  // live chat: new coach/user messages invalidate the detail query
  onMounted(() => {
    const sessionId = id;
    if (!sessionId) return;
    const unsubscribe = subscribeOnce(
      sessionChannels,
      sessionId,
      `messages:${sessionId}`,
      {
        event: 'INSERT',
        schema: 'public',
        table: 'session_messages',
        filter: `session_id=eq.${sessionId}`,
      },
      () => {
        void queryClient.invalidateQueries({ queryKey: SESSION_KEYS.detail(sessionId) });
      }
    );
    onUnmounted(unsubscribe);
  });

  return query;
}

export function usePlan() {
  const queryClient = useQueryClient();
  const authStore = useAuthStore();
  const query = useQuery({
    queryKey: SESSION_KEYS.plan,
    queryFn: () => interviewApi.getPlan(),
  });

  // live plan: M-Pesa callback flips subscriptions to pro
  onMounted(() => {
    const userId = authStore.user?.id;
    if (!userId) return;
    const unsubscribe = subscribeOnce(
      planChannels,
      userId,
      `plan:${userId}`,
      {
        event: '*',
        schema: 'public',
        table: 'subscriptions',
        filter: `user_id=eq.${userId}`,
      },
      () => {
        void queryClient.invalidateQueries({ queryKey: SESSION_KEYS.plan });
      }
    );
    onUnmounted(unsubscribe);
  });

  return query;
}

export function useGenerateQuestions() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (jobDescription: string) => interviewApi.generateQuestions(jobDescription),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: SESSION_KEYS.list() });
      void queryClient.invalidateQueries({ queryKey: SESSION_KEYS.plan });
    },
  });
}

export function useDeleteSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => interviewApi.deleteSession(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: SESSION_KEYS.list() });
    },
  });
}

export function useSubmitAnswer(sessionId: string, questionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (answer: string) => interviewApi.submitAnswer(sessionId, questionId, answer),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: SESSION_KEYS.detail(sessionId),
      });
    },
  });
}
