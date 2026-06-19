"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { TIMEFRAMES } from "./constants";
import type { Timeframe } from "./types";

interface MiniCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

interface MultiTimeframeStripProps {
  pair: string;
  activeTimeframe: Timeframe;
  onSelectTimeframe: (tf: Timeframe) => void;
}

/**
 * Multi-timeframe strip showing mini sparklines for each timeframe.
 * Renders small canvas sparklines for 1m/5m/15m/1h/4h/1d.
 *
 * Features:
 * - Fetches ~30 candles per timeframe from Binance REST API
 * - Highlights the currently selected timeframe
 * - Shows the % change for the last candle
 * - Click to switch the main chart to that timeframe
 * - Color-coded based on direction (green up / red down)
 */
export default function MultiTimeframeStrip({
  pair,
  activeTimeframe,
  onSelectTimeframe,
}: MultiTimeframeStripProps) {
  const [data, setData] = useState<Record<string, MiniCandle[]>>({});
  const [loading, setLoading] = useState(true);
  const canvasRefs = useRef<Record<string, HTMLCanvasElement | null>>({});

  /* Fetch mini candles for all timeframes */
  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const results = await Promise.all(
        TIMEFRAMES.map(async (tf) => {
          try {
            const res = await fetch(
              `https://api.binance.com/api/v3/klines?symbol=${pair}&interval=${tf.value}&limit=30`
            );
            if (!res.ok) return { tf: tf.value, candles: [] };
            const json = await res.json();
            const candles: MiniCandle[] = json.map((k: any) => ({
              time: Math.floor(k[0] / 1000),
              open: parseFloat(k[1]),
              high: parseFloat(k[2]),
              low: parseFloat(k[3]),
              close: parseFloat(k[4]),
            }));
            return { tf: tf.value, candles };
          } catch {
            return { tf: tf.value, candles: [] };
          }
        })
      );
      const map: Record<string, MiniCandle[]> = {};
      for (const r of results) map[r.tf] = r.candles;
      setData(map);
    } catch {
    } finally {
      setLoading(false);
    }
  }, [pair]);

  /* Initial fetch + periodic refresh (every 10s) */
  useEffect(() => {
    fetchAll();
    const id = setInterval(fetchAll, 10000);
    return () => clearInterval(id);
  }, [fetchAll]);

  /* Render sparkline on canvas */
  const renderSparkline = (
    canvas: HTMLCanvasElement | null,
    candles: MiniCandle[]
  ) => {
    if (!canvas || candles.length < 2) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    const closes = candles.map((c) => c.close);
    const min = Math.min(...closes);
    const max = Math.max(...closes);
    const range = max - min || 1;
    const stepX = w / (closes.length - 1);

    const isUp = closes[closes.length - 1] >= closes[0];
    const color = isUp ? "#10b981" : "#ef4444";
    const fillColor = isUp ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)";

    /* Draw filled area */
    ctx.beginPath();
    ctx.moveTo(0, h);
    closes.forEach((c, i) => {
      const x = i * stepX;
      const y = h - ((c - min) / range) * (h - 4) - 2;
      if (i === 0) ctx.lineTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fillStyle = fillColor;
    ctx.fill();

    /* Draw line */
    ctx.beginPath();
    closes.forEach((c, i) => {
      const x = i * stepX;
      const y = h - ((c - min) / range) * (h - 4) - 2;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.2;
    ctx.lineJoin = "round";
    ctx.stroke();

    /* End point dot */
    const lastX = (closes.length - 1) * stepX;
    const lastY = h - ((closes[closes.length - 1] - min) / range) * (h - 4) - 2;
    ctx.beginPath();
    ctx.arc(lastX, lastY, 1.5, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  };

  /* Redraw on data change */
  useEffect(() => {
    for (const tf of TIMEFRAMES) {
      const canvas = canvasRefs.current[tf.value];
      renderSparkline(canvas, data[tf.value] || []);
    }
  }, [data]);

  /* Redraw on resize */
  useEffect(() => {
    const handler = () => {
      for (const tf of TIMEFRAMES) {
        renderSparkline(canvasRefs.current[tf.value], data[tf.value] || []);
      }
    };
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, [data]);

  return (
    <div className="glass-panel rounded-xl overflow-hidden">
      <div className="flex items-stretch divide-x divide-border/20 divide-x-reverse">
        {TIMEFRAMES.map((tf) => {
          const candles = data[tf.value] || [];
          const isActive = tf.value === activeTimeframe;
          const lastCandle = candles[candles.length - 1];
          const firstCandle = candles[0];
          const change =
            lastCandle && firstCandle
              ? ((lastCandle.close - firstCandle.open) / firstCandle.open) * 100
              : 0;
          const isUp = change >= 0;

          return (
            <button
              key={tf.value}
              onClick={() => onSelectTimeframe(tf.value)}
              className={`flex-1 px-2 py-1.5 flex flex-col items-center gap-0.5 transition-all hover:bg-muted/20 min-w-0 ${
                isActive ? "bg-primary/10" : ""
              }`}
              title={`${pair} • ${tf.label}`}
            >
              <div className="flex items-center gap-1 w-full justify-between">
                <span
                  className={`text-[10px] font-bold ${
                    isActive ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  {tf.label}
                </span>
                {candles.length > 0 && (
                  <span
                    className={`text-[9px] font-medium tabular-nums ${
                      isUp ? "text-emerald-400" : "text-red-400"
                    }`}
                  >
                    {isUp ? "+" : ""}
                    {change.toFixed(2)}%
                  </span>
                )}
              </div>
              <canvas
                ref={(el) => {
                  canvasRefs.current[tf.value] = el;
                }}
                className="w-full h-6"
                style={{ width: "100%", height: 24 }}
              />
            </button>
          );
        })}
      </div>
      {loading && (
        <div className="absolute inset-0 bg-background/20 backdrop-blur-sm flex items-center justify-center pointer-events-none">
          <span className="h-3 w-3 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}
