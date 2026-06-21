<script lang="ts">
  /**
   * NEXUS Chart v2 — proprietary canvas-based trading chart for the
   * NEXUS Exchange platform. Pulls OHLCV data from NEXUS's own market
   * engine (`/api/v1/market/klines`) and streams live updates over the
   * NEXUS WebSocket (`/ws/kline`). Theme-aware, touch-friendly, fully
   * custom — no TradingView, no third-party chart libs.
   *
   * v2 features:
   *  - Candlesticks, Heikin-Ashi, Line, Area chart types
   *  - Volume bars
   *  - Live price line + animated tag
   *  - Crosshair with OHLC tooltip
   *  - SMA / EMA / Bollinger Bands / VWAP overlay indicators
   *  - RSI sub-panel (with 30 / 50 / 70 levels)
   *  - MACD sub-panel (line, signal, histogram, zero line)
   *  - Drawing tools: cursor, horizontal-line, trend-line, rectangle, fib
   *    retracement, eraser — persisted per symbol+timeframe in localStorage
   *  - Trade markers (buy/sell arrows from user's filled orders)
   *  - Zoom (wheel + pinch), Pan (drag), touch support
   *  - Theme-aware (dark + light)
   *  - Export to PNG
   *  - High-DPI rendering
   */
  import { onMount, onDestroy } from 'svelte';
  import { theme as themeStore } from '$lib/stores/theme';
  import { API_BASE } from '$lib/api/client';

  type ChartType = 'candles' | 'heikin-ashi' | 'line' | 'area';
  type Tool = 'cursor' | 'hline' | 'trendline' | 'rect' | 'fib' | 'eraser';

  interface Drawing {
    id: string;
    type: 'hline' | 'trendline' | 'rect' | 'fib';
    points: { x: number; y: number }[]; // in canvas pixels at draw time
    pricePoints: { price: number; time: number }[]; // re-anchor on zoom/pan
    color: string;
    createdAt: number;
  }

  interface Marker {
    side: 'BUY' | 'SELL';
    price: number;
    time: number;
    qty: number;
  }

  export interface IndicatorConfig {
    sma20Period?: number;
    sma50Period?: number;
    ema12Period?: number;
    ema26Period?: number;
    bollPeriod?: number;
    bollStd?: number;
    rsiPeriod?: number;
    macdFast?: number;
    macdSlow?: number;
    macdSignal?: number;
    // Colors override (CSS hex)
    colors?: Record<string, string>;
    // Active price alert lines [{id, price, side, label}]
    alertLines?: AlertLine[];
  }

  interface AlertLine {
    id: string;
    price: number;
    side: 'above' | 'below';
    label?: string;
  }

  interface Props {
    symbol: string;
    timeframe: string;
    indicators?: string[];
    subIndicators?: string[];
    chartType?: ChartType;
    tool?: Tool;
    height?: number;
    markers?: Marker[];
    config?: IndicatorConfig;
  }

  let {
    symbol,
    timeframe,
    indicators = ['SMA20'],
    subIndicators = [],
    chartType = 'candles',
    tool = 'cursor',
    height = 460,
    markers = [],
    config = {}
  }: Props = $props();

  // Config-derived params (with sensible defaults)
  const cfg = $derived({
    sma20Period: config.sma20Period ?? 20,
    sma50Period: config.sma50Period ?? 50,
    ema12Period: config.ema12Period ?? 12,
    ema26Period: config.ema26Period ?? 26,
    bollPeriod: config.bollPeriod ?? 20,
    bollStd: config.bollStd ?? 2,
    rsiPeriod: config.rsiPeriod ?? 14,
    macdFast: config.macdFast ?? 12,
    macdSlow: config.macdSlow ?? 26,
    macdSignal: config.macdSignal ?? 9,
    colors: config.colors ?? {},
    alertLines: config.alertLines ?? []
  });

  // --- Canvas refs ---
  let canvas: HTMLCanvasElement;
  let container: HTMLElement;
  let ctx: CanvasRenderingContext2D;

  // --- Chart state ---
  interface Candle {
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  }

  let candles: Candle[] = [];
  let heikinAshi: Candle[] = [];
  let visibleCandles: Candle[] = [];
  let offsetX = 0;
  let candleWidth = 8;
  let candleSpacing = 2;
  let priceRange: { min: number; max: number } = { min: 0, max: 1 };
  let volumeMax = 1;
  let hoveredCandle: Candle | null = null;
  let crosshairPos: { x: number; y: number } | null = null;
  let isDragging = false;
  let lastDragX = 0;
  let pinchDist = 0;
  let klineWs: WebSocket | null = null;
  let tickerWs: WebSocket | null = null;
  let rafId = 0;
  let resizeObserver: ResizeObserver;
  let lastFlash: 'up' | 'down' | null = null;
  let flashAt = 0;
  let livePricePulse = 0;
  let lastPriceY = -1;
  let theme = 'dark';

  // --- Drawing state ---
  let drawings: Drawing[] = [];
  let activeDraw: { type: Tool; start: { x: number; y: number } | null } | null = null;
  let cursorPos: { x: number; y: number } | null = null;

  // --- Indicator buffers ---
  let sma20: (number | null)[] = [];
  let sma50: (number | null)[] = [];
  let ema12: (number | null)[] = [];
  let ema26: (number | null)[] = [];
  let bollUpper: (number | null)[] = [];
  let bollMiddle: (number | null)[] = [];
  let bollLower: (number | null)[] = [];
  let vwap: (number | null)[] = [];
  let rsiArr: (number | null)[] = [];
  let macdLine: (number | null)[] = [];
  let macdSignal: (number | null)[] = [];
  let macdHist: (number | null)[] = [];

  // --- Subscribers ---
  const unsubTheme = themeStore.subscribe((t) => {
    theme = t?.resolved ?? 'dark';
    scheduleRender();
  });

  // React to tool changes from parent (state mirrors prop for use in handlers)
  let currentTool = $state(tool);
  $effect(() => {
    currentTool = tool;
    if (canvas && typeof window !== 'undefined') {
      canvas.style.cursor = tool === 'cursor' ? 'crosshair' : tool === 'eraser' ? 'cell' : 'crosshair';
    }
  });

  // ============================================================
  // Lifecycle
  // ============================================================
  onMount(() => {
    (async () => {
      ctx = canvas.getContext('2d')!;
      loadDrawings();
      setupCanvas();
      await loadCandles();
      connectKlineWS();
      connectTickerWS();
      startRenderLoop();

      resizeObserver = new ResizeObserver(() => {
        setupCanvas();
        updateVisibleRange();
        render();
      });
      resizeObserver.observe(container);
    })();

    return () => {
      cancelAnimationFrame(rafId);
      resizeObserver?.disconnect();
      klineWs?.close();
      tickerWs?.close();
      unsubTheme();
    };
  });

  onDestroy(() => {
    if (typeof window === 'undefined') return;
    cancelAnimationFrame(rafId);
    klineWs?.close();
    tickerWs?.close();
    unsubTheme();
  });

  // Reload when symbol or timeframe changes
  let lastSymbol = symbol;
  let lastTF = timeframe;
  $effect(() => {
    if ((symbol !== lastSymbol || timeframe !== lastTF) && candles.length > 0) {
      lastSymbol = symbol;
      lastTF = timeframe;
      candles = [];
      offsetX = 0;
      loadDrawings();
      loadCandles().then(() => {
        connectKlineWS();
        connectTickerWS();
        render();
      });
    }
  });

  // ============================================================
  // Data loading
  // ============================================================
  async function loadCandles() {
    try {
      const res = await fetch(
        `${API_BASE}/api/v1/market/klines?symbol=${symbol}&interval=${timeframe}&limit=300`
      );
      if (!res.ok) throw new Error('klines failed');
      const data = await res.json();
      candles = (data || []).map((k: any) => ({
        time: k.time,
        open: +k.open,
        high: +k.high,
        low: +k.low,
        close: +k.close,
        volume: +k.volume
      }));
      computeHeikinAshi();
      computeIndicators();
      offsetX = Math.max(0, candles.length - 60);
      updateVisibleRange();
      render();
    } catch (err) {
      console.error('NEXUS Chart: failed to load candles', err);
    }
  }

  function connectKlineWS() {
    try {
      klineWs?.close();
      const url = `${API_BASE.replace(/^http/, 'ws')}/ws/kline?symbol=${symbol}&interval=${timeframe}`;
      klineWs = new WebSocket(url);
      klineWs.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          const k = msg.kline;
          if (!k) return;
          const candle: Candle = {
            time: k.time,
            open: +k.open,
            high: +k.high,
            low: +k.low,
            close: +k.close,
            volume: +k.volume
          };
          const prev = candles[candles.length - 1];
          if (prev && prev.time === candle.time) {
            const prevClose = prev.close;
            candles[candles.length - 1] = candle;
            if (candle.close > prevClose) {
              lastFlash = 'up';
              flashAt = performance.now();
            } else if (candle.close < prevClose) {
              lastFlash = 'down';
              flashAt = performance.now();
            }
          } else if (!prev || candle.time > prev.time) {
            candles.push(candle);
            if (candles.length > 500) candles.shift();
            offsetX = Math.max(0, offsetX);
          }
          computeHeikinAshi();
          computeIndicators();
          updateVisibleRange();
          livePricePulse = 1;
        } catch {}
      };
      klineWs.onerror = () => {};
    } catch {}
  }

  function connectTickerWS() {
    try {
      tickerWs?.close();
      const url = `${API_BASE.replace(/^http/, 'ws')}/ws/market?symbol=${symbol}`;
      tickerWs = new WebSocket(url);
      tickerWs.onmessage = (ev) => {
        try {
          const d = JSON.parse(ev.data);
          if (d.symbol && typeof d.price === 'number') {
            window.dispatchEvent(
              new CustomEvent('nexus-ticker', {
                detail: {
                  symbol: d.symbol,
                  price: d.price,
                  change24h: d.change_24h,
                  high24h: d.high_24h,
                  low24h: d.low_24h,
                  volume24h: d.volume_24h
                }
              })
            );
          }
        } catch {}
      };
      tickerWs.onerror = () => {};
    } catch {}
  }

  // ============================================================
  // Heikin-Ashi transformation
  // ============================================================
  function computeHeikinAshi() {
    heikinAshi = [];
    let prevHA: Candle | null = null;
    for (let i = 0; i < candles.length; i++) {
      const c = candles[i];
      const haClose = (c.open + c.high + c.low + c.close) / 4;
      const haOpen = prevHA
        ? (prevHA.open + prevHA.close) / 2
        : (c.open + c.close) / 2;
      const haHigh = Math.max(c.high, haOpen, haClose);
      const haLow = Math.min(c.low, haOpen, haClose);
      const ha: Candle = {
        time: c.time,
        open: haOpen,
        high: haHigh,
        low: haLow,
        close: haClose,
        volume: c.volume
      };
      heikinAshi.push(ha);
      prevHA = ha;
    }
  }

  // ============================================================
  // Indicators
  // ============================================================
  function computeIndicators() {
    const closes = candles.map((c) => c.close);
    sma20 = computeSMA(closes, cfg.sma20Period);
    sma50 = computeSMA(closes, cfg.sma50Period);
    ema12 = computeEMA(closes, cfg.ema12Period);
    ema26 = computeEMA(closes, cfg.ema26Period);
    const boll = computeBollinger(closes, cfg.bollPeriod, cfg.bollStd);
    bollUpper = boll.upper;
    bollMiddle = boll.middle;
    bollLower = boll.lower;
    vwap = computeVWAP();
    rsiArr = computeRSI(closes, cfg.rsiPeriod);
    const macd = computeMACD(closes, cfg.macdFast, cfg.macdSlow, cfg.macdSignal);
    macdLine = macd.line;
    macdSignal = macd.signal;
    macdHist = macd.hist;
  }

  function computeSMA(values: number[], period: number): (number | null)[] {
    const out: (number | null)[] = [];
    for (let i = 0; i < values.length; i++) {
      if (i < period - 1) {
        out.push(null);
      } else {
        let sum = 0;
        for (let j = i - period + 1; j <= i; j++) sum += values[j];
        out.push(sum / period);
      }
    }
    return out;
  }

  function computeEMA(values: number[], period: number): (number | null)[] {
    const out: (number | null)[] = [];
    const k = 2 / (period + 1);
    let prev: number | null = null;
    for (let i = 0; i < values.length; i++) {
      if (i < period - 1) {
        out.push(null);
      } else if (i === period - 1) {
        let sum = 0;
        for (let j = 0; j < period; j++) sum += values[j];
        prev = sum / period;
        out.push(prev);
      } else {
        prev = values[i] * k + (prev as number) * (1 - k);
        out.push(prev);
      }
    }
    return out;
  }

  function computeBollinger(values: number[], period: number, mult: number) {
    const middle = computeSMA(values, period);
    const upper: (number | null)[] = [];
    const lower: (number | null)[] = [];
    for (let i = 0; i < values.length; i++) {
      if (i < period - 1 || middle[i] === null) {
        upper.push(null);
        lower.push(null);
      } else {
        let variance = 0;
        const mean = middle[i] as number;
        for (let j = i - period + 1; j <= i; j++) {
          variance += Math.pow(values[j] - mean, 2);
        }
        const std = Math.sqrt(variance / period);
        upper.push(mean + mult * std);
        lower.push(mean - mult * std);
      }
    }
    return { upper, middle, lower };
  }

  function computeVWAP(): (number | null)[] {
    // Cumulative VWAP from first visible candle (anchored to chart start)
    const out: (number | null)[] = [];
    let cumPV = 0;
    let cumV = 0;
    for (let i = 0; i < candles.length; i++) {
      const c = candles[i];
      const typical = (c.high + c.low + c.close) / 3;
      cumPV += typical * c.volume;
      cumV += c.volume;
      out.push(cumV > 0 ? cumPV / cumV : null);
    }
    return out;
  }

  function computeRSI(values: number[], period: number): (number | null)[] {
    const out: (number | null)[] = [null];
    let gainSum = 0;
    let lossSum = 0;
    for (let i = 1; i < values.length; i++) {
      const ch = values[i] - values[i - 1];
      const gain = ch > 0 ? ch : 0;
      const loss = ch < 0 ? -ch : 0;
      if (i <= period) {
        gainSum += gain;
        lossSum += loss;
        if (i === period) {
          const avgGain = gainSum / period;
          const avgLoss = lossSum / period;
          const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
          out.push(100 - 100 / (1 + rs));
        } else {
          out.push(null);
        }
      } else {
        const prevAvgGain = (out[i - 1] as number) >= 0
          ? ((out[i - 1] as number) >= 0 ? (gainSum) : 0)
          : 0;
        // Wilder smoothing
        const prevRSI = out[i - 1] as number;
        const prevAvgGain2 = gainSum / period;
        const prevAvgLoss2 = lossSum / period;
        const avgGain = (prevAvgGain2 * (period - 1) + gain) / period;
        const avgLoss = (prevAvgLoss2 * (period - 1) + loss) / period;
        gainSum = avgGain * period;
        lossSum = avgLoss * period;
        const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
        out.push(100 - 100 / (1 + rs));
        void prevRSI;
        void prevAvgGain;
      }
    }
    return out;
  }

  function computeMACD(values: number[], fast: number, slow: number, signal: number) {
    const emaFast = computeEMA(values, fast);
    const emaSlow = computeEMA(values, slow);
    const line: (number | null)[] = [];
    for (let i = 0; i < values.length; i++) {
      if (emaFast[i] === null || emaSlow[i] === null) {
        line.push(null);
      } else {
        line.push((emaFast[i] as number) - (emaSlow[i] as number));
      }
    }
    // Signal = EMA of MACD line (filter out nulls)
    const filtered: number[] = [];
    const indices: number[] = [];
    for (let i = 0; i < line.length; i++) {
      if (line[i] !== null) {
        filtered.push(line[i] as number);
        indices.push(i);
      }
    }
    const signalRaw = computeEMA(filtered, signal);
    const signalLine: (number | null)[] = new Array(line.length).fill(null);
    for (let i = 0; i < indices.length; i++) {
      signalLine[indices[i]] = signalRaw[i];
    }
    const hist: (number | null)[] = [];
    for (let i = 0; i < line.length; i++) {
      if (line[i] !== null && signalLine[i] !== null) {
        hist.push((line[i] as number) - (signalLine[i] as number));
      } else {
        hist.push(null);
      }
    }
    return { line, signal: signalLine, hist };
  }

  // ============================================================
  // Drawings (localStorage persistence)
  // ============================================================
  function drawingsKey() {
    return `nexus-chart-drawings-${symbol}-${timeframe}`;
  }

  function loadDrawings() {
    try {
      const raw = localStorage.getItem(drawingsKey());
      drawings = raw ? JSON.parse(raw) : [];
    } catch {
      drawings = [];
    }
  }

  function saveDrawings() {
    try {
      localStorage.setItem(drawingsKey(), JSON.stringify(drawings));
    } catch {}
  }

  function clearAllDrawings() {
    drawings = [];
    saveDrawings();
    render();
  }

  function removeDrawingAt(x: number, y: number) {
    // Find nearest drawing within tolerance and remove
    let removed = false;
    const tol = 8;
    drawings = drawings.filter((d) => {
      if (d.type === 'hline') {
        const price = d.pricePoints[0]?.price;
        if (price === undefined) return true;
        const yLine = priceToY(price);
        if (Math.abs(yLine - y) < tol) {
          removed = true;
          return false;
        }
        return true;
      } else if (d.type === 'trendline' && d.pricePoints.length === 2) {
        const a = { x: timeToX(d.pricePoints[0].time), y: priceToY(d.pricePoints[0].price) };
        const b = { x: timeToX(d.pricePoints[1].time), y: priceToY(d.pricePoints[1].price) };
        const dist = distToSegment({ x, y }, a, b);
        if (dist < tol) {
          removed = true;
          return false;
        }
        return true;
      } else if (d.type === 'rect' && d.pricePoints.length === 2) {
        const x1 = timeToX(d.pricePoints[0].time);
        const x2 = timeToX(d.pricePoints[1].time);
        const y1 = priceToY(d.pricePoints[0].price);
        const y2 = priceToY(d.pricePoints[1].price);
        const xMin = Math.min(x1, x2);
        const xMax = Math.max(x1, x2);
        const yMin = Math.min(y1, y2);
        const yMax = Math.max(y1, y2);
        if (x >= xMin - tol && x <= xMax + tol && y >= yMin - tol && y <= yMax + tol) {
          // Edge check
          const onEdge =
            (Math.abs(x - xMin) < tol || Math.abs(x - xMax) < tol) ||
            (Math.abs(y - yMin) < tol || Math.abs(y - yMax) < tol);
          if (onEdge) {
            removed = true;
            return false;
          }
        }
        return true;
      } else if (d.type === 'fib' && d.pricePoints.length === 2) {
        const a = { x: timeToX(d.pricePoints[0].time), y: priceToY(d.pricePoints[0].price) };
        const b = { x: timeToX(d.pricePoints[1].time), y: priceToY(d.pricePoints[1].price) };
        const dist = distToSegment({ x, y }, a, b);
        if (dist < tol) {
          removed = true;
          return false;
        }
        return true;
      }
      return true;
    });
    if (removed) {
      saveDrawings();
      render();
    }
  }

  function distToSegment(p: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    if (dx === 0 && dy === 0) return Math.hypot(p.x - a.x, p.y - a.y);
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy)));
    return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
  }

  // ============================================================
  // Layout
  // ============================================================
  let layout = {
    mainTop: 0,
    mainH: 0,
    mainBottom: 0,
    volH: 40,
    volY: 0,
    subPanels: [] as { top: number; h: number; key: string }[],
    padRight: 76,
    padBottom: 28,
    padTop: 12,
    chartW: 0
  };

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

  function computeLayout() {
    const rect = container.getBoundingClientRect();
    const W = rect.width;
    const H = rect.height;
    const padRight = 76;
    const padBottom = 28;
    const padTop = 12;
    const chartW = W - padRight;
    const subPanelHeight = 90;
    const subPanelGap = 4;
    const subPanels: { top: number; h: number; key: string }[] = [];
    let subTotal = 0;
    for (const k of subIndicators) {
      if (k === 'RSI' || k === 'MACD') {
        subPanels.push({ top: 0, h: subPanelHeight, key: k });
        subTotal += subPanelHeight + subPanelGap;
      }
    }
    const mainH = H - padTop - padBottom - subTotal;
    const mainTop = padTop;
    const volH = Math.min(50, Math.max(24, mainH * 0.18));
    const volY = mainTop + mainH - volH;
    let cursor = mainTop + mainH + subPanelGap;
    for (const p of subPanels) {
      p.top = cursor;
      cursor += p.h + subPanelGap;
    }
    layout = { mainTop, mainH, mainBottom: mainTop + mainH, volH, volY, subPanels, padRight, padBottom, padTop, chartW };
  }

  function updateVisibleRange() {
    const rect = container.getBoundingClientRect();
    const totalWidth = candleWidth + candleSpacing;
    const visibleCount = Math.max(20, Math.floor(rect.width / totalWidth));
    if (candles.length === 0) {
      visibleCandles = [];
      return;
    }
    const maxOffset = Math.max(0, candles.length - visibleCount);
    offsetX = Math.max(0, Math.min(offsetX, maxOffset));
    visibleCandles = candles.slice(offsetX, offsetX + visibleCount);
    if (visibleCandles.length === 0) return;
    // Use the appropriate source array for price range calc
    const src = chartType === 'heikin-ashi' ? heikinAshi : candles;
    const visSrc = src.slice(offsetX, offsetX + visibleCount);
    let min = Infinity;
    let max = -Infinity;
    let vMax = 0;
    for (const c of visSrc) {
      if (c.low < min) min = c.low;
      if (c.high > max) max = c.high;
      if (c.volume > vMax) vMax = c.volume;
    }
    if (indicators.includes('BOLL')) {
      for (let i = offsetX; i < offsetX + visibleCount && i < candles.length; i++) {
        if (bollUpper[i] !== null && (bollUpper[i] as number) > max) max = bollUpper[i] as number;
        if (bollLower[i] !== null && (bollLower[i] as number) < min) min = bollLower[i] as number;
      }
    }
    // Extend range to fit any drawings (so they remain visible)
    for (const d of drawings) {
      for (const pp of d.pricePoints) {
        if (pp.price < min) min = pp.price;
        if (pp.price > max) max = pp.price;
      }
    }
    // Extend range to fit markers
    for (const m of markers) {
      if (m.price < min) min = m.price;
      if (m.price > max) max = m.price;
    }
    const pad = (max - min) * 0.08;
    priceRange = { min: min - pad, max: max + pad };
    volumeMax = vMax || 1;
  }

  // ============================================================
  // Theme helpers
  // ============================================================
  function cssVar(name: string): string {
    if (typeof getComputedStyle === 'undefined') return '';
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  function themeColors() {
    const isLight = theme === 'light';
    return {
      bg: isLight ? '#ffffff' : cssVar('--bg-elev-1') || '#0a0e1f',
      grid: isLight ? 'rgba(15,23,42,0.06)' : 'rgba(255,255,255,0.04)',
      gridStrong: isLight ? 'rgba(15,23,42,0.10)' : 'rgba(255,255,255,0.08)',
      axisText: isLight ? '#94a3b8' : '#6b769c',
      axisTextStrong: isLight ? '#475569' : '#a3accd',
      up: isLight ? '#059669' : '#22d3a4',
      down: isLight ? '#e11d48' : '#f43f7a',
      upAlpha: isLight ? 'rgba(5,150,105,0.25)' : 'rgba(34,211,164,0.25)',
      downAlpha: isLight ? 'rgba(225,29,72,0.25)' : 'rgba(244,63,122,0.25)',
      gold: isLight ? '#d97706' : '#f5b544',
      purple: isLight ? '#9333ea' : '#a855f7',
      blue: isLight ? '#2563eb' : '#3b82f6',
      crosshair: isLight ? 'rgba(15,23,42,0.4)' : 'rgba(255,255,255,0.35)',
      tooltipBg: isLight ? 'rgba(255,255,255,0.95)' : 'rgba(10,14,31,0.92)',
      tooltipBorder: isLight ? 'rgba(15,23,42,0.12)' : 'rgba(255,255,255,0.10)',
      lastLine: isLight ? 'rgba(217,119,6,0.5)' : 'rgba(245,181,68,0.5)',
      panelBorder: isLight ? 'rgba(15,23,42,0.08)' : 'rgba(255,255,255,0.05)',
      drawColor: isLight ? '#d97706' : '#f5b544',
      drawColorAlt: isLight ? '#2563eb' : '#3b82f6',
      drawFill: isLight ? 'rgba(217,119,6,0.10)' : 'rgba(245,181,68,0.08)'
    };
  }

  // ============================================================
  // Render loop (RAF for smooth flash animations)
  // ============================================================
  function startRenderLoop() {
    const loop = () => {
      rafId = requestAnimationFrame(loop);
      livePricePulse = Math.max(0, livePricePulse - 0.04);
      const flashAge = performance.now() - flashAt;
      const flashActive = flashAge < 600;
      if (livePricePulse > 0 || flashActive) {
        render();
      }
    };
    rafId = requestAnimationFrame(loop);
  }

  function scheduleRender() {
    render();
  }

  // ============================================================
  // Coordinate helpers
  // ============================================================
  function priceToY(price: number): number {
    const { mainTop, mainH } = layout;
    const yScale = mainH / (priceRange.max - priceRange.min || 1);
    return mainTop + mainH - (price - priceRange.min) * yScale;
  }

  function yToPrice(y: number): number {
    const { mainTop, mainH } = layout;
    const yScale = mainH / (priceRange.max - priceRange.min || 1);
    return priceRange.max - ((y - mainTop) / mainH) * (priceRange.max - priceRange.min);
  }

  function timeToX(time: number): number {
    // Find candle index
    const idx = candles.findIndex((c) => c.time === time);
    if (idx === -1) {
      // Extrapolate by time
      const totalWidth = candleWidth + candleSpacing;
      const first = candles[0];
      const last = candles[candles.length - 1];
      if (!first || !last) return 0;
      const interval = last.time - first.time > 0 ? (last.time - first.time) / (candles.length - 1) : 1;
      const offsetIdx = (time - first.time) / interval;
      return (offsetIdx - offsetX) * totalWidth + (candleWidth + candleSpacing) / 2;
    }
    const totalWidth = candleWidth + candleSpacing;
    return (idx - offsetX) * totalWidth + (candleWidth + candleSpacing) / 2;
  }

  function xToTime(x: number): number {
    const totalWidth = candleWidth + candleSpacing;
    const idx = Math.floor(x / totalWidth) + offsetX;
    return candles[idx]?.time ?? 0;
  }

  // ============================================================
  // Main render
  // ============================================================
  function render() {
    if (!ctx || candles.length === 0) return;
    computeLayout();
    updateVisibleRange();
    const rect = container.getBoundingClientRect();
    const W = rect.width;
    const H = rect.height;
    const { mainTop, mainH, volH, volY, subPanels, padRight, chartW } = layout;

    const C = themeColors();
    const totalWidth = candleWidth + candleSpacing;

    // Background
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, W, H);

    // Subtle gradient overlay
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    if (theme !== 'light') {
      grad.addColorStop(0, 'rgba(245,181,68,0.02)');
      grad.addColorStop(1, 'rgba(34,211,164,0.015)');
    } else {
      grad.addColorStop(0, 'rgba(217,119,6,0.03)');
      grad.addColorStop(1, 'rgba(5,150,105,0.02)');
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, mainTop, chartW, mainH);

    // ---- Grid (main) ----
    ctx.strokeStyle = C.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i <= 6; i++) {
      const y = mainTop + (mainH / 6) * i;
      ctx.moveTo(0, y);
      ctx.lineTo(chartW, y);
    }
    for (let i = 0; i <= 8; i++) {
      const x = (chartW / 8) * i;
      ctx.moveTo(x, mainTop);
      ctx.lineTo(x, mainTop + mainH);
    }
    ctx.stroke();

    // ---- Volume bars ----
    for (let i = 0; i < visibleCandles.length; i++) {
      const c = visibleCandles[i];
      const x = i * totalWidth;
      const h = (c.volume / volumeMax) * volH;
      ctx.fillStyle = c.close >= c.open ? C.upAlpha : C.downAlpha;
      ctx.fillRect(x, volY + (volH - h), candleWidth, h);
    }

    // ---- Chart body (candles / HA / line / area) ----
    const src = chartType === 'heikin-ashi' ? heikinAshi : candles;
    const visSrc = src.slice(offsetX, offsetX + visibleCandles.length);
    const yScale = mainH / (priceRange.max - priceRange.min || 1);

    if (chartType === 'line' || chartType === 'area') {
      // Draw line / area of close prices
      ctx.strokeStyle = C.gold;
      ctx.lineWidth = 2;
      ctx.beginPath();
      let started = false;
      for (let i = 0; i < visSrc.length; i++) {
        const c = visSrc[i];
        const x = i * totalWidth + (candleWidth + candleSpacing) / 2;
        const y = mainTop + mainH - (c.close - priceRange.min) * yScale;
        if (!started) {
          ctx.moveTo(x, y);
          started = true;
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
      if (chartType === 'area') {
        ctx.lineTo((visSrc.length - 1) * totalWidth + (candleWidth + candleSpacing) / 2, mainTop + mainH);
        ctx.lineTo((candleWidth + candleSpacing) / 2, mainTop + mainH);
        ctx.closePath();
        const areaGrad = ctx.createLinearGradient(0, mainTop, 0, mainTop + mainH);
        areaGrad.addColorStop(0, theme === 'light' ? 'rgba(217,119,6,0.25)' : 'rgba(245,181,68,0.20)');
        areaGrad.addColorStop(1, theme === 'light' ? 'rgba(217,119,6,0.02)' : 'rgba(245,181,68,0.01)');
        ctx.fillStyle = areaGrad;
        ctx.fill();
      }
    } else {
      // Candles or Heikin-Ashi
      for (let i = 0; i < visSrc.length; i++) {
        const c = visSrc[i];
        const x = i * totalWidth + candleWidth / 2;
        const yOpen = mainTop + mainH - (c.open - priceRange.min) * yScale;
        const yClose = mainTop + mainH - (c.close - priceRange.min) * yScale;
        const yHigh = mainTop + mainH - (c.high - priceRange.min) * yScale;
        const yLow = mainTop + mainH - (c.low - priceRange.min) * yScale;
        const isUp = c.close >= c.open;
        const color = isUp ? C.up : C.down;
        // Wick
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, yHigh);
        ctx.lineTo(x, yLow);
        ctx.stroke();
        // Body
        const bodyTop = Math.min(yOpen, yClose);
        const bodyH = Math.max(1, Math.abs(yClose - yOpen));
        ctx.fillStyle = color;
        ctx.fillRect(x - candleWidth / 2, bodyTop, candleWidth, bodyH);
      }
    }

    // ---- VWAP ----
    if (indicators.includes('VWAP')) {
      ctx.strokeStyle = C.purple;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 3]);
      ctx.beginPath();
      let started = false;
      for (let i = 0; i < visibleCandles.length; i++) {
        const idx = offsetX + i;
        const v = vwap[idx];
        if (v === null || v === undefined) continue;
        const x = i * totalWidth + (candleWidth + candleSpacing) / 2;
        const y = mainTop + mainH - (v - priceRange.min) * yScale;
        if (!started) { ctx.moveTo(x, y); started = true; } else { ctx.lineTo(x, y); }
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // ---- Bollinger Bands ----
    if (indicators.includes('BOLL')) {
      drawBand(bollUpper, bollLower, bollMiddle, mainTop, mainH, totalWidth, yScale);
    }
    if (indicators.includes('SMA20')) drawLine(sma20, cfg.colors.SMA20 ?? C.gold, mainTop, mainH, totalWidth, yScale);
    if (indicators.includes('SMA50')) drawLine(sma50, cfg.colors.SMA50 ?? C.purple, mainTop, mainH, totalWidth, yScale);
    if (indicators.includes('EMA12')) drawLine(ema12, cfg.colors.EMA12 ?? C.blue, mainTop, mainH, totalWidth, yScale);
    if (indicators.includes('EMA26')) drawLine(ema26, cfg.colors.EMA26 ?? C.up, mainTop, mainH, totalWidth, yScale);

    // ---- Price alert lines ----
    drawAlertLines(mainTop, mainH, yScale, totalWidth, C);

    // ---- Trade markers ----
    drawMarkers(mainTop, mainH, yScale, totalWidth);

    // ---- Drawings ----
    drawDrawings(C);

    // ---- Active drawing preview ----
    drawActivePreview(C);

    // ---- Price axis labels (right) ----
    ctx.fillStyle = C.axisText;
    ctx.font = '11px "JetBrains Mono", ui-monospace, monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    for (let i = 0; i <= 6; i++) {
      const y = mainTop + (mainH / 6) * i;
      const price = priceRange.max - ((priceRange.max - priceRange.min) / 6) * i;
      ctx.fillText(formatPrice(price), chartW + 6, y);
    }

    // ---- Last price line + animated tag ----
    if (candles.length > 0) {
      const lastCandle = candles[candles.length - 1];
      const visibleIdx = offsetX + visibleCandles.length - 1;
      const isLastVisible = visibleIdx === candles.length - 1;
      const y = priceToY(lastCandle.close);
      lastPriceY = y;
      const lineColor = lastFlash === 'up' ? C.up : lastFlash === 'down' ? C.down : C.gold;
      ctx.strokeStyle = isLastVisible ? lineColor : C.lastLine;
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 4]);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(chartW, y);
      ctx.stroke();
      ctx.setLineDash([]);
      const tagW = padRight;
      const tagH = 18;
      ctx.fillStyle = lineColor;
      ctx.fillRect(chartW, y - tagH / 2, tagW, tagH);
      if (livePricePulse > 0) {
        ctx.strokeStyle = lineColor;
        ctx.globalAlpha = livePricePulse * 0.6;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(chartW + tagW / 2, y, 8 + (1 - livePricePulse) * 12, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      ctx.fillStyle = theme === 'light' ? '#fff' : '#050813';
      ctx.font = 'bold 11px "JetBrains Mono", ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(formatPrice(lastCandle.close), chartW + tagW / 2, y);
    }

    // ---- Crosshair + tooltip ----
    if (crosshairPos && crosshairPos.x < chartW) {
      ctx.strokeStyle = C.crosshair;
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(crosshairPos.x, mainTop);
      ctx.lineTo(crosshairPos.x, mainTop + mainH);
      ctx.moveTo(0, crosshairPos.y);
      ctx.lineTo(chartW, crosshairPos.y);
      ctx.stroke();
      ctx.setLineDash([]);
      // Price label on right axis
      if (crosshairPos.y >= mainTop && crosshairPos.y <= mainTop + mainH) {
        const price = yToPrice(crosshairPos.y);
        ctx.fillStyle = C.tooltipBg;
        ctx.fillRect(chartW, crosshairPos.y - 10, padRight, 20);
        ctx.strokeStyle = C.tooltipBorder;
        ctx.strokeRect(chartW, crosshairPos.y - 10, padRight, 20);
        ctx.fillStyle = C.axisTextStrong;
        ctx.font = 'bold 11px "JetBrains Mono", ui-monospace, monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(formatPrice(price), chartW + padRight / 2, crosshairPos.y);
      }
      // Time label on bottom
      const t = xToTime(crosshairPos.x);
      if (t) {
        const timeLabel = formatTimeLabel(t, timeframe);
        const tw = 80;
        ctx.fillStyle = C.tooltipBg;
        ctx.fillRect(crosshairPos.x - tw / 2, mainTop + mainH + 2, tw, 16);
        ctx.strokeStyle = C.tooltipBorder;
        ctx.strokeRect(crosshairPos.x - tw / 2, mainTop + mainH + 2, tw, 16);
        ctx.fillStyle = C.axisTextStrong;
        ctx.font = '10px "JetBrains Mono", ui-monospace, monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(timeLabel, crosshairPos.x, mainTop + mainH + 10);
      }
      // OHLC tooltip (top-left)
      if (hoveredCandle) {
        const c = hoveredCandle;
        const isUp = c.close >= c.open;
        const chg = ((c.close - c.open) / c.open) * 100;
        const lines = [
          { label: 'O', value: formatPrice(c.open), color: C.axisText },
          { label: 'H', value: formatPrice(c.high), color: C.axisText },
          { label: 'L', value: formatPrice(c.low), color: C.axisText },
          { label: 'C', value: formatPrice(c.close), color: isUp ? C.up : C.down },
          { label: 'Vol', value: formatCompact(c.volume), color: C.axisText },
          { label: 'Chg', value: `${chg >= 0 ? '+' : ''}${chg.toFixed(2)}%`, color: isUp ? C.up : C.down }
        ];
        ctx.font = '11px "JetBrains Mono", ui-monospace, monospace';
        const rowH = 16;
        const w = 200;
        const h = lines.length * rowH + 22;
        const tx = 10;
        const ty = mainTop + 4;
        ctx.fillStyle = C.tooltipBg;
        ctx.fillRect(tx, ty, w, h);
        ctx.strokeStyle = C.tooltipBorder;
        ctx.strokeRect(tx, ty, w, h);
        ctx.fillStyle = C.axisTextStrong;
        ctx.font = 'bold 11px "JetBrains Mono", ui-monospace, monospace';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(formatDateFull(c.time), tx + 8, ty + 6);
        ctx.font = '11px "JetBrains Mono", ui-monospace, monospace';
        lines.forEach((ln, i) => {
          const y = ty + 22 + i * rowH;
          ctx.fillStyle = C.axisText;
          ctx.textAlign = 'left';
          ctx.fillText(ln.label, tx + 8, y);
          ctx.fillStyle = ln.color;
          ctx.textAlign = 'right';
          ctx.fillText(ln.value, tx + w - 8, y);
        });
      }
    }

    // ---- Sub-panels ----
    for (const p of subPanels) {
      if (p.key === 'RSI') drawRSIPanel(p, C, totalWidth);
      else if (p.key === 'MACD') drawMACDPanel(p, C, totalWidth);
    }

    // ---- NEXUS watermark ----
    ctx.fillStyle = theme === 'light' ? 'rgba(15,23,42,0.04)' : 'rgba(255,255,255,0.025)';
    ctx.font = 'bold 28px "Inter", "Arial", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('NEXUS', chartW / 2, mainTop + mainH / 2 - 10);
    ctx.font = '10px "JetBrains Mono", ui-monospace, monospace';
    ctx.fillText(symbol, chartW / 2, mainTop + mainH / 2 + 16);
  }

  // ============================================================
  // Drawing renderers
  // ============================================================
  function drawDrawings(C: ReturnType<typeof themeColors>) {
    for (const d of drawings) {
      if (d.type === 'hline' && d.pricePoints.length >= 1) {
        const y = priceToY(d.pricePoints[0].price);
        ctx.strokeStyle = d.color;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(layout.chartW, y);
        ctx.stroke();
        // Price label on right
        ctx.fillStyle = d.color;
        ctx.fillRect(layout.chartW, y - 9, layout.padRight, 18);
        ctx.fillStyle = theme === 'light' ? '#fff' : '#050813';
        ctx.font = 'bold 10px "JetBrains Mono", ui-monospace, monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(formatPrice(d.pricePoints[0].price), layout.chartW + layout.padRight / 2, y);
      } else if (d.type === 'trendline' && d.pricePoints.length === 2) {
        const a = { x: timeToX(d.pricePoints[0].time), y: priceToY(d.pricePoints[0].price) };
        const b = { x: timeToX(d.pricePoints[1].time), y: priceToY(d.pricePoints[1].price) };
        ctx.strokeStyle = d.color;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
        // Endpoints
        ctx.fillStyle = d.color;
        ctx.beginPath();
        ctx.arc(a.x, a.y, 2.5, 0, Math.PI * 2);
        ctx.arc(b.x, b.y, 2.5, 0, Math.PI * 2);
        ctx.fill();
      } else if (d.type === 'rect' && d.pricePoints.length === 2) {
        const x1 = timeToX(d.pricePoints[0].time);
        const x2 = timeToX(d.pricePoints[1].time);
        const y1 = priceToY(d.pricePoints[0].price);
        const y2 = priceToY(d.pricePoints[1].price);
        ctx.fillStyle = d.color + '22';
        ctx.fillRect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1));
        ctx.strokeStyle = d.color;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1));
      } else if (d.type === 'fib' && d.pricePoints.length === 2) {
        const p0 = d.pricePoints[0];
        const p1 = d.pricePoints[1];
        const high = Math.max(p0.price, p1.price);
        const low = Math.min(p0.price, p1.price);
        const range = high - low;
        const levels = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
        const colors = ['#f43f7a', '#f5b544', '#22d3a4', '#a855f7', '#3b82f6', '#f5b544', '#f43f7a'];
        const xStart = Math.min(timeToX(p0.time), timeToX(p1.time));
        const xEnd = layout.chartW;
        for (let i = 0; i < levels.length; i++) {
          const lvl = levels[i];
          const price = high - range * lvl;
          const y = priceToY(price);
          ctx.strokeStyle = colors[i] + '88';
          ctx.lineWidth = 1;
          ctx.setLineDash([2, 3]);
          ctx.beginPath();
          ctx.moveTo(xStart, y);
          ctx.lineTo(xEnd, y);
          ctx.stroke();
          ctx.setLineDash([]);
          // Label
          ctx.fillStyle = colors[i];
          ctx.font = '9px "JetBrains Mono", ui-monospace, monospace';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          ctx.fillText(`${(lvl * 100).toFixed(1)}%  ${formatPrice(price)}`, xStart + 4, y - 6);
        }
      }
    }
  }

  function drawActivePreview(C: ReturnType<typeof themeColors>) {
    if (!activeDraw || !activeDraw.start || !cursorPos) return;
    const sx = activeDraw.start.x;
    const sy = activeDraw.start.y;
    const cx = cursorPos.x;
    const cy = cursorPos.y;
    ctx.strokeStyle = C.drawColor;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
    if (activeDraw.type === 'hline') {
      ctx.beginPath();
      ctx.moveTo(0, cy);
      ctx.lineTo(layout.chartW, cy);
      ctx.stroke();
    } else if (activeDraw.type === 'trendline' || activeDraw.type === 'fib') {
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(cx, cy);
      ctx.stroke();
    } else if (activeDraw.type === 'rect') {
      ctx.strokeRect(Math.min(sx, cx), Math.min(sy, cy), Math.abs(cx - sx), Math.abs(cy - sy));
    }
    ctx.setLineDash([]);
  }

  // ============================================================
  // Marker renderer
  // ============================================================
  function drawMarkers(mainTop: number, mainH: number, yScale: number, totalWidth: number) {
    for (const m of markers) {
      const idx = candles.findIndex((c) => c.time <= m.time && (candles[idx + 1]?.time ?? Infinity) > m.time);
      // Fallback: find nearest candle by time
      let i = -1;
      for (let j = 0; j < candles.length; j++) {
        if (candles[j].time <= m.time) i = j;
        else break;
      }
      if (i === -1) continue;
      const visI = i - offsetX;
      if (visI < 0 || visI >= visibleCandles.length) continue;
      const x = visI * totalWidth + (candleWidth + candleSpacing) / 2;
      const y = mainTop + mainH - (m.price - priceRange.min) * yScale;
      const color = m.side === 'BUY' ? '#22d3a4' : '#f43f7a';
      // Arrow
      ctx.fillStyle = color;
      ctx.beginPath();
      if (m.side === 'BUY') {
        // Up arrow below candle
        ctx.moveTo(x, y + 14);
        ctx.lineTo(x - 5, y + 22);
        ctx.lineTo(x + 5, y + 22);
      } else {
        // Down arrow above candle
        ctx.moveTo(x, y - 14);
        ctx.lineTo(x - 5, y - 22);
        ctx.lineTo(x + 5, y - 22);
      }
      ctx.closePath();
      ctx.fill();
      // Outline
      ctx.strokeStyle = theme === 'light' ? '#ffffff' : '#050813';
      ctx.lineWidth = 1;
      ctx.stroke();
      // Qty label
      ctx.fillStyle = color;
      ctx.font = '9px "JetBrains Mono", ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = m.side === 'BUY' ? 'top' : 'bottom';
      ctx.fillText(formatCompact(m.qty), x, m.side === 'BUY' ? y + 24 : y - 24);
    }
  }

  // ============================================================
  // Price alert lines — dashed horizontal lines with label badges
  // ============================================================
  function drawAlertLines(mainTop: number, mainH: number, yScale: number, totalWidth: number, C: ReturnType<typeof themeColors>) {
    if (!cfg.alertLines || cfg.alertLines.length === 0) return;
    const { chartW } = layout;
    const priceMin = priceRange.min;
    const priceMax = priceRange.max;

    for (const al of cfg.alertLines) {
      if (al.price < priceMin || al.price > priceMax) continue;
      const y = mainTop + mainH - (al.price - priceMin) * yScale;
      if (y < mainTop || y > mainTop + mainH) continue;
      const color = al.side === 'above' ? '#22d3a4' : '#f43f7a';
      // Dashed line across chart
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.2;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(chartW, y);
      ctx.stroke();
      ctx.setLineDash([]);
      // Label badge on the right (overlapping the price axis)
      const labelText = al.label || `≤ ${formatPrice(al.price)}`;
      ctx.font = 'bold 10px "JetBrains Mono", ui-monospace, monospace';
      const tw = ctx.measureText(labelText).width + 12;
      const bx = chartW - tw - 2;
      const by = y - 8;
      ctx.fillStyle = color;
      // Rounded rect
      const r = 4;
      ctx.beginPath();
      ctx.moveTo(bx + r, by);
      ctx.lineTo(bx + tw - r, by);
      ctx.quadraticCurveTo(bx + tw, by, bx + tw, by + r);
      ctx.lineTo(bx + tw, by + 16 - r);
      ctx.quadraticCurveTo(bx + tw, by + 16, bx + tw - r, by + 16);
      ctx.lineTo(bx + r, by + 16);
      ctx.quadraticCurveTo(bx, by + 16, bx, by + 16 - r);
      ctx.lineTo(bx, by + r);
      ctx.quadraticCurveTo(bx, by, bx + r, by);
      ctx.closePath();
      ctx.fill();
      // Label text
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(labelText, bx + tw / 2, by + 8);
      ctx.restore();
    }
  }

  // ============================================================
  // RSI sub-panel
  // ============================================================
  function drawRSIPanel(p: { top: number; h: number }, C: ReturnType<typeof themeColors>, totalWidth: number) {
    const { chartW } = layout;
    // Panel border
    ctx.strokeStyle = C.panelBorder;
    ctx.lineWidth = 1;
    ctx.strokeRect(0, p.top, chartW, p.h);
    // Background
    ctx.fillStyle = theme === 'light' ? 'rgba(15,23,42,0.02)' : 'rgba(255,255,255,0.015)';
    ctx.fillRect(0, p.top, chartW, p.h);
    // Levels 30, 50, 70
    const yFor = (v: number) => p.top + p.h - (v / 100) * p.h;
    ctx.strokeStyle = C.grid;
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 3]);
    ctx.beginPath();
    for (const lvl of [30, 50, 70]) {
      const y = yFor(lvl);
      ctx.moveTo(0, y);
      ctx.lineTo(chartW, y);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    // Labels
    ctx.fillStyle = C.axisText;
    ctx.font = '9px "JetBrains Mono", ui-monospace, monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    for (const lvl of [30, 50, 70]) {
      ctx.fillText(`${lvl}`, 4, yFor(lvl));
    }
    // RSI line
    ctx.strokeStyle = C.purple;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    let started = false;
    for (let i = 0; i < visibleCandles.length; i++) {
      const idx = offsetX + i;
      const v = rsiArr[idx];
      if (v === null || v === undefined) continue;
      const x = i * totalWidth + (candleWidth + candleSpacing) / 2;
      const y = yFor(v);
      if (!started) { ctx.moveTo(x, y); started = true; } else { ctx.lineTo(x, y); }
    }
    ctx.stroke();
    // Title
    ctx.fillStyle = C.axisTextStrong;
    ctx.font = 'bold 10px "JetBrains Mono", ui-monospace, monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    const lastRSI = rsiArr[rsiArr.length - 1];
    ctx.fillText(`RSI(${cfg.rsiPeriod}) ${lastRSI !== null && lastRSI !== undefined ? lastRSI.toFixed(2) : '--'}`, chartW - 4, p.top + 4);
  }

  // ============================================================
  // MACD sub-panel
  // ============================================================
  function drawMACDPanel(p: { top: number; h: number }, C: ReturnType<typeof themeColors>, totalWidth: number) {
    const { chartW } = layout;
    ctx.strokeStyle = C.panelBorder;
    ctx.lineWidth = 1;
    ctx.strokeRect(0, p.top, chartW, p.h);
    ctx.fillStyle = theme === 'light' ? 'rgba(15,23,42,0.02)' : 'rgba(255,255,255,0.015)';
    ctx.fillRect(0, p.top, chartW, p.h);
    // Find min/max for histogram scaling
    let hMin = Infinity;
    let hMax = -Infinity;
    for (let i = offsetX; i < offsetX + visibleCandles.length && i < macdHist.length; i++) {
      const v = macdHist[i];
      if (v === null) continue;
      if (v < hMin) hMin = v;
      if (v > hMax) hMax = v;
    }
    if (!isFinite(hMin) || !isFinite(hMax)) { hMin = -1; hMax = 1; }
    const hRange = Math.max(Math.abs(hMin), Math.abs(hMax)) * 1.2 || 1;
    const midY = p.top + p.h / 2;
    const yScale = (p.h / 2) / hRange;
    // Zero line
    ctx.strokeStyle = C.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, midY);
    ctx.lineTo(chartW, midY);
    ctx.stroke();
    // Histogram bars
    for (let i = 0; i < visibleCandles.length; i++) {
      const idx = offsetX + i;
      const v = macdHist[idx];
      if (v === null || v === undefined) continue;
      const x = i * totalWidth;
      const h = Math.abs(v) * yScale;
      ctx.fillStyle = v >= 0 ? C.upAlpha : C.downAlpha;
      ctx.fillRect(x, v >= 0 ? midY - h : midY, candleWidth, h);
    }
    // MACD line
    ctx.strokeStyle = C.blue;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    let started = false;
    for (let i = 0; i < visibleCandles.length; i++) {
      const idx = offsetX + i;
      const v = macdLine[idx];
      if (v === null || v === undefined) continue;
      const x = i * totalWidth + (candleWidth + candleSpacing) / 2;
      const y = midY - v * yScale;
      if (!started) { ctx.moveTo(x, y); started = true; } else { ctx.lineTo(x, y); }
    }
    ctx.stroke();
    // Signal line
    ctx.strokeStyle = C.gold;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    started = false;
    for (let i = 0; i < visibleCandles.length; i++) {
      const idx = offsetX + i;
      const v = macdSignal[idx];
      if (v === null || v === undefined) continue;
      const x = i * totalWidth + (candleWidth + candleSpacing) / 2;
      const y = midY - v * yScale;
      if (!started) { ctx.moveTo(x, y); started = true; } else { ctx.lineTo(x, y); }
    }
    ctx.stroke();
    // Title
    const lastMACD = macdLine[macdLine.length - 1];
    ctx.fillStyle = C.axisTextStrong;
    ctx.font = 'bold 10px "JetBrains Mono", ui-monospace, monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.fillText(`MACD(${cfg.macdFast},${cfg.macdSlow},${cfg.macdSignal}) ${lastMACD !== null && lastMACD !== undefined ? lastMACD.toFixed(4) : '--'}`, chartW - 4, p.top + 4);
  }

  function drawLine(
    values: (number | null)[],
    color: string,
    padTop: number,
    chartH: number,
    totalWidth: number,
    yScale: number
  ) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    let started = false;
    for (let i = 0; i < visibleCandles.length; i++) {
      const idx = offsetX + i;
      const v = values[idx];
      if (v === null || v === undefined) continue;
      const x = i * totalWidth + (candleWidth + candleSpacing) / 2;
      const y = padTop + chartH - (v - priceRange.min) * yScale;
      if (!started) {
        ctx.moveTo(x, y);
        started = true;
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();
  }

  function drawBand(
    upper: (number | null)[],
    lower: (number | null)[],
    middle: (number | null)[],
    padTop: number,
    chartH: number,
    totalWidth: number,
    yScale: number
  ) {
    ctx.fillStyle = theme === 'light' ? 'rgba(217,119,6,0.08)' : 'rgba(245,181,68,0.06)';
    ctx.beginPath();
    let started = false;
    for (let i = 0; i < visibleCandles.length; i++) {
      const idx = offsetX + i;
      const v = upper[idx];
      if (v === null) continue;
      const x = i * totalWidth + (candleWidth + candleSpacing) / 2;
      const y = padTop + chartH - (v - priceRange.min) * yScale;
      if (!started) { ctx.moveTo(x, y); started = true; } else { ctx.lineTo(x, y); }
    }
    for (let i = visibleCandles.length - 1; i >= 0; i--) {
      const idx = offsetX + i;
      const v = lower[idx];
      if (v === null) continue;
      const x = i * totalWidth + (candleWidth + candleSpacing) / 2;
      const y = padTop + chartH - (v - priceRange.min) * yScale;
      ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    drawLine(middle, theme === 'light' ? 'rgba(217,119,6,0.5)' : 'rgba(245,181,68,0.5)', padTop, chartH, totalWidth, yScale);
  }

  // ============================================================
  // Helpers
  // ============================================================
  function formatPrice(n: number): string {
    if (!isFinite(n)) return '--';
    if (n >= 1000) return n.toLocaleString('en-US', { maximumFractionDigits: 2 });
    if (n >= 1) return n.toFixed(2);
    if (n >= 0.01) return n.toFixed(4);
    return n.toFixed(6);
  }

  function formatCompact(n: number): string {
    if (!isFinite(n)) return '--';
    if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(2) + 'K';
    return n.toFixed(2);
  }

  function formatTimeLabel(ms: number, tf: string): string {
    const d = new Date(ms);
    if (tf === '1m' || tf === '5m' || tf === '15m' || tf === '1H' || tf === '4H') {
      return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
    }
    return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}`;
  }

  function formatDateFull(ms: number): string {
    const d = new Date(ms);
    return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  }

  function pad2(n: number): string {
    return n.toString().padStart(2, '0');
  }

  // ============================================================
  // Mouse + touch interactions
  // ============================================================
  function onMouseMove(e: MouseEvent) {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    cursorPos = { x, y };
    // Don't show crosshair when in drawing mode (except cursor)
    if (currentTool === 'cursor') {
      crosshairPos = { x, y };
    } else {
      crosshairPos = null;
    }

    if (isDragging && currentTool === 'cursor') {
      const dx = e.clientX - lastDragX;
      const totalWidth = candleWidth + candleSpacing;
      const shift = Math.round(dx / totalWidth);
      if (shift !== 0) {
        const maxOffset = Math.max(0, candles.length - visibleCandles.length);
        offsetX = Math.max(0, Math.min(maxOffset, offsetX - shift));
        lastDragX = e.clientX;
        updateVisibleRange();
      }
    }

    const totalWidth = candleWidth + candleSpacing;
    const idx = Math.floor(x / totalWidth);
    if (idx >= 0 && idx < visibleCandles.length) {
      hoveredCandle = visibleCandles[idx];
    } else {
      hoveredCandle = null;
    }
    render();
  }

  function onMouseDown(e: MouseEvent) {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    if (currentTool === 'cursor') {
      isDragging = true;
      lastDragX = e.clientX;
      canvas.style.cursor = 'grabbing';
    } else if (currentTool === 'eraser') {
      removeDrawingAt(x, y);
    } else if (currentTool === 'hline') {
      // Single-click: place horizontal line at price
      const price = yToPrice(y);
      drawings.push({
        id: `d${Date.now()}`,
        type: 'hline',
        points: [{ x, y }],
        pricePoints: [{ price, time: xToTime(x) }],
        color: theme === 'light' ? '#d97706' : '#f5b544',
        createdAt: Date.now()
      });
      saveDrawings();
      render();
    } else {
      // Start multi-point draw (trendline, rect, fib)
      activeDraw = { type: currentTool, start: { x, y } };
    }
  }

  function onMouseUp(e: MouseEvent) {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    isDragging = false;
    canvas.style.cursor = currentTool === 'cursor' ? 'crosshair' : currentTool === 'eraser' ? 'cell' : 'crosshair';
    if (activeDraw && activeDraw.start) {
      const sx = activeDraw.start.x;
      const sy = activeDraw.start.y;
      if (Math.hypot(x - sx, y - sy) > 5) {
        const type = activeDraw.type;
        if (type === 'trendline' || type === 'rect' || type === 'fib') {
          const drawingType: 'trendline' | 'rect' | 'fib' = type;
          drawings.push({
            id: `d${Date.now()}`,
            type: drawingType,
            points: [{ x: sx, y: sy }, { x, y }],
            pricePoints: [
              { price: yToPrice(sy), time: xToTime(sx) },
              { price: yToPrice(y), time: xToTime(x) }
            ],
            color: type === 'fib'
              ? (theme === 'light' ? '#2563eb' : '#3b82f6')
              : (theme === 'light' ? '#d97706' : '#f5b544'),
            createdAt: Date.now()
          });
          saveDrawings();
        }
      }
      activeDraw = null;
      render();
    }
  }

  function onMouseLeave() {
    crosshairPos = null;
    hoveredCandle = null;
    isDragging = false;
    activeDraw = null;
    canvas.style.cursor = currentTool === 'cursor' ? 'crosshair' : currentTool === 'eraser' ? 'cell' : 'crosshair';
    render();
  }

  function onWheel(e: WheelEvent) {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      const delta = e.deltaY > 0 ? -2 : 2;
      candleWidth = Math.max(2, Math.min(24, candleWidth + delta));
    } else {
      const delta = e.deltaY > 0 ? 3 : -3;
      const maxOffset = Math.max(0, candles.length - visibleCandles.length);
      offsetX = Math.max(0, Math.min(maxOffset, offsetX + delta));
    }
    updateVisibleRange();
    render();
  }

  // ---- Touch (pinch + pan) ----
  function onTouchStart(e: TouchEvent) {
    if (e.touches.length === 1) {
      const rect = canvas.getBoundingClientRect();
      const x = e.touches[0].clientX - rect.left;
      const y = e.touches[0].clientY - rect.top;
      if (currentTool === 'cursor') {
        isDragging = true;
        lastDragX = e.touches[0].clientX;
      } else if (currentTool === 'hline') {
        const price = yToPrice(y);
        drawings.push({
          id: `d${Date.now()}`,
          type: 'hline',
          points: [{ x, y }],
          pricePoints: [{ price, time: xToTime(x) }],
          color: theme === 'light' ? '#d97706' : '#f5b544',
          createdAt: Date.now()
        });
        saveDrawings();
        render();
      } else {
        activeDraw = { type: currentTool, start: { x, y } };
      }
    } else if (e.touches.length === 2) {
      isDragging = false;
      pinchDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
    }
  }

  function onTouchMove(e: TouchEvent) {
    e.preventDefault();
    if (e.touches.length === 1) {
      const rect = canvas.getBoundingClientRect();
      const x = e.touches[0].clientX - rect.left;
      const y = e.touches[0].clientY - rect.top;
      cursorPos = { x, y };
      if (isDragging && currentTool === 'cursor') {
        const dx = e.touches[0].clientX - lastDragX;
        const totalWidth = candleWidth + candleSpacing;
        const shift = Math.round(dx / totalWidth);
        if (shift !== 0) {
          const maxOffset = Math.max(0, candles.length - visibleCandles.length);
          offsetX = Math.max(0, Math.min(maxOffset, offsetX - shift));
          lastDragX = e.touches[0].clientX;
          updateVisibleRange();
          render();
        }
      } else if (activeDraw && activeDraw.start) {
        render();
      }
    } else if (e.touches.length === 2) {
      const newDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const delta = newDist - pinchDist;
      candleWidth = Math.max(2, Math.min(24, candleWidth + delta * 0.05));
      pinchDist = newDist;
      updateVisibleRange();
      render();
    }
  }

  function onTouchEnd(e: TouchEvent) {
    if (activeDraw && e.touches.length === 0) {
      // Finalize draw using last cursor pos
      if (cursorPos && activeDraw.start) {
        const sx = activeDraw.start.x;
        const sy = activeDraw.start.y;
        const cx = cursorPos.x;
        const cy = cursorPos.y;
        if (Math.hypot(cx - sx, cy - sy) > 5) {
          const type = activeDraw.type;
          if (type === 'trendline' || type === 'rect' || type === 'fib') {
            const drawingType: 'trendline' | 'rect' | 'fib' = type;
            drawings.push({
              id: `d${Date.now()}`,
              type: drawingType,
              points: [{ x: sx, y: sy }, { x: cx, y: cy }],
              pricePoints: [
                { price: yToPrice(sy), time: xToTime(sx) },
                { price: yToPrice(cy), time: xToTime(cx) }
              ],
              color: type === 'fib'
                ? (theme === 'light' ? '#2563eb' : '#3b82f6')
                : (theme === 'light' ? '#d97706' : '#f5b544'),
              createdAt: Date.now()
            });
            saveDrawings();
          }
        }
      }
      activeDraw = null;
      render();
    }
    isDragging = false;
    pinchDist = 0;
  }

  // ============================================================
  // Public actions
  // ============================================================
  function zoomIn() {
    candleWidth = Math.min(24, candleWidth + 2);
    updateVisibleRange();
    render();
  }

  function zoomOut() {
    candleWidth = Math.max(2, candleWidth - 2);
    updateVisibleRange();
    render();
  }

  function resetView() {
    offsetX = Math.max(0, candles.length - visibleCandles.length);
    candleWidth = 8;
    updateVisibleRange();
    render();
  }

  function goLive() {
    const rect = container.getBoundingClientRect();
    const totalWidth = candleWidth + candleSpacing;
    const visibleCount = Math.max(20, Math.floor(rect.width / totalWidth));
    offsetX = Math.max(0, candles.length - visibleCount);
    updateVisibleRange();
    render();
  }

  function exportPng() {
    const link = document.createElement('a');
    link.download = `NEXUS_${symbol}_${timeframe}_${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }

  function clearDrawings() {
    clearAllDrawings();
  }
</script>

<div
  bind:this={container}
  class="relative w-full overflow-hidden"
  style="height: {height}px; background: var(--bg-elev-1);"
>
  <canvas
    bind:this={canvas}
    class="absolute inset-0 cursor-crosshair touch-none"
    onmousemove={onMouseMove}
    onmousedown={onMouseDown}
    onmouseup={onMouseUp}
    onmouseleave={onMouseLeave}
    onwheel={(e) => {
      e.preventDefault();
      onWheel(e);
    }}
    ontouchstart={onTouchStart}
    ontouchmove={onTouchMove}
    ontouchend={onTouchEnd}
    aria-label="مخطط NEXUS لـ {symbol}"
  ></canvas>

  <!-- "LIVE" indicator (top-right) -->
  <div
    class="absolute top-2 right-2 flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold pointer-events-none"
    style="background: var(--bg-ink-900-80); color: var(--accent-mint); border: 1px solid var(--border-white-10);"
  >
    <span class="w-1.5 h-1.5 rounded-full bg-accent-mint animate-pulse"></span>
    LIVE
  </div>

  <!-- Active tool indicator (bottom-left) -->
  {#if currentTool !== 'cursor'}
    <div
      class="absolute bottom-2 left-2 flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-medium pointer-events-none"
      style="background: var(--bg-ink-900-80); color: var(--accent-gold); border: 1px solid var(--border-white-10);"
    >
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        {#if currentTool === 'hline'}
          <path d="M4 12h16" />
        {:else if currentTool === 'trendline'}
          <path d="M4 20L20 4" />
        {:else if currentTool === 'rect'}
          <rect x="4" y="6" width="16" height="12" rx="1" />
        {:else if currentTool === 'fib'}
          <path d="M4 4h16M4 9h16M4 14h16M4 19h16" />
        {:else if currentTool === 'eraser'}
          <path d="M16 4L4 16l4 4h8l4-4-4-12z" />
        {/if}
      </svg>
      {currentTool === 'hline' ? 'خط أفقي' :
       currentTool === 'trendline' ? 'خط اتجاه' :
       currentTool === 'rect' ? 'منطقة' :
       currentTool === 'fib' ? 'فيبوناتشي' :
       currentTool === 'eraser' ? 'ممحاة' : currentTool}
    </div>
  {/if}
</div>

<style>
  :global([data-theme='light']) canvas {
    -webkit-font-smoothing: antialiased;
  }
</style>
