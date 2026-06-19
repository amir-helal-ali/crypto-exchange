"use client";

import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { Search, Star, X, TrendingUp, TrendingDown } from "lucide-react";
import {
  PAIRS,
  CURRENCY_NAMES,
  CURRENCY_ICONS,
  formatPrice,
  formatVolume,
} from "./constants";
import type { TickerData } from "./types";

/* ═══════════════════════════════════════════
   Types
   ═══════════════════════════════════════════ */

interface QuickPairSearchProps {
  open: boolean;
  onClose: () => void;
  onSelectPair: (pair: string) => void;
  prices: Record<string, TickerData>;
  selectedPair: string;
  favorites: string[];
  onToggleFavorite: (pair: string) => void;
}

interface RankedPair {
  pair: string;
  base: string;
  quote: string;
  name: string;
  icon: string;
  ticker?: TickerData;
  score: number;
  isFavorite: boolean;
}

/* ═══════════════════════════════════════════
   Component
   ═══════════════════════════════════════════ */

export default function QuickPairSearch({
  open,
  onClose,
  onSelectPair,
  prices,
  selectedPair,
  favorites,
  onToggleFavorite,
}: QuickPairSearchProps) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [tab, setTab] = useState<"all" | "favorites">("all");
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  /* Reset on open */
  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
      setTab(favorites.length > 0 ? "favorites" : "all");
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open, favorites.length]);

  /* Filter + rank pairs */
  const rankedPairs = useMemo<RankedPair[]>(() => {
    const q = query.trim().toLowerCase();
    return PAIRS.map((pair) => {
      const base = pair.replace("USDT", "");
      const name = CURRENCY_NAMES[base] || base;
      const icon = CURRENCY_ICONS[base] || "●";
      const ticker = prices[pair];
      const isFavorite = favorites.includes(pair);

      let score = 0;
      if (q) {
        const baseLower = base.toLowerCase();
        const nameLower = name.toLowerCase();
        if (baseLower === q) score = 1000;
        else if (baseLower.startsWith(q)) score = 800;
        else if (baseLower.includes(q)) score = 500;
        else if (nameLower.includes(q)) score = 300;
        else if (pair.toLowerCase().includes(q)) score = 100;
        else score = -1; // exclude
      } else {
        // No query: sort by volume (desc)
        score = ticker?.quoteVolume
          ? parseFloat(String(ticker.quoteVolume))
          : 0;
      }

      return {
        pair,
        base,
        quote: "USDT",
        name,
        icon,
        ticker,
        score,
        isFavorite,
      };
    })
      .filter((p) => p.score >= 0)
      .filter((p) => (tab === "favorites" ? p.isFavorite : true))
      .sort((a, b) => b.score - a.score);
  }, [query, prices, tab, favorites]);

  /* Reset active index when results change */
  useEffect(() => {
    setActiveIndex(0);
  }, [query, tab]);

  /* Keyboard navigation */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, rankedPairs.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const selected = rankedPairs[activeIndex];
        if (selected) {
          onSelectPair(selected.pair);
          onClose();
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "Tab") {
        // Switch tab on Tab
        e.preventDefault();
        setTab((t) => (t === "all" ? "favorites" : "all"));
      }
    },
    [rankedPairs, activeIndex, onSelectPair, onClose]
  );

  /* Scroll active item into view */
  useEffect(() => {
    if (!listRef.current) return;
    const active = listRef.current.querySelector(
      `[data-idx="${activeIndex}"]`
    ) as HTMLElement | null;
    if (active) {
      active.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [activeIndex]);

  /* Close on backdrop click */
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[10vh] px-4 bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={handleBackdropClick}
      onKeyDown={handleKeyDown}
    >
      <div className="w-full max-w-2xl glass-panel-strong rounded-2xl shadow-2xl border border-border/40 overflow-hidden">
        {/* ══════ Search input ══════ */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border/30">
          <Search className="h-5 w-5 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ابحث عن زوج تداول... (مثال: BTC, ETH, بيتكوين)"
            className="flex-1 bg-transparent outline-none text-base placeholder:text-muted-foreground/60"
            autoComplete="off"
            spellCheck={false}
          />
          <kbd className="hidden sm:inline-block text-[10px] text-muted-foreground px-1.5 py-0.5 rounded border border-border/40 bg-muted/20">
            ESC
          </kbd>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* ══════ Tabs ══════ */}
        <div className="flex items-center gap-1 px-3 py-2 border-b border-border/20">
          <button
            onClick={() => setTab("all")}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
              tab === "all"
                ? "bg-primary/15 text-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
            }`}
          >
            كل الأزواج
          </button>
          <button
            onClick={() => setTab("favorites")}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors flex items-center gap-1 ${
              tab === "favorites"
                ? "bg-primary/15 text-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
            }`}
          >
            <Star className="h-3 w-3" />
            المفضلة
            {favorites.length > 0 && (
              <span className="text-[9px] opacity-70">({favorites.length})</span>
            )}
          </button>

          <div className="flex-1" />

          <span className="text-[10px] text-muted-foreground">
            {rankedPairs.length} زوج
          </span>
        </div>

        {/* ══════ Results list ══════ */}
        <div
          ref={listRef}
          className="max-h-[50vh] overflow-y-auto custom-scroll"
        >
          {rankedPairs.length === 0 ? (
            <div className="px-4 py-12 text-center text-sm text-muted-foreground">
              {query
                ? `لا توجد نتائج لـ "${query}"`
                : tab === "favorites"
                ? "لا توجد أزواج في المفضلة بعد. اضغط على النجمة بجوار أي زوج لإضافته."
                : "لا توجد أزواج متاحة"}
            </div>
          ) : (
            rankedPairs.map((p, idx) => (
              <PairRow
                key={p.pair}
                data-idx={idx}
                pair={p}
                active={idx === activeIndex}
                selected={p.pair === selectedPair}
                onClick={() => {
                  onSelectPair(p.pair);
                  onClose();
                }}
                onToggleFavorite={() => onToggleFavorite(p.pair)}
              />
            ))
          )}
        </div>

        {/* ══════ Footer hints ══════ */}
        <div className="flex items-center justify-between gap-3 px-4 py-2 border-t border-border/30 bg-muted/10 text-[10px] text-muted-foreground">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 rounded bg-muted/40 border border-border/30">↑↓</kbd>
              تنقّل
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 rounded bg-muted/40 border border-border/30">↵</kbd>
              اختيار
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 rounded bg-muted/40 border border-border/30">Tab</kbd>
              تبديل التبويب
            </span>
          </div>
          <span className="opacity-70">اضغط في أي مكان على الشاشة للإغلاق</span>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   Pair Row
   ═══════════════════════════════════════════ */

function PairRow({
  pair,
  active,
  selected,
  onClick,
  onToggleFavorite,
  ...rest
}: {
  pair: RankedPair;
  active: boolean;
  selected: boolean;
  onClick: () => void;
  onToggleFavorite: () => void;
} & React.HTMLAttributes<HTMLDivElement>) {
  const { ticker, base, name, icon, isFavorite } = pair;
  const change = ticker?.change ? parseFloat(String(ticker.change)) : 0;
  const isUp = change >= 0;

  return (
    <div
      {...rest}
      onClick={onClick}
      className={`group flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors border-b border-border/10 ${
        active ? "bg-primary/10" : "hover:bg-muted/30"
      } ${selected ? "ring-1 ring-inset ring-primary/30" : ""}`}
    >
      {/* Favorite star */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggleFavorite();
        }}
        className={`shrink-0 transition-colors ${
          isFavorite
            ? "text-yellow-400 hover:text-yellow-300"
            : "text-muted-foreground/40 hover:text-yellow-400"
        }`}
        title={isFavorite ? "إزالة من المفضلة" : "إضافة للمفضلة"}
      >
        <Star className="h-3.5 w-3.5" fill={isFavorite ? "currentColor" : "none"} />
      </button>

      {/* Coin icon */}
      <div className="shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-base font-bold text-primary border border-primary/20">
        {icon}
      </div>

      {/* Pair + name */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="font-bold text-sm">{base}</span>
          <span className="text-[10px] text-muted-foreground">/USDT</span>
          {selected && (
            <span className="text-[9px] px-1 py-0.5 rounded bg-primary/20 text-primary">
              الحالي
            </span>
          )}
        </div>
        <div className="text-[11px] text-muted-foreground truncate">{name}</div>
      </div>

      {/* Last price */}
      <div className="text-left shrink-0 w-24">
        <div className={`text-sm font-mono ${isUp ? "text-emerald-400" : "text-red-400"}`}>
          {ticker?.price ? formatPrice(ticker.price) : "—"}
        </div>
        <div className="text-[10px] text-muted-foreground">آخر سعر</div>
      </div>

      {/* 24h change */}
      <div className="text-left shrink-0 w-20">
        <div
          className={`text-xs font-mono flex items-center justify-end gap-0.5 ${
            isUp ? "text-emerald-400" : "text-red-400"
          }`}
        >
          {isUp ? (
            <TrendingUp className="h-3 w-3" />
          ) : (
            <TrendingDown className="h-3 w-3" />
          )}
          {Math.abs(change).toFixed(2)}%
        </div>
        <div className="text-[10px] text-muted-foreground">24س</div>
      </div>

      {/* 24h volume */}
      <div className="text-left shrink-0 w-24 hidden sm:block">
        <div className="text-xs font-mono">
          {ticker?.quoteVolume
            ? formatVolume(parseFloat(String(ticker.quoteVolume)))
            : "—"}
        </div>
        <div className="text-[10px] text-muted-foreground">حجم التداول</div>
      </div>
    </div>
  );
}
