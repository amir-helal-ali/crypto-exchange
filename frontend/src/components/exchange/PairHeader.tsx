"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Search, TrendingUp, TrendingDown, Star } from "lucide-react";
import {
  PAIRS,
  CURRENCY_NAMES,
  CURRENCY_ICONS,
  formatPrice,
  formatVolume,
} from "./constants";
import type { TickerData } from "./types";

interface PairHeaderProps {
  selectedPair: string;
  prices: Record<string, TickerData>;
  prevPrice?: number;
  onSelectPair: (pair: string) => void;
  crosshairData?: {
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  } | null;
}

/**
 * Top header bar showing:
 * - Pair selector with dropdown search
 * - Current price with flash animation on change
 * - 24h stats (high, low, volume, change)
 * - Crosshair OHLCV when hovering chart
 */
export default function PairHeader({
  selectedPair,
  prices,
  prevPrice,
  onSelectPair,
  crosshairData,
}: PairHeaderProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [favorites, setFavorites] = useState<string[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  /* Load favorites */
  useEffect(() => {
    try {
      const stored = localStorage.getItem("exchange_favorites");
      if (stored) setFavorites(JSON.parse(stored));
    } catch {}
  }, []);

  /* Close on outside click */
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const base = selectedPair.replace("USDT", "");
  const ticker = prices[selectedPair];
  const change = ticker ? parseFloat(ticker.change) : 0;
  const isUp = change >= 0;

  /* Price color flash */
  const priceColor =
    ticker && prevPrice !== undefined
      ? ticker.price >= prevPrice
        ? "text-emerald-400"
        : "text-red-400"
      : "text-foreground";

  /* Filter dropdown list */
  const filteredPairs = PAIRS.filter((p) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    const b = p.replace("USDT", "").toLowerCase();
    return b.includes(q) || p.toLowerCase().includes(q);
  });

  return (
    <div className="glass-panel rounded-xl px-3 py-2 flex items-center gap-4 shrink-0 flex-wrap">
      {/* Pair selector */}
      <div className="relative" ref={ref}>
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/30 hover:bg-muted/40 transition-all border border-border/30"
        >
          <span className="text-primary text-base font-bold">
            {CURRENCY_ICONS[base] || "●"}
          </span>
          <div className="text-right">
            <div className="text-sm font-bold leading-none">
              {base}/USDT
            </div>
            <div className="text-[9px] text-muted-foreground mt-0.5">
              {CURRENCY_NAMES[base] || base}
            </div>
          </div>
          <ChevronDown
            className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${
              open ? "rotate-180" : ""
            }`}
          />
        </button>

        {open && (
          <div className="absolute top-full mt-1 right-0 w-72 glass-panel-strong rounded-xl border border-border/50 overflow-hidden z-50 shadow-2xl animate-scale-in">
            {/* Search */}
            <div className="p-2 border-b border-border/20">
              <div className="relative">
                <Search className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground/60" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="ابحث عن زوج..."
                  autoFocus
                  className="w-full bg-muted/30 border border-border/30 rounded-md text-[11px] py-1.5 pr-7 pl-2 placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/30"
                />
              </div>
            </div>

            {/* List */}
            <div className="max-h-72 overflow-y-auto">
              {filteredPairs.length === 0 ? (
                <div className="py-6 text-center text-[11px] text-muted-foreground">
                  لا توجد نتائج
                </div>
              ) : (
                filteredPairs.map((pair) => {
                  const pairBase = pair.replace("USDT", "");
                  const isActive = selectedPair === pair;
                  const pairTicker = prices[pair];
                  const pairChange = pairTicker
                    ? parseFloat(pairTicker.change)
                    : 0;
                  const pairUp = pairChange >= 0;
                  const isFav = favorites.includes(pair);

                  return (
                    <button
                      key={pair}
                      onClick={() => {
                        onSelectPair(pair);
                        setOpen(false);
                        setSearch("");
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 text-[11px] transition-all hover:bg-muted/30 ${
                        isActive ? "bg-primary/10 text-primary" : ""
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Star
                          className={`h-3 w-3 ${
                            isFav
                              ? "fill-yellow-400 text-yellow-400"
                              : "text-muted-foreground/30"
                          }`}
                        />
                        <span className="text-sm text-primary">
                          {CURRENCY_ICONS[pairBase]}
                        </span>
                        <div className="text-right">
                          <div className="font-bold leading-none">
                            {pairBase}/USDT
                          </div>
                          <div className="text-[9px] text-muted-foreground mt-0.5">
                            {CURRENCY_NAMES[pairBase] || pairBase}
                          </div>
                        </div>
                      </div>
                      {pairTicker && (
                        <div className="text-left">
                          <div className="font-medium tabular-nums">
                            {formatPrice(pairTicker.price)}
                          </div>
                          <div
                            className={`text-[9px] font-bold tabular-nums ${
                              pairUp ? "text-emerald-400" : "text-red-400"
                            }`}
                          >
                            {pairUp ? "+" : ""}
                            {pairChange.toFixed(2)}%
                          </div>
                        </div>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* Price + change */}
      <div className="flex items-center gap-3">
        <div className="flex flex-col">
          <span className={`text-xl font-bold tabular-nums leading-tight ${priceColor}`}>
            {ticker?.price
              ? ticker.price.toLocaleString(undefined, {
                  minimumFractionDigits: ticker.price >= 1 ? 2 : 6,
                  maximumFractionDigits: ticker.price >= 1 ? 2 : 8,
                })
              : "—"}
          </span>
          <span className="text-[9px] text-muted-foreground/60 leading-tight">
            ≈ ${ticker?.price?.toFixed(2) || "0.00"}
          </span>
        </div>
        {ticker && (
          <span
            className={`inline-flex items-center gap-0.5 px-2 py-1 rounded-md text-[10px] font-bold ${
              isUp
                ? "bg-emerald-500/10 text-emerald-400"
                : "bg-red-500/10 text-red-400"
            }`}
          >
            {isUp ? (
              <TrendingUp className="h-3 w-3" />
            ) : (
              <TrendingDown className="h-3 w-3" />
            )}
            {isUp ? "+" : ""}
            {change.toFixed(2)}%
          </span>
        )}
      </div>

      {/* 24h Stats */}
      {ticker && (
        <div className="flex items-center gap-4 text-[11px] mr-auto flex-wrap">
          <Stat
            label="أعلى 24h"
            value={formatPrice(ticker.high)}
            color="text-emerald-400"
          />
          <Stat
            label="أدنى 24h"
            value={formatPrice(ticker.low)}
            color="text-red-400"
          />
          <Stat
            label="حجم 24h"
            value={`${formatVolume(ticker.volume)} ${base}`}
          />
          <Stat
            label="حجم التداول"
            value={`${formatVolume(ticker.quoteVolume)} USDT`}
          />
        </div>
      )}

      {/* Crosshair OHLCV */}
      {crosshairData && (
        <div className="flex items-center gap-2.5 text-[10px] font-mono px-2 py-1 rounded-md bg-muted/20 border border-border/20">
          <span className="text-muted-foreground">
            O <span className="text-foreground">{crosshairData.open.toFixed(2)}</span>
          </span>
          <span className="text-muted-foreground">
            H{" "}
            <span className="text-emerald-400">
              {crosshairData.high.toFixed(2)}
            </span>
          </span>
          <span className="text-muted-foreground">
            L <span className="text-red-400">{crosshairData.low.toFixed(2)}</span>
          </span>
          <span className="text-muted-foreground">
            C{" "}
            <span
              className={
                crosshairData.close >= crosshairData.open
                  ? "text-emerald-400"
                  : "text-red-400"
              }
            >
              {crosshairData.close.toFixed(2)}
            </span>
          </span>
          <span className="text-muted-foreground">
            V{" "}
            <span className="text-foreground">
              {crosshairData.volume.toFixed(2)}
            </span>
          </span>
        </div>
      )}

      {/* Live indicator */}
      <div className="flex items-center gap-1 text-[10px] text-emerald-400 ml-auto md:ml-0">
        <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.6)] animate-pulse" />
        مباشر
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  color = "text-foreground",
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="flex flex-col">
      <span className="text-muted-foreground/60 text-[9px] leading-tight">
        {label}
      </span>
      <span className={`font-medium tabular-nums text-[11px] ${color}`}>
        {value}
      </span>
    </div>
  );
}
