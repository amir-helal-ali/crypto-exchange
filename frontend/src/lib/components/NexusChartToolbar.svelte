<script lang="ts">
  /**
   * NexusChartToolbar — the floating toolbar above the chart that controls:
   *  - Chart type (candles / heikin-ashi / line / area)
   *  - Drawing tool (cursor / hline / trendline / rect / fib / eraser / clear)
   *  - Overlay indicators (SMA20 / SMA50 / EMA12 / EMA26 / BOLL / VWAP)
   *  - Sub-panel indicators (RSI / MACD)
   *
   * All props are bindable so the parent owns the canonical state.
   */
  import {
    MousePointer2,
    Minus,
    TrendingUp,
    Square,
    Sparkles,
    Eraser,
    Trash2,
    BarChart3,
    LineChart,
    AreaChart,
    CandlestickChart,
    Activity,
    Waves,
    PlusCircle
  } from 'lucide-svelte';

  type ChartType = 'candles' | 'heikin-ashi' | 'line' | 'area';
  type Tool = 'cursor' | 'hline' | 'trendline' | 'rect' | 'fib' | 'eraser';

  interface Props {
    chartType: ChartType;
    tool: Tool;
    indicators: string[];
    subIndicators: string[];
    onClearDrawings?: () => void;
  }

  let {
    chartType = $bindable('candles'),
    tool = $bindable('cursor'),
    indicators = $bindable([]),
    subIndicators = $bindable([]),
    onClearDrawings
  }: Props = $props();

  const chartTypes: { k: ChartType; label: string; icon: typeof CandlestickChart }[] = [
    { k: 'candles', label: 'شموع', icon: CandlestickChart },
    { k: 'heikin-ashi', label: 'هايكين-أشي', icon: BarChart3 },
    { k: 'line', label: 'خط', icon: LineChart },
    { k: 'area', label: 'مساحة', icon: AreaChart }
  ];

  const tools: { k: Tool; label: string; icon: typeof MousePointer2 }[] = [
    { k: 'cursor', label: 'مؤشر', icon: MousePointer2 },
    { k: 'hline', label: 'خط أفقي', icon: Minus },
    { k: 'trendline', label: 'خط اتجاه', icon: TrendingUp },
    { k: 'rect', label: 'منطقة', icon: Square },
    { k: 'fib', label: 'فيبوناتشي', icon: Sparkles },
    { k: 'eraser', label: 'ممحاة', icon: Eraser }
  ];

  const overlays: { k: string; label: string; color: string }[] = [
    { k: 'SMA20', label: 'SMA20', color: '#f5b544' },
    { k: 'SMA50', label: 'SMA50', color: '#a855f7' },
    { k: 'EMA12', label: 'EMA12', color: '#3b82f6' },
    { k: 'EMA26', label: 'EMA26', color: '#22d3a4' },
    { k: 'BOLL', label: 'BOLL', color: '#f5b544' },
    { k: 'VWAP', label: 'VWAP', color: '#a855f7' }
  ];

  const subInds: { k: string; label: string; icon: typeof Activity }[] = [
    { k: 'RSI', label: 'RSI', icon: Activity },
    { k: 'MACD', label: 'MACD', icon: Waves }
  ];

  function toggle(arr: string[], k: string): string[] {
    return arr.includes(k) ? arr.filter((x) => x !== k) : [...arr, k];
  }

  function toggleOverlay(k: string) {
    indicators = toggle(indicators, k);
  }

  function toggleSub(k: string) {
    subIndicators = toggle(subIndicators, k);
  }
</script>

<div class="flex items-center gap-2 flex-wrap px-3 py-2 border-b border-white/5 bg-ink-900/30">
  <!-- Chart type group -->
  <div class="flex items-center gap-0.5 rounded-md bg-ink-900/50 p-0.5 border border-white/5">
    {#each chartTypes as ct}
      <button
        onclick={() => (chartType = ct.k)}
        class="flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium transition-colors {chartType === ct.k ? 'bg-accent-gold/20 text-accent-gold' : 'text-slate-400 hover:text-white hover:bg-white/5'}"
        title={ct.label}
        aria-label={ct.label}
      >
        <ct.icon size={13} />
        <span class="hidden sm:inline">{ct.label}</span>
      </button>
    {/each}
  </div>

  <!-- Divider -->
  <div class="h-5 w-px bg-white/10"></div>

  <!-- Drawing tools group -->
  <div class="flex items-center gap-0.5 rounded-md bg-ink-900/50 p-0.5 border border-white/5">
    {#each tools as t}
      <button
        onclick={() => (tool = t.k)}
        class="flex items-center justify-center w-7 h-7 rounded text-[11px] font-medium transition-colors {tool === t.k ? 'bg-accent-gold/20 text-accent-gold' : 'text-slate-400 hover:text-white hover:bg-white/5'}"
        title={t.label}
        aria-label={t.label}
      >
        <t.icon size={14} />
      </button>
    {/each}
    <button
      onclick={() => onClearDrawings?.()}
      class="flex items-center justify-center w-7 h-7 rounded text-[11px] font-medium text-slate-400 hover:text-accent-rose hover:bg-accent-rose/10 transition-colors"
      title="مسح كل الرسومات"
      aria-label="مسح كل الرسومات"
    >
      <Trash2 size={14} />
    </button>
  </div>

  <!-- Divider -->
  <div class="h-5 w-px bg-white/10"></div>

  <!-- Overlay indicators -->
  <div class="flex items-center gap-1 flex-wrap">
    <span class="text-[10px] text-slate-500 hidden md:inline">طبقات</span>
    {#each overlays as ov}
      <button
        onclick={() => toggleOverlay(ov.k)}
        class="flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium transition-colors {indicators.includes(ov.k) ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'}"
        title={ov.label}
      >
        <span class="w-1.5 h-1.5 rounded-full" style="background: {ov.color};"></span>
        <span>{ov.label}</span>
        {#if indicators.includes(ov.k)}
          <svg class="w-2.5 h-2.5 text-accent-mint" viewBox="0 0 12 12" fill="none">
            <path d="M2 6l3 3 5-6" stroke="currentColor" stroke-width="2" fill="none" />
          </svg>
        {/if}
      </button>
    {/each}
  </div>

  <!-- Divider -->
  <div class="h-5 w-px bg-white/10"></div>

  <!-- Sub-panel indicators -->
  <div class="flex items-center gap-1">
    <span class="text-[10px] text-slate-500 hidden md:inline">لوحات</span>
    {#each subInds as s}
      <button
        onclick={() => toggleSub(s.k)}
        class="flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium transition-colors {subIndicators.includes(s.k) ? 'bg-accent-mint/15 text-accent-mint' : 'text-slate-400 hover:text-white hover:bg-white/5'}"
        title={s.label}
      >
        <s.icon size={12} />
        <span>{s.label}</span>
      </button>
    {/each}
  </div>
</div>
