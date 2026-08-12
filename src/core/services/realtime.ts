import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@/core/services/supabase';

export interface PostgresChangeFilter {
  event: '*' | 'INSERT' | 'UPDATE' | 'DELETE';
  schema: string;
  table?: string;
  filter?: string;
}

/**
 * Realtime channels are shared per concern (one channel per user/plan,
 * per session, per payment watch). Multiple components mount the same
 * concern, and supabase-js returns the SAME channel for a repeated
 * topic — adding .on() callbacks after subscribe() throws and can wedge
 * navigation. The registry makes subscription idempotent and tracks
 * cleanup.
 */
export function subscribeOnce(
  registry: Map<string, RealtimeChannel>,
  key: string,
  name: string,
  filter: PostgresChangeFilter,
  onEvent: () => void
): () => void {
  const existing = registry.get(key);
  if (existing) {
    return () => {
      if (registry.get(key) === existing) {
        registry.delete(key);
        void supabase.removeChannel(existing);
      }
    };
  }
  const channel = supabase
    .channel(name)
    .on('postgres_changes', filter, () => onEvent())
    .subscribe((status, err) => {
      if (status === 'SUBSCRIBED') return;
      console.warn(`Realtime channel "${name}" not ready (${status}):`, err);
    });
  registry.set(key, channel);
  return () => {
    if (registry.get(key) === channel) {
      registry.delete(key);
      void supabase.removeChannel(channel);
    }
  };
}