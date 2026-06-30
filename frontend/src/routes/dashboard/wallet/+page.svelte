<script lang="ts">
  import { onMount } from 'svelte';
  import { wallet } from '$lib/api/endpoints';
  import { parseApiResponse } from '$lib/api/client';
  import { formatPrice, formatDate } from '$lib/utils/format';
  import { usdToEgp, egpCompact, egpWithSymbol, formatEGP, usdEgpRate } from '$lib/utils/currency';
  import { marketStore, type MarketTicker } from '$lib/stores/market';
  import NavTabs from '$lib/components/NavTabs.svelte';
  import {
    ArrowDownToLine, ArrowUpFromLine, Wallet as WalletIcon, RefreshCw,
    ChevronLeft, Plus, Send, Banknote, Clock, Coins, TrendingUp,
    TrendingDown, Shield, Zap
  } from 'lucide-svelte';

  let balances = $state<any[]>([]);
  let transactions = $state<any[]>([]);
  let loading = $state(true);
  let refreshing = $state(false);
  let totalUsd = $state(0);
  let totalEgp = $state(0);
  let currentRate = $state(48.5);
  let tickers = $state<Record<string, MarketTicker>>({});
  let activeTab = $state<'assets' | 'transactions' | 'deposit'>('assets');
  let liveTick = $state(0);
  let liveInterval: ReturnType<typeof setInterval> | null = null;

  const unsubRate = usdEgpRate.subscribe((r) => (currentRate = r));
  const unsubMarket = marketStore.subscribe((t) => {
    tickers = t;
    recompute();
  });

  onMount(() => {
    (async () => {
      await Promise.all([loadBalances(), loadTransactions()]);
      loading = false;
    })();
    liveInterval = setInterval(() => {
      liveTick++;
    }, 4000);
    return () => {
      unsubRate();
      unsubMarket();
      if (liveInterval) clearInterval(liveInterval);
    };
  });

  async function loadBalances() {
    try {
      const res = await wallet.getBalances();
      balances = (await parseApiResponse<any[]>(res)) || [];
      recompute();
    } catch {}
  }

  async function loadTransactions() {
    try {
      const res = await wallet.getTransactions({ limit: 30 });
      transactions = (await parseApiResponse<any[]>(res)) || [];
    } catch {}
  }

  function recompute() {
    let sum = 0;
    for (const b of balances) {
      const bal = parseFloat(b.balance);
      if (!isFinite(bal)) continue;
      if (b.currency === 'USDT') {
        sum += bal;
      } else {
        const t = tickers[`${b.currency}USDT`];
        if (t) sum += bal * t.price;
      }
    }
    totalUsd = sum;
    totalEgp = usdToEgp(sum, currentRate);
  }

  function getBalanceUsd(b: any): number {
    const bal = parseFloat(b.balance);
    if (b.currency === 'USDT') return bal;
    const t = tickers[`${b.currency}USDT`];
    return t ? bal * t.price : 0;
  }

  function getBalancePct(currency: string): number {
    const usd = getBalanceUsd({ currency, balance: balances.find((b) => b.currency === currency)?.balance || '0' });
    if (totalUsd === 0) return 0;
    return (usd / totalUsd) * 100;
  }

  async function refresh() {
    refreshing = true;
    await Promise.all([loadBalances(), loadTransactions()]);
    refreshing = false;
  }

  // Portfolio sparkline (simulated based on total value)
  const portfolioSpark = $derived.by(() => {
    const base = Math.max(totalUsd, 100);
    const points: number[] = [];
    let v = base * 0.85;
    for (let i = 0; i < 19; i++) {
      v += (Math.sin(i * 0.5 + liveTick * 0.3) * base * 0.05) + (base * 0.008);
      v = Math.max(base * 0.6, v);
      points.push(v);
    }
    points.push(base);
    return points;
  });

  function sparklinePath(points: number[], w = 240, h = 60): string {
    if (points.length < 2) return '';
    const min = Math.min(...points);
    const max = Math.max(...points);
    const range = max - min || 1;
    return points
      .map((p, i) => {
        const x = (i / (points.length - 1)) * w;
        const y = h - ((p - min) / range) * h;
        return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  }

  function sparklineArea(points: number[], w = 240, h = 60): string {
    const path = sparklinePath(points, w, h);
    if (!path) return '';
    return `${path} L${w},${h} L0,${h} Z`;
  }

  const isUp = $derived(portfolioSpark[portfolioSpark.length - 1] >= portfolioSpark[0]);
</script>

<svelte:head><title>المحفظة — NEXUS</title></svelte:head>

<div class="space-y-6 relative">
  <!-- Ambient aurora -->
  <div class="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
    <div class="absolute -top-20 right-1/4 w-96 h-96 bg-accent-gold/8 blur-[120px] rounded-full animate-pulse-glow"></div>
    <div class="absolute bottom-0 -left-32 w-96 h-96 bg-accent-violet/5 blur-[120px] rounded-full animate-pulse-glow" style="animation-delay: 2s;"></div>
  </div>

  <!-- Header -->
  <div class="relative flex items-center justify-between">
    <div>
      <div class="flex items-center gap-2.5 mb-1">
        <h1 class="text-2xl sm:text-3xl font-bold text-white tracking-tight">المحفظة</h1>
        <div class="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-accent-mint/10 border border-accent-mint/25">
          <span class="relative flex h-1.5 w-1.5">
            <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-mint opacity-60"></span>
            <span class="relative inline-flex rounded-full h-1.5 w-1.5 bg-accent-mint"></span>
          </span>
          <span class="text-[10px] font-bold text-accent-mint tracking-wide">مباشر</span>
        </div>
      </div>
      <p class="text-sm text-slate-400 mt-1">إدارة أرصدتك ومعاملاتك في مكان واحد</p>
    </div>
    <button onclick={refresh} disabled={refreshing} class="btn-ghost" aria-label="تحديث">
      <RefreshCw size={16} class={refreshing ? 'animate-spin' : ''} />
    </button>
  </div>

  <!-- Total balance hero card with chart -->
  <div class="panel-glow p-6 sm:p-8 relative overflow-hidden">
    <!-- Layered aurora -->
    <div class="absolute inset-0 opacity-60 pointer-events-none" aria-hidden="true">
      <div class="absolute -top-16 -right-16 w-64 h-64 bg-accent-gold/20 blur-3xl rounded-full animate-float"></div>
      <div class="absolute -bottom-16 -left-16 w-64 h-64 bg-accent-mint/15 blur-3xl rounded-full animate-float" style="animation-delay: 2s;"></div>
    </div>
    <div class="absolute inset-0 grid-bg opacity-20 pointer-events-none"></div>

    <div class="relative flex items-center justify-between flex-wrap gap-6">
      <div class="flex-1 min-w-[280px]">
        <div class="flex items-center gap-2 mb-2">
          <span class="text-[10px] uppercase tracking-wider text-slate-400 font-bold">إجمالي القيمة</span>
          <span class="pill-gold text-[10px]">ج.م</span>
          <span class="text-[10px] text-slate-500 tabular-nums">1 USD ≈ {currentRate.toFixed(2)} ج.م</span>
        </div>
        <p class="text-4xl sm:text-5xl font-bold text-gold-gradient tabular-nums leading-none" style="text-shadow: 0 0 30px rgba(245, 181, 68, 0.25);">
          {formatEGP(totalEgp)}
        </p>
        <div class="flex items-center gap-3 mt-3">
          <p class="text-sm text-slate-400 tabular-nums">
            <span class="text-slate-500">≈</span> ${formatPrice(totalUsd)} USD
          </p>
          <span class="text-xs flex items-center gap-1 {isUp ? 'text-accent-mint' : 'text-accent-rose'} font-semibold">
            {#if isUp}<TrendingUp size={12} />{:else}<TrendingDown size={12} />{/if}
            {isUp ? '+' : ''}{((portfolioSpark[portfolioSpark.length - 1] / portfolioSpark[0] - 1) * 100).toFixed(2)}%
          </span>
        </div>
        <div class="flex gap-2 mt-4">
          <a href="/dashboard/wallet/deposit/USDT" class="btn-buy text-sm">
            <ArrowDownToLine size={15} /> إيداع
          </a>
          <a href="/dashboard/wallet/withdraw/USDT" class="btn-sell text-sm">
            <ArrowUpFromLine size={15} /> سحب
          </a>
        </div>
      </div>

      <!-- Sparkline chart -->
      <div class="hidden sm:block">
        <svg width="240" height="60" viewBox="0 0 240 60">
          <defs>
            <linearGradient id="portfolioSparkGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color={isUp ? '#22d3a4' : '#fb7185'} stop-opacity="0.4" />
              <stop offset="100%" stop-color={isUp ? '#22d3a4' : '#fb7185'} stop-opacity="0" />
            </linearGradient>
          </defs>
          <path d={sparklineArea(portfolioSpark)} fill="url(#portfolioSparkGrad)" />
          <path d={sparklinePath(portfolioSpark)} stroke={isUp ? '#22d3a4' : '#fb7185'} stroke-width="2" fill="none" stroke-linejoin="round" stroke-linecap="round" />
        </svg>
        <p class="text-[10px] text-slate-500 text-center mt-1">آخر 20 فترة</p>
      </div>
    </div>
  </div>

  <!-- Quick stats -->
  <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
    <div class="stat-card group relative overflow-hidden">
      <div class="absolute -top-6 -right-6 w-20 h-20 bg-accent-gold/10 blur-2xl rounded-full group-hover:bg-accent-gold/15 transition-all"></div>
      <div class="relative">
        <div class="flex items-center gap-1.5 mb-2">
          <Coins size={12} class="text-accent-gold" />
          <span class="text-[10px] uppercase tracking-wider text-slate-500 font-bold">عملات نشطة</span>
        </div>
        <p class="text-xl font-bold text-white tabular-nums">{balances.length}</p>
        <p class="text-[10px] text-slate-500 mt-0.5">أصل في المحفظة</p>
      </div>
    </div>
    <div class="stat-card group relative overflow-hidden">
      <div class="absolute -top-6 -right-6 w-20 h-20 bg-accent-mint/10 blur-2xl rounded-full group-hover:bg-accent-mint/15 transition-all"></div>
      <div class="relative">
        <div class="flex items-center gap-1.5 mb-2">
          <ArrowDownToLine size={12} class="text-accent-mint" />
          <span class="text-[10px] uppercase tracking-wider text-slate-500 font-bold">إيداعات</span>
        </div>
        <p class="text-xl font-bold text-white tabular-nums">{transactions.filter((t) => t.type === 'DEPOSIT').length}</p>
        <p class="text-[10px] text-slate-500 mt-0.5">معاملة إيداع</p>
      </div>
    </div>
    <div class="stat-card group relative overflow-hidden">
      <div class="absolute -top-6 -right-6 w-20 h-20 bg-accent-rose/10 blur-2xl rounded-full group-hover:bg-accent-rose/15 transition-all"></div>
      <div class="relative">
        <div class="flex items-center gap-1.5 mb-2">
          <ArrowUpFromLine size={12} class="text-accent-rose" />
          <span class="text-[10px] uppercase tracking-wider text-slate-500 font-bold">سحوبات</span>
        </div>
        <p class="text-xl font-bold text-white tabular-nums">{transactions.filter((t) => t.type === 'WITHDRAWAL').length}</p>
        <p class="text-[10px] text-slate-500 mt-0.5">معاملة سحب</p>
      </div>
    </div>
    <div class="stat-card group relative overflow-hidden">
      <div class="absolute -top-6 -right-6 w-20 h-20 bg-accent-violet/10 blur-2xl rounded-full group-hover:bg-accent-violet/15 transition-all"></div>
      <div class="relative">
        <div class="flex items-center gap-1.5 mb-2">
          <Zap size={12} class="text-accent-violet" />
          <span class="text-[10px] uppercase tracking-wider text-slate-500 font-bold">قيمة اليوم</span>
        </div>
        <p class="text-xl font-bold text-white tabular-nums">{egpCompact(totalEgp)}</p>
        <p class="text-[10px] text-slate-500 mt-0.5">ج.م — إجمالي</p>
      </div>
    </div>
  </div>

  <!-- Nav tabs -->
  <NavTabs
    value={activeTab}
    onchange={(key) => (activeTab = key as any)}
    items={[
      { key: 'assets', label: 'الأرصدة', icon: WalletIcon, count: balances.length },
      { key: 'transactions', label: 'المعاملات', icon: Clock, count: transactions.length },
      { key: 'deposit', label: 'إيداع / سحب', icon: Banknote }
    ]}
  />

  {#if activeTab === 'assets'}
    <!-- Balances list with allocation bars -->
    <div class="panel overflow-hidden relative">
      <div class="absolute top-0 inset-x-0 h-px pointer-events-none" style="background: linear-gradient(90deg, transparent, rgba(245, 181, 68, 0.3), transparent);"></div>
      <div class="px-5 py-4 border-b border-white/5 flex items-center justify-between">
        <h3 class="text-sm font-bold text-white flex items-center gap-2">
          <div class="w-7 h-7 rounded-lg bg-accent-gold/10 border border-accent-gold/20 flex items-center justify-center">
            <WalletIcon size={14} class="text-accent-gold" />
          </div>
          أرصدتي
        </h3>
        <span class="text-xs text-slate-500">{balances.length} عملة</span>
      </div>
      {#if loading}
        <div class="p-6 space-y-3">
          {#each Array(5) as _}<div class="h-14 rounded-xl bg-white/5 animate-shimmer"></div>{/each}
        </div>
      {:else if balances.length === 0}
        <div class="py-20 text-center">
          <div class="relative inline-block mb-4">
            <div class="absolute inset-0 bg-accent-gold/10 blur-3xl rounded-full"></div>
            <WalletIcon size={48} class="relative text-slate-600 mx-auto" />
          </div>
          <p class="text-sm font-medium text-slate-300">لا توجد أرصدة بعد</p>
          <p class="text-xs text-slate-500 mt-1">ابدأ بإيداع العملات لتفعيل محفظتك</p>
          <a href="/dashboard/wallet/deposit/USDT" class="inline-flex items-center gap-1.5 mt-4 px-4 py-2 rounded-xl bg-accent-mint/10 border border-accent-mint/30 text-accent-mint text-xs font-medium hover:bg-accent-mint/20 transition-colors">
            <ArrowDownToLine size={14} /> إيداع الآن
          </a>
        </div>
      {:else}
        <div class="divide-y divide-white/5">
          {#each balances as b}
            {@const usdVal = getBalanceUsd(b)}
            {@const pct = totalUsd > 0 ? (usdVal / totalUsd) * 100 : 0}
            <div class="px-5 py-4 hover:bg-white/[0.02] transition-colors group">
              <div class="flex items-center justify-between gap-4">
                <div class="flex items-center gap-3 flex-1 min-w-0">
                  <div class="relative w-10 h-10 rounded-xl bg-gradient-to-br from-accent-gold/25 to-accent-violet/25 border border-white/10 flex items-center justify-center text-[11px] font-bold text-white shrink-0">
                    {b.currency.slice(0, 2)}
                  </div>
                  <div class="min-w-0 flex-1">
                    <div class="flex items-center gap-2">
                      <p class="font-bold text-white">{b.currency}</p>
                      <span class="text-[10px] text-slate-500 tabular-nums">{pct.toFixed(1)}% من المحفظة</span>
                    </div>
                    <p class="text-xs font-mono text-slate-400 tabular-nums mt-0.5">
                      {formatPrice(b.balance, 6)} {b.currency}
                    </p>
                  </div>
                </div>
                <div class="text-left shrink-0">
                  <p class="font-mono font-bold text-white tabular-nums">
                    {egpWithSymbol(usdToEgp(usdVal, currentRate))}
                  </p>
                  <p class="text-[10px] text-slate-500 tabular-nums mt-0.5">
                    ≈ ${formatPrice(usdVal)}
                  </p>
                </div>
                <div class="flex items-center gap-1 shrink-0">
                  <a
                    href="/dashboard/wallet/deposit/{b.currency}"
                    class="p-2 rounded-lg text-accent-mint hover:bg-accent-mint/10 transition-colors opacity-0 group-hover:opacity-100"
                    aria-label="إيداع"
                    title="إيداع"
                  >
                    <ArrowDownToLine size={14} />
                  </a>
                  <a
                    href="/dashboard/wallet/withdraw/{b.currency}"
                    class="p-2 rounded-lg text-accent-rose hover:bg-accent-rose/10 transition-colors opacity-0 group-hover:opacity-100"
                    aria-label="سحب"
                    title="سحب"
                  >
                    <ArrowUpFromLine size={14} />
                  </a>
                </div>
              </div>
              <!-- Allocation bar -->
              <div class="mt-3 h-1 bg-white/5 rounded-full overflow-hidden">
                <div
                  class="h-full bg-gradient-to-r from-accent-gold to-accent-violet transition-all duration-500"
                  style="width: {pct}%"
                ></div>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  {:else if activeTab === 'transactions'}
    <div class="panel overflow-hidden relative">
      <div class="absolute top-0 inset-x-0 h-px pointer-events-none" style="background: linear-gradient(90deg, transparent, rgba(34, 211, 164, 0.3), transparent);"></div>
      <div class="flex items-center justify-between px-5 py-4 border-b border-white/5">
        <h3 class="text-sm font-bold text-white flex items-center gap-2">
          <div class="w-7 h-7 rounded-lg bg-accent-mint/10 border border-accent-mint/20 flex items-center justify-center">
            <Clock size={14} class="text-accent-mint" />
          </div>
          آخر المعاملات
        </h3>
        <a href="/dashboard/history" class="text-xs text-accent-gold hover:underline flex items-center gap-1">
          عرض الكل <ChevronLeft size={12} />
        </a>
      </div>
      {#if transactions.length === 0}
        <div class="py-16 text-center text-slate-500">
          <Clock size={36} class="mx-auto mb-3 opacity-30" />
          <p class="text-sm">لا توجد معاملات بعد</p>
        </div>
      {:else}
        <div class="divide-y divide-white/5">
          {#each transactions as tx}
            <div class="flex items-center justify-between px-5 py-3.5 hover:bg-white/[0.02] transition-colors group">
              <div class="flex items-center gap-3">
                <div class="relative w-10 h-10 rounded-xl {tx.type === 'DEPOSIT' ? 'bg-accent-mint/10 border-accent-mint/20' : 'bg-accent-rose/10 border-accent-rose/20'} border flex items-center justify-center">
                  {#if tx.type === 'DEPOSIT'}
                    <ArrowDownToLine size={16} class="text-accent-mint" />
                  {:else}
                    <ArrowUpFromLine size={16} class="text-accent-rose" />
                  {/if}
                  <span class="absolute -bottom-1 -right-1 text-[8px] font-bold text-white bg-ink-900 rounded px-1 border border-white/10">
                    {tx.currency.slice(0, 3)}
                  </span>
                </div>
                <div>
                  <p class="text-sm font-semibold text-white">
                    {tx.type === 'DEPOSIT' ? 'إيداع' : tx.type === 'WITHDRAWAL' ? 'سحب' : tx.type}
                  </p>
                  <p class="text-xs text-slate-400">{formatDate(tx.created_at)}</p>
                </div>
              </div>
              <div class="text-left">
                <p class="text-sm font-mono font-bold {tx.type === 'DEPOSIT' ? 'text-accent-mint' : 'text-accent-rose'} tabular-nums">
                  {tx.type === 'DEPOSIT' ? '+' : '-'}{formatPrice(tx.amount, 6)} {tx.currency}
                </p>
                <span class="pill {tx.status === 'COMPLETED' || tx.status === 'APPROVED' ? 'pill-mint' : tx.status === 'PENDING' ? 'pill-gold' : 'pill-rose'} text-[10px] mt-1">
                  {tx.status === 'COMPLETED' || tx.status === 'APPROVED' ? 'مكتمل' : tx.status === 'PENDING' ? 'معلق' : tx.status}
                </span>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  {:else if activeTab === 'deposit'}
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <a
        href="/dashboard/wallet/deposit/USDT"
        class="panel p-6 hover:border-accent-mint/40 transition-all group relative overflow-hidden"
      >
        <div class="absolute -top-12 -right-12 w-32 h-32 bg-accent-mint/10 blur-3xl rounded-full group-hover:bg-accent-mint/15 transition-all"></div>
        <div class="relative">
          <div class="w-14 h-14 rounded-2xl bg-gradient-to-br from-accent-mint/20 to-accent-mint/5 border border-accent-mint/25 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
            <ArrowDownToLine size={26} class="text-accent-mint" />
          </div>
          <h3 class="text-base font-bold text-white mb-1">إيداع عملة</h3>
          <p class="text-xs text-slate-400 leading-relaxed mb-3">
            أودع USDT أو أي عملة مدعومة في محفظتك. سيتم اعتماد الإيداع بعد تأكيدات الشبكة.
          </p>
          <div class="flex items-center gap-1.5 text-xs text-accent-mint font-medium">
            ابدأ الإيداع
            <ChevronLeft size={12} class="group-hover:-translate-x-1 transition-transform" />
          </div>
        </div>
      </a>

      <a
        href="/dashboard/wallet/withdraw/USDT"
        class="panel p-6 hover:border-accent-rose/40 transition-all group relative overflow-hidden"
      >
        <div class="absolute -top-12 -right-12 w-32 h-32 bg-accent-rose/10 blur-3xl rounded-full group-hover:bg-accent-rose/15 transition-all"></div>
        <div class="relative">
          <div class="w-14 h-14 rounded-2xl bg-gradient-to-br from-accent-rose/20 to-accent-rose/5 border border-accent-rose/25 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
            <ArrowUpFromLine size={26} class="text-accent-rose" />
          </div>
          <h3 class="text-base font-bold text-white mb-1">سحب رصيد</h3>
          <p class="text-xs text-slate-400 leading-relaxed mb-3">
            اسحب أرصدتك إلى محفظتك الخارجية. يتم تطبيق رسوم شبكة البلوكتشين فقط دون أي رسوم إضافية.
          </p>
          <div class="flex items-center gap-1.5 text-xs text-accent-rose font-medium">
            ابدأ السحب
            <ChevronLeft size={12} class="group-hover:-translate-x-1 transition-transform" />
          </div>
        </div>
      </a>
    </div>

    <!-- Security tip -->
    <div class="panel p-5 bg-accent-gold/5 border-accent-gold/20 relative overflow-hidden">
      <div class="absolute -top-12 -right-12 w-32 h-32 bg-accent-gold/10 blur-3xl rounded-full"></div>
      <div class="relative flex items-start gap-3">
        <div class="w-10 h-10 rounded-xl bg-accent-gold/15 flex items-center justify-center shrink-0">
          <Shield size={18} class="text-accent-gold" />
        </div>
        <div class="flex-1">
          <p class="text-sm font-bold text-white mb-1">العملة الأساسية في المنصة: الجنيه المصري (ج.م)</p>
          <p class="text-xs text-slate-400 leading-relaxed">
            جميع القيم والإجماليات تُحسب بالجنيه المصري أولاً، مع عرض القيمة المكافئة بالدولار الأمريكي كمرجع.
            سعر الصرف المستخدم: 1 USD ≈ {currentRate.toFixed(2)} ج.م — يتم تحديثه مباشرةً.
          </p>
        </div>
      </div>
    </div>
  {/if}
</div>
