<script lang="ts">
	import { generateAreaChart } from '$lib/utils/helpers';

	let {
		label,
		value = '—',
		subtitle,
		icon: Icon = $bindable(undefined as any),
		iconColor = '#f5b544',
		iconBg = 'rgba(245,181,68,0.15)',
		chartColor = '#f5b544',
		chartSeed = 42,
		showChart = true,
		loading = false,
		trend,
		trendLabel
	}: {
		label: string;
		value?: string;
		subtitle?: string;
		icon?: any;
		iconColor?: string;
		iconBg?: string;
		chartColor?: string;
		chartSeed?: number;
		showChart?: boolean;
		loading?: boolean;
		trend?: number;
		trendLabel?: string;
	} = $props();
</script>

<div class="stat-card">
	{#if loading}
		<div class="flex flex-col gap-3">
			<div class="skeleton h-4 w-24"></div>
			<div class="skeleton h-8 w-20"></div>
			<div class="skeleton h-3 w-16"></div>
		</div>
	{:else}
		<div class="flex items-start justify-between">
			<div class="flex flex-col gap-1">
				<span class="text-xs font-medium text-ink-muted uppercase tracking-wider">{label}</span>
				<span class="text-2xl font-bold text-ink-primary tabular-nums">{value}</span>
				{#if subtitle || trend != null}
					<div class="flex items-center gap-2 text-xs">
						{#if trend != null}
							<span class={trend >= 0 ? 'text-accent-mint' : 'text-accent-rose'}>
								{trend >= 0 ? '▲' : '▼'} {Math.abs(trend).toFixed(1)}%
							</span>
						{/if}
						{#if subtitle}
							<span class="text-ink-muted">{subtitle}</span>
						{/if}
					</div>
				{/if}
			</div>
			<div class="flex flex-col items-end gap-2">
				{#if Icon}
					<div
						class="w-10 h-10 rounded-lg flex items-center justify-center transition-transform group-hover:scale-110"
						style="background: {iconBg}"
					>
						<Icon size={20} style="color: {iconColor}" />
					</div>
				{/if}
				{#if showChart}
					{@html generateAreaChart(chartSeed, 64, 20, chartColor)}
				{/if}
			</div>
		</div>
	{/if}
</div>
