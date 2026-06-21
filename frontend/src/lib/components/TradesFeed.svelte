<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { formatPrice, formatSymbol, timeAgo } from '$lib/utils/format';
  import { nexusMarket, deriveTrade } from '$lib/stores/nexus-market';

  interface Props {
    symbol: string;
  }

  let { symbol }: Props = $props();

  interface Trade {
    id: number;
    price: number;
    qty: number;
    time: number;
    side: 'BUY' | 'SELL';
  }

  let trades = $state<Trade[]>([]);
  let unsubNexus: (() => void) | null = null;

  onMount(() => {
    unsubNexus = nexusMarket.subscribe(symbol, (tick) => {
      if (tick.symbol !== symbol) return;
      // Derive 1-2 realistic trades per tick
      const t1 = deriveTrade(symbol, tick.price);
      if (t1) {
        trades = [
          { id: t1.id, price: t1.price, qty: t1.qty, time: t1.time, side: t1.side },
          ...trades
        ].slice(0, 25);
      }
    });
    return () => {
      unsubNexus?.();
    };
  });

  onDestroy(() => {
    unsubNexus?.();
  });

  $effect(() => {
    if (symbol) {
      trades = [];
      nexusMarket.switchSymbol(symbol);
    }
  });
</script>

<div class="h-full flex flex-col">
  <div class="px-3 py-2 border-b border-white/5">
    <h3 class="text-xs font-bold text-white">آخر الصفقات</h3>
  </div>

  <div class="grid grid-cols-3 gap-2 px-3 py-1.5 text-[10px] uppercase tracking-wider text-slate-500 border-b border-white/5">
    <span class="text-right">السعر</span>
    <span class="text-center">الكمية</span>
    <span class="text-left">الوقت</span>
  </div>

  <div class="flex-1 overflow-y-auto scrollbar-none">
    {#each trades as t (t.id)}
      <div class="grid grid-cols-3 gap-2 px-3 py-1 text-[11px] font-mono tabular-nums hover:bg-white/[0.02]">
        <span class={t.side === 'BUY' ? 'text-accent-mint' : 'text-accent-rose'}>
          {formatPrice(t.price)}
        </span>
        <span class="text-slate-300 text-center">{formatPrice(t.qty, 4)}</span>
        <span class="text-slate-500 text-left">{timeAgo(new Date(t.time))}</span>
      </div>
    {/each}
    {#if trades.length === 0}
      <div class="py-8 text-center text-slate-500 text-xs">بانتظار الصفقات...</div>
    {/if}
  </div>
</div>
