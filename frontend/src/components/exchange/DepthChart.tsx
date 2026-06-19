"use client";

import { useMemo, useRef, useEffect } from "react";
import { BarChart3 } from "lucide-react";
import { pricePrecision } from "./constants";

interface DepthChartProps {
  bids: [string, string][];
  asks: [string, string][];
  currentPrice?: number;
  maxPoints?: number;
}

/**
 * Cumulative depth chart visualization (area chart).
 * Asks (red) build from right-to-left, bids (green) from left-to-right.
 * The meeting point represents the current price / spread.
 *
 * Canvas-based for performance and pixel-perfect rendering.
 */
export default function DepthChart({
  bids,
  asks,
  currentPrice,
  maxPoints = 40,
}: DepthChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  /* Compute aggregated cumulative depth points */
  const { bidPoints, askPoints, maxCumulative, minPrice, maxPrice } = useMemo(() => {
    /* Aggregate bids: sort descending by price, accumulate qty */
    const sortedBids = bids
      .map(([p, q]) => ({ price: parseFloat(p), qty: parseFloat(q) }))
      .filter((b) => isFinite(b.price) && isFinite(b.qty) && b.qty > 0)
      .sort((a, b) => b.price - a.price);

    const bidPoints: { price: number; cum: number }[] = [];
    let cum = 0;
    for (const b of sortedBids.slice(0, maxPoints)) {
      cum += b.qty;
      bidPoints.push({ price: b.price, cum });
    }

    /* Aggregate asks: sort ascending by price, accumulate qty */
    const sortedAsks = asks
      .map(([p, q]) => ({ price: parseFloat(p), qty: parseFloat(q) }))
      .filter((a) => isFinite(a.price) && isFinite(a.qty) && a.qty > 0)
      .sort((a, b) => a.price - b.price);

    const askPoints: { price: number; cum: number }[] = [];
    cum = 0;
    for (const a of sortedAsks.slice(0, maxPoints)) {
      cum += a.qty;
      askPoints.push({ price: a.price, cum });
    }

    const maxCumulative = Math.max(
      bidPoints[bidPoints.length - 1]?.cum || 0,
      askPoints[askPoints.length - 1]?.cum || 0,
      0.0001
    );

    const minPrice =
      bidPoints.length > 0 ? bidPoints[bidPoints.length - 1].price : 0;
    const maxPrice =
      askPoints.length > 0 ? askPoints[askPoints.length - 1].price : 0;

    return { bidPoints, askPoints, maxCumulative, minPrice, maxPrice };
  }, [bids, asks, maxPoints]);

  /* Render the chart */
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const dpr = window.devicePixelRatio || 1;
    const w = container.clientWidth;
    const h = container.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    const padding = { top: 8, right: 8, bottom: 8, left: 8 };
    const chartW = w - padding.left - padding.right;
    const chartH = h - padding.top - padding.bottom;

    if (bidPoints.length === 0 && askPoints.length === 0) {
      ctx.fillStyle = "rgba(255,255,255,0.3)";
      ctx.font = "10px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("بانتظار بيانات السوق...", w / 2, h / 2);
      return;
    }

    const priceRange = maxPrice - minPrice || 1;
    const midPrice = currentPrice || (minPrice + maxPrice) / 2;

    /* Map price -> x (centered at midPrice) */
    const priceToX = (price: number) => {
      const offset = price - midPrice;
      // Half-range scale on each side
      const halfRange = Math.max(
        Math.abs(maxPrice - midPrice),
        Math.abs(midPrice - minPrice),
        priceRange / 2
      );
      const x = padding.left + chartW / 2 + (offset / halfRange) * (chartW / 2);
      return Math.max(padding.left, Math.min(padding.left + chartW, x));
    };

    const cumToY = (cum: number) => {
      return (
        padding.top +
        chartH -
        (cum / maxCumulative) * chartH
      );
    };

    /* ───── Draw bids area (green, on the left) ───── */
    if (bidPoints.length > 0) {
      ctx.beginPath();
      ctx.moveTo(priceToX(bidPoints[0].price), padding.top + chartH);
      for (const p of bidPoints) {
        ctx.lineTo(priceToX(p.price), cumToY(p.cum));
      }
      ctx.lineTo(priceToX(bidPoints[bidPoints.length - 1].price), padding.top + chartH);
      ctx.closePath();

      const gradient = ctx.createLinearGradient(0, padding.top, 0, padding.top + chartH);
      gradient.addColorStop(0, "rgba(0,192,135,0.35)");
      gradient.addColorStop(1, "rgba(0,192,135,0.02)");
      ctx.fillStyle = gradient;
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(priceToX(bidPoints[0].price), cumToY(bidPoints[0].cum));
      for (const p of bidPoints) {
        ctx.lineTo(priceToX(p.price), cumToY(p.cum));
      }
      ctx.strokeStyle = "rgba(0,192,135,0.9)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    /* ───── Draw asks area (red, on the right) ───── */
    if (askPoints.length > 0) {
      ctx.beginPath();
      ctx.moveTo(priceToX(askPoints[0].price), padding.top + chartH);
      for (const p of askPoints) {
        ctx.lineTo(priceToX(p.price), cumToY(p.cum));
      }
      ctx.lineTo(priceToX(askPoints[askPoints.length - 1].price), padding.top + chartH);
      ctx.closePath();

      const gradient = ctx.createLinearGradient(0, padding.top, 0, padding.top + chartH);
      gradient.addColorStop(0, "rgba(246,70,93,0.35)");
      gradient.addColorStop(1, "rgba(246,70,93,0.02)");
      ctx.fillStyle = gradient;
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(priceToX(askPoints[0].price), cumToY(askPoints[0].cum));
      for (const p of askPoints) {
        ctx.lineTo(priceToX(p.price), cumToY(p.cum));
      }
      ctx.strokeStyle = "rgba(246,70,93,0.9)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    /* ───── Current price vertical line ───── */
    if (currentPrice) {
      const x = priceToX(currentPrice);
      ctx.beginPath();
      ctx.moveTo(x, padding.top);
      ctx.lineTo(x, padding.top + chartH);
      ctx.strokeStyle = "rgba(255,255,255,0.4)";
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.stroke();
      ctx.setLineDash([]);

      // Price label
      ctx.fillStyle = "rgba(20,25,35,0.9)";
      const label = currentPrice.toFixed(pricePrecision(currentPrice));
      ctx.font = "9px monospace";
      const labelW = ctx.measureText(label).width + 8;
      ctx.fillRect(x - labelW / 2, padding.top - 2, labelW, 14);
      ctx.fillStyle = "#e2e8f0";
      ctx.textAlign = "center";
      ctx.fillText(label, x, padding.top + 8);
    }

    /* ───── Grid lines ───── */
    ctx.strokeStyle = "rgba(255,255,255,0.04)";
    ctx.lineWidth = 1;
    for (let i = 1; i < 4; i++) {
      const y = padding.top + (chartH / 4) * i;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(padding.left + chartW, y);
      ctx.stroke();
    }
  }, [bidPoints, askPoints, maxCumulative, minPrice, maxPrice, currentPrice]);

  return (
    <div className="glass-panel rounded-xl flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-border/20 shrink-0">
        <div className="flex items-center gap-1.5">
          <BarChart3 className="h-3 w-3 text-primary" />
          <h3 className="font-bold text-[10px]">منحنى العمق</h3>
        </div>
        <span className="text-[9px] text-muted-foreground">العمق التراكمي</span>
      </div>
      <div ref={containerRef} className="flex-1 min-h-0 relative">
        <canvas ref={canvasRef} className="absolute inset-0" />
      </div>
    </div>
  );
}
