"use client";

import { useEffect } from "react";
import { X, Grid3x3 } from "lucide-react";
import MarketsHeatmap from "./MarketsHeatmap";
import type { TickerData } from "./types";

interface MarketsHeatmapModalProps {
  open: boolean;
  onClose: () => void;
  prices: Record<string, TickerData>;
  selectedPair: string;
  onSelectPair: (pair: string) => void;
}

/**
 * Modal wrapper for Markets Heatmap.
 * Opens a full-height modal showing the heatmap grid.
 */
export default function MarketsHeatmapModal({
  open,
  onClose,
  prices,
  selectedPair,
  onSelectPair,
}: MarketsHeatmapModalProps) {
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
        className="glass-panel-strong rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden border-2 border-primary/20 shadow-2xl animate-slide-in-up flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-border/30 bg-primary/5">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-primary flex items-center justify-center text-white">
              <Grid3x3 className="h-4 w-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-primary">خريطة الأسواق</h3>
              <p className="text-[10px] text-muted-foreground">
                نظرة شاملة على أداء جميع الأزواج
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
          <MarketsHeatmap
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
