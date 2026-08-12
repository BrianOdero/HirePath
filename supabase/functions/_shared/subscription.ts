import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';

/**
 * Upsert the user's subscription to active Pro with a 30-day period.
 * Idempotent: safe to call from the callback, the status-query fallback
 * or any retry path.
 */
export async function activatePro(
  supabase: SupabaseClient,
  userId: string,
  now: Date = new Date(),
): Promise<void> {
  const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const { error } = await supabase
    .from('subscriptions')
    .upsert({
      user_id: userId,
      tier: 'pro',
      status: 'active',
      current_period_end: periodEnd,
      updated_at: now.toISOString(),
    }, { onConflict: 'user_id' });
  if (error) throw error;
}