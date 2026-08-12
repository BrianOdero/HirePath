import { supabase, projectUrl } from '@/core/services/supabase';

function fileNameFromDisposition(disposition: string | null, fallback: string): string {
  const match = disposition?.match(/filename="?([^";]+)"?/i);
  return match?.[1] ?? fallback;
}

/**
 * Generates the payment report PDF server-side: the `generate-report`
 * edge function verifies the caller's JWT, loads the user's payments
 * with the service role key (RLS-bypassing, but strictly scoped to the
 * caller's user id), archives the file, and returns the PDF bytes.
 * The client only ever sends its own access token — no secrets.
 */
export async function generatePaymentReportPdf(): Promise<{ fileName: string }> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const accessToken = session?.access_token;
  if (!accessToken) throw new Error('Sign in to download a payment report.');

  const response = await fetch(`${projectUrl}/functions/v1/generate-report`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: '{}',
  });

  if (!response.ok) {
    let message = `Report generation failed (${response.status})`;
    try {
      const body = await response.json();
      if (typeof body.error === 'string' && body.error) message = body.error;
    } catch {
      // keep the generic message when the body is not JSON
    }
    throw new Error(message);
  }

  const blob = await response.blob();
  const fileName = fileNameFromDisposition(
    response.headers.get('Content-Disposition'),
    `payment-report-${new Date().toISOString().slice(0, 10)}.pdf`
  );

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
  return { fileName };
}