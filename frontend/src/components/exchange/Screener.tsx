"use client";

import { useMemo, useState } from "react";
import { Search, Filter, TrendingUp, TrendingDown, X } from "lucide-react";
import {
  PAIRS,
  CURRENCY_NAMES,
  CURRENCY_ICONS,
  formatPrice,
  formatVolume,
} from "./constants";
import type { TickerData } from "./types";

interface ScreenerProps {
  prices: Record<string, TickerData>;
  selectedPair: string;
  onSelectPair: (pair: string) => void;
}

type SortKey = "change" | "volume" | "price" | "name";
type SortDir = "asc" | "desc";
type FilterType = "all" | "gainers" | "losers" | "highVolume" | "lowVolume" | "volatile";

/**
 * Market Screener — find pairs matching criteria.
 *
 * Binance/Bybit feature: scan all pairs and filter/sort by:
 * - 24h change % (gainers / losers)
 * - 24h volume (high / low)
 * - Volatility (high range)
 * - Search by name
 *
 * Sortable by any column. Click any pair to switch the main chart.
 */
export default function Screener({
  prices,
  selectedPair,
  onSelectPair,
}: ScreenerProps) {
  const [filter, setFilter] = useState<FilterType>("all");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("volume");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  /* Build rows */
  const rows = useMemo(() => {
    return PAIRS.map((pair) => {
      const base = pair.replace("USDT", "");
      const p = prices[pair];
      const change = p ? parseFloat(p.change) : 0;
      const volume = p?.quoteVolume ? parseFloat(p.quoteVolume) : 0;
      const price = p?.price || 0;
      const high = p?.high || 0;
      const low = p?.low || 0;
      /* Volatility = (high - low) / low * 100 */
      const volatility = low > 0 ? ((high - low) / low) * 100 : 0;
      return {
        pair,
        base,
        name: CURRENCY_NAMES[base] || base,
        icon: CURRENCY_ICONS[base] || "●",
        price,
        change,
        volume,
        volatility,
      };
    });
  }, [prices]);

  /* Apply filters */
  const filtered = useMemo(() => {
    let list = rows;
    switch (filter) {
      case "gainers":
        list = list.filter((r) => r.price > 0 && r.change > 0);
        break;
      case "losers":
        list = list.filter((r) => r.price > 0 && r.change < 0);
        break;
      case "highVolume":
        list = list.filter((r) => r.volume > 50_000_000);
        break;
      case "lowVolume":
        list = list.filter((r) => r.volume > 0 && r.volume < 10_000_000);
        break;
      case "volatile":
        list = list.filter((r) => r.volatility > 5);
        break;
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
  }, [rows, filter, search]);

  /* Apply sort */
  const sorted = useMemo(() => {
    const list = [...filtered];
    list.sort((a, b) => {
      let av: number | string = 0;
      let bv: number | string = 0;
      switch (sortKey) {
        case "change":
          av = a.change;
          bv = b.change;
          break;
        case "volume":
          av = a.volume;
          bv = b.volume;
          break;
        case "price":
          av = a.price;
          bv = b.price;
          break;
        case "name":
          av = a.base;
          bv = b.base;
          break;
      }
      if (typeof av === "string" && typeof bv === "string") {
        return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      return sortDir === "asc"
        ? (av as number) - (bv as number)
        : (bv as number) - (av as number);
    });
    return list;
  }, [filtered, sortKey, sortDir]);

  /* Sort indicator */
  const sortIndicator = (key: SortKey) =>
    sortKey === key ? (sortDir === "asc" ? "↑" : "↓") : "";

  /* Toggle sort */
  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  /* Filter buttons */
  const filterOptions: { value: FilterType; label: string; icon: typeof Filter }[] = [
    { value: "all", label: "الكل", icon: Filter },
    { value: "gainers", label: "رابحون", icon: TrendingUp },
    { value: "losers", label: "خاسرون", icon: TrendingDown },
    { value: "highVolume", label: "حجم عالي", icon: TrendingUp },
    { value: "lowVolume", label: "حجم منخفض", icon: TrendingDown },
    { value: "volatile", label: "متقلب", icon: TrendingUp },
  ];

  return (
    <div className="glass-panel rounded-xl flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-2.5 py-2 border-b border-border/20 shrink-0">
        <div className="flex items-center gap-1.5">
          <Search className="h-3.5 w-3.5 text-primary" />
          <h3 className="font-bold text-[11px]"> Screener السوق</h3>
        </div>
        <span className="text-[9px] text-muted-foreground">
          {sorted.length} زوج
        </span>
      </div>

      {/* Filters */}
      <div className="p-2 border-b border-border/20 space-y-1.5 shrink-0">
        {/* Filter pills */}
        <div className="flex items-center gap-1 overflow-x-auto">
          {filterOptions.map((opt) => {
            const Icon = opt.icon;
            const isActive = filter === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => setFilter(opt.value)}
                className={`shrink-0 px-2 py-1 rounded-md text-[9px] font-medium transition-all flex items-center gap-0.5 ${
                  isActive
                    ? "bg-primary/20 text-primary"
                    : "bg-muted/20 text-muted-foreground hover:bg-muted/30"
                }`}
              >
                <Icon className="h-2.5 w-2.5" />
                {opt.label}
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground/60" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث..."
            className="w-full bg-muted/30 border border-border/30 rounded-lg text-[10px] py-1.5 pr-7 pl-7 placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/30"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute left-2 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-muted/40 text-muted-foreground"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {/* Table header */}
      <div className="flex items-center px-2 py-1 text-[9px] text-muted-foreground/60 border-b border-border/10 shrink-0 font-medium">
        <button
          onClick={() => toggleSort("name")}
          className="flex-1 text-right hover:text-foreground transition-colors"
        >
          الزوج {sortIndicator("name")}
        </button>
        <button
          onClick={() => toggleSort("price")}
          className="w-20 text-left hover:text-foreground transition-colors"
        >
          السعر {sortIndicator("price")}
        </button>
        <button
          onClick={() => toggleSort("change")}
          className="w-16 text-left hover:text-foreground transition-colors"
        >
          24h% {sortIndicator("change")}
        </button>
        <button
          onClick={() => toggleSort("volume")}
          className="w-16 text-left hover:text-foreground transition-colors"
        >
          الحجم {sortIndicator("volume")}
        </button>
      </div>

      {/* Rows */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {sorted.length === 0 ? (
          <div className="py-4 text-center text-[10px] text-muted-foreground">
            لا توجد نتائج مطابقة
          </div>
        ) : (
          sorted.map((row) => {
            const isUp = row.change >= 0;
            const isActive = row.pair === selectedPair;
            return (
              <button
                key={row.pair}
                onClick={() => onSelectPair(row.pair)}
                className={`w-full flex items-center px-2 py-1.5 text-[10px] transition-all border-b border-border/5 ${
                  isActive
                    ? "bg-primary/10 text-foreground"
                    : "hover:bg-muted/10 text-foreground/90"
                }`}
              >
                <span className="flex-1 flex items-center gap-1 text-right">
                  <span className="text-primary text-xs font-bold">{row.icon}</span>
                  <span className="font-bold">{row.base}</span>
                  <span className="text-muted-foreground/50 text-[8px]">/USDT</span>
                </span>
                <span className="w-20 text-left tabular-nums font-medium">
                  {row.price > 0 ? formatPrice(row.price) : "—"}
                </span>
                <span
                  className={`w-16 text-left tabular-nums font-bold ${
                    isUp ? "text-emerald-400" : "text-red-400"
                  }`}
                >
                  {isUp ? "+" : ""}
                  {row.change.toFixed(2)}%
                </span>
                <span className="w-16 text-left tabular-nums text-muted-foreground">
                  {row.volume > 0 ? formatVolume(row.volume) : "—"}
                </span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
