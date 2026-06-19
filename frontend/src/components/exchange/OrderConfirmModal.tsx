"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Shield,
  Target,
  TrendingDown,
  TrendingUp,
  Check,
  X,
  AlertTriangle,
  Calculator,
} from "lucide-react";
import { ORDER_TYPE_LABELS } from "./constants";
import type {
  OrderSide,
  OrderType,
  TickerData,
  FeeSchedule,
} from "./types";

export interface OrderConfirmData {
  side: OrderSide;
  orderType: OrderType;
  quantity: string;
  price: string;
  stopPrice: string;
  base: string;
}

interface OrderConfirmModalProps {
  open: boolean;
  data: OrderConfirmData | null;
  ticker?: TickerData;
  feeSchedules: FeeSchedule[];
  onConfirm: (extra: {
    stopLoss?: string;
    takeProfit?: string;
    reduceOnly: boolean;
    postOnly: boolean;
  }) => void;
  onClose: () => void;
  loading?: boolean;
}

/**
 * Order confirmation modal with optional SL/TP fields.
 * Mimics Binance/Bybit "Confirm Order" experience.
 *
 * - Shows order summary (type, side, qty, price, fees, total)
 * - Optional Stop-Loss / Take-Profit fields (calculates risk/reward)
 * - Advanced flags: Reduce-Only, Post-Only
 * - Live risk/reward ratio calculation when SL & TP are set
 */
export default function OrderConfirmModal({
  open,
  data,
  ticker,
  feeSchedules,
  onConfirm,
  onClose,
  loading = false,
}: OrderConfirmModalProps) {
  const [stopLoss, setStopLoss] = useState("");
  const [takeProfit, setTakeProfit] = useState("");
  const [reduceOnly, setReduceOnly] = useState(false);
  const [postOnly, setPostOnly] = useState(false);
  const [enableSL, setEnableSL] = useState(false);
  const [enableTP, setEnableTP] = useState(false);

  /* Reset fields when modal opens */
  useEffect(() => {
    if (open) {
      setStopLoss("");
      setTakeProfit("");
      setReduceOnly(false);
      setPostOnly(false);
      setEnableSL(false);
      setEnableTP(false);
    }
  }, [open]);

  /* Close on Escape */
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  /* Get fee rate */
  const feeRate = useMemo(() => {
    if (!data) return 0.001;
    const schedule = feeSchedules.find(
      (f) => f.user_type === "USER" && f.order_type === data.orderType
    );
    if (schedule) {
      return data.orderType === "MARKET" || data.orderType === "TAKE_PROFIT"
        ? schedule.taker_fee
        : schedule.maker_fee || schedule.taker_fee;
    }
    return data.orderType === "MARKET" || data.orderType === "TAKE_PROFIT"
      ? 0.0025
      : 0.0015;
  }, [data, feeSchedules]);

  /* Calculate order details */
  const details = useMemo(() => {
    if (!data) return null;
    const qty = parseFloat(data.quantity) || 0;
    const price =
      data.orderType === "MARKET"
        ? ticker?.price || 0
        : parseFloat(data.price) || ticker?.price || 0;
    const total = qty * price;
    const fee = total * feeRate;
    const finalTotal =
      data.side === "BUY" ? total + fee : total - fee;

    /* SL/TP risk-reward calculation */
    const sl = enableSL ? parseFloat(stopLoss) : 0;
    const tp = enableTP ? parseFloat(takeProfit) : 0;

    let risk = 0;
    let reward = 0;
    let rrRatio = 0;

    if (data.side === "BUY") {
      if (sl > 0 && sl < price) risk = (price - sl) * qty;
      if (tp > 0 && tp > price) reward = (tp - price) * qty;
    } else {
      if (sl > 0 && sl > price) risk = (sl - price) * qty;
      if (tp > 0 && tp < price) reward = (price - tp) * qty;
    }

    if (risk > 0 && reward > 0) rrRatio = reward / risk;

    return { qty, price, total, fee, finalTotal, sl, tp, risk, reward, rrRatio };
  }, [data, ticker, feeRate, enableSL, enableTP, stopLoss, takeProfit]);

  if (!open || !data || !details) return null;

  const isBuy = data.side === "BUY";
  const sideColor = isBuy ? "emerald" : "red";
  const sideAccent = isBuy
    ? {
        bg: "bg-emerald-500",
        text: "text-emerald-400",
        bgSoft: "bg-emerald-500/10",
        border: "border-emerald-500/20",
      }
    : {
        bg: "bg-red-500",
        text: "text-red-400",
        bgSoft: "bg-red-500/10",
        border: "border-red-500/20",
      };

  /* SL/TP validation hints */
  const slInvalid =
    enableSL &&
    parseFloat(stopLoss) > 0 &&
    ((isBuy && parseFloat(stopLoss) >= details.price) ||
      (!isBuy && parseFloat(stopLoss) <= details.price));
  const tpInvalid =
    enableTP &&
    parseFloat(takeProfit) > 0 &&
    ((isBuy && parseFloat(takeProfit) <= details.price) ||
      (!isBuy && parseFloat(takeProfit) >= details.price));

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`glass-panel-strong rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto border-2 ${sideAccent.border} shadow-2xl animate-slide-in-up`}
      >
        {/* Header */}
        <div className={`flex items-center justify-between p-3 border-b border-border/30 ${sideAccent.bgSoft}`}>
          <div className="flex items-center gap-2">
            <div className={`h-7 w-7 rounded-lg ${sideAccent.bg} flex items-center justify-center text-white`}>
              {isBuy ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
            </div>
            <div>
              <h3 className={`font-bold text-sm ${sideAccent.text}`}>
                تأكيد {isBuy ? "شراء" : "بيع"} {data.base}
              </h3>
              <p className="text-[10px] text-muted-foreground">
                مراجعة وتأكيد الأمر
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

        {/* Order Summary */}
        <div className="p-3 space-y-3">
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div className="glass-panel rounded-lg p-2">
              <div className="text-[9px] text-muted-foreground">نوع الأمر</div>
              <div className="font-bold mt-0.5">{ORDER_TYPE_LABELS[data.orderType]}</div>
            </div>
            <div className={`glass-panel rounded-lg p-2 ${sideAccent.bgSoft}`}>
              <div className="text-[9px] text-muted-foreground">الجانب</div>
              <div className={`font-bold mt-0.5 ${sideAccent.text}`}>
                {isBuy ? "شراء" : "بيع"}
              </div>
            </div>
            <div className="glass-panel rounded-lg p-2">
              <div className="text-[9px] text-muted-foreground">السعر</div>
              <div className="font-bold mt-0.5 tabular-nums">
                {details.price > 0 ? details.price.toFixed(2) : "سوقي"}
                <span className="text-[9px] text-muted-foreground font-normal"> USDT</span>
              </div>
            </div>
            <div className="glass-panel rounded-lg p-2">
              <div className="text-[9px] text-muted-foreground">الكمية</div>
              <div className="font-bold mt-0.5 tabular-nums">
                {details.qty.toFixed(6)}
                <span className="text-[9px] text-muted-foreground font-normal"> {data.base}</span>
              </div>
            </div>
          </div>

          {/* Cost breakdown */}
          <div className="glass-panel rounded-lg p-2.5 space-y-1.5 text-[10px]">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">القيمة الإجمالية</span>
              <span className="font-medium tabular-nums">{details.total.toFixed(2)} USDT</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground flex items-center gap-1">
                <Calculator className="h-2.5 w-2.5" />
                الرسوم ({(feeRate * 100).toFixed(2)}%)
              </span>
              <span className="font-medium tabular-nums text-muted-foreground">{details.fee.toFixed(4)} USDT</span>
            </div>
            <div className="border-t border-border/20 pt-1.5 flex items-center justify-between">
              <span className="font-medium">{isBuy ? "الإجمالي المطلوب" : "صافي الاستلام"}</span>
              <span className={`font-bold tabular-nums ${sideAccent.text}`}>
                {details.finalTotal.toFixed(2)} USDT
              </span>
            </div>
          </div>

          {/* SL/TP Section */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <Shield className="h-3 w-3" />
              <span className="font-medium">إدارة المخاطر (اختياري)</span>
            </div>

            {/* Stop Loss */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setEnableSL(!enableSL)}
                className={`shrink-0 px-2 py-1.5 rounded-lg text-[10px] font-medium border transition-all ${
                  enableSL
                    ? "bg-red-500/10 text-red-400 border-red-500/30"
                    : "bg-muted/20 text-muted-foreground border-border/30"
                }`}
              >
                <TrendingDown className="h-3 w-3 inline ml-1" />
                وقف الخسارة
              </button>
              <div className="flex-1 relative">
                <input
                  type="number"
                  step="any"
                  disabled={!enableSL}
                  value={stopLoss}
                  onChange={(e) => setStopLoss(e.target.value)}
                  placeholder={enableSL ? "سعر وقف الخسارة" : "غير مفعّل"}
                  className={`input-field text-[11px] py-1.5 pl-12 pr-2 tabular-nums disabled:opacity-40 ${
                    slInvalid ? "border-red-500/60 ring-1 ring-red-500/30" : ""
                  }`}
                />
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[9px] text-muted-foreground">USDT</span>
              </div>
            </div>
            {slInvalid && (
              <div className="text-[9px] text-red-400 flex items-center gap-1 pr-1">
                <AlertTriangle className="h-2.5 w-2.5" />
                {isBuy
                  ? "وقف الخسارة يجب أن يكون أقل من سعر الدخول"
                  : "وقف الخسارة يجب أن يكون أعلى من سعر الدخول"}
              </div>
            )}

            {/* Take Profit */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setEnableTP(!enableTP)}
                className={`shrink-0 px-2 py-1.5 rounded-lg text-[10px] font-medium border transition-all ${
                  enableTP
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                    : "bg-muted/20 text-muted-foreground border-border/30"
                }`}
              >
                <Target className="h-3 w-3 inline ml-1" />
                جني الأرباح
              </button>
              <div className="flex-1 relative">
                <input
                  type="number"
                  step="any"
                  disabled={!enableTP}
                  value={takeProfit}
                  onChange={(e) => setTakeProfit(e.target.value)}
                  placeholder={enableTP ? "سعر جني الأرباح" : "غير مفعّل"}
                  className={`input-field text-[11px] py-1.5 pl-12 pr-2 tabular-nums disabled:opacity-40 ${
                    tpInvalid ? "border-red-500/60 ring-1 ring-red-500/30" : ""
                  }`}
                />
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[9px] text-muted-foreground">USDT</span>
              </div>
            </div>
            {tpInvalid && (
              <div className="text-[9px] text-red-400 flex items-center gap-1 pr-1">
                <AlertTriangle className="h-2.5 w-2.5" />
                {isBuy
                  ? "جني الأرباح يجب أن يكون أعلى من سعر الدخول"
                  : "جني الأرباح يجب أن يكون أقل من سعر الدخول"}
              </div>
            )}

            {/* Risk/Reward Display */}
            {enableSL && enableTP && details.risk > 0 && details.reward > 0 && (
              <div className="glass-panel rounded-lg p-2 space-y-1.5 text-[10px]">
                <div className="flex items-center justify-between">
                  <span className="text-red-400">المخاطرة</span>
                  <span className="font-medium tabular-nums text-red-400">
                    {details.risk.toFixed(2)} USDT
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-emerald-400">العائد المتوقع</span>
                  <span className="font-medium tabular-nums text-emerald-400">
                    {details.reward.toFixed(2)} USDT
                  </span>
                </div>
                <div className="border-t border-border/20 pt-1.5 flex items-center justify-between">
                  <span className="text-muted-foreground">نسبة العائد/المخاطرة</span>
                  <span
                    className={`font-bold tabular-nums px-1.5 py-0.5 rounded ${
                      details.rrRatio >= 2
                        ? "bg-emerald-500/15 text-emerald-400"
                        : details.rrRatio >= 1
                          ? "bg-yellow-500/15 text-yellow-400"
                          : "bg-red-500/15 text-red-400"
                    }`}
                  >
                    1 : {details.rrRatio.toFixed(2)}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Advanced options */}
          <div className="glass-panel rounded-lg p-2 space-y-1.5 text-[10px]">
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-muted-foreground flex items-center gap-1">
                <Shield className="h-2.5 w-2.5" />
                تقليل فقط (Reduce-Only)
              </span>
              <input
                type="checkbox"
                checked={reduceOnly}
                onChange={(e) => setReduceOnly(e.target.checked)}
                className="h-3 w-3 accent-primary"
              />
            </label>
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-muted-foreground flex items-center gap-1">
                <Target className="h-2.5 w-2.5" />
                صانع فقط (Post-Only)
              </span>
              <input
                type="checkbox"
                checked={postOnly}
                onChange={(e) => setPostOnly(e.target.checked)}
                className="h-3 w-3 accent-primary"
              />
            </label>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-3 border-t border-border/30 flex gap-2">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 py-2.5 rounded-lg font-bold text-xs glass-panel hover:bg-muted/30 transition-all disabled:opacity-50"
          >
            إلغاء
          </button>
          <button
            onClick={() =>
              onConfirm({
                stopLoss: enableSL && stopLoss ? stopLoss : undefined,
                takeProfit: enableTP && takeProfit ? takeProfit : undefined,
                reduceOnly,
                postOnly,
              })
            }
            disabled={loading || slInvalid || tpInvalid}
            className={`flex-1 py-2.5 rounded-lg font-bold text-xs text-white transition-all flex items-center justify-center gap-1.5 ${sideAccent.bg} hover:brightness-110 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {loading ? (
              <span className="h-3.5 w-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Check className="h-3.5 w-3.5" />
            )}
            {loading ? "جاري التنفيذ..." : `تأكيد ${isBuy ? "الشراء" : "البيع"}`}
          </button>
        </div>
      </div>
    </div>
  );
}
