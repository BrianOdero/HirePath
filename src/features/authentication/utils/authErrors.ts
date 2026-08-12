export type AuthErrorCode =
  | 'invalid_credentials'
  | 'email_not_confirmed'
  | 'user_already_exists'
  | 'over_request_rate_limit'
  | 'over_email_send_rate_limit'
  | 'weak_password'
  | 'email_address_invalid'
  | string;

export interface MappedAuthError {
  message: string;
  code: AuthErrorCode | null;
}

const FRIENDLY_MESSAGES: Record<string, string> = {
  invalid_credentials: 'Incorrect email or password. Check the details and try again.',
  email_not_confirmed: 'Check your inbox to verify your email before signing in.',
  user_already_exists: 'An account with this email already exists. Sign in instead.',
  over_request_rate_limit: 'Too many attempts. Try again in a few minutes.',
  over_email_send_rate_limit: 'Too many emails sent. Try again in a few minutes.',
  email_address_invalid: 'Enter a valid email address, e.g. you@example.com.',
};

function extractCode(error: unknown): AuthErrorCode | null {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === 'string' && code !== '') return code;
  }
  return null;
}

function extractMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message.replace(/^AuthApiError:\s*/i, '');
  }
  return String(error);
}

export function mapAuthError(error: unknown): MappedAuthError {
  const code = extractCode(error);
  const codeMessage = code ? FRIENDLY_MESSAGES[code] : undefined;
  if (codeMessage) return { message: codeMessage, code };

  const raw = extractMessage(error);
  if (!raw || raw === 'Error' || raw === '[object Object]') {
    return { message: 'Something went wrong. Please try again.', code };
  }
  return { message: raw, code };
}

export function authErrorMessage(error: unknown): string {
  return mapAuthError(error).message;
}

export function isAuthErrorCode(error: unknown, code: string): boolean {
  return extractCode(error) === code;
}