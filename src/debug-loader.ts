/**
 * Debug loader to catch startup errors and display them visibly
 * This helps diagnose white screen issues in production builds
 */

// Create a visible error display
function showError(title: string, message: string, stack?: string) {
  const errorDiv = document.createElement('div');
  errorDiv.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: #1a1a1a;
    color: #ff4444;
    padding: 20px;
    font-family: monospace;
    font-size: 12px;
    overflow: auto;
    z-index: 999999;
  `;

  errorDiv.innerHTML = `
    <h2 style="color: #ff4444; margin-bottom: 10px;">🚨 ${title}</h2>
    <p style="color: #fff; margin-bottom: 10px;">${message}</p>
    ${stack ? `<pre style="color: #ffaa44; white-space: pre-wrap;">${stack}</pre>` : ''}
  `;

  document.body.appendChild(errorDiv);
}

// Log startup info
console.log('=== HirePath Debug Info ===');
console.log('Location:', window.location.href);
console.log('Base URL:', import.meta.env.BASE_URL);
console.log('Mode:', import.meta.env.MODE);
console.log('Supabase URL:', import.meta.env.VITE_SUPABASE_PROJECT_URL);

// Catch unhandled errors
window.addEventListener('error', (event) => {
  console.error('Unhandled error:', event.error);
  showError('Runtime Error', event.message, event.error?.stack);
});

// Catch unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
  showError('Promise Rejection', String(event.reason), event.reason?.stack);
});

// Check critical environment variables
const requiredEnvVars = {
  'VITE_SUPABASE_PROJECT_URL': import.meta.env.VITE_SUPABASE_PROJECT_URL,
  'VITE_SUPABASE_ANON_KEY': import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
};

const missingVars = Object.entries(requiredEnvVars)
  .filter(([_, value]) => !value)
  .map(([key]) => key);

if (missingVars.length > 0) {
  console.error('Missing environment variables:', missingVars);
  showError(
    'Configuration Error',
    'Missing required environment variables: ' + missingVars.join(', '),
    'Check your .env file and rebuild the app'
  );
}

console.log('Debug loader initialized');
