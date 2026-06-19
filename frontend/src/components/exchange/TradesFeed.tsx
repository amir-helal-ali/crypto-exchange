"use client";

import { useEffect, useState } from "react";
import { Activity } from "lucide-react";
import { formatTime, pricePrecision, qtyPrecision } from "./constants";
import type { MarketTrade } from "./types";

interface TradesFeedProps {
  trades: MarketTrade[];
  base: string;
  onPriceClick?: (price: number) => void;
  maxRows?: number;
}

/**
 * Real-time trades feed showing recent market trades.
 * New trades animate in with a flash effect.
 * Buy/sell direction is color-coded.
 */
export default function TradesFeed({
  trades,
  base,
  onPriceClick,
  maxRows = 30,
}: TradesFeedProps) {
  const [flashIds, setFlashIds] = useState<Set<number>>(new Set());

  /* Track newly added trades to flash them */
  const [prevIds, setPrevIds] = useState<Set<number>>(new Set());
  useEffect(() => {
    const newIds = new Set<number>();
    trades.forEach((t) => {
      if (!prevIds.has(t.id)) newIds.add(t.id);
    });
    if (newIds.size > 0) {
      setFlashIds(newIds);
      setPrevIds(new Set(trades.map((t) => t.id)));
      const t = setTimeout(() => setFlashIds(new Set()), 600);
      return () => clearTimeout(t);
    }
  }, [trades]); // eslint-disable-line

  return (
    <div className="glass-panel rounded-xl flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-2.5 py-2 border-b border-border/20 shrink-0">
        <div className="flex items-center gap-1.5">
          <Activity className="h-3.5 w-3.5 text-primary" />
          <h3 className="font-bold text-[11px]">آخر الصفقات</h3>
        </div>
        <span className="text-[9px] text-muted-foreground">{base}/USDT</span>
      </div>

      {/* Column headers */}
      <div className="flex items-center px-2.5 py-1 text-[9px] text-muted-foreground/60 border-b border-border/10 shrink-0 font-medium">
        <span className="w-1/3">السعر (USDT)</span>
        <span className="w-1/3 text-center">الكمية ({base})</span>
        <span className="w-1/3 text-left">الوقت</span>
      </div>

      {/* Rows */}
      <div className="flex-1 overflow-y-auto">
        {trades.length === 0 ? (
          <div className="py-6 text-center text-[10px] text-muted-foreground">
            لا توجد صفقات بعد
          </div>
        ) : (
          trades.slice(0, maxRows).map((trade, i) => {
            const isSell = trade.isBuyerMaker; // maker is buyer => taker is seller
            const isFlashing = flashIds.has(trade.id);
            const pPrec = pricePrecision(trade.price);
            const qPrec = qtyPrecision(trade.qty);
            return (
              <div
                key={`${trade.id}-${i}`}
                onClick={() => onPriceClick?.(trade.price)}
                className={`relative flex items-center px-2.5 py-[3px] text-[10px] hover:bg-muted/10 transition-colors cursor-pointer ${
                  isFlashing
                    ? isSell
                      ? "bg-red-500/10 animate-slide-in-down"
                      : "bg-emerald-500/10 animate-slide-in-down"
                    : ""
                }`}
              >
                <span
                  className={`w-1/3 tabular-nums font-medium ${
                    isSell ? "text-red-400" : "text-emerald-400"
                  }`}
                >
                  {trade.price.toFixed(pPrec)}
                </span>
                <span className="w-1/3 text-center text-muted-foreground tabular-nums">
                  {trade.qty.toFixed(qPrec)}
                </span>
                <span className="w-1/3 text-left text-muted-foreground/70 tabular-nums">
                  {formatTime(trade.time)}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
