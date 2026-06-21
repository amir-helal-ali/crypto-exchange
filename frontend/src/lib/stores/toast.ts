import { writable } from 'svelte/store';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: number;
  type: ToastType;
  message: string;
  duration?: number;
}

let nextId = 1;

function createToastStore() {
  const { subscribe, update } = writable<Toast[]>([]);

  function add(type: ToastType, message: string, duration: number = 4000) {
    const id = nextId++;
    update((toasts) => [...toasts, { id, type, message, duration }]);
    if (duration > 0) {
      setTimeout(() => {
        remove(id);
      }, duration);
    }
    return id;
  }

  function remove(id: number) {
    update((toasts) => toasts.filter((t) => t.id !== id));
  }

  return {
    subscribe,
    remove,
    success: (msg: string, d?: number) => add('success', msg, d),
    error: (msg: string, d?: number) => add('error', msg, d ?? 5000),
    info: (msg: string, d?: number) => add('info', msg, d),
    warning: (msg: string, d?: number) => add('warning', msg, d)
  };
}

export const toasts = createToastStore();
