"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Calculator,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Target,
} from "lucide-react";
import { formatPrice } from "./constants";

interface CheatSheetProps {
  pair: string;
  currentPrice?: number;
}

type Method = "classic" | "fibonacci" | "camarilla";

interface PivotLevels {
  P: number;
  R1: number;
  R2: number;
  R3: number;
  S1: number;
  S2: number;
  S3: number;
}

/**
 * Trader's Cheat Sheet — auto-calculated pivot points & support/resistance.
 *
 * Based on the previous day's High / Low / Close from Binance's daily candles.
 *
 * Three methods supported:
 * - Classic (Standard): P = (H + L + C) / 3
 * - Fibonacci: P, R/S levels at 0.382, 0.618, 1.000, 1.382, 1.618 extensions
 * - Camarilla: emphasizes R3/S3 with multiplier formulas
 *
 * Shows current price position relative to each level (above/below).
 */
export default function CheatSheet({ pair, currentPrice }: CheatSheetProps) {
  const [method, setMethod] = useState<Method>("classic");
  const [prevDay, setPrevDay] = useState<{
    high: number;
    low: number;
    close: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  /* Fetch previous day's H/L/C from Binance daily candles */
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(
      `https://api.binance.com/api/v3/klines?symbol=${pair}&interval=1d&limit=3`
    )
      .then((r) => r.json())
      .then((data) => {
        if (cancelled || !Array.isArray(data) || data.length < 2) return;
        /* Use second-to-last candle as "previous day" (last one is still forming) */
        const prev = data[data.length - 2];
        setPrevDay({
          high: parseFloat(prev[2]),
          low: parseFloat(prev[3]),
          close: parseFloat(prev[4]),
        });
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [pair]);

  /* Calculate pivot levels based on selected method */
  const levels = useMemo<PivotLevels | null>(() => {
    if (!prevDay) return null;
    const { high: H, low: L, close: C } = prevDay;

    if (method === "classic") {
      const P = (H + L + C) / 3;
      const R1 = 2 * P - L;
      const S1 = 2 * P - H;
      const R2 = P + (H - L);
      const S2 = P - (H - L);
      const R3 = H + 2 * (P - L);
      const S3 = L - 2 * (H - P);
      return { P, R1, R2, R3, S1, S2, S3 };
    }

    if (method === "fibonacci") {
      const P = (H + L + C) / 3;
      const R1 = P + 0.382 * (H - L);
      const S1 = P - 0.382 * (H - L);
      const R2 = P + 0.618 * (H - L);
      const S2 = P - 0.618 * (H - L);
      const R3 = P + 1.0 * (H - L);
      const S3 = P - 1.0 * (H - L);
      return { P, R1, R2, R3, S1, S2, S3 };
    }

    /* Camarilla */
    const P = (H + L + C) / 3;
    const R1 = C + 1.1 * (H - L) / 12;
    const S1 = C - 1.1 * (H - L) / 12;
    const R2 = C + 1.1 * (H - L) / 6;
    const S2 = C - 1.1 * (H - L) / 6;
    const R3 = C + 1.1 * (H - L) / 4;
    const S3 = C - 1.1 * (H - L) / 4;
    return { P, R1, R2, R3, S1, S2, S3 };
  }, [prevDay, method]);

  /* Compute current price position */
  const position = useMemo(() => {
    if (!levels || !currentPrice) return null;
    const all = [
      { name: "R3", value: levels.R3, type: "resistance" },
      { name: "R2", value: levels.R2, type: "resistance" },
      { name: "R1", value: levels.R1, type: "resistance" },
      { name: "P", value: levels.P, type: "pivot" },
      { name: "S1", value: levels.S1, type: "support" },
      { name: "S2", value: levels.S2, type: "support" },
      { name: "S3", value: levels.S3, type: "support" },
    ].sort((a, b) => b.value - a.value);

    for (let i = 0; i < all.length - 1; i++) {
      if (currentPrice <= all[i].value && currentPrice >= all[i + 1].value) {
        return {
          above: all[i],
          below: all[i + 1],
          distanceAbove: ((all[i].value - currentPrice) / currentPrice) * 100,
          distanceBelow: ((currentPrice - all[i + 1].value) / currentPrice) * 100,
        };
      }
    }
    if (currentPrice > all[0].value) {
      return {
        above: null,
        below: all[0],
        distanceAbove: 0,
        distanceBelow: ((currentPrice - all[0].value) / currentPrice) * 100,
      };
    }
    return {
      above: all[all.length - 1],
      below: null,
      distanceAbove: ((all[all.length - 1].value - currentPrice) / currentPrice) * 100,
      distanceBelow: 0,
    };
  }, [levels, currentPrice]);

  /* Render a single level row */
  const renderLevel = (name: string, value: number, type: "resistance" | "support" | "pivot") => {
    const isAbove = currentPrice !== undefined && currentPrice > value;
    const isBelow = currentPrice !== undefined && currentPrice < value;
    const color =
      type === "resistance"
        ? "text-red-400"
        : type === "support"
          ? "text-emerald-400"
          : "text-yellow-400";
    const bg =
      type === "resistance"
        ? "bg-red-500/5"
        : type === "support"
          ? "bg-emerald-500/5"
          : "bg-yellow-500/10";

    return (
      <div
        key={name}
        className={`flex items-center justify-between px-2 py-1 rounded text-[10px] ${bg} ${
          isAbove ? "opacity-100" : "opacity-90"
        }`}
      >
        <div className="flex items-center gap-1.5">
          <span className={`font-bold ${color}`}>{name}</span>
          {type === "pivot" && <Target className="h-2.5 w-2.5 text-yellow-400" />}
        </div>
        <div className="flex items-center gap-2">
          <span className="tabular-nums font-medium">{formatPrice(value)}</span>
          {currentPrice !== undefined && (
            <span
              className={`text-[8px] tabular-nums w-10 text-left ${
                isAbove ? "text-emerald-400" : isBelow ? "text-red-400" : "text-muted-foreground"
              }`}
            >
              {isAbove
                ? `+${(((currentPrice - value) / value) * 100).toFixed(2)}%`
                : isBelow
                  ? `${(((currentPrice - value) / value) * 100).toFixed(2)}%`
                  : "—"}
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="glass-panel rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-2.5 py-2 border-b border-border/20">
        <div className="flex items-center gap-1.5">
          <Calculator className="h-3.5 w-3.5 text-primary" />
          <h3 className="font-bold text-[11px]">ورقة الغش التداولية</h3>
        </div>
        <div className="flex items-center gap-0.5 bg-muted/20 rounded-md p-0.5">
          {(["classic", "fibonacci", "camarilla"] as Method[]).map((m) => (
            <button
              key={m}
              onClick={() => setMethod(m)}
              className={`px-2 py-0.5 rounded text-[9px] font-medium transition-all ${
                method === m
                  ? "bg-primary/20 text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {m === "classic" ? "كلاسيكي" : m === "fibonacci" ? "فيبوناتشي" : "كاماريلا"}
            </button>
          ))}
        </div>
      </div>

      {/* Body */}
      <div className="p-2 space-y-1">
        {loading ? (
          <div className="py-3 flex items-center justify-center">
            <RefreshCw className="h-3 w-3 animate-spin text-muted-foreground" />
          </div>
        ) : !levels ? (
          <div className="py-3 text-center text-[10px] text-muted-foreground">
            لا توجد بيانات كافية
          </div>
        ) : (
          <>
            {/* Current price position */}
            {position && currentPrice && (
              <div className="glass-panel rounded-lg p-2 mb-1.5 text-[10px]">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-muted-foreground">الموضع الحالي</span>
                  <span className="font-bold tabular-nums">
                    {formatPrice(currentPrice)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">أقرب مستوى</span>
                  {position.above ? (
                    <span className="text-emerald-400 flex items-center gap-1">
                      <TrendingUp className="h-2.5 w-2.5" />
                      فوق {position.above.name} ({position.distanceAbove.toFixed(2)}%)
                    </span>
                  ) : position.below ? (
                    <span className="text-red-400 flex items-center gap-1">
                      <TrendingDown className="h-2.5 w-2.5" />
                      تحت {position.below.name} ({position.distanceBelow.toFixed(2)}%)
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </div>
              </div>
            )}

            {/* Resistance levels (reversed so R3 is at top) */}
            {renderLevel("R3", levels.R3, "resistance")}
            {renderLevel("R2", levels.R2, "resistance")}
            {renderLevel("R1", levels.R1, "resistance")}
            {/* Pivot */}
            {renderLevel("P", levels.P, "pivot")}
            {/* Support levels */}
            {renderLevel("S1", levels.S1, "support")}
            {renderLevel("S2", levels.S2, "support")}
            {renderLevel("S3", levels.S3, "support")}
          </>
        )}
      </div>
    </div>
  );
}
