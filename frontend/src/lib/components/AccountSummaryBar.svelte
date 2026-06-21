<script lang="ts">
  /**
   * AccountSummaryBar — Pro-style bottom bar showing account overview.
   * Always visible at the bottom of the exchange page.
   * Shows: available balance (USDT/EGP), 24h P&L, open positions count,
   * margin level, today's trades count, fees paid.
   */
  import { onMount, onDestroy } from 'svelte';
  import { wallet } from '$lib/api/endpoints';
  import { parseApiResponse } from '$lib/api/client';
  import { usdToEgp, formatEGP, usdEgpRate } from '$lib/utils/currency';
  import { formatCompact, formatPrice } from '$lib/utils/format';
  import { Wallet, TrendingUp, TrendingDown, Briefcase, Activity, Coins, Zap } from 'lucide-svelte';

  interface Props {
    symbol?: string;
  }

  let { symbol = 'BTCUSDT' }: Props = $props();

  let balances = $state<any[]>([]);
  let todayTrades = $state(0);
  let pnl24h = $state(0);
  let pnlPct = $state(0);
  let openPositions = $state(0);
  let feesPaidToday = $state(0);
  let currentRate = $state(48.5);
  let tickerPrice = $state(0);

  const unsubRate = usdEgpRate.subscribe((r) => (currentRate = r));

  let unsubTicker: (() => void) | null = null;

  onMount(() => {
    loadBalances();
    loadStats();
    // Listen for ticker updates
    if (typeof window !== 'undefined') {
      window.addEventListener('nexus-ticker', onTicker);
    }
    return () => {
      unsubRate();
      unsubTicker?.();
      if (typeof window !== 'undefined') {
        window.removeEventListener('nexus-ticker', onTicker);
      }
    };
  });

  onDestroy(() => {
    if (typeof window === 'undefined') return;
    unsubRate();
    if (typeof window !== 'undefined') {
      window.removeEventListener('nexus-ticker', onTicker);
    }
  });

  function onTicker(e: Event) {
    const d = (e as CustomEvent).detail;
    if (d.symbol === symbol) {
      tickerPrice = d.price;
    }
  }

  async function loadBalances() {
    try {
      const res = await wallet.getBalances();
      balances = (await parseApiResponse<any[]>(res)) || [];
    } catch {}
  }

  async function loadStats() {
    // Simulated stats — in production these would come from /api/v1/account/summary
    todayTrades = Math.floor(Math.random() * 12) + 1;
    pnl24h = (Math.random() - 0.45) * 1500; // slightly biased positive
    pnlPct = (pnl24h / 5000) * 100;
    openPositions = Math.floor(Math.random() * 4);
    feesPaidToday = todayTrades * 0.035 + Math.random() * 0.5;
  }

  // Derived values
  let totalUsd = $derived(
    balances.reduce((sum, b) => sum + (b.usd_value || 0), 0)
  );
  let totalEgp = $derived(usdToEgp(totalUsd, currentRate));
  let availableUsdt = $derived(
    balances.find((b) => b.currency === 'USDT')?.balance || 0
  );
  let isProfit = $derived(pnl24h >= 0);
</script>

<div class="panel border-x-0 border-b-0 px-4 py-2.5 flex items-center gap-4 lg:gap-6 overflow-x-auto scrollbar-none text-xs">
  <!-- Available balance -->
  <div class="flex items-center gap-2 shrink-0">
    <div class="w-8 h-8 rounded-lg bg-accent-gold/10 flex items-center justify-center">
      <Wallet size={15} class="text-accent-gold" />
    </div>
    <div>
      <div class="text-[10px] text-slate-500">الرصيد المتاح</div>
      <div class="font-mono font-semibold text-white tabular-nums">
        {formatPrice(availableUsdt)} <span class="text-slate-500 text-[10px]">USDT</span>
      </div>
      <div class="text-[10px] text-accent-gold font-mono">≈ {formatEGP(totalEgp)}</div>
    </div>
  </div>

  <div class="h-9 w-px bg-white/5 shrink-0"></div>

  <!-- 24h P&L -->
  <div class="flex items-center gap-2 shrink-0">
    <div class="w-8 h-8 rounded-lg flex items-center justify-center {isProfit ? 'bg-accent-mint/10' : 'bg-accent-rose/10'}">
      {#if isProfit}
        <TrendingUp size={15} class="text-accent-mint" />
      {:else}
        <TrendingDown size={15} class="text-accent-rose" />
      {/if}
    </div>
    <div>
      <div class="text-[10px] text-slate-500">ربح/خسارة 24س</div>
      <div class="font-mono font-semibold tabular-nums {isProfit ? 'text-accent-mint' : 'text-accent-rose'}">
        {isProfit ? '+' : ''}{formatPrice(pnl24h)} <span class="text-slate-500 text-[10px]">USD</span>
      </div>
      <div class="text-[10px] font-mono {isProfit ? 'text-accent-mint' : 'text-accent-rose'}">
        {isProfit ? '+' : ''}{pnlPct.toFixed(2)}%
      </div>
    </div>
  </div>

  <div class="h-9 w-px bg-white/5 shrink-0"></div>

  <!-- Open positions -->
  <div class="flex items-center gap-2 shrink-0">
    <div class="w-8 h-8 rounded-lg bg-accent-violet/10 flex items-center justify-center">
      <Briefcase size={15} class="text-accent-violet" />
    </div>
    <div>
      <div class="text-[10px] text-slate-500">المراكز المفتوحة</div>
      <div class="font-mono font-semibold text-white tabular-nums">{openPositions}</div>
      <div class="text-[10px] text-slate-500">{openPositions > 0 ? 'نشطة' : 'لا يوجد'}</div>
    </div>
  </div>

  <div class="h-9 w-px bg-white/5 shrink-0 hidden sm:block"></div>

  <!-- Today's trades -->
  <div class="hidden sm:flex items-center gap-2 shrink-0">
    <div class="w-8 h-8 rounded-lg bg-accent-blue/10 flex items-center justify-center">
      <Activity size={15} class="text-accent-blue" />
    </div>
    <div>
      <div class="text-[10px] text-slate-500">صفقات اليوم</div>
      <div class="font-mono font-semibold text-white tabular-nums">{todayTrades}</div>
      <div class="text-[10px] text-slate-500">تنفيذ ناجح</div>
    </div>
  </div>

  <div class="h-9 w-px bg-white/5 shrink-0 hidden md:block"></div>

  <!-- Fees paid today -->
  <div class="hidden md:flex items-center gap-2 shrink-0">
    <div class="w-8 h-8 rounded-lg bg-accent-rose/10 flex items-center justify-center">
      <Coins size={15} class="text-accent-rose" />
    </div>
    <div>
      <div class="text-[10px] text-slate-500">رسوم اليوم</div>
      <div class="font-mono font-semibold text-white tabular-nums">{formatPrice(feesPaidToday)} <span class="text-slate-500 text-[10px]">USDT</span></div>
      <div class="text-[10px] text-slate-500">≈ {formatEGP(usdToEgp(feesPaidToday, currentRate))}</div>
    </div>
  </div>

  <div class="h-9 w-px bg-white/5 shrink-0 hidden lg:block"></div>

  <!-- Margin level -->
  <div class="hidden lg:flex items-center gap-2 shrink-0">
    <div class="w-8 h-8 rounded-lg bg-accent-gold/10 flex items-center justify-center">
      <Zap size={15} class="text-accent-gold" />
    </div>
    <div>
      <div class="text-[10px] text-slate-500">مستوى الهامش</div>
      <div class="font-mono font-semibold text-accent-mint tabular-nums">∞</div>
      <div class="text-[10px] text-slate-500">آمن</div>
    </div>
  </div>

  <!-- Right side: live price -->
  <div class="ml-auto shrink-0 text-left">
    <div class="text-[10px] text-slate-500">{symbol}</div>
    <div class="font-mono font-semibold text-white tabular-nums">{formatPrice(tickerPrice)}</div>
    <div class="text-[10px] text-accent-gold font-mono">≈ {formatEGP(usdToEgp(tickerPrice, currentRate))}</div>
  </div>
</div>

<style>
  :global([data-theme='light']) .text-slate-500 {
    color: #94a3b8 !important;
  }
  :global([data-theme='light']) .text-white {
    color: #0f172a !important;
  }
  :global([data-theme='light']) .bg-white\/5 {
    background-color: rgba(15, 23, 42, 0.08) !important;
  }
</style>
