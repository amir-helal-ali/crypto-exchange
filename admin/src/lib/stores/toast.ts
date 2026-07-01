// ═══════════════════════════════════════════════════════════
// NEXUS ADMIN v4.0 — Toast Store
// ═══════════════════════════════════════════════════════════

import { writable } from 'svelte/store';

export interface ToastItem {
	id: string;
	type: 'success' | 'error' | 'info' | 'warning';
	message: string;
	duration: number;
}

function createToastStore() {
	const { subscribe, update } = writable<ToastItem[]>([]);

	function add(type: ToastItem['type'], message: string, duration = 4000) {
		const id = Math.random().toString(36).slice(2, 9);
		update((items) => [...items, { id, type, message, duration }]);
		if (duration > 0) {
			setTimeout(() => dismiss(id), duration);
		}
	}

	return {
		subscribe,
		success: (msg: string) => add('success', msg, 4000),
		error: (msg: string) => add('error', msg, 6000),
		info: (msg: string) => add('info', msg, 4000),
		warning: (msg: string) => add('warning', msg, 5000),
		dismiss(id: string) {
			update((items) => items.filter((i) => i.id !== id));
		},
		clear() {
			update(() => []);
		}
	};
}

export const toast = createToastStore();
