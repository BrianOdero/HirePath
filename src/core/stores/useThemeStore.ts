import { defineStore } from 'pinia';
import { ref } from 'vue';
import { Preferences } from '@capacitor/preferences';

export type ThemeMode = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'hirepath.theme.mode';
const DARK_QUERY = '(prefers-color-scheme: dark)';

function systemPrefersDark(): boolean {
  return window.matchMedia(DARK_QUERY).matches;
}

export const useThemeStore = defineStore('theme', () => {
  const mode = ref<ThemeMode>('system');
  const resolved = ref<'light' | 'dark'>('light');
  let mediaQuery: MediaQueryList | null = null;
  let mediaListener: ((event: MediaQueryListEvent) => void) | null = null;

  function apply(): void {
    document.documentElement.dataset.theme = resolved.value;
    document.documentElement.style.colorScheme = resolved.value;
  }

  function resolve(): void {
    if (mode.value === 'system') {
      resolved.value = systemPrefersDark() ? 'dark' : 'light';
    } else {
      resolved.value = mode.value;
    }
    apply();
  }

  function watchSystem(): void {
    if (mode.value !== 'system') {
      if (mediaQuery && mediaListener) {
        mediaQuery.removeEventListener('change', mediaListener);
        mediaQuery = null;
        mediaListener = null;
      }
      return;
    }
    mediaQuery = window.matchMedia(DARK_QUERY);
    mediaListener = (event) => {
      resolved.value = event.matches ? 'dark' : 'light';
      apply();
    };
    mediaQuery.addEventListener('change', mediaListener);
  }

  async function setMode(next: ThemeMode): Promise<void> {
    mode.value = next;
    resolve();
    watchSystem();
    await Preferences.set({ key: STORAGE_KEY, value: next });
  }

  async function init(): Promise<void> {
    const { value } = await Preferences.get({ key: STORAGE_KEY });
    mode.value = (value as ThemeMode) ?? 'system';
    resolve();
    watchSystem();
  }

  return { mode, resolved, init, setMode };
});
