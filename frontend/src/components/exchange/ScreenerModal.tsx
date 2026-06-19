"use client";

import { useEffect } from "react";
import { X, Search } from "lucide-react";
import Screener from "./Screener";
import type { TickerData } from "./types";

interface ScreenerModalProps {
  open: boolean;
  onClose: () => void;
  prices: Record<string, TickerData>;
  selectedPair: string;
  onSelectPair: (pair: string) => void;
}

/**
 * Modal wrapper for the Screener panel.
 *
 * Opens a full-height modal with the Screener component inside,
 * allowing users to find pairs matching their criteria.
 */
export default function ScreenerModal({
  open,
  onClose,
  prices,
  selectedPair,
  onSelectPair,
}: ScreenerModalProps) {
  /* Close on Escape */
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="glass-panel-strong rounded-2xl w-full max-w-lg max-h-[85vh] overflow-hidden border-2 border-primary/20 shadow-2xl animate-slide-in-up flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-border/30 bg-primary/5">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-primary flex items-center justify-center text-white">
              <Search className="h-4 w-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-primary">فرز الأسواق</h3>
              <p className="text-[10px] text-muted-foreground">
                ابحث عن الأزواج المطابقة لمعاييرك
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-muted/30 text-muted-foreground hover:text-foreground transition-all"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-hidden p-2">
          <Screener
            prices={prices}
            selectedPair={selectedPair}
            onSelectPair={(pair) => {
              onSelectPair(pair);
              onClose();
            }}
          />
        </div>
      </div>
    </div>
  );
}
