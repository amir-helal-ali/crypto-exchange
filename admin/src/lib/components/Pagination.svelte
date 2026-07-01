<script lang="ts">
	import { formatNumber } from '$lib/utils/helpers';
	import { ChevronLeft, ChevronRight } from 'lucide-svelte';

	let {
		page = $bindable(1),
		totalPages = 1,
		totalItems = 0,
		itemLabel = 'عنصر'
	}: {
		page: number;
		totalPages: number;
		totalItems: number;
		itemLabel?: string;
	} = $props();

	function goTo(p: number) {
		if (p >= 1 && p <= totalPages) page = p;
	}

	let pages = $derived.by(() => {
		const arr: (number | string)[] = [];
		if (totalPages <= 7) {
			for (let i = 1; i <= totalPages; i++) arr.push(i);
		} else {
			arr.push(1);
			if (page > 3) arr.push('…');
			for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) arr.push(i);
			if (page < totalPages - 2) arr.push('…');
			arr.push(totalPages);
		}
		return arr;
	});
</script>

{#if totalPages > 1}
	<div class="flex items-center justify-between pt-4">
		<span class="text-sm text-ink-muted">
			{formatNumber(totalItems)} {itemLabel}
		</span>
		<div class="flex items-center gap-1">
			<button
				class="btn-ghost px-2 py-1.5 disabled:opacity-30"
				onclick={() => goTo(page - 1)}
				disabled={page <= 1}
			>
				<ChevronRight size={16} />
			</button>
			{#each pages as p}
				{#if p === '…'}
					<span class="px-2 text-ink-muted">…</span>
				{:else}
					<button
						class="min-w-[32px] h-8 rounded-lg text-sm font-medium transition-all {p === page
							? 'bg-accent-gold/15 text-accent-gold border border-accent-gold/20'
							: 'text-ink-secondary hover:bg-white/5'}"
						onclick={() => goTo(p as number)}
					>
						{p}
					</button>
				{/if}
			{/each}
			<button
				class="btn-ghost px-2 py-1.5 disabled:opacity-30"
				onclick={() => goTo(page + 1)}
				disabled={page >= totalPages}
			>
				<ChevronLeft size={16} />
			</button>
		</div>
	</div>
{/if}
