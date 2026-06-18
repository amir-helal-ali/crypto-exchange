"use client";

import {
  useEffect,
  useRef,
  useCallback,
  useState,
  forwardRef,
  useImperativeHandle,
} from "react";
import {
  Drawing,
  DrawingTool,
  drawDrawing,
  hitTestDrawing,
  genDrawingId,
  CoordConverter,
  Point,
} from "@/components/exchange/drawings";

/* ═══════════════════════════════════════════
   Types
   ═══════════════════════════════════════════ */

export interface Candle {
  time: number; // unix seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface ChartIndicators {
  sma20: boolean;
  ema50: boolean;
  bollinger: boolean;
  rsi: boolean;
  macd: boolean;
  vwap: boolean;
  stochastic: boolean;
  volume: boolean;
}

export type ChartType = "candles" | "line" | "area";

export interface ProChartProps {
  candles: Candle[];
  onCrosshairMove?: (data: {
    candle: Candle | null;
    x: number;
    y: number;
  } | null) => void;
  height?: number;
  className?: string;
  chartType?: ChartType;
  indicators?: ChartIndicators;
  /* Drawing tools */
  activeTool?: DrawingTool;
  drawings?: Drawing[];
  onDrawingsChange?: (drawings: Drawing[]) => void;
  drawingColor?: string;
}

export interface ProChartHandle {
  updateLastCandle: (candle: Candle) => void;
  addCandle: (candle: Candle) => void;
  exportPng: (filename?: string) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetView: () => void;
}

/* ═══════════════════════════════════════════
   Constants
   ═══════════════════════════════════════════ */

const COLORS = {
  bg: "#0a0e17",
  grid: "rgba(255,255,255,0.03)",
  gridText: "rgba(255,255,255,0.3)",
  crosshair: "rgba(255,255,255,0.2)",
  crosshairLabel: "#1a1f2e",
  crosshairText: "#e2e8f0",
  upCandle: "#00c087",
  upCandleFill: "#00c087",
  downCandle: "#f6465d",
  downCandleFill: "#f6465d",
  upVolume: "rgba(0,192,135,0.25)",
  downVolume: "rgba(246,70,93,0.25)",
  sma20: "#f0b90b",
  ema50: "#8b5cf6",
  bollingerUpper: "rgba(59,130,246,0.5)",
  bollingerLower: "rgba(59,130,246,0.5)",
  bollingerFill: "rgba(59,130,246,0.05)",
  bollingerMid: "rgba(59,130,246,0.3)",
  vwap: "#ec4899",
  vwapFill: "rgba(236,72,153,0.08)",
  rsiLine: "#06b6d4",
  rsiOverbought: "rgba(246,70,93,0.4)",
  rsiOversold: "rgba(0,192,135,0.4)",
  rsiMid: "rgba(255,255,255,0.15)",
  stochK: "#a855f7",
  stochD: "#f0b90b",
  stochOverbought: "rgba(246,70,93,0.4)",
  stochOversold: "rgba(0,192,135,0.4)",
  stochMid: "rgba(255,255,255,0.15)",
  macdLine: "#3b82f6",
  macdSignal: "#f97316",
  macdHistUp: "rgba(0,192,135,0.5)",
  macdHistDown: "rgba(246,70,93,0.5)",
  lineChart: "#06b6d4",
  areaChartFill: "rgba(6,182,212,0.15)",
  currentPriceUp: "#00c087",
  currentPriceDown: "#f6465d",
  currentPriceLabel: "#0a0e17",
  wickUp: "#00c087",
  wickDown: "#f6465d",
};

const CHART_PADDING = { top: 16, right: 72, bottom: 28, left: 8 };
const MIN_CANDLE_WIDTH = 3;
const MAX_CANDLE_WIDTH = 40;
const DEFAULT_CANDLE_WIDTH = 9;
const CANDLE_GAP = 2;
const SUBCHART_HEIGHT = 90; // height of each subchart (RSI/MACD)
const SUBCHART_GAP = 6;
const VOLUME_RATIO = 0.18;

/* ═══════════════════════════════════════════
   Utility Functions
   ═══════════════════════════════════════════ */

function formatPrice(price: number): string {
  if (price >= 10000) return price.toFixed(1);
  if (price >= 100) return price.toFixed(2);
  if (price >= 1) return price.toFixed(3);
  if (price >= 0.01) return price.toFixed(5);
  return price.toFixed(8);
}

function formatTime(unix: number, showDate: boolean): string {
  const d = new Date(unix * 1000);
  const h = d.getHours().toString().padStart(2, "0");
  const m = d.getMinutes().toString().padStart(2, "0");
  if (showDate) {
    const month = (d.getMonth() + 1).toString().padStart(2, "0");
    const day = d.getDate().toString().padStart(2, "0");
    return `${month}/${day} ${h}:${m}`;
  }
  return `${h}:${m}`;
}

function computeSMA(candles: Candle[], period: number): (number | null)[] {
  const result: (number | null)[] = [];
  for (let i = 0; i < candles.length; i++) {
    if (i < period - 1) {
      result.push(null);
    } else {
      let sum = 0;
      for (let j = i - period + 1; j <= i; j++) sum += candles[j].close;
      result.push(sum / period);
    }
  }
  return result;
}

function computeEMA(candles: Candle[], period: number): (number | null)[] {
  const result: (number | null)[] = [];
  const k = 2 / (period + 1);
  let ema: number | null = null;
  for (let i = 0; i < candles.length; i++) {
    if (i < period - 1) {
      result.push(null);
    } else if (i === period - 1) {
      let sum = 0;
      for (let j = 0; j < period; j++) sum += candles[j].close;
      ema = sum / period;
      result.push(ema);
    } else {
      ema = candles[i].close * k + ema! * (1 - k);
      result.push(ema);
    }
  }
  return result;
}

/* Bollinger Bands: middle = SMA(20), upper/lower = mid ± 2*stddev */
function computeBollinger(
  candles: Candle[],
  period: number = 20,
  mult: number = 2
): { mid: (number | null)[]; upper: (number | null)[]; lower: (number | null)[] } {
  const mid = computeSMA(candles, period);
  const upper: (number | null)[] = [];
  const lower: (number | null)[] = [];
  for (let i = 0; i < candles.length; i++) {
    if (i < period - 1) {
      upper.push(null);
      lower.push(null);
    } else {
      let sum = 0;
      for (let j = i - period + 1; j <= i; j++) sum += candles[j].close;
      const mean = sum / period;
      let variance = 0;
      for (let j = i - period + 1; j <= i; j++) {
        const diff = candles[j].close - mean;
        variance += diff * diff;
      }
      const std = Math.sqrt(variance / period);
      upper.push(mean + mult * std);
      lower.push(mean - mult * std);
    }
  }
  return { mid, upper, lower };
}

/* RSI: 14-period, Wilder's smoothing */
function computeRSI(candles: Candle[], period: number = 14): (number | null)[] {
  const result: (number | null)[] = [];
  if (candles.length < period + 1) {
    return candles.map(() => null);
  }
  let avgGain = 0;
  let avgLoss = 0;
  // Initial averages
  for (let i = 1; i <= period; i++) {
    const diff = candles[i].close - candles[i - 1].close;
    if (diff >= 0) avgGain += diff;
    else avgLoss -= diff;
  }
  avgGain /= period;
  avgLoss /= period;
  for (let i = 0; i < candles.length; i++) {
    if (i < period) {
      result.push(null);
    } else if (i === period) {
      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      result.push(100 - 100 / (1 + rs));
    } else {
      const diff = candles[i].close - candles[i - 1].close;
      const gain = diff >= 0 ? diff : 0;
      const loss = diff < 0 ? -diff : 0;
      avgGain = (avgGain * (period - 1) + gain) / period;
      avgLoss = (avgLoss * (period - 1) + loss) / period;
      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      result.push(100 - 100 / (1 + rs));
    }
  }
  return result;
}

/* MACD: EMA(12) - EMA(26), signal = EMA(9) of MACD, hist = MACD - signal */
function computeMACD(
  candles: Candle[]
): { macd: (number | null)[]; signal: (number | null)[]; hist: (number | null)[] } {
  const ema12 = computeEMA(candles, 12);
  const ema26 = computeEMA(candles, 26);
  const macd: (number | null)[] = [];
  for (let i = 0; i < candles.length; i++) {
    if (ema12[i] === null || ema26[i] === null) {
      macd.push(null);
    } else {
      macd.push(ema12[i]! - ema26[i]!);
    }
  }
  // Signal = EMA(9) of MACD values (only non-null portion)
  const signal: (number | null)[] = [];
  const period = 9;
  const k = 2 / (period + 1);
  let prevSignal: number | null = null;
  let startIdx = -1;
  for (let i = 0; i < macd.length; i++) {
    if (macd[i] === null) {
      signal.push(null);
      continue;
    }
    startIdx = i;
    break;
  }
  if (startIdx === -1) {
    return { macd, signal, hist: macd.map(() => null) };
  }
  // SMA seed for first `period` MACD values
  for (let i = 0; i < macd.length; i++) {
    if (macd[i] === null) {
      signal.push(null);
      continue;
    }
    if (i < startIdx + period - 1) {
      signal.push(null);
    } else if (i === startIdx + period - 1) {
      let sum = 0;
      for (let j = i - period + 1; j <= i; j++) sum += macd[j]!;
      prevSignal = sum / period;
      signal.push(prevSignal);
    } else {
      prevSignal = macd[i]! * k + prevSignal! * (1 - k);
      signal.push(prevSignal);
    }
  }
  const hist: (number | null)[] = macd.map((m, i) => {
    if (m === null || signal[i] === null) return null;
    return m - signal[i]!;
  });
  return { macd, signal, hist };
}

function niceScale(min: number, max: number, ticks: number): number[] {
  const range = max - min;
  if (range === 0) return [min];
  const roughStep = range / ticks;
  const mag = Math.pow(10, Math.floor(Math.log10(roughStep)));
  const residual = roughStep / mag;
  let niceStep: number;
  if (residual <= 1.5) niceStep = 1 * mag;
  else if (residual <= 3) niceStep = 2 * mag;
  else if (residual <= 7) niceStep = 5 * mag;
  else niceStep = 10 * mag;
  const niceMin = Math.floor(min / niceStep) * niceStep;
  const niceMax = Math.ceil(max / niceStep) * niceStep;
  const values: number[] = [];
  for (let v = niceMin; v <= niceMax; v += niceStep) values.push(v);
  return values;
}

/* VWAP: cumulative (typical_price * volume) / cumulative volume.
   Typical price = (high + low + close) / 3.
   Standard convention: reset daily; here we compute session VWAP for visible window. */
function computeVWAP(candles: Candle[]): (number | null)[] {
  const result: (number | null)[] = [];
  let cumPV = 0;
  let cumV = 0;
  let currentDay: number | null = null;
  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    const day = Math.floor(c.time / 86400); // unix day
    if (currentDay === null || day !== currentDay) {
      // Reset on new day
      cumPV = 0;
      cumV = 0;
      currentDay = day;
    }
    const typical = (c.high + c.low + c.close) / 3;
    cumPV += typical * c.volume;
    cumV += c.volume;
    if (cumV > 0) {
      result.push(cumPV / cumV);
    } else {
      result.push(null);
    }
  }
  return result;
}

/* Stochastic Oscillator: %K = (close - lowest_low(n)) / (highest_high(n) - lowest_low(n)) * 100
   %D = SMA(3) of %K. Default period: 14,3,3. */
function computeStochastic(
  candles: Candle[],
  kPeriod: number = 14,
  dPeriod: number = 3
): { k: (number | null)[]; d: (number | null)[] } {
  const k: (number | null)[] = [];
  for (let i = 0; i < candles.length; i++) {
    if (i < kPeriod - 1) {
      k.push(null);
      continue;
    }
    let lowestLow = Infinity;
    let highestHigh = -Infinity;
    for (let j = i - kPeriod + 1; j <= i; j++) {
      if (candles[j].low < lowestLow) lowestLow = candles[j].low;
      if (candles[j].high > highestHigh) highestHigh = candles[j].high;
    }
    const range = highestHigh - lowestLow;
    if (range === 0) {
      k.push(50);
    } else {
      k.push(((candles[i].close - lowestLow) / range) * 100);
    }
  }
  // %D = SMA(dPeriod) of %K
  const d: (number | null)[] = [];
  for (let i = 0; i < k.length; i++) {
    if (i < dPeriod - 1 || k[i] == null) {
      d.push(null);
      continue;
    }
    let sum = 0;
    let valid = true;
    for (let j = i - dPeriod + 1; j <= i; j++) {
      if (k[j] == null) {
        valid = false;
        break;
      }
      sum += k[j]!;
    }
    d.push(valid ? sum / dPeriod : null);
  }
  return { k, d };
}

/* ═══════════════════════════════════════════
   ProChart Component
   ═══════════════════════════════════════════ */

const DEFAULT_INDICATORS: ChartIndicators = {
  sma20: true,
  ema50: true,
  bollinger: false,
  rsi: false,
  macd: false,
  vwap: false,
  stochastic: false,
  volume: true,
};

const ProChart = forwardRef<ProChartHandle, ProChartProps>(
  (
    {
      candles,
      onCrosshairMove,
      height = 520,
      className = "",
      chartType = "candles",
      indicators = DEFAULT_INDICATORS,
      activeTool = "cursor",
      drawings = [],
      onDrawingsChange,
      drawingColor = "#f0b90b",
    },
    ref
  ) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const candlesRef = useRef<Candle[]>(candles);
    const indicatorsRef = useRef<ChartIndicators>(indicators);
    const chartTypeRef = useRef<ChartType>(chartType);
    const activeToolRef = useRef<DrawingTool>(activeTool);
    const drawingsRef = useRef<Drawing[]>(drawings);
    const drawingColorRef = useRef<string>(drawingColor);
    const draftDrawingRef = useRef<Drawing | null>(null);
    const convRef = useRef<CoordConverter | null>(null);
    const animFrameRef = useRef<number>(0);
    const [canvasSize, setCanvasSize] = useState({ w: 800, h: height });

    /* View state */
    const viewRef = useRef({
      offsetX: 0,
      candleWidth: DEFAULT_CANDLE_WIDTH,
      isDragging: false,
      dragStartX: 0,
      dragStartOffset: 0,
      crosshair: { x: -1, y: -1, active: false },
      sma20: [] as (number | null)[],
      ema50: [] as (number | null)[],
      bollinger: {
        mid: [] as (number | null)[],
        upper: [] as (number | null)[],
        lower: [] as (number | null)[],
      },
      vwap: [] as (number | null)[],
      rsi: [] as (number | null)[],
      macd: {
        macd: [] as (number | null)[],
        signal: [] as (number | null)[],
        hist: [] as (number | null)[],
      },
      stoch: {
        k: [] as (number | null)[],
        d: [] as (number | null)[],
      },
    });

    /* Keep refs in sync */
    useEffect(() => {
      indicatorsRef.current = indicators;
    }, [indicators]);
    useEffect(() => {
      chartTypeRef.current = chartType;
      requestRender();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [chartType]);
    useEffect(() => {
      activeToolRef.current = activeTool;
    }, [activeTool]);
    useEffect(() => {
      drawingsRef.current = drawings;
      requestRender();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [drawings]);
    useEffect(() => {
      drawingColorRef.current = drawingColor;
    }, [drawingColor]);

    /* Recompute indicators when candles change */
    const recomputeIndicators = useCallback((arr: Candle[]) => {
      const v = viewRef.current;
      v.sma20 = computeSMA(arr, 20);
      v.ema50 = computeEMA(arr, 50);
      v.bollinger = computeBollinger(arr, 20, 2);
      v.vwap = computeVWAP(arr);
      v.rsi = computeRSI(arr, 14);
      v.macd = computeMACD(arr);
      v.stoch = computeStochastic(arr, 14, 3);
    }, []);

    /* Keep candles ref in sync */
    useEffect(() => {
      candlesRef.current = candles;
      recomputeIndicators(candles);
      /* Auto-fit: scroll to show latest candles */
      if (candles.length > 0) {
        const step = viewRef.current.candleWidth + CANDLE_GAP;
        const chartW = canvasSize.w - CHART_PADDING.left - CHART_PADDING.right;
        const totalW = candles.length * step;
        if (totalW <= chartW) {
          viewRef.current.offsetX = 0;
        } else {
          viewRef.current.offsetX = totalW - chartW;
        }
      }
      requestRender();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [candles]);

    /* Imperative handle for real-time updates */
    useImperativeHandle(ref, () => ({
      updateLastCandle(candle: Candle) {
        const arr = candlesRef.current;
        if (arr.length === 0) return;
        const last = arr[arr.length - 1];
        if (last.time === candle.time) {
          arr[arr.length - 1] = candle;
        } else {
          arr.push(candle);
          // auto-scroll to latest
          const totalW =
            arr.length * (viewRef.current.candleWidth + CANDLE_GAP);
          const chartW = canvasSize.w - CHART_PADDING.left - CHART_PADDING.right;
          if (totalW < chartW) {
            viewRef.current.offsetX = 0;
          } else {
            viewRef.current.offsetX = totalW - chartW;
          }
        }
        recomputeIndicators(arr);
        requestRender();
      },
      addCandle(candle: Candle) {
        candlesRef.current.push(candle);
        recomputeIndicators(candlesRef.current);
        requestRender();
      },
      exportPng(filename?: string) {
        const canvas = canvasRef.current;
        if (!canvas) return;
        try {
          // Render one extra frame to ensure crosshair/drawings are current
          requestRender();
          // Use toDataURL on the actual canvas (already has dark background)
          const dataUrl = canvas.toDataURL("image/png");
          const a = document.createElement("a");
          a.href = dataUrl;
          a.download = filename || `chart_${Date.now()}.png`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        } catch (e) {
          console.error("Failed to export chart PNG:", e);
        }
      },
      zoomIn() {
        const v = viewRef.current;
        const newW = Math.min(MAX_CANDLE_WIDTH, v.candleWidth * 1.3);
        if (newW !== v.candleWidth) {
          v.candleWidth = newW;
          requestRender();
        }
      },
      zoomOut() {
        const v = viewRef.current;
        const newW = Math.max(MIN_CANDLE_WIDTH, v.candleWidth / 1.3);
        if (newW !== v.candleWidth) {
          v.candleWidth = newW;
          // Auto-scroll to keep latest visible
          const arr = candlesRef.current;
          const totalW =
            arr.length * (newW + CANDLE_GAP);
          const chartW = canvasSize.w - CHART_PADDING.left - CHART_PADDING.right;
          if (totalW < chartW) {
            v.offsetX = 0;
          } else {
            v.offsetX = totalW - chartW;
          }
          requestRender();
        }
      },
      resetView() {
        const v = viewRef.current;
        v.candleWidth = DEFAULT_CANDLE_WIDTH;
        const arr = candlesRef.current;
        const totalW =
          arr.length * (v.candleWidth + CANDLE_GAP);
        const chartW = canvasSize.w - CHART_PADDING.left - CHART_PADDING.right;
        if (totalW < chartW) {
          v.offsetX = 0;
        } else {
          v.offsetX = totalW - chartW;
        }
        requestRender();
      },
    }));

    /* ──── Resize with ResizeObserver ──── */
    useEffect(() => {
      const handleResize = () => {
        if (containerRef.current) {
          const w = containerRef.current.clientWidth;
          const h = height || containerRef.current.clientHeight || 400;
          setCanvasSize({ w, h });
        }
      };
      handleResize();
      window.addEventListener("resize", handleResize);

      let observer: ResizeObserver | null = null;
      if (containerRef.current && typeof ResizeObserver !== "undefined") {
        observer = new ResizeObserver(() => handleResize());
        observer.observe(containerRef.current);
      }

      return () => {
        window.removeEventListener("resize", handleResize);
        observer?.disconnect();
      };
    }, [height]);

    /* ──── Render ──── */
    const requestRender = useCallback(() => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = requestAnimationFrame(render);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [canvasSize]);

    useEffect(() => {
      requestRender();
    }, [canvasSize, requestRender, indicators, chartType]);

    /* Calculate subchart layout */
    function getLayout(h: number) {
      const inds = indicatorsRef.current;
      const subCount = (inds.rsi ? 1 : 0) + (inds.macd ? 1 : 0) + (inds.stochastic ? 1 : 0);
      const subH = subCount > 0 ? SUBCHART_HEIGHT : 0;
      const totalSubH = subCount * subH + (subCount > 0 ? subCount * SUBCHART_GAP : 0);
      const mainH = h - CHART_PADDING.top - CHART_PADDING.bottom - totalSubH;
      const mainTop = CHART_PADDING.top;
      const mainBot = mainTop + mainH;
      const volH = inds.volume ? mainH * VOLUME_RATIO : 0;
      const volT = mainBot - volH;
      const priceH = mainH - volH;

      const subcharts: { top: number; bottom: number; height: number; type: "rsi" | "macd" | "stoch" }[] = [];
      let curY = mainBot + SUBCHART_GAP;
      if (inds.rsi) {
        subcharts.push({ top: curY, bottom: curY + subH, height: subH, type: "rsi" });
        curY += subH + SUBCHART_GAP;
      }
      if (inds.macd) {
        subcharts.push({ top: curY, bottom: curY + subH, height: subH, type: "macd" });
        curY += subH + SUBCHART_GAP;
      }
      if (inds.stochastic) {
        subcharts.push({ top: curY, bottom: curY + subH, height: subH, type: "stoch" });
      }
      return { mainTop, mainBot, mainH, priceH, volT, volH, subcharts };
    }

    function render() {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const dpr = window.devicePixelRatio || 1;
      const w = canvasSize.w;
      const h = canvasSize.h;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = w + "px";
      canvas.style.height = h + "px";
      const ctx = canvas.getContext("2d")!;
      ctx.scale(dpr, dpr);

      const arr = candlesRef.current;
      const v = viewRef.current;
      const inds = indicatorsRef.current;
      const cType = chartTypeRef.current;

      /* Clear */
      ctx.fillStyle = COLORS.bg;
      ctx.fillRect(0, 0, w, h);

      if (arr.length === 0) {
        ctx.fillStyle = COLORS.gridText;
        ctx.font = "13px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("جاري تحميل البيانات...", w / 2, h / 2);
        return;
      }

      const layout = getLayout(h);
      const chartL = CHART_PADDING.left;
      const chartR = w - CHART_PADDING.right;
      const chartT = layout.mainTop;
      const chartB = layout.mainBot;
      const chartW = chartR - chartL;
      const priceH = layout.priceH;
      const volT = layout.volT;
      const volH = layout.volH;

      const candleW = v.candleWidth;
      const step = candleW + CANDLE_GAP;

      /* Determine visible range */
      const startIdx = Math.max(0, Math.floor(v.offsetX / step));
      const endIdx = Math.min(
        arr.length,
        Math.ceil((v.offsetX + chartW) / step) + 1
      );
      const visible = arr.slice(startIdx, endIdx);

      if (visible.length === 0) return;

      /* Price range */
      let minPrice = Infinity,
        maxPrice = -Infinity;
      let maxVol = 0;
      for (const c of visible) {
        if (c.low < minPrice) minPrice = c.low;
        if (c.high > maxPrice) maxPrice = c.high;
        if (c.volume > maxVol) maxVol = c.volume;
      }
      /* Include MA / Bollinger / VWAP values in range */
      const smaArr = v.sma20;
      const emaArr = v.ema50;
      const boll = v.bollinger;
      const vwapArr = v.vwap;
      for (let i = startIdx; i < endIdx; i++) {
        if (inds.sma20 && smaArr[i] != null) {
          if (smaArr[i]! < minPrice) minPrice = smaArr[i]!;
          if (smaArr[i]! > maxPrice) maxPrice = smaArr[i]!;
        }
        if (inds.ema50 && emaArr[i] != null) {
          if (emaArr[i]! < minPrice) minPrice = emaArr[i]!;
          if (emaArr[i]! > maxPrice) maxPrice = emaArr[i]!;
        }
        if (inds.bollinger) {
          if (boll.upper[i] != null) {
            if (boll.upper[i]! < minPrice) minPrice = boll.upper[i]!;
            if (boll.upper[i]! > maxPrice) maxPrice = boll.upper[i]!;
          }
          if (boll.lower[i] != null) {
            if (boll.lower[i]! < minPrice) minPrice = boll.lower[i]!;
            if (boll.lower[i]! > maxPrice) maxPrice = boll.lower[i]!;
          }
        }
        if (inds.vwap && vwapArr[i] != null) {
          if (vwapArr[i]! < minPrice) minPrice = vwapArr[i]!;
          if (vwapArr[i]! > maxPrice) maxPrice = vwapArr[i]!;
        }
      }

      const pricePadding = (maxPrice - minPrice) * 0.08;
      minPrice -= pricePadding;
      maxPrice += pricePadding;
      if (maxPrice === minPrice) {
        maxPrice += 1;
        minPrice -= 1;
      }

      const priceToY = (price: number) =>
        chartT + ((maxPrice - price) / (maxPrice - minPrice)) * priceH;
      const volToH = (vol: number) => (maxVol > 0 ? (vol / maxVol) * volH : 0);
      const idxToX = (idx: number) =>
        chartL + (idx * step - v.offsetX) + candleW / 2;

      /* Store coordinate converter for mouse handlers (drawing tools) */
      const xToTime = (x: number) => {
        const idx = (x - chartL + v.offsetX - candleW / 2) / step;
        const i = Math.round(idx);
        if (i < 0 || i >= arr.length) {
          // Extrapolate based on candle spacing
          if (arr.length === 0) return Date.now() / 1000;
          const last = arr[arr.length - 1];
          const first = arr[0];
          const interval = (last.time - first.time) / Math.max(1, arr.length - 1);
          return first.time + idx * interval;
        }
        return arr[i].time;
      };
      const yToPrice = (y: number) =>
        maxPrice - ((y - chartT) / priceH) * (maxPrice - minPrice);
      const timeToX = (time: number) => {
        if (arr.length === 0) return chartL;
        const first = arr[0];
        const last = arr[arr.length - 1];
        const interval = (last.time - first.time) / Math.max(1, arr.length - 1);
        if (interval === 0) return chartL;
        const idx = (time - first.time) / interval;
        return idxToX(idx);
      };
      convRef.current = { timeToX, xToTime, priceToY, yToPrice };

      /* Determine if date should be shown */
      const showDate =
        arr[endIdx - 1] &&
        arr[startIdx] &&
        new Date(arr[endIdx - 1].time * 1000).toDateString() !==
          new Date(arr[startIdx].time * 1000).toDateString();

      /* ──── Grid (price) ──── */
      const priceTicks = niceScale(minPrice, maxPrice, 6);
      ctx.strokeStyle = COLORS.grid;
      ctx.lineWidth = 1;
      ctx.font = "10px system-ui, -apple-system, sans-serif";
      ctx.fillStyle = COLORS.gridText;
      ctx.textAlign = "left";

      for (const p of priceTicks) {
        const y = Math.round(priceToY(p)) + 0.5;
        ctx.beginPath();
        ctx.moveTo(chartL, y);
        ctx.lineTo(chartR, y);
        ctx.stroke();
        ctx.fillText(formatPrice(p), chartR + 6, y + 3);
      }

      /* Time grid */
      const candlePerScreen = Math.floor(chartW / step);
      const timeInterval = Math.max(1, Math.floor(candlePerScreen / 8));
      ctx.textAlign = "center";

      for (let i = startIdx; i < endIdx; i += timeInterval) {
        const x = Math.round(idxToX(i)) + 0.5;
        if (x < chartL || x > chartR) continue;
        ctx.beginPath();
        ctx.strokeStyle = COLORS.grid;
        ctx.moveTo(x, chartT);
        ctx.lineTo(x, layout.subcharts.length > 0 ? layout.subcharts[layout.subcharts.length - 1].bottom : chartB);
        ctx.stroke();
        ctx.fillStyle = COLORS.gridText;
        ctx.fillText(formatTime(arr[i].time, showDate), x, h - CHART_PADDING.bottom + 14);
      }

      /* Volume separator line */
      if (inds.volume) {
        ctx.beginPath();
        ctx.strokeStyle = "rgba(255,255,255,0.06)";
        ctx.moveTo(chartL, volT - 2);
        ctx.lineTo(chartR, volT - 2);
        ctx.stroke();
      }

      /* ──── Volume Bars ──── */
      if (inds.volume) {
        for (let i = startIdx; i < endIdx; i++) {
          const c = arr[i];
          const x = idxToX(i) - candleW / 2;
          const isUp = c.close >= c.open;
          const barH = volToH(c.volume);
          ctx.fillStyle = isUp ? COLORS.upVolume : COLORS.downVolume;
          ctx.fillRect(x, chartB - barH, candleW, barH);
        }
      }

      /* ──── Bollinger Bands (drawn first, behind candles) ──── */
      if (inds.bollinger) {
        // Fill between upper and lower
        ctx.beginPath();
        let started = false;
        for (let i = startIdx; i < endIdx; i++) {
          if (boll.upper[i] == null) continue;
          const x = idxToX(i);
          const y = priceToY(boll.upper[i]!);
          if (!started) {
            ctx.moveTo(x, y);
            started = true;
          } else {
            ctx.lineTo(x, y);
          }
        }
        for (let i = endIdx - 1; i >= startIdx; i--) {
          if (boll.lower[i] == null) continue;
          const x = idxToX(i);
          const y = priceToY(boll.lower[i]!);
          ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fillStyle = COLORS.bollingerFill;
        ctx.fill();

        // Upper band
        ctx.beginPath();
        started = false;
        for (let i = startIdx; i < endIdx; i++) {
          if (boll.upper[i] == null) continue;
          const x = idxToX(i);
          const y = priceToY(boll.upper[i]!);
          if (!started) {
            ctx.moveTo(x, y);
            started = true;
          } else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = COLORS.bollingerUpper;
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.stroke();

        // Lower band
        ctx.beginPath();
        started = false;
        for (let i = startIdx; i < endIdx; i++) {
          if (boll.lower[i] == null) continue;
          const x = idxToX(i);
          const y = priceToY(boll.lower[i]!);
          if (!started) {
            ctx.moveTo(x, y);
            started = true;
          } else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = COLORS.bollingerLower;
        ctx.stroke();
        ctx.setLineDash([]);

        // Mid band (SMA 20 dashed)
        ctx.beginPath();
        started = false;
        for (let i = startIdx; i < endIdx; i++) {
          if (boll.mid[i] == null) continue;
          const x = idxToX(i);
          const y = priceToY(boll.mid[i]!);
          if (!started) {
            ctx.moveTo(x, y);
            started = true;
          } else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = COLORS.bollingerMid;
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      /* ──── Chart Type Rendering ──── */
      if (cType === "candles") {
        /* Candlesticks */
        for (let i = startIdx; i < endIdx; i++) {
          const c = arr[i];
          const x = idxToX(i);
          const isUp = c.close >= c.open;
          const color = isUp ? COLORS.upCandle : COLORS.downCandle;
          const fillColor = isUp ? COLORS.upCandleFill : COLORS.downCandleFill;
          const wickColor = isUp ? COLORS.wickUp : COLORS.wickDown;

          /* Wick */
          ctx.beginPath();
          ctx.strokeStyle = wickColor;
          ctx.lineWidth = 1;
          ctx.moveTo(x, priceToY(c.high));
          ctx.lineTo(x, priceToY(c.low));
          ctx.stroke();

          /* Body */
          const bodyTop = priceToY(Math.max(c.open, c.close));
          const bodyBot = priceToY(Math.min(c.open, c.close));
          const bodyH = Math.max(1, bodyBot - bodyTop);

          ctx.fillStyle = fillColor;
          ctx.fillRect(x - candleW / 2, bodyTop, candleW, bodyH);
          if (isUp) {
            ctx.strokeStyle = color;
            ctx.lineWidth = 1;
            ctx.strokeRect(x - candleW / 2, bodyTop, candleW, bodyH);
          }
        }
      } else if (cType === "line") {
        /* Line chart - connect close prices */
        ctx.beginPath();
        let started = false;
        for (let i = startIdx; i < endIdx; i++) {
          const x = idxToX(i);
          const y = priceToY(arr[i].close);
          if (!started) {
            ctx.moveTo(x, y);
            started = true;
          } else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = COLORS.lineChart;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      } else if (cType === "area") {
        /* Area chart - filled gradient below close line */
        ctx.beginPath();
        let started = false;
        for (let i = startIdx; i < endIdx; i++) {
          const x = idxToX(i);
          const y = priceToY(arr[i].close);
          if (!started) {
            ctx.moveTo(x, y);
            started = true;
          } else ctx.lineTo(x, y);
        }
        // Close path to bottom
        ctx.lineTo(idxToX(endIdx - 1), chartB);
        ctx.lineTo(idxToX(startIdx), chartB);
        ctx.closePath();
        const gradient = ctx.createLinearGradient(0, chartT, 0, chartB);
        gradient.addColorStop(0, "rgba(6,182,212,0.4)");
        gradient.addColorStop(1, "rgba(6,182,212,0.02)");
        ctx.fillStyle = gradient;
        ctx.fill();
        // Line on top
        ctx.beginPath();
        started = false;
        for (let i = startIdx; i < endIdx; i++) {
          const x = idxToX(i);
          const y = priceToY(arr[i].close);
          if (!started) {
            ctx.moveTo(x, y);
            started = true;
          } else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = COLORS.lineChart;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      /* ──── Moving Averages (skip SMA 20 if Bollinger already shows mid) ──── */
      function drawMA(data: (number | null)[], color: string) {
        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        let started = false;
        for (let i = startIdx; i < endIdx; i++) {
          if (data[i] == null) continue;
          const x = idxToX(i);
          const y = priceToY(data[i]!);
          if (!started) {
            ctx.moveTo(x, y);
            started = true;
          } else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      if (inds.sma20 && !inds.bollinger) drawMA(smaArr, COLORS.sma20);
      if (inds.ema50) drawMA(emaArr, COLORS.ema50);

      /* ──── VWAP (Volume Weighted Average Price) ──── */
      if (inds.vwap) {
        ctx.beginPath();
        ctx.strokeStyle = COLORS.vwap;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([5, 3]);
        let started = false;
        for (let i = startIdx; i < endIdx; i++) {
          if (vwapArr[i] == null) continue;
          const x = idxToX(i);
          const y = priceToY(vwapArr[i]!);
          if (!started) {
            ctx.moveTo(x, y);
            started = true;
          } else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.setLineDash([]);

        // VWAP value label on the right
        const lastVwap = vwapArr[arr.length - 1];
        if (lastVwap != null) {
          const y = priceToY(lastVwap);
          ctx.fillStyle = COLORS.vwap;
          roundRect(ctx, chartR, y - 9, 50, 18, 3);
          ctx.fill();
          ctx.fillStyle = "#0a0e17";
          ctx.font = "bold 10px system-ui, sans-serif";
          ctx.textAlign = "center";
          ctx.fillText(lastVwap.toFixed(2), chartR + 25, y + 3);
        }
      }

      /* ──── Current Price Line ──── */
      if (arr.length > 0) {
        const lastCandle = arr[arr.length - 1];
        const isUp = lastCandle.close >= lastCandle.open;
        const priceY = priceToY(lastCandle.close);
        const lineColor = isUp ? COLORS.currentPriceUp : COLORS.currentPriceDown;

        ctx.beginPath();
        ctx.strokeStyle = lineColor;
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 3]);
        ctx.moveTo(chartL, priceY);
        ctx.lineTo(chartR, priceY);
        ctx.stroke();
        ctx.setLineDash([]);

        const labelW = 68;
        const labelH = 18;
        ctx.fillStyle = lineColor;
        roundRect(ctx, chartR, priceY - labelH / 2, labelW, labelH, 3);
        ctx.fill();
        ctx.fillStyle = COLORS.currentPriceLabel;
        ctx.font = "bold 10px system-ui, -apple-system, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(formatPrice(lastCandle.close), chartR + labelW / 2, priceY + 3.5);
      }

      /* ──── Crosshair ──── */
      if (
        v.crosshair.active &&
        v.crosshair.x >= chartL &&
        v.crosshair.x <= chartR
      ) {
        const cx = v.crosshair.x;
        const cy = v.crosshair.y;

        /* Vertical line through all charts */
        ctx.beginPath();
        ctx.strokeStyle = COLORS.crosshair;
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.moveTo(cx, chartT);
        const bottomY = layout.subcharts.length > 0
          ? layout.subcharts[layout.subcharts.length - 1].bottom
          : chartB;
        ctx.lineTo(cx, bottomY);
        ctx.stroke();

        /* Horizontal line (only in main chart area) */
        if (cy >= chartT && cy <= chartB) {
          ctx.beginPath();
          ctx.moveTo(chartL, cy);
          ctx.lineTo(chartR, cy);
          ctx.stroke();

          const priceAtY =
            maxPrice - ((cy - chartT) / priceH) * (maxPrice - minPrice);
          const plW = 68;
          const plH = 18;
          ctx.fillStyle = COLORS.crosshairLabel;
          roundRect(ctx, chartR, cy - plH / 2, plW, plH, 3);
          ctx.fill();
          ctx.strokeStyle = "rgba(255,255,255,0.15)";
          ctx.lineWidth = 1;
          roundRect(ctx, chartR, cy - plH / 2, plW, plH, 3);
          ctx.stroke();
          ctx.fillStyle = COLORS.crosshairText;
          ctx.font = "10px system-ui, -apple-system, sans-serif";
          ctx.textAlign = "center";
          ctx.fillText(formatPrice(priceAtY), chartR + plW / 2, cy + 3.5);
        }
        ctx.setLineDash([]);

        /* Time label at bottom */
        const candleIdx = Math.round(
          (cx - chartL + v.offsetX - candleW / 2) / step
        );
        if (candleIdx >= 0 && candleIdx < arr.length) {
          const tlW = 72;
          const tlH = 18;
          ctx.fillStyle = COLORS.crosshairLabel;
          roundRect(ctx, cx - tlW / 2, h - CHART_PADDING.bottom + 2, tlW, tlH, 3);
          ctx.fill();
          ctx.strokeStyle = "rgba(255,255,255,0.15)";
          roundRect(ctx, cx - tlW / 2, h - CHART_PADDING.bottom + 2, tlW, tlH, 3);
          ctx.stroke();
          ctx.fillStyle = COLORS.crosshairText;
          ctx.font = "10px system-ui, -apple-system, sans-serif";
          ctx.textAlign = "center";
          ctx.fillText(
            formatTime(arr[candleIdx].time, showDate),
            cx,
            h - CHART_PADDING.bottom + 14
          );

          /* Notify parent */
          if (onCrosshairMove) {
            onCrosshairMove({
              candle: arr[candleIdx],
              x: cx,
              y: cy,
            });
          }
        }
      } else {
        if (onCrosshairMove) onCrosshairMove(null);
      }

      /* ──── MA Legend ──── */
      ctx.font = "10px system-ui, -apple-system, sans-serif";
      ctx.textAlign = "left";
      let legendX = chartL + 8;
      const legendY = chartT + 12;

      if (inds.sma20 && !inds.bollinger) {
        ctx.fillStyle = COLORS.sma20;
        ctx.fillRect(legendX, legendY - 7, 12, 2);
        ctx.fillText("SMA 20", legendX + 16, legendY);
        legendX += 70;
      }
      if (inds.ema50) {
        ctx.fillStyle = COLORS.ema50;
        ctx.fillRect(legendX, legendY - 7, 12, 2);
        ctx.fillText("EMA 50", legendX + 16, legendY);
        legendX += 70;
      }
      if (inds.bollinger) {
        ctx.fillStyle = COLORS.bollingerUpper;
        ctx.fillRect(legendX, legendY - 7, 12, 2);
        ctx.fillText("BOLL(20,2)", legendX + 16, legendY);
        legendX += 80;
      }
      if (inds.vwap) {
        ctx.fillStyle = COLORS.vwap;
        ctx.fillRect(legendX, legendY - 7, 12, 2);
        ctx.fillText("VWAP", legendX + 16, legendY);
        legendX += 60;
      }

      /* ──── OHLC Legend (when crosshair is active) ──── */
      if (v.crosshair.active) {
        const candleIdx = Math.round(
          (v.crosshair.x - chartL + v.offsetX - candleW / 2) / step
        );
        if (candleIdx >= 0 && candleIdx < arr.length) {
          const c = arr[candleIdx];
          const isUp = c.close >= c.open;
          const ohlcColor = isUp ? COLORS.upCandle : COLORS.downCandle;
          // Time
          ctx.fillStyle = "rgba(255,255,255,0.6)";
          ctx.font = "10px system-ui, sans-serif";
          ctx.textAlign = "left";
          ctx.fillText(
            new Date(c.time * 1000).toLocaleString("en-GB", {
              day: "2-digit",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            }),
            legendX,
            legendY
          );
          legendX += 90;

          // OHLC values
          const parts: { label: string; value: string }[] = [
            { label: "O", value: formatPrice(c.open) },
            { label: "H", value: formatPrice(c.high) },
            { label: "L", value: formatPrice(c.low) },
            { label: "C", value: formatPrice(c.close) },
          ];
          for (const p of parts) {
            ctx.fillStyle = "rgba(255,255,255,0.5)";
            ctx.fillText(p.label, legendX, legendY);
            ctx.fillStyle = ohlcColor;
            ctx.fillText(p.value, legendX + 10, legendY);
            legendX += 10 + ctx.measureText(p.value).width + 12;
          }

          // Change %
          const change = ((c.close - c.open) / c.open) * 100;
          ctx.fillStyle = ohlcColor;
          ctx.fillText(
            `${change >= 0 ? "+" : ""}${change.toFixed(2)}%`,
            legendX,
            legendY
          );
        }
      } else {
        // Show last candle OHLC by default
        const c = arr[arr.length - 1];
        if (c) {
          const isUp = c.close >= c.open;
          const ohlcColor = isUp ? COLORS.upCandle : COLORS.downCandle;
          ctx.fillStyle = "rgba(255,255,255,0.6)";
          ctx.font = "10px system-ui, sans-serif";
          ctx.textAlign = "left";
          ctx.fillText("آخر شمعة", legendX, legendY);
          legendX += 50;

          const parts: { label: string; value: string }[] = [
            { label: "O", value: formatPrice(c.open) },
            { label: "H", value: formatPrice(c.high) },
            { label: "L", value: formatPrice(c.low) },
            { label: "C", value: formatPrice(c.close) },
          ];
          for (const p of parts) {
            ctx.fillStyle = "rgba(255,255,255,0.5)";
            ctx.fillText(p.label, legendX, legendY);
            ctx.fillStyle = ohlcColor;
            ctx.fillText(p.value, legendX + 10, legendY);
            legendX += 10 + ctx.measureText(p.value).width + 12;
          }

          const change = ((c.close - c.open) / c.open) * 100;
          ctx.fillStyle = ohlcColor;
          ctx.fillText(
            `${change >= 0 ? "+" : ""}${change.toFixed(2)}%`,
            legendX,
            legendY
          );
        }
      }

      /* Border around chart area */
      ctx.strokeStyle = "rgba(255,255,255,0.06)";
      ctx.lineWidth = 1;
      ctx.strokeRect(chartL, chartT, chartW, chartB - chartT);

      /* ═══════════════════════════════════════════
         Subcharts: RSI, MACD, Stochastic
         ═══════════════════════════════════════════ */
      for (const sub of layout.subcharts) {
        if (sub.type === "rsi") {
          drawRSISubchart(ctx, arr, v.rsi, startIdx, endIdx, idxToX, sub, chartL, chartR, v.crosshair);
        } else if (sub.type === "macd") {
          drawMACDSubchart(ctx, arr, v.macd, startIdx, endIdx, idxToX, sub, chartL, chartR, v.crosshair);
        } else if (sub.type === "stoch") {
          drawStochSubchart(ctx, arr, v.stoch, startIdx, endIdx, idxToX, sub, chartL, chartR, v.crosshair);
        }
      }

      /* ═══════════════════════════════════════════
         User drawings (drawn last, on top of everything)
         ═══════════════════════════════════════════ */
      const conv = convRef.current;
      if (conv) {
        // Committed drawings
        for (const d of drawingsRef.current) {
          drawDrawing(ctx, d, conv, false);
        }
        // Draft drawing (in progress)
        if (draftDrawingRef.current) {
          drawDrawing(ctx, draftDrawingRef.current, conv, true);
        }
      }
    }

    /* ──── RSI Subchart ──── */
    function drawRSISubchart(
      ctx: CanvasRenderingContext2D,
      arr: Candle[],
      rsi: (number | null)[],
      startIdx: number,
      endIdx: number,
      idxToX: (i: number) => number,
      sub: { top: number; bottom: number; height: number },
      chartL: number,
      chartR: number,
      crosshair: { x: number; y: number; active: boolean }
    ) {
      const sT = sub.top;
      const sB = sub.bottom;
      const sH = sub.height;
      const chartW = chartR - chartL;

      // Background
      ctx.fillStyle = "rgba(0,0,0,0.15)";
      ctx.fillRect(chartL, sT, chartW, sH);

      // Label
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.font = "10px system-ui, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText("RSI(14)", chartL + 6, sT + 12);

      // Compute RSI range from visible values (always 0-100)
      const rsiMin = 0;
      const rsiMax = 100;
      const rsiToY = (val: number) => sT + ((rsiMax - val) / (rsiMax - rsiMin)) * sH;

      // Overbought (70) and oversold (30) zones
      const y70 = rsiToY(70);
      const y30 = rsiToY(30);
      const y50 = rsiToY(50);

      // Fill overbought zone
      ctx.fillStyle = "rgba(246,70,93,0.06)";
      ctx.fillRect(chartL, sT, chartW, y70 - sT);
      // Fill oversold zone
      ctx.fillStyle = "rgba(0,192,135,0.06)";
      ctx.fillRect(chartL, y30, chartW, sB - y30);

      // Reference lines
      ctx.strokeStyle = COLORS.rsiOverbought;
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 3]);
      ctx.beginPath();
      ctx.moveTo(chartL, y70);
      ctx.lineTo(chartR, y70);
      ctx.stroke();

      ctx.strokeStyle = COLORS.rsiOversold;
      ctx.beginPath();
      ctx.moveTo(chartL, y30);
      ctx.lineTo(chartR, y30);
      ctx.stroke();

      ctx.strokeStyle = COLORS.rsiMid;
      ctx.beginPath();
      ctx.moveTo(chartL, y50);
      ctx.lineTo(chartR, y50);
      ctx.stroke();
      ctx.setLineDash([]);

      // Reference labels
      ctx.fillStyle = "rgba(255,255,255,0.4)";
      ctx.font = "9px system-ui, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText("70", chartR + 4, y70 + 3);
      ctx.fillText("30", chartR + 4, y30 + 3);

      // RSI line
      ctx.beginPath();
      ctx.strokeStyle = COLORS.rsiLine;
      ctx.lineWidth = 1.5;
      let started = false;
      for (let i = startIdx; i < endIdx; i++) {
        if (rsi[i] == null) continue;
        const x = idxToX(i);
        const y = rsiToY(rsi[i]!);
        if (!started) {
          ctx.moveTo(x, y);
          started = true;
        } else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Current RSI value label
      const lastRSI = rsi[arr.length - 1];
      if (lastRSI != null) {
        const y = rsiToY(lastRSI);
        ctx.fillStyle = COLORS.rsiLine;
        roundRect(ctx, chartR, y - 9, 40, 18, 3);
        ctx.fill();
        ctx.fillStyle = "#0a0e17";
        ctx.font = "bold 10px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(lastRSI.toFixed(2), chartR + 20, y + 3);
      }

      // Crosshair line for subchart
      if (crosshair.active && crosshair.x >= chartL && crosshair.x <= chartR) {
        ctx.beginPath();
        ctx.strokeStyle = COLORS.crosshair;
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.moveTo(crosshair.x, sT);
        ctx.lineTo(crosshair.x, sB);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Border
      ctx.strokeStyle = "rgba(255,255,255,0.06)";
      ctx.lineWidth = 1;
      ctx.strokeRect(chartL, sT, chartW, sH);
    }

    /* ──── MACD Subchart ──── */
    function drawMACDSubchart(
      ctx: CanvasRenderingContext2D,
      arr: Candle[],
      macd: { macd: (number | null)[]; signal: (number | null)[]; hist: (number | null)[] },
      startIdx: number,
      endIdx: number,
      idxToX: (i: number) => number,
      sub: { top: number; bottom: number; height: number },
      chartL: number,
      chartR: number,
      crosshair: { x: number; y: number; active: boolean }
    ) {
      const sT = sub.top;
      const sB = sub.bottom;
      const sH = sub.height;
      const chartW = chartR - chartL;

      // Background
      ctx.fillStyle = "rgba(0,0,0,0.15)";
      ctx.fillRect(chartL, sT, chartW, sH);

      // Label
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.font = "10px system-ui, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText("MACD(12,26,9)", chartL + 6, sT + 12);

      // Compute range from visible MACD/hist values
      let vMin = Infinity, vMax = -Infinity;
      for (let i = startIdx; i < endIdx; i++) {
        if (macd.macd[i] != null) {
          vMin = Math.min(vMin, macd.macd[i]!);
          vMax = Math.max(vMax, macd.macd[i]!);
        }
        if (macd.signal[i] != null) {
          vMin = Math.min(vMin, macd.signal[i]!);
          vMax = Math.max(vMax, macd.signal[i]!);
        }
        if (macd.hist[i] != null) {
          vMin = Math.min(vMin, macd.hist[i]!);
          vMax = Math.max(vMax, macd.hist[i]!);
        }
      }
      if (vMin === Infinity) { vMin = -1; vMax = 1; }
      const pad = (vMax - vMin) * 0.1 || 1;
      vMin -= pad;
      vMax += pad;
      const macdToY = (val: number) => sT + ((vMax - val) / (vMax - vMin)) * sH;

      // Zero line
      const yZero = macdToY(0);
      ctx.strokeStyle = "rgba(255,255,255,0.15)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(chartL, yZero);
      ctx.lineTo(chartR, yZero);
      ctx.stroke();

      // Histogram bars
      const candleW = viewRef.current.candleWidth;
      for (let i = startIdx; i < endIdx; i++) {
        if (macd.hist[i] == null) continue;
        const x = idxToX(i) - candleW / 2;
        const val = macd.hist[i]!;
        const y = macdToY(val);
        const isUp = val >= 0;
        ctx.fillStyle = isUp ? COLORS.macdHistUp : COLORS.macdHistDown;
        const barH = Math.abs(y - yZero);
        ctx.fillRect(x, Math.min(y, yZero), candleW, Math.max(1, barH));
      }

      // MACD line
      ctx.beginPath();
      ctx.strokeStyle = COLORS.macdLine;
      ctx.lineWidth = 1.5;
      let started = false;
      for (let i = startIdx; i < endIdx; i++) {
        if (macd.macd[i] == null) continue;
        const x = idxToX(i);
        const y = macdToY(macd.macd[i]!);
        if (!started) { ctx.moveTo(x, y); started = true; }
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Signal line
      ctx.beginPath();
      ctx.strokeStyle = COLORS.macdSignal;
      ctx.lineWidth = 1.5;
      started = false;
      for (let i = startIdx; i < endIdx; i++) {
        if (macd.signal[i] == null) continue;
        const x = idxToX(i);
        const y = macdToY(macd.signal[i]!);
        if (!started) { ctx.moveTo(x, y); started = true; }
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Current MACD value label
      const lastMacd = macd.macd[arr.length - 1];
      if (lastMacd != null) {
        const y = macdToY(lastMacd);
        ctx.fillStyle = COLORS.macdLine;
        roundRect(ctx, chartR, y - 9, 50, 18, 3);
        ctx.fill();
        ctx.fillStyle = "#0a0e17";
        ctx.font = "bold 10px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(lastMacd.toFixed(4), chartR + 25, y + 3);
      }

      // Crosshair line for subchart
      if (crosshair.active && crosshair.x >= chartL && crosshair.x <= chartR) {
        ctx.beginPath();
        ctx.strokeStyle = COLORS.crosshair;
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.moveTo(crosshair.x, sT);
        ctx.lineTo(crosshair.x, sB);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Border
      ctx.strokeStyle = "rgba(255,255,255,0.06)";
      ctx.lineWidth = 1;
      ctx.strokeRect(chartL, sT, chartW, sH);
    }

    /* ──── Stochastic Subchart ──── */
    function drawStochSubchart(
      ctx: CanvasRenderingContext2D,
      arr: Candle[],
      stoch: { k: (number | null)[]; d: (number | null)[] },
      startIdx: number,
      endIdx: number,
      idxToX: (i: number) => number,
      sub: { top: number; bottom: number; height: number },
      chartL: number,
      chartR: number,
      crosshair: { x: number; y: number; active: boolean }
    ) {
      const sT = sub.top;
      const sB = sub.bottom;
      const sH = sub.height;
      const chartW = chartR - chartL;

      // Background
      ctx.fillStyle = "rgba(0,0,0,0.15)";
      ctx.fillRect(chartL, sT, chartW, sH);

      // Label
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.font = "10px system-ui, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText("Stoch(14,3,3)", chartL + 6, sT + 12);

      // Range is fixed 0-100
      const stochMin = 0;
      const stochMax = 100;
      const stochToY = (val: number) =>
        sT + ((stochMax - val) / (stochMax - stochMin)) * sH;

      // Overbought (80) / oversold (20) zones
      const y80 = stochToY(80);
      const y20 = stochToY(20);
      const y50 = stochToY(50);

      ctx.fillStyle = "rgba(246,70,93,0.06)";
      ctx.fillRect(chartL, sT, chartW, y80 - sT);
      ctx.fillStyle = "rgba(0,192,135,0.06)";
      ctx.fillRect(chartL, y20, chartW, sB - y20);

      ctx.strokeStyle = COLORS.stochOverbought;
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 3]);
      ctx.beginPath();
      ctx.moveTo(chartL, y80);
      ctx.lineTo(chartR, y80);
      ctx.stroke();

      ctx.strokeStyle = COLORS.stochOversold;
      ctx.beginPath();
      ctx.moveTo(chartL, y20);
      ctx.lineTo(chartR, y20);
      ctx.stroke();

      ctx.strokeStyle = COLORS.stochMid;
      ctx.beginPath();
      ctx.moveTo(chartL, y50);
      ctx.lineTo(chartR, y50);
      ctx.stroke();
      ctx.setLineDash([]);

      // Reference labels
      ctx.fillStyle = "rgba(255,255,255,0.4)";
      ctx.font = "9px system-ui, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText("80", chartR + 4, y80 + 3);
      ctx.fillText("20", chartR + 4, y20 + 3);

      // %D line (slower, drawn first)
      ctx.beginPath();
      ctx.strokeStyle = COLORS.stochD;
      ctx.lineWidth = 1.5;
      let started = false;
      for (let i = startIdx; i < endIdx; i++) {
        if (stoch.d[i] == null) continue;
        const x = idxToX(i);
        const y = stochToY(stoch.d[i]!);
        if (!started) { ctx.moveTo(x, y); started = true; }
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // %K line (faster)
      ctx.beginPath();
      ctx.strokeStyle = COLORS.stochK;
      ctx.lineWidth = 1.5;
      started = false;
      for (let i = startIdx; i < endIdx; i++) {
        if (stoch.k[i] == null) continue;
        const x = idxToX(i);
        const y = stochToY(stoch.k[i]!);
        if (!started) { ctx.moveTo(x, y); started = true; }
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Current %K value label
      const lastK = stoch.k[arr.length - 1];
      if (lastK != null) {
        const y = stochToY(lastK);
        ctx.fillStyle = COLORS.stochK;
        roundRect(ctx, chartR, y - 9, 40, 18, 3);
        ctx.fill();
        ctx.fillStyle = "#0a0e17";
        ctx.font = "bold 10px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(lastK.toFixed(2), chartR + 20, y + 3);
      }

      // Crosshair line for subchart
      if (crosshair.active && crosshair.x >= chartL && crosshair.x <= chartR) {
        ctx.beginPath();
        ctx.strokeStyle = COLORS.crosshair;
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.moveTo(crosshair.x, sT);
        ctx.lineTo(crosshair.x, sB);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Border
      ctx.strokeStyle = "rgba(255,255,255,0.06)";
      ctx.lineWidth = 1;
      ctx.strokeRect(chartL, sT, chartW, sH);
    }

    /* Rounded rect helper */
    function roundRect(
      ctx: CanvasRenderingContext2D,
      x: number,
      y: number,
      w: number,
      h: number,
      r: number
    ) {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + r);
      ctx.lineTo(x + w, y + h - r);
      ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      ctx.lineTo(x + r, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();
    }

    /* ──── Mouse Events ──── */
    /* Helper: convert screen coords to data coords using stored converter */
    const screenToData = (x: number, y: number): Point | null => {
      const conv = convRef.current;
      if (!conv) return null;
      return {
        time: conv.xToTime(x),
        price: conv.yToPrice(y),
      };
    };

    /* Helper: commit a drawing to the parent state */
    const commitDrawing = (d: Drawing) => {
      const next = [...drawingsRef.current, d];
      onDrawingsChange?.(next);
    };

    /* Helper: delete a drawing by id */
    const deleteDrawing = (id: string) => {
      const next = drawingsRef.current.filter((d) => d.id !== id);
      onDrawingsChange?.(next);
    };

    const handleMouseDown = useCallback(
      (e: React.MouseEvent<HTMLCanvasElement>) => {
        const v = viewRef.current;
        const tool = activeToolRef.current;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Drawing tools take priority over dragging
        if (tool === "cursor") {
          v.isDragging = true;
          v.dragStartX = e.clientX;
          v.dragStartOffset = v.offsetX;
          return;
        }

        if (tool === "eraser") {
          // Find first drawing under the cursor and delete it
          const conv = convRef.current;
          if (conv) {
            for (const d of drawingsRef.current) {
              if (hitTestDrawing(d, x, y, conv)) {
                deleteDrawing(d.id);
                return;
              }
            }
          }
          return;
        }

        // Single-click tools (no second point needed)
        if (tool === "horizontal" || tool === "vertical" || tool === "text") {
          const p = screenToData(x, y);
          if (!p) return;
          if (tool === "text") {
            const text = window.prompt("أدخل النص:");
            if (!text) return;
            commitDrawing({
              id: genDrawingId(),
              type: "text",
              p1: p,
              text,
              color: drawingColorRef.current,
              createdAt: Date.now(),
            });
          } else {
            commitDrawing({
              id: genDrawingId(),
              type: tool,
              p1: p,
              color: drawingColorRef.current,
              createdAt: Date.now(),
            });
          }
          return;
        }

        // Two-click tools: trendline, fib, rectangle
        // Start draft
        const p = screenToData(x, y);
        if (!p) return;
        draftDrawingRef.current = {
          id: genDrawingId(),
          type: tool,
          p1: p,
          p2: p, // initially same point
          color: drawingColorRef.current,
          createdAt: Date.now(),
        };
        requestRender();
      },
      // eslint-disable-next-line react-hooks/exhaustive-deps
      []
    );

    const handleMouseMove = useCallback(
      (e: React.MouseEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const v = viewRef.current;
        const tool = activeToolRef.current;

        v.crosshair = { x, y, active: true };

        // Update draft drawing if one is in progress
        if (draftDrawingRef.current && draftDrawingRef.current.p2) {
          const p = screenToData(x, y);
          if (p) {
            draftDrawingRef.current.p2 = p;
            requestRender();
            return;
          }
        }

        if (tool === "cursor" && v.isDragging) {
          const dx = e.clientX - v.dragStartX;
          v.offsetX = v.dragStartOffset - dx;
          const arr = candlesRef.current;
          const step = v.candleWidth + CANDLE_GAP;
          const chartW =
            canvasSize.w - CHART_PADDING.left - CHART_PADDING.right;
          const maxOffset = Math.max(0, arr.length * step - chartW);
          v.offsetX = Math.max(0, Math.min(maxOffset, v.offsetX));
        }

        requestRender();
      },
      [canvasSize, requestRender]
    );

    const handleMouseUp = useCallback(() => {
      const v = viewRef.current;
      v.isDragging = false;

      // Commit draft drawing if it has two distinct points
      if (draftDrawingRef.current) {
        const d = draftDrawingRef.current;
        draftDrawingRef.current = null;
        // Only commit if points are meaningfully different
        if (
          d.p2 &&
          (Math.abs(d.p1.time - d.p2.time) > 0.001 ||
            Math.abs(d.p1.price - d.p2.price) > 0.0001)
        ) {
          commitDrawing(d);
        }
        requestRender();
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [requestRender]);

    const handleMouseLeave = useCallback(() => {
      const v = viewRef.current;
      v.isDragging = false;
      v.crosshair.active = false;
      // Cancel draft on leave (so the user has to start over)
      if (draftDrawingRef.current) {
        draftDrawingRef.current = null;
      }
      requestRender();
    }, [requestRender]);

    const handleWheel = useCallback(
      (e: React.WheelEvent<HTMLCanvasElement>) => {
        e.preventDefault();
        const v = viewRef.current;
        const delta = e.deltaY > 0 ? 1 : -1;
        const oldW = v.candleWidth;
        const newW = Math.max(
          MIN_CANDLE_WIDTH,
          Math.min(MAX_CANDLE_WIDTH, oldW + delta * 1.5)
        );

        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const chartL = CHART_PADDING.left;
        const chartR = canvasSize.w - CHART_PADDING.right;
        if (mouseX < chartL || mouseX > chartR) return;

        const step = oldW + CANDLE_GAP;
        const newStep = newW + CANDLE_GAP;
        const mouseIdx = (mouseX - chartL + v.offsetX) / step;

        v.candleWidth = newW;
        v.offsetX = mouseIdx * newStep - (mouseX - chartL);

        const arr = candlesRef.current;
        const maxStep = newW + CANDLE_GAP;
        const chartW = chartR - chartL;
        const maxOffset = Math.max(0, arr.length * maxStep - chartW);
        v.offsetX = Math.max(0, Math.min(maxOffset, v.offsetX));

        requestRender();
      },
      [canvasSize, requestRender]
    );

    return (
      <div
        ref={containerRef}
        className={`relative ${className}`}
        style={height ? { height: `${height}px` } : { position: "absolute", inset: 0 }}
      >
        <canvas
          ref={canvasRef}
          className={`w-full h-full ${
            activeTool === "cursor"
              ? "cursor-crosshair"
              : activeTool === "eraser"
              ? "cursor-pointer"
              : "cursor-crosshair"
          }`}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          onWheel={handleWheel}
          style={{ touchAction: "none" }}
        />
      </div>
    );
  }
);

ProChart.displayName = "ProChart";
export default ProChart;
