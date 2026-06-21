import { writable } from 'svelte/store';
import { browser } from '$app/environment';
import type { User } from '$lib/api/types';

function createAuthStore() {
  let initialUser: User | null = null;
  if (browser) {
    const raw = localStorage.getItem('user');
    if (raw) {
      try {
        initialUser = JSON.parse(raw);
      } catch {
        initialUser = null;
      }
    }
  }

  const { subscribe, set, update } = writable<User | null>(initialUser);

  return {
    subscribe,
    setUser: (user: User | null) => {
      if (browser) {
        if (user) {
          localStorage.setItem('user', JSON.stringify(user));
        } else {
          localStorage.removeItem('user');
        }
      }
      set(user);
    },
    clear: () => {
      if (browser) {
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        localStorage.removeItem('refresh_token');
      }
      set(null);
    },
    isAuthenticated: () => {
      if (!browser) return false;
      return !!localStorage.getItem('token');
    }
  };
}

export const authStore = createAuthStore();
