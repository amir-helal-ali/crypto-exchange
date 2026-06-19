"use client";

import { useEffect, useRef, useState } from "react";
import { PAIRS, CURRENCY_ICONS, formatPrice } from "./constants";
import type { TickerData } from "./types";

interface TickerTapeProps {
  prices: Record<string, TickerData>;
  onSelectPair?: (pair: string) => void;
  selectedPair: string;
}

interface TapeItem {
  pair: string;
  base: string;
  price: number;
  change: number;
}

/**
 * Horizontal scrolling ticker tape (Binance-style) showing live prices
 * of all tracked pairs at the top of the trading page.
 */
export default function TickerTape({ prices, onSelectPair, selectedPair }: TickerTapeProps) {
  const [items, setItems] = useState<TapeItem[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<number | null>(null);
  const offsetRef = useRef(0);
  const [paused, setPaused] = useState(false);

  /* Build items list whenever prices change */
  useEffect(() => {
    const list: TapeItem[] = PAIRS.map((pair) => {
      const base = pair.replace("USDT", "");
      const p = prices[pair];
      return {
        pair,
        base,
        price: p?.price || 0,
        change: p ? parseFloat(p.change) : 0,
      };
    });
    setItems(list);
  }, [prices]);

  /* Continuous marquee animation */
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const animate = () => {
      if (!paused && el.scrollWidth > el.clientWidth) {
        offsetRef.current -= 0.4;
        // wrap-around
        const halfWidth = el.scrollWidth / 2;
        if (Math.abs(offsetRef.current) >= halfWidth) {
          offsetRef.current = 0;
        }
        el.style.transform = `translateX(${offsetRef.current}px)`;
      }
      animRef.current = requestAnimationFrame(animate);
    };

    animRef.current = requestAnimationFrame(animate);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [paused, items]);

  /* Render each item twice so the marquee wraps seamlessly */
  const renderItem = (item: TapeItem, idx: number) => {
    const isUp = item.change >= 0;
    const isActive = item.pair === selectedPair;
    return (
      <button
        key={`${item.pair}-${idx}`}
        onClick={() => onSelectPair?.(item.pair)}
        className={`flex items-center gap-2 px-4 py-1.5 whitespace-nowrap text-[11px] transition-all duration-200 hover:bg-muted/30 border-l border-border/30 ${
          isActive ? "bg-primary/10" : ""
        }`}
        title={`${item.base}/USDT`}
      >
        <span className="text-primary/70 text-xs font-bold">
          {CURRENCY_ICONS[item.base]}
        </span>
        <span className="font-bold text-foreground/90">{item.base}/USDT</span>
        <span
          className={`tabular-nums font-medium ${
            isUp ? "text-emerald-400" : "text-red-400"
          }`}
        >
          {item.price > 0 ? formatPrice(item.price) : "—"}
        </span>
        <span
          className={`tabular-nums text-[10px] px-1.5 py-0.5 rounded ${
            isUp
              ? "bg-emerald-500/10 text-emerald-400"
              : "bg-red-500/10 text-red-400"
          }`}
        >
          {isUp ? "+" : ""}
          {item.change.toFixed(2)}%
        </span>
      </button>
    );
  };

  return (
    <div
      className="glass-panel rounded-xl overflow-hidden shrink-0 relative"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="flex items-center">
        {/* Static label */}
        <div className="flex items-center gap-1.5 px-3 py-2 bg-primary/10 border-l border-border/30 shrink-0">
          <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[10px] font-bold text-primary">الأسواق</span>
        </div>

        {/* Scrolling items */}
        <div className="flex-1 overflow-hidden">
          <div
            ref={scrollRef}
            className="flex items-center will-change-transform"
            style={{ width: "max-content" }}
          >
            {items.map(renderItem)}
            {items.map((item, i) => renderItem(item, i + 1000))}
          </div>
        </div>

        {/* Gradient fade edges */}
        <div className="absolute top-0 bottom-0 right-0 w-12 bg-gradient-to-l from-card to-transparent pointer-events-none" />
        <div className="absolute top-0 bottom-0 left-0 w-12 bg-gradient-to-r from-card to-transparent pointer-events-none" />
      </div>
    </div>
  );
}
