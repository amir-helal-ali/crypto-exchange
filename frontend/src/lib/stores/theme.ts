import { writable } from 'svelte/store';
import { browser } from '$app/environment';

export type ThemeMode = 'dark' | 'light' | 'system';

const STORAGE_KEY = 'nexus-theme';

function getSystemTheme(): 'dark' | 'light' {
  if (!browser) return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function getStoredMode(): ThemeMode {
  if (!browser) return 'dark';
  const stored = localStorage.getItem(STORAGE_KEY) as ThemeMode | null;
  if (stored === 'dark' || stored === 'light' || stored === 'system') return stored;
  return 'dark';
}

function resolveTheme(mode: ThemeMode): 'dark' | 'light' {
  return mode === 'system' ? getSystemTheme() : mode;
}

function applyTheme(resolved: 'dark' | 'light') {
  if (!browser) return;
  const html = document.documentElement;
  html.setAttribute('data-theme', resolved);
  // Update meta theme-color for mobile browser UI
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute('content', resolved === 'dark' ? '#050813' : '#f8fafc');
  }
}

function createThemeStore() {
  // SSR-safe init: default to dark
  const initialMode: ThemeMode = browser ? getStoredMode() : 'dark';
  const initialResolved = resolveTheme(initialMode);

  const { subscribe, set, update } = writable<{
    mode: ThemeMode;
    resolved: 'dark' | 'light';
  }>({ mode: initialMode, resolved: initialResolved });

  // Apply on client
  if (browser) {
    applyTheme(initialResolved);

    // Listen for system theme changes if in 'system' mode
    window
      .matchMedia('(prefers-color-scheme: dark)')
      .addEventListener('change', (e) => {
        update((s) => {
          if (s.mode !== 'system') return s;
          const newResolved = e.matches ? 'dark' : 'light';
          applyTheme(newResolved);
          return { ...s, resolved: newResolved };
        });
      });
  }

  return {
    subscribe,
    setMode(mode: ThemeMode) {
      const resolved = resolveTheme(mode);
      if (browser) {
        localStorage.setItem(STORAGE_KEY, mode);
        applyTheme(resolved);
      }
      set({ mode, resolved });
    },
    toggle() {
      let nextMode: ThemeMode = 'dark';
      update((s) => {
        // Toggle between dark <-> light directly (skip 'system')
        nextMode = s.resolved === 'dark' ? 'light' : 'dark';
        const resolved = nextMode;
        if (browser) {
          localStorage.setItem(STORAGE_KEY, nextMode);
          applyTheme(resolved);
        }
        return { mode: nextMode, resolved };
      });
    },
    /** Apply theme immediately on page load (call from inline script in app.html to prevent FOUC) */
    init() {
      if (!browser) return;
      const mode = getStoredMode();
      const resolved = resolveTheme(mode);
      applyTheme(resolved);
      set({ mode, resolved });
    }
  };
}

export const theme = createThemeStore();
