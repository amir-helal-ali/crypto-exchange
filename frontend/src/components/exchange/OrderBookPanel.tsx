"use client";

import { useMemo } from "react";
import { BookOpen, TrendingUp, TrendingDown } from "lucide-react";
import {
  formatPrice,
  pricePrecision,
  qtyPrecision,
} from "./constants";
import type { OrderBookEntry, TickerData } from "./types";

interface OrderBookPanelProps {
  bids: [string, string][];
  asks: [string, string][];
  ticker?: TickerData;
  prevPrice?: number;
  base: string;
  onPriceClick?: (price: number) => void;
  maxRows?: number;
}

/**
 * Professional order book with:
 * - Cumulative depth bars (both sides)
 * - Spread display
 * - Current price highlight with color flash on change
 * - Bid/Ask volume ratio bar
 */
export default function OrderBookPanel({
  bids,
  asks,
  ticker,
  prevPrice,
  base,
  onPriceClick,
  maxRows = 11,
}: OrderBookPanelProps) {
  /* Build processed entries with cumulative depth */
  const { askEntries, bidEntries, maxCumulative } = useMemo(() => {
    const asksRaw = asks.slice(0, maxRows);
    const bidsRaw = bids.slice(0, maxRows);

    let cumA = 0;
    const askEntries: OrderBookEntry[] = asksRaw.map((a) => {
      const price = parseFloat(a[0]);
      const qty = parseFloat(a[1]);
      cumA += qty;
      return {
        price,
        qty,
        total: qty * price,
        cumulative: cumA,
        depthPercent: 0, // set below
      };
    });

    let cumB = 0;
    const bidEntries: OrderBookEntry[] = bidsRaw.map((b) => {
      const price = parseFloat(b[0]);
      const qty = parseFloat(b[1]);
      cumB += qty;
      return {
        price,
        qty,
        total: qty * price,
        cumulative: cumB,
        depthPercent: 0,
      };
    });

    const maxCumulative = Math.max(cumA, cumB, 0.0001);

    askEntries.forEach((e) => {
      e.depthPercent = (e.cumulative / maxCumulative) * 100;
    });
    bidEntries.forEach((e) => {
      e.depthPercent = (e.cumulative / maxCumulative) * 100;
    });

    return { askEntries, bidEntries, maxCumulative };
  }, [bids, asks, maxRows]);

  /* Spread calculations */
  const bestAsk = askEntries[0]?.price || 0;
  const bestBid = bidEntries[0]?.price || 0;
  const spread = bestAsk && bestBid ? bestAsk - bestBid : 0;
  const spreadPercent =
    spread && bestBid ? (spread / bestBid) * 100 : 0;

  /* Total volumes */
  const totalBidVol = bidEntries.reduce((s, e) => s + e.qty, 0);
  const totalAskVol = askEntries.reduce((s, e) => s + e.qty, 0);
  const bidRatio =
    totalBidVol + totalAskVol > 0
      ? (totalBidVol / (totalBidVol + totalAskVol)) * 100
      : 50;

  /* Current price color */
  const currentPrice = ticker?.price || bestBid;
  const priceUp =
    ticker && prevPrice !== undefined
      ? currentPrice >= prevPrice
      : true;
  const priceColor = priceUp ? "text-emerald-400" : "text-red-400";

  const renderAskRow = (entry: OrderBookEntry, idx: number) => {
    const pPrec = pricePrecision(entry.price);
    const qPrec = qtyPrecision(entry.qty);
    return (
      <div
        key={`ask-${idx}`}
        onClick={() => onPriceClick?.(entry.price)}
        className="relative flex items-center px-2.5 py-[2px] text-[10px] hover:bg-red-500/5 transition-colors cursor-pointer group"
      >
        {/* Depth bar */}
        <div
          className="absolute top-0 left-0 h-full bg-red-500/[0.08] transition-all duration-200 group-hover:bg-red-500/[0.12]"
          style={{ width: `${entry.depthPercent}%` }}
        />
        <span className="relative w-1/3 text-red-400 font-medium tabular-nums">
          {entry.price.toFixed(pPrec)}
        </span>
        <span className="relative w-1/3 text-center text-muted-foreground tabular-nums">
          {entry.qty.toFixed(qPrec)}
        </span>
        <span className="relative w-1/3 text-left text-muted-foreground/70 tabular-nums">
          {entry.total.toFixed(2)}
        </span>
      </div>
    );
  };

  const renderBidRow = (entry: OrderBookEntry, idx: number) => {
    const pPrec = pricePrecision(entry.price);
    const qPrec = qtyPrecision(entry.qty);
    return (
      <div
        key={`bid-${idx}`}
        onClick={() => onPriceClick?.(entry.price)}
        className="relative flex items-center px-2.5 py-[2px] text-[10px] hover:bg-emerald-500/5 transition-colors cursor-pointer group"
      >
        <div
          className="absolute top-0 left-0 h-full bg-emerald-500/[0.08] transition-all duration-200 group-hover:bg-emerald-500/[0.12]"
          style={{ width: `${entry.depthPercent}%` }}
        />
        <span className="relative w-1/3 text-emerald-400 font-medium tabular-nums">
          {entry.price.toFixed(pPrec)}
        </span>
        <span className="relative w-1/3 text-center text-muted-foreground tabular-nums">
          {entry.qty.toFixed(qPrec)}
        </span>
        <span className="relative w-1/3 text-left text-muted-foreground/70 tabular-nums">
          {entry.total.toFixed(2)}
        </span>
      </div>
    );
  };

  return (
    <div className="glass-panel rounded-xl flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-2.5 py-2 border-b border-border/20 shrink-0">
        <div className="flex items-center gap-1.5">
          <BookOpen className="h-3.5 w-3.5 text-primary" />
          <h3 className="font-bold text-[11px]">دفتر الأوامر</h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[9px] text-muted-foreground">{base}/USDT</span>
          <div
            className={`flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded ${
              bidRatio >= 50
                ? "bg-emerald-500/10 text-emerald-400"
                : "bg-red-500/10 text-red-400"
            }`}
          >
            {bidRatio >= 50 ? (
              <TrendingUp className="h-2.5 w-2.5" />
            ) : (
              <TrendingDown className="h-2.5 w-2.5" />
            )}
            {bidRatio.toFixed(0)}%
          </div>
        </div>
      </div>

      {/* Column headers */}
      <div className="flex items-center px-2.5 py-1 text-[9px] text-muted-foreground/60 border-b border-border/10 shrink-0 font-medium">
        <span className="w-1/3">السعر (USDT)</span>
        <span className="w-1/3 text-center">الكمية ({base})</span>
        <span className="w-1/3 text-left">الإجمالي</span>
      </div>

      {/* Asks (reversed so best ask is at the bottom, near the spread) */}
      <div className="flex-1 overflow-y-auto min-h-0 flex flex-col-reverse">
        {askEntries.length === 0 ? (
          <div className="py-3 text-center text-[10px] text-muted-foreground">
            لا توجد أوامر بيع
          </div>
        ) : (
          askEntries.map(renderAskRow)
        )}
      </div>

      {/* Spread / Current Price */}
      <div className="flex items-center justify-between px-2.5 py-1.5 border-y border-border/20 bg-muted/10 shrink-0">
        <div className="flex items-center gap-1.5">
          <span className={`text-[13px] font-bold tabular-nums ${priceColor}`}>
            {currentPrice > 0
              ? currentPrice.toFixed(pricePrecision(currentPrice))
              : "—"}
          </span>
          {ticker && (
            <span
              className={`text-[9px] font-bold px-1 py-0.5 rounded inline-flex items-center gap-0.5 ${
                parseFloat(ticker.change) >= 0
                  ? "bg-emerald-500/10 text-emerald-400"
                  : "bg-red-500/10 text-red-400"
              }`}
            >
              {parseFloat(ticker.change) >= 0 ? (
                <TrendingUp className="h-2.5 w-2.5" />
              ) : (
                <TrendingDown className="h-2.5 w-2.5" />
              )}
              {parseFloat(ticker.change) >= 0 ? "+" : ""}
              {parseFloat(ticker.change).toFixed(2)}%
            </span>
          )}
        </div>
        {spread > 0 && (
          <span className="text-[9px] text-muted-foreground tabular-nums">
            فجوة: {spread.toFixed(pricePrecision(spread))} ({spreadPercent.toFixed(3)}%)
          </span>
        )}
      </div>

      {/* Bids */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {bidEntries.length === 0 ? (
          <div className="py-3 text-center text-[10px] text-muted-foreground">
            لا توجد أوامر شراء
          </div>
        ) : (
          bidEntries.map(renderBidRow)
        )}
      </div>

      {/* Bid/Ask volume ratio bar */}
      <div className="px-2.5 py-1.5 border-t border-border/10 shrink-0">
        <div className="flex items-center gap-2 text-[9px]">
          <span className="text-emerald-400 tabular-nums w-20 text-right">
            {totalBidVol.toFixed(4)}
          </span>
          <div className="flex-1 h-1.5 rounded-full bg-red-500/30 overflow-hidden flex">
            <div
              className="h-full bg-emerald-500 transition-all duration-300"
              style={{ width: `${bidRatio}%` }}
            />
          </div>
          <span className="text-red-400 tabular-nums w-20">
            {totalAskVol.toFixed(4)}
          </span>
        </div>
      </div>
    </div>
  );
}
