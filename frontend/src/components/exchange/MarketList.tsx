"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { Search, Star, X, Flame, TrendingUp, TrendingDown, BarChart3 } from "lucide-react";
import {
  PAIRS,
  CURRENCY_NAMES,
  CURRENCY_ICONS,
  formatPrice,
  formatVolume,
} from "./constants";
import type { TickerData } from "./types";

interface MarketListProps {
  prices: Record<string, TickerData>;
  selectedPair: string;
  onSelectPair: (pair: string) => void;
}

type MarketTab = "all" | "favorites" | "gainers" | "losers" | "volume";

interface MarketRow {
  pair: string;
  base: string;
  name: string;
  icon: string;
  price: number;
  change: number;
  volume: number;
}

/**
 * Left-sidebar market list with search, favorites and 24h volume.
 * Mimics Binance's "Markets" panel.
 */
export default function MarketList({
  prices,
  selectedPair,
  onSelectPair,
}: MarketListProps) {
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<MarketTab>("all");
  const [favorites, setFavorites] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  /* Load favorites from localStorage */
  useEffect(() => {
    try {
      const stored = localStorage.getItem("exchange_favorites");
      if (stored) setFavorites(JSON.parse(stored));
    } catch {}
  }, []);

  /* Listen for favorite changes from other components (e.g. QuickPairSearch) */
  useEffect(() => {
    const syncFavorites = () => {
      try {
        const stored = localStorage.getItem("exchange_favorites");
        if (stored) setFavorites(JSON.parse(stored));
      } catch {}
    };
    window.addEventListener("exchange:favorites-changed", syncFavorites);
    return () =>
      window.removeEventListener("exchange:favorites-changed", syncFavorites);
  }, []);

  /* Persist favorites and notify other components */
  useEffect(() => {
    try {
      localStorage.setItem("exchange_favorites", JSON.stringify(favorites));
      window.dispatchEvent(new CustomEvent("exchange:favorites-changed"));
    } catch {}
  }, [favorites]);

  /* Build rows from prices map */
  const rows: MarketRow[] = useMemo(() => {
    return PAIRS.map((pair) => {
      const base = pair.replace("USDT", "");
      const p = prices[pair];
      return {
        pair,
        base,
        name: CURRENCY_NAMES[base] || base,
        icon: CURRENCY_ICONS[base] || "●",
        price: p?.price || 0,
        change: p ? parseFloat(p.change) : 0,
        volume: p?.quoteVolume ? parseFloat(p.quoteVolume) : 0,
      };
    });
  }, [prices]);

  /* Apply filters: tab + search */
  const filteredRows = useMemo(() => {
    let list = rows;
    if (tab === "favorites") {
      list = rows.filter((r) => favorites.includes(r.pair));
    } else if (tab === "gainers") {
      list = [...rows]
        .filter((r) => r.price > 0)
        .sort((a, b) => b.change - a.change)
        .slice(0, 10);
    } else if (tab === "losers") {
      list = [...rows]
        .filter((r) => r.price > 0)
        .sort((a, b) => a.change - b.change)
        .slice(0, 10);
    } else if (tab === "volume") {
      list = [...rows]
        .filter((r) => r.volume > 0)
        .sort((a, b) => b.volume - a.volume)
        .slice(0, 10);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (r) =>
          r.base.toLowerCase().includes(q) ||
          r.name.toLowerCase().includes(q) ||
          r.pair.toLowerCase().includes(q)
      );
    }
    return list;
  }, [rows, tab, search, favorites]);

  const toggleFavorite = (pair: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFavorites((prev) =>
      prev.includes(pair) ? prev.filter((p) => p !== pair) : [...prev, pair]
    );
  };

  return (
    <div className="glass-panel rounded-xl flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="p-2 border-b border-border/20 shrink-0 space-y-2">
        {/* Tab buttons - row 1 */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setTab("all")}
            className={`flex-1 py-1.5 rounded-md text-[11px] font-medium transition-all ${
              tab === "all"
                ? "bg-muted/30 text-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/20"
            }`}
          >
            الكل
          </button>
          <button
            onClick={() => setTab("favorites")}
            className={`flex-1 py-1.5 rounded-md text-[11px] font-medium transition-all flex items-center justify-center gap-1 ${
              tab === "favorites"
                ? "bg-yellow-500/10 text-yellow-400"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/20"
            }`}
          >
            <Star className="h-3 w-3" />
            المفضلة
          </button>
        </div>
        {/* Tab buttons - row 2 (Top Movers) */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setTab("gainers")}
            className={`flex-1 py-1.5 rounded-md text-[10px] font-medium transition-all flex items-center justify-center gap-1 ${
              tab === "gainers"
                ? "bg-emerald-500/10 text-emerald-400"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/20"
            }`}
          >
            <TrendingUp className="h-3 w-3" />
            الرابحون
          </button>
          <button
            onClick={() => setTab("losers")}
            className={`flex-1 py-1.5 rounded-md text-[10px] font-medium transition-all flex items-center justify-center gap-1 ${
              tab === "losers"
                ? "bg-red-500/10 text-red-400"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/20"
            }`}
          >
            <TrendingDown className="h-3 w-3" />
            الخاسرون
          </button>
          <button
            onClick={() => setTab("volume")}
            className={`flex-1 py-1.5 rounded-md text-[10px] font-medium transition-all flex items-center justify-center gap-1 ${
              tab === "volume"
                ? "bg-blue-500/10 text-blue-400"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/20"
            }`}
          >
            <BarChart3 className="h-3 w-3" />
            الحجم
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground/60" />
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث..."
            className="w-full bg-muted/30 border border-border/30 rounded-lg text-[11px] py-1.5 pr-7 pl-7 placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/30 transition-all"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute left-2 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-muted/40 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {/* Column headers */}
      <div className="flex items-center px-2.5 py-1 text-[9px] text-muted-foreground/60 border-b border-border/10 shrink-0 font-medium">
        <span className="w-5 text-center">★</span>
        <span className="flex-1">الزوج</span>
        <span className="flex-1 text-left">آخر سعر</span>
        <span className="w-16 text-left">24h%</span>
      </div>

      {/* Rows */}
      <div className="flex-1 overflow-y-auto">
        {filteredRows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 px-4">
            {tab === "gainers" ? (
              <TrendingUp className="h-6 w-6 text-muted-foreground/30 mb-2" />
            ) : tab === "losers" ? (
              <TrendingDown className="h-6 w-6 text-muted-foreground/30 mb-2" />
            ) : tab === "volume" ? (
              <BarChart3 className="h-6 w-6 text-muted-foreground/30 mb-2" />
            ) : (
              <Star className="h-6 w-6 text-muted-foreground/30 mb-2" />
            )}
            <p className="text-[11px] text-muted-foreground">
              {tab === "favorites"
                ? "لا توجد مفضلة بعد"
                : tab === "gainers"
                  ? "لا توجد بيانات الرابحين"
                  : tab === "losers"
                    ? "لا توجد بيانات الخاسرين"
                    : tab === "volume"
                      ? "لا توجد بيانات الحجم"
                      : "لا توجد نتائج"}
            </p>
          </div>
        ) : (
          filteredRows.map((row, idx) => {
            const isUp = row.change >= 0;
            const isFav = favorites.includes(row.pair);
            const isActive = row.pair === selectedPair;
            const showHotBadge =
              (tab === "gainers" || tab === "volume") && idx < 3;
            return (
              <button
                key={row.pair}
                onClick={() => onSelectPair(row.pair)}
                className={`w-full flex items-center px-2.5 py-2 text-[11px] transition-all duration-150 border-b border-border/5 ${
                  isActive
                    ? "bg-primary/10 text-foreground"
                    : "hover:bg-muted/20 text-foreground/90"
                }`}
              >
                <span
                  onClick={(e) => toggleFavorite(row.pair, e)}
                  className="w-5 flex justify-center cursor-pointer"
                >
                  <Star
                    className={`h-3 w-3 transition-all ${
                      isFav
                        ? "fill-yellow-400 text-yellow-400"
                        : "text-muted-foreground/30 hover:text-muted-foreground"
                    }`}
                  />
                </span>
                <div className="flex-1 flex items-center gap-1.5">
                  <span className="text-primary text-sm font-bold">
                    {row.icon}
                  </span>
                  <div className="flex flex-col items-start">
                    <span className="font-bold leading-tight flex items-center gap-1">
                      {row.base}
                      <span className="text-muted-foreground/50 text-[9px]">/USDT</span>
                      {showHotBadge && (
                        <Flame className="h-2.5 w-2.5 text-orange-400" />
                      )}
                    </span>
                    {row.volume > 0 && (
                      <span className="text-[8px] text-muted-foreground/60 tabular-nums">
                        {formatVolume(row.volume)}
                      </span>
                    )}
                  </div>
                </div>
                <span className="flex-1 text-left tabular-nums font-medium">
                  {row.price > 0 ? formatPrice(row.price) : "—"}
                </span>
                <span
                  className={`w-16 text-left tabular-nums text-[10px] font-bold px-1 py-0.5 rounded ${
                    isUp
                      ? "bg-emerald-500/10 text-emerald-400"
                      : "bg-red-500/10 text-red-400"
                  }`}
                >
                  {isUp ? "+" : ""}
                  {row.change.toFixed(2)}%
                </span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
