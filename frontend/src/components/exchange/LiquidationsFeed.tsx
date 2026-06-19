"use client";

import { useEffect, useState, useMemo } from "react";
import { Zap, RefreshCw } from "lucide-react";
import { formatPrice, formatVolume, formatTime } from "./constants";

interface Liquidation {
  symbol: string;
  side: "BUY" | "SELL"; // BUY = long liquidation, SELL = short liquidation
  price: number;
  qty: number;
  value: number;
  time: number;
}

interface LiquidationsFeedProps {
  pair: string;
  base: string;
  maxRows?: number;
}

/**
 * Real-time Liquidations Feed — Binance Futures API.
 *
 * Connects to Binance's !forceOrder@arr WebSocket stream to receive
 * real-time liquidation events across all symbols. Filters and displays
 * the most recent liquidations, highlighting large ones.
 *
 * Visual indicators:
 * - Long liquidations (forced sell) shown in red
 * - Short liquidations (forced buy) shown in green
 * - Large liquidations (> $100k) get a ⚡ badge
 */
export default function LiquidationsFeed({
  pair,
  base,
  maxRows = 25,
}: LiquidationsFeedProps) {
  const [liquidations, setLiquidations] = useState<Liquidation[]>([]);
  const [filterPair, setFilterPair] = useState(false);
  const [total24h, setTotal24h] = useState<{ long: number; short: number }>({
    long: 0,
    short: 0,
  });

  /* Connect to Binance all-liquidations WebSocket stream */
  useEffect(() => {
    const ws = new WebSocket("wss://fstream.binance.com/ws/!forceOrder@arr");
    ws.onmessage = (e) => {
      try {
        const d = JSON.parse(e.data);
        if (d.o) {
          const liq: Liquidation = {
            symbol: d.o.s,
            side: d.o.S, // SELL = long liq, BUY = short liq
            price: parseFloat(d.o.ap),
            qty: parseFloat(d.o.q),
            value: parseFloat(d.o.q) * parseFloat(d.o.ap),
            time: d.o.T,
          };
          setLiquidations((prev) => [liq, ...prev].slice(0, maxRows));

          /* Track 24h totals */
          setTotal24h((prev) => {
            if (liq.side === "SELL") {
              return { ...prev, long: prev.long + liq.value };
            } else {
              return { ...prev, short: prev.short + liq.value };
            }
          });
        }
      } catch {}
    };
    return () => ws.close();
  }, [maxRows]);

  /* Filter by current pair */
  const filtered = useMemo(() => {
    return filterPair
      ? liquidations.filter((l) => l.symbol === pair)
      : liquidations;
  }, [liquidations, filterPair, pair]);

  /* Stats */
  const recentValue = filtered.reduce((s, l) => s + l.value, 0);
  const largestInFeed = Math.max(...filtered.map((l) => l.value), 0);

  return (
    <div className="glass-panel rounded-xl flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-2.5 py-2 border-b border-border/20 shrink-0">
        <div className="flex items-center gap-1.5">
          <Zap className="h-3.5 w-3.5 text-orange-400" />
          <h3 className="font-bold text-[11px]">التصفيات القسرية</h3>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setFilterPair(!filterPair)}
            className={`text-[9px] px-1.5 py-0.5 rounded transition-all ${
              filterPair
                ? "bg-orange-500/20 text-orange-400"
                : "text-muted-foreground hover:bg-muted/30"
            }`}
            title={filterPair ? "عرض كل الأزواج" : "فلترة بالزوج الحالي"}
          >
            {filterPair ? base : "الكل"}
          </button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 gap-1 px-2 py-1.5 border-b border-border/10 shrink-0 text-[9px]">
        <div className="text-center">
          <div className="text-red-400 flex items-center justify-center gap-0.5">
            <RefreshCw className="h-2 w-2" />
            تصفيات لونغ
          </div>
          <div className="font-bold tabular-nums">
            ${formatVolume(total24h.long)}
          </div>
        </div>
        <div className="text-center">
          <div className="text-emerald-400">تصفيات شورت</div>
          <div className="font-bold tabular-nums">
            ${formatVolume(total24h.short)}
          </div>
        </div>
      </div>

      {/* Column headers */}
      <div className="flex items-center px-2 py-1 text-[9px] text-muted-foreground/60 border-b border-border/10 shrink-0 font-medium">
        <span className="w-12">الزوج</span>
        <span className="flex-1 text-right">السعر</span>
        <span className="w-16 text-left">القيمة</span>
        <span className="w-12 text-left">الوقت</span>
      </div>

      {/* Rows */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {filtered.length === 0 ? (
          <div className="py-4 text-center text-[10px] text-muted-foreground">
            <Zap className="h-4 w-4 text-muted-foreground/30 mx-auto mb-1" />
            في انتظار أحداث التصفية...
          </div>
        ) : (
          filtered.map((liq, idx) => {
            const isLongLiq = liq.side === "SELL"; // forced sell = long liquidation
            const isLarge = liq.value > 100000; // > $100k
            const intensity = Math.min(1, liq.value / Math.max(largestInFeed, 1));
            const liqBase = liq.symbol.replace("USDT", "");
            return (
              <div
                key={idx}
                className="relative flex items-center px-2 py-[3px] text-[10px] hover:bg-muted/5 transition-colors"
              >
                {/* Background bar based on intensity */}
                <div
                  className="absolute top-0 left-0 h-full"
                  style={{
                    width: `${20 + intensity * 80}%`,
                    backgroundColor: isLongLiq
                      ? `rgba(239,68,68,${0.05 + intensity * 0.15})`
                      : `rgba(16,185,129,${0.05 + intensity * 0.15})`,
                  }}
                />
                <span className="relative w-12 font-medium flex items-center gap-0.5">
                  {isLarge && <Zap className="h-2 w-2 text-orange-400" />}
                  {liqBase}
                </span>
                <span
                  className={`relative flex-1 text-right tabular-nums font-medium ${
                    isLongLiq ? "text-red-400" : "text-emerald-400"
                  }`}
                >
                  {formatPrice(liq.price)}
                </span>
                <span className="relative w-16 text-left tabular-nums font-medium">
                  ${formatVolume(liq.value)}
                </span>
                <span className="relative w-12 text-left text-muted-foreground/70 tabular-nums">
                  {formatTime(liq.time)}
                </span>
              </div>
            );
          })
        )}
      </div>

      {/* Footer total */}
      {filtered.length > 0 && (
        <div className="px-2 py-1 border-t border-border/10 shrink-0 flex items-center justify-between text-[9px]">
          <span className="text-muted-foreground">إجمالي {filtered.length} حدث</span>
          <span className="font-medium tabular-nums">
            ${formatVolume(recentValue)}
          </span>
        </div>
      )}
    </div>
  );
}
