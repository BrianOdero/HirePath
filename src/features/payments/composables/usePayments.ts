import { useQuery, useQueryClient } from '@tanstack/vue-query';
import { onMounted, onUnmounted } from 'vue';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { paymentsApi } from '@/core/services/paymentsApi';
import { subscribeOnce } from '@/core/services/realtime';
import { useAuthStore } from '@/features/authentication/stores/useAuthStore';

export const PAYMENT_KEYS = {
  all: ['payments'] as const,
};

const paymentChannels = new Map<string, RealtimeChannel>();

/**
 * Live payment history: the M-Pesa callback / status query flip
 * payments rows, and Realtime invalidates the query instantly.
 */
export function usePayments() {
  const queryClient = useQueryClient();
  const authStore = useAuthStore();
  const userId = authStore.user?.id;

  const query = useQuery({
    queryKey: PAYMENT_KEYS.all,
    queryFn: () => paymentsApi.getPayments(userId ?? ''),
    enabled: Boolean(userId),
  });

  onMounted(() => {
    if (!userId) return;
    const unsubscribe = subscribeOnce(
      paymentChannels,
      userId,
      `payments:${userId}`,
      {
        event: '*',
        schema: 'public',
        table: 'payments',
        filter: `user_id=eq.${userId}`,
      },
      () => {
        void queryClient.invalidateQueries({ queryKey: PAYMENT_KEYS.all });
      }
    );
    onUnmounted(unsubscribe);
  });

  return query;
}