<script lang="ts">
  import { generateSparkline } from '$lib/utils/helpers';

  let {
    label = '',
    value = 0,
    icon = null as any,
    iconColor = '#f5b544',
    iconBg = 'rgba(245,181,68,0.12)',
    sparkColor = '#f5b544',
    sparkSeed = 0,
    showSparkline = true,
    loading = false
  } = $props<{
    label: string;
    value: number;
    icon: any;
    iconColor?: string;
    iconBg?: string;
    sparkColor?: string;
    sparkSeed?: number;
    showSparkline?: boolean;
    loading?: boolean;
  }>();
</script>

<div class="stat-card group">
  {#if loading}
    <div class="flex items-start justify-between">
      <div class="space-y-3 flex-1">
        <div class="animate-shimmer h-4 w-24 rounded" style="background: rgba(255,255,255,0.06);"></div>
        <div class="animate-shimmer h-8 w-32 rounded" style="background: rgba(255,255,255,0.06);"></div>
      </div>
      <div class="animate-shimmer h-12 w-12 rounded-xl" style="background: rgba(255,255,255,0.06);"></div>
    </div>
    <div class="animate-shimmer h-7 w-full mt-4 rounded" style="background: rgba(255,255,255,0.04);"></div>
  {:else}
    <div class="flex items-start justify-between">
      <div class="space-y-1 flex-1">
        <p class="text-xs font-medium" style="color: var(--text-tertiary);">{label}</p>
        <p class="text-3xl font-bold font-mono tabular-nums" style="color: {iconColor};">
          {value.toLocaleString('ar-EG')}
        </p>
      </div>
      <div
        class="flex items-center justify-center w-12 h-12 rounded-xl transition-transform duration-300 group-hover:scale-110"
        style="background: {iconBg};"
      >
        <icon size={22} style="color: {iconColor};" />
      </div>
    </div>

    {#if showSparkline}
      <div class="mt-4 -mb-1 flex justify-end">
        {@html generateSparkline(sparkColor, sparkSeed)}
      </div>
    {/if}
  {/if}
</div>
