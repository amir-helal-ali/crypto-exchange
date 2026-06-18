"use client";

import {
  BarChart3,
  CandlestickChart,
  LineChart,
  Settings2,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { TIMEFRAMES } from "./constants";
import type { Timeframe } from "./types";

export interface ChartIndicators {
  sma20: boolean;
  ema50: boolean;
  bollinger: boolean;
  rsi: boolean;
  macd: boolean;
  volume: boolean;
}

interface ChartToolbarProps {
  timeframe: Timeframe;
  onTimeframeChange: (tf: Timeframe) => void;
  chartType?: "candles" | "line" | "area";
  onChartTypeChange?: (t: "candles" | "line" | "area") => void;
  indicators?: ChartIndicators;
  onIndicatorsChange?: (i: ChartIndicators) => void;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
}

const DEFAULT_INDICATORS: ChartIndicators = {
  sma20: true,
  ema50: true,
  bollinger: false,
  rsi: false,
  macd: false,
  volume: true,
};

/**
 * Chart toolbar with timeframe selector, chart type, indicator toggles,
 * and fullscreen mode.
 */
export default function ChartToolbar({
  timeframe,
  onTimeframeChange,
  chartType = "candles",
  onChartTypeChange,
  indicators = DEFAULT_INDICATORS,
  onIndicatorsChange,
  isFullscreen = false,
  onToggleFullscreen,
}: ChartToolbarProps) {
  const toggleIndicator = (key: keyof ChartIndicators) => {
    if (!onIndicatorsChange) return;
    onIndicatorsChange({ ...indicators, [key]: !indicators[key] });
  };

  const IndicatorChip = ({
    label,
    color,
    active,
    onClick,
  }: {
    label: string;
    color: string;
    active: boolean;
    onClick: () => void;
  }) => (
    <button
      onClick={onClick}
      className={`flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-medium transition-all ${
        active
          ? "bg-muted/30 text-foreground"
          : "text-muted-foreground/50 hover:text-muted-foreground"
      }`}
    >
      <span
        className="inline-block w-2.5 h-0.5 rounded"
        style={{ backgroundColor: active ? color : "currentColor" }}
      />
      {label}
    </button>
  );

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

      {/* Indicators section */}
      <div className="flex items-center gap-0.5 px-1 border-r border-border/20">
        <IndicatorChip
          label="SMA 20"
          color="#f0b90b"
          active={indicators.sma20}
          onClick={() => toggleIndicator("sma20")}
        />
        <IndicatorChip
          label="EMA 50"
          color="#8b5cf6"
          active={indicators.ema50}
          onClick={() => toggleIndicator("ema50")}
        />
        <IndicatorChip
          label="BOLL"
          color="#3b82f6"
          active={indicators.bollinger}
          onClick={() => toggleIndicator("bollinger")}
        />
        <IndicatorChip
          label="RSI"
          color="#06b6d4"
          active={indicators.rsi}
          onClick={() => toggleIndicator("rsi")}
        />
        <IndicatorChip
          label="MACD"
          color="#f97316"
          active={indicators.macd}
          onClick={() => toggleIndicator("macd")}
        />
        <IndicatorChip
          label="VOL"
          color="#94a3b8"
          active={indicators.volume}
          onClick={() => toggleIndicator("volume")}
        />
      </div>

      <div className="flex-1" />

      {/* Fullscreen toggle */}
      <button
        onClick={onToggleFullscreen}
        className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-all"
        title={isFullscreen ? "إنهاء الشاشة الكاملة" : "ملء الشاشة"}
      >
        {isFullscreen ? (
          <Minimize2 className="h-3.5 w-3.5" />
        ) : (
          <Maximize2 className="h-3.5 w-3.5" />
        )}
      </button>

      <button
        className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-all"
        title="إعدادات متقدمة"
      >
        <Settings2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
