"use client";

import { useEffect, useMemo, useState } from "react";
import {
  X,
  ArrowDown,
  RefreshCw,
  Settings,
  Zap,
  Info,
} from "lucide-react";
import {
  PAIRS,
  CURRENCY_NAMES,
  CURRENCY_ICONS,
  formatPrice,
} from "./constants";
import type { TickerData, Wallet as WalletType } from "./types";

interface ConvertModalProps {
  open: boolean;
  onClose: () => void;
  prices: Record<string, TickerData>;
  wallets: WalletType[];
  defaultFrom?: string;
  defaultTo?: string;
  onConfirm: (params: {
    from: string;
    to: string;
    amount: string;
    expectedReceive: string;
    rate: number;
  }) => void;
}

/**
 * Convert (Instant Swap) modal — Binance-style.
 *
 * Allows user to instantly swap one asset for another at current market price,
 * without going through the order book.
 *
 * Features:
 * - From/To currency selectors with balance display
 * - Live conversion rate (1 FROM = X TO)
 * - Slippage tolerance setting (0.1% / 0.5% / 1%)
 * - Min received calculation
 * - Quick percentage buttons (25/50/75/100%)
 * - Rate refresh indicator
 */
export default function ConvertModal({
  open,
  onClose,
  prices,
  wallets,
  defaultFrom = "USDT",
  defaultTo = "BTC",
  onConfirm,
}: ConvertModalProps) {
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [amount, setAmount] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [slippage, setSlippage] = useState(0.5);
  const [customSlippage, setCustomSlippage] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  /* Reset when opened */
  useEffect(() => {
    if (open) {
      setFrom(defaultFrom);
      setTo(defaultTo);
      setAmount("");
      setShowSettings(false);
    }
  }, [open, defaultFrom, defaultTo]);

  /* Close on Escape */
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  /* Get all tradable currencies (USDT + base currencies) */
  const currencies = useMemo(() => {
    const set = new Set<string>(["USDT"]);
    for (const p of PAIRS) set.add(p.replace("USDT", ""));
    return Array.from(set);
  }, []);

  /* Conversion rate: 1 FROM = ? TO */
  const rate = useMemo(() => {
    if (from === to) return 1;
    /* Get price of FROM in USDT and TO in USDT */
    const fromUsd =
      from === "USDT" ? 1 : prices[`${from}USDT`]?.price || 0;
    const toUsd = to === "USDT" ? 1 : prices[`${to}USDT`]?.price || 0;
    if (fromUsd <= 0 || toUsd <= 0) return 0;
    return fromUsd / toUsd;
  }, [from, to, prices]);

  /* Get wallet balances */
  const fromWallet = wallets.find((w) => w.currency === from);
  const toWallet = wallets.find((w) => w.currency === to);
  const fromBalance = fromWallet?.balance ? parseFloat(fromWallet.balance) : 0;
  const toBalance = toWallet?.balance ? parseFloat(toWallet.balance) : 0;

  /* Calculation */
  const amountNum = parseFloat(amount) || 0;
  const activeSlippage = customSlippage ? parseFloat(customSlippage) || 0 : slippage;
  const expectedReceive = rate > 0 ? amountNum * rate : 0;
  const minReceived = expectedReceive * (1 - activeSlippage / 100);

  /* Apply percentage */
  const applyPercent = (pct: number) => {
    if (fromBalance <= 0) return;
    setAmount((fromBalance * (pct / 100)).toFixed(8));
  };

  /* Swap from/to */
  const swap = () => {
    setFrom(to);
    setTo(from);
    setAmount("");
  };

  /* Trigger refresh animation (visual only - prices update via WebSocket) */
  const refresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 500);
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="glass-panel-strong rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto border-2 border-primary/20 shadow-2xl animate-slide-in-up"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-border/30 bg-primary/5">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-primary flex items-center justify-center text-white">
              <Zap className="h-4 w-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-primary">تحويل فوري</h3>
              <p className="text-[10px] text-muted-foreground">
                مبادلة بين الأصول بسعر السوق
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className={`p-1.5 rounded-lg transition-all ${
                showSettings
                  ? "bg-primary/20 text-primary"
                  : "hover:bg-muted/30 text-muted-foreground hover:text-foreground"
              }`}
              title="الإعدادات"
            >
              <Settings className="h-4 w-4" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-muted/30 text-muted-foreground hover:text-foreground transition-all"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Settings panel (collapsible) */}
        {showSettings && (
          <div className="p-3 border-b border-border/20 bg-muted/5 space-y-2 animate-slide-in-down">
            <div className="text-[10px] text-muted-foreground font-medium">
              السماحية (Slippage Tolerance)
            </div>
            <div className="grid grid-cols-4 gap-1">
              {[0.1, 0.5, 1, 3].map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    setSlippage(s);
                    setCustomSlippage("");
                  }}
                  className={`py-1.5 rounded-md text-[10px] font-medium transition-all border ${
                    !customSlippage && slippage === s
                      ? "bg-primary/20 text-primary border-primary/30"
                      : "bg-muted/20 text-muted-foreground border-border/30 hover:bg-muted/30"
                  }`}
                >
                  {s}%
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="0.1"
                value={customSlippage}
                onChange={(e) => setCustomSlippage(e.target.value)}
                placeholder="مخصص"
                className="input-field text-[10px] py-1.5 px-2 flex-1"
              />
              <span className="text-[10px] text-muted-foreground">%</span>
            </div>
          </div>
        )}

        {/* Body */}
        <div className="p-3 space-y-2">
          {/* From */}
          <div className="glass-panel rounded-xl p-2.5 space-y-1.5">
            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
              <span>من</span>
              <span>
                الرصيد:{" "}
                <span className="font-medium tabular-nums text-foreground">
                  {fromBalance.toFixed(8)} {from}
                </span>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="bg-muted/30 border border-border/30 rounded-lg text-xs font-bold py-2 px-2 focus:outline-none focus:ring-1 focus:ring-primary/30 cursor-pointer min-w-[90px]"
              >
                {currencies.map((c) => (
                  <option key={c} value={c}>
                    {CURRENCY_ICONS[c] || "●"} {c}
                  </option>
                ))}
              </select>
              <input
                type="number"
                step="any"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="flex-1 bg-transparent text-lg font-bold tabular-nums focus:outline-none text-right"
              />
            </div>
            <div className="grid grid-cols-4 gap-1">
              {[25, 50, 75, 100].map((pct) => (
                <button
                  key={pct}
                  onClick={() => applyPercent(pct)}
                  className="py-1 rounded text-[10px] font-medium bg-muted/20 hover:bg-primary/10 hover:text-primary transition-all"
                >
                  {pct}%
                </button>
              ))}
            </div>
          </div>

          {/* Swap button */}
          <div className="flex justify-center -my-1">
            <button
              onClick={swap}
              className="h-7 w-7 rounded-full glass-panel-strong border-2 border-primary/30 flex items-center justify-center hover:bg-primary hover:text-white hover:border-primary transition-all hover:rotate-180 duration-500"
              title="عكس العملات"
            >
              <ArrowDown className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* To */}
          <div className="glass-panel rounded-xl p-2.5 space-y-1.5">
            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
              <span>إلى</span>
              <span>
                الرصيد:{" "}
                <span className="font-medium tabular-nums text-foreground">
                  {toBalance.toFixed(8)} {to}
                </span>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="bg-muted/30 border border-border/30 rounded-lg text-xs font-bold py-2 px-2 focus:outline-none focus:ring-1 focus:ring-primary/30 cursor-pointer min-w-[90px]"
              >
                {currencies.map((c) => (
                  <option key={c} value={c}>
                    {CURRENCY_ICONS[c] || "●"} {c}
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={expectedReceive > 0 ? expectedReceive.toFixed(8) : ""}
                placeholder="0.00"
                readOnly
                className="flex-1 bg-transparent text-lg font-bold tabular-nums focus:outline-none text-right text-muted-foreground"
              />
            </div>
          </div>

          {/* Rate info */}
          {rate > 0 && (
            <div className="glass-panel rounded-lg p-2 space-y-1.5 text-[10px]">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground flex items-center gap-1">
                  <button
                    onClick={refresh}
                    className="hover:text-foreground"
                    title="تحديث"
                  >
                    <RefreshCw
                      className={`h-2.5 w-2.5 ${refreshing ? "animate-spin" : ""}`}
                    />
                  </button>
                  السعر
                </span>
                <span className="font-medium tabular-nums">
                  1 {from} = {rate.toFixed(8)} {to}
                </span>
              </div>
              {amountNum > 0 && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">
                      أقل استلام (بعد السماحية)
                    </span>
                    <span className="font-medium tabular-nums text-emerald-400">
                      {minReceived.toFixed(8)} {to}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Info className="h-2.5 w-2.5" />
                      تأثير السماحية
                    </span>
                    <span className="font-medium tabular-nums text-yellow-400">
                      -{(expectedReceive - minReceived).toFixed(8)} {to}
                    </span>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Submit */}
          <button
            onClick={() =>
              onConfirm({
                from,
                to,
                amount,
                expectedReceive: expectedReceive.toFixed(8),
                rate,
              })
            }
            disabled={amountNum <= 0 || amountNum > fromBalance || rate <= 0}
            className="w-full py-3 rounded-xl font-bold text-sm text-white bg-primary hover:brightness-110 transition-all shadow-lg shadow-primary/25 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
          >
            <Zap className="h-4 w-4" />
            {amountNum <= 0
              ? "أدخل المبلغ"
              : amountNum > fromBalance
                ? "رصيد غير كافٍ"
                : `تحويل ${from} إلى ${to}`}
          </button>
        </div>
      </div>
    </div>
  );
}
