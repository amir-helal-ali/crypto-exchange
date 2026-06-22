<script lang="ts">
  /**
   * IndicatorSettingsModal
   * Pro-grade modal for customizing indicator periods, colors, and visibility.
   * Config is bindable so parent can persist to localStorage.
   */
  import { X, RotateCcw, SlidersHorizontal, Palette, Activity, BarChart3 } from 'lucide-svelte';
  import type { IndicatorConfig } from './NexusChart.svelte';

  interface Props {
    open: boolean;
    config: IndicatorConfig;
    onsave?: (cfg: IndicatorConfig) => void;
    onreset?: () => void;
  }

  let { open = $bindable(false), config = $bindable<IndicatorConfig>(), onsave, onreset }: Props = $props();

  // Local working copy
  let draft = $state<IndicatorConfig>({ ...config });

  // Re-sync draft when modal opens
  $effect(() => {
    if (open) {
      draft = {
        ...config,
        colors: { ...(config.colors || {}) }
      };
    }
  });

  const defaults: IndicatorConfig = {
    sma20Period: 20,
    sma50Period: 50,
    ema12Period: 12,
    ema26Period: 26,
    bollPeriod: 20,
    bollStd: 2,
    rsiPeriod: 14,
    macdFast: 12,
    macdSlow: 26,
    macdSignal: 9,
    colors: {
      SMA20: '#f5b544',
      SMA50: '#a855f7',
      EMA12: '#3b82f6',
      EMA26: '#22d3a4'
    }
  };

  const indicatorDefs: Array<{
    key: keyof IndicatorConfig;
    label: string;
    min: number;
    max: number;
    desc: string;
  }> = [
    { key: 'sma20Period', label: 'SMA قصيرة', min: 2, max: 200, desc: 'المتوسط المتحرك البسيط - الفترة القصيرة' },
    { key: 'sma50Period', label: 'SMA طويلة', min: 5, max: 400, desc: 'المتوسط المتحرك البسيط - الفترة الطويلة' },
    { key: 'ema12Period', label: 'EMA سريعة', min: 2, max: 200, desc: 'المتوسط الأسي - خط سريع' },
    { key: 'ema26Period', label: 'EMA بطيئة', min: 5, max: 400, desc: 'المتوسط الأسي - خط بطيء' },
    { key: 'bollPeriod', label: 'بولينجر - الفترة', min: 5, max: 100, desc: 'فترة نطاقات بولينجر' },
    { key: 'bollStd', label: 'بولينجر - الانحراف', min: 1, max: 4, desc: 'عدد الانحرافات المعيارية' },
    { key: 'rsiPeriod', label: 'RSI - الفترة', min: 2, max: 50, desc: 'فترة مؤشر القوة النسبية' },
    { key: 'macdFast', label: 'MACD - سريع', min: 2, max: 50, desc: 'فترة EMA السريعة لـ MACD' },
    { key: 'macdSlow', label: 'MACD - بطيء', min: 5, max: 200, desc: 'فترة EMA البطيئة لـ MACD' },
    { key: 'macdSignal', label: 'MACD - إشارة', min: 2, max: 50, desc: 'فترة خط الإشارة' }
  ];

  const colorKeys: Array<{ k: string; label: string }> = [
    { k: 'SMA20', label: 'لون SMA القصيرة' },
    { k: 'SMA50', label: 'لون SMA الطويلة' },
    { k: 'EMA12', label: 'لون EMA السريعة' },
    { k: 'EMA26', label: 'لون EMA البطيئة' }
  ];

  const presetColors = [
    '#f5b544', '#a855f7', '#3b82f6', '#22d3a4', '#f43f7a',
    '#06b6d4', '#84cc16', '#f97316', '#ec4899', '#8b5cf6'
  ];

  function save() {
    config = { ...draft };
    onsave?.(draft);
    open = false;
  }

  function resetDefaults() {
    draft = { ...defaults, colors: { ...defaults.colors! } };
    onreset?.();
  }

  function setPeriod(key: keyof IndicatorConfig, val: number, def: { min: number; max: number }) {
    const clamped = Math.max(def.min, Math.min(def.max, val));
    draft = { ...draft, [key]: clamped };
  }

  function setColor(k: string, color: string) {
    draft = { ...draft, colors: { ...(draft.colors || {}), [k]: color } };
  }

  let activeTab = $state<'params' | 'colors'>('params');
</script>

<svelte:head><title>إعدادات المؤشرات — NEXUS</title></svelte:head>

{#if open}
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
    <div class="w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col bg-ink-900 border border-white/10 rounded-2xl shadow-2xl" dir="rtl">
      <!-- Header -->
      <div class="flex items-center justify-between px-5 py-3 border-b border-white/5 bg-gradient-to-l from-accent-gold/10 to-transparent">
        <div class="flex items-center gap-2">
          <SlidersHorizontal size={18} class="text-accent-gold" />
          <h2 class="font-bold text-white">إعدادات المؤشرات</h2>
        </div>
        <button onclick={() => (open = false)} class="p-1.5 rounded-md hover:bg-white/10 text-slate-400 hover:text-white transition-colors" aria-label="إغلاق">
          <X size={18} />
        </button>
      </div>

      <!-- Tabs -->
      <div class="flex border-b border-white/5">
        <button
          onclick={() => (activeTab = 'params')}
          class="flex-1 px-4 py-2.5 text-sm font-medium transition-colors {activeTab === 'params' ? 'text-accent-gold border-b-2 border-accent-gold bg-accent-gold/5' : 'text-slate-400 hover:text-white hover:bg-white/[0.02]'}"
        >
          <Activity size={14} class="inline ml-1" /> الفترات
        </button>
        <button
          onclick={() => (activeTab = 'colors')}
          class="flex-1 px-4 py-2.5 text-sm font-medium transition-colors {activeTab === 'colors' ? 'text-accent-gold border-b-2 border-accent-gold bg-accent-gold/5' : 'text-slate-400 hover:text-white hover:bg-white/[0.02]'}"
        >
          <Palette size={14} class="inline ml-1" /> الألوان
        </button>
      </div>

      <!-- Body -->
      <div class="flex-1 overflow-y-auto p-4 space-y-3">
        {#if activeTab === 'params'}
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {#each indicatorDefs as ind, i}
              {@const val = (draft[ind.key] as number) ?? (defaults[ind.key] as number)}
              <div class="bg-white/[0.02] border border-white/5 rounded-lg p-3">
                <div class="flex items-center justify-between mb-2">
                  <div>
                    <div class="text-sm font-semibold text-white">{ind.label}</div>
                    <div class="text-[10px] text-slate-500 mt-0.5">{ind.desc}</div>
                  </div>
                  <div class="text-lg font-mono font-bold text-accent-gold tabular-nums">{val}</div>
                </div>
                <div class="flex items-center gap-2">
                  <button
                    onclick={() => setPeriod(ind.key, val - 1, ind)}
                    class="w-7 h-7 rounded-md bg-white/5 hover:bg-white/10 text-white text-lg leading-none"
                    aria-label="نقص"
                  >−</button>
                  <input
                    type="range"
                    min={ind.min}
                    max={ind.max}
                    value={val}
                    oninput={(e) => setPeriod(ind.key, +e.currentTarget.value, ind)}
                    class="flex-1 accent-accent-gold"
                  />
                  <button
                    onclick={() => setPeriod(ind.key, val + 1, ind)}
                    class="w-7 h-7 rounded-md bg-white/5 hover:bg-white/10 text-white text-lg leading-none"
                    aria-label="زيادة"
                  >+</button>
                </div>
                <div class="flex items-center justify-between mt-1 text-[10px] text-slate-500">
                  <span>أدنى: {ind.min}</span>
                  <span>أقصى: {ind.max}</span>
                </div>
              </div>
            {/each}
          </div>

          <!-- Quick info -->
          <div class="bg-accent-gold/5 border border-accent-gold/20 rounded-lg p-3 text-xs text-slate-300 leading-relaxed">
            <strong class="text-accent-gold">💡 ملاحظة:</strong>
            تغيير الفترات يؤثر فوراً على حساب المؤشرات. الفترات الأقصر = إشارات أكثر مع ضجيج أعلى. الفترات الأطول = إشارات أدق لكن متأخرة.
          </div>
        {:else}
          <div class="space-y-3">
            {#each colorKeys as ck}
              {@const current = draft.colors?.[ck.k] ?? defaults.colors?.[ck.k] ?? '#ffffff'}
              <div class="bg-white/[0.02] border border-white/5 rounded-lg p-3">
                <div class="flex items-center justify-between mb-2">
                  <span class="text-sm font-semibold text-white">{ck.label}</span>
                  <div class="flex items-center gap-2">
                    <input
                      type="color"
                      value={current}
                      oninput={(e) => setColor(ck.k, e.currentTarget.value)}
                      class="w-9 h-9 rounded-md cursor-pointer bg-transparent border border-white/10"
                    />
                    <span class="text-xs font-mono text-slate-400 tabular-nums w-20 text-left">{current.toUpperCase()}</span>
                  </div>
                </div>
                <div class="flex flex-wrap gap-1.5">
                  {#each presetColors as pc}
                    <button
                      onclick={() => setColor(ck.k, pc)}
                      class="w-6 h-6 rounded-md border-2 transition-transform hover:scale-110 {current.toLowerCase() === pc.toLowerCase() ? 'border-white' : 'border-transparent'}"
                      style="background: {pc};"
                      aria-label={pc}
                    ></button>
                  {/each}
                </div>
              </div>
            {/each}

            <!-- Reset colors button -->
            <button
              onclick={() => {
                draft = { ...draft, colors: { ...defaults.colors! } };
              }}
              class="w-full py-2 text-xs text-slate-400 hover:text-white hover:bg-white/5 rounded-md transition-colors"
            >
              <RotateCcw size={12} class="inline ml-1" /> إعادة الألوان الافتراضية
            </button>
          </div>
        {/if}
      </div>

      <!-- Footer -->
      <div class="flex items-center justify-between gap-3 px-5 py-3 border-t border-white/5 bg-ink-950/50">
        <button
          onclick={resetDefaults}
          class="flex items-center gap-1.5 px-3 py-2 text-xs text-slate-400 hover:text-white hover:bg-white/5 rounded-md transition-colors"
        >
          <RotateCcw size={12} /> استعادة الافتراضي
        </button>
        <div class="flex items-center gap-2">
          <button
            onclick={() => (open = false)}
            class="px-4 py-2 text-sm text-slate-300 hover:bg-white/5 rounded-md transition-colors"
          >
            إلغاء
          </button>
          <button
            onclick={save}
            class="px-4 py-2 text-sm font-bold bg-accent-gold text-ink-950 hover:bg-accent-gold/90 rounded-md transition-colors shadow-lg shadow-accent-gold/20"
          >
            حفظ الإعدادات
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}
