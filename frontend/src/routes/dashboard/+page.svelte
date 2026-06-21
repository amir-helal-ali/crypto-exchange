<script lang="ts">
  import { onMount } from 'svelte';
  import { wallet, exchange } from '$lib/api/endpoints';
  import { authGet, parseApiResponse } from '$lib/api/client';
  import { formatPrice, formatCompact, formatPercent, timeAgo } from '$lib/utils/format';
  import { usdToEgp, egpCompact, egpWithSymbol, formatEGP, usdEgpRate } from '$lib/utils/currency';
  import PriceFlash from '$lib/components/PriceFlash.svelte';
  import ChangeBadge from '$lib/components/ChangeBadge.svelte';
  import NavTabs from '$lib/components/NavTabs.svelte';
  import { marketStore, type MarketTicker } from '$lib/stores/market';
  import { nexusMarket } from '$lib/stores/nexus-market';
  import {
    Wallet,
    TrendingUp,
    TrendingDown,
    ArrowUpRight,
    ArrowDownRight,
    Activity,
    Bitcoin,
    RefreshCw,
    ChevronLeft,
    Coins,
    Receipt,
    PiggyBank
  } from 'lucide-svelte';

  // State
  let balances = $state<any[]>([]);
  let orders = $state<any[]>([]);
  let loading = $state(true);
  let tickers = $state<Record<string, MarketTicker>>({});
  let unsubNexus: (() => void) | null = null;
  let currentRate = $state(48.5);
  let sectionTab = $state<'overview' | 'balances' | 'activity'>('overview');

  // Subscribe to EGP rate
  const unsubRate = usdEgpRate.subscribe((r) => (currentRate = r));

  // Watch market store for ticker updates
  const unsubscribe = marketStore.subscribe((t) => {
    tickers = t;
  });

  const watchSymbols = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT', 'ADAUSDT'];

  onMount(() => {
  (async () => {
    await Promise.all([loadBalances(), loadOrders(), connectMarketWS()]);
    loading = false
  })();
  return () => {
      unsubscribe();
      unsubRate();
      unsubNexus?.();
    };
});

  async function loadBalances() {
    try {
      const res = await wallet.getBalances();
      const data = await parseApiResponse<any[]>(res);
      balances = (data || []).filter((b) => parseFloat(b.balance) > 0);
    } catch {
      // silent
    }
  }

  async function loadOrders() {
    try {
      const res = await exchange.getOrders({ limit: 5 });
      const data = await parseApiResponse<any[]>(res);
      orders = data || [];
    } catch {
      // silent
    }
  }

  async function connectMarketWS() {
    // Bootstrap with REST snapshot of all tickers
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
    // Subscribe to live ticks — cycle through watchSymbols every few seconds
    nexusMarket.switchSymbol(watchSymbols[0]);
    let cycleIdx = 0;
    const cycleInterval = setInterval(() => {
      cycleIdx = (cycleIdx + 1) % watchSymbols.length;
      nexusMarket.switchSymbol(watchSymbols[cycleIdx]);
    }, 3500);
    unsubNexus = nexusMarket.subscribeAll(() => {
      // marketStore is already updated by nexusMarket; nothing else to do
    });
    const origUnsub = unsubNexus;
    unsubNexus = () => {
      clearInterval(cycleInterval);
      origUnsub();
    };
  }

  // Derived values
  const totalUsdValue = $derived.by(() => {
    return balances.reduce((sum, b) => {
      const price = tickers[`${b.currency}USDT`]?.price || 0;
      const val = b.currency === 'USDT' ? parseFloat(b.balance) : parseFloat(b.balance) * price;
      return sum + val;
    }, 0);
  });

  const totalEgpValue = $derived(usdToEgp(totalUsdValue, currentRate));

  const topGainers = $derived(
    Object.values(tickers)
      .sort((a, b) => b.change24h - a.change24h)
      .slice(0, 3)
  );

  const topLosers = $derived(
    Object.values(tickers)
      .sort((a, b) => a.change24h - b.change24h)
      .slice(0, 3)
  );

  function getBalanceValue(currency: string, balance: string): number {
    if (currency === 'USDT') return parseFloat(balance);
    const price = tickers[`${currency}USDT`]?.price || 0;
    return parseFloat(balance) * price;
  }

  function refresh() {
    loading = true;
    Promise.all([loadBalances(), loadOrders()]).finally(() => (loading = false));
  }
</script>

<svelte:head><title>لوحة التحكم — NEXUS</title></svelte:head>

<div class="space-y-6">
  <!-- Header -->
  <div class="flex items-center justify-between">
    <div>
      <h1 class="text-2xl sm:text-3xl font-bold text-white">لوحة التحكم</h1>
      <p class="text-sm text-slate-400 mt-1">نظرة عامة على حسابك وأنشطتك</p>
    </div>
    <button
      onclick={refresh}
      class="btn-ghost {loading ? 'animate-spin' : ''}"
      aria-label="تحديث"
    >
      <RefreshCw size={16} />
    </button>
  </div>

  <!-- Hero portfolio card — EGP main -->
  <div class="panel-glow p-6 sm:p-8 relative overflow-hidden">
    <!-- decorative aurora -->
    <div class="absolute inset-0 opacity-30 pointer-events-none" aria-hidden="true">
      <div class="absolute -top-12 -right-12 w-48 h-48 bg-accent-gold/20 blur-3xl rounded-full"></div>
      <div class="absolute -bottom-12 -left-12 w-48 h-48 bg-accent-violet/20 blur-3xl rounded-full"></div>
    </div>

    <div class="relative flex flex-wrap items-end justify-between gap-6">
      <div>
        <div class="flex items-center gap-2 mb-2">
          <span class="text-[10px] uppercase tracking-wider text-slate-400 font-bold">إجمالي القيمة</span>
          <span class="pill-gold text-[10px]">ج.م</span>
        </div>
        <p class="text-4xl sm:text-5xl font-bold text-gold-gradient tabular-nums leading-none">
          {formatEGP(totalEgpValue)}
        </p>
        <p class="text-sm text-slate-400 mt-2 tabular-nums">
          <span class="text-slate-500">≈</span> ${formatPrice(totalUsdValue)} USD
        </p>
      </div>

      <div class="flex flex-col gap-2 items-end">
        <div class="flex items-center gap-2 text-xs">
          <PiggyBank size={14} class="text-accent-mint" />
          <span class="text-slate-400">عملات نشطة:</span>
          <span class="font-bold text-white">{balances.length}</span>
        </div>
        <a href="/dashboard/exchange" class="btn-primary text-xs">
          <TrendingUp size={14} /> ابدأ التداول
        </a>
      </div>
    </div>
  </div>

  <!-- Stat cards -->
  <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
    <div class="stat-card">
      <div class="flex items-center justify-between mb-3">
        <div class="w-10 h-10 rounded-xl bg-accent-gold/10 border border-accent-gold/20 flex items-center justify-center">
          <Coins size={20} class="text-accent-gold" />
        </div>
        <span class="text-[10px] font-medium text-slate-500 uppercase tracking-wider">بجنيه مصر</span>
      </div>
      <p class="text-2xl font-bold text-white tabular-nums">{egpCompact(totalEgpValue)}</p>
      <p class="text-xs text-slate-400 mt-1">≈ ${formatPrice(totalUsdValue)}</p>
    </div>

    <div class="stat-card">
      <div class="flex items-center justify-between mb-3">
        <div class="w-10 h-10 rounded-xl bg-accent-mint/10 border border-accent-mint/20 flex items-center justify-center">
          <Activity size={20} class="text-accent-mint" />
        </div>
        <span class="text-[10px] font-medium text-slate-500 uppercase tracking-wider">صفقات اليوم</span>
      </div>
      <p class="text-2xl font-bold text-white tabular-nums">{orders.length}</p>
      <p class="text-xs text-accent-mint mt-1 flex items-center gap-1">
        <ArrowUpRight size={12} /> نشطة
      </p>
    </div>

    <div class="stat-card">
      <div class="flex items-center justify-between mb-3">
        <div class="w-10 h-10 rounded-xl bg-accent-azure/10 border border-accent-azure/20 flex items-center justify-center">
          <Wallet size={20} class="text-accent-azure" />
        </div>
        <span class="text-[10px] font-medium text-slate-500 uppercase tracking-wider">العملات</span>
      </div>
      <p class="text-2xl font-bold text-white tabular-nums">{balances.length}</p>
      <p class="text-xs text-slate-400 mt-1">أصل في المحفظة</p>
    </div>

    <div class="stat-card">
      <div class="flex items-center justify-between mb-3">
        <div class="w-10 h-10 rounded-xl bg-accent-violet/10 border border-accent-violet/20 flex items-center justify-center">
          <Bitcoin size={20} class="text-accent-violet" />
        </div>
        <span class="text-[10px] font-medium text-slate-500 uppercase tracking-wider">BTC / ج.م</span>
      </div>
      <PriceFlash
        value={tickers['BTCUSDT']?.price || 0}
        prevValue={tickers['BTCUSDT']?.prevPrice}
        className="text-2xl font-bold text-white"
      />
      <p class="text-xs text-slate-400 mt-1 tabular-nums">
        ≈ {egpCompact(usdToEgp(tickers['BTCUSDT']?.price || 0, currentRate))}
      </p>
    </div>
  </div>

  <!-- Section nav tabs (overview / balances / activity) -->
  <NavTabs
    value={sectionTab}
    onchange={(key) => (sectionTab = key as any)}
    items={[
      { key: 'overview', label: 'نظرة عامة', icon: Activity },
      { key: 'balances', label: 'أرصدتي', icon: Wallet, count: balances.length },
      { key: 'activity', label: 'النشاط', icon: Receipt, count: orders.length }
    ]}
  />

  {#if sectionTab === 'overview'}
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <!-- Balances -->
      <div class="lg:col-span-2 panel overflow-hidden">
        <div class="flex items-center justify-between px-5 py-4 border-b border-white/5">
          <h3 class="text-sm font-bold text-white">أرصدتي</h3>
          <a href="/dashboard/wallet" class="text-xs text-accent-gold hover:underline flex items-center gap-1">
            المحفظة الكاملة <ChevronLeft size={12} />
          </a>
        </div>
        <div class="overflow-x-auto">
          {#if loading}
            <div class="p-8 space-y-3">
              {#each Array(4) as _}
                <div class="h-12 rounded-xl bg-white/5 animate-shimmer"></div>
              {/each}
            </div>
          {:else if balances.length === 0}
            <div class="py-12 text-center text-slate-500">
              <Wallet size={32} class="mx-auto mb-2 opacity-30" />
              <p class="text-sm">لا توجد أرصدة. ابدأ بإيداع العملات.</p>
              <a href="/dashboard/wallet" class="inline-block mt-3 text-xs text-accent-gold hover:underline">
                اذهب إلى المحفظة ←
              </a>
            </div>
          {:else}
            <table class="w-full text-sm">
              <thead>
                <tr class="text-[10px] uppercase tracking-wider text-slate-500 border-b border-white/5">
                  <th class="text-right font-medium px-5 py-2.5">العملة</th>
                  <th class="text-right font-medium px-5 py-2.5">الرصيد</th>
                  <th class="text-left font-medium px-5 py-2.5">القيمة (ج.م)</th>
                </tr>
              </thead>
              <tbody>
                {#each balances.slice(0, 6) as b}
                  <tr class="border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors">
                    <td class="px-5 py-3">
                      <div class="flex items-center gap-2.5">
                        <div class="w-8 h-8 rounded-full bg-gradient-to-br from-accent-gold/30 to-accent-violet/30 border border-white/10 flex items-center justify-center text-[10px] font-bold text-white">
                          {b.currency.slice(0, 2)}
                        </div>
                        <span class="font-semibold text-white">{b.currency}</span>
                      </div>
                    </td>
                    <td class="px-5 py-3 font-mono text-slate-200 tabular-nums">{formatPrice(b.balance, 6)}</td>
                    <td class="px-5 py-3 font-mono text-left tabular-nums text-slate-300">
                      {egpCompact(usdToEgp(getBalanceValue(b.currency, b.balance), currentRate))}
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          {/if}
        </div>
      </div>

      <!-- Market movers -->
      <div class="panel overflow-hidden">
        <div class="px-5 py-4 border-b border-white/5">
          <h3 class="text-sm font-bold text-white">حركة السوق</h3>
        </div>
        <div class="p-3 space-y-2">
          <div>
            <p class="text-[10px] uppercase tracking-wider text-accent-mint font-medium px-2 mb-1.5 flex items-center gap-1">
              <TrendingUp size={10} /> الأعلى ارتفاعاً
            </p>
            {#each topGainers as t}
              <a
                href="/dashboard/exchange?symbol={t.symbol}"
                class="flex items-center justify-between px-2 py-2 rounded-lg hover:bg-white/5 transition-colors"
              >
                <span class="text-sm font-semibold text-white">{t.symbol.replace('USDT', '')}</span>
                <div class="text-left">
                  <PriceFlash value={t.price} prevValue={t.prevPrice} className="text-sm font-mono text-slate-200" />
                  <div><ChangeBadge change={t.change24h} showIcon={false} className="text-[10px]" /></div>
                </div>
              </a>
            {/each}
          </div>

          <div class="pt-2">
            <p class="text-[10px] uppercase tracking-wider text-accent-rose font-medium px-2 mb-1.5 flex items-center gap-1">
              <TrendingDown size={10} /> الأعلى انخفاضاً
            </p>
            {#each topLosers as t}
              <a
                href="/dashboard/exchange?symbol={t.symbol}"
                class="flex items-center justify-between px-2 py-2 rounded-lg hover:bg-white/5 transition-colors"
              >
                <span class="text-sm font-semibold text-white">{t.symbol.replace('USDT', '')}</span>
                <div class="text-left">
                  <PriceFlash value={t.price} prevValue={t.prevPrice} className="text-sm font-mono text-slate-200" />
                  <div><ChangeBadge change={t.change24h} showIcon={false} className="text-[10px]" /></div>
                </div>
              </a>
            {/each}
          </div>
        </div>
      </div>
    </div>

    <!-- Recent orders -->
    <div class="panel overflow-hidden">
      <div class="flex items-center justify-between px-5 py-4 border-b border-white/5">
        <h3 class="text-sm font-bold text-white">أحدث الصفقات</h3>
        <a href="/dashboard/history" class="text-xs text-accent-gold hover:underline flex items-center gap-1">
          عرض الكل <ChevronLeft size={12} />
        </a>
      </div>
      <div class="overflow-x-auto">
        {#if loading}
          <div class="p-6 space-y-3">
            {#each Array(3) as _}
              <div class="h-10 rounded-xl bg-white/5 animate-shimmer"></div>
            {/each}
          </div>
        {:else if orders.length === 0}
          <div class="py-12 text-center text-slate-500">
            <Activity size={32} class="mx-auto mb-2 opacity-30" />
            <p class="text-sm">لا توجد صفقات بعد</p>
            <a href="/dashboard/exchange" class="inline-block mt-3 text-xs text-accent-gold hover:underline">
              ابدأ التداول ←
            </a>
          </div>
        {:else}
          <table class="w-full text-sm">
            <thead>
              <tr class="text-[10px] uppercase tracking-wider text-slate-500 border-b border-white/5">
                <th class="text-right font-medium px-5 py-2.5">الزوج</th>
                <th class="text-right font-medium px-5 py-2.5">النوع</th>
                <th class="text-right font-medium px-5 py-2.5">السعر (ج.م)</th>
                <th class="text-right font-medium px-5 py-2.5">الكمية</th>
                <th class="text-right font-medium px-5 py-2.5">الحالة</th>
                <th class="text-left font-medium px-5 py-2.5">الوقت</th>
              </tr>
            </thead>
            <tbody>
              {#each orders.slice(0, 8) as o}
                <tr class="border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors">
                  <td class="px-5 py-3 font-semibold text-white">{o.symbol}</td>
                  <td class="px-5 py-3">
                    <span class="pill {o.side === 'BUY' ? 'pill-mint' : 'pill-rose'}">
                      {o.side === 'BUY' ? 'شراء' : 'بيع'}
                    </span>
                  </td>
                  <td class="px-5 py-3 font-mono text-slate-300 tabular-nums">
                    {formatEGP(usdToEgp(o.price, currentRate))}
                  </td>
                  <td class="px-5 py-3 font-mono text-slate-300 tabular-nums">{formatPrice(o.quantity, 6)}</td>
                  <td class="px-5 py-3">
                    <span class="pill {o.status === 'FILLED' ? 'pill-mint' : o.status === 'PENDING' ? 'pill-gold' : 'pill-rose'}">
                      {o.status === 'FILLED' ? 'مكتمل' : o.status === 'PENDING' ? 'معلق' : o.status === 'CANCELLED' ? 'ملغى' : o.status}
                    </span>
                  </td>
                  <td class="px-5 py-3 text-left text-xs text-slate-400">{timeAgo(o.created_at)}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        {/if}
      </div>
    </div>
  {:else if sectionTab === 'balances'}
    <!-- Full balances table -->
    <div class="panel overflow-hidden">
      <div class="flex items-center justify-between px-5 py-4 border-b border-white/5">
        <h3 class="text-sm font-bold text-white">جميع الأرصدة</h3>
        <a href="/dashboard/wallet" class="text-xs text-accent-gold hover:underline">إدارة المحفظة</a>
      </div>
      {#if balances.length === 0}
        <div class="py-12 text-center text-slate-500">
          <Wallet size={32} class="mx-auto mb-2 opacity-30" />
          <p class="text-sm">لا توجد أرصدة بعد</p>
        </div>
      {:else}
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="text-[10px] uppercase tracking-wider text-slate-500 border-b border-white/5">
                <th class="text-right font-medium px-5 py-3">العملة</th>
                <th class="text-right font-medium px-5 py-3">الرصيد</th>
                <th class="text-right font-medium px-5 py-3">سعر (USD)</th>
                <th class="text-left font-medium px-5 py-3">القيمة (ج.م)</th>
              </tr>
            </thead>
            <tbody>
              {#each balances as b}
                <tr class="border-b border-white/5 last:border-0 hover:bg-white/[0.02]">
                  <td class="px-5 py-3 font-semibold text-white">{b.currency}</td>
                  <td class="px-5 py-3 font-mono text-slate-200 tabular-nums">{formatPrice(b.balance, 6)}</td>
                  <td class="px-5 py-3 font-mono text-slate-300 tabular-nums">
                    ${formatPrice(tickers[`${b.currency}USDT`]?.price || (b.currency === 'USDT' ? 1 : 0))}
                  </td>
                  <td class="px-5 py-3 font-mono text-left tabular-nums text-slate-300">
                    {egpWithSymbol(usdToEgp(getBalanceValue(b.currency, b.balance), currentRate))}
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </div>
  {:else if sectionTab === 'activity'}
    <div class="panel overflow-hidden">
      <div class="flex items-center justify-between px-5 py-4 border-b border-white/5">
        <h3 class="text-sm font-bold text-white">آخر الصفقات</h3>
        <a href="/dashboard/history" class="text-xs text-accent-gold hover:underline">السجل الكامل</a>
      </div>
      {#if orders.length === 0}
        <div class="py-12 text-center text-slate-500">
          <Receipt size={32} class="mx-auto mb-2 opacity-30" />
          <p class="text-sm">لا توجد صفقات</p>
        </div>
      {:else}
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="text-[10px] uppercase tracking-wider text-slate-500 border-b border-white/5">
                <th class="text-right font-medium px-5 py-3">الزوج</th>
                <th class="text-right font-medium px-5 py-3">النوع</th>
                <th class="text-right font-medium px-5 py-3">السعر (ج.م)</th>
                <th class="text-right font-medium px-5 py-3">الإجمالي (ج.م)</th>
                <th class="text-right font-medium px-5 py-3">الحالة</th>
                <th class="text-left font-medium px-5 py-3">الوقت</th>
              </tr>
            </thead>
            <tbody>
              {#each orders.slice(0, 15) as o}
                <tr class="border-b border-white/5 last:border-0 hover:bg-white/[0.02]">
                  <td class="px-5 py-3 font-semibold text-white">{o.symbol}</td>
                  <td class="px-5 py-3">
                    <span class="pill {o.side === 'BUY' ? 'pill-mint' : 'pill-rose'}">
                      {o.side === 'BUY' ? 'شراء' : 'بيع'}
                    </span>
                  </td>
                  <td class="px-5 py-3 font-mono text-slate-300 tabular-nums">
                    {formatEGP(usdToEgp(o.price, currentRate))}
                  </td>
                  <td class="px-5 py-3 font-mono text-slate-300 tabular-nums">
                    {egpCompact(usdToEgp(o.price * o.quantity, currentRate))}
                  </td>
                  <td class="px-5 py-3">
                    <span class="pill {o.status === 'FILLED' ? 'pill-mint' : o.status === 'PENDING' ? 'pill-gold' : 'pill-rose'}">
                      {o.status === 'FILLED' ? 'مكتمل' : o.status === 'PENDING' ? 'معلق' : o.status === 'CANCELLED' ? 'ملغى' : o.status}
                    </span>
                  </td>
                  <td class="px-5 py-3 text-left text-xs text-slate-400">{timeAgo(o.created_at)}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </div>
  {/if}
</div>
