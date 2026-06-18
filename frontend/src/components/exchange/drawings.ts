/* ═══════════════════════════════════════════
   Drawing system for the ProChart component.
   Supports: trendline, horizontal line, vertical
   line, fibonacci retracement, rectangle, text.
   ═══════════════════════════════════════════ */

export type DrawingTool =
  | "cursor"
  | "trendline"
  | "horizontal"
  | "vertical"
  | "fib"
  | "rectangle"
  | "text"
  | "eraser";

export type DrawingType =
  | "trendline"
  | "horizontal"
  | "vertical"
  | "fib"
  | "rectangle"
  | "text";

export interface Point {
  time: number; // unix seconds (data space)
  price: number;
}

export interface Drawing {
  id: string;
  type: DrawingType;
  p1: Point;
  p2?: Point; // for trendline, fib, rectangle
  text?: string;
  color: string;
  createdAt: number;
}

/* Default colors palette for new drawings */
export const DRAWING_COLORS = [
  "#f0b90b", // gold (primary)
  "#00c087", // green
  "#f6465d", // red
  "#3b82f6", // blue
  "#8b5cf6", // purple
  "#06b6d4", // cyan
  "#ffffff", // white
];

/* Fibonacci retracement levels */
export const FIB_LEVELS = [
  { level: 0, label: "0" },
  { level: 0.236, label: "0.236" },
  { level: 0.382, label: "0.382" },
  { level: 0.5, label: "0.5" },
  { level: 0.618, label: "0.618" },
  { level: 0.786, label: "0.786" },
  { level: 1, label: "1" },
];

/* Generate a unique ID */
export function genDrawingId(): string {
  return `draw_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/* ═══════════════════════════════════════════
   Coordinate conversion helpers.
   ProChart keeps these in a ref so the drawing
   layer can convert between data and screen.
   ═══════════════════════════════════════════ */

export interface CoordConverter {
  timeToX: (time: number) => number;
  xToTime: (x: number) => number;
  priceToY: (price: number) => number;
  yToPrice: (y: number) => number;
}

/* ═══════════════════════════════════════════
   Rendering functions for each drawing type.
   All renderers receive the canvas 2D context
   and a CoordConverter to map data → pixels.
   ═══════════════════════════════════════════ */

export function drawDrawing(
  ctx: CanvasRenderingContext2D,
  d: Drawing,
  conv: CoordConverter,
  isDraft = false
) {
  ctx.save();
  if (isDraft) ctx.globalAlpha = 0.6;
  switch (d.type) {
    case "trendline":
      drawTrendline(ctx, d, conv);
      break;
    case "horizontal":
      drawHorizontalLine(ctx, d, conv);
      break;
    case "vertical":
      drawVerticalLine(ctx, d, conv);
      break;
    case "fib":
      drawFib(ctx, d, conv);
      break;
    case "rectangle":
      drawRectangle(ctx, d, conv);
      break;
    case "text":
      drawText(ctx, d, conv);
      break;
  }
  ctx.restore();
}

function drawTrendline(
  ctx: CanvasRenderingContext2D,
  d: Drawing,
  conv: CoordConverter
) {
  if (!d.p2) return;
  const x1 = conv.timeToX(d.p1.time);
  const y1 = conv.priceToY(d.p1.price);
  const x2 = conv.timeToX(d.p2.time);
  const y2 = conv.priceToY(d.p2.price);

  // Extrapolate to chart edges (ray-like)
  const dx = x2 - x1;
  const dy = y2 - y1;
  if (dx === 0) {
    // Vertical line case
    ctx.beginPath();
    ctx.strokeStyle = d.color;
    ctx.lineWidth = 1.5;
    ctx.moveTo(x1, 0);
    ctx.lineTo(x1, 10000);
    ctx.stroke();
    return;
  }
  const slope = dy / dx;
  // Left edge
  const xL = -1000;
  const yL = y1 + slope * (xL - x1);
  // Right edge
  const xR = 100000;
  const yR = y1 + slope * (xR - x1);

  ctx.beginPath();
  ctx.strokeStyle = d.color;
  ctx.lineWidth = 1.5;
  ctx.moveTo(xL, yL);
  ctx.lineTo(xR, yR);
  ctx.stroke();

  // Endpoints
  ctx.fillStyle = d.color;
  ctx.beginPath();
  ctx.arc(x1, y1, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x2, y2, 3, 0, Math.PI * 2);
  ctx.fill();
}

function drawHorizontalLine(
  ctx: CanvasRenderingContext2D,
  d: Drawing,
  conv: CoordConverter
) {
  const y = conv.priceToY(d.p1.price);

  ctx.beginPath();
  ctx.strokeStyle = d.color;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 4]);
  ctx.moveTo(-1000, y);
  ctx.lineTo(100000, y);
  ctx.stroke();
  ctx.setLineDash([]);

  // Price label on right
  const label = d.p1.price.toFixed(2);
  ctx.font = "bold 10px system-ui, sans-serif";
  const labelW = ctx.measureText(label).width + 10;
  ctx.fillStyle = d.color;
  ctx.fillRect(ctx.canvas.width / (window.devicePixelRatio || 1) - 72 - labelW, y - 9, labelW, 18);
  ctx.fillStyle = "#0a0e17";
  ctx.textAlign = "center";
  ctx.fillText(label, ctx.canvas.width / (window.devicePixelRatio || 1) - 72 - labelW / 2, y + 3.5);
}

function drawVerticalLine(
  ctx: CanvasRenderingContext2D,
  d: Drawing,
  conv: CoordConverter
) {
  const x = conv.timeToX(d.p1.time);

  ctx.beginPath();
  ctx.strokeStyle = d.color;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 4]);
  ctx.moveTo(x, -1000);
  ctx.lineTo(x, 100000);
  ctx.stroke();
  ctx.setLineDash([]);

  // Time label at bottom
  const d2 = new Date(d.p1.time * 1000);
  const label = `${d2.getHours().toString().padStart(2, "0")}:${d2
    .getMinutes()
    .toString()
    .padStart(2, "0")}`;
  ctx.font = "bold 10px system-ui, sans-serif";
  const labelW = ctx.measureText(label).width + 10;
  ctx.fillStyle = d.color;
  ctx.fillRect(x - labelW / 2, ctx.canvas.height / (window.devicePixelRatio || 1) - 18, labelW, 16);
  ctx.fillStyle = "#0a0e17";
  ctx.textAlign = "center";
  ctx.fillText(label, x, ctx.canvas.height / (window.devicePixelRatio || 1) - 6);
}

function drawFib(
  ctx: CanvasRenderingContext2D,
  d: Drawing,
  conv: CoordConverter
) {
  if (!d.p2) return;
  const x1 = conv.timeToX(d.p1.time);
  const x2 = conv.timeToX(d.p2.time);
  const y1 = conv.priceToY(d.p1.price);
  const y2 = conv.priceToY(d.p2.price);

  // Extend lines across the chart
  const xL = -1000;
  const xR = 100000;

  const priceHigh = Math.max(d.p1.price, d.p2.price);
  const priceLow = Math.min(d.p1.price, d.p2.price);
  const range = priceHigh - priceLow;

  // Draw main trend line connecting p1 → p2
  ctx.beginPath();
  ctx.strokeStyle = d.color;
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 3]);
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.setLineDash([]);

  // Draw fib levels
  ctx.font = "9px system-ui, sans-serif";
  ctx.textAlign = "left";
  for (const fl of FIB_LEVELS) {
    const price = priceHigh - range * fl.level;
    const y = conv.priceToY(price);
    if (y < -100 || y > 100000) continue;

    ctx.beginPath();
    ctx.strokeStyle = d.color;
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = 1;
    ctx.moveTo(xL, y);
    ctx.lineTo(xR, y);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Label
    const lbl = `${fl.label} (${price.toFixed(2)})`;
    ctx.fillStyle = d.color;
    ctx.fillRect(x1 + 2, y - 8, ctx.measureText(lbl).width + 8, 14);
    ctx.fillStyle = "#0a0e17";
    ctx.fillText(lbl, x1 + 6, y + 2);
  }

  // Endpoints
  ctx.fillStyle = d.color;
  ctx.beginPath();
  ctx.arc(x1, y1, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x2, y2, 3, 0, Math.PI * 2);
  ctx.fill();
}

function drawRectangle(
  ctx: CanvasRenderingContext2D,
  d: Drawing,
  conv: CoordConverter
) {
  if (!d.p2) return;
  const x1 = conv.timeToX(d.p1.time);
  const y1 = conv.priceToY(d.p1.price);
  const x2 = conv.timeToX(d.p2.time);
  const y2 = conv.priceToY(d.p2.price);

  const x = Math.min(x1, x2);
  const y = Math.min(y1, y2);
  const w = Math.abs(x2 - x1);
  const h = Math.abs(y2 - y1);

  // Fill (semi-transparent)
  ctx.fillStyle = d.color + "20"; // 20 = ~12% opacity in hex
  ctx.fillRect(x, y, w, h);

  // Border
  ctx.strokeStyle = d.color;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([3, 2]);
  ctx.strokeRect(x, y, w, h);
  ctx.setLineDash([]);
}

function drawText(
  ctx: CanvasRenderingContext2D,
  d: Drawing,
  conv: CoordConverter
) {
  if (!d.text) return;
  const x = conv.timeToX(d.p1.time);
  const y = conv.priceToY(d.p1.price);

  ctx.font = "11px system-ui, sans-serif";
  const w = ctx.measureText(d.text).width;

  // Background
  ctx.fillStyle = d.color + "30";
  ctx.fillRect(x - 4, y - 14, w + 8, 18);

  // Text
  ctx.fillStyle = d.color;
  ctx.textAlign = "left";
  ctx.fillText(d.text, x, y);
}

/* ═══════════════════════════════════════════
   Hit-testing for eraser tool.
   Returns true if the point (screen coords)
   is on or near the drawing.
   ═══════════════════════════════════════════ */

const HIT_THRESHOLD = 6; // px

export function hitTestDrawing(
  d: Drawing,
  x: number,
  y: number,
  conv: CoordConverter
): boolean {
  switch (d.type) {
    case "trendline":
    case "rectangle": {
      if (!d.p2) return false;
      const x1 = conv.timeToX(d.p1.time);
      const y1 = conv.priceToY(d.p1.price);
      const x2 = conv.timeToX(d.p2.time);
      const y2 = conv.priceToY(d.p2.price);
      if (d.type === "trendline") {
        return distanceToLine(x, y, x1, y1, x2, y2) < HIT_THRESHOLD;
      }
      // rectangle: hit if inside or on edge
      const minX = Math.min(x1, x2);
      const maxX = Math.max(x1, x2);
      const minY = Math.min(y1, y2);
      const maxY = Math.max(y1, y2);
      return (
        x >= minX - HIT_THRESHOLD &&
        x <= maxX + HIT_THRESHOLD &&
        y >= minY - HIT_THRESHOLD &&
        y <= maxY + HIT_THRESHOLD
      );
    }
    case "horizontal": {
      const y1 = conv.priceToY(d.p1.price);
      return Math.abs(y - y1) < HIT_THRESHOLD;
    }
    case "vertical": {
      const x1 = conv.timeToX(d.p1.time);
      return Math.abs(x - x1) < HIT_THRESHOLD;
    }
    case "fib": {
      if (!d.p2) return false;
      const x1 = conv.timeToX(d.p1.time);
      const y1 = conv.priceToY(d.p1.price);
      const y2 = conv.priceToY(d.p2.price);
      const priceHigh = Math.max(d.p1.price, d.p2.price);
      const priceLow = Math.min(d.p1.price, d.p2.price);
      const range = priceHigh - priceLow;
      for (const fl of FIB_LEVELS) {
        const price = priceHigh - range * fl.level;
        const fy = conv.priceToY(price);
        if (Math.abs(y - fy) < HIT_THRESHOLD) return true;
      }
      // Also hit the trend line between p1 and p2
      const x2 = conv.timeToX(d.p2.time);
      if (distanceToLine(x, y, x1, y1, x2, y2) < HIT_THRESHOLD) return true;
      return false;
    }
    case "text": {
      if (!d.text) return false;
      const x1 = conv.timeToX(d.p1.time);
      const y1 = conv.priceToY(d.p1.price);
      // Approximate width: 6px per character at 11px font
      const w = d.text.length * 6 + 8;
      return (
        x >= x1 - 4 &&
        x <= x1 + w + 4 &&
        y >= y1 - 14 &&
        y <= y1 + 4
      );
    }
  }
  return false;
}

function distanceToLine(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / lengthSq;
  t = Math.max(0, Math.min(1, t));
  const projX = x1 + t * dx;
  const projY = y1 + t * dy;
  return Math.hypot(px - projX, py - projY);
}
