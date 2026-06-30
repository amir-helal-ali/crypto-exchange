<script lang="ts">
  /**
   * Market Heatmap — Binance-style treemap of all coins by market cap (volume*price)
   * Tiles colored by 24h change (deep red → deep green), area proportional to volume.
   */
  import { onMount, onDestroy } from 'svelte';
  import { nexusMarket, type NexusTick } from '$lib/stores/nexus-market';
  import { usdToEgp, egpCompact, usdEgpRate } from '$lib/utils/currency';
  import { formatSymbol, formatCompact, formatPrice } from '$lib/utils/format';
  import {
    Grid2x2, TrendingUp, TrendingDown, Search, Filter, Activity,
    Layers, X, ArrowLeft, ChevronLeft, Flame, BarChart3
  } from 'lucide-svelte';

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
      } else {
        tickers = [...tickers, t];
      }
    });
    unsubRate = usdEgpRate.subscribe((r) => (currentRate = r));
    return () => {
      unsubAll?.();
      unsubRate?.();
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

  // Filter buttons config
  const filterButtons = [
    { v: 'all', l: 'الكل' },
    { v: 'gainers', l: 'صاعد' },
    { v: 'losers', l: 'هابط' },
    { v: 'high-volume', l: 'عالي الحجم' }
  ] as const;

  const sizeButtons = [
    { v: 'volume', l: 'حجم التداول' },
    { v: 'price', l: 'القيمة السوقية' }
  ] as const;
</script>

<svelte:head><title>خريطة السوق الحرارية — NEXUS</title></svelte:head>

<div class="space-y-5 relative pb-20 lg:pb-0">
  <!-- Ambient aurora -->
  <div class="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
    <div class="absolute -top-20 right-1/4 w-96 h-96 bg-accent-gold/6 blur-[120px] rounded-full animate-pulse-glow"></div>
    <div class="absolute bottom-0 -left-32 w-96 h-96 bg-accent-mint/5 blur-[120px] rounded-full animate-pulse-glow" style="animation-delay: 2s;"></div>
  </div>

  <!-- Header -->
  <div class="relative flex items-center justify-between">
    <div class="flex items-center gap-3">
      <div class="w-11 h-11 rounded-2xl bg-gradient-to-br from-accent-gold/20 to-accent-mint/10 border border-accent-gold/20 flex items-center justify-center">
        <Grid2x2 size={22} class="text-accent-gold" />
      </div>
      <div>
        <div class="flex items-center gap-2 mb-1">
          <h1 class="text-2xl sm:text-3xl font-bold text-white tracking-tight">خريطة السوق الحرارية</h1>
          <div class="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-accent-mint/10 border border-accent-mint/25">
            <span class="relative flex h-1.5 w-1.5">
              <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-mint opacity-60"></span>
              <span class="relative inline-flex rounded-full h-1.5 w-1.5 bg-accent-mint"></span>
            </span>
            <span class="text-[10px] font-bold text-accent-mint tracking-wide">مباشر</span>
          </div>
        </div>
        <p class="text-sm text-slate-400 mt-0.5">توزيع العملات حسب الحجم والتغير في 24 ساعة — تحديث مباشر</p>
      </div>
    </div>
  </div>

  <!-- Premium stat cards -->
  <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
    <div class="stat-card group relative overflow-hidden">
      <div class="absolute -top-6 -right-6 w-20 h-20 bg-accent-gold/10 blur-2xl rounded-full group-hover:bg-accent-gold/15 transition-all"></div>
      <div class="relative">
        <div class="flex items-center gap-1.5 mb-2">
          <BarChart3 size={12} class="text-accent-gold" />
          <span class="text-[10px] uppercase tracking-wider text-slate-500 font-bold">إجمالي العملات</span>
        </div>
        <p class="text-xl font-bold text-white tabular-nums">{stats.total}</p>
        <p class="text-[10px] text-slate-500 mt-0.5">زوج تداول نشط</p>
      </div>
    </div>
    <div class="stat-card group relative overflow-hidden">
      <div class="absolute -top-6 -right-6 w-20 h-20 bg-accent-mint/10 blur-2xl rounded-full group-hover:bg-accent-mint/15 transition-all"></div>
      <div class="relative">
        <div class="flex items-center gap-1.5 mb-2">
          <TrendingUp size={12} class="text-accent-mint" />
          <span class="text-[10px] uppercase tracking-wider text-slate-500 font-bold">صاعدة</span>
        </div>
        <p class="text-xl font-bold text-accent-mint tabular-nums">{stats.gainers}</p>
        <p class="text-[10px] text-slate-500 mt-0.5">{stats.total > 0 ? ((stats.gainers / stats.total) * 100).toFixed(0) : 0}% من الإجمالي</p>
      </div>
    </div>
    <div class="stat-card group relative overflow-hidden">
      <div class="absolute -top-6 -right-6 w-20 h-20 bg-accent-rose/10 blur-2xl rounded-full group-hover:bg-accent-rose/15 transition-all"></div>
      <div class="relative">
        <div class="flex items-center gap-1.5 mb-2">
          <TrendingDown size={12} class="text-accent-rose" />
          <span class="text-[10px] uppercase tracking-wider text-slate-500 font-bold">هابطة</span>
        </div>
        <p class="text-xl font-bold text-accent-rose tabular-nums">{stats.losers}</p>
        <p class="text-[10px] text-slate-500 mt-0.5">{stats.total > 0 ? ((stats.losers / stats.total) * 100).toFixed(0) : 0}% من الإجمالي</p>
      </div>
    </div>
    <div class="stat-card group relative overflow-hidden">
      <div class="absolute -top-6 -right-6 w-20 h-20 bg-accent-azure/10 blur-2xl rounded-full group-hover:bg-accent-azure/15 transition-all"></div>
      <div class="relative">
        <div class="flex items-center gap-1.5 mb-2">
          <Activity size={12} class="text-accent-azure" />
          <span class="text-[10px] uppercase tracking-wider text-slate-500 font-bold">متوسط التغير</span>
        </div>
        <p class="text-xl font-bold tabular-nums {stats.avgChange >= 0 ? 'text-accent-mint' : 'text-accent-rose'}">{fmtChange(stats.avgChange)}</p>
        <p class="text-[10px] text-slate-500 mt-0.5">جميع العملات — 24h</p>
      </div>
    </div>
  </div>

  <!-- Filter panel -->
  <div class="panel p-4 relative overflow-hidden">
    <div class="absolute top-0 inset-x-0 h-px pointer-events-none" style="background: linear-gradient(90deg, transparent, rgba(245, 181, 68, 0.3), transparent);"></div>
    <div class="flex flex-wrap items-center gap-3">
      <!-- Search -->
      <div class="relative flex-1 min-w-[180px]">
        <Search size={14} class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
        <input
          type="text"
          placeholder="بحث عن زوج..."
          bind:value={searchQuery}
          class="input pr-10 py-1.5 text-xs"
        />
      </div>

      <!-- Filter range -->
      <div class="flex items-center gap-1 text-xs">
        <Filter size={12} class="text-slate-500 ml-1" />
        {#each filterButtons as f}
          <button
            onclick={() => (filterRange = f.v as any)}
            class="px-2.5 py-1.5 rounded-lg font-medium transition-all {filterRange === f.v
              ? 'bg-accent-gold/15 text-accent-gold border border-accent-gold/30'
              : 'text-slate-400 hover:bg-white/5 hover:text-white border border-transparent'}"
          >{f.l}</button>
        {/each}
      </div>

      <!-- Size metric -->
      <div class="flex items-center gap-1 text-xs">
        <Layers size={12} class="text-slate-500 ml-1" />
        {#each sizeButtons as sm}
          <button
            onclick={() => (sizeMetric = sm.v as any)}
            class="px-2.5 py-1.5 rounded-lg font-medium transition-all {sizeMetric === sm.v
              ? 'bg-accent-violet/15 text-accent-violet border border-accent-violet/30'
              : 'text-slate-400 hover:bg-white/5 hover:text-white border border-transparent'}"
          >{sm.l}</button>
        {/each}
      </div>

      <!-- Sort -->
      <div class="flex items-center gap-1 text-xs">
        <select bind:value={sortBy} class="bg-white/[0.03] border border-white/5 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-accent-gold/40 cursor-pointer">
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
    <div class="panel p-12 text-center relative overflow-hidden">
      <div class="absolute -top-12 -right-12 w-32 h-32 bg-accent-gold/10 blur-3xl rounded-full animate-pulse-glow"></div>
      <div class="relative">
        <div class="inline-block w-10 h-10 border-2 border-accent-gold border-t-transparent rounded-full animate-spin"></div>
        <p class="mt-3 text-slate-400 text-sm">جاري تحميل بيانات السوق...</p>
      </div>
    </div>
  {:else if filteredTickers.length === 0}
    <div class="panel py-16 text-center relative overflow-hidden">
      <div class="absolute -top-12 -right-12 w-32 h-32 bg-accent-rose/10 blur-3xl rounded-full"></div>
      <div class="relative">
        <div class="relative inline-block mb-4">
          <div class="absolute inset-0 bg-accent-rose/10 blur-3xl rounded-full"></div>
          <X size={40} class="relative text-slate-600 mx-auto" />
        </div>
        <p class="text-sm font-medium text-slate-300">لا توجد نتائج مطابقة</p>
        <p class="text-xs text-slate-500 mt-1">جرّب تعديل الفلاتر أو البحث</p>
      </div>
    </div>
  {:else}
    <div class="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-4">
      <!-- Treemap -->
      <div class="panel p-4 relative overflow-hidden">
        <div class="absolute top-0 inset-x-0 h-px pointer-events-none" style="background: linear-gradient(90deg, transparent, rgba(245, 181, 68, 0.3), transparent);"></div>
        <div class="grid gap-1.5" style="grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));">
          {#each filteredTickers as t (t.symbol)}
            {@const weight = tileWeight(t, sizeMetric === 'volume' ? maxVolume : maxValue)}
            <a
              href="/dashboard/exchange?symbol={t.symbol}"
              class="relative rounded-xl overflow-hidden border border-white/5 transition-all hover:border-white/30 hover:z-10 hover:scale-[1.02] group p-2.5 flex flex-col justify-between"
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
                <div class="text-xs font-bold text-white drop-shadow-md tabular-nums">
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

      <!-- Right sidebar -->
      <div class="space-y-4">
        <!-- Selected coin details -->
        {#if selectedTick}
          <div class="panel p-5 relative overflow-hidden">
            <div class="absolute top-0 inset-x-0 h-px pointer-events-none" style="background: linear-gradient(90deg, transparent, rgba(245, 181, 68, 0.5), transparent);"></div>
            <div class="absolute -top-12 -right-12 w-32 h-32 bg-accent-gold/10 blur-3xl rounded-full"></div>
            <div class="relative">
              <div class="flex items-center justify-between mb-3">
                <h3 class="text-sm font-bold text-white flex items-center gap-2">
                  <div class="w-7 h-7 rounded-lg bg-accent-gold/15 border border-accent-gold/25 flex items-center justify-center">
                    <Activity size={13} class="text-accent-gold" />
                  </div>
                  تفاصيل العملة
                </h3>
                <button onclick={() => (selectedTick = null)} class="p-1 rounded-lg text-slate-400 hover:bg-white/5 hover:text-white transition-colors" aria-label="إغلاق">
                  <X size={14} />
                </button>
              </div>
              <div class="space-y-2">
                <div class="flex items-center justify-between py-1.5 border-b border-white/5">
                  <span class="text-xs text-slate-400">الزوج</span>
                  <span class="text-sm font-bold text-white">{selectedTick.symbol}</span>
                </div>
                <div class="flex items-center justify-between py-1.5 border-b border-white/5">
                  <span class="text-xs text-slate-400">السعر (USD)</span>
                  <span class="text-sm font-mono text-white tabular-nums">${formatPrice(selectedTick.price)}</span>
                </div>
                <div class="flex items-center justify-between py-1.5 border-b border-white/5">
                  <span class="text-xs text-slate-400">السعر (ج.م)</span>
                  <span class="text-sm font-mono text-accent-gold tabular-nums">{egpCompact(usdToEgp(selectedTick.price, currentRate))}</span>
                </div>
                <div class="flex items-center justify-between py-1.5 border-b border-white/5">
                  <span class="text-xs text-slate-400">تغير 24h</span>
                  <span class="text-sm font-bold tabular-nums {selectedTick.change24h >= 0 ? 'text-accent-mint' : 'text-accent-rose'}">
                    {fmtChange(selectedTick.change24h)}
                  </span>
                </div>
                <div class="flex items-center justify-between py-1.5 border-b border-white/5">
                  <span class="text-xs text-slate-400">أعلى 24h</span>
                  <span class="text-xs font-mono text-slate-300 tabular-nums">${formatPrice(selectedTick.high24h)}</span>
                </div>
                <div class="flex items-center justify-between py-1.5 border-b border-white/5">
                  <span class="text-xs text-slate-400">أقل 24h</span>
                  <span class="text-xs font-mono text-slate-300 tabular-nums">${formatPrice(selectedTick.low24h)}</span>
                </div>
                <div class="flex items-center justify-between py-1.5">
                  <span class="text-xs text-slate-400">حجم 24h</span>
                  <span class="text-xs font-mono text-slate-300 tabular-nums">${formatCompact(selectedTick.volume24h)}</span>
                </div>
              </div>
              <a
                href="/dashboard/exchange?symbol={selectedTick.symbol}"
                class="btn-buy w-full mt-4 text-xs"
              >
                <ArrowLeft size={13} class="rotate-180" /> تداول {formatSymbol(selectedTick.symbol).base}
              </a>
            </div>
          </div>
        {:else}
          <div class="panel p-5 text-center relative">
            <div class="absolute -top-12 -right-12 w-32 h-32 bg-accent-gold/8 blur-3xl rounded-full"></div>
            <div class="relative">
              <div class="relative inline-block mb-3">
                <div class="absolute inset-0 bg-accent-gold/10 blur-2xl rounded-full"></div>
                <Grid2x2 size={32} class="relative text-slate-600 mx-auto" />
              </div>
              <p class="text-xs font-medium text-slate-300">اختر عملة لعرض التفاصيل</p>
              <p class="text-[10px] text-slate-500 mt-1">اضغط على أي مربع في الخريطة</p>
            </div>
          </div>
        {/if}

        <!-- Top gainers -->
        <div class="panel p-5 relative overflow-hidden">
          <div class="absolute top-0 inset-x-0 h-px pointer-events-none" style="background: linear-gradient(90deg, transparent, rgba(34, 211, 164, 0.5), transparent);"></div>
          <h3 class="text-sm font-bold text-white mb-3 flex items-center gap-2">
            <div class="w-7 h-7 rounded-lg bg-accent-mint/10 border border-accent-mint/20 flex items-center justify-center">
              <Flame size={13} class="text-accent-mint" />
            </div>
            الأعلى صعوداً
          </h3>
          <div class="space-y-1.5">
            {#each topGainers as g, i}
              <a href="/dashboard/exchange?symbol={g.symbol}" class="flex items-center justify-between text-xs hover:bg-white/5 rounded-lg px-2.5 py-2 transition-colors group">
                <div class="flex items-center gap-2">
                  <span class="w-5 h-5 rounded-md bg-accent-mint/10 flex items-center justify-center text-[10px] font-bold text-accent-mint tabular-nums">{i + 1}</span>
                  <span class="font-semibold text-white group-hover:text-accent-mint transition-colors">{formatSymbol(g.symbol).base}</span>
                </div>
                <span class="font-mono text-accent-mint tabular-nums font-bold">+{g.change24h.toFixed(2)}%</span>
              </a>
            {/each}
          </div>
        </div>

        <!-- Top losers -->
        <div class="panel p-5 relative overflow-hidden">
          <div class="absolute top-0 inset-x-0 h-px pointer-events-none" style="background: linear-gradient(90deg, transparent, rgba(251, 113, 133, 0.5), transparent);"></div>
          <h3 class="text-sm font-bold text-white mb-3 flex items-center gap-2">
            <div class="w-7 h-7 rounded-lg bg-accent-rose/10 border border-accent-rose/20 flex items-center justify-center">
              <TrendingDown size={13} class="text-accent-rose" />
            </div>
            الأعلى هبوطاً
          </h3>
          <div class="space-y-1.5">
            {#each topLosers as g, i}
              <a href="/dashboard/exchange?symbol={g.symbol}" class="flex items-center justify-between text-xs hover:bg-white/5 rounded-lg px-2.5 py-2 transition-colors group">
                <div class="flex items-center gap-2">
                  <span class="w-5 h-5 rounded-md bg-accent-rose/10 flex items-center justify-center text-[10px] font-bold text-accent-rose tabular-nums">{i + 1}</span>
                  <span class="font-semibold text-white group-hover:text-accent-rose transition-colors">{formatSymbol(g.symbol).base}</span>
                </div>
                <span class="font-mono text-accent-rose tabular-nums font-bold">{g.change24h.toFixed(2)}%</span>
              </a>
            {/each}
          </div>
        </div>

        <!-- Color legend -->
        <div class="panel p-5 relative overflow-hidden">
          <div class="absolute top-0 inset-x-0 h-px pointer-events-none" style="background: linear-gradient(90deg, transparent, rgba(168, 85, 247, 0.4), transparent);"></div>
          <h3 class="text-sm font-bold text-white mb-3 flex items-center gap-2">
            <div class="w-7 h-7 rounded-lg bg-accent-violet/10 border border-accent-violet/20 flex items-center justify-center">
              <Layers size={13} class="text-accent-violet" />
            </div>
            دليل الألوان
          </h3>
          <div class="h-3 rounded-full mb-2" style="background: linear-gradient(to left, rgb(158,27,61), rgb(244,63,122), rgb(100,116,139), rgb(34,211,164), rgb(22,197,94));"></div>
          <div class="flex items-center justify-between text-[10px] text-slate-400 font-mono tabular-nums">
            <span>-10% أو أقل</span>
            <span class="text-slate-500">0%</span>
            <span>+10% أو أكثر</span>
          </div>
          <p class="text-[10px] text-slate-500 mt-3 leading-relaxed">
            حجم المربع يتناسب مع {sizeMetric === 'volume' ? 'حجم التداول' : 'القيمة السوقية'} للعملة مقارنة بالأعلى.
          </p>
        </div>
      </div>
    </div>
  {/if}
</div>
