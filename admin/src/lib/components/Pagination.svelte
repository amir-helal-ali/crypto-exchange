<script lang="ts">
	import { ChevronLeft, ChevronRight } from 'lucide-svelte';

	interface Props {
		page: number;
		total: number;
		limit: number;
		onchange: (page: number) => void;
	}

	let { page, total, limit, onchange }: Props = $props();
	const totalPages = $derived(Math.ceil(total / limit));
</script>

{#if totalPages > 1}
	<div class="flex items-center justify-between mt-4 pt-4 glass-divider">
		<span class="text-sm text-[var(--ink-muted)]">
			عرض {((page - 1) * limit) + 1} — {Math.min(page * limit, total)} من {total}
		</span>
		<div class="flex items-center gap-2">
			<button
				class="btn-ghost text-sm"
				disabled={page <= 1}
				onclick={() => onchange(page - 1)}
			>
				<ChevronRight size={16} />
			</button>
			<span class="text-sm tabular-nums text-[var(--ink-secondary)]">
				{page} / {totalPages}
			</span>
			<button
				class="btn-ghost text-sm"
				disabled={page >= totalPages}
				onclick={() => onchange(page + 1)}
			>
				<ChevronLeft size={16} />
			</button>
		</div>
	</div>
{/if}
