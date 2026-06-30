<script lang="ts">
  /**
   * NEXUS Futures — perpetual futures trading page.
   * Features: leverage slider, long/short toggle, positions table with
   * live P&L, funding rate, liquidation price, order types (market/limit/stop),
   * open orders + history tabs. All Arabic UI.
   */
  import { onMount, onDestroy } from 'svelte';
  import NexusChart from '$lib/components/NexusChart.svelte';
  import NexusChartToolbar from '$lib/components/NexusChartToolbar.svelte';
  import MarketList from '$lib/components/MarketList.svelte';
  import NavTabs from '$lib/components/NavTabs.svelte';
  import PriceFlash from '$lib/components/PriceFlash.svelte';
  import ChangeBadge from '$lib/components/ChangeBadge.svelte';
  import { nexusMarket } from '$lib/stores/nexus-market';
  import { marketStore, type MarketTicker } from '$lib/stores/market';
  import { usdToEgp, formatEGP, usdEgpRate } from '$lib/utils/currency';
  import { formatPrice, formatSymbol, formatCompact, timeAgo } from '$lib/utils/format';
  import { toasts } from '$lib/stores/toast';
  import {
    Star,
    Zap,
    Percent,
    Info,
    Shield,
    AlertTriangle,
    PlusCircle,
    MinusCircle,
    Wallet,
    ArrowUp,
    ArrowDown,
    Clock
  } from 'lucide-svelte';

  let symbol = $state('BTCUSDT');
  let timeframe = $state('1H');
  let indicators = $state<string[]>(['SMA20', 'VWAP']);
  let subIndicators = $state<string[]>(['RSI']);
  let chartType = $state<'candles' | 'heikin-ashi' | 'line' | 'area'>('candles');
  let drawTool = $state<'cursor' | 'hline' | 'trendline' | 'rect' | 'fib' | 'eraser'>('cursor');
  let chartComponent = $state<NexusChart>();

  let leverage = $state(10);
  let marginMode = $state<'isolated' | 'cross'>('cross');
  let orderSide = $state<'LONG' | 'SHORT'>('LONG');
  let orderType = $state<'MARKET' | 'LIMIT' | 'STOP'>('LIMIT');
  let limitPrice = $state(0);
  let orderQty = $state('');
  let orderSliderPct = $state(0);
  let reduceOnly = $state(false);
  let tpsl = $state(false);
  let takeProfit = $state('');
  let stopLoss = $state('');

  let balances = $state<any[]>([]);
  let positions = $state<any[]>([]);
  let openOrders = $state<any[]>([]);
  let tab = $state<'positions' | 'openOrders' | 'orderHistory' | 'tradeHistory' | 'funding'>('positions');
  let ticker = $state<MarketTicker | null>(null);
  let currentRate = $state(48.5);
  let fundingRate = $state(0.0001);
  let nextFundingMs = $state(Date.now() + 4 * 3600 * 1000);

  const unsubRate = usdEgpRate.subscribe((r) => (currentRate = r));
  let unsubMkt: (() => void) | null = null;
  let unsubNexus: (() => void) | null = null;
  let fundingInterval: any = null;

  function generateMockPositions() {
    const usdtBal = balances.find((b) => b.currency === 'USDT')?.balance || 5000;
    if (positions.length === 0 && ticker?.price) {
      positions = [
        {
          id: 1,
          symbol: 'BTCUSDT',
          side: 'LONG',
          leverage: 10,
          margin: usdtBal * 0.2,
          entry_price: ticker.price * 0.985,
          mark_price: ticker.price,
          qty: (usdtBal * 0.2 * 10) / ticker.price,
          liq_price: ticker.price * 0.91,
          created_at: new Date(Date.now() - 3600 * 1000 * 4).toISOString()
        }
      ];
    }
  }

  onMount(() => {
    (async () => {
      const urlSym = new URLSearchParams(window.location.search).get('symbol');
      if (urlSym) symbol = urlSym;

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

      balances = [
        { currency: 'USDT', balance: 5000, usd_value: 5000 },
        { currency: 'BTC', balance: 0.05, usd_value: 0.05 * (ticker?.price || 50000) }
      ];

      unsubMkt = marketStore.subscribe((tickers) => {
        ticker = tickers[symbol] || null;
        if (ticker && !limitPrice) limitPrice = ticker.price;
        if (ticker) {
          positions = positions.map((p) =>
            p.symbol === symbol ? { ...p, mark_price: ticker.price } : p
          );
        }
      });

      unsubNexus = nexusMarket.subscribe(symbol, () => {});
      nexusMarket.switchSymbol(symbol);

      setTimeout(generateMockPositions, 1500);

      fundingInterval = setInterval(() => {
        if (nextFundingMs > Date.now()) {
          nextFundingMs -= 1000;
        } else {
          nextFundingMs = Date.now() + 8 * 3600 * 1000;
          fundingRate = (Math.random() - 0.5) * 0.0008;
        }
      }, 1000);
    })();

    return () => {
      unsubRate();
      unsubMkt?.();
      unsubNexus?.();
      if (fundingInterval) clearInterval(fundingInterval);
    };
  });

  onDestroy(() => {
    if (typeof window === 'undefined') return;
    unsubRate();
    unsubMkt?.();
    unsubNexus?.();
    if (fundingInterval) clearInterval(fundingInterval);
  });

  $effect.pre(() => {
    nexusMarket.switchSymbol(symbol);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('symbol', symbol);
      window.history.replaceState({}, '', url.toString());
    }
  });

  const timeframes = ['1m', '5m', '15m', '1H', '4H', '1D', '1W'];

  function setLeverage(lev: number) {
    leverage = Math.max(1, Math.min(125, lev));
  }

  function setQtyPct(pct: number) {
    orderSliderPct = pct;
    const usdtBal = balances.find((b) => b.currency === 'USDT')?.balance || 0;
    const price = orderType === 'MARKET' ? ticker?.price || 0 : limitPrice;
    if (price > 0) {
      const margin = (usdtBal * pct) / 100;
      const qty = (margin * leverage) / price;
      orderQty = qty.toFixed(6);
    }
  }

  function submitOrder() {
    if (!orderQty || Number(orderQty) <= 0) {
      toasts.error('أدخل كمية صحيحة');
      return;
    }
    if (orderType === 'LIMIT' && (!limitPrice || limitPrice <= 0)) {
      toasts.error('أدخل سعراً صحيحاً للأمر المحدد');
      return;
    }
    const price = orderType === 'MARKET' ? ticker?.price || 0 : limitPrice;
    const newOrder = {
      id: Date.now(),
      symbol,
      side: orderSide === 'LONG' ? 'BUY' : 'SELL',
      type: orderType,
      price,
      qty: Number(orderQty),
      leverage,
      margin_mode: marginMode,
      reduce_only: reduceOnly,
      status: 'PENDING',
      created_at: new Date().toISOString()
    };
    openOrders = [newOrder, ...openOrders];
    toasts.success(`تم إنشاء أمر ${orderSide === 'LONG' ? 'شراء (لونج)' : 'بيع (شورت)'} ${orderQty} ${formatSymbol(symbol).base}`);
    orderQty = '';
    orderSliderPct = 0;
  }

  function cancelOrder(id: number) {
    openOrders = openOrders.filter((o) => o.id !== id);
    toasts.info('تم إلغاء الأمر');
  }

  function closePosition(id: number) {
    const pos = positions.find((p) => p.id === id);
    if (!pos) return;
    positions = positions.filter((p) => p.id !== id);
    const pnl = ((pos.mark_price - pos.entry_price) * pos.qty * (pos.side === 'LONG' ? 1 : -1));
    toasts.success(`تم إغلاق المركز. الربح/الخسارة: ${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)} USDT`);
  }

  function posPnl(p: any) {
    return (p.mark_price - p.entry_price) * p.qty * (p.side === 'LONG' ? 1 : -1);
  }
  function posPnlPct(p: any) {
    return (posPnl(p) / (p.margin || 1)) * 100;
  }
  function posRoe(p: any) {
    return posPnlPct(p);
  }

  let availableUsdt = $derived(balances.find((b) => b.currency === 'USDT')?.balance || 0);
  let marginBalance = $derived(
    balances.reduce((s, b) => s + (b.usd_value || 0), 0) + positions.reduce((s, p) => s + posPnl(p), 0)
  );
  let maintenanceMargin = $derived(
    positions.reduce((s, p) => s + (p.margin || 0) * 0.005, 0)
  );
  let marginRatio = $derived(
    maintenanceMargin > 0 ? (maintenanceMargin / marginBalance) * 100 : 0
  );
  let totalUnrealizedPnl = $derived(positions.reduce((s, p) => s + posPnl(p), 0));

  let fundingCountdown = $derived(() => {
    const ms = Math.max(0, nextFundingMs - Date.now());
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  });

  const { base, quote } = $derived(formatSymbol(symbol));
</script>

<svelte:head><title>العقود — {symbol} — NEXUS</title></svelte:head>

<div class="relative space-y-3 pb-32 lg:pb-4">
  <!-- Ambient aurora background -->
  <div class="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
    <div class="absolute top-[-10%] right-[-5%] w-[480px] h-[480px] rounded-full bg-accent-violet/[0.08] blur-[120px] animate-pulse-glow"></div>
    <div class="absolute bottom-[-10%] left-[-5%] w-[420px] h-[420px] rounded-full bg-accent-rose/[0.06] blur-[120px] animate-pulse-glow" style="animation-delay:1.5s"></div>
    <div class="absolute top-[40%] right-[20%] w-[320px] h-[320px] rounded-full bg-accent-gold/[0.05] blur-[120px] animate-pulse-glow" style="animation-delay:0.8s"></div>
  </div>

  <!-- Top bar: pair + price + stats -->
  <div class="panel relative p-4 flex flex-wrap items-center justify-between gap-4">
    <div class="absolute top-0 inset-x-0 h-px bg-gradient-to-l from-transparent via-accent-gold/40 to-transparent"></div>
    <div class="flex items-center gap-3">
      <button onclick={() => favorites.toggle(symbol)} class="p-1 hover:scale-110 transition-transform" aria-label="إضافة للمفضلة">
        <Star size={20} class="text-slate-500" />
      </button>
      <div>
        <div class="flex items-center gap-2">
          <h1 class="text-xl font-bold text-white tracking-tight">{base}<span class="text-slate-500">/{quote}</span></h1>
          <span class="pill-gold">PERP</span>
          <span class="pill bg-accent-rose/10 text-accent-rose border border-accent-rose/20 flex items-center gap-1 text-[10px]">
            <span class="relative flex h-1.5 w-1.5">
              <span class="absolute inline-flex h-full w-full rounded-full bg-accent-rose opacity-75 animate-ping"></span>
              <span class="relative inline-flex rounded-full h-1.5 w-1.5 bg-accent-rose"></span>
            </span>
            مباشر
          </span>
        </div>
        <div class="text-[10px] text-slate-400 mt-0.5 flex items-center gap-2">
          <span class="flex items-center gap-1"><Zap size={10} class="text-accent-gold" />رافعة حتى 125x</span>
          <span class="flex items-center gap-1"><Percent size={10} class="text-accent-mint" />تمويل {fundingRate >= 0 ? '+' : ''}{(fundingRate * 100).toFixed(4)}%</span>
        </div>
      </div>
    </div>

    <div class="flex items-center gap-3 sm:gap-6 flex-wrap">
      <div>
        <div class="text-[10px] text-slate-500 mb-0.5">آخر سعر</div>
        <PriceFlash value={ticker?.price || 0} prevValue={ticker?.prevPrice} className="text-lg font-bold font-mono text-white" />
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
      <div class="hidden md:block">
        <div class="text-[10px] text-slate-500 mb-0.5">التمويل القادم</div>
        <span class="text-sm font-mono text-accent-gold tabular-nums">{fundingCountdown()}</span>
      </div>
    </div>
  </div>

  <!-- Account health bar -->
  <div class="panel relative p-3 flex items-center gap-3 text-xs flex-wrap">
    <div class="absolute top-0 inset-x-0 h-px bg-gradient-to-l from-transparent via-accent-mint/40 to-transparent"></div>
    <Wallet size={14} class="text-accent-gold" />
    <span class="text-slate-400">رصيد الهامش:</span>
    <span class="font-mono font-semibold text-white">{formatPrice(marginBalance)} <span class="text-slate-500 text-[10px]">USDT</span></span>
    <div class="h-4 w-px bg-white/5"></div>
    <span class="text-slate-400">P&L غير محقق:</span>
    <span class="font-mono font-semibold tabular-nums {totalUnrealizedPnl >= 0 ? 'text-accent-mint' : 'text-accent-rose'}">
      {totalUnrealizedPnl >= 0 ? '+' : ''}{formatPrice(totalUnrealizedPnl)} USDT
    </span>
    <div class="h-4 w-px bg-white/5 hidden sm:block"></div>
    <span class="text-slate-400 hidden sm:inline">نسبة الهامش:</span>
    <span class="font-mono font-semibold hidden sm:inline {marginRatio > 50 ? 'text-accent-rose' : marginRatio > 25 ? 'text-accent-gold' : 'text-accent-mint'}">{marginRatio.toFixed(2)}%</span>
    {#if marginRatio > 50}
      <span class="flex items-center gap-1 text-accent-rose text-[10px]"><AlertTriangle size={10} />خطر التصفية</span>
    {/if}
  </div>

  <!-- Main grid -->
  <div class="grid grid-cols-1 lg:grid-cols-[260px_1fr_320px] gap-3">
    <div class="panel relative hidden lg:flex flex-col overflow-hidden" style="height: 700px;">
      <div class="absolute top-0 inset-x-0 h-px bg-gradient-to-l from-transparent via-accent-violet/40 to-transparent"></div>
      <MarketList selectedSymbol={symbol} onSelect={(s) => (symbol = s)} />
    </div>

    <!-- Center: Chart + Positions -->
    <div class="flex flex-col gap-3">
      <div class="panel relative overflow-hidden">
        <div class="absolute top-0 inset-x-0 h-px bg-gradient-to-l from-transparent via-accent-gold/40 to-transparent z-10"></div>
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
          <div class="flex items-center gap-2 text-[11px]">
            <span class="text-slate-500">رافعة</span>
            <button onclick={() => setLeverage(leverage - 1)} class="p-1 rounded text-slate-400 hover:bg-white/5 hover:text-white"><MinusCircle size={12} /></button>
            <span class="font-mono font-bold text-accent-gold min-w-[40px] text-center">{leverage}x</span>
            <button onclick={() => setLeverage(leverage + 1)} class="p-1 rounded text-slate-400 hover:bg-white/5 hover:text-white"><PlusCircle size={12} /></button>
            <input type="range" min="1" max="125" bind:value={leverage} class="w-20 accent-accent-gold" />
          </div>
        </div>

        <NexusChartToolbar bind:chartType bind:tool={drawTool} bind:indicators bind:subIndicators />
        <div class="relative" style="height: 460px;">
          <NexusChart bind:this={chartComponent} {symbol} {timeframe} {indicators} {subIndicators} {chartType} tool={drawTool} height={460} markers={[]} />
        </div>
      </div>

      <div class="panel relative overflow-hidden">
        <div class="absolute top-0 inset-x-0 h-px bg-gradient-to-l from-transparent via-accent-violet/40 to-transparent"></div>
        <div class="px-4 pt-3 pb-0 border-b border-white/5">
          <NavTabs
            value={tab}
            onchange={(key) => (tab = key as any)}
            variant="underline"
            size="sm"
            items={[
              { key: 'positions', label: 'المراكز' },
              { key: 'openOrders', label: 'الأوامر المفتوحة' },
              { key: 'orderHistory', label: 'سجل الأوامر' },
              { key: 'tradeHistory', label: 'سجل التداول' },
              { key: 'funding', label: 'سجل التمويل' }
            ]}
          />
        </div>
        <div class="overflow-x-auto max-h-80">
          {#if tab === 'positions'}
            {#if positions.length === 0}
              <div class="py-14 text-center relative">
                <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div class="w-24 h-24 rounded-2xl bg-accent-violet/5 blur-3xl"></div>
                </div>
                <div class="relative inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-accent-violet/10 to-accent-rose/10 border border-white/5 mb-3">
                  <Wallet size={24} class="text-slate-500" />
                </div>
                <p class="text-sm text-slate-300 mb-1">لا توجد مراكز مفتوحة</p>
                <p class="text-xs text-slate-500">افتح مركز لونج أو شورت من اللوحة اليمنى</p>
              </div>
            {:else}
              <table class="w-full text-xs">
                <thead>
                  <tr class="text-[10px] uppercase tracking-wider text-slate-500 border-b border-white/5">
                    <th class="text-right font-medium px-4 py-2">الزوج</th>
                    <th class="text-right font-medium px-4 py-2">المركز</th>
                    <th class="text-right font-medium px-4 py-2">الرافعة</th>
                    <th class="text-right font-medium px-4 py-2">الهامش</th>
                    <th class="text-right font-medium px-4 py-2">السعر</th>
                    <th class="text-right font-medium px-4 py-2">السعر الحالي</th>
                    <th class="text-right font-medium px-4 py-2">الكمية</th>
                    <th class="text-right font-medium px-4 py-2">سعر التصفية</th>
                    <th class="text-right font-medium px-4 py-2">P&L</th>
                    <th class="text-right font-medium px-4 py-2">ROE%</th>
                    <th class="text-left font-medium px-4 py-2">إجراء</th>
                  </tr>
                </thead>
                <tbody>
                  {#each positions as p}
                    {@const pnl = posPnl(p)}
                    {@const roe = posRoe(p)}
                    <tr class="border-b border-white/5 last:border-0 hover:bg-white/[0.02]">
                      <td class="px-4 py-2 font-semibold text-white">{p.symbol}</td>
                      <td class="px-4 py-2">
                        <span class="pill {p.side === 'LONG' ? 'pill-mint' : 'pill-rose'}">
                          {p.side === 'LONG' ? 'لونج' : 'شورت'}
                        </span>
                      </td>
                      <td class="px-4 py-2 font-mono text-accent-gold">{p.leverage}x</td>
                      <td class="px-4 py-2 font-mono text-slate-300 tabular-nums">{formatPrice(p.margin)}</td>
                      <td class="px-4 py-2 font-mono text-slate-300 tabular-nums">{formatPrice(p.entry_price)}</td>
                      <td class="px-4 py-2 font-mono text-slate-300 tabular-nums">{formatPrice(p.mark_price)}</td>
                      <td class="px-4 py-2 font-mono text-slate-300 tabular-nums">{formatPrice(p.qty, 6)}</td>
                      <td class="px-4 py-2 font-mono text-accent-rose tabular-nums">{formatPrice(p.liq_price)}</td>
                      <td class="px-4 py-2 font-mono font-semibold tabular-nums {pnl >= 0 ? 'text-accent-mint' : 'text-accent-rose'}">
                        {pnl >= 0 ? '+' : ''}{formatPrice(pnl)}
                      </td>
                      <td class="px-4 py-2 font-mono font-semibold tabular-nums {roe >= 0 ? 'text-accent-mint' : 'text-accent-rose'}">
                        {roe >= 0 ? '+' : ''}{roe.toFixed(2)}%
                      </td>
                      <td class="px-4 py-2 text-left">
                        <button onclick={() => closePosition(p.id)} class="text-accent-rose hover:underline text-[11px] font-medium">إغلاق</button>
                      </td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            {/if}
          {:else if tab === 'openOrders'}
            {#if openOrders.length === 0}
              <div class="py-14 text-center relative">
                <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div class="w-24 h-24 rounded-2xl bg-accent-gold/5 blur-3xl"></div>
                </div>
                <div class="relative inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-accent-gold/10 to-accent-mint/10 border border-white/5 mb-3">
                  <Clock size={24} class="text-slate-500" />
                </div>
                <p class="text-sm text-slate-300 mb-1">لا توجد أوامر مفتوحة</p>
                <p class="text-xs text-slate-500">الأوامر المعلّقة ستظهر هنا</p>
              </div>
            {:else}
              <table class="w-full text-xs">
                <thead>
                  <tr class="text-[10px] uppercase tracking-wider text-slate-500 border-b border-white/5">
                    <th class="text-right font-medium px-4 py-2">الوقت</th>
                    <th class="text-right font-medium px-4 py-2">الزوج</th>
                    <th class="text-right font-medium px-4 py-2">النوع</th>
                    <th class="text-right font-medium px-4 py-2">الاتجاه</th>
                    <th class="text-right font-medium px-4 py-2">السعر</th>
                    <th class="text-right font-medium px-4 py-2">الكمية</th>
                    <th class="text-right font-medium px-4 py-2">الرافعة</th>
                    <th class="text-left font-medium px-4 py-2">إجراء</th>
                  </tr>
                </thead>
                <tbody>
                  {#each openOrders as o}
                    <tr class="border-b border-white/5 last:border-0">
                      <td class="px-4 py-2 text-slate-400">{timeAgo(o.created_at)}</td>
                      <td class="px-4 py-2 font-semibold text-white">{o.symbol}</td>
                      <td class="px-4 py-2 text-slate-300">{o.type === 'MARKET' ? 'سوقي' : o.type === 'LIMIT' ? 'محدد' : 'إيقاف'}</td>
                      <td class="px-4 py-2">
                        <span class="pill {o.side === 'BUY' ? 'pill-mint' : 'pill-rose'}">{o.side === 'BUY' ? 'شراء' : 'بيع'}</span>
                      </td>
                      <td class="px-4 py-2 font-mono text-slate-300 tabular-nums">{formatPrice(o.price)}</td>
                      <td class="px-4 py-2 font-mono text-slate-300 tabular-nums">{formatPrice(o.qty, 6)}</td>
                      <td class="px-4 py-2 font-mono text-accent-gold">{o.leverage}x</td>
                      <td class="px-4 py-2 text-left">
                        <button onclick={() => cancelOrder(o.id)} class="text-accent-rose hover:underline text-[11px] font-medium">إلغاء</button>
                      </td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            {/if}
          {:else}
            <div class="py-14 text-center relative">
              <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div class="w-24 h-24 rounded-2xl bg-accent-mint/5 blur-3xl"></div>
              </div>
              <div class="relative inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-accent-mint/10 to-accent-gold/10 border border-white/5 mb-3">
                <Info size={24} class="text-slate-500" />
              </div>
              <p class="text-sm text-slate-300 mb-1">لا توجد بيانات</p>
              <p class="text-xs text-slate-500">سيتم تسجيل النشاط هنا عند حدوثه</p>
            </div>
          {/if}
        </div>
      </div>
    </div>

    <!-- Right: Trade form + info -->
    <div class="flex flex-col gap-3">
      <div class="panel relative p-4 space-y-3">
        <div class="absolute top-0 inset-x-0 h-px bg-gradient-to-l from-transparent via-accent-gold/40 to-transparent"></div>
        <div class="flex items-center justify-between">
          <h3 class="text-sm font-semibold text-white">أمر جديد</h3>
          <div class="flex items-center gap-1 text-[10px]">
            <button onclick={() => (marginMode = 'cross')} class="px-2 py-0.5 rounded {marginMode === 'cross' ? 'bg-accent-gold/15 text-accent-gold' : 'text-slate-400'}">متقاطع</button>
            <button onclick={() => (marginMode = 'isolated')} class="px-2 py-0.5 rounded {marginMode === 'isolated' ? 'bg-accent-gold/15 text-accent-gold' : 'text-slate-400'}">معزول</button>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-2">
          <button
            onclick={() => (orderSide = 'LONG')}
            class="py-2.5 rounded-lg font-bold text-sm transition-all flex items-center justify-center gap-2 {orderSide === 'LONG' ? 'bg-accent-mint text-white shadow-lg shadow-accent-mint/30' : 'bg-white/5 text-slate-400 hover:bg-white/10'}"
          >
            <ArrowUp size={14} /> لونج
          </button>
          <button
            onclick={() => (orderSide = 'SHORT')}
            class="py-2.5 rounded-lg font-bold text-sm transition-all flex items-center justify-center gap-2 {orderSide === 'SHORT' ? 'bg-accent-rose text-white shadow-lg shadow-accent-rose/30' : 'bg-white/5 text-slate-400 hover:bg-white/10'}"
          >
            <ArrowDown size={14} /> شورت
          </button>
        </div>

        <div class="grid grid-cols-3 gap-1">
          {#each ['LIMIT', 'MARKET', 'STOP'] as t}
            <button
              onclick={() => (orderType = t as any)}
              class="py-1.5 rounded-md text-[11px] font-medium transition-colors {orderType === t ? 'bg-white/10 text-white' : 'text-slate-400 hover:bg-white/5'}"
            >
              {t === 'LIMIT' ? 'محدد' : t === 'MARKET' ? 'سوقي' : 'إيقاف'}
            </button>
          {/each}
        </div>

        {#if orderType !== 'MARKET'}
          <div>
            <label class="text-[10px] text-slate-500 block mb-1">السعر (USDT)</label>
            <input
              type="number"
              bind:value={limitPrice}
              placeholder="0.00"
              class="w-full bg-ink-900/50 border border-white/5 rounded-lg px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-accent-gold/40"
            />
          </div>
        {/if}

        <div>
          <label class="text-[10px] text-slate-500 block mb-1">الكمية ({base})</label>
          <input
            type="number"
            bind:value={orderQty}
            placeholder="0.00"
            class="w-full bg-ink-900/50 border border-white/5 rounded-lg px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-accent-gold/40"
          />
        </div>

        <div>
          <div class="flex items-center justify-between mb-1">
            <span class="text-[10px] text-slate-500">نسبة الرصيد</span>
            <span class="text-[10px] font-mono text-accent-gold">{orderSliderPct}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            step="5"
            value={orderSliderPct}
            oninput={(e) => setQtyPct(Number((e.target as HTMLInputElement).value))}
            class="w-full accent-accent-gold"
          />
          <div class="grid grid-cols-4 gap-1 mt-2">
            {#each [25, 50, 75, 100] as pct}
              <button onclick={() => setQtyPct(pct)} class="py-1 rounded text-[10px] bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white">{pct}%</button>
            {/each}
          </div>
        </div>

        <div>
          <button onclick={() => (tpsl = !tpsl)} class="flex items-center justify-between w-full text-xs text-slate-400 hover:text-white">
            <span class="flex items-center gap-1"><Shield size={11} /> جني أرباح / وقف خسارة</span>
            <span class="text-[10px] {tpsl ? 'text-accent-gold' : ''}">{tpsl ? 'مفعّل' : 'معطّل'}</span>
          </button>
          {#if tpsl}
            <div class="grid grid-cols-2 gap-2 mt-2">
              <div>
                <label class="text-[10px] text-accent-mint block mb-1">TP</label>
                <input type="number" bind:value={takeProfit} placeholder="0.00" class="w-full bg-ink-900/50 border border-white/5 rounded-lg px-2 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-accent-mint/40" />
              </div>
              <div>
                <label class="text-[10px] text-accent-rose block mb-1">SL</label>
                <input type="number" bind:value={stopLoss} placeholder="0.00" class="w-full bg-ink-900/50 border border-white/5 rounded-lg px-2 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-accent-rose/40" />
              </div>
            </div>
          {/if}
        </div>

        <label class="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
          <input type="checkbox" bind:checked={reduceOnly} class="accent-accent-gold" />
          تقليل فقط (Reduce Only)
        </label>

        <div class="bg-ink-900/40 rounded-lg p-2.5 text-[11px] space-y-1">
          <div class="flex justify-between">
            <span class="text-slate-500">الهامش المطلوب</span>
            <span class="font-mono text-white">{orderQty && limitPrice ? formatPrice((Number(orderQty) * limitPrice) / leverage) : '0.00'} USDT</span>
          </div>
          <div class="flex justify-between">
            <span class="text-slate-500">قيمة المركز</span>
            <span class="font-mono text-white">{orderQty && limitPrice ? formatPrice(Number(orderQty) * limitPrice) : '0.00'} USDT</span>
          </div>
          <div class="flex justify-between">
            <span class="text-slate-500">الرافعة</span>
            <span class="font-mono text-accent-gold">{leverage}x</span>
          </div>
          <div class="flex justify-between">
            <span class="text-slate-500">سعر التصفية التقديري</span>
            <span class="font-mono text-accent-rose">{orderQty && limitPrice ? formatPrice(limitPrice * (1 - 0.9 / leverage)) : '--'}</span>
          </div>
        </div>

        <button
          onclick={submitOrder}
          class="w-full py-2.5 rounded-lg font-bold text-sm transition-all {orderSide === 'LONG'
            ? 'bg-accent-mint hover:bg-accent-mint/90 text-white shadow-lg shadow-accent-mint/20'
            : 'bg-accent-rose hover:bg-accent-rose/90 text-white shadow-lg shadow-accent-rose/20'}"
        >
          {orderSide === 'LONG' ? 'افتح لونج' : 'افتح شورت'} {orderType === 'MARKET' ? '(سوقي)' : orderType === 'LIMIT' ? '(محدد)' : '(إيقاف)'}
        </button>
      </div>

      <div class="panel relative p-3 text-[11px] space-y-2">
        <div class="absolute top-0 inset-x-0 h-px bg-gradient-to-l from-transparent via-accent-violet/40 to-transparent"></div>
        <div class="flex items-center gap-1.5 text-slate-300 font-semibold">
          <Info size={12} class="text-accent-gold" />
          معلومات الرافعة
        </div>
        <div class="flex justify-between">
          <span class="text-slate-500">الحد الأقصى للرافعة</span>
          <span class="font-mono text-white">125x</span>
        </div>
        <div class="flex justify-between">
          <span class="text-slate-500">رسوم الفتح</span>
          <span class="font-mono text-white">0.02%</span>
        </div>
        <div class="flex justify-between">
          <span class="text-slate-500">رسوم الإغلاق</span>
          <span class="font-mono text-white">0.05%</span>
        </div>
        <div class="flex justify-between">
          <span class="text-slate-500">معدل التمويل (8س)</span>
          <span class="font-mono {fundingRate >= 0 ? 'text-accent-mint' : 'text-accent-rose'}">{fundingRate >= 0 ? '+' : ''}{(fundingRate * 100).toFixed(4)}%</span>
        </div>
      </div>
    </div>
  </div>
</div>
