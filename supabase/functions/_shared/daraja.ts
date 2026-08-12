// Shared Daraja (Safaricom) helpers: environment, EAT timestamp and a
// cached OAuth access token shared across warm function instances.

export const DARAJA = 'https://sandbox.safaricom.co.ke';

export function env(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing Deno env: ${name}`);
  return value;
}

/**
 * Timestamp in YYYYMMDDHHmmss Africa/Nairobi (EAT). Edge runtimes are
 * usually UTC, so the offset must be explicit. Nairobi has no DST, so
 * EAT is a fixed UTC+3. The SAME value feeds both the STK request body
 * and the base64 password.
 */
export function timestampEat(): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const d = new Date(Date.now() + 3 * 60 * 60 * 1000); // EAT = UTC+3
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}`
  );
}

let cachedToken: { value: string; expiresAt: number } | null = null;

/**
 * OAuth client-credentials token (valid ~1h). Cached per warm instance
 * and refreshed before expiry — the doc warns against a fresh token on
 * every API call.
 */
export async function accessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) {
    return cachedToken.value;
  }
  const key = env('MPESA_CONSUMER_KEY');
  const secret = env('MPESA_CONSUMER_SECRET');
  const auth = btoa(`${key}:${secret}`);
  const res = await fetch(`${DARAJA}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${auth}` },
  });
  const data = await res.json();
  const token = data.access_token as string | undefined;
  if (!token) throw new Error('daraja_token_failed');
  const expiresIn = Number(data.expires_in ?? 3599);
  cachedToken = { value: token, expiresAt: Date.now() + expiresIn * 1000 };
  return token;
}

export function stkPassword(shortcode: string, passkey: string, ts: string): string {
  return btoa(`${shortcode}${passkey}${ts}`);
}