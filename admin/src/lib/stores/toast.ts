// ─── Global Toast Store ───────────────────────────────────────
import { writable } from 'svelte/store';

export interface ToastItem {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  duration?: number;
}

let nextId = 0;

function createToastStore() {
  const { subscribe, update } = writable<ToastItem[]>([]);

  return {
    subscribe,
    show(message: string, type: ToastItem['type'] = 'info', duration: number = 4000) {
      const id = nextId++;
      update(toasts => [...toasts, { id, message, type, duration }]);
      if (duration > 0) {
        setTimeout(() => {
          update(toasts => toasts.filter(t => t.id !== id));
        }, duration);
      }
    },
    success(message: string) { return this.show(message, 'success'); },
    error(message: string) { return this.show(message, 'error', 6000); },
    info(message: string) { return this.show(message, 'info'); },
    warning(message: string) { return this.show(message, 'warning', 5000); },
    dismiss(id: number) {
      update(toasts => toasts.filter(t => t.id !== id));
    },
    clear() {
      update(() => []);
    }
  };
}

export const toast = createToastStore();
