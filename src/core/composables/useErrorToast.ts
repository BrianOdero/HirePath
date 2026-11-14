import { ref } from 'vue';

/**
 * App-wide error toast state. Runtime errors (network, auth, edge functions,
 * payments) surface as a single danger toast that clears itself after 5s.
 * Field-level validation messages stay inline next to their inputs instead.
 */
export const errorToastMessage = ref('');
export const errorToastKey = ref(0);

export function showErrorToast(message: string): void {
  const text = message?.trim();
  if (!text) return;
  errorToastMessage.value = text;
  // Re-key so consecutive errors retrigger the toast even while one is showing.
  errorToastKey.value += 1;
}
