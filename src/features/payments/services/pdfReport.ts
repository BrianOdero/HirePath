import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { supabase, projectUrl } from '@/core/services/supabase';

export interface PaymentReportResult {
  fileName: string;
  blob: Blob;
  platform: 'web' | 'native';
  uri?: string;
}

export function fileNameFromDisposition(disposition: string | null, fallback: string): string {
  const match = disposition?.match(/filename="?([^";]+)"?/i);
  return match?.[1] ?? fallback;
}

/**
 * Converts a binary Blob to a base64 encoded string.
 * Uses FileReader for streaming, memory-safe conversion without stack overflow risk.
 */
export async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(',')[1] ?? '';
      resolve(base64);
    };
    reader.onerror = () => {
      reject(reader.error ?? new Error('Failed to convert Blob to base64'));
    };
    reader.readAsDataURL(blob);
  });
}

/**
 * Fetches the payment report PDF Blob from the Supabase edge function.
 * Verified via caller's JWT; returns the raw Blob and resolved filename.
 */
export async function fetchPaymentReportBlob(): Promise<{ blob: Blob; fileName: string }> {
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

  return { blob, fileName };
}

/**
 * Resilient Web Download:
 * Fixes desktop & web browser issues by:
 * 1. Appending the temporary anchor to document.body (required by Firefox and iOS Safari).
 * 2. Delaying URL.revokeObjectURL to avoid premature cancellation of the browser download stream.
 */
export async function downloadPdfWeb(blob: Blob, fileName: string): Promise<void> {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.style.display = 'none';
  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = 'noopener noreferrer';

  document.body.appendChild(anchor);
  anchor.click();

  // Allow download pipeline to claim the object URL before revoking
  setTimeout(() => {
    if (document.body.contains(anchor)) {
      document.body.removeChild(anchor);
    }
    URL.revokeObjectURL(url);
  }, 2500);
}

/**
 * Native Mobile File Saving:
 * Solves Capacitor WebView void where synthetic <a> clicks have no native download manager.
 * Converts Blob to base64 and writes directly to native Documents directory.
 * Falls back to Cache directory if Documents permission is restricted.
 */
export async function savePdfToDevice(
  blob: Blob,
  fileName: string
): Promise<{ uri: string; filePath: string }> {
  const base64Data = await blobToBase64(blob);

  try {
    const writeResult = await Filesystem.writeFile({
      path: fileName,
      data: base64Data,
      directory: Directory.Documents,
      recursive: true,
    });
    return { uri: writeResult.uri, filePath: writeResult.uri };
  } catch (error) {
    // Fallback to Cache directory if Documents directory is blocked by permissions
    console.warn('Saving to Documents failed, attempting Cache directory:', error);
    const cacheResult = await Filesystem.writeFile({
      path: fileName,
      data: base64Data,
      directory: Directory.Cache,
      recursive: true,
    });
    return { uri: cacheResult.uri, filePath: cacheResult.uri };
  }
}

/**
 * Native Mobile Share / Open Handoff:
 * Leverages @capacitor/share to trigger the Android/iOS system sheet,
 * allowing users to view, air-drop, print, or hand off the PDF to their native viewer.
 */
export async function sharePdfFile(fileUri: string, fileName: string): Promise<void> {
  const isNative = Capacitor.isNativePlatform();

  if (isNative) {
    await Share.share({
      title: fileName,
      text: 'HirePath Payment Receipt & Transaction Statement',
      url: fileUri,
      files: [fileUri],
      dialogTitle: 'Save or Share PDF Report',
    });
    return;
  }

  // Web Share API fallback if supported on desktop/mobile web
  if (typeof navigator !== 'undefined' && 'share' in navigator) {
    try {
      await navigator.share({
        title: fileName,
        text: 'HirePath Payment Receipt',
        url: window.location.href,
      });
    } catch {
      // User cancelled or share unhandled; non-fatal
    }
  }
}

/**
 * Unified Export Orchestrator:
 * Detects whether the runtime is native Capacitor (Android/iOS) or Web.
 * - On Native: saves to device storage and prompts system share sheet.
 * - On Web: initiates resilient anchor download with delayed cleanup.
 */
export async function exportPaymentReport(): Promise<PaymentReportResult> {
  const { blob, fileName } = await fetchPaymentReportBlob();
  const isNative = Capacitor.isNativePlatform();

  if (isNative) {
    const { uri } = await savePdfToDevice(blob, fileName);
    try {
      await sharePdfFile(uri, fileName);
    } catch (shareErr) {
      console.warn('Share sheet dismissed or failed:', shareErr);
    }
    return { fileName, blob, platform: 'native', uri };
  }

  await downloadPdfWeb(blob, fileName);
  return { fileName, blob, platform: 'web' };
}

/**
 * Backward compatible wrapper for generatePaymentReportPdf
 */
export async function generatePaymentReportPdf(): Promise<{ fileName: string }> {
  const result = await exportPaymentReport();
  return { fileName: result.fileName };
}
