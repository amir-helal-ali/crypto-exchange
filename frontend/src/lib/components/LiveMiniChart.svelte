<script lang="ts">
  import { onMount } from 'svelte';
  import { usdToEgp, usdEgpRate } from '$lib/utils/currency';
  import { marketStore, type MarketTicker } from '$lib/stores/market';
  import { nexusMarket } from '$lib/stores/nexus-market';
  import PriceFlash from '$lib/components/PriceFlash.svelte';
  import ChangeBadge from '$lib/components/ChangeBadge.svelte';

  // Props
  interface Props {
    symbol?: string;
    height?: number;
    className?: string;
  }
  let { symbol = 'BTCUSDT', height = 60, className = '' }: Props = $props();

  // State
  let canvas: HTMLCanvasElement | null = $state(null);
  let ctx: CanvasRenderingContext2D | null = $state(null);
  let prices: number[] = $state([]);
  let ticker = $state<MarketTicker | undefined>(undefined);
  let currentRate = $state(48.5);
  let flashDir = $state<'up' | 'down' | null>(null);

  const MAX_POINTS = 60;
  const unsubRate = usdEgpRate.subscribe((r) => (currentRate = r));
  const unsubMarket = marketStore.subscribe((t) => {
    ticker = t[symbol];
  });

  let unsubNexus: (() => void) | null = null;

  onMount(() => {
    // Seed history from klines if available
    (async () => {
      const klines = await nexusMarket.getKlines(symbol, '1m', 60);
      if (klines.length > 1) {
        prices = klines.map((k) => k.close);
        drawChart();
      }
    })();

    // Subscribe to live ticks from NEXUS
    unsubNexus = nexusMarket.subscribe(symbol, (tick) => {
      const prev = prices[prices.length - 1];
      prices = [...prices, tick.price].slice(-MAX_POINTS);
      if (prev !== undefined) {
        if (tick.price > prev) flashDir = 'up';
        else if (tick.price < prev) flashDir = 'down';
        setTimeout(() => (flashDir = null), 400);
      }
      drawChart();
    });

    return () => {
      unsubRate();
      unsubMarket();
      unsubNexus?.();
    };
  });

  function drawChart() {
    if (!canvas || !ctx || prices.length < 2) return;

    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const range = max - min || 1;
    const padding = range * 0.1;

    const xStep = w / (MAX_POINTS - 1);
    const yScale = (h - 4) / (range + padding * 2);

    // Determine color based on first vs last
    const isUp = prices[prices.length - 1] >= prices[0];
    const color = isUp ? '#22d3a4' : '#f43f7a';
    const colorAlpha = isUp ? 'rgba(34, 211, 164, 0.15)' : 'rgba(244, 63, 122, 0.15)';

    // Build path
    const points = prices.map((p, i) => ({
      x: i * xStep,
      y: h - (p - min + padding) * yScale - 2
    }));

    // Fill area
    ctx.beginPath();
    ctx.moveTo(points[0].x, h);
    for (const p of points) ctx.lineTo(p.x, p.y);
    ctx.lineTo(points[points.length - 1].x, h);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, colorAlpha);
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.fill();

    // Line
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();

    // Last point dot with glow
    const last = points[points.length - 1];
    ctx.beginPath();
    ctx.arc(last.x, last.y, 4, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  const egpPrice = $derived(ticker ? usdToEgp(ticker.price, currentRate) : 0);
  const prevEgpPrice = $derived(ticker ? usdToEgp(ticker.prevPrice, currentRate) : 0);
</script>

<div class="relative {className}">
  <!-- Price header -->
  <div class="flex items-end justify-between mb-2">
    <div>
      <div class="flex items-center gap-1.5 mb-1">
        <span class="text-xs text-slate-400 font-bold">{symbol.replace('USDT', '')}/USDT</span>
        {#if flashDir}
          <span
            class="w-1.5 h-1.5 rounded-full {flashDir === 'up' ? 'bg-accent-mint' : 'bg-accent-rose'} animate-ping"
          ></span>
        {/if}
      </div>
      <div class="flex items-baseline gap-1">
        <span class="text-[10px] text-slate-500 font-bold">ج.م</span>
        {#if ticker}
          <PriceFlash
            value={egpPrice}
            prevValue={prevEgpPrice}
            decimals={egpPrice > 1000 ? 0 : 2}
            className="text-2xl font-bold text-white font-mono tabular-nums transition-colors"
          />
        {:else}
          <span class="text-2xl font-bold text-slate-700 font-mono">--</span>
        {/if}
      </div>
    </div>
    {#if ticker}
      <ChangeBadge change={ticker.change24h} className="text-xs" />
    {/if}
  </div>

  <!-- Canvas chart -->
  <div class="relative w-full" style="height: {height}px;">
    <canvas bind:this={canvas} class="w-full h-full block"></canvas>
    {#if prices.length < 2}
      <div class="absolute inset-0 flex items-center justify-center">
        <div class="w-6 h-6 border-2 border-accent-gold/30 border-t-accent-gold rounded-full animate-spin"></div>
      </div>
    {/if}
  </div>
</div>
