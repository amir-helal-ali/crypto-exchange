"use client";

import { useEffect, useState, useMemo } from "react";
import { BarChart3, Activity, TrendingUp, TrendingDown, RefreshCw } from "lucide-react";
import { formatPrice, formatVolume } from "./constants";

interface FundingData {
  symbol: string;
  fundingRate: number;
  nextFundingTime: number;
  markPrice: number;
  indexPrice: number;
  openInterest: number;
  openInterestValue: number;
}

interface OpenInterestProps {
  pair: string;
  base: string;
}

/**
 * Open Interest & Funding Rate widget — Binance Futures data.
 *
 * Shows key futures market metrics for the current pair:
 * - Funding rate (next funding countdown)
 * - Mark price vs index price (premium/discount)
 * - Open interest (number of open contracts)
 * - Open interest value (in USDT)
 *
 * Useful for spot traders too, as it indicates market sentiment and
 * potential volatility from futures liquidations.
 */
export default function OpenInterest({ pair, base }: OpenInterestProps) {
  const [data, setData] = useState<FundingData | null>(null);
  const [history, setHistory] = useState<{ time: number; oi: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  /* Fetch funding rate, mark price, and open interest */
  const fetchData = async () => {
    setRefreshing(true);
    try {
      /* Parallel fetch: funding rate, mark price, open interest */
      const [fundingRes, markRes, oiRes] = await Promise.all([
        fetch(
          `https://fapi.binance.com/fapi/v1/premiumIndex?symbol=${pair}`
        ).catch(() => null),
        fetch(
          `https://fapi.binance.com/fapi/v1/ticker/24hr?symbol=${pair}`
        ).catch(() => null),
        fetch(
          `https://fapi.binance.com/fapi/v1/openInterest?symbol=${pair}`
        ).catch(() => null),
      ]);

      const funding = fundingRes && fundingRes.ok ? await fundingRes.json() : null;
      const mark = markRes && markRes.ok ? await markRes.json() : null;
      const oi = oiRes && oiRes.ok ? await oiRes.json() : null;

      /* Fetch next funding time from fundingInfo */
      let nextFundingTime = 0;
      try {
        const infoRes = await fetch(
          `https://fapi.binance.com/fapi/v1/fundingRate?symbol=${pair}&limit=1`
        );
        if (infoRes.ok) {
          const info = await infoRes.json();
          if (Array.isArray(info) && info[0]?.fundingTime) {
            nextFundingTime = info[0].fundingTime;
          }
        }
      } catch {}

      const fundingRate = funding ? parseFloat(funding.lastFundingRate) : 0;
      const markPrice = funding ? parseFloat(funding.markPrice) : 0;
      const indexPrice = funding ? parseFloat(funding.indexPrice) : 0;
      const openInterest = oi ? parseFloat(oi.openInterest) : 0;
      const openInterestValue = openInterest * markPrice;

      setData({
        symbol: pair,
        fundingRate,
        nextFundingTime,
        markPrice,
        indexPrice,
        openInterest,
        openInterestValue,
      });

      /* Append to history (keep last 20 points) */
      setHistory((prev) => {
        const point = { time: Date.now(), oi: openInterestValue };
        return [...prev, point].slice(-20);
      });
    } catch (e) {
      /* If futures API fails (e.g., pair not on futures), silently fail */
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  /* Initial fetch + periodic refresh (every 15s) */
  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, 15000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pair]);

  /* Countdown to next funding */
  const [countdown, setCountdown] = useState("");
  useEffect(() => {
    if (!data?.nextFundingTime) return;
    const update = () => {
      const ms = data.nextFundingTime - Date.now();
      if (ms <= 0) {
        setCountdown("قريباً");
        return;
      }
      const h = Math.floor(ms / (1000 * 60 * 60));
      const m = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
      setCountdown(`${h}س ${m}د`);
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [data?.nextFundingTime]);

  /* Calculate premium/discount */
  const premium = useMemo(() => {
    if (!data || data.indexPrice <= 0) return 0;
    return ((data.markPrice - data.indexPrice) / data.indexPrice) * 100;
  }, [data]);

  /* Render mini sparkline for OI history */
  const renderSparkline = () => {
    if (history.length < 2) return null;
    const w = 100;
    const h = 24;
    const values = history.map((p) => p.oi);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const stepX = w / (values.length - 1);
    const isUp = values[values.length - 1] >= values[0];

    return (
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-6">
        <path
          d={values
            .map(
              (v, i) =>
                `${i === 0 ? "M" : "L"} ${i * stepX} ${
                  h - ((v - min) / range) * (h - 4) - 2
                }`
            )
            .join(" ")}
          fill="none"
          stroke={isUp ? "#10b981" : "#ef4444"}
          strokeWidth="1"
        />
      </svg>
    );
  };

  return (
    <div className="glass-panel rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-2.5 py-2 border-b border-border/20">
        <div className="flex items-center gap-1.5">
          <BarChart3 className="h-3.5 w-3.5 text-blue-400" />
          <h3 className="font-bold text-[11px]">المركز المفتوح والتمويل</h3>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[9px] text-muted-foreground">{base}/USDT</span>
          <button
            onClick={fetchData}
            className="p-0.5 rounded hover:bg-muted/30 text-muted-foreground hover:text-foreground transition-all"
            title="تحديث"
          >
            <RefreshCw
              className={`h-2.5 w-2.5 ${refreshing ? "animate-spin" : ""}`}
            />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="p-2.5 space-y-2">
        {loading ? (
          <div className="py-3 flex items-center justify-center">
            <RefreshCw className="h-3 w-3 animate-spin text-muted-foreground" />
          </div>
        ) : !data ? (
          <div className="py-3 text-center text-[10px] text-muted-foreground">
            لا توجد بيانات available
          </div>
        ) : (
          <>
            {/* Funding rate */}
            <div className="glass-panel rounded-lg p-2">
              <div className="flex items-center justify-between text-[10px] mb-1">
                <span className="text-muted-foreground flex items-center gap-1">
                  <Activity className="h-2.5 w-2.5" />
                  معدل التمويل
                </span>
                <span
                  className={`font-bold tabular-nums flex items-center gap-0.5 ${
                    data.fundingRate >= 0 ? "text-emerald-400" : "text-red-400"
                  }`}
                >
                  {data.fundingRate >= 0 ? (
                    <TrendingUp className="h-2.5 w-2.5" />
                  ) : (
                    <TrendingDown className="h-2.5 w-2.5" />
                  )}
                  {(data.fundingRate * 100).toFixed(4)}%
                </span>
              </div>
              <div className="flex items-center justify-between text-[9px] text-muted-foreground">
                <span>التمويل القادم</span>
                <span className="tabular-nums">{countdown || "—"}</span>
              </div>
            </div>

            {/* Open Interest */}
            <div className="glass-panel rounded-lg p-2">
              <div className="flex items-center justify-between text-[10px] mb-1">
                <span className="text-muted-foreground">المركز المفتوح (OI)</span>
                <span className="font-bold tabular-nums">
                  ${formatVolume(data.openInterestValue)}
                </span>
              </div>
              <div className="flex items-center justify-between text-[9px] text-muted-foreground mb-1.5">
                <span>عدد العقود</span>
                <span className="tabular-nums">
                  {formatVolume(data.openInterest)} {base}
                </span>
              </div>
              {renderSparkline() && (
                <div className="mt-1">{renderSparkline()}</div>
              )}
            </div>

            {/* Mark vs Index price */}
            <div className="glass-panel rounded-lg p-2 space-y-1 text-[10px]">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">سعر العلامة</span>
                <span className="tabular-nums font-medium">
                  {formatPrice(data.markPrice)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">سعر المؤشر</span>
                <span className="tabular-nums font-medium">
                  {formatPrice(data.indexPrice)}
                </span>
              </div>
              <div className="flex items-center justify-between border-t border-border/20 pt-1">
                <span className="text-muted-foreground">علاوة/خصم</span>
                <span
                  className={`tabular-nums font-bold ${
                    premium >= 0 ? "text-emerald-400" : "text-red-400"
                  }`}
                >
                  {premium >= 0 ? "+" : ""}
                  {premium.toFixed(3)}%
                </span>
              </div>
            </div>

            {/* Funding rate interpretation */}
            <div className="flex items-start gap-1.5 text-[9px] text-muted-foreground bg-muted/10 rounded p-1.5 border border-border/10">
              <Activity className="h-2.5 w-2.5 shrink-0 mt-0.5 text-blue-400" />
              <span>
                {data.fundingRate > 0.0001
                  ? "معدل تمويل موجب: السوق صعودي، يدفع اللونغ للشورت"
                  : data.fundingRate < -0.0001
                    ? "معدل تمويل سلبي: السوق هبوطي، يدفع الشورت للونغ"
                    : "معدل تمويل متعادل: توازن نسبي بين اللونغ والشورت"}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
