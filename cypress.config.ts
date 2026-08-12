import { defineConfig } from 'cypress';
import fs from 'node:fs';
import path from 'node:path';

const QA_EMAIL = 'tabs-qa@hirepath.test';
const QA_PASSWORD = 'Hirepath123!';

function envFromDotEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  try {
    const raw = fs.readFileSync(path.join(process.cwd(), '.env'), 'utf8');
    for (const line of raw.split('\n')) {
      const match = line.match(/^([A-Za-z0-9_]+)=(.*)$/);
      if (match) env[match[1]] = match[2].replace(/^["']|["']$/g, '');
    }
  } catch {
    /* .env missing — tasks will fail with a clear error */
  }
  return env;
}

function adminHeaders() {
  const key = envFromDotEnv().VITE_SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('VITE_SUPABASE_SERVICE_ROLE_KEY not found in .env');
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
  };
}

async function deleteUserByEmail(email: string): Promise<void> {
  const url = envFromDotEnv().VITE_SUPABASE_PROJECT_URL;
  if (!url) throw new Error('VITE_SUPABASE_PROJECT_URL not found in .env');
  const headers = adminHeaders();
  const res = await fetch(`${url}/auth/v1/admin/users?email=${encodeURIComponent(email)}`, { headers });
  const data = await res.json();
  for (const user of data?.users ?? []) {
    await fetch(`${url}/auth/v1/admin/users/${user.id}`, { method: 'DELETE', headers });
  }
}

async function createConfirmedUser(): Promise<{ ok: boolean }> {
  const url = envFromDotEnv().VITE_SUPABASE_PROJECT_URL;
  const created = await fetch(`${url}/auth/v1/admin/users`, {
    method: 'POST',
    headers: adminHeaders(),
    body: JSON.stringify({
      email: QA_EMAIL,
      password: QA_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: 'Tab QA User' },
    }),
  }).then((r) => r.json());
  if (!created.id) throw new Error(`Failed to seed QA user: ${JSON.stringify(created)}`);
  return { ok: true };
}

export default defineConfig({
  env: {
    QA_EMAIL,
    QA_PASSWORD,
  },
  e2e: {
    supportFile: 'tests/e2e/support/e2e.{js,jsx,ts,tsx}',
    specPattern: 'tests/e2e/specs/**/*.cy.{js,jsx,ts,tsx}',
    videosFolder: 'tests/e2e/videos',
    screenshotsFolder: 'tests/e2e/screenshots',
    baseUrl: 'http://localhost:5173',
    setupNodeEvents(on) {
      on('task', {
        log: (msg: string) => {
          console.log('[CY]', msg);
          return null;
        },
        seedUser: async () => {
          await deleteUserByEmail(QA_EMAIL);
          return createConfirmedUser();
        },
        cleanupUser: async () => {
          await deleteUserByEmail(QA_EMAIL);
          return { ok: true };
        },
      });
    },
  },
});