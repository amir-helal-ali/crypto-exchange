"use client";

import { useEffect, useState } from "react";
import { Clock, X } from "lucide-react";
import { CURRENCY_ICONS } from "./constants";
import type { TickerData } from "./types";

interface RecentPairsProps {
  selectedPair: string;
  onSelectPair: (pair: string) => void;
  prices: Record<string, TickerData>;
}

const STORAGE_KEY = "exchange_recent_pairs";
const MAX_RECENT = 8;

/**
 * Recent Pairs horizontal strip — shows recently viewed pairs as quick-access
 * chips above the chart. Click any chip to instantly switch.
 *
 * Persists to localStorage. Each new pair selected is added to the front
 * of the list (deduped). Maximum 8 pairs shown.
 */
export default function RecentPairs({
  selectedPair,
  onSelectPair,
  prices,
}: RecentPairsProps) {
  const [recent, setRecent] = useState<string[]>([]);

  /* Load from localStorage */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setRecent(JSON.parse(raw));
    } catch {}
  }, []);

  /* Update recent when selected pair changes */
  useEffect(() => {
    if (!selectedPair) return;
    setRecent((prev) => {
      /* Remove if already present, then add to front */
      const filtered = prev.filter((p) => p !== selectedPair);
      const updated = [selectedPair, ...filtered].slice(0, MAX_RECENT);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch {}
      return updated;
    });
  }, [selectedPair]);

  /* Remove a pair from recent */
  const removePair = (pair: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setRecent((prev) => {
      const updated = prev.filter((p) => p !== pair);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  if (recent.length === 0) return null;

  return (
    <div className="glass-panel rounded-xl px-2 py-1.5 flex items-center gap-1.5 overflow-x-auto">
      <Clock className="h-3 w-3 text-muted-foreground shrink-0" />
      <span className="text-[9px] text-muted-foreground shrink-0 font-medium">
        الأخيرة:
      </span>
      <div className="flex items-center gap-1">
        {recent.map((pair) => {
          const base = pair.replace("USDT", "");
          const p = prices[pair];
          const change = p ? parseFloat(p.change) : 0;
          const isUp = change >= 0;
          const isActive = pair === selectedPair;
          return (
            <button
              key={pair}
              onClick={() => onSelectPair(pair)}
              className={`group relative flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium transition-all border ${
                isActive
                  ? "bg-primary/20 text-primary border-primary/30"
                  : "bg-muted/20 text-muted-foreground border-border/30 hover:bg-muted/30 hover:text-foreground"
              }`}
            >
              <span className="text-primary font-bold">
                {CURRENCY_ICONS[base] || "●"}
              </span>
              <span>{base}</span>
              {p && (
                <span
                  className={`text-[9px] tabular-nums ${
                    isUp ? "text-emerald-400" : "text-red-400"
                  }`}
                >
                  {isUp ? "+" : ""}
                  {change.toFixed(1)}%
                </span>
              )}
              {!isActive && (
                <button
                  onClick={(e) => removePair(pair, e)}
                  className="opacity-0 group-hover:opacity-100 absolute -top-1 -right-1 h-3 w-3 rounded-full bg-red-500 text-white flex items-center justify-center transition-opacity"
                  title="إزالة"
                >
                  <X className="h-2 w-2" />
                </button>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
