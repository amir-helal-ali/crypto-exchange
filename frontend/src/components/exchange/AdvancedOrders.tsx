"use client";

import { useState, useEffect, useMemo } from "react";
import { Layers, X, Info, TrendingUp, TrendingDown } from "lucide-react";
import { formatPrice, pricePrecision } from "./constants";
import type { TickerData, OrderSide } from "./types";

/* ═══════════════════════════════════════════
   Types
   ═══════════════════════════════════════════ */

type AdvancedOrderKind = "OCO" | "TRAILING_STOP";

interface AdvancedOrdersProps {
  pair: string;
  base: string;
  ticker?: TickerData;
  currentPrice?: number;
  side: OrderSide;
  onPlaceOCO?: (params: {
    side: OrderSide;
    quantity: string;
    stopPrice: string;
    limitPrice: string;
    takeProfitPrice: string;
  }) => void;
  onPlaceTrailingStop?: (params: {
    side: OrderSide;
    quantity: string;
    trailPercent: string;
    activationPrice?: string;
  }) => void;
}

/* ═══════════════════════════════════════════
   Component
   ═══════════════════════════════════════════ */

export default function AdvancedOrders({
  pair,
  base,
  ticker,
  currentPrice,
  side,
  onPlaceOCO,
  onPlaceTrailingStop,
}: AdvancedOrdersProps) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<AdvancedOrderKind>("OCO");

  // OCO state
  const [ocoQuantity, setOcoQuantity] = useState("");
  const [ocoStopPrice, setOcoStopPrice] = useState("");
  const [ocoLimitPrice, setOcoLimitPrice] = useState("");
  const [ocoTakeProfit, setOcoTakeProfit] = useState("");

  // Trailing Stop state
  const [trailQuantity, setTrailQuantity] = useState("");
  const [trailPercent, setTrailPercent] = useState("5");
  const [trailActivation, setTrailActivation] = useState("");

  // Pre-fill prices on open
  useEffect(() => {
    if (open && currentPrice) {
      if (!ocoStopPrice) setOcoStopPrice((currentPrice * 0.95).toFixed(2));
      if (!ocoTakeProfit) setOcoTakeProfit((currentPrice * 1.05).toFixed(2));
      if (!trailActivation) setTrailActivation(currentPrice.toFixed(2));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, currentPrice]);

  /* Helper: precision */
  const precision = currentPrice ? pricePrecision(currentPrice) : 2;

  /* OCO calculations */
  const ocoCalc = useMemo(() => {
    const qty = parseFloat(ocoQuantity);
    const stop = parseFloat(ocoStopPrice);
    const limit = parseFloat(ocoLimitPrice);
    const tp = parseFloat(ocoTakeProfit);
    if (!qty || qty <= 0 || !stop || !tp) return null;

    // Stop-loss side: market sell at stop price
    const stopValue = stop * qty;
    // Take-profit side: limit sell at tp price
    const tpValue = tp * qty;

    // Risk/Reward ratio = (TP - entry) / (entry - stop)
    // For buy: if entry = currentPrice, tp above, stop below
    // We'll use currentPrice as the implied entry
    const entry = currentPrice || 0;
    if (entry <= 0) return null;

    const reward = tp - entry;
    const risk = entry - stop;
    const rrRatio = risk > 0 ? reward / risk : null;

    return {
      stopValue,
      tpValue,
      rrRatio,
      valid:
        side === "BUY"
          ? stop < entry && tp > entry
          : stop > entry && tp < entry,
    };
  }, [ocoQuantity, ocoStopPrice, ocoTakeProfit, currentPrice, side]);

  /* Trailing Stop calculations */
  const trailCalc = useMemo(() => {
    const qty = parseFloat(trailQuantity);
    const pct = parseFloat(trailPercent);
    const act = parseFloat(trailActivation);
    if (!qty || qty <= 0 || !pct || pct <= 0 || !act) return null;

    // Initial stop price based on direction
    // For BUY: stop = act * (1 - pct/100)
    // For SELL: stop = act * (1 + pct/100)
    const initialStop =
      side === "BUY" ? act * (1 - pct / 100) : act * (1 + pct / 100);

    return {
      initialStop,
      positionValue: act * qty,
      stopValue: initialStop * qty,
      maxLossPerUnit: Math.abs(act - initialStop),
    };
  }, [trailQuantity, trailPercent, trailActivation, side]);

  /* Submit handlers */
  const handleSubmitOCO = () => {
    if (!ocoCalc?.valid) return;
    onPlaceOCO?.({
      side,
      quantity: ocoQuantity,
      stopPrice: ocoStopPrice,
      limitPrice: ocoLimitPrice || ocoStopPrice,
      takeProfitPrice: ocoTakeProfit,
    });
    setOpen(false);
  };

  const handleSubmitTrailing = () => {
    if (!trailCalc) return;
    onPlaceTrailingStop?.({
      side,
      quantity: trailQuantity,
      trailPercent,
      activationPrice: trailActivation,
    });
    setOpen(false);
  };

  return (
    <>
      {/* Trigger */}
      <button
        onClick={() => setOpen(true)}
        className="glass-panel rounded-lg p-2 text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-all"
        title="أوامر متقدمة (OCO / Trailing Stop)"
      >
        <Layers className="h-4 w-4" />
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
                <Layers className="h-4 w-4 text-primary" />
                <h3 className="font-bold text-sm">أوامر متقدمة</h3>
                <span className="text-[10px] text-muted-foreground">
                  {base}/USDT • {side === "BUY" ? "شراء" : "بيع"}
                </span>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Type tabs */}
            <div className="flex items-center gap-1 p-2 border-b border-border/30 bg-muted/10">
              <button
                onClick={() => setKind("OCO")}
                className={`flex-1 py-2 rounded-md text-xs font-bold transition-all ${
                  kind === "OCO"
                    ? "bg-primary/20 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                }`}
              >
                OCO (واحد يلغي الآخر)
              </button>
              <button
                onClick={() => setKind("TRAILING_STOP")}
                className={`flex-1 py-2 rounded-md text-xs font-bold transition-all ${
                  kind === "TRAILING_STOP"
                    ? "bg-primary/20 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                }`}
              >
                إيقاف متتبع
              </button>
            </div>

            <div className="p-4 space-y-4">
              {kind === "OCO" ? (
                <>
                  {/* OCO explanation */}
                  <div className="text-[11px] text-muted-foreground flex items-start gap-1.5 bg-muted/15 border border-border/20 rounded-lg p-2.5">
                    <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    <span>
                      أمر OCO يضع أمرين معاً: حد وقف الخسارة (Stop) وأمر جني
                      الأرباح (Take-Profit). عند تنفيذ أحدهما، يُلغى الآخر تلقائياً.
                    </span>
                  </div>

                  {/* Quantity */}
                  <div>
                    <label className="text-[10px] text-muted-foreground mb-1.5 block">
                      الكمية ({base})
                    </label>
                    <input
                      type="number"
                      value={ocoQuantity}
                      onChange={(e) => setOcoQuantity(e.target.value)}
                      placeholder="0.00"
                      step="any"
                      className="w-full bg-muted/30 border border-border/30 rounded-lg text-xs py-2 px-3 placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/40 font-mono"
                    />
                  </div>

                  {/* Stop-loss + Take-profit */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-red-400 mb-1.5 flex items-center gap-1">
                        <TrendingDown className="h-3 w-3" />
                        وقف الخسارة (Stop)
                      </label>
                      <input
                        type="number"
                        value={ocoStopPrice}
                        onChange={(e) => setOcoStopPrice(e.target.value)}
                        placeholder="0.00"
                        step="any"
                        className="w-full bg-red-500/5 border border-red-500/20 rounded-lg text-xs py-2 px-3 placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-red-500/40 font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-emerald-400 mb-1.5 flex items-center gap-1">
                        <TrendingUp className="h-3 w-3" />
                        جني الأرباح (TP)
                      </label>
                      <input
                        type="number"
                        value={ocoTakeProfit}
                        onChange={(e) => setOcoTakeProfit(e.target.value)}
                        placeholder="0.00"
                        step="any"
                        className="w-full bg-emerald-500/5 border border-emerald-500/20 rounded-lg text-xs py-2 px-3 placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-emerald-500/40 font-mono"
                      />
                    </div>
                  </div>

                  {/* Optional limit price for stop order */}
                  <div>
                    <label className="text-[10px] text-muted-foreground mb-1.5 block">
                      سعر الحد للوقف (اختياري - افتراضي: سعر السوق عند التفعيل)
                    </label>
                    <input
                      type="number"
                      value={ocoLimitPrice}
                      onChange={(e) => setOcoLimitPrice(e.target.value)}
                      placeholder="اتركه فارغاً لتنفيذ سوقي"
                      step="any"
                      className="w-full bg-muted/30 border border-border/30 rounded-lg text-xs py-2 px-3 placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/40 font-mono"
                    />
                  </div>

                  {/* Calculations */}
                  {ocoCalc && (
                    <div className="space-y-1.5 pt-2 border-t border-border/20">
                      <div
                        className={`rounded-lg p-2.5 border ${
                          ocoCalc.valid
                            ? "bg-muted/15 border-border/20"
                            : "bg-red-500/10 border-red-500/30"
                        }`}
                      >
                        {!ocoCalc.valid ? (
                          <span className="text-[11px] text-red-400">
                            ⚠ الأسعار غير صحيحة. لشراء: وقف الخسارة أقل من
                            السعر الحالي، وجني الأرباح أعلى. للبيع: العكس.
                          </span>
                        ) : (
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-muted-foreground">
                              نسبة المخاطرة/العائد
                            </span>
                            <span
                              className={`font-mono font-bold ${
                                ocoCalc.rrRatio != null && ocoCalc.rrRatio >= 1
                                  ? "text-emerald-400"
                                  : "text-yellow-400"
                              }`}
                            >
                              1 : {ocoCalc.rrRatio?.toFixed(2) || "—"}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <button
                    onClick={handleSubmitOCO}
                    disabled={!ocoCalc?.valid}
                    className="w-full py-2.5 rounded-lg font-bold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    وضع أمر OCO
                  </button>
                </>
              ) : (
                <>
                  {/* Trailing Stop explanation */}
                  <div className="text-[11px] text-muted-foreground flex items-start gap-1.5 bg-muted/15 border border-border/20 rounded-lg p-2.5">
                    <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    <span>
                      الإيقاف المتتبع يتحرك مع السعر لصالحك. عند الشراء: يتبع
                      السعر صعوداً بنسبة محددة، وعند الانعكاس بالنسبة نفسها
                      يُفعّل أمر البيع. مثالي لحماية الأرباح.
                    </span>
                  </div>

                  {/* Quantity + Trail Percent */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-muted-foreground mb-1.5 block">
                        الكمية ({base})
                      </label>
                      <input
                        type="number"
                        value={trailQuantity}
                        onChange={(e) => setTrailQuantity(e.target.value)}
                        placeholder="0.00"
                        step="any"
                        className="w-full bg-muted/30 border border-border/30 rounded-lg text-xs py-2 px-3 placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/40 font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground mb-1.5 block">
                        نسبة التتبع (%)
                      </label>
                      <input
                        type="number"
                        value={trailPercent}
                        onChange={(e) => setTrailPercent(e.target.value)}
                        placeholder="5"
                        step="0.1"
                        min="0.1"
                        className="w-full bg-muted/30 border border-border/30 rounded-lg text-xs py-2 px-3 placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/40 font-mono"
                      />
                    </div>
                  </div>

                  {/* Activation price */}
                  <div>
                    <label className="text-[10px] text-muted-foreground mb-1.5 block">
                      سعر التفعيل (السعر الذي يبدأ عنده التتبع)
                    </label>
                    <input
                      type="number"
                      value={trailActivation}
                      onChange={(e) => setTrailActivation(e.target.value)}
                      placeholder="0.00"
                      step="any"
                      className="w-full bg-muted/30 border border-border/30 rounded-lg text-xs py-2 px-3 placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/40 font-mono"
                    />
                  </div>

                  {/* Quick trail percent chips */}
                  <div className="flex items-center gap-1 flex-wrap">
                    <span className="text-[10px] text-muted-foreground">
                      نسب سريعة:
                    </span>
                    {["1", "2", "5", "10", "15"].map((p) => (
                      <button
                        key={p}
                        onClick={() => setTrailPercent(p)}
                        className={`px-2 py-0.5 rounded text-[10px] font-medium transition-all ${
                          trailPercent === p
                            ? "bg-primary/20 text-primary"
                            : "bg-muted/20 text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {p}%
                      </button>
                    ))}
                  </div>

                  {/* Calculations */}
                  {trailCalc && (
                    <div className="space-y-1.5 pt-2 border-t border-border/20">
                      <div className="rounded-lg p-2.5 border border-border/20 bg-muted/15">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-muted-foreground">
                            سعر الإيقاف الابتدائي
                          </span>
                          <span className="font-mono font-bold text-red-400">
                            {trailCalc.initialStop.toFixed(precision)} USDT
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] mt-1.5">
                          <span className="text-muted-foreground">
                            الخسارة لكل {base} (إن تفعّل فوراً)
                          </span>
                          <span className="font-mono text-red-400">
                            {trailCalc.maxLossPerUnit.toFixed(precision)} USDT
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] mt-1.5">
                          <span className="text-muted-foreground">
                            قيمة المركز
                          </span>
                          <span className="font-mono text-foreground">
                            {trailCalc.positionValue.toFixed(2)} USDT
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  <button
                    onClick={handleSubmitTrailing}
                    disabled={!trailCalc}
                    className="w-full py-2.5 rounded-lg font-bold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    وضع إيقاف متتبع
                  </button>
                </>
              )}

              {currentPrice && (
                <div className="text-[10px] text-muted-foreground text-center pt-1 border-t border-border/10">
                  السعر الحالي:{" "}
                  <span className="font-mono text-foreground">
                    {formatPrice(currentPrice)} USDT
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
