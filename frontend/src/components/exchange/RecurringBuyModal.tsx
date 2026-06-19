"use client";

import { useEffect, useMemo, useState } from "react";
import {
  X,
  Calendar,
  Repeat,
  Clock,
  Plus,
  Check,
  TrendingUp,
  Info,
} from "lucide-react";
import {
  PAIRS,
  CURRENCY_NAMES,
  CURRENCY_ICONS,
  formatPrice,
} from "./constants";
import type { TickerData } from "./types";

interface RecurringBuyModalProps {
  open: boolean;
  onClose: () => void;
  defaultPair?: string;
  ticker?: TickerData;
  onConfirm: (plan: RecurringPlan) => void;
}

export type RecurringPlan = {
  pair: string;
  amount: string;
  frequency: "daily" | "weekly" | "biweekly" | "monthly";
  dayOfWeek?: number; // 0-6 for weekly
  dayOfMonth?: number; // 1-28 for monthly
  time: string; // "HH:MM"
  totalCycles: number | "unlimited";
  startDate: string;
};

/**
 * Recurring Buy (DCA - Dollar Cost Averaging) plan modal.
 *
 * Binance/Bybit feature that allows users to set up automated buy plans:
 * - Choose pair and USDT amount per cycle
 * - Choose frequency: daily / weekly / biweekly / monthly
 * - Choose day of week/month and time
 * - Choose total cycles (or unlimited)
 * - Start date
 *
 * Plans persist to localStorage so the user can review them later.
 */
export default function RecurringBuyModal({
  open,
  onClose,
  defaultPair = "BTCUSDT",
  ticker,
  onConfirm,
}: RecurringBuyModalProps) {
  const [pair, setPair] = useState(defaultPair);
  const [amount, setAmount] = useState("");
  const [frequency, setFrequency] =
    useState<RecurringPlan["frequency"]>("weekly");
  const [dayOfWeek, setDayOfWeek] = useState(1); // Monday
  const [dayOfMonth, setDayOfMonth] = useState(1);
  const [time, setTime] = useState("09:00");
  const [totalCycles, setTotalCycles] = useState<number | "unlimited">(10);
  const [customCycles, setCustomCycles] = useState("");
  const [startDate, setStartDate] = useState(
    new Date().toISOString().slice(0, 10)
  );

  /* Reset when opened */
  useEffect(() => {
    if (open) {
      setPair(defaultPair);
      setAmount("");
      setFrequency("weekly");
      setDayOfWeek(1);
      setDayOfMonth(1);
      setTime("09:00");
      setTotalCycles(10);
      setCustomCycles("");
      setStartDate(new Date().toISOString().slice(0, 10));
    }
  }, [open, defaultPair]);

  /* Close on Escape */
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  /* Estimate tokens received per cycle */
  const estimate = useMemo(() => {
    const amt = parseFloat(amount) || 0;
    const price = ticker?.price || 0;
    if (amt <= 0 || price <= 0) return 0;
    return amt / price;
  }, [amount, ticker]);

  /* Total investment over all cycles */
  const cyclesNum =
    totalCycles === "unlimited"
      ? customCycles
        ? parseInt(customCycles) || 0
        : Infinity
      : totalCycles;
  const totalInvestment =
    cyclesNum === Infinity
      ? Infinity
      : (parseFloat(amount) || 0) * cyclesNum;

  /* Frequency options */
  const freqOptions: {
    value: RecurringPlan["frequency"];
    label: string;
    icon: typeof Clock;
  }[] = [
    { value: "daily", label: "يومي", icon: Clock },
    { value: "weekly", label: "أسبوعي", icon: Calendar },
    { value: "biweekly", label: "نصف شهري", icon: Calendar },
    { value: "monthly", label: "شهري", icon: Calendar },
  ];

  /* Day-of-week labels in Arabic */
  const weekdays = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

  /* Submit handler */
  const handleSubmit = () => {
    const plan: RecurringPlan = {
      pair,
      amount,
      frequency,
      time,
      totalCycles,
      startDate,
      dayOfWeek: frequency === "weekly" || frequency === "biweekly" ? dayOfWeek : undefined,
      dayOfMonth: frequency === "monthly" ? dayOfMonth : undefined,
    };
    onConfirm(plan);
  };

  if (!open) return null;

  const base = pair.replace("USDT", "");

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="glass-panel-strong rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto border-2 border-emerald-500/20 shadow-2xl animate-slide-in-up"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-border/30 bg-emerald-500/5">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-emerald-500 flex items-center justify-center text-white">
              <Repeat className="h-4 w-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-emerald-400">شراء متكرر (DCA)</h3>
              <p className="text-[10px] text-muted-foreground">
                استثمار تلقائي دوري
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

        {/* Body */}
        <div className="p-3 space-y-3">
          {/* Pair selector */}
          <div>
            <label className="text-[10px] text-muted-foreground font-medium mb-1 block">
              العملة المستهدفة
            </label>
            <div className="relative">
              <select
                value={pair}
                onChange={(e) => setPair(e.target.value)}
                className="w-full bg-muted/30 border border-border/30 rounded-lg text-xs font-bold py-2 pr-9 pl-3 focus:outline-none focus:ring-1 focus:ring-primary/30 cursor-pointer"
              >
                {PAIRS.map((p) => (
                  <option key={p} value={p}>
                    {CURRENCY_ICONS[p.replace("USDT", "")] || "●"}{" "}
                    {p.replace("USDT", "")} — {CURRENCY_NAMES[p.replace("USDT", "")] || ""}
                  </option>
                ))}
              </select>
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-primary text-sm font-bold">
                {CURRENCY_ICONS[base] || "●"}
              </span>
            </div>
            {ticker && (
              <div className="text-[9px] text-muted-foreground mt-1 tabular-nums">
                السعر الحالي:{" "}
                <span className="font-medium text-foreground">
                  {formatPrice(ticker.price)} USDT
                </span>
              </div>
            )}
          </div>

          {/* Amount per cycle */}
          <div>
            <label className="text-[10px] text-muted-foreground font-medium mb-1 block">
              المبلغ لكل دورة (USDT)
            </label>
            <div className="grid grid-cols-4 gap-1 mb-1.5">
              {[10, 50, 100, 500].map((amt) => (
                <button
                  key={amt}
                  onClick={() => setAmount(amt.toString())}
                  className={`py-1 rounded text-[10px] font-medium border transition-all ${
                    amount === amt.toString()
                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                      : "bg-muted/20 text-muted-foreground border-border/30 hover:bg-muted/30"
                  }`}
                >
                  ${amt}
                </button>
              ))}
            </div>
            <div className="relative">
              <input
                type="number"
                step="any"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="input-field text-sm py-2 pl-12 pr-3 tabular-nums font-bold"
              />
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground font-medium">
                USDT
              </span>
            </div>
            {estimate > 0 && (
              <div className="text-[9px] text-emerald-400 mt-1 tabular-nums flex items-center gap-1">
                <TrendingUp className="h-2.5 w-2.5" />
                ≈ {estimate.toFixed(8)} {base} لكل دورة
              </div>
            )}
          </div>

          {/* Frequency */}
          <div>
            <label className="text-[10px] text-muted-foreground font-medium mb-1 block">
              التكرار
            </label>
            <div className="grid grid-cols-4 gap-1">
              {freqOptions.map((opt) => {
                const Icon = opt.icon;
                const isActive = frequency === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => setFrequency(opt.value)}
                    className={`py-1.5 rounded-lg text-[10px] font-medium border transition-all flex flex-col items-center gap-0.5 ${
                      isActive
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                        : "bg-muted/20 text-muted-foreground border-border/30 hover:bg-muted/30"
                    }`}
                  >
                    <Icon className="h-3 w-3" />
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Day picker (frequency-dependent) */}
          {(frequency === "weekly" || frequency === "biweekly") && (
            <div>
              <label className="text-[10px] text-muted-foreground font-medium mb-1 block">
                يوم الأسبوع
              </label>
              <div className="grid grid-cols-7 gap-1">
                {weekdays.map((day, idx) => (
                  <button
                    key={idx}
                    onClick={() => setDayOfWeek(idx)}
                    className={`py-1.5 rounded-md text-[10px] font-medium border transition-all ${
                      dayOfWeek === idx
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                        : "bg-muted/20 text-muted-foreground border-border/30 hover:bg-muted/30"
                    }`}
                  >
                    {day.slice(0, 3)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {frequency === "monthly" && (
            <div>
              <label className="text-[10px] text-muted-foreground font-medium mb-1 block">
                يوم الشهر
              </label>
              <select
                value={dayOfMonth}
                onChange={(e) => setDayOfMonth(parseInt(e.target.value))}
                className="w-full bg-muted/30 border border-border/30 rounded-lg text-xs py-2 px-3 focus:outline-none focus:ring-1 focus:ring-primary/30 cursor-pointer"
              >
                {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={d}>
                    اليوم {d}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Time */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-muted-foreground font-medium mb-1 block">
                الوقت
              </label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="input-field text-xs py-2 px-3"
              />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground font-medium mb-1 block">
                تاريخ البدء
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="input-field text-xs py-2 px-3"
              />
            </div>
          </div>

          {/* Total cycles */}
          <div>
            <label className="text-[10px] text-muted-foreground font-medium mb-1 block">
              عدد الدورات
            </label>
            <div className="grid grid-cols-4 gap-1 mb-1.5">
              {[
                { label: "10", value: 10 as const },
                { label: "20", value: 20 as const },
                { label: "50", value: 50 as const },
                { label: "∞", value: "unlimited" as const },
              ].map((opt) => (
                <button
                  key={opt.label}
                  onClick={() => {
                    setTotalCycles(opt.value);
                    setCustomCycles("");
                  }}
                  className={`py-1.5 rounded-md text-[10px] font-medium border transition-all ${
                    !customCycles && totalCycles === opt.value
                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                      : "bg-muted/20 text-muted-foreground border-border/30 hover:bg-muted/30"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <input
              type="number"
              value={customCycles}
              onChange={(e) => setCustomCycles(e.target.value)}
              placeholder="عدد مخصص"
              className="input-field text-[10px] py-1.5 px-2"
            />
          </div>

          {/* Summary */}
          {parseFloat(amount) > 0 && (
            <div className="glass-panel rounded-lg p-2.5 space-y-1.5 text-[10px] bg-emerald-500/5 border border-emerald-500/10">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">المبلغ لكل دورة</span>
                <span className="font-medium tabular-nums">
                  {parseFloat(amount).toFixed(2)} USDT
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">إجمالي الاستثمار</span>
                <span className="font-bold tabular-nums text-emerald-400">
                  {totalInvestment === Infinity
                    ? "∞"
                    : `${totalInvestment.toFixed(2)} USDT`}
                </span>
              </div>
              <div className="flex items-center justify-between border-t border-border/20 pt-1.5">
                <span className="text-muted-foreground">العملة</span>
                <span className="font-medium">{base}/USDT</span>
              </div>
            </div>
          )}

          {/* Info note */}
          <div className="flex items-start gap-1.5 text-[9px] text-muted-foreground bg-muted/10 rounded p-2 border border-border/10">
            <Info className="h-3 w-3 shrink-0 mt-0.5" />
            <span>
              سيتم تنفيذ عملية الشراء تلقائياً في الوقت المحدد. تأكد من وجود رصيد
              كافٍ من USDT في محفظتك قبل كل دورة.
            </span>
          </div>

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={!amount || parseFloat(amount) <= 0}
            className="w-full py-3 rounded-xl font-bold text-sm text-white bg-emerald-500 hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-500/25 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
          >
            <Plus className="h-4 w-4" />
            إنشاء خطة الشراء المتكرر
          </button>
        </div>
      </div>
    </div>
  );
}
