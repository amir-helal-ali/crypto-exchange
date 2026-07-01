<script lang="ts">
	import { fade, scale } from 'svelte/transition';
	import type { ToastItem } from '$lib/stores/toast';
	import { X, CheckCircle, AlertTriangle, Info, AlertOctagon } from 'lucide-svelte';

	let { items = $bindable([]) } = $props<{ items: ToastItem[] }>();

	const iconMap = {
		success: CheckCircle,
		error: AlertOctagon,
		warning: AlertTriangle,
		info: Info
	};
	const colorMap = {
		success: { border: 'border-accent-mint/25', bg: 'bg-accent-mint/10', icon: 'text-accent-mint' },
		error: { border: 'border-accent-rose/25', bg: 'bg-accent-rose/10', icon: 'text-accent-rose' },
		warning: { border: 'border-accent-gold/25', bg: 'bg-accent-gold/10', icon: 'text-accent-gold' },
		info: { border: 'border-accent-azure/25', bg: 'bg-accent-azure/10', icon: 'text-accent-azure' }
	};

	function dismiss(id: string) {
		items = items.filter((i) => i.id !== id);
	}
</script>

{#if items.length > 0}
	<div class="fixed top-4 left-1/2 -translate-x-1/2 z-[200] flex flex-col gap-2 w-full max-w-md px-4">
		{#each items as item (item.id)}
			{@const colors = colorMap[item.type]}
			{@const Icon = iconMap[item.type]}
			<div
				class="panel {colors.border} {colors.bg} flex items-center gap-3 px-4 py-3 animate-slide-down"
				transition:scale={{ start: 0.95, duration: 200 }}
			>
				<Icon size={18} class={colors.icon} />
				<span class="text-sm text-ink-primary flex-1">{item.message}</span>
				<button onclick={() => dismiss(item.id)} class="text-ink-muted hover:text-ink-primary transition-colors">
					<X size={14} />
				</button>
			</div>
		{/each}
	</div>
{/if}
