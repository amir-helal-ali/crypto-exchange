"use client";

import { useMemo, useState } from "react";
import {
  Grid3x3,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import {
  PAIRS,
  CURRENCY_NAMES,
  CURRENCY_ICONS,
  formatPrice,
  formatVolume,
} from "./constants";
import type { TickerData } from "./types";

interface MarketsHeatmapProps {
  prices: Record<string, TickerData>;
  selectedPair: string;
  onSelectPair: (pair: string) => void;
}

/**
 * Markets Heatmap — visual grid of all pairs color-coded by 24h change.
 *
 * Binance/Bybit markets page feature: shows all trading pairs as tiles in a
 * responsive grid. Each tile's background color intensity reflects the
 * magnitude of the 24h price change (green for gains, red for losses).
 * Tile size can optionally scale by volume (top volume pairs get bigger tiles).
 *
 * Click any tile to switch the main chart to that pair.
 */
export default function MarketsHeatmap({
  prices,
  selectedPair,
  onSelectPair,
}: MarketsHeatmapProps) {
  const [size, setSize] = useState<"compact" | "large">("compact");
  const [sortBy, setSortBy] = useState<"change" | "volume" | "name">("change");

  /* Build tiles */
  const tiles = useMemo(() => {
    return PAIRS.map((pair) => {
      const base = pair.replace("USDT", "");
      const p = prices[pair];
      const change = p ? parseFloat(p.change) : 0;
      const volume = p?.quoteVolume ? parseFloat(p.quoteVolume) : 0;
      const price = p?.price || 0;
      return {
        pair,
        base,
        name: CURRENCY_NAMES[base] || base,
        icon: CURRENCY_ICONS[base] || "●",
        price,
        change,
        volume,
      };
    });
  }, [prices]);

  /* Sort tiles */
  const sorted = useMemo(() => {
    const list = [...tiles];
    if (sortBy === "change") {
      list.sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
    } else if (sortBy === "volume") {
      list.sort((a, b) => b.volume - a.volume);
    } else {
      list.sort((a, b) => a.base.localeCompare(b.base));
    }
    return list.filter((t) => t.price > 0);
  }, [tiles, sortBy]);

  /* Color based on change magnitude */
  const getColor = (change: number) => {
    if (change === 0) return { bg: "rgba(100,100,100,0.15)", text: "text-muted-foreground" };
    const absChange = Math.min(Math.abs(change), 10);
    const intensity = 0.15 + (absChange / 10) * 0.6;
    if (change > 0) {
      return {
        bg: `rgba(16,185,129,${intensity})`,
        text: "text-emerald-100",
      };
    }
    return {
      bg: `rgba(239,68,68,${intensity})`,
      text: "text-red-100",
    };
  };

  return (
    <div className="glass-panel rounded-xl flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-2.5 py-2 border-b border-border/20 shrink-0">
        <div className="flex items-center gap-1.5">
          <Grid3x3 className="h-3.5 w-3.5 text-primary" />
          <h3 className="font-bold text-[11px]">خريطة الأسواق الحرارية</h3>
        </div>
        <div className="flex items-center gap-1">
          {/* Sort selector */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="bg-muted/30 border border-border/30 rounded text-[9px] py-0.5 px-1 text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/30 cursor-pointer"
            title="ترتيب حسب"
          >
            <option value="change">التغيّر</option>
            <option value="volume">الحجم</option>
            <option value="name">الاسم</option>
          </select>
          {/* Size toggle */}
          <button
            onClick={() => setSize(size === "compact" ? "large" : "compact")}
            className="p-0.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-all"
            title={size === "compact" ? "عرض كبير" : "عرض مضغوط"}
          >
            <Grid3x3 className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Tiles grid */}
      <div className="flex-1 overflow-y-auto p-1.5">
        <div
          className={`grid gap-1 ${
            size === "compact"
              ? "grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-4 xl:grid-cols-5"
              : "grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-3 xl:grid-cols-4"
          }`}
        >
          {sorted.map((tile) => {
            const color = getColor(tile.change);
            const isActive = tile.pair === selectedPair;
            const isUp = tile.change >= 0;
            return (
              <button
                key={tile.pair}
                onClick={() => onSelectPair(tile.pair)}
                className={`relative rounded-md p-1.5 transition-all hover:scale-105 hover:z-10 hover:shadow-lg ${
                  isActive ? "ring-2 ring-primary" : ""
                } ${size === "large" ? "min-h-[70px]" : "min-h-[55px]"}`}
                style={{ backgroundColor: color.bg }}
                title={`${tile.base}/USDT • ${tile.change >= 0 ? "+" : ""}${tile.change.toFixed(2)}% • Vol: ${formatVolume(tile.volume)}`}
              >
                {/* Top row: icon + change */}
                <div className="flex items-center justify-between text-[9px] mb-0.5">
                  <span className={`text-primary font-bold ${color.text}`}>
                    {tile.icon}
                  </span>
                  <span
                    className={`flex items-center gap-0.5 font-bold tabular-nums ${
                      isUp ? "text-emerald-300" : "text-red-300"
                    }`}
                  >
                    {isUp ? (
                      <TrendingUp className="h-2 w-2" />
                    ) : (
                      <TrendingDown className="h-2 w-2" />
                    )}
                    {isUp ? "+" : ""}
                    {tile.change.toFixed(1)}%
                  </span>
                </div>
                {/* Base currency name */}
                <div className={`font-bold text-[10px] leading-tight ${color.text}`}>
                  {tile.base}
                </div>
                {/* Price */}
                <div className={`text-[8px] tabular-nums opacity-80 ${color.text}`}>
                  {formatPrice(tile.price)}
                </div>
                {/* Volume (only in large mode) */}
                {size === "large" && tile.volume > 0 && (
                  <div className={`text-[7px] tabular-nums opacity-60 ${color.text}`}>
                    {formatVolume(tile.volume)}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
