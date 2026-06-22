<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { formatPrice } from '$lib/utils/format';
  import { nexusMarket, deriveOrderBook } from '$lib/stores/nexus-market';

  interface Props {
    symbol: string;
  }

  let { symbol }: Props = $props();

  let asks = $state<[number, number][]>([]);
  let bids = $state<[number, number][]>([]);
  let lastPrice = $state(0);
  let prevPrice = $state(0);
  let maxTotal = $state(1);

  let unsubNexus: (() => void) | null = null;
  let unsubOB: (() => void) | null = null;
  let lastSymbol = '';

  function attach(symbol: string) {
    if (lastSymbol === symbol) return;
    detach();
    lastSymbol = symbol;
    // Live ticker (for last-traded price + flash)
    unsubNexus = nexusMarket.subscribe(symbol, (tick) => {
      prevPrice = lastPrice;
      lastPrice = tick.price;
      // If we don't have a real orderbook yet, derive one from the price
      if (asks.length === 0 && bids.length === 0) {
        const book = deriveOrderBook(tick.price, 12);
        bids = book.bids;
        asks = book.asks;
        const totals = [...bids, ...asks].map(([, q]) => q);
        maxTotal = Math.max(...totals, 1);
      }
    });
    // Live L2 orderbook (Binance partial depth @ 100ms)
    unsubOB = nexusMarket.subscribeOrderbook(symbol, (ob) => {
      if (!ob.bids.length && !ob.asks.length) return;
      bids = ob.bids.slice(0, 20) as [number, number][];
      asks = ob.asks.slice(0, 20) as [number, number][];
      const totals = [...bids, ...asks].map(([, q]) => q);
      maxTotal = Math.max(...totals, 1);
    });
    // Bootstrap with REST snapshot
    (async () => {
      const ob = await nexusMarket.getOrderbook(symbol);
      if (ob && (ob.bids.length || ob.asks.length)) {
        bids = ob.bids.slice(0, 20) as [number, number][];
        asks = ob.asks.slice(0, 20) as [number, number][];
        const totals = [...bids, ...asks].map(([, q]) => q);
        maxTotal = Math.max(...totals, 1);
      }
    })();
  }

  function detach() {
    unsubNexus?.();
    unsubOB?.();
    unsubNexus = null;
    unsubOB = null;
  }

  onMount(() => {
    attach(symbol);
    return detach;
  });

  onDestroy(detach);

  // Switch subscriptions whenever the symbol prop changes
  $effect(() => {
    if (symbol) attach(symbol);
  });

  const isUp = $derived(lastPrice >= prevPrice);
</script>

<div class="h-full flex flex-col">
  <div class="flex items-center justify-between px-3 py-2 border-b border-white/5">
    <h3 class="text-xs font-bold text-white">دفتر الأوامر</h3>
    <div class="flex items-center gap-1 text-[10px] text-slate-500">
      <span class="w-1.5 h-1.5 rounded-full bg-accent-mint animate-pulse"></span>
      مباشر
    </div>
  </div>

  <!-- Column headers -->
  <div class="grid grid-cols-3 gap-2 px-3 py-1.5 text-[10px] uppercase tracking-wider text-slate-500 border-b border-white/5">
    <span class="text-right">السعر</span>
    <span class="text-center">الكمية</span>
    <span class="text-left">الإجمالي</span>
  </div>

  <!-- Asks (reversed: highest at top) -->
  <div class="flex-1 overflow-hidden flex flex-col-reverse">
    {#each asks.slice(0, 9) as [price, qty], i}
      {@const total = price * qty}
      {@const pct = (qty / maxTotal) * 100}
      <div class="relative ob-row" style="--bar-pct: {pct}%;">
        <span class="text-accent-rose">{formatPrice(price)}</span>
        <span class="text-slate-300">{formatPrice(qty, 4)}</span>
        <span class="text-slate-400 text-left">{formatPrice(total)}</span>
        <div
          class="absolute inset-y-0 left-0 bg-accent-rose/10 pointer-events-none"
          style="width: {pct}%;"
        ></div>
      </div>
    {/each}
  </div>

  <!-- Spread / last price -->
  <div class="border-y border-white/5 px-3 py-2 flex items-center justify-between">
    <span class="text-lg font-bold font-mono {isUp ? 'text-accent-mint' : 'text-accent-rose'} tabular-nums">
      {formatPrice(lastPrice)}
    </span>
    <span class="text-[10px] text-slate-500">← آخر سعر</span>
  </div>

  <!-- Bids -->
  <div class="flex-1 overflow-hidden">
    {#each bids.slice(0, 9) as [price, qty], i}
      {@const total = price * qty}
      {@const pct = (qty / maxTotal) * 100}
      <div class="relative ob-row" style="--bar-pct: {pct}%;">
        <span class="text-accent-mint">{formatPrice(price)}</span>
        <span class="text-slate-300">{formatPrice(qty, 4)}</span>
        <span class="text-slate-400 text-left">{formatPrice(total)}</span>
        <div
          class="absolute inset-y-0 left-0 bg-accent-mint/10 pointer-events-none"
          style="width: {pct}%;"
        ></div>
      </div>
    {/each}
  </div>
</div>
