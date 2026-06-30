<script lang="ts">
  /**
   * DepthChart — visual area chart of bid/ask order book depth.
   * Sits next to (or below) the OrderBook table for a Binance Pro-style view.
   * Custom canvas-based, dark-mode real-time depth visualization from the NEXUS market feed.
   */
  import { onMount, onDestroy } from 'svelte';
  import { nexusMarket, deriveOrderBook } from '$lib/stores/nexus-market';
  import { formatCompact } from '$lib/utils/format';

  interface Props {
    symbol: string;
    height?: number;
  }

  let { symbol, height = 120 }: Props = $props();

  let canvas: HTMLCanvasElement;
  let container: HTMLElement;
  let ctx: CanvasRenderingContext2D;
  let rafId = 0;

  let bids: [number, number][] = [];
  let asks: [number, number][] = [];
  let lastPrice = 0;
  let maxCumulative = 1;
  let priceMin = 0;
  let priceMax = 1;

  let unsubNexus: (() => void) | null = null;
  let unsubOB: (() => void) | null = null;

  function cssVar(name: string): string {
    if (typeof getComputedStyle === 'undefined') return '';
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  function themeColors() {
    return {
      bg: cssVar('--bg-elev-1') || '#0a0e1f',
      grid: 'rgba(255,255,255,0.04)',
      axisText: '#6b769c',
      axisTextStrong: '#a3accd',
      bid: '#22d3a4',
      bidFill: 'rgba(34,211,164,0.18)',
      ask: '#f43f7a',
      askFill: 'rgba(244,63,122,0.18)',
      mid: '#f5b544',
      panelBorder: 'rgba(255,255,255,0.05)'
    };
  }

  onMount(() => {
    ctx = canvas.getContext('2d')!;
    setupCanvas();

    // Live L2 orderbook from Binance partial depth stream
    unsubOB = nexusMarket.subscribeOrderbook(symbol, (ob) => {
      if (ob.bids.length) bids = ob.bids;
      if (ob.asks.length) asks = ob.asks;
      recompute();
      render();
    });
    // Live ticker for last-price updates
    unsubNexus = nexusMarket.subscribe(symbol, (tick) => {
      if (tick.symbol !== symbol) return;
      lastPrice = tick.price;
      // If no real orderbook yet, derive synthetic from price
      if (bids.length === 0 || asks.length === 0) {
        const book = deriveOrderBook(tick.price, 18);
        bids = book.bids;
        asks = book.asks;
      }
      recompute();
      render();
    });
    // Bootstrap with REST snapshot
    (async () => {
      const ob = await nexusMarket.getOrderbook(symbol);
      if (ob && (ob.bids.length || ob.asks.length)) {
        bids = ob.bids;
        asks = ob.asks;
        recompute();
        render();
      }
    })();

    const ro = new ResizeObserver(() => {
      setupCanvas();
      render();
    });
    ro.observe(container);

    return () => {
      cancelAnimationFrame(rafId);
      unsubNexus?.();
      unsubOB?.();
      ro.disconnect();
    };
  });

  onDestroy(() => {
    if (typeof window === 'undefined') return;
    cancelAnimationFrame(rafId);
    unsubNexus?.();
    unsubOB?.();
  });

  $effect(() => {
    if (symbol) {
      // Re-subscribe on symbol change
      unsubOB?.();
      unsubOB = nexusMarket.subscribeOrderbook(symbol, (ob) => {
        if (ob.bids.length) bids = ob.bids;
        if (ob.asks.length) asks = ob.asks;
        recompute();
        render();
      });
    }
  });

  function setupCanvas() {
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();
    canvas.width = Math.max(1, rect.width * dpr);
    canvas.height = Math.max(1, rect.height * dpr);
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
  }

  function recompute() {
    if (!lastPrice && bids.length === 0 && asks.length === 0) return;
    // Use real orderbook if available; otherwise derive synthetic from price
    if (bids.length === 0 || asks.length === 0) {
      const book = deriveOrderBook(lastPrice, 18);
      if (bids.length === 0) bids = book.bids;
      if (asks.length === 0) asks = book.asks;
    }
    if (bids.length === 0 || asks.length === 0) return;
    // Compute cumulative depth
    let cumBids = 0;
    let cumAsks = 0;
    const bidCum = bids.map(([p, q]) => {
      cumBids += q;
      return [p, cumBids] as [number, number];
    });
    const askCum = asks.map(([p, q]) => {
      cumAsks += q;
      return [p, cumAsks] as [number, number];
    });
    maxCumulative = Math.max(cumBids, cumAsks, 1);
    // Price range
    const bidPrices = bids.map(([p]) => p);
    const askPrices = asks.map(([p]) => p);
    priceMin = Math.min(...bidPrices);
    priceMax = Math.max(...askPrices);
    // Stash cumulative arrays for render
    bidCumCache = bidCum;
    askCumCache = askCum;
  }

  let bidCumCache: [number, number][] = [];
  let askCumCache: [number, number][] = [];

  function render() {
    if (!ctx || !lastPrice) return;
    const rect = container.getBoundingClientRect();
    const W = rect.width;
    const H = rect.height;
    const padLeft = 4;
    const padRight = 60;
    const padTop = 8;
    const padBottom = 16;
    const chartW = W - padLeft - padRight;
    const chartH = H - padTop - padBottom;
    const C = themeColors();

    // Background
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, W, H);

    // Grid
    ctx.strokeStyle = C.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i <= 4; i++) {
      const y = padTop + (chartH / 4) * i;
      ctx.moveTo(padLeft, y);
      ctx.lineTo(padLeft + chartW, y);
    }
    ctx.stroke();

    // Price -> X mapping
    const priceRange = priceMax - priceMin || 1;
    const priceToX = (p: number) => padLeft + ((p - priceMin) / priceRange) * chartW;
    // Cumulative -> Y mapping (inverted: 0 at bottom, max at top)
    const cumToY = (c: number) => padTop + chartH - (c / maxCumulative) * chartH;

    // Mid price line
    const midX = priceToX(lastPrice);
    ctx.strokeStyle = C.mid;
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(midX, padTop);
    ctx.lineTo(midX, padTop + chartH);
    ctx.stroke();
    ctx.setLineDash([]);

    // Bids area (left side of mid)
    if (bidCumCache.length > 0) {
      ctx.fillStyle = C.bidFill;
      ctx.strokeStyle = C.bid;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      const firstX = priceToX(bidCumCache[0][0]);
      ctx.moveTo(firstX, padTop + chartH);
      for (const [p, c] of bidCumCache) {
        ctx.lineTo(priceToX(p), cumToY(c));
      }
      ctx.lineTo(priceToX(bidCumCache[bidCumCache.length - 1][0]), padTop + chartH);
      ctx.closePath();
      ctx.fill();
      // Stroke the upper edge
      ctx.beginPath();
      ctx.moveTo(firstX, cumToY(bidCumCache[0][1]));
      for (const [p, c] of bidCumCache) {
        ctx.lineTo(priceToX(p), cumToY(c));
      }
      ctx.stroke();
    }

    // Asks area (right side of mid)
    if (askCumCache.length > 0) {
      ctx.fillStyle = C.askFill;
      ctx.strokeStyle = C.ask;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      const firstX = priceToX(askCumCache[0][0]);
      ctx.moveTo(firstX, padTop + chartH);
      for (const [p, c] of askCumCache) {
        ctx.lineTo(priceToX(p), cumToY(c));
      }
      ctx.lineTo(priceToX(askCumCache[askCumCache.length - 1][0]), padTop + chartH);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(firstX, cumToY(askCumCache[0][1]));
      for (const [p, c] of askCumCache) {
        ctx.lineTo(priceToX(p), cumToY(c));
      }
      ctx.stroke();
    }

    // Mid price label (right side)
    ctx.fillStyle = C.mid;
    ctx.fillRect(padLeft + chartW, padTop + chartH / 2 - 9, padRight, 18);
    ctx.fillStyle = '#050813';
    ctx.font = 'bold 10px "JetBrains Mono", ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(formatPrice(lastPrice), padLeft + chartW + padRight / 2, padTop + chartH / 2);

    // Bid/Ask price labels on x-axis
    ctx.fillStyle = C.bid;
    ctx.font = '9px "JetBrains Mono", ui-monospace, monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    if (bids.length > 0) {
      ctx.fillText(formatPrice(bids[bids.length - 1][0]), padLeft, padTop + chartH + 4);
    }
    ctx.fillStyle = C.ask;
    ctx.textAlign = 'right';
    if (asks.length > 0) {
      ctx.fillText(formatPrice(asks[asks.length - 1][0]), padLeft + chartW, padTop + chartH + 4);
    }

    // Cumulative depth label (top-right)
    ctx.fillStyle = C.axisText;
    ctx.font = '9px "JetBrains Mono", ui-monospace, monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.fillText(`Max: ${formatCompact(maxCumulative)}`, padLeft + chartW, padTop + 2);
  }

  function formatPrice(n: number): string {
    if (!isFinite(n)) return '--';
    if (n >= 1000) return n.toLocaleString('en-US', { maximumFractionDigits: 2 });
    if (n >= 1) return n.toFixed(2);
    if (n >= 0.01) return n.toFixed(4);
    return n.toFixed(6);
  }
</script>

<div
  bind:this={container}
  class="relative w-full overflow-hidden"
  style="height: {height}px; background: var(--bg-elev-1);"
>
  <canvas bind:this={canvas} class="absolute inset-0" aria-label="مخطط عمق {symbol}"></canvas>
</div>
