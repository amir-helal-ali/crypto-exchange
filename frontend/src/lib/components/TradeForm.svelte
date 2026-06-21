<script lang="ts">
  import { onMount } from 'svelte';
  import { exchange } from '$lib/api/endpoints';
  import { parseApiResponse, ApiError } from '$lib/api/client';
  import { toasts } from '$lib/stores/toast';
  import { formatPrice, formatSymbol } from '$lib/utils/format';
  import { marketStore } from '$lib/stores/market';

  interface Props {
    symbol: string;
    balances: { currency: string; balance: string | number }[];
  }

  let { symbol, balances }: Props = $props();

  let side = $state<'BUY' | 'SELL'>('BUY');
  let orderType = $state<'MARKET' | 'LIMIT' | 'STOP_LIMIT'>('LIMIT');
  let price = $state('');
  let quantity = $state('');
  let stopPrice = $state('');
  let loading = $state(false);
  let percent = $state(0);

  const { base, quote } = $derived(formatSymbol(symbol));
  let livePrice = $state(0);

  // Subscribe to market store for current price
  const unsubscribe = marketStore.subscribe((tickers) => {
    if (tickers[symbol]) {
      livePrice = tickers[symbol].price;
    }
  });

  onMount(() => {
    if (!price && orderType === 'LIMIT') price = livePrice.toFixed(2);
    return unsubscribe;
  });

  $effect(() => {
    if (orderType === 'LIMIT' && !price && livePrice > 0) {
      price = livePrice.toFixed(2);
    }
  });

  const quoteBalance = $derived(
    balances.find((b) => b.currency === quote)?.balance || 0
  );
  const baseBalance = $derived(
    balances.find((b) => b.currency === base)?.balance || 0
  );

  const availableBalance = $derived(side === 'BUY' ? quoteBalance : baseBalance);

  const total = $derived.by(() => {
    const p = parseFloat(price) || 0;
    const q = parseFloat(quantity) || 0;
    return p * q;
  });

  function setPercent(p: number) {
    percent = p;
    if (side === 'BUY') {
      const bal = typeof quoteBalance === 'string' ? parseFloat(quoteBalance) : quoteBalance;
      if (bal > 0 && livePrice > 0) {
        const q = (bal * p) / 100 / livePrice;
        quantity = q.toFixed(6);
      }
    } else {
      const bal = typeof baseBalance === 'string' ? parseFloat(baseBalance) : baseBalance;
      if (bal > 0) {
        quantity = (bal * p / 100).toFixed(6);
      }
    }
  }

  async function handleSubmit() {
    if (!quantity || parseFloat(quantity) <= 0) {
      toasts.error('أدخل كمية صحيحة');
      return;
    }
    if ((orderType === 'LIMIT' || orderType === 'STOP_LIMIT') && (!price || parseFloat(price) <= 0)) {
      toasts.error('أدخل سعراً صحيحاً');
      return;
    }
    if (orderType === 'STOP_LIMIT' && (!stopPrice || parseFloat(stopPrice) <= 0)) {
      toasts.error('أدخل سعر التفعيل');
      return;
    }

    loading = true;
    try {
      const req: any = {
        symbol,
        side,
        type: orderType,
        quantity: parseFloat(quantity)
      };
      if (orderType === 'LIMIT') req.price = parseFloat(price);
      if (orderType === 'STOP_LIMIT') {
        req.price = parseFloat(price);
        req.stop_price = parseFloat(stopPrice);
      }

      const res = await exchange.placeOrder(req);
      await parseApiResponse(res);
      toasts.success(
        orderType === 'MARKET'
          ? `تم تنفيذ أمر ${side === 'BUY' ? 'الشراء' : 'البيع'} بنجاح`
          : `تم إنشاء أمر ${side === 'BUY' ? 'الشراء' : 'البيع'} بنجاح`
      );
      quantity = '';
      price = '';
      stopPrice = '';
      percent = 0;
    } catch (err: any) {
      if (err instanceof ApiError) {
        toasts.error(err.message);
      } else {
        toasts.error('فشل تنفيذ الأمر');
      }
    } finally {
      loading = false;
    }
  }
</script>

<div class="flex flex-col h-full">
  <!-- Buy/Sell tabs -->
  <div class="grid grid-cols-2 gap-1 p-2 bg-ink-950/60 rounded-xl mb-3">
    <button
      onclick={() => (side = 'BUY')}
      class="py-2 rounded-lg text-sm font-bold transition-all {side === 'BUY'
        ? 'bg-gradient-to-br from-accent-mint to-emerald-600 text-ink-950 shadow-glow-mint'
        : 'text-slate-400 hover:text-white'}"
    >
      شراء
    </button>
    <button
      onclick={() => (side = 'SELL')}
      class="py-2 rounded-lg text-sm font-bold transition-all {side === 'SELL'
        ? 'bg-gradient-to-br from-accent-rose to-rose-600 text-ink-950 shadow-glow-rose'
        : 'text-slate-400 hover:text-white'}"
    >
      بيع
    </button>
  </div>

  <!-- Order type tabs -->
  <div class="flex gap-1 mb-3 text-xs">
    {#each [{ k: 'LIMIT', l: 'محدد' }, { k: 'MARKET', l: 'سوق' }, { k: 'STOP_LIMIT', l: 'إيقاف' }] as t}
      <button
        onclick={() => (orderType = t.k as any)}
        class="flex-1 py-1.5 rounded-lg font-medium transition-colors {orderType === t.k
          ? 'bg-white/5 text-white border border-white/10'
          : 'text-slate-400 hover:text-white hover:bg-white/[0.03]'}"
      >
        {t.l}
      </button>
    {/each}
  </div>

  <!-- Available balance -->
  <div class="flex items-center justify-between mb-3 px-1">
    <span class="text-[11px] text-slate-400">الرصيد المتاح</span>
    <span class="text-[11px] font-mono text-slate-200 tabular-nums">
      {formatPrice(availableBalance, 6)} {side === 'BUY' ? quote : base}
    </span>
  </div>

  <!-- Price input (Limit / Stop-Limit) -->
  {#if orderType === 'LIMIT' || orderType === 'STOP_LIMIT'}
    <div class="mb-2">
      <span class="text-[10px] text-slate-500 mb-1 block">السعر (USDT)</span>
      <div class="relative">
        <input
          bind:value={price}
          type="number"
          step="0.01"
          placeholder="0.00"
          class="input pr-3 pl-12 py-2 text-sm font-mono"
        />
        <span class="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-500">{quote}</span>
      </div>
    </div>
  {/if}

  {#if orderType === 'STOP_LIMIT'}
    <div class="mb-2">
      <span class="text-[10px] text-slate-500 mb-1 block">سعر التفعيل</span>
      <div class="relative">
        <input
          bind:value={stopPrice}
          type="number"
          step="0.01"
          placeholder="0.00"
          class="input pr-3 pl-12 py-2 text-sm font-mono"
        />
        <span class="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-500">{quote}</span>
      </div>
    </div>
  {/if}

  <!-- Quantity input -->
  <div class="mb-3">
    <span class="text-[10px] text-slate-500 mb-1 block">الكمية</span>
    <div class="relative">
      <input
        bind:value={quantity}
        type="number"
        step="0.000001"
        placeholder="0.00"
        class="input pr-3 pl-12 py-2 text-sm font-mono"
      />
      <span class="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-500">{base}</span>
    </div>
  </div>

  <!-- Percentage slider -->
  <div class="mb-3">
    <div class="grid grid-cols-4 gap-1">
      {#each [25, 50, 75, 100] as p}
        <button
          onclick={() => setPercent(p)}
          class="py-1 text-[10px] rounded-md font-medium transition-colors {percent === p
            ? 'bg-accent-gold/15 text-accent-gold'
            : 'bg-white/[0.03] text-slate-400 hover:bg-white/5 hover:text-white'}"
        >
          {p}%
        </button>
      {/each}
    </div>
  </div>

  <!-- Total (for LIMIT orders) -->
  {#if orderType === 'LIMIT' || orderType === 'STOP_LIMIT'}
    <div class="flex items-center justify-between mb-3 px-1 pb-3 border-b border-white/5">
      <span class="text-[11px] text-slate-400">الإجمالي</span>
      <span class="text-[11px] font-mono text-white tabular-nums">{formatPrice(total)} {quote}</span>
    </div>
  {/if}

  <!-- Submit button -->
  <button
    onclick={handleSubmit}
    disabled={loading}
    class="w-full py-3 rounded-xl font-bold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed {side === 'BUY'
      ? 'btn-buy'
      : 'btn-sell'}"
  >
    {#if loading}
      <svg class="animate-spin h-4 w-4 mx-auto" viewBox="0 0 24 24" fill="none">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
    {:else}
      {side === 'BUY' ? 'شراء' : 'بيع'} {base}
    {/if}
  </button>
</div>
