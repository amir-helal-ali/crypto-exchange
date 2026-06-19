"use client";

import { useEffect, useState, useMemo } from "react";
import {
  Wallet,
  ArrowUpDown,
  Settings2,
  Calculator,
} from "lucide-react";
import { ORDER_TYPE_LABELS } from "./constants";
import type {
  OrderSide,
  OrderType,
  Wallet as WalletType,
  FeeSchedule,
  TickerData,
} from "./types";

interface TradeFormProps {
  base: string;
  side: OrderSide;
  orderType: OrderType;
  onSideChange: (s: OrderSide) => void;
  onTypeChange: (t: OrderType) => void;
  onSubmit: (form: { quantity: string; price: string; stopPrice: string }) => void;
  loading: boolean;
  baseWallet?: WalletType;
  quoteWallet?: WalletType;
  ticker?: TickerData;
  feeSchedules: FeeSchedule[];
}

/**
 * Advanced order form with:
 * - Buy/Sell toggle (color-themed)
 * - Order type tabs (Market, Limit, Stop-Limit, Take-Profit)
 * - Percentage slider (25/50/75/100% of balance)
 * - Live fee/cost estimation
 * - Available balance display
 */
export default function TradeForm({
  base,
  side,
  orderType,
  onSideChange,
  onTypeChange,
  onSubmit,
  loading,
  baseWallet,
  quoteWallet,
  ticker,
  feeSchedules,
}: TradeFormProps) {
  const [quantity, setQuantity] = useState("");
  const [price, setPrice] = useState("");
  const [stopPrice, setStopPrice] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  /* Reset form when pair changes */
  useEffect(() => {
    setQuantity("");
    setPrice("");
    setStopPrice("");
  }, [base]);

  /* Allow parent (order book clicks) to set price via a custom event */
  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<number>;
      if (typeof ce.detail === "number") {
        setPrice(ce.detail.toFixed(2));
        if (orderType === "MARKET") onTypeChange("LIMIT");
      }
    };
    window.addEventListener("exchange:set-price", handler);
    return () => window.removeEventListener("exchange:set-price", handler);
  }, [orderType, onTypeChange]);

  /* Get fee rate */
  const feeRate = useMemo(() => {
    const userType = "USER";
    const schedule = feeSchedules.find(
      (f) => f.user_type === userType && f.order_type === orderType
    );
    if (schedule) {
      return orderType === "MARKET" || orderType === "TAKE_PROFIT"
        ? schedule.taker_fee
        : schedule.maker_fee || schedule.taker_fee;
    }
    return orderType === "MARKET" || orderType === "TAKE_PROFIT"
      ? 0.0025
      : 0.0015;
  }, [feeSchedules, orderType]);

  /* Active price (current market price for MARKET, form price for LIMIT) */
  const activePrice = useMemo(() => {
    if (orderType === "MARKET") return ticker?.price || 0;
    const p = parseFloat(price);
    return isNaN(p) || p <= 0 ? ticker?.price || 0 : p;
  }, [orderType, price, ticker]);

  /* Estimated cost/fee */
  const qty = parseFloat(quantity) || 0;
  const estimatedTotal = qty > 0 ? qty * activePrice : 0;
  const estimatedFee = estimatedTotal * feeRate;
  const finalTotal =
    side === "BUY" ? estimatedTotal + estimatedFee : estimatedTotal - estimatedFee;

  /* Max quantity based on side and balance */
  const maxQty = useMemo(() => {
    if (side === "BUY") {
      const bal = quoteWallet?.balance ? parseFloat(quoteWallet.balance) : 0;
      if (activePrice <= 0) return 0;
      return bal / (activePrice * (1 + feeRate));
    } else {
      return baseWallet?.balance ? parseFloat(baseWallet.balance) : 0;
    }
  }, [side, baseWallet, quoteWallet, activePrice, feeRate]);

  /* Apply percentage */
  const applyPercent = (pct: number) => {
    if (maxQty <= 0) return;
    setQuantity((maxQty * (pct / 100)).toFixed(8));
  };

  /* Available balance display */
  const availableBalance =
    side === "BUY"
      ? quoteWallet?.balance
        ? parseFloat(quoteWallet.balance).toFixed(2)
        : "0.00"
      : baseWallet?.balance
        ? parseFloat(baseWallet.balance).toFixed(8)
        : "0.00000000";
  const availableUnit = side === "BUY" ? "USDT" : base;

  /* Side-based styling */
  const sideColor = side === "BUY" ? "emerald" : "red";
  const sideAccent =
    side === "BUY"
      ? {
          bg: "bg-emerald-500",
          bgHover: "hover:bg-emerald-400",
          shadow: "shadow-emerald-500/25",
          shadowHover: "hover:shadow-emerald-500/40",
          text: "text-emerald-400",
          bgSoft: "bg-emerald-500/10",
          bgSoftHover: "hover:bg-emerald-500/20",
          ring: "ring-emerald-500/10",
          border: "border-emerald-500/20",
        }
      : {
          bg: "bg-red-500",
          bgHover: "hover:bg-red-400",
          shadow: "shadow-red-500/25",
          shadowHover: "hover:shadow-red-500/40",
          text: "text-red-400",
          bgSoft: "bg-red-500/10",
          bgSoftHover: "hover:bg-red-500/20",
          ring: "ring-red-500/10",
          border: "border-red-500/20",
        };

  /* Submit handler */
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ quantity, price, stopPrice });
  };

  return (
    <div
      className={`glass-panel rounded-xl flex flex-col overflow-hidden transition-all duration-300 ring-1 ${sideAccent.ring}`}
    >
      {/* Buy/Sell Toggle */}
      <div className="flex p-1.5 m-2 mb-0 rounded-lg bg-muted/20 gap-1">
        {(["BUY", "SELL"] as const).map((s) => {
          const isBuy = s === "BUY";
          const isActive = side === s;
          return (
            <button
              key={s}
              onClick={() => onSideChange(s)}
              className={`flex-1 py-2 rounded-md text-[11px] font-bold transition-all duration-300 ${
                isActive
                  ? isBuy
                    ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/25"
                    : "bg-red-500 text-white shadow-lg shadow-red-500/25"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
              }`}
            >
              {isBuy ? "شراء" : "بيع"} {base}
            </button>
          );
        })}
      </div>

      <div className="p-2.5 space-y-2.5">
        {/* Order Type Tabs */}
        <div className="flex items-center gap-0.5 bg-muted/15 rounded-lg p-0.5">
          {(
            ["LIMIT", "MARKET", "STOP_LIMIT", "TAKE_PROFIT"] as const
          ).map((t) => (
            <button
              key={t}
              onClick={() => onTypeChange(t)}
              className={`flex-1 py-1.5 px-1 rounded-md text-[9px] font-medium transition-all duration-200 text-center ${
                orderType === t
                  ? `${sideAccent.bgSoft} ${sideAccent.text} border ${sideAccent.border}`
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/20 border border-transparent"
              }`}
            >
              {ORDER_TYPE_LABELS[t]}
            </button>
          ))}
        </div>

        {/* Available Balance */}
        <div
          className={`flex items-center justify-between p-2 rounded-lg border text-[10px] ${sideAccent.bgSoft} ${sideAccent.border}`}
        >
          <div className="flex items-center gap-1.5">
            <Wallet className="h-3 w-3 text-muted-foreground" />
            <span className="text-muted-foreground">الرصيد المتاح</span>
          </div>
          <span className="font-medium tabular-nums">
            {availableBalance}{" "}
            <span className="text-muted-foreground">{availableUnit}</span>
          </span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-2">
          {/* Price input (LIMIT / STOP_LIMIT) */}
          {(orderType === "LIMIT" || orderType === "STOP_LIMIT") && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] text-muted-foreground font-medium">
                  السعر
                </label>
                <button
                  type="button"
                  onClick={() => ticker?.price && setPrice(ticker.price.toFixed(2))}
                  className="text-[9px] text-primary hover:underline"
                >
                  {ticker?.price
                    ? `آخر سعر: ${ticker.price.toFixed(2)}`
                    : "استخدام آخر سعر"}
                </button>
              </div>
              <div className="relative">
                <input
                  type="number"
                  step="any"
                  className="input-field text-xs py-2 pl-14 pr-3 tabular-nums"
                  placeholder="0.00"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  required
                />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground font-medium">
                  USDT
                </span>
              </div>
            </div>
          )}

          {/* Stop Price (STOP_LIMIT / TAKE_PROFIT) */}
          {(orderType === "STOP_LIMIT" || orderType === "TAKE_PROFIT") && (
            <div>
              <label className="text-[10px] text-muted-foreground font-medium mb-1 block">
                {orderType === "STOP_LIMIT" ? "سعر الإيقاف" : "سعر جني الأرباح"}
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="any"
                  className="input-field text-xs py-2 pl-14 pr-3 tabular-nums"
                  placeholder="0.00"
                  value={stopPrice}
                  onChange={(e) => setStopPrice(e.target.value)}
                  required
                />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground font-medium">
                  USDT
                </span>
              </div>
            </div>
          )}

          {/* Quantity */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[10px] text-muted-foreground font-medium">
                الكمية
              </label>
              {orderType === "MARKET" && ticker?.price && (
                <span className="text-[9px] text-muted-foreground/60 tabular-nums">
                  ≈ {qty > 0 ? (qty * ticker.price).toFixed(2) : "0.00"} USDT
                </span>
              )}
            </div>
            <div className="relative">
              <input
                type="number"
                step="any"
                className="input-field text-xs py-2 pl-14 pr-3 tabular-nums"
                placeholder="0.00"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                required
              />
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground font-medium">
                {base}
              </span>
            </div>
          </div>

          {/* Percentage slider */}
          <div className="grid grid-cols-4 gap-1">
            {[25, 50, 75, 100].map((pct) => (
              <button
                key={pct}
                type="button"
                onClick={() => applyPercent(pct)}
                className={`py-1 rounded text-[10px] font-medium transition-all duration-200 border ${sideAccent.bgSoft} ${sideAccent.text} ${sideAccent.border} ${sideAccent.bgSoftHover}`}
              >
                {pct}%
              </button>
            ))}
          </div>

          {/* Order book slider visualization */}
          <div className="relative h-1.5 bg-muted/30 rounded-full overflow-hidden">
            <div
              className={`h-full ${sideColor === "emerald" ? "bg-emerald-500" : "bg-red-500"} transition-all duration-300`}
              style={{
                width: `${Math.min(100, maxQty > 0 ? (qty / maxQty) * 100 : 0)}%`,
              }}
            />
          </div>

          {/* Estimated Cost + Fee */}
          {qty > 0 && activePrice > 0 && (
            <div className="bg-muted/10 rounded-lg p-2 space-y-1.5 border border-border/10">
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-muted-foreground">
                  {side === "BUY" ? "التكلفة التقديرية" : "القيمة التقديرية"}
                </span>
                <span className="font-medium tabular-nums">
                  {estimatedTotal.toFixed(2)} USDT
                </span>
              </div>
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-muted-foreground flex items-center gap-1">
                  <Calculator className="h-2.5 w-2.5" />
                  الرسوم (~{(feeRate * 100).toFixed(2)}%)
                </span>
                <span className="font-medium tabular-nums text-muted-foreground">
                  {estimatedFee.toFixed(4)} USDT
                </span>
              </div>
              <div className="border-t border-border/20 pt-1.5 flex items-center justify-between text-[10px]">
                <span className="text-muted-foreground font-medium">
                  {side === "BUY" ? "الإجمالي المطلوب" : "صافي الاستلام"}
                </span>
                <span className={`font-bold tabular-nums ${sideAccent.text}`}>
                  {finalTotal.toFixed(2)} USDT
                </span>
              </div>
            </div>
          )}

          {/* Advanced toggle (decorative for now) */}
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-1 text-[9px] text-muted-foreground hover:text-foreground transition-colors"
          >
            <Settings2 className="h-3 w-3" />
            إعدادات متقدمة
          </button>

          {showAdvanced && (
            <div className="space-y-1.5 p-2 bg-muted/5 rounded-lg border border-border/10 animate-slide-in-down">
              <label className="flex items-center justify-between text-[10px]">
                <span className="text-muted-foreground">تنفيذ فوري فقط (IOC)</span>
                <input type="checkbox" className="h-3 w-3 accent-primary" />
              </label>
              <label className="flex items-center justify-between text-[10px]">
                <span className="text-muted-foreground">إلغاء عند عدم التنفيذ (FOK)</span>
                <input type="checkbox" className="h-3 w-3 accent-primary" />
              </label>
              <label className="flex items-center justify-between text-[10px]">
                <span className="text-muted-foreground">إظهار التأكيد</span>
                <input type="checkbox" className="h-3 w-3 accent-primary" defaultChecked />
              </label>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className={`w-full py-2.5 rounded-lg font-bold text-xs text-white transition-all duration-300 flex items-center justify-center gap-1.5 ${sideAccent.bg} ${sideAccent.bgHover} shadow-lg ${sideAccent.shadow} ${sideAccent.shadowHover} disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {loading ? (
              <span className="h-3.5 w-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <ArrowUpDown className="h-3.5 w-3.5" />
            )}
            {loading
              ? "جاري التنفيذ..."
              : `${side === "BUY" ? "شراء" : "بيع"} ${base}`}
          </button>
        </form>
      </div>
    </div>
  );
}
