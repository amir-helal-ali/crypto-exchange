<script lang="ts">
  import { generateAreaChart } from '$lib/utils/helpers';

  let {
    label = '',
    value = 0,
    subtitle = '',
    icon = null as any,
    iconColor = '#f5b544',
    iconBg = 'rgba(245,181,68,0.12)',
    chartColor = '#f5b544',
    chartSeed = 0,
    showChart = true,
    loading = false,
    trend = 0,
    trendLabel = ''
  } = $props<{
    label: string;
    value: number;
    subtitle?: string;
    icon: any;
    iconColor?: string;
    iconBg?: string;
    chartColor?: string;
    chartSeed?: number;
    showChart?: boolean;
    loading?: boolean;
    trend?: number;
    trendLabel?: string;
  }>();

  let formattedValue = $derived(
    typeof value === 'number' ? value.toLocaleString('ar-EG') : value
  );
</script>

<div class="stat-card group">
  {#if loading}
    <div class="flex items-start justify-between">
      <div class="space-y-3 flex-1">
        <div class="animate-shimmer h-3 w-20 rounded" style="background: rgba(255,255,255,0.05);"></div>
        <div class="animate-shimmer h-8 w-28 rounded" style="background: rgba(255,255,255,0.05);"></div>
        <div class="animate-shimmer h-3 w-16 rounded" style="background: rgba(255,255,255,0.04);"></div>
      </div>
      <div class="animate-shimmer h-11 w-11 rounded-xl" style="background: rgba(255,255,255,0.05);"></div>
    </div>
    <div class="animate-shimmer h-8 w-full mt-4 rounded" style="background: rgba(255,255,255,0.03);"></div>
  {:else}
    <div class="flex items-start justify-between">
      <div class="flex-1 min-w-0">
        <p class="text-[11px] font-semibold tracking-wider uppercase" style="color: var(--text-quaternary);">{label}</p>
        <p class="text-3xl font-bold font-mono tabular-nums mt-1" style="color: {iconColor};">
          {formattedValue}
        </p>
        {#if subtitle || trendLabel}
          <div class="flex items-center gap-2 mt-1">
            {#if trend !== 0}
              <span class="text-[11px] font-semibold" style="color: {trend > 0 ? '#22d3a4' : '#f43f7a'};">
                {trend > 0 ? '▲' : '▼'} {Math.abs(trend)}%
              </span>
            {/if}
            {#if trendLabel}
              <span class="text-[11px]" style="color: var(--text-quaternary);">{trendLabel}</span>
            {/if}
          </div>
        {/if}
      </div>
      <div
        class="flex items-center justify-center w-11 h-11 rounded-xl transition-all duration-300 group-hover:scale-110 group-hover:shadow-lg shrink-0"
        style="background: {iconBg}; box-shadow: 0 0 20px {iconBg};"
      >
        <icon size={20} style="color: {iconColor};"></icon>
      </div>
    </div>

    {#if showChart}
      <div class="mt-3 -mb-1 flex justify-end opacity-60 group-hover:opacity-100 transition-opacity duration-300">
        {@html generateAreaChart(chartColor, chartSeed)}
      </div>
    {/if}
  {/if}
</div>
