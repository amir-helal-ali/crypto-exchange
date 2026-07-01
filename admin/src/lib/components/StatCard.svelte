<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		title: string;
		value: string | number;
		subtitle?: string;
		accent?: string;
		icon?: Snippet;
		sparkline?: string;
	}

	let { title, value, subtitle, accent = '#f5b544', icon, sparkline }: Props = $props();
</script>

<div class="panel stat-card group">
	<div class="flex items-start justify-between">
		<div class="flex-1">
			<p class="text-xs font-medium text-[var(--ink-muted)] mb-1">{title}</p>
			<p class="text-2xl font-black tabular-nums tracking-tight" style="color: {accent}">
				{value}
			</p>
			{#if subtitle}
				<p class="text-xs text-[var(--ink-muted)] mt-1">{subtitle}</p>
			{/if}
		</div>
		{#if icon}
			<div class="w-10 h-10 rounded-lg flex items-center justify-center transition-all duration-200 group-hover:scale-110"
				style="background: {accent}15; color: {accent}">
				{@render icon()}
			</div>
		{/if}
	</div>
	{#if sparkline}
		<div class="mt-2 opacity-70 group-hover:opacity-100 transition-opacity">
			{@html sparkline}
		</div>
	{/if}
</div>
