import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export const projectUrl = import.meta.env.VITE_SUPABASE_PROJECT_URL as string | undefined;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

const clientKey = publishableKey ?? anonKey;

// Log configuration status for debugging
console.log('Supabase config check:', {
  hasProjectUrl: !!projectUrl,
  hasClientKey: !!clientKey,
  projectUrl: projectUrl || 'MISSING',
});

if (!projectUrl || !clientKey) {
  const errorMsg = 'Missing Supabase environment variables. Set VITE_SUPABASE_PROJECT_URL and VITE_SUPABASE_PUBLISHABLE_KEY (or VITE_SUPABASE_ANON_KEY) in .env';
  console.error(errorMsg);

  // Show visible error instead of throwing (which causes white screen)
  const showConfigError = () => {
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: #1a1a1a;
      color: #fff;
      padding: 20px;
      font-family: sans-serif;
      overflow: auto;
      z-index: 999999;
    `;

    errorDiv.innerHTML = `
      <h2 style="color: #ff4444; margin-bottom: 20px;">⚙️ Configuration Error</h2>
      <p style="margin-bottom: 10px;">Missing required Supabase environment variables:</p>
      <ul style="margin-bottom: 20px; color: #ffaa44;">
        ${!projectUrl ? '<li>VITE_SUPABASE_PROJECT_URL</li>' : ''}
        ${!clientKey ? '<li>VITE_SUPABASE_PUBLISHABLE_KEY or VITE_SUPABASE_ANON_KEY</li>' : ''}
      </ul>
      <p style="margin-bottom: 10px;">To fix this:</p>
      <ol style="color: #aaa; line-height: 1.8;">
        <li>Create or update the <code style="background: #333; padding: 2px 6px;">.env</code> file in the project root</li>
        <li>Add the required variables (see <code style="background: #333; padding: 2px 6px;">.env.example</code>)</li>
        <li>Rebuild the app: <code style="background: #333; padding: 2px 6px;">npm run build</code></li>
        <li>Sync to Capacitor: <code style="background: #333; padding: 2px 6px;">npx cap sync</code></li>
      </ol>
    `;

    document.body.appendChild(errorDiv);
  };

  // Show error immediately if DOM is ready, otherwise wait
  if (document.body) {
    showConfigError();
  } else {
    window.addEventListener('DOMContentLoaded', showConfigError);
  }

  throw new Error(errorMsg);
}

export const supabase: SupabaseClient = createClient(projectUrl, clientKey);
