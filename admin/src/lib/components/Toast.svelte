<script lang="ts">
	import { getToasts, removeToast } from '$lib/stores/toast';
	import { X } from 'lucide-svelte';

	const typeStyles: Record<string, string> = {
		success: 'border-l-4 border-l-[#22d3a4] bg-[rgba(34,211,164,0.1)]',
		error: 'border-l-4 border-l-[#fb7185] bg-[rgba(251,113,133,0.1)]',
		warning: 'border-l-4 border-l-[#f5b544] bg-[rgba(245,181,68,0.1)]',
		info: 'border-l-4 border-l-[#3b82f6] bg-[rgba(59,130,246,0.1)]'
	};

	const typeIcons: Record<string, string> = {
		success: '#22d3a4',
		error: '#fb7185',
		warning: '#f5b544',
		info: '#3b82f6'
	};
</script>

<div class="fixed top-4 left-4 z-[9999] flex flex-col gap-2 max-w-sm">
	{#each getToasts() as toast (toast.id)}
		<div
			class="panel flex items-center gap-3 px-4 py-3 shadow-lg animate-in {typeStyles[toast.type]}"
			style="animation: slideIn 0.3s ease-out"
		>
			<div class="w-2 h-2 rounded-full flex-shrink-0" style="background: {typeIcons[toast.type]}"></div>
			<span class="text-sm flex-1">{toast.message}</span>
			<button onclick={() => removeToast(toast.id)} class="text-[var(--ink-muted)] hover:text-[var(--ink-primary)] transition-colors">
				<X size={14} />
			</button>
		</div>
	{/each}
</div>

<style>
	@keyframes slideIn {
		from { transform: translateX(-100%); opacity: 0; }
		to { transform: translateX(0); opacity: 1; }
	}
</style>
