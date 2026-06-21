<script lang="ts">
  /**
   * Market Heatmap — Binance-style treemap of all coins by market cap (volume*price)
   * Tiles colored by 24h change (deep red → deep green), area proportional to volume.
   */
  import { onMount, onDestroy } from 'svelte';
  import { nexusMarket, type NexusTick } from '$lib/stores/nexus-market';
  import { usdToEgp, egpCompact, usdEgpRate } from '$lib/utils/currency';
  import { formatSymbol, formatCompact, formatPrice } from '$lib/utils/format';
  import { Grid2x2, TrendingUp, TrendingDown, Search, Filter, Activity, Layers } from 'lucide-svelte';

  let tickers = $state<NexusTick[]>([]);
  let loading = $state(true);
  let searchQuery = $state('');
  let sortBy = $state<'volume' | 'change-desc' | 'change-asc' | 'price-desc' | 'price-asc'>('volume');
  let sizeMetric = $state<'volume' | 'price'>('volume');
  let filterRange = $state<'all' | 'gainers' | 'losers' | 'high-volume'>('all');
  let currentRate = $state(48.5);
  let selectedTick = $state<NexusTick | null>(null);
  let unsubAll: (() => void) | null = null;
  let unsubRate: (() => void) | null = null;
  let refreshTimer: any = null;

  onMount(() => {
    (async () => {
      await loadTickers();
      loading = false;
    })();
    unsubAll = nexusMarket.subscribeAll((t) => {
      const idx = tickers.findIndex((x) => x.symbol === t.symbol);
      if (idx >= 0) {
        tickers[idx] = t;
        tickers = [...tickers];
      }
    });
    unsubRate = usdEgpRate.subscribe((r) => (currentRate = r));
    refreshTimer = setInterval(loadTickers, 15000);
    return () => {
      unsubAll?.();
      unsubRate?.();
      if (refreshTimer) clearInterval(refreshTimer);
    };
  });

  async function loadTickers() {
    try {
      const all = await nexusMarket.getAllTickers();
      tickers = all.sort((a, b) => b.volume24h - a.volume24h);
    } catch (e) {
      console.error('Failed to load tickers', e);
    }
  }

  function tileColor(change: number): string {
    const c = Math.max(-10, Math.min(10, change));
    if (c > 0) {
      const intensity = c / 10;
      const r = Math.round(34 + (22 - 34) * intensity);
      const g = Math.round(211 + (197 - 211) * intensity);
      const b = Math.round(164 + (94 - 164) * intensity);
      return `rgb(${r}, ${g}, ${b})`;
    } else if (c < 0) {
      const intensity = -c / 10;
      const r = Math.round(244 + (158 - 244) * intensity);
      const g = Math.round(63 + (27 - 63) * intensity);
      const b = Math.round(122 + (61 - 122) * intensity);
      return `rgb(${r}, ${g}, ${b})`;
    }
    return 'rgb(100, 116, 139)';
  }

  function tileWeight(t: NexusTick, max: number): number {
    if (sizeMetric === 'price') return (t.price * t.volume24h) / max;
    return t.volume24h / max;
  }

  const filteredTickers = $derived.by(() => {
    let arr = [...tickers];
    if (searchQuery.trim()) {
      const q = searchQuery.toUpperCase().trim();
      arr = arr.filter((t) => t.symbol.includes(q));
    }
    if (filterRange === 'gainers') arr = arr.filter((t) => t.change24h > 0);
    else if (filterRange === 'losers') arr = arr.filter((t) => t.change24h < 0);
    else if (filterRange === 'high-volume') arr = arr.filter((t) => t.volume24h > 1_000_000);

    switch (sortBy) {
      case 'volume': arr.sort((a, b) => b.volume24h - a.volume24h); break;
      case 'change-desc': arr.sort((a, b) => b.change24h - a.change24h); break;
      case 'change-asc': arr.sort((a, b) => a.change24h - b.change24h); break;
      case 'price-desc': arr.sort((a, b) => b.price - a.price); break;
      case 'price-asc': arr.sort((a, b) => a.price - b.price); break;
    }
    return arr;
  });

  const maxVolume = $derived(Math.max(...tickers.map((t) => t.volume24h), 1));
  const maxValue = $derived(Math.max(...tickers.map((t) => t.price * t.volume24h), 1));

  const stats = $derived.by(() => {
    const total = tickers.length;
    const gainers = tickers.filter((t) => t.change24h > 0).length;
    const losers = tickers.filter((t) => t.change24h < 0).length;
    const avgChange = total > 0 ? tickers.reduce((s, t) => s + t.change24h, 0) / total : 0;
    const totalVolume = tickers.reduce((s, t) => s + t.volume24h, 0);
    return { total, gainers, losers, avgChange, totalVolume };
  });

  const topGainers = $derived([...tickers].sort((a, b) => b.change24h - a.change24h).slice(0, 5));
  const topLosers = $derived([...tickers].sort((a, b) => a.change24h - b.change24h).slice(0, 5));

  function fmtChange(c: number): string {
    return (c >= 0 ? '+' : '') + c.toFixed(2) + '%';
  }
</script>

<svelte:head><title>خريطة السوق الحرارية — NEXUS</title></svelte:head>

<div class="space-y-4 pb-20 lg:pb-0">
  <!-- Page header -->
  <div class="panel p-4">
    <div class="flex items-center justify-between flex-wrap gap-3">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-xl bg-accent-gold/15 flex items-center justify-center">
          <Grid2x2 size={20} class="text-accent-gold" />
        </div>
        <div>
          <h1 class="text-lg font-bold text-white">خريطة السوق الحرارية</h1>
          <p class="text-[11px] text-slate-400 mt-0.5">توزيع العملات حسب الحجم والتغير في 24 ساعة — تحديث مباشر</p>
        </div>
      </div>
      <div class="flex items-center gap-3 text-xs">
        <div class="px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/5">
          <div class="text-[9px] text-slate-500 uppercase">الإجمالي</div>
          <div class="text-sm font-bold text-white">{stats.total}</div>
        </div>
        <div class="px-3 py-1.5 rounded-lg bg-accent-mint/10 border border-accent-mint/20">
          <div class="text-[9px] text-slate-500 uppercase">صاعد</div>
          <div class="text-sm font-bold text-accent-mint">{stats.gainers}</div>
        </div>
        <div class="px-3 py-1.5 rounded-lg bg-accent-rose/10 border border-accent-rose/20">
          <div class="text-[9px] text-slate-500 uppercase">هابط</div>
          <div class="text-sm font-bold text-accent-rose">{stats.losers}</div>
        </div>
        <div class="px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/5">
          <div class="text-[9px] text-slate-500 uppercase">متوسط التغير</div>
          <div class="text-sm font-bold {stats.avgChange >= 0 ? 'text-accent-mint' : 'text-accent-rose'}">
            {fmtChange(stats.avgChange)}
          </div>
        </div>
      </div>
    </div>

    <div class="mt-3 flex flex-wrap items-center gap-2 pt-3 border-t border-white/5">
      <div class="relative">
        <Search size={14} class="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          type="text"
          placeholder="بحث عن زوج..."
          bind:value={searchQuery}
          class="w-44 bg-white/[0.03] border border-white/5 rounded-md pr-7 pl-3 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-accent-gold/40"
        />
      </div>
      <div class="flex items-center gap-1 text-xs">
        <Filter size={12} class="text-slate-500 ml-1" />
        {#each [{ v: 'all', l: 'الكل' }, { v: 'gainers', l: 'صاعد' }, { v: 'losers', l: 'هابط' }, { v: 'high-volume', l: 'عالي الحجم' }] as f}
          <button
            onclick={() => (filterRange = f.v as any)}
            class="px-2.5 py-1.5 rounded-md {filterRange === f.v ? 'bg-accent-gold/15 text-accent-gold' : 'text-slate-400 hover:bg-white/5 hover:text-white'}"
          >{f.l}</button>
        {/each}
      </div>
      <div class="flex items-center gap-1 text-xs mr-auto">
        <Layers size={12} class="text-slate-500 ml-1" />
        <span class="text-slate-500 text-[11px]">حجم المربع:</span>
        {#each [{ v: 'volume', l: 'حجم التداول' }, { v: 'price', l: 'القيمة السوقية' }] as sm}
          <button
            onclick={() => (sizeMetric = sm.v as any)}
            class="px-2 py-1 rounded-md {sizeMetric === sm.v ? 'bg-white/10 text-white' : 'text-slate-400 hover:bg-white/5'}"
          >{sm.l}</button>
        {/each}
      </div>
      <div class="flex items-center gap-1 text-xs">
        <Activity size={12} class="text-slate-500 ml-1" />
        <select bind:value={sortBy} class="bg-white/[0.03] border border-white/5 rounded-md px-2 py-1.5 text-xs text-white focus:outline-none">
          <option value="volume">ترتيب: الحجم</option>
          <option value="change-desc">ترتيب: الأعلى صعوداً</option>
          <option value="change-asc">ترتيب: الأعلى هبوطاً</option>
          <option value="price-desc">ترتيب: السعر (تنازلي)</option>
          <option value="price-asc">ترتيب: السعر (تصاعدي)</option>
        </select>
      </div>
    </div>
  </div>

  {#if loading}
    <div class="panel p-12 text-center">
      <div class="inline-block w-8 h-8 border-2 border-accent-gold border-t-transparent rounded-full animate-spin"></div>
      <p class="mt-3 text-slate-400 text-sm">جاري تحميل بيانات السوق...</p>
    </div>
  {:else if filteredTickers.length === 0}
    <div class="panel p-12 text-center text-slate-500 text-sm">لا توجد نتائج مطابقة</div>
  {:else}
    <div class="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-3">
      <div class="panel p-3">
        <div class="grid gap-1.5" style="grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));">
          {#each filteredTickers as t (t.symbol)}
            {@const weight = tileWeight(t, sizeMetric === 'volume' ? maxVolume : maxValue)}
            <a
              href="/dashboard/exchange?symbol={t.symbol}"
              class="relative rounded-lg overflow-hidden border border-white/5 transition-all hover:border-white/30 hover:z-10 hover:scale-[1.02] group p-2 flex flex-col justify-between"
              style="background: {tileColor(t.change24h)}; aspect-ratio: {Math.max(0.7, Math.min(1.8, 1 / Math.max(0.25, weight)))};"
              onclick={(e) => { e.preventDefault(); selectedTick = t; }}
            >
              <div>
                <div class="font-bold text-white text-sm drop-shadow-md leading-tight">
                  {formatSymbol(t.symbol).base}
                </div>
                <div class="text-[10px] text-white/80 mt-0.5 font-mono tabular-nums drop-shadow-sm">
                  ${formatPrice(t.price)}
                </div>
              </div>
              <div class="flex items-center justify-between mt-1">
                <div class="text-xs font-bold text-white drop-shadow-md">
                  {t.change24h >= 0 ? '+' : ''}{t.change24h.toFixed(2)}%
                </div>
                {#if t.change24h > 0}
                  <TrendingUp size={12} class="text-white/80" />
                {:else}
                  <TrendingDown size={12} class="text-white/80" />
                {/if}
              </div>
              <div class="absolute inset-0 bg-white/0 group-hover:bg-white/10 transition-colors pointer-events-none"></div>
            </a>
          {/each}
        </div>
      </div>

      <div class="space-y-3">
        {#if selectedTick}
          <div class="panel p-4">
            <div class="flex items-center justify-between mb-2">
              <h3 class="text-sm font-bold text-white">تفاصيل العملة</h3>
              <button onclick={() => (selectedTick = null)} class="text-slate-400 hover:text-white text-xs">✕</button>
            </div>
            <div class="space-y-2">
              <div class="flex items-center justify-between">
                <span class="text-xs text-slate-400">الزوج</span>
                <span class="text-sm font-bold text-white">{selectedTick.symbol}</span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-xs text-slate-400">السعر (USD)</span>
                <span class="text-sm font-mono text-white tabular-nums">${formatPrice(selectedTick.price)}</span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-xs text-slate-400">السعر (ج.م)</span>
                <span class="text-sm font-mono text-accent-gold tabular-nums">{egpCompact(usdToEgp(selectedTick.price, currentRate))}</span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-xs text-slate-400">تغير 24h</span>
                <span class="text-sm font-bold tabular-nums {selectedTick.change24h >= 0 ? 'text-accent-mint' : 'text-accent-rose'}">
                  {fmtChange(selectedTick.change24h)}
                </span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-xs text-slate-400">أعلى 24h</span>
                <span class="text-xs font-mono text-slate-300 tabular-nums">${formatPrice(selectedTick.high24h)}</span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-xs text-slate-400">أقل 24h</span>
                <span class="text-xs font-mono text-slate-300 tabular-nums">${formatPrice(selectedTick.low24h)}</span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-xs text-slate-400">حجم 24h</span>
                <span class="text-xs font-mono text-slate-300 tabular-nums">${formatCompact(selectedTick.volume24h)}</span>
              </div>
              <a
                href="/dashboard/exchange?symbol={selectedTick.symbol}"
                class="block mt-3 py-2 text-center text-xs font-bold bg-accent-gold text-ink-950 rounded-md hover:bg-accent-gold/90 transition-colors"
              >
                تداول {formatSymbol(selectedTick.symbol).base} ←
              </a>
            </div>
          </div>
        {/if}

        <div class="panel p-4">
          <h3 class="text-sm font-bold text-white mb-2 flex items-center gap-1.5">
            <TrendingUp size={14} class="text-accent-mint" /> الأعلى صعوداً
          </h3>
          <div class="space-y-1.5">
            {#each topGainers as g, i}
              <a href="/dashboard/exchange?symbol={g.symbol}" class="flex items-center justify-between text-xs hover:bg-white/5 rounded px-2 py-1.5 transition-colors">
                <div class="flex items-center gap-2">
                  <span class="text-[10px] text-slate-500 w-3">{i + 1}</span>
                  <span class="font-semibold text-white">{formatSymbol(g.symbol).base}</span>
                </div>
                <span class="font-mono text-accent-mint tabular-nums">+{g.change24h.toFixed(2)}%</span>
              </a>
            {/each}
          </div>
        </div>

        <div class="panel p-4">
          <h3 class="text-sm font-bold text-white mb-2 flex items-center gap-1.5">
            <TrendingDown size={14} class="text-accent-rose" /> الأعلى هبوطاً
          </h3>
          <div class="space-y-1.5">
            {#each topLosers as g, i}
              <a href="/dashboard/exchange?symbol={g.symbol}" class="flex items-center justify-between text-xs hover:bg-white/5 rounded px-2 py-1.5 transition-colors">
                <div class="flex items-center gap-2">
                  <span class="text-[10px] text-slate-500 w-3">{i + 1}</span>
                  <span class="font-semibold text-white">{formatSymbol(g.symbol).base}</span>
                </div>
                <span class="font-mono text-accent-rose tabular-nums">{g.change24h.toFixed(2)}%</span>
              </a>
            {/each}
          </div>
        </div>

        <div class="panel p-4">
          <h3 class="text-sm font-bold text-white mb-2">دليل الألوان</h3>
          <div class="h-4 rounded-full mb-2" style="background: linear-gradient(to left, rgb(158,27,61), rgb(244,63,122), rgb(100,116,139), rgb(34,211,164), rgb(22,197,94));"></div>
          <div class="flex items-center justify-between text-[10px] text-slate-400">
            <span>-10% أو أقل</span>
            <span>0%</span>
            <span>+10% أو أكثر</span>
          </div>
          <p class="text-[10px] text-slate-500 mt-2 leading-relaxed">
            حجم المربع يتناسب مع {sizeMetric === 'volume' ? 'حجم التداول' : 'القيمة السوقية'} للعملة مقارنة بالأعلى.
          </p>
        </div>
      </div>
    </div>
  {/if}
</div>
