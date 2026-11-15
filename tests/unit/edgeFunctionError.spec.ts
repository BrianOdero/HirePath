import { describe, expect, it, vi } from 'vitest';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { edgeFunctionError } from '@/core/services/supabaseInterviewApi';

// supabase.ts throws at module load without env vars; stub the client so
// these unit tests stay hermetic in CI (which has no Supabase secrets).
vi.mock('@/core/services/supabase', () => ({ supabase: {} }));

function httpErrorWith(body: unknown, status = 402): FunctionsHttpError {
  const response = new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
  return new FunctionsHttpError(response);
}

describe('edgeFunctionError', () => {
  it('extracts the error code from the response body', async () => {
    const error = httpErrorWith({ error: 'free_limit_reached' });
    expect(await edgeFunctionError(error)).toBe('free_limit_reached');
  });

  it('falls back to the generic message when the body has no code', async () => {
    const error = httpErrorWith({ unexpected: 'shape' });
    expect(await edgeFunctionError(error)).toContain('non-2xx');
  });

  it('passes through plain error messages', async () => {
    expect(await edgeFunctionError(new Error('network down'))).toBe('network down');
  });
});
