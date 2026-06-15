"use client";

import {
  useEffect,
  useRef,
  useCallback,
  useState,
  forwardRef,
  useImperativeHandle,
} from "react";

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

export interface ProChartProps {
  candles: Candle[];
  onCrosshairMove?: (data: {
    candle: Candle | null;
    x: number;
    y: number;
  } | null) => void;
  height?: number;
  className?: string;
}

export interface ProChartHandle {
  updateLastCandle: (candle: Candle) => void;
  addCandle: (candle: Candle) => void;
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
  currentPriceUp: "#00c087",
  currentPriceDown: "#f6465d",
  currentPriceLabel: "#0a0e17",
  wickUp: "#00c087",
  wickDown: "#f6465d",
};

const CHART_PADDING = { top: 16, right: 72, bottom: 28, left: 8 };
const VOLUME_RATIO = 0.18;
const MIN_CANDLE_WIDTH = 3;
const MAX_CANDLE_WIDTH = 40;
const DEFAULT_CANDLE_WIDTH = 9;
const CANDLE_GAP = 2;

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

function formatVolume(vol: number): string {
  if (vol >= 1e9) return (vol / 1e9).toFixed(2) + "B";
  if (vol >= 1e6) return (vol / 1e6).toFixed(2) + "M";
  if (vol >= 1e3) return (vol / 1e3).toFixed(1) + "K";
  return vol.toFixed(2);
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

/* ═══════════════════════════════════════════
   ProChart Component
   ═══════════════════════════════════════════ */

const ProChart = forwardRef<ProChartHandle, ProChartProps>(
  ({ candles, onCrosshairMove, height = 520, className = "" }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const candlesRef = useRef<Candle[]>(candles);
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
    });

    /* Keep candles ref in sync */
    useEffect(() => {
      candlesRef.current = candles;
      viewRef.current.sma20 = computeSMA(candles, 20);
      viewRef.current.ema50 = computeEMA(candles, 50);
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
          viewRef.current.sma20 = computeSMA(arr, 20);
          viewRef.current.ema50 = computeEMA(arr, 50);
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
        requestRender();
      },
      addCandle(candle: Candle) {
        candlesRef.current.push(candle);
        viewRef.current.sma20 = computeSMA(candlesRef.current, 20);
        viewRef.current.ema50 = computeEMA(candlesRef.current, 50);
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

      /* Use ResizeObserver for container-level resize detection */
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
    }, [canvasSize, requestRender]);

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

      const chartL = CHART_PADDING.left;
      const chartR = w - CHART_PADDING.right;
      const chartT = CHART_PADDING.top;
      const chartB = h - CHART_PADDING.bottom;
      const priceH = (chartB - chartT) * (1 - VOLUME_RATIO);
      const volT = chartT + priceH + 4;
      const volH = (chartB - chartT) * VOLUME_RATIO - 4;
      const chartW = chartR - chartL;

      const candleW = v.candleWidth;
      const step = candleW + CANDLE_GAP;
      const totalCandlesW = arr.length * step;

      /* Determine visible range */
      const startIdx = Math.max(
        0,
        Math.floor(v.offsetX / step)
      );
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
      /* Include MA values in range */
      const smaArr = v.sma20;
      const emaArr = v.ema50;
      for (let i = startIdx; i < endIdx; i++) {
        if (smaArr[i] !== null && smaArr[i] !== undefined) {
          if (smaArr[i]! < minPrice) minPrice = smaArr[i]!;
          if (smaArr[i]! > maxPrice) maxPrice = smaArr[i]!;
        }
        if (emaArr[i] !== null && emaArr[i] !== undefined) {
          if (emaArr[i]! < minPrice) minPrice = emaArr[i]!;
          if (emaArr[i]! > maxPrice) maxPrice = emaArr[i]!;
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
      const volToH = (vol: number) =>
        maxVol > 0 ? (vol / maxVol) * volH : 0;
      const idxToX = (idx: number) =>
        chartL + (idx * step - v.offsetX) + candleW / 2;

      /* ──── Grid ──── */
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
      const timeInterval = Math.max(
        1,
        Math.floor(candlePerScreen / 8)
      );
      ctx.textAlign = "center";
      const showDate = arr[endIdx - 1] && arr[startIdx] &&
        new Date(arr[endIdx - 1].time * 1000).toDateString() !==
          new Date(arr[startIdx].time * 1000).toDateString();

      for (let i = startIdx; i < endIdx; i += timeInterval) {
        const x = Math.round(idxToX(i)) + 0.5;
        if (x < chartL || x > chartR) continue;
        ctx.beginPath();
        ctx.strokeStyle = COLORS.grid;
        ctx.moveTo(x, chartT);
        ctx.lineTo(x, chartB);
        ctx.stroke();
        ctx.fillStyle = COLORS.gridText;
        ctx.fillText(formatTime(arr[i].time, showDate), x, chartB + 14);
      }

      /* Volume separator line */
      ctx.beginPath();
      ctx.strokeStyle = "rgba(255,255,255,0.06)";
      ctx.moveTo(chartL, volT - 2);
      ctx.lineTo(chartR, volT - 2);
      ctx.stroke();

      /* ──── Volume Bars ──── */
      for (let i = startIdx; i < endIdx; i++) {
        const c = arr[i];
        const x = idxToX(i) - candleW / 2;
        const isUp = c.close >= c.open;
        const barH = volToH(c.volume);
        ctx.fillStyle = isUp ? COLORS.upVolume : COLORS.downVolume;
        ctx.fillRect(x, chartB - barH, candleW, barH);
      }

      /* ──── Candlesticks ──── */
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

        if (isUp) {
          /* Hollow for up (or filled) - we'll fill for visibility */
          ctx.fillStyle = fillColor;
          ctx.fillRect(x - candleW / 2, bodyTop, candleW, bodyH);
          /* Border */
          ctx.strokeStyle = color;
          ctx.lineWidth = 1;
          ctx.strokeRect(x - candleW / 2, bodyTop, candleW, bodyH);
        } else {
          ctx.fillStyle = fillColor;
          ctx.fillRect(x - candleW / 2, bodyTop, candleW, bodyH);
        }
      }

      /* ──── Moving Averages ──── */
      function drawMA(
        data: (number | null)[],
        color: string
      ) {
        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        let started = false;
        for (let i = startIdx; i < endIdx; i++) {
          if (data[i] === null || data[i] === undefined) continue;
          const x = idxToX(i);
          const y = priceToY(data[i]!);
          if (!started) {
            ctx.moveTo(x, y);
            started = true;
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.stroke();
      }

      drawMA(smaArr, COLORS.sma20);
      drawMA(emaArr, COLORS.ema50);

      /* ──── Current Price Line ──── */
      if (arr.length > 0) {
        const lastCandle = arr[arr.length - 1];
        const isUp = lastCandle.close >= lastCandle.open;
        const priceY = priceToY(lastCandle.close);
        const lineColor = isUp
          ? COLORS.currentPriceUp
          : COLORS.currentPriceDown;

        ctx.beginPath();
        ctx.strokeStyle = lineColor;
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 3]);
        ctx.moveTo(chartL, priceY);
        ctx.lineTo(chartR, priceY);
        ctx.stroke();
        ctx.setLineDash([]);

        /* Price label */
        const labelW = 68;
        const labelH = 18;
        ctx.fillStyle = lineColor;
        roundRect(ctx, chartR, priceY - labelH / 2, labelW, labelH, 3);
        ctx.fill();
        ctx.fillStyle = COLORS.currentPriceLabel;
        ctx.font = "bold 10px system-ui, -apple-system, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(
          formatPrice(lastCandle.close),
          chartR + labelW / 2,
          priceY + 3.5
        );
      }

      /* ──── Crosshair ──── */
      if (v.crosshair.active && v.crosshair.x >= chartL && v.crosshair.x <= chartR) {
        const cx = v.crosshair.x;
        const cy = v.crosshair.y;

        /* Vertical line */
        ctx.beginPath();
        ctx.strokeStyle = COLORS.crosshair;
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.moveTo(cx, chartT);
        ctx.lineTo(cx, chartB);
        ctx.stroke();

        /* Horizontal line */
        if (cy >= chartT && cy <= chartB) {
          ctx.beginPath();
          ctx.moveTo(chartL, cy);
          ctx.lineTo(chartR, cy);
          ctx.stroke();

          /* Price label */
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
          ctx.fillText(
            formatPrice(priceAtY),
            chartR + plW / 2,
            cy + 3.5
          );
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
          roundRect(
            ctx,
            cx - tlW / 2,
            chartB + 2,
            tlW,
            tlH,
            3
          );
          ctx.fill();
          ctx.strokeStyle = "rgba(255,255,255,0.15)";
          roundRect(ctx, cx - tlW / 2, chartB + 2, tlW, tlH, 3);
          ctx.stroke();
          ctx.fillStyle = COLORS.crosshairText;
          ctx.font = "10px system-ui, -apple-system, sans-serif";
          ctx.textAlign = "center";
          ctx.fillText(
            formatTime(arr[candleIdx].time, showDate),
            cx,
            chartB + 14
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

      ctx.fillStyle = COLORS.sma20;
      ctx.fillRect(legendX, legendY - 7, 12, 2);
      ctx.fillText("SMA 20", legendX + 16, legendY);
      legendX += 70;

      ctx.fillStyle = COLORS.ema50;
      ctx.fillRect(legendX, legendY - 7, 12, 2);
      ctx.fillText("EMA 50", legendX + 16, legendY);

      /* Border around chart area */
      ctx.strokeStyle = "rgba(255,255,255,0.06)";
      ctx.lineWidth = 1;
      ctx.strokeRect(chartL, chartT, chartW, chartB - chartT);
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
    const handleMouseDown = useCallback(
      (e: React.MouseEvent<HTMLCanvasElement>) => {
        const v = viewRef.current;
        v.isDragging = true;
        v.dragStartX = e.clientX;
        v.dragStartOffset = v.offsetX;
      },
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

        v.crosshair = { x, y, active: true };

        if (v.isDragging) {
          const dx = e.clientX - v.dragStartX;
          /* In RTL, dragging left should increase offset (scroll forward) */
          v.offsetX = v.dragStartOffset - dx;
          /* Clamp */
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
      viewRef.current.isDragging = false;
    }, []);

    const handleMouseLeave = useCallback(() => {
      const v = viewRef.current;
      v.isDragging = false;
      v.crosshair.active = false;
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

        /* Zoom towards mouse position */
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const chartL = CHART_PADDING.left;
        const chartR = canvasSize.w - CHART_PADDING.right;
        if (mouseX < chartL || mouseX > chartR) return;

        const step = oldW + CANDLE_GAP;
        const newStep = newW + CANDLE_GAP;
        const mouseIdx =
          (mouseX - chartL + v.offsetX) / step;

        v.candleWidth = newW;
        v.offsetX = mouseIdx * newStep - (mouseX - chartL);

        /* Clamp */
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
          className="w-full h-full cursor-crosshair"
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
