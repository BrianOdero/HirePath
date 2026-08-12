import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export const projectUrl = import.meta.env.VITE_SUPABASE_PROJECT_URL as string | undefined;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

const clientKey = publishableKey ?? anonKey;

if (!projectUrl || !clientKey) {
  throw new Error(
    'Missing Supabase environment variables. Set VITE_SUPABASE_PROJECT_URL and VITE_SUPABASE_PUBLISHABLE_KEY (or VITE_SUPABASE_ANON_KEY) in .env'
  );
}

export const supabase: SupabaseClient = createClient(projectUrl, clientKey);
