"use client";

import { BarChart3, CandlestickChart, LineChart, Settings2 } from "lucide-react";
import { TIMEFRAMES } from "./constants";
import type { Timeframe } from "./types";

interface ChartToolbarProps {
  timeframe: Timeframe;
  onTimeframeChange: (tf: Timeframe) => void;
  chartType?: "candles" | "line" | "area";
  onChartTypeChange?: (t: "candles" | "line" | "area") => void;
}

/**
 * Chart toolbar with timeframe selector, chart type, and indicator legend.
 */
export default function ChartToolbar({
  timeframe,
  onTimeframeChange,
  chartType = "candles",
  onChartTypeChange,
}: ChartToolbarProps) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 border-b border-border/20 shrink-0 flex-wrap">
      {/* Timeframe selector */}
      <div className="flex items-center gap-0.5 bg-muted/20 rounded-lg p-0.5">
        {TIMEFRAMES.map((tf) => (
          <button
            key={tf.value}
            onClick={() => onTimeframeChange(tf.value)}
            className={`px-2.5 py-1 rounded-md text-[10px] font-medium transition-all duration-200 ${
              timeframe === tf.value
                ? "bg-primary/20 text-primary shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
            }`}
          >
            {tf.label}
          </button>
        ))}
      </div>

      {/* Chart type icons */}
      <div className="flex items-center gap-0.5 bg-muted/20 rounded-lg p-0.5">
        <button
          onClick={() => onChartTypeChange?.("candles")}
          className={`p-1 rounded-md transition-all ${
            chartType === "candles"
              ? "bg-primary/20 text-primary"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
          }`}
          title="شموع يابانية"
        >
          <CandlestickChart className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => onChartTypeChange?.("line")}
          className={`p-1 rounded-md transition-all ${
            chartType === "line"
              ? "bg-primary/20 text-primary"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
          }`}
          title="خط"
        >
          <LineChart className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => onChartTypeChange?.("area")}
          className={`p-1 rounded-md transition-all ${
            chartType === "area"
              ? "bg-primary/20 text-primary"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
          }`}
          title="مساحة"
        >
          <BarChart3 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Settings */}
      <button
        className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-all"
        title="إعدادات المؤشرات"
      >
        <Settings2 className="h-3.5 w-3.5" />
      </button>

      <div className="flex-1" />

      {/* MA Legend */}
      <div className="flex items-center gap-3 text-[9px]">
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-0.5 rounded bg-[#f0b90b]" />
          <span className="text-[#f0b90b] font-medium">SMA 20</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-0.5 rounded bg-[#8b5cf6]" />
          <span className="text-[#8b5cf6] font-medium">EMA 50</span>
        </span>
      </div>
    </div>
  );
}
