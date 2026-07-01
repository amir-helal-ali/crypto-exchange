// ═══════════════════════════════════════════════════════════
// NEXUS ADMIN v6.0 — Toast Store
// ═══════════════════════════════════════════════════════════

export interface ToastItem {
	id: number;
	type: 'success' | 'error' | 'warning' | 'info';
	message: string;
}

let counter = 0;
let toasts: ToastItem[] = $state([]);

export function getToasts(): ToastItem[] {
	return toasts;
}

export function addToast(type: ToastItem['type'], message: string) {
	const id = ++counter;
	toasts = [...toasts, { id, type, message }];
	setTimeout(() => {
		toasts = toasts.filter(t => t.id !== id);
	}, 4000);
}

export function removeToast(id: number) {
	toasts = toasts.filter(t => t.id !== id);
}
