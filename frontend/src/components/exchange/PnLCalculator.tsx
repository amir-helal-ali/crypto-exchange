"use client";

import { useState, useMemo, useEffect } from "react";
import { Calculator, X, TrendingUp, TrendingDown, Info } from "lucide-react";
import { formatPrice, pricePrecision, qtyPrecision } from "./constants";
import type { TickerData, OrderSide } from "./types";

/* ═══════════════════════════════════════════
   Types
   ═══════════════════════════════════════════ */

interface PnLCalculatorProps {
  pair: string;
  base: string;
  ticker?: TickerData;
  feeRate: number; // e.g. 0.001 for 0.1%
  currentPrice?: number;
}

type Direction = "long" | "short";

/* ═══════════════════════════════════════════
   Component
   ═══════════════════════════════════════════ */

export default function PnLCalculator({
  pair,
  base,
  ticker,
  feeRate,
  currentPrice,
}: PnLCalculatorProps) {
  const [open, setOpen] = useState(false);
  const [direction, setDirection] = useState<Direction>("long");
  const [entryPrice, setEntryPrice] = useState("");
  const [exitPrice, setExitPrice] = useState("");
  const [quantity, setQuantity] = useState("");
  const [leverage, setLeverage] = useState("1");

  // Auto-fill entry/exit with current price when modal opens
  useEffect(() => {
    if (open && currentPrice && !entryPrice) {
      setEntryPrice(currentPrice.toString());
    }
    if (open && currentPrice && !exitPrice) {
      setExitPrice(currentPrice.toString());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, currentPrice]);

  // Sync direction with side semantics: long = buy low sell high; short = sell high buy low
  const side: OrderSide = direction === "long" ? "BUY" : "SELL";

  /* Calculations */
  const calc = useMemo(() => {
    const entry = parseFloat(entryPrice);
    const exit = parseFloat(exitPrice);
    const qty = parseFloat(quantity);
    const lev = parseFloat(leverage) || 1;

    if (!entry || !exit || !qty || entry <= 0 || exit <= 0 || qty <= 0) {
      return null;
    }

    // Notional = entry * qty (total position value)
    const notional = entry * qty;
    // Margin = notional / leverage (capital required)
    const margin = notional / Math.max(1, lev);

    // Raw PnL
    const priceDiff = direction === "long" ? exit - entry : entry - exit;
    const rawPnL = priceDiff * qty;
    const rawPnLPercent = (priceDiff / entry) * 100;

    // Fees: paid on entry and exit (each = notional * feeRate)
    const entryFee = entry * qty * feeRate;
    const exitFee = exit * qty * feeRate;
    const totalFees = entryFee + exitFee;

    // Net PnL after fees
    const netPnL = rawPnL - totalFees;
    const netPnLPercent = (netPnL / margin) * 100; // ROI on margin

    // Return on investment (with leverage): rawPnLPercent * leverage
    const leveragedROI = rawPnLPercent * lev;

    // Break-even price (where net PnL = 0)
    // For long: exit_price = entry + totalFees_per_unit / 1 = entry + 2*feeRate*entry (approximation)
    // More accurately: entry*qty*feeRate + exit_be*qty*feeRate = (exit_be - entry)*qty
    // → exit_be = (entry + entry*feeRate + exit_be*feeRate) / 1
    // → exit_be*(1 - feeRate) = entry*(1 + feeRate)
    // → exit_be = entry * (1 + feeRate) / (1 - feeRate)
    // For short: exit_be = entry * (1 - feeRate) / (1 + feeRate)
    const breakEvenPrice =
      direction === "long"
        ? (entry * (1 + feeRate)) / (1 - feeRate)
        : (entry * (1 - feeRate)) / (1 + feeRate);

    const isProfit = netPnL >= 0;

    return {
      notional,
      margin,
      rawPnL,
      rawPnLPercent,
      entryFee,
      exitFee,
      totalFees,
      netPnL,
      netPnLPercent,
      leveragedROI,
      breakEvenPrice,
      isProfit,
    };
  }, [entryPrice, exitPrice, quantity, leverage, direction, feeRate]);

  const precision =
    currentPrice != null
      ? pricePrecision(currentPrice)
      : entryPrice
      ? pricePrecision(parseFloat(entryPrice))
      : 2;

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(true)}
        className="glass-panel rounded-lg p-2 text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-all"
        title="حاسبة الربح والخسارة"
      >
        <Calculator className="h-4 w-4" />
      </button>

      {/* Modal */}
      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center px-4 bg-black/60 backdrop-blur-sm animate-fade-in"
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <div className="w-full max-w-lg glass-panel-strong rounded-2xl shadow-2xl border border-border/40 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/30">
              <div className="flex items-center gap-2">
                <Calculator className="h-4 w-4 text-primary" />
                <h3 className="font-bold text-sm">حاسبة الربح والخسارة</h3>
                <span className="text-[10px] text-muted-foreground">
                  {base}/USDT
                </span>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-4 space-y-4">
              {/* Direction switch */}
              <div>
                <label className="text-[10px] text-muted-foreground mb-1.5 block">
                  اتجاه الصفقة
                </label>
                <div className="grid grid-cols-2 gap-1 bg-muted/20 rounded-lg p-0.5">
                  <button
                    onClick={() => setDirection("long")}
                    className={`py-1.5 rounded-md text-xs font-bold transition-all flex items-center justify-center gap-1 ${
                      direction === "long"
                        ? "bg-emerald-500/20 text-emerald-400"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <TrendingUp className="h-3.5 w-3.5" />
                    شراء (Long)
                  </button>
                  <button
                    onClick={() => setDirection("short")}
                    className={`py-1.5 rounded-md text-xs font-bold transition-all flex items-center justify-center gap-1 ${
                      direction === "short"
                        ? "bg-red-500/20 text-red-400"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <TrendingDown className="h-3.5 w-3.5" />
                    بيع (Short)
                  </button>
                </div>
              </div>

              {/* Entry/Exit prices */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-muted-foreground mb-1.5 block">
                    سعر الدخول (USDT)
                  </label>
                  <input
                    type="number"
                    value={entryPrice}
                    onChange={(e) => setEntryPrice(e.target.value)}
                    placeholder="0.00"
                    step="any"
                    className="w-full bg-muted/30 border border-border/30 rounded-lg text-xs py-2 px-3 placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/40 font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground mb-1.5 block">
                    سعر الخروج (USDT)
                  </label>
                  <input
                    type="number"
                    value={exitPrice}
                    onChange={(e) => setExitPrice(e.target.value)}
                    placeholder="0.00"
                    step="any"
                    className="w-full bg-muted/30 border border-border/30 rounded-lg text-xs py-2 px-3 placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/40 font-mono"
                  />
                </div>
              </div>

              {/* Quantity & Leverage */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-muted-foreground mb-1.5 block">
                    الكمية ({base})
                  </label>
                  <input
                    type="number"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    placeholder="0.00"
                    step="any"
                    className="w-full bg-muted/30 border border-border/30 rounded-lg text-xs py-2 px-3 placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/40 font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground mb-1.5 block">
                    الرافعة المالية (x)
                  </label>
                  <input
                    type="number"
                    value={leverage}
                    onChange={(e) => setLeverage(e.target.value)}
                    placeholder="1"
                    min="1"
                    step="1"
                    className="w-full bg-muted/30 border border-border/30 rounded-lg text-xs py-2 px-3 placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/40 font-mono"
                  />
                </div>
              </div>

              {/* Current price hint */}
              {currentPrice && (
                <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <Info className="h-3 w-3" />
                  السعر الحالي:{" "}
                  <span className="font-mono text-foreground">
                    {formatPrice(currentPrice)} USDT
                  </span>
                  <button
                    onClick={() => {
                      setEntryPrice(currentPrice.toString());
                      setExitPrice(currentPrice.toString());
                    }}
                    className="text-primary hover:underline mr-1"
                  >
                    استخدام السعر الحالي
                  </button>
                </div>
              )}

              {/* Results */}
              {calc ? (
                <div className="space-y-2 pt-2 border-t border-border/20">
                  {/* Net P&L — main highlight */}
                  <div
                    className={`rounded-lg p-3 border ${
                      calc.isProfit
                        ? "bg-emerald-500/10 border-emerald-500/30"
                        : "bg-red-500/10 border-red-500/30"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-muted-foreground">
                        صافي الربح/الخسارة
                      </span>
                      <span
                        className={`text-lg font-bold font-mono ${
                          calc.isProfit ? "text-emerald-400" : "text-red-400"
                        }`}
                      >
                        {calc.isProfit ? "+" : ""}
                        {calc.netPnL.toFixed(2)} USDT
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-[10px] text-muted-foreground">
                        العائد على الهامش
                      </span>
                      <span
                        className={`text-xs font-mono ${
                          calc.isProfit ? "text-emerald-400" : "text-red-400"
                        }`}
                      >
                        {calc.isProfit ? "+" : ""}
                        {calc.netPnLPercent.toFixed(2)}%
                      </span>
                    </div>
                  </div>

                  {/* Details grid */}
                  <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                    <DetailRow
                      label="قيمة الصفقة"
                      value={`${calc.notional.toFixed(2)} USDT`}
                    />
                    <DetailRow
                      label="الهامش المطلوب"
                      value={`${calc.margin.toFixed(2)} USDT`}
                    />
                    <DetailRow
                      label="الربح قبل الرسوم"
                      value={`${calc.rawPnL >= 0 ? "+" : ""}${calc.rawPnL.toFixed(
                        2
                      )} USDT`}
                      valueClass={
                        calc.rawPnL >= 0 ? "text-emerald-400" : "text-red-400"
                      }
                    />
                    <DetailRow
                      label="نسبة الربح قبل الرسوم"
                      value={`${calc.rawPnLPercent >= 0 ? "+" : ""}${calc.rawPnLPercent.toFixed(
                        2
                      )}%`}
                      valueClass={
                        calc.rawPnLPercent >= 0
                          ? "text-emerald-400"
                          : "text-red-400"
                      }
                    />
                    <DetailRow
                      label="رسوم الدخول"
                      value={`${calc.entryFee.toFixed(4)} USDT`}
                      valueClass="text-muted-foreground"
                    />
                    <DetailRow
                      label="رسوم الخروج"
                      value={`${calc.exitFee.toFixed(4)} USDT`}
                      valueClass="text-muted-foreground"
                    />
                    <DetailRow
                      label="إجمالي الرسوم"
                      value={`${calc.totalFees.toFixed(4)} USDT`}
                      valueClass="text-yellow-400"
                    />
                    <DetailRow
                      label="ROI مع الرافعة"
                      value={`${calc.leveragedROI >= 0 ? "+" : ""}${calc.leveragedROI.toFixed(
                        2
                      )}%`}
                      valueClass={
                        calc.leveragedROI >= 0
                          ? "text-emerald-400"
                          : "text-red-400"
                      }
                    />
                    <DetailRow
                      label="سعر التعادل"
                      value={`${calc.breakEvenPrice.toFixed(precision)} USDT`}
                      valueClass="text-blue-400"
                      full
                    />
                  </div>
                </div>
              ) : (
                <div className="rounded-lg p-4 border border-border/20 bg-muted/10 text-center text-xs text-muted-foreground">
                  أدخل أسعار الدخول والخروج والكمية لحساب الربح/الخسارة
                </div>
              )}

              {/* Fee info */}
              <div className="text-[10px] text-muted-foreground/70 flex items-center gap-1 pt-1 border-t border-border/10">
                <Info className="h-3 w-3 shrink-0" />
                <span>
                  الرسوم محسوبة بنسبة {(feeRate * 100).toFixed(2)}% لكل معاملة (دخول
                  + خروج). سعر التعادل يتضمن الرسوم.
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ═══════════════════════════════════════════
   Sub-components
   ═══════════════════════════════════════════ */

function DetailRow({
  label,
  value,
  valueClass = "text-foreground",
  full,
}: {
  label: string;
  value: string;
  valueClass?: string;
  full?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between px-2 py-1.5 rounded-md bg-muted/15 border border-border/10 ${
        full ? "col-span-2" : ""
      }`}
    >
      <span className="text-[10px] text-muted-foreground">{label}</span>
      <span className={`font-mono font-medium ${valueClass}`}>{value}</span>
    </div>
  );
}
