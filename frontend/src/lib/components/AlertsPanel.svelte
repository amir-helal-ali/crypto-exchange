<script lang="ts">
  import { priceAlerts, type PriceAlert } from '$lib/stores/priceAlerts';
  import { marketStore } from '$lib/stores/market';
  import { usdToEgp, egpCompact } from '$lib/utils/currency';
  import { Bell, BellRing, Plus, Trash2, RotateCcw, X, TrendingUp, TrendingDown, Check } from 'lucide-svelte';
  import AlertModal from './AlertModal.svelte';
  import { usdEgpRate } from '$lib/utils/currency';
  import { onMount } from 'svelte';

  let {
    symbol = 'BTCUSDT',
    compact = false
  }: {
    symbol?: string;
    compact?: boolean;
  } = $props();

  let alerts = $state<PriceAlert[]>([]);
  let tickers = $state<Record<string, any>>({});
  let modalOpen = $state(false);
  let currentRate = $state(48.5);

  let unsubAlerts: (() => void) | null = null;
  let unsubMarket: (() => void) | null = null;
  let unsubRate: (() => void) | null = null;

  onMount(() => {
    unsubAlerts = priceAlerts.subscribe((a) => (alerts = a));
    unsubMarket = marketStore.subscribe((t) => (tickers = t));
    unsubRate = usdEgpRate.subscribe((r) => (currentRate = r));
    return () => {
      unsubAlerts?.();
      unsubMarket?.();
      unsubRate?.();
    };
  });

  // Filter alerts for current symbol (show all if compact)
  const symbolAlerts = $derived(
    compact
      ? alerts.filter((a) => a.symbol === symbol)
      : alerts
  );

  const activeAlerts = $derived(symbolAlerts.filter((a) => a.status === 'active'));
  const triggeredAlerts = $derived(symbolAlerts.filter((a) => a.status === 'triggered'));

  function fmtPrice(p: number): string {
    return p < 1 ? p.toFixed(6) : p < 100 ? p.toFixed(4) : p.toFixed(2);
  }

  function timeAgo(ts: number): string {
    const diff = Date.now() - ts;
    const min = Math.floor(diff / 60000);
    if (min < 1) return 'الآن';
    if (min < 60) return `${min} دقيقة`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr} ساعة`;
    const day = Math.floor(hr / 24);
    return `${day} يوم`;
  }

  function distanceToTarget(alert: PriceAlert): { pct: number; sign: 'up' | 'down' | null } {
    const t = tickers[alert.symbol];
    if (!t) return { pct: 0, sign: null };
    const diff = (alert.targetPrice - t.price) / t.price * 100;
    return {
      pct: Math.abs(diff),
      sign: diff > 0 ? 'up' : diff < 0 ? 'down' : null
    };
  }
</script>

<div class="panel overflow-hidden">
  <!-- Header -->
  <div class="flex items-center justify-between p-3 border-b border-white/5">
    <div class="flex items-center gap-2">
      <div class="relative">
        <BellRing size={16} class="text-accent-gold" />
        {#if activeAlerts.length > 0}
          <span class="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-accent-gold animate-pulse"></span>
        {/if}
      </div>
      <h3 class="text-sm font-bold text-white">التنبيهات</h3>
      {#if activeAlerts.length > 0}
        <span class="pill-gold text-[10px]">{activeAlerts.length}</span>
      {/if}
    </div>
    <button
      onclick={() => (modalOpen = true)}
      class="p-1.5 rounded-lg hover:bg-white/5 text-accent-gold transition-colors"
      title="إنشاء تنبيه جديد"
      aria-label="إنشاء تنبيه"
    >
      <Plus size={16} />
    </button>
  </div>

  <!-- Body -->
  <div class="max-h-72 overflow-y-auto scrollbar-none">
    {#if symbolAlerts.length === 0}
      <div class="py-8 px-4 text-center">
        <Bell size={28} class="mx-auto mb-2 text-slate-600" />
        <p class="text-xs text-slate-500 mb-1">لا توجد تنبيهات</p>
        <button
          onclick={() => (modalOpen = true)}
          class="text-[11px] text-accent-gold hover:underline"
        >
          + أنشئ تنبيه سعر لـ {symbol.replace('USDT', '')}
        </button>
      </div>
    {:else}
      <!-- Active alerts -->
      {#each activeAlerts as alert (alert.id)}
        {@const t = tickers[alert.symbol]}
        {@const dist = distanceToTarget(alert)}
        <div class="px-3 py-2.5 border-b border-white/5 hover:bg-white/5 transition-colors">
          <div class="flex items-center justify-between gap-2 mb-1">
            <div class="flex items-center gap-1.5 min-w-0">
              {#if alert.direction === 'above'}
                <TrendingUp size={12} class="text-accent-mint shrink-0" />
              {:else}
                <TrendingDown size={12} class="text-accent-rose shrink-0" />
              {/if}
              <span class="font-semibold text-white text-xs">{alert.baseAsset}</span>
              {#if !compact}
                <span class="text-[10px] text-slate-500">/ {alert.quoteAsset}</span>
              {/if}
            </div>
            <button
              onclick={() => priceAlerts.remove(alert.id)}
              class="p-1 rounded hover:bg-white/10 text-slate-500 hover:text-accent-rose transition-colors shrink-0"
              title="حذف"
              aria-label="حذف التنبيه"
            >
              <X size={12} />
            </button>
          </div>

          <div class="flex items-center justify-between text-[11px] mb-1">
            <span class="text-slate-400">
              {alert.direction === 'above' ? 'فوق' : 'تحت'}
              <span class="font-mono text-white tabular-nums mx-1">${fmtPrice(alert.targetPrice)}</span>
            </span>
            {#if t}
              <span class="text-slate-500 font-mono tabular-nums">
                حالياً: ${fmtPrice(t.price)}
              </span>
            {/if}
          </div>

          {#if t}
            <div class="flex items-center justify-between text-[10px]">
              <span class="text-slate-500">
                {#if dist.sign === 'up' && alert.direction === 'above'}
                  <span class="text-accent-mint">بعيد {dist.pct.toFixed(1)}%</span>
                {:else if dist.sign === 'down' && alert.direction === 'below'}
                  <span class="text-accent-rose">بعيد {dist.pct.toFixed(1)}%</span>
                {:else if dist.sign === 'up' && alert.direction === 'below'}
                  <span class="text-accent-mint">تجاوز الهدف</span>
                {:else if dist.sign === 'down' && alert.direction === 'above'}
                  <span class="text-accent-rose">تجاوز الهدف</span>
                {:else}
                  <span class="text-slate-500">عند الهدف</span>
                {/if}
              </span>
              <span class="text-slate-500">قبل {timeAgo(alert.createdAt)}</span>
            </div>
            <!-- Progress bar -->
            <div class="mt-1.5 h-1 bg-white/5 rounded-full overflow-hidden">
              <div
                class="h-full rounded-full transition-all {alert.direction === 'above' ? 'bg-accent-mint' : 'bg-accent-rose'}"
                style="width: {Math.max(0, Math.min(100, 100 - dist.pct * 2))}%"
              ></div>
            </div>
          {/if}

          {#if alert.note}
            <p class="text-[10px] text-slate-500 mt-1.5 italic truncate">"{alert.note}"</p>
          {/if}
        </div>
      {/each}

      <!-- Triggered alerts -->
      {#if triggeredAlerts.length > 0}
        <div class="px-3 py-1.5 bg-accent-gold/5 border-b border-white/5">
          <p class="text-[10px] text-slate-400 uppercase tracking-wider font-bold flex items-center gap-1">
            <Check size={10} class="text-accent-gold" /> تم تفعيلها ({triggeredAlerts.length})
          </p>
        </div>
        {#each triggeredAlerts as alert (alert.id)}
          <div class="px-3 py-2.5 border-b border-white/5 hover:bg-white/5 transition-colors opacity-75">
            <div class="flex items-center justify-between gap-2">
              <div class="flex items-center gap-1.5 min-w-0">
                {#if alert.direction === 'above'}
                  <TrendingUp size={12} class="text-accent-mint shrink-0" />
                {:else}
                  <TrendingDown size={12} class="text-accent-rose shrink-0" />
                {/if}
                <span class="font-semibold text-white text-xs line-through opacity-60">{alert.baseAsset}</span>
                <span class="text-[10px] text-accent-gold">${fmtPrice(alert.targetPrice)}</span>
              </div>
              <div class="flex items-center gap-1 shrink-0">
                <button
                  onclick={() => priceAlerts.reactivate(alert.id)}
                  class="p-1 rounded hover:bg-white/10 text-slate-500 hover:text-accent-mint transition-colors"
                  title="إعادة تفعيل"
                  aria-label="إعادة تفعيل"
                >
                  <RotateCcw size={11} />
                </button>
                <button
                  onclick={() => priceAlerts.remove(alert.id)}
                  class="p-1 rounded hover:bg-white/10 text-slate-500 hover:text-accent-rose transition-colors"
                  title="حذف"
                  aria-label="حذف"
                >
                  <Trash2 size={11} />
                </button>
              </div>
            </div>
            {#if alert.triggeredAt}
              <p class="text-[10px] text-slate-500 mt-0.5">تم التفعيل: {timeAgo(alert.triggeredAt)}</p>
            {/if}
          </div>
        {/each}
      {/if}
    {/if}
  </div>
</div>

<AlertModal bind:open={modalOpen} {symbol} />
