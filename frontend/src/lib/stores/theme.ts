import { writable } from 'svelte/store';

/**
 * Theme store — DARK-ONLY.
 *
 * Light mode was intentionally removed from the product. The platform is
 * designed exclusively for dark mode (deep-space observatory aesthetic).
 * This store is retained as a no-op shim so any legacy imports continue
 * to type-check, but every call is a no-op: the data-theme attribute is
 * always "dark" and never changes.
 */
export type ThemeMode = 'dark';

export const theme = writable<{ mode: 'dark'; resolved: 'dark' }>({
  mode: 'dark',
  resolved: 'dark'
});

/** No-op — kept for backward compatibility with older callers. */
export function initTheme() {
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-theme', 'dark');
  }
}
