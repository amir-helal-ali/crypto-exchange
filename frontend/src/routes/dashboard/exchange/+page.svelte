<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { page } from '$app/stores';
  import NexusChart from '$lib/components/NexusChart.svelte';
  import type { IndicatorConfig } from '$lib/components/NexusChart.svelte';
  import NexusChartToolbar from '$lib/components/NexusChartToolbar.svelte';
  import IndicatorSettingsModal from '$lib/components/IndicatorSettingsModal.svelte';
  import OrderBook from '$lib/components/OrderBook.svelte';
  import DepthChart from '$lib/components/DepthChart.svelte';
  import AccountSummaryBar from '$lib/components/AccountSummaryBar.svelte';
  import MarketList from '$lib/components/MarketList.svelte';
  import TradesFeed from '$lib/components/TradesFeed.svelte';
  import TradeForm from '$lib/components/TradeForm.svelte';
  import NavTabs from '$lib/components/NavTabs.svelte';
  import { wallet, exchange } from '$lib/api/endpoints';
  import { parseApiResponse } from '$lib/api/client';
  import { formatPrice, formatSymbol, formatCompact, timeAgo } from '$lib/utils/format';
  import { usdToEgp, egpCompact, egpWithSymbol, formatEGP, usdEgpRate } from '$lib/utils/currency';
  import { marketStore, favorites, type MarketTicker } from '$lib/stores/market';
  import { nexusMarket } from '$lib/stores/nexus-market';
  import { priceAlerts, type PriceAlert } from '$lib/stores/priceAlerts';
  import PriceFlash from '$lib/components/PriceFlash.svelte';
  import ChangeBadge from '$lib/components/ChangeBadge.svelte';
  import AlertsPanel from '$lib/components/AlertsPanel.svelte';
  import AlertModal from '$lib/components/AlertModal.svelte';
  import { toasts } from '$lib/stores/toast';
  import {
    Star,
    ZoomIn,
    ZoomOut,
    Maximize2,
    Download,
    Settings2,
    Settings,
    Coins,
    Bell,
    BellRing,
    Crosshair,
    Camera,
    LayoutGrid,
    Square,
    Columns2,
    Grid2x2,
    Link2,
    Unlink,
    SlidersHorizontal
  } from 'lucide-svelte';

  let chartComponent = $state<NexusChart>();
  let chart2Component = $state<NexusChart>();
  let chart3Component = $state<NexusChart>();
  let chart4Component = $state<NexusChart>();
  let indicatorsPanelOpen = $state(false);
  let alertModalOpen = $state(false);
  let indicatorSettingsOpen = $state(false);

  let symbol = $state('BTCUSDT');
  let timeframe = $state('1H');
  let indicators = $state<string[]>(['SMA20', 'VWAP']);
  let subIndicators = $state<string[]>(['RSI']);
  let chartType = $state<'candles' | 'heikin-ashi' | 'line' | 'area'>('candles');
  let drawTool = $state<'cursor' | 'hline' | 'trendline' | 'rect' | 'fib' | 'eraser'>('cursor');
  let balances = $state<any[]>([]);
  let orders = $state<any[]>([]);
  let ordersTab = $state<'open' | 'history'>('open');
  let mobileTab = $state<'chart' | 'trade' | 'orders'>('chart');
  let ticker = $state<MarketTicker | null>(null);
  let currentRate = $state(48.5);

  // Multi-chart layout: '1' | '2h' | '2v' | '4'
  type ChartLayout = '1' | '2h' | '2v' | '4';
  let chartLayout = $state<ChartLayout>('1');
  let chartsLinked = $state(true);
  let symbol2 = $state('ETHUSDT');
  let symbol3 = $state('BNBUSDT');
  let symbol4 = $state('SOLUSDT');

  // Indicator config (customizable)
  const defaultConfig: IndicatorConfig = {
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
  let indicatorConfig = $state<IndicatorConfig>(loadIndicatorConfig());

  function loadIndicatorConfig(): IndicatorConfig {
    if (typeof localStorage === 'undefined') return { ...defaultConfig };
    try {
      const raw = localStorage.getItem('nexus-indicator-config');
      if (raw) {
        const parsed = JSON.parse(raw);
        return { ...defaultConfig, ...parsed, colors: { ...defaultConfig.colors, ...(parsed.colors || {}) } };
      }
    } catch {}
    return { ...defaultConfig };
  }

  function saveIndicatorConfig(cfg: IndicatorConfig) {
    indicatorConfig = { ...cfg };
    try { localStorage.setItem('nexus-indicator-config', JSON.stringify(cfg)); } catch {}
    toasts.success('تم حفظ إعدادات المؤشرات');
  }

  function resetIndicatorConfig() {
    indicatorConfig = { ...defaultConfig, colors: { ...defaultConfig.colors } };
    try { localStorage.setItem('nexus-indicator-config', JSON.stringify(indicatorConfig)); } catch {}
    toasts.info('تمت استعادة الإعدادات الافتراضية');
  }

  // Active price alerts for current symbol → render as dashed lines on chart
  let allAlerts = $state<PriceAlert[]>([]);
  let unsubAlerts: (() => void) | null = null;

  const chartAlertLines = $derived(
    allAlerts
      .filter((a) => a.symbol === symbol && a.status === 'active')
      .map((a) => ({
        id: a.id,
        price: a.targetPrice,
        side: a.direction as 'above' | 'below',
        label: `${a.direction === 'above' ? '↑' : '↓'} ${formatPrice(a.targetPrice)}`
      }))
  );

  // Combined config for chart (indicator config + alert lines)
  const chartConfig = $derived({
    ...indicatorConfig,
    alertLines: chartAlertLines
  });

  // Persist chart layout preference
  $effect(() => {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem('nexus-chart-layout', chartLayout);
  });

  if (typeof localStorage !== 'undefined') {
    const savedLayout = localStorage.getItem('nexus-chart-layout') as ChartLayout | null;
    if (savedLayout && ['1', '2h', '2v', '4'].includes(savedLayout)) chartLayout = savedLayout;
  }

  const unsubRate = usdEgpRate.subscribe((r) => (currentRate = r));

  const unsubscribe = marketStore.subscribe((tickers) => {
    ticker = tickers[symbol] || null;
  });

  const favList = $favorites;

  let unsubNexus: (() => void) | null = null;

  onMount(() => {
  (async () => {
    const urlSym = new URLSearchParams(window.location.search).get('symbol');
    if (urlSym) symbol = urlSym;
    await Promise.all([loadBalances(), loadOrders(), connectTickerWS()])
  })();
  unsubAlerts = priceAlerts.subscribe((a) => (allAlerts = a));
  return () => {
      unsubscribe();
      unsubRate();
      unsubNexus?.();
      unsubAlerts?.();
    };
});

  // Listen for ticker updates from NexusChart's WebSocket
  function connectTickerWS() {
    // Bootstrap with REST snapshot
    (async () => {
      const all = await nexusMarket.getAllTickers();
      for (const t of all) {
        marketStore.updateTicker(t.symbol, {
          symbol: t.symbol,
          price: t.price,
          change24h: t.change24h,
          high24h: t.high24h,
          low24h: t.low24h,
          volume24h: t.volume24h
        });
      }
    })();
    // Subscribe to live ticks — NexusChart already streams the current symbol's
    // kline data via its own /ws/kline connection. We just subscribe to /ws/market
    // here for the ticker price updates that the header needs.
    unsubNexus = nexusMarket.subscribe(symbol, () => {});
    nexusMarket.switchSymbol(symbol);
  }

  // Track symbol changes — update URL + reload orders + switch Nexus feed
  $effect.pre(() => {
    const sym = symbol;
    loadOrders();
    nexusMarket.switchSymbol(sym);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('symbol', sym);
      window.history.replaceState({}, '', url.toString());
    }
  });

  async function loadBalances() {
    try {
      const res = await wallet.getBalances();
      balances = (await parseApiResponse<any[]>(res)) || [];
    } catch {}
  }

  async function loadOrders() {
    try {
      const status = ordersTab === 'open' ? 'PENDING' : undefined;
      const res = await exchange.getOrders({ symbol, status, limit: 20 });
      orders = (await parseApiResponse<any[]>(res)) || [];
    } catch {}
  }

  async function cancelOrder(id: number) {
    try {
      await exchange.cancelOrder(id);
      toasts.success('تم إلغاء الأمر');
      loadOrders();
    } catch {
      toasts.error('فشل إلغاء الأمر');
    }
  }

  const timeframes = ['1m', '5m', '15m', '1H', '4H', '1D', '1W'];
  const availableIndicators = [
    { k: 'SMA20', l: 'SMA 20', color: '#f5b544' },
    { k: 'SMA50', l: 'SMA 50', color: '#a855f7' },
    { k: 'EMA12', l: 'EMA 12', color: '#3b82f6' },
    { k: 'EMA26', l: 'EMA 26', color: '#22d3a4' },
    { k: 'BOLL', l: 'Bollinger', color: '#f5b544' },
    { k: 'VWAP', l: 'VWAP', color: '#a855f7' }
  ];

  function toggleIndicator(k: string) {
    if (indicators.includes(k)) {
      indicators = indicators.filter((i) => i !== k);
    } else {
      indicators = [...indicators, k];
    }
  }

  function clearDrawings() {
    (chartComponent as any)?.clearDrawings?.();
    toasts.info('تم مسح جميع الرسومات على الشارت');
  }

  // Build chart markers from filled orders (visual trade history on chart)
  let chartMarkers = $derived(
    orders
      .filter((o) => o.status === 'FILLED' && o.symbol === symbol)
      .slice(-20)
      .map((o) => ({
        side: o.side as 'BUY' | 'SELL',
        price: Number(o.price) || 0,
        time: o.created_at ? new Date(o.created_at).getTime() : Date.now(),
        qty: Number(o.quantity) || 0
      }))
  );

  const { base, quote } = $derived(formatSymbol(symbol));
</script>

<svelte:head><title>التداول — {symbol} — NEXUS</title></svelte:head>

<div class="space-y-3 pb-20 lg:pb-0">
  <!-- Pair header -->
  <div class="panel p-4 flex flex-wrap items-center justify-between gap-4">
    <div class="flex items-center gap-2">
      <button
        onclick={() => favorites.toggle(symbol)}
        class="p-1 hover:scale-110 transition-transform"
        aria-label="إضافة للمفضلة"
        title="إضافة للمفضلة"
      >
        <Star size={20} class={favList.includes(symbol) ? 'text-accent-gold fill-accent-gold' : 'text-slate-500'} />
      </button>
      <button
        onclick={() => (alertModalOpen = true)}
        class="p-1.5 rounded-lg hover:bg-white/5 text-slate-400 hover:text-accent-gold transition-colors relative"
        aria-label="إنشاء تنبيه سعر"
        title="إنشاء تنبيه سعر"
      >
        <BellRing size={18} />
      </button>
    </div>
      <div>
        <div class="flex items-center gap-2">
          <h1 class="text-xl font-bold text-white">{base}<span class="text-slate-500">/{quote}</span></h1>
          <span class="pill-gold">SPOT</span>
        </div>
        <div class="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1">
          <Coins size={10} class="text-accent-gold" />
          <span>العملة الأساسية: ج.م</span>
        </div>
      </div>

    <div class="flex items-center gap-4 sm:gap-6 flex-wrap">
      <div>
        <div class="text-[10px] text-slate-500 mb-0.5">آخر سعر</div>
        <PriceFlash value={ticker?.price || 0} prevValue={ticker?.prevPrice} className="text-lg font-bold font-mono text-white" />
        <div class="text-[11px] text-accent-gold font-mono tabular-nums mt-0.5">
          ≈ {egpCompact(usdToEgp(ticker?.price || 0, currentRate))}
        </div>
      </div>
      <div>
        <div class="text-[10px] text-slate-500 mb-0.5">24h</div>
        {#if ticker}<ChangeBadge change={ticker.change24h} className="text-sm" />{:else}<span class="text-sm text-slate-500">--</span>{/if}
      </div>
      <div class="hidden sm:block">
        <div class="text-[10px] text-slate-500 mb-0.5">أعلى 24h</div>
        <span class="text-sm font-mono text-slate-300 tabular-nums">{ticker ? formatPrice(ticker.high24h) : '--'}</span>
      </div>
      <div class="hidden sm:block">
        <div class="text-[10px] text-slate-500 mb-0.5">أقل 24h</div>
        <span class="text-sm font-mono text-slate-300 tabular-nums">{ticker ? formatPrice(ticker.low24h) : '--'}</span>
      </div>
      <div class="hidden md:block">
        <div class="text-[10px] text-slate-500 mb-0.5">حجم 24h</div>
        <span class="text-sm font-mono text-slate-300 tabular-nums">{ticker ? formatCompact(ticker.volume24h) : '--'} {base}</span>
      </div>
    </div>
  </div>

  <!-- Main grid -->
  <div class="grid grid-cols-1 lg:grid-cols-[260px_1fr_300px] gap-3">
    <!-- Left: Market list -->
    <div class="panel hidden lg:flex flex-col overflow-hidden" style="height: 600px;">
      <MarketList selectedSymbol={symbol} onSelect={(s) => (symbol = s)} />
    </div>

    <!-- Center -->
    <div class="flex flex-col gap-3">
      <!-- Chart panel -->
      <div class="panel overflow-hidden">
        <div class="flex items-center justify-between border-b border-white/5 px-3 py-2">
          <div class="flex items-center gap-1 overflow-x-auto scrollbar-none">
            {#each timeframes as tf}
              <button
                onclick={() => (timeframe = tf)}
                class="px-2.5 py-1 text-xs rounded-md font-medium transition-colors whitespace-nowrap {timeframe === tf ? 'bg-accent-gold/15 text-accent-gold' : 'text-slate-400 hover:bg-white/5 hover:text-white'}"
              >
                {tf}
              </button>
            {/each}
          </div>

          <div class="flex items-center gap-1">
            <div class="relative">
              <button onclick={() => (indicatorsPanelOpen = !indicatorsPanelOpen)} class="p-1.5 rounded-md text-slate-400 hover:bg-white/5 hover:text-white" aria-label="المؤشرات">
                <Settings2 size={14} />
              </button>
              {#if indicatorsPanelOpen}
                <div class="absolute left-0 mt-1 z-20 w-44 panel-glow p-2 text-xs">
                  <p class="px-2 py-1 text-[10px] uppercase tracking-wider text-slate-500 font-bold">المؤشرات</p>
                  {#each availableIndicators as ind}
                    <button onclick={() => toggleIndicator(ind.k)} class="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-white/5">
                      <span class="w-2 h-2 rounded-full" style="background: {ind.color};"></span>
                      <span class="text-slate-200">{ind.l}</span>
                      {#if indicators.includes(ind.k)}
                        <svg class="w-3 h-3 mr-auto text-accent-mint" viewBox="0 0 12 12" fill="none">
                          <path d="M2 6l3 3 5-6" stroke="currentColor" stroke-width="2" fill="none" />
                        </svg>
                      {/if}
                    </button>
                  {/each}
                  <div class="border-t border-white/5 mt-2 pt-2">
                    <button onclick={() => { indicatorsPanelOpen = false; indicatorSettingsOpen = true; }} class="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-white/5 text-accent-gold">
                      <SlidersHorizontal size={12} />
                      <span>إعدادات المؤشرات</span>
                    </button>
                  </div>
                </div>
              {/if}
            </div>
            <!-- Layout picker: 1 / 2h / 2v / 4 -->
            <div class="flex items-center gap-0.5 bg-white/[0.03] rounded-md p-0.5">
              <button onclick={() => (chartLayout = '1')} class="p-1 rounded {chartLayout === '1' ? 'bg-accent-gold/20 text-accent-gold' : 'text-slate-400 hover:text-white'}" aria-label="شارت واحد" title="شارت واحد">
                <Square size={12} />
              </button>
              <button onclick={() => (chartLayout = '2h')} class="p-1 rounded {chartLayout === '2h' ? 'bg-accent-gold/20 text-accent-gold' : 'text-slate-400 hover:text-white'}" aria-label="شارتين أفقي" title="شارتين أفقي">
                <Columns2 size={12} />
              </button>
              <button onclick={() => (chartLayout = '2v')} class="p-1 rounded {chartLayout === '2v' ? 'bg-accent-gold/20 text-accent-gold' : 'text-slate-400 hover:text-white'}" aria-label="شارتين رأسي" title="شارتين رأسي">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="8" rx="1" /><rect x="3" y="13" width="18" height="8" rx="1" /></svg>
              </button>
              <button onclick={() => (chartLayout = '4')} class="p-1 rounded {chartLayout === '4' ? 'bg-accent-gold/20 text-accent-gold' : 'text-slate-400 hover:text-white'}" aria-label="4 شارتات" title="4 شارتات">
                <Grid2x2 size={12} />
              </button>
            </div>
            {#if chartLayout !== '1'}
              <button onclick={() => (chartsLinked = !chartsLinked)} class="p-1.5 rounded-md {chartsLinked ? 'text-accent-mint bg-accent-mint/10' : 'text-slate-400 hover:bg-white/5 hover:text-white'}" aria-label="ربط الشارتات" title="{chartsLinked ? 'مرتبطة' : 'غير مرتبطة'}">
                {#if chartsLinked}<Link2 size={14} />{:else}<Unlink size={14} />{/if}
              </button>
            {/if}
            <button onclick={() => chartComponent?.zoomIn()} class="p-1.5 rounded-md text-slate-400 hover:bg-white/5 hover:text-white" aria-label="تكبير"><ZoomIn size={14} /></button>
            <button onclick={() => chartComponent?.zoomOut()} class="p-1.5 rounded-md text-slate-400 hover:bg-white/5 hover:text-white" aria-label="تصغير"><ZoomOut size={14} /></button>
            <button onclick={() => chartComponent?.resetView()} class="p-1.5 rounded-md text-slate-400 hover:bg-white/5 hover:text-white" aria-label="إعادة الضبط"><Maximize2 size={14} /></button>
            <button onclick={() => chartComponent?.goLive()} class="p-1.5 rounded-md text-accent-mint hover:bg-accent-mint/10" aria-label="الذهاب للمباشر" title="الذهاب لأحدث سعر">
              <Crosshair size={14} />
            </button>
            <button onclick={() => chartComponent?.exportPng()} class="p-1.5 rounded-md text-slate-400 hover:bg-white/5 hover:text-white" aria-label="تصدير PNG"><Camera size={14} /></button>
          </div>
        </div>

        <!-- Pro toolbar: chart type + drawing tools + overlay/sub indicators -->
        <NexusChartToolbar bind:chartType bind:tool={drawTool} bind:indicators bind:subIndicators onClearDrawings={clearDrawings} />

        <!-- Single chart -->
        {#if chartLayout === '1'}
          <div class="relative" style="height: 540px;">
            <NexusChart bind:this={chartComponent} {symbol} {timeframe} {indicators} {subIndicators} {chartType} tool={drawTool} height={540} markers={chartMarkers} config={chartConfig} />
          </div>
        {:else if chartLayout === '2h'}
          <!-- 2 charts horizontal -->
          <div class="grid grid-cols-2 gap-1 p-1 bg-ink-950/50">
            <div class="relative border border-white/5 rounded-md overflow-hidden">
              <div class="absolute top-1 right-1 z-10 px-1.5 py-0.5 bg-black/60 rounded text-[10px] font-mono text-accent-gold">{symbol}</div>
              <NexusChart bind:this={chartComponent} {symbol} {timeframe} {indicators} {subIndicators} {chartType} tool={drawTool} height={520} markers={chartMarkers} config={chartConfig} />
            </div>
            <div class="relative border border-white/5 rounded-md overflow-hidden">
              <div class="absolute top-1 right-1 z-10 px-1.5 py-0.5 bg-black/60 rounded text-[10px] font-mono text-accent-gold">
                <input type="text" list="symbol-list" bind:value={symbol2} class="bg-transparent w-20 outline-none focus:bg-ink-900 px-1" />
              </div>
              <NexusChart bind:this={chart2Component} symbol={chartsLinked ? symbol : symbol2} {timeframe} {indicators} {subIndicators} {chartType} tool={drawTool} height={520} config={chartConfig} />
            </div>
          </div>
        {:else if chartLayout === '2v'}
          <!-- 2 charts vertical -->
          <div class="grid grid-rows-2 gap-1 p-1 bg-ink-950/50" style="height: 540px;">
            <div class="relative border border-white/5 rounded-md overflow-hidden">
              <div class="absolute top-1 right-1 z-10 px-1.5 py-0.5 bg-black/60 rounded text-[10px] font-mono text-accent-gold">{symbol}</div>
              <NexusChart bind:this={chartComponent} {symbol} {timeframe} {indicators} {subIndicators} {chartType} tool={drawTool} height={265} markers={chartMarkers} config={chartConfig} />
            </div>
            <div class="relative border border-white/5 rounded-md overflow-hidden">
              <div class="absolute top-1 right-1 z-10 px-1.5 py-0.5 bg-black/60 rounded text-[10px] font-mono text-accent-gold">
                <input type="text" list="symbol-list" bind:value={symbol2} class="bg-transparent w-20 outline-none focus:bg-ink-900 px-1" />
              </div>
              <NexusChart bind:this={chart2Component} symbol={chartsLinked ? symbol : symbol2} {timeframe} {indicators} {subIndicators} {chartType} tool={drawTool} height={265} config={chartConfig} />
            </div>
          </div>
        {:else if chartLayout === '4'}
          <!-- 4 charts (2x2) -->
          <div class="grid grid-cols-2 grid-rows-2 gap-1 p-1 bg-ink-950/50" style="height: 540px;">
            <div class="relative border border-white/5 rounded-md overflow-hidden">
              <div class="absolute top-1 right-1 z-10 px-1.5 py-0.5 bg-black/60 rounded text-[10px] font-mono text-accent-gold">{symbol}</div>
              <NexusChart bind:this={chartComponent} {symbol} {timeframe} {indicators} {subIndicators} {chartType} tool={drawTool} height={265} markers={chartMarkers} config={chartConfig} />
            </div>
            <div class="relative border border-white/5 rounded-md overflow-hidden">
              <div class="absolute top-1 right-1 z-10 px-1.5 py-0.5 bg-black/60 rounded text-[10px] font-mono text-accent-gold">
                <input type="text" list="symbol-list" bind:value={symbol2} class="bg-transparent w-20 outline-none focus:bg-ink-900 px-1" />
              </div>
              <NexusChart bind:this={chart2Component} symbol={chartsLinked ? symbol : symbol2} {timeframe} {indicators} {subIndicators} {chartType} tool={drawTool} height={265} config={chartConfig} />
            </div>
            <div class="relative border border-white/5 rounded-md overflow-hidden">
              <div class="absolute top-1 right-1 z-10 px-1.5 py-0.5 bg-black/60 rounded text-[10px] font-mono text-accent-gold">
                <input type="text" list="symbol-list" bind:value={symbol3} class="bg-transparent w-20 outline-none focus:bg-ink-900 px-1" />
              </div>
              <NexusChart bind:this={chart3Component} symbol={chartsLinked ? symbol : symbol3} {timeframe} {indicators} {subIndicators} {chartType} tool={drawTool} height={265} config={chartConfig} />
            </div>
            <div class="relative border border-white/5 rounded-md overflow-hidden">
              <div class="absolute top-1 right-1 z-10 px-1.5 py-0.5 bg-black/60 rounded text-[10px] font-mono text-accent-gold">
                <input type="text" list="symbol-list" bind:value={symbol4} class="bg-transparent w-20 outline-none focus:bg-ink-900 px-1" />
              </div>
              <NexusChart bind:this={chart4Component} symbol={chartsLinked ? symbol : symbol4} {timeframe} {indicators} {subIndicators} {chartType} tool={drawTool} height={265} config={chartConfig} />
            </div>
          </div>
        {/if}

        <!-- Symbol datalist for multi-chart symbol inputs -->
        <datalist id="symbol-list">
          <option value="BTCUSDT"></option>
          <option value="ETHUSDT"></option>
          <option value="BNBUSDT"></option>
          <option value="SOLUSDT"></option>
          <option value="XRPUSDT"></option>
          <option value="ADAUSDT"></option>
          <option value="DOGEUSDT"></option>
          <option value="AVAXUSDT"></option>
          <option value="DOTUSDT"></option>
          <option value="LINKUSDT"></option>
          <option value="MATICUSDT"></option>
          <option value="TRXUSDT"></option>
          <option value="LTCUSDT"></option>
          <option value="ATOMUSDT"></option>
        </datalist>
      </div>

      <!-- Orders panel -->
      <div class="panel overflow-hidden">
        <div class="px-4 pt-3 pb-0 border-b border-white/5">
          <NavTabs
            value={ordersTab}
            onchange={(key) => { ordersTab = key as any; loadOrders(); }}
            variant="underline"
            size="sm"
            items={[
              { key: 'open', label: 'الأوامر المفتوحة' },
              { key: 'history', label: 'السجل' }
            ]}
          />
        </div>

        <div class="overflow-x-auto max-h-72">
          {#if orders.length === 0}
            <div class="py-8 text-center text-slate-500 text-sm">لا توجد أوامر {ordersTab === 'open' ? 'مفتوحة' : 'في السجل'}</div>
          {:else}
            <table class="w-full text-xs">
              <thead>
                <tr class="text-[10px] uppercase tracking-wider text-slate-500 border-b border-white/5">
                  <th class="text-right font-medium px-4 py-2">الوقت</th>
                  <th class="text-right font-medium px-4 py-2">الزوج</th>
                  <th class="text-right font-medium px-4 py-2">النوع</th>
                  <th class="text-right font-medium px-4 py-2">السعر (ج.م)</th>
                  <th class="text-right font-medium px-4 py-2">الكمية</th>
                  <th class="text-right font-medium px-4 py-2">الحالة</th>
                  {#if ordersTab === 'open'}<th class="text-left font-medium px-4 py-2">إجراء</th>{/if}
                </tr>
              </thead>
              <tbody>
                {#each orders.slice(0, 20) as o}
                  <tr class="border-b border-white/5 last:border-0 hover:bg-white/[0.02]">
                    <td class="px-4 py-2 text-slate-400">{timeAgo(o.created_at)}</td>
                    <td class="px-4 py-2 font-semibold text-white">{o.symbol}</td>
                    <td class="px-4 py-2">
                      <span class="pill {o.side === 'BUY' ? 'pill-mint' : 'pill-rose'}">
                        {o.side === 'BUY' ? 'شراء' : 'بيع'} {o.type === 'MARKET' ? 'سوقي' : o.type === 'LIMIT' ? 'محدد' : o.type}
                      </span>
                    </td>
                    <td class="px-4 py-2 font-mono text-slate-300 tabular-nums">{formatEGP(usdToEgp(o.price, currentRate))}</td>
                    <td class="px-4 py-2 font-mono text-slate-300 tabular-nums">{formatPrice(o.quantity, 6)}</td>
                    <td class="px-4 py-2">
                      <span class="pill {o.status === 'FILLED' ? 'pill-mint' : o.status === 'PENDING' ? 'pill-gold' : 'pill-rose'}">
                        {o.status === 'FILLED' ? 'مكتمل' : o.status === 'PENDING' ? 'معلق' : o.status === 'CANCELLED' ? 'ملغى' : o.status}
                      </span>
                    </td>
                    {#if ordersTab === 'open'}
                      <td class="px-4 py-2 text-left">
                        <button onclick={() => cancelOrder(o.id)} class="text-accent-rose hover:underline text-[11px]">إلغاء</button>
                      </td>
                    {/if}
                  </tr>
                {/each}
              </tbody>
            </table>
          {/if}
        </div>
      </div>
    </div>

    <!-- Right -->
    <div class="flex flex-col gap-3">
      <div class="panel hidden lg:flex flex-col overflow-hidden" style="height: 380px;">
        <OrderBook {symbol} />
      </div>

      <!-- Depth chart -->
      <div class="panel hidden lg:flex flex-col overflow-hidden p-2" style="height: 160px;">
        <div class="flex items-center justify-between px-1 pb-1">
          <span class="text-[10px] text-slate-500 uppercase tracking-wider">العمق</span>
          <span class="text-[10px] text-slate-500">20 مستوى</span>
        </div>
        <DepthChart {symbol} height={120} />
      </div>

      <div class="panel p-4">
        <TradeForm {symbol} {balances} />
      </div>

      <div class="panel hidden lg:flex flex-col overflow-hidden" style="height: 240px;">
        <TradesFeed {symbol} />
      </div>

      <!-- Price alerts panel -->
      <div class="hidden lg:block">
        <AlertsPanel {symbol} compact={true} />
      </div>
    </div>
  </div>

  <!-- Account summary bar (bottom) -->
  <div class="sticky bottom-0 lg:bottom-0 z-20 -mx-3 lg:mx-0">
    <AccountSummaryBar {symbol} />
  </div>

  <!-- Mobile tab bar -->
  <div class="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-ink-900/95 backdrop-blur-xl border-t border-white/5">
    <div class="grid grid-cols-3 h-14">
      <button onclick={() => (mobileTab = 'chart')} class="flex flex-col items-center justify-center gap-0.5 text-[10px] {mobileTab === 'chart' ? 'text-accent-gold' : 'text-slate-400'}">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12l4-4 4 4 4-6 4 4 2-2" /></svg>
        <span>الشارت</span>
      </button>
      <button onclick={() => (mobileTab = 'trade')} class="flex flex-col items-center justify-center gap-0.5 text-[10px] {mobileTab === 'trade' ? 'text-accent-gold' : 'text-slate-400'}">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 8h14M5 16h14" /></svg>
        <span>تداول</span>
      </button>
      <button onclick={() => (mobileTab = 'orders')} class="flex flex-col items-center justify-center gap-0.5 text-[10px] {mobileTab === 'orders' ? 'text-accent-gold' : 'text-slate-400'}">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M8 8h8M8 12h8M8 16h4" /></svg>
        <span>أوامري</span>
      </button>
    </div>
  </div>

  <!-- Mobile content -->
  {#if mobileTab === 'trade'}
    <div class="panel p-4 lg:hidden">
      <TradeForm {symbol} {balances} />
    </div>
  {:else if mobileTab === 'orders'}
    <div class="panel overflow-hidden lg:hidden">
      <div class="px-4 pt-3 pb-0 border-b border-white/5">
        <NavTabs
          value={ordersTab}
          onchange={(key) => { ordersTab = key as any; loadOrders(); }}
          variant="underline"
          size="sm"
          items={[
            { key: 'open', label: 'المفتوحة' },
            { key: 'history', label: 'السجل' }
          ]}
        />
      </div>
      <div class="overflow-x-auto">
        {#if orders.length === 0}
          <div class="py-8 text-center text-slate-500 text-sm">لا توجد أوامر</div>
        {:else}
          <table class="w-full text-xs">
            <thead>
              <tr class="text-[10px] uppercase tracking-wider text-slate-500 border-b border-white/5">
                <th class="text-right font-medium px-3 py-2">الزوج</th>
                <th class="text-right font-medium px-3 py-2">النوع</th>
                <th class="text-right font-medium px-3 py-2">السعر (ج.م)</th>
                <th class="text-left font-medium px-3 py-2">الحالة</th>
              </tr>
            </thead>
            <tbody>
              {#each orders.slice(0, 15) as o}
                <tr class="border-b border-white/5 last:border-0">
                  <td class="px-3 py-2 font-semibold text-white">{o.symbol}</td>
                  <td class="px-3 py-2">
                    <span class="pill {o.side === 'BUY' ? 'pill-mint' : 'pill-rose'}">{o.side === 'BUY' ? 'شراء' : 'بيع'}</span>
                  </td>
                  <td class="px-3 py-2 font-mono text-slate-300">{formatEGP(usdToEgp(o.price, currentRate))}</td>
                  <td class="px-3 py-2 text-left">
                    <span class="pill {o.status === 'FILLED' ? 'pill-mint' : o.status === 'PENDING' ? 'pill-gold' : 'pill-rose'}">
                      {o.status === 'FILLED' ? 'مكتمل' : o.status === 'PENDING' ? 'معلق' : o.status}
                    </span>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        {/if}
      </div>
    </div>
  {:else if mobileTab === 'chart'}
    <div class="panel overflow-hidden mb-3 lg:hidden" style="height: 280px;">
      <MarketList selectedSymbol={symbol} onSelect={(s) => (symbol = s)} />
    </div>
    <div class="panel overflow-hidden lg:hidden">
      <div class="flex items-center gap-1 border-b border-white/5 px-3 py-2 overflow-x-auto scrollbar-none">
        {#each timeframes as tf}
          <button onclick={() => (timeframe = tf)} class="px-2 py-1 text-xs rounded-md font-medium whitespace-nowrap {timeframe === tf ? 'bg-accent-gold/15 text-accent-gold' : 'text-slate-400'}">{tf}</button>
        {/each}
      </div>
      <div class="relative" style="height: 380px;">
        <NexusChart bind:this={chartComponent} {symbol} {timeframe} {indicators} {subIndicators} {chartType} tool={drawTool} height={380} />
      </div>
    </div>
  {/if}
</div>

<!-- Alert creation modal -->
<AlertModal bind:open={alertModalOpen} {symbol} />

<!-- Indicator settings modal -->
<IndicatorSettingsModal
  bind:open={indicatorSettingsOpen}
  config={indicatorConfig}
  onsave={saveIndicatorConfig}
  onreset={resetIndicatorConfig}
/>
