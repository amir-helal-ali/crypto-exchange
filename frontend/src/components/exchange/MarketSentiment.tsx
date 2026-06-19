"use client";

import { useMemo } from "react";
import { Activity, Users, Gauge } from "lucide-react";
import { formatVolume } from "./constants";
import type { MarketTrade, TickerData } from "./types";

interface MarketSentimentProps {
  ticker?: TickerData;
  trades: MarketTrade[];
  base: string;
  className?: string;
}

/**
 * Market Sentiment widget showing:
 * - Buy/Sell pressure gauge based on recent taker trades
 * - Long/Short ratio estimation based on trade flow
 * - Taker buy/sell volume breakdown
 *
 * This mimics Binance's "Long/Short Ratio" and Bybit's sentiment widget.
 * Buy/sell pressure is derived from recent market trades:
 *   - isBuyerMaker=false → taker is buyer (aggressive buy)
 *   - isBuyerMaker=true → taker is seller (aggressive sell)
 */
export default function MarketSentiment({
  ticker,
  trades,
  base,
  className = "",
}: MarketSentimentProps) {
  /* Compute buy/sell pressure from trades */
  const stats = useMemo(() => {
    if (trades.length === 0) {
      return {
        buyVol: 0,
        sellVol: 0,
        buyCount: 0,
        sellCount: 0,
        buyPercent: 50,
        sellPercent: 50,
      };
    }
    let buyVol = 0;
    let sellVol = 0;
    let buyCount = 0;
    let sellCount = 0;
    for (const t of trades) {
      if (t.isBuyerMaker) {
        sellVol += t.qty;
        sellCount++;
      } else {
        buyVol += t.qty;
        buyCount++;
      }
    }
    const total = buyVol + sellVol;
    return {
      buyVol,
      sellVol,
      buyCount,
      sellCount,
      buyPercent: total > 0 ? (buyVol / total) * 100 : 50,
      sellPercent: total > 0 ? (sellVol / total) * 100 : 50,
    };
  }, [trades]);

  /* Long/Short ratio estimate */
  const longShortRatio = useMemo(() => {
    if (stats.buyPercent === 50) return "1.00";
    const ratio = stats.buyPercent / Math.max(stats.sellPercent, 0.01);
    return ratio.toFixed(2);
  }, [stats]);

  const isBullish = stats.buyPercent > 55;
  const isBearish = stats.sellPercent > 55;
  const sentimentLabel = isBullish
    ? "صعودي"
    : isBearish
      ? "هبوطي"
      : "محايد";
  const sentimentColor = isBullish
    ? "text-emerald-400"
    : isBearish
      ? "text-red-400"
      : "text-yellow-400";

  return (
    <div className={`glass-panel rounded-xl p-2.5 space-y-2.5 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Gauge className="h-3.5 w-3.5 text-primary" />
          <h3 className="font-bold text-[11px]">مشاعر السوق</h3>
        </div>
        <span className="text-[9px] text-muted-foreground">{base}/USDT</span>
      </div>

      {/* Sentiment gauge - half-circle */}
      <div className="flex flex-col items-center py-1">
        <div className="relative w-32 h-16 overflow-hidden">
          <svg viewBox="0 0 100 50" className="w-full h-full">
            {/* Background arc */}
            <path
              d="M 5 50 A 45 45 0 0 1 95 50"
              fill="none"
              stroke="rgba(255,255,255,0.08)"
              strokeWidth="8"
              strokeLinecap="round"
            />
            {/* Buy (green) arc */}
            <path
              d="M 5 50 A 45 45 0 0 1 95 50"
              fill="none"
              stroke="#10b981"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={`${(stats.buyPercent / 100) * 141.4} 141.4`}
              className="transition-all duration-500"
            />
            {/* Needle */}
            <g
              className="transition-transform duration-500"
              style={{
                transform: `rotate(${180 - (stats.buyPercent / 100) * 180}deg)`,
                transformOrigin: "50px 50px",
              }}
            >
              <line
                x1="50"
                y1="50"
                x2="50"
                y2="12"
                stroke="currentColor"
                strokeWidth="1.5"
                className="text-foreground"
              />
            </g>
            <circle cx="50" cy="50" r="3" className="fill-foreground" />
          </svg>
        </div>
        <div className="text-center -mt-1">
          <div className={`text-sm font-bold ${sentimentColor}`}>
            {sentimentLabel}
          </div>
          <div className="text-[9px] text-muted-foreground tabular-nums">
            شراء {stats.buyPercent.toFixed(1)}%
          </div>
        </div>
      </div>

      {/* Buy/Sell volume bar */}
      <div>
        <div className="flex items-center justify-between text-[9px] mb-1">
          <span className="text-emerald-400 font-medium flex items-center gap-0.5">
            <Users className="h-2.5 w-2.5" />
            شراء {stats.buyCount}
          </span>
          <span className="text-red-400 font-medium flex items-center gap-0.5">
            بيع {stats.sellCount}
            <Users className="h-2.5 w-2.5" />
          </span>
        </div>
        <div className="h-2 rounded-full bg-red-500/30 overflow-hidden flex">
          <div
            className="h-full bg-emerald-500 transition-all duration-300"
            style={{ width: `${stats.buyPercent}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-[9px] mt-1 tabular-nums">
          <span className="text-emerald-400">
            {formatVolume(stats.buyVol)} {base}
          </span>
          <span className="text-red-400">
            {formatVolume(stats.sellVol)} {base}
          </span>
        </div>
      </div>

      {/* Long/Short ratio */}
      <div className="glass-panel rounded-lg p-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Activity className="h-3 w-3 text-muted-foreground" />
          <div>
            <div className="text-[9px] text-muted-foreground">
              نسبة شراء/بيع
            </div>
            <div className={`text-xs font-bold tabular-nums ${sentimentColor}`}>
              {longShortRatio}
            </div>
          </div>
        </div>
        {ticker && (
          <div className="text-left">
            <div className="text-[9px] text-muted-foreground">حجم 24س</div>
            <div className="text-[10px] font-medium tabular-nums">
              {formatVolume(parseFloat(ticker.quoteVolume || "0"))} USDT
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
