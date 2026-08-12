// generate-report — builds an A4 PDF of the user's payment history and
// archives it in the private `payments-reports` bucket under
// payments-reports/<user id>/<timestamp>-report.pdf. Runs with the
// service role key (server-side only), so neither the payments query nor
// the archive upload depend on RLS; the caller's identity is still
// verified via their JWT and every query is scoped to that user's id.
// Returns the PDF bytes directly so the client never touches storage.

import { createAuthedClient } from '../_shared/supabase.ts';
import { createServiceRoleClient } from '../_shared/admin.ts';
import { corsHeaders, json } from '../_shared/cors.ts';
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'npm:pdf-lib@1.17.1';

interface PaymentRow {
  id: string;
  checkout_request_id: string | null;
  merchant_request_id: string | null;
  amount: number;
  phone: string;
  status: string;
  result_code: string | null;
  result_desc: string | null;
  created_at: string;
}

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 48;
const CONTENT_W = PAGE_W - MARGIN * 2;
const ROW_H = 16;
const HEADER_H = 18;

const STATUS_COLORS: Record<string, unknown> = {
  paid: rgb(0.12, 0.62, 0.28),
  pending: rgb(0.85, 0.6, 0.1),
  failed: rgb(0.82, 0.18, 0.18),
  expired: rgb(0.45, 0.48, 0.52),
};

function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function truncate(text: string | null, max: number): string {
  const value = (text ?? '').trim();
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}…`;
}

function formatEat(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('en-GB', {
    timeZone: 'Africa/Nairobi',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function formatShort(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('en-GB', {
    timeZone: 'Africa/Nairobi',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

async function buildReportPdf(user: { email?: string }, payments: PaymentRow[]): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const totalPaid = payments
    .filter((p) => p.status === 'paid')
    .reduce((sum, p) => sum + (p.amount ?? 0), 0);
  const counts = payments.reduce<Record<string, number>>((acc, p) => {
    acc[p.status] = (acc[p.status] ?? 0) + 1;
    return acc;
  }, {});

  const header = (page: PDFPage, y: number): number => {
    page.drawText('HirePath', { x: MARGIN, y, size: 22, font: bold, color: rgb(0.1, 0.2, 0.4) });
    page.drawText('Payment Report', { x: MARGIN, y: y - 18, size: 14, font, color: rgb(0.3, 0.33, 0.38) });
    page.drawText(`Account: ${user.email ?? 'HirePath user'}`, { x: MARGIN, y: y - 34, size: 9, font });
    page.drawText(`Generated: ${formatEat(new Date().toISOString())} (EAT)`, { x: MARGIN + 300, y: y - 34, size: 9, font });
    page.drawRectangle({ x: MARGIN, y: y - 45, width: CONTENT_W, height: 1, color: rgb(0.82, 0.85, 0.88) });
    return y - 60;
  };

  const summaryY = (page: PDFPage, y: number): number => {
    page.drawText('Summary', { x: MARGIN, y, size: 11, font: bold });
    page.drawText(`Total paid: KES ${totalPaid}`, { x: MARGIN, y: y - 16, size: 9.5, font });
    page.drawText(`Paid: ${counts.paid ?? 0}   Pending: ${counts.pending ?? 0}   Failed: ${counts.failed ?? 0}   Expired: ${counts.expired ?? 0}`, {
      x: MARGIN + 160, y: y - 16, size: 9.5, font,
    });
    page.drawText(`Transactions: ${payments.length}`, { x: MARGIN + 160, y: y - 30, size: 9.5, font });
    return y - 46;
  };

  const COLS = [
    { label: 'Date', x: 0, w: 78 },
    { label: 'Checkout ID', x: 78, w: 100 },
    { label: 'Merchant ID', x: 178, w: 90 },
    { label: 'Phone', x: 268, w: 78 },
    { label: 'Amount (KES)', x: 346, w: 96 },
    { label: 'Status', x: 442, w: 52 },
    { label: 'Result', x: 494, w: 45 },
  ];
  const totalW = COLS.reduce((sum, c) => sum + c.w, 0);
  const scale = CONTENT_W / totalW;

  let page = doc.addPage([PAGE_W, PAGE_H]);
  let y = header(page, PAGE_H - 56);
  y = summaryY(page, y) - 6;

  const drawHeadRow = () => {
    page.drawRectangle({
      x: MARGIN, y: y - HEADER_H + 4, width: CONTENT_W, height: HEADER_H - 4,
      color: rgb(0.93, 0.95, 0.97),
    });
    for (const col of COLS) {
      page.drawText(col.label, {
        x: MARGIN + col.x * scale, y,
        size: 8.5, font: bold, color: rgb(0.25, 0.28, 0.33),
      });
    }
    y -= HEADER_H;
  };

  drawHeadRow();

  for (const p of payments) {
    const rowTexts = [
      formatShort(p.created_at),
      truncate(p.checkout_request_id, 18),
      truncate(p.merchant_request_id, 16),
      truncate(p.phone, 13),
      String(p.amount ?? 0),
      p.status,
      truncate(p.result_desc, 30),
    ];
    const lines = Math.max(1, ...rowTexts.map((t, i) => wrap(t, font, 8, COLS[i].w * scale - 6).length));
    const blockH = Math.max(ROW_H, lines * 12 + 6);

    if (y - blockH < 56) {
      page = doc.addPage([PAGE_W, PAGE_H]);
      y = header(page, PAGE_H - 56);
      drawHeadRow();
    }

    page.drawRectangle({ x: MARGIN, y: y - 0.4, width: CONTENT_W, height: 0.4, color: rgb(0.92, 0.93, 0.95) });

    for (let i = 0; i < COLS.length; i++) {
      const col = COLS[i];
      const color = i === 5 ? (STATUS_COLORS[p.status] ?? rgb(0.3, 0.33, 0.38)) : rgb(0.28, 0.31, 0.36);
      wrap(rowTexts[i], font, 8, col.w * scale - 6).forEach((line, lineIdx) => {
        page.drawText(line, { x: MARGIN + col.x * scale + 3, y: y - 4 - lineIdx * 12, size: 8, font, color });
      });
    }
    y -= blockH;
  }

  const pageCount = doc.getPageCount();
  for (let i = 0; i < pageCount; i++) {
    doc.getPage(i).drawText(`HirePath — page ${i + 1} of ${pageCount}`, {
      x: MARGIN, y: 32, size: 8, font, color: rgb(0.55, 0.58, 0.62),
    });
  }

  return doc.save();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  try {
    // Verify the caller's identity from their own JWT first.
    const authed = createAuthedClient(req.headers.get('Authorization'));
    const {
      data: { user },
      error: userError,
    } = await authed.auth.getUser();
    if (userError || !user) return json({ error: 'unauthorized' }, 401);

    // RLS-bypassing queries: scoped strictly to the verified user.
    const admin = createServiceRoleClient();
    const { data: payments, error: queryError } = await admin
      .from('payments')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (queryError) return json({ error: 'payments_query_failed', detail: queryError.message }, 500);

    const pdfBytes = await buildReportPdf(user, (payments ?? []) as PaymentRow[]);

    const fileName = `${new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19)}-payment-report.pdf`;
    const filePath = `payments-reports/${user.id}/${fileName}`;

    const { error: uploadError } = await admin.storage
      .from('payments-reports')
      .upload(filePath, pdfBytes, { contentType: 'application/pdf', upsert: true });

    if (uploadError) return json({ error: 'report_upload_failed', detail: uploadError.message }, 500);

    return new Response(pdfBytes, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'internal_error';
    return json({ error: message }, 500);
  }
});