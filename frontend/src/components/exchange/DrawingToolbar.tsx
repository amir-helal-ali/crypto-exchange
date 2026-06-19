"use client";

import {
  MousePointer2,
  TrendingUp,
  Minus,
  GripVertical,
  GitBranch,
  Square,
  Type,
  Eraser,
  Trash2,
} from "lucide-react";
import type { DrawingTool } from "./drawings";
import { DRAWING_COLORS } from "./drawings";

interface DrawingToolbarProps {
  activeTool: DrawingTool;
  onToolChange: (tool: DrawingTool) => void;
  activeColor: string;
  onColorChange: (color: string) => void;
  onClearAll: () => void;
  drawingCount: number;
}

const TOOLS: {
  id: DrawingTool;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: "cursor", label: "مؤشر", icon: MousePointer2 },
  { id: "trendline", label: "خط اتجاه", icon: TrendingUp },
  { id: "horizontal", label: "خط أفقي", icon: Minus },
  { id: "vertical", label: "خط عمودي", icon: GripVertical },
  { id: "fib", label: "فيبوناتشي", icon: GitBranch },
  { id: "rectangle", label: "مستطيل", icon: Square },
  { id: "text", label: "نص", icon: Type },
  { id: "eraser", label: "ممحاة", icon: Eraser },
];

/**
 * Drawing tools toolbar — sits above the chart.
 * Provides cursor, trendline, h/v lines, fib, rectangle, text, eraser.
 */
export default function DrawingToolbar({
  activeTool,
  onToolChange,
  activeColor,
  onColorChange,
  onClearAll,
  drawingCount,
}: DrawingToolbarProps) {
  return (
    <div className="flex items-center gap-1 px-2 py-1 border-b border-border/20 shrink-0 overflow-x-auto">
      {/* Tools */}
      <div className="flex items-center gap-0.5 bg-muted/20 rounded-lg p-0.5">
        {TOOLS.map((tool) => {
          const Icon = tool.icon;
          const isActive = activeTool === tool.id;
          return (
            <button
              key={tool.id}
              onClick={() => onToolChange(tool.id)}
              className={`flex items-center justify-center p-1.5 rounded-md transition-all ${
                isActive
                  ? "bg-primary/20 text-primary shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
              }`}
              title={tool.label}
            >
              <Icon className="h-3.5 w-3.5" />
            </button>
          );
        })}
      </div>

      {/* Color picker */}
      <div className="flex items-center gap-1 px-1.5 border-r border-border/20">
        {DRAWING_COLORS.map((c) => (
          <button
            key={c}
            onClick={() => onColorChange(c)}
            className={`w-4 h-4 rounded-full border transition-all ${
              activeColor === c
                ? "border-white scale-110 ring-1 ring-white/30"
                : "border-white/20 hover:scale-110"
            }`}
            style={{ backgroundColor: c }}
            title={c}
          />
        ))}
      </div>

      {/* Clear all */}
      <button
        onClick={onClearAll}
        disabled={drawingCount === 0}
        className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium transition-all ${
          drawingCount === 0
            ? "text-muted-foreground/30 cursor-not-allowed"
            : "text-red-400 hover:bg-red-500/10"
        }`}
        title="مسح كل الرسومات"
      >
        <Trash2 className="h-3 w-3" />
        <span>مسح الكل</span>
        {drawingCount > 0 && (
          <span className="text-muted-foreground/60">({drawingCount})</span>
        )}
      </button>
    </div>
  );
}
