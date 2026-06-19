"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Calculator,
  Shield,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  X,
} from "lucide-react";
import { formatPrice } from "./constants";
import type { TickerData, Wallet as WalletType } from "./types";

interface PositionSizeCalculatorProps {
  pair: string;
  base: string;
  ticker?: TickerData;
  currentPrice?: number;
  quoteWallet?: WalletType;
}

/**
 * Risk-based Position Size Calculator.
 *
 * Binance/Bybit pro-trader feature: calculates the optimal position size
 * based on:
 * - Account size (or use available USDT balance)
 * - Risk per trade (% of account willing to lose)
 * - Entry price
 * - Stop-loss price
 *
 * Outputs:
 * - Position size (in base currency)
 * - Position value (USDT)
 * - Risk amount (USDT)
 * - Risk/reward ratio (if Take-Profit provided)
 *
 * Helps traders maintain consistent risk management.
 */
export default function PositionSizeCalculator({
  pair,
  base,
  ticker,
  currentPrice,
  quoteWallet,
}: PositionSizeCalculatorProps) {
  const [open, setOpen] = useState(false);
  const [accountSize, setAccountSize] = useState("");
  const [useWalletBalance, setUseWalletBalance] = useState(true);
  const [riskPercent, setRiskPercent] = useState("1");
  const [entryPrice, setEntryPrice] = useState("");
  const [stopLoss, setStopLoss] = useState("");
  const [takeProfit, setTakeProfit] = useState("");
  const [side, setSide] = useState<"BUY" | "SELL">("BUY");

  /* Sync entry price with current market price */
  useEffect(() => {
    if (!entryPrice && currentPrice) {
      setEntryPrice(currentPrice.toFixed(8));
    }
  }, [currentPrice, entryPrice]);

  /* Use wallet balance as account size */
  const walletBalance = quoteWallet?.balance ? parseFloat(quoteWallet.balance) : 0;
  const effectiveAccount = useWalletBalance
    ? walletBalance
    : parseFloat(accountSize) || 0;

  /* Calculate position size */
  const calc = useMemo(() => {
    const risk = parseFloat(riskPercent) || 0;
    const entry = parseFloat(entryPrice) || 0;
    const sl = parseFloat(stopLoss) || 0;
    const tp = parseFloat(takeProfit) || 0;

    if (effectiveAccount <= 0 || risk <= 0 || entry <= 0 || sl <= 0) {
      return null;
    }

    /* Validate SL direction */
    if (side === "BUY" && sl >= entry) return { error: "يجب أن يكون وقف الخسارة أقل من سعر الدخول للشراء" };
    if (side === "SELL" && sl <= entry) return { error: "يجب أن يكون وقف الخسارة أعلى من سعر الدخول للبيع" };

    /* Risk amount in USDT */
    const riskAmount = (effectiveAccount * risk) / 100;

    /* Per-unit risk = |entry - stop| */
    const perUnitRisk = Math.abs(entry - sl);
    if (perUnitRisk <= 0) return null;

    /* Position size = riskAmount / perUnitRisk */
    const positionSize = riskAmount / perUnitRisk;
    const positionValue = positionSize * entry;

    /* Risk/Reward if TP provided */
    let reward = 0;
    let rrRatio = 0;
    if (tp > 0) {
      if (side === "BUY" && tp <= entry) return { error: "يجب أن يكون جني الأرباح أعلى من سعر الدخول للشراء" };
      if (side === "SELL" && tp >= entry) return { error: "يجب أن يكون جني الأرباح أقل من سعر الدخول للبيع" };
      reward = Math.abs(tp - entry) * positionSize;
      rrRatio = reward / riskAmount;
    }

    /* % of account used for the position */
    const accountUsage = (positionValue / effectiveAccount) * 100;

    return {
      positionSize,
      positionValue,
      riskAmount,
      reward,
      rrRatio,
      accountUsage,
    };
  }, [effectiveAccount, riskPercent, entryPrice, stopLoss, takeProfit, side]);

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(true)}
        className="glass-panel rounded-lg p-2 text-orange-400 hover:bg-orange-500/10 transition-all"
        title="حاسبة حجم المركز (إدارة المخاطر)"
      >
        <Shield className="h-4 w-4" />
      </button>

      {/* Modal */}
      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in p-4"
          onClick={() => setOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="glass-panel-strong rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto border-2 border-orange-500/20 shadow-2xl animate-slide-in-up"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-3 border-b border-border/30 bg-orange-500/5">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-lg bg-orange-500 flex items-center justify-center text-white">
                  <Shield className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-orange-400">حاسبة حجم المركز</h3>
                  <p className="text-[10px] text-muted-foreground">
                    إدارة المخاطر وحجم التداول الأمثل
                  </p>
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-lg hover:bg-muted/30 text-muted-foreground hover:text-foreground transition-all"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-3 space-y-3">
              {/* Side toggle */}
              <div className="flex p-1 bg-muted/20 rounded-lg gap-1">
                {(["BUY", "SELL"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setSide(s)}
                    className={`flex-1 py-1.5 rounded-md text-[11px] font-bold transition-all ${
                      side === s
                        ? s === "BUY"
                          ? "bg-emerald-500 text-white"
                          : "bg-red-500 text-white"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {s === "BUY" ? "شراء (Long)" : "بيع (Short)"}
                  </button>
                ))}
              </div>

              {/* Account size */}
              <div>
                <label className="text-[10px] text-muted-foreground font-medium mb-1 flex items-center justify-between">
                  <span>حجم الحساب (USDT)</span>
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={useWalletBalance}
                      onChange={(e) => setUseWalletBalance(e.target.checked)}
                      className="h-3 w-3 accent-orange-500"
                    />
                    <span className="text-[9px]">استخدام رصيد USDT</span>
                  </label>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="any"
                    value={useWalletBalance ? walletBalance.toFixed(2) : accountSize}
                    onChange={(e) => {
                      setUseWalletBalance(false);
                      setAccountSize(e.target.value);
                    }}
                    disabled={useWalletBalance}
                    placeholder="0.00"
                    className="input-field text-xs py-2 pl-12 pr-3 tabular-nums disabled:opacity-60"
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground font-medium">
                    USDT
                  </span>
                </div>
              </div>

              {/* Risk % */}
              <div>
                <label className="text-[10px] text-muted-foreground font-medium mb-1 block">
                  المخاطرة لكل صفقة (%)
                </label>
                <div className="grid grid-cols-5 gap-1 mb-1.5">
                  {["0.5", "1", "2", "3", "5"].map((r) => (
                    <button
                      key={r}
                      onClick={() => setRiskPercent(r)}
                      className={`py-1 rounded text-[10px] font-medium border transition-all ${
                        riskPercent === r
                          ? "bg-orange-500/15 text-orange-400 border-orange-500/30"
                          : "bg-muted/20 text-muted-foreground border-border/30 hover:bg-muted/30"
                      }`}
                    >
                      {r}%
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  step="0.1"
                  value={riskPercent}
                  onChange={(e) => setRiskPercent(e.target.value)}
                  className="input-field text-xs py-1.5 px-2 tabular-nums"
                />
              </div>

              {/* Entry & SL */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-muted-foreground font-medium mb-1 block">
                    سعر الدخول
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="any"
                      value={entryPrice}
                      onChange={(e) => setEntryPrice(e.target.value)}
                      placeholder="0.00"
                      className="input-field text-xs py-2 pl-12 pr-3 tabular-nums"
                    />
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[9px] text-muted-foreground">
                      USDT
                    </span>
                  </div>
                </div>
                <div>
                  <label className="text-[10px] text-red-400 font-medium mb-1 block">
                    وقف الخسارة
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="any"
                      value={stopLoss}
                      onChange={(e) => setStopLoss(e.target.value)}
                      placeholder="0.00"
                      className="input-field text-xs py-2 pl-12 pr-3 tabular-nums"
                    />
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[9px] text-muted-foreground">
                      USDT
                    </span>
                  </div>
                </div>
              </div>

              {/* Take Profit (optional) */}
              <div>
                <label className="text-[10px] text-emerald-400 font-medium mb-1 block">
                  جني الأرباح (اختياري)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="any"
                    value={takeProfit}
                    onChange={(e) => setTakeProfit(e.target.value)}
                    placeholder="0.00"
                    className="input-field text-xs py-2 pl-12 pr-3 tabular-nums"
                  />
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[9px] text-muted-foreground">
                    USDT
                  </span>
                </div>
              </div>

              {/* Results */}
              {calc && "error" in calc && calc.error && (
                <div className="glass-panel rounded-lg p-2 flex items-center gap-1.5 text-[10px] text-red-400 bg-red-500/5 border border-red-500/15">
                  <AlertTriangle className="h-3 w-3 shrink-0" />
                  {calc.error}
                </div>
              )}

              {calc && !("error" in calc) && calc !== null && (
                <div className="glass-panel rounded-xl p-2.5 space-y-2 text-[11px] bg-orange-500/5 border border-orange-500/15">
                  {/* Position size - main result */}
                  <div className="flex items-center justify-between border-b border-border/20 pb-2">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Calculator className="h-3 w-3" />
                      حجم المركز الموصى به
                    </span>
                    <span className="font-bold text-orange-400 tabular-nums">
                      {calc.positionSize.toFixed(6)} {base}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <div className="text-[9px] text-muted-foreground">قيمة المركز</div>
                      <div className="font-medium tabular-nums">
                        {calc.positionValue.toFixed(2)} USDT
                      </div>
                    </div>
                    <div>
                      <div className="text-[9px] text-muted-foreground">نسبة الحساب</div>
                      <div
                        className={`font-medium tabular-nums ${
                          calc.accountUsage > 50
                            ? "text-red-400"
                            : calc.accountUsage > 20
                              ? "text-yellow-400"
                              : "text-emerald-400"
                        }`}
                      >
                        {calc.accountUsage.toFixed(2)}%
                      </div>
                    </div>
                    <div>
                      <div className="text-[9px] text-red-400">المخاطرة</div>
                      <div className="font-medium tabular-nums text-red-400">
                        -{calc.riskAmount.toFixed(2)} USDT
                      </div>
                    </div>
                    {calc.reward > 0 && (
                      <div>
                        <div className="text-[9px] text-emerald-400">العائد المتوقع</div>
                        <div className="font-medium tabular-nums text-emerald-400">
                          +{calc.reward.toFixed(2)} USDT
                        </div>
                      </div>
                    )}
                  </div>

                  {calc.rrRatio > 0 && (
                    <div className="border-t border-border/20 pt-2 flex items-center justify-between">
                      <span className="text-muted-foreground">نسبة العائد/المخاطرة</span>
                      <span
                        className={`font-bold tabular-nums px-2 py-0.5 rounded ${
                          calc.rrRatio >= 2
                            ? "bg-emerald-500/15 text-emerald-400"
                            : calc.rrRatio >= 1
                              ? "bg-yellow-500/15 text-yellow-400"
                              : "bg-red-500/15 text-red-400"
                        }`}
                      >
                        1 : {calc.rrRatio.toFixed(2)}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Info note */}
              <div className="flex items-start gap-1.5 text-[9px] text-muted-foreground bg-muted/10 rounded p-2 border border-border/10">
                <Shield className="h-3 w-3 shrink-0 mt-0.5 text-orange-400" />
                <span>
                  هذه الحاسبة تساعدك على تحديد حجم المركز الأمثل بحيث لا تخسر أكثر
                  من النسبة المحددة من حسابك في حال ضرب وقف الخسارة. القاعدة الذهبية:
                  لا تخاطر بأكثر من 1-2% من حسابك في كل صفقة.
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
