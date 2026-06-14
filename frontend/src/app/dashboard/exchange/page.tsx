"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import toast from "react-hot-toast";
import {
  TrendingUp,
  TrendingDown,
  ArrowUpDown,
  X,
  RefreshCw,
  Minus,
  BarChart3,
  BookOpen,
  Wallet,
} from "lucide-react";
import { authGet, authPost } from "@/lib/api";
import {
  createChart,
  ColorType,
  IChartApi,
  ISeriesApi,
  CandlestickData,
  HistogramData,
  Time,
} from "lightweight-charts";

/* ─────────── Constants ─────────── */

const PAIRS = [
  "BTCUSDT",
  "ETHUSDT",
  "BNBUSDT",
  "SOLUSDT",
  "XRPUSDT",
  "ADAUSDT",
  "DOGEUSDT",
  "DOTUSDT",
];

const CURRENCY_NAMES: Record<string, string> = {
  BTC: "بيتكوين",
  ETH: "إيثريوم",
  BNB: "بي إن بي",
  SOL: "سولانا",
  XRP: "إكس آر بي",
  ADA: "كاردانو",
  DOGE: "دوجكوين",
  DOT: "بولكادوت",
};

const CURRENCY_ICONS: Record<string, string> = {
  BTC: "₿",
  ETH: "Ξ",
  BNB: "◆",
  SOL: "◎",
  XRP: "✕",
  ADA: "₳",
  DOGE: "Ð",
  DOT: "●",
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: "معلق",
  FILLED: "منفذ",
  CANCELLED: "ملغي",
  TRIGGERED: "مفعّل",
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  FILLED: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  CANCELLED: "bg-red-500/10 text-red-400 border-red-500/20",
  TRIGGERED: "bg-blue-500/10 text-blue-400 border-blue-500/20",
};

const TIMEFRAMES = [
  { value: "1m", label: "1 د" },
  { value: "5m", label: "5 د" },
  { value: "15m", label: "15 د" },
  { value: "1h", label: "1 س" },
  { value: "4h", label: "4 س" },
  { value: "1d", label: "يومي" },
];

const ORDER_TYPE_LABELS: Record<string, string> = {
  MARKET: "سوقي",
  LIMIT: "محدد",
  STOP_LIMIT: "وقف محدد",
  TAKE_PROFIT: "جني أرباح",
};

/* ─────────── Component ─────────── */

export default function ExchangePage() {
  const [selectedPair, setSelectedPair] = useState("BTCUSDT");
  const [prices, setPrices] = useState<Record<string, any>>({});
  const [orderBook, setOrderBook] = useState<{
    bids: [string, string][];
    asks: [string, string][];
  }>({ bids: [], asks: [] });
  const [side, setSide] = useState<"BUY" | "SELL">("BUY");
  const [orderType, setOrderType] = useState<
    "MARKET" | "LIMIT" | "STOP_LIMIT" | "TAKE_PROFIT"
  >("MARKET");
  const [form, setForm] = useState({ quantity: "", price: "", stopPrice: "" });
  const [orders, setOrders] = useState<any[]>([]);
  const [wallets, setWallets] = useState<any[]>([]);
  const [feeSchedules, setFeeSchedules] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [timeframe, setTimeframe] = useState("1m");
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const prevPrices = useRef<Record<string, number>>({});
  const pairScrollRef = useRef<HTMLDivElement>(null);

  /* ─────── Data Fetching ─────── */

  const fetchOrders = useCallback(async () => {
    try {
      const r = await authGet("/api/v1/exchange/orders");
      const d = await r.json();
      setOrders(Array.isArray(d.data) ? d.data : []);
    } catch {}
  }, []);

  const fetchWallets = useCallback(async () => {
    try {
      const r = await authGet("/api/v1/wallet/balances");
      const d = await r.json();
      setWallets(Array.isArray(d.data) ? d.data : []);
    } catch {}
  }, []);

  const fetchFees = useCallback(async () => {
    try {
      const r = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"}/api/v1/fees`
      );
      if (r.ok) {
        const d = await r.json();
        setFeeSchedules(Array.isArray(d.data) ? d.data : []);
      }
    } catch {}
  }, []);

  useEffect(() => {
    fetchOrders();
    fetchWallets();
    fetchFees();
  }, [fetchOrders, fetchWallets, fetchFees]);

  /* ─────── Binance WebSocket ─────── */

  useEffect(() => {
    const ws = new WebSocket("wss://stream.binance.com:9443/ws");
    const streams = [
      `${selectedPair.toLowerCase()}@ticker`,
      `${selectedPair.toLowerCase()}@depth20@100ms`,
    ];
    ws.onopen = () =>
      ws.send(JSON.stringify({ method: "SUBSCRIBE", params: streams, id: 1 }));
    ws.onmessage = (e) => {
      const d = JSON.parse(e.data);
      if (d.e === "24hrTicker") {
        prevPrices.current[selectedPair] =
          prices[selectedPair]?.price || parseFloat(d.c);
        setPrices((prev: any) => ({
          ...prev,
          [selectedPair]: {
            price: parseFloat(d.c),
            high: parseFloat(d.h),
            low: parseFloat(d.l),
            volume: d.v,
            change: d.P,
          },
        }));
      } else if (d.e === "depthUpdate") {
        if (d.bids)
          setOrderBook({ bids: d.bids.slice(0, 10), asks: d.asks.slice(0, 10) });
      }
    };
    wsRef.current = ws;
    return () => ws.close();
  }, [selectedPair]);

  /* ─────── Chart ─────── */

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#6b7280",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.03)" },
        horzLines: { color: "rgba(255,255,255,0.03)" },
      },
      crosshair: {
        mode: 0,
        vertLine: {
          color: "rgba(16,185,129,0.3)",
          width: 1,
          style: 2,
          labelBackgroundColor: "#10b981",
        },
        horzLine: {
          color: "rgba(16,185,129,0.3)",
          width: 1,
          style: 2,
          labelBackgroundColor: "#10b981",
        },
      },
      rightPriceScale: {
        borderColor: "rgba(255,255,255,0.06)",
        scaleMargins: { top: 0.1, bottom: 0.2 },
      },
      timeScale: {
        borderColor: "rgba(255,255,255,0.06)",
        timeVisible: true,
        secondsVisible: false,
      },
    });

    const candleSeries = chart.addCandlestickSeries({
      upColor: "#10b981",
      downColor: "#ef4444",
      borderUpColor: "#10b981",
      borderDownColor: "#ef4444",
      wickUpColor: "#10b981",
      wickDownColor: "#ef4444",
    });

    const volumeSeries = chart.addHistogramSeries({
      priceFormat: { type: "volume" },
      priceScaleId: "",
    });

    volumeSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;

    const fetchKlines = async () => {
      try {
        const res = await fetch(
          `https://api.binance.com/api/v3/klines?symbol=${selectedPair}&interval=${timeframe}&limit=500`
        );
        if (!res.ok) return;
        const data = await res.json();

        const candleData: CandlestickData[] = data.map((k: any) => ({
          time: Math.floor(k[0] / 1000) as Time,
          open: parseFloat(k[1]),
          high: parseFloat(k[2]),
          low: parseFloat(k[3]),
          close: parseFloat(k[4]),
        }));

        const volumeData: HistogramData[] = data.map((k: any) => ({
          time: Math.floor(k[0] / 1000) as Time,
          value: parseFloat(k[5]),
          color:
            parseFloat(k[4]) >= parseFloat(k[1])
              ? "rgba(16,185,129,0.15)"
              : "rgba(239,68,68,0.15)",
        }));

        candleSeries.setData(candleData);
        volumeSeries.setData(volumeData);
        chart.timeScale().fitContent();
      } catch (e) {
        console.error("Failed to fetch klines:", e);
      }
    };

    fetchKlines();

    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };
    window.addEventListener("resize", handleResize);
    handleResize();

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
    };
  }, [selectedPair, timeframe]);

  /* ─────── Real-time Kline WebSocket ─────── */

  useEffect(() => {
    const ws = new WebSocket("wss://stream.binance.com:9443/ws");
    ws.onopen = () =>
      ws.send(
        JSON.stringify({
          method: "SUBSCRIBE",
          params: [`${selectedPair.toLowerCase()}@kline_${timeframe}`],
          id: 1,
        })
      );
    ws.onmessage = (e) => {
      const d = JSON.parse(e.data);
      if (
        d.e === "kline" &&
        candleSeriesRef.current &&
        volumeSeriesRef.current
      ) {
        const k = d.k;
        candleSeriesRef.current.update({
          time: Math.floor(k.t / 1000) as Time,
          open: parseFloat(k.o),
          high: parseFloat(k.h),
          low: parseFloat(k.l),
          close: parseFloat(k.c),
        });
        volumeSeriesRef.current.update({
          time: Math.floor(k.t / 1000) as Time,
          value: parseFloat(k.v),
          color:
            parseFloat(k.c) >= parseFloat(k.o)
              ? "rgba(16,185,129,0.15)"
              : "rgba(239,68,68,0.15)",
        });
      }
    };
    return () => ws.close();
  }, [selectedPair, timeframe]);

  /* ─────── Order Handlers ─────── */

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const body: any = {
        symbol: selectedPair,
        side,
        type: orderType,
        quantity: form.quantity,
      };
      if (orderType === "LIMIT" || orderType === "STOP_LIMIT")
        body.price = form.price;
      if (orderType === "STOP_LIMIT" || orderType === "TAKE_PROFIT")
        body.stop_price = form.stopPrice;
      const res = await authPost("/api/v1/exchange/order", body);
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "فشل تنفيذ الأمر");
        return;
      }
      toast.success(data.message || "تم تنفيذ الأمر بنجاح");
      setForm({ quantity: "", price: "", stopPrice: "" });
      fetchOrders();
      fetchWallets();
    } catch {
      toast.error("حدث خطأ في الاتصال");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async (orderId: number) => {
    try {
      const res = await authPost(`/api/v1/exchange/order/${orderId}/cancel`);
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "فشل إلغاء الأمر");
        return;
      }
      toast.success(data.message || "تم إلغاء الأمر بنجاح");
      fetchOrders();
      fetchWallets();
    } catch {
      toast.error("حدث خطأ في الاتصال");
    }
  };

  /* ─────── Computed Values ─────── */

  const base = selectedPair.replace("USDT", "");
  const p = prices[selectedPair];
  const prevPrice = prevPrices.current[selectedPair];
  const priceColor =
    p && prevPrice
      ? p.price >= prevPrice
        ? "text-emerald-400"
        : "text-red-400"
      : "text-foreground";
  const priceBg =
    p && prevPrice
      ? p.price >= prevPrice
        ? "bg-emerald-500/5"
        : "bg-red-500/5"
      : "";

  const baseWallet = wallets.find((w: any) => w.currency === base);
  const quoteWallet = wallets.find((w: any) => w.currency === "USDT");

  const getFeeRate = () => {
    const userType = "USER";
    const schedule = feeSchedules.find(
      (f: any) => f.user_type === userType && f.order_type === orderType
    );
    if (schedule) {
      return orderType === "MARKET" || orderType === "TAKE_PROFIT"
        ? schedule.taker_fee
        : schedule.maker_fee || schedule.taker_fee;
    }
    return orderType === "MARKET" || orderType === "TAKE_PROFIT"
      ? 0.0025
      : 0.0015;
  };

  const feeRate = getFeeRate();
  const estimatedFee =
    form.quantity && parseFloat(form.quantity) > 0 && p?.price
      ? (orderType === "MARKET"
          ? p.price
          : parseFloat(form.price || "0")) *
        parseFloat(form.quantity) *
        feeRate
      : 0;

  const estimatedTotal =
    form.quantity && parseFloat(form.quantity) > 0
      ? (orderType === "MARKET"
          ? p?.price || 0
          : parseFloat(form.price || "0")) * parseFloat(form.quantity)
      : 0;

  /* Order book depth calculations */
  const maxBidQty = orderBook.bids?.length
    ? Math.max(...orderBook.bids.map((b) => parseFloat(b[1])))
    : 1;
  const maxAskQty = orderBook.asks?.length
    ? Math.max(...orderBook.asks.map((a) => parseFloat(a[1])))
    : 1;

  const spread =
    orderBook.asks?.[0]?.[0] && orderBook.bids?.[0]?.[0]
      ? parseFloat(orderBook.asks[0][0]) - parseFloat(orderBook.bids[0][0])
      : 0;
  const spreadPercent =
    spread && orderBook.bids?.[0]?.[0]
      ? (spread / parseFloat(orderBook.bids[0][0])) * 100
      : 0;

  /* ─────── Render ─────── */

  return (
    <div className="space-y-4 animate-fade-in">
      {/* ═══════ TOP BAR ═══════ */}
      <div className="glass-panel rounded-2xl p-4 animate-slide-in-up">
        {/* Pair Selector Row */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-muted/30">
            <BarChart3 className="h-4 w-4 text-primary" />
            <span className="text-xs font-medium text-muted-foreground">
              أزواج
            </span>
          </div>
          <div
            ref={pairScrollRef}
            className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin flex-1"
            style={{ scrollbarWidth: "thin" }}
          >
            {PAIRS.map((pair) => {
              const pairBase = pair.replace("USDT", "");
              const isActive = selectedPair === pair;
              const pairPrice = prices[pair];
              return (
                <button
                  key={pair}
                  onClick={() => setSelectedPair(pair)}
                  className={`
                    flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all duration-300 whitespace-nowrap
                    ${
                      isActive
                        ? "bg-primary/15 text-primary border border-primary/30 shadow-[0_0_20px_rgba(16,185,129,0.15)]"
                        : "bg-muted/20 text-muted-foreground border border-transparent hover:bg-muted/30 hover:text-foreground"
                    }
                  `}
                >
                  <span
                    className={`text-base leading-none ${isActive ? "text-primary" : "text-muted-foreground/60"}`}
                  >
                    {CURRENCY_ICONS[pairBase] || "●"}
                  </span>
                  <span className="font-bold">{pairBase}</span>
                  {pairPrice && (
                    <span
                      className={`text-[10px] ${parseFloat(pairPrice.change) >= 0 ? "text-emerald-400" : "text-red-400"}`}
                    >
                      {parseFloat(pairPrice.change) >= 0 ? "+" : ""}
                      {parseFloat(pairPrice.change).toFixed(2)}%
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Current Pair Info + Stats */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          {/* Pair Name + Price */}
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary text-lg font-bold">
                {CURRENCY_ICONS[base] || "●"}
              </div>
              <div>
                <h2 className="text-sm font-bold text-foreground">
                  {CURRENCY_NAMES[base] || base}
                </h2>
                <span className="text-[11px] text-muted-foreground">
                  {base}/USDT
                </span>
              </div>
            </div>

            <div className={`transition-colors duration-300 ${priceBg} rounded-xl px-4 py-2`}>
              <p
                className={`text-2xl sm:text-3xl font-bold tabular-nums tracking-tight ${priceColor}`}
              >
                {p?.price?.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 8,
                }) || "—"}
              </p>
            </div>

            {p && (
              <div
                className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold ${
                  parseFloat(p.change) >= 0
                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                    : "bg-red-500/10 text-red-400 border border-red-500/20"
                }`}
              >
                {parseFloat(p.change) >= 0 ? (
                  <TrendingUp className="h-3 w-3" />
                ) : (
                  <TrendingDown className="h-3 w-3" />
                )}
                {parseFloat(p.change) >= 0 ? "+" : ""}
                {parseFloat(p.change).toFixed(2)}%
              </div>
            )}
          </div>

          {/* Quick Stats */}
          {p && (
            <div className="flex items-center gap-4 text-xs">
              <div className="flex flex-col items-start">
                <span className="text-muted-foreground/60">أعلى 24س</span>
                <span className="font-medium text-emerald-400 tabular-nums">
                  {p.high?.toLocaleString()}
                </span>
              </div>
              <div className="w-px h-8 bg-border/30" />
              <div className="flex flex-col items-start">
                <span className="text-muted-foreground/60">أدنى 24س</span>
                <span className="font-medium text-red-400 tabular-nums">
                  {p.low?.toLocaleString()}
                </span>
              </div>
              <div className="w-px h-8 bg-border/30" />
              <div className="flex flex-col items-start">
                <span className="text-muted-foreground/60">الحجم 24س</span>
                <span className="font-medium text-foreground tabular-nums">
                  {p.volume
                    ? parseFloat(p.volume) > 1000000
                      ? (parseFloat(p.volume) / 1000000).toFixed(2) + "M"
                      : parseFloat(p.volume) > 1000
                        ? (parseFloat(p.volume) / 1000).toFixed(1) + "K"
                        : parseFloat(p.volume).toFixed(2)
                    : "—"}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ═══════ MAIN LAYOUT ═══════ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* ──── LEFT: Chart + Order Form ──── */}
        <div className="lg:col-span-8 xl:col-span-9 space-y-4">
          {/* CHART AREA */}
          <div className="glass-panel rounded-2xl overflow-hidden animate-slide-in-up delay-100">
            {/* Timeframe Selector */}
            <div className="flex items-center gap-2 px-4 pt-4 pb-2">
              <div className="flex items-center gap-1 bg-muted/20 rounded-xl p-1">
                {TIMEFRAMES.map((tf) => (
                  <button
                    key={tf.value}
                    onClick={() => setTimeframe(tf.value)}
                    className={`
                      px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all duration-200
                      ${
                        timeframe === tf.value
                          ? "bg-primary/20 text-primary shadow-sm"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                      }
                    `}
                  >
                    {tf.label}
                  </button>
                ))}
              </div>
              <div className="flex-1" />
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <div className="status-dot status-dot-online" />
                <span>مباشر</span>
              </div>
            </div>

            {/* Chart Container */}
            <div className="px-2 pb-2">
              <div
                ref={chartContainerRef}
                className="h-[420px] w-full rounded-xl overflow-hidden border border-border/20"
              />
            </div>
          </div>

          {/* ORDER FORM */}
          <div
            className={`glass-panel rounded-2xl overflow-hidden animate-slide-in-up delay-200 transition-colors duration-500 ${
              side === "BUY"
                ? "ring-1 ring-emerald-500/10"
                : "ring-1 ring-red-500/10"
            }`}
          >
            {/* Buy/Sell Header Toggle */}
            <div className="flex p-1 m-4 mb-0 rounded-xl bg-muted/20">
              {(["BUY", "SELL"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setSide(s)}
                  className={`
                    flex-1 py-3 rounded-lg text-sm font-bold transition-all duration-300
                    ${
                      side === s
                        ? s === "BUY"
                          ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/25"
                          : "bg-red-500 text-white shadow-lg shadow-red-500/25"
                        : "text-muted-foreground hover:text-foreground"
                    }
                  `}
                >
                  {s === "BUY" ? "شراء" : "بيع"} {base}
                </button>
              ))}
            </div>

            <div className="p-4 space-y-4">
              {/* Order Type Tabs */}
              <div className="flex items-center gap-1 bg-muted/15 rounded-xl p-1">
                {(
                  ["MARKET", "LIMIT", "STOP_LIMIT", "TAKE_PROFIT"] as const
                ).map((t) => (
                  <button
                    key={t}
                    onClick={() => setOrderType(t)}
                    className={`
                      flex-1 py-2 px-2 rounded-lg text-[11px] font-medium transition-all duration-200 text-center
                      ${
                        orderType === t
                          ? side === "BUY"
                            ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20"
                            : "bg-red-500/15 text-red-400 border border-red-500/20"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/20 border border-transparent"
                      }
                    `}
                  >
                    {ORDER_TYPE_LABELS[t]}
                  </button>
                ))}
              </div>

              {/* Available Balance */}
              <div
                className={`flex items-center justify-between p-3 rounded-xl border ${
                  side === "BUY"
                    ? "bg-emerald-500/5 border-emerald-500/10"
                    : "bg-red-500/5 border-red-500/10"
                }`}
              >
                <div className="flex items-center gap-2">
                  <Wallet className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-[11px] text-muted-foreground">
                    الرصيد المتاح
                  </span>
                </div>
                <div className="flex items-center gap-3 text-[11px]">
                  <span className="font-medium tabular-nums">
                    {side === "BUY"
                      ? `${quoteWallet?.balance ? parseFloat(quoteWallet.balance).toFixed(2) : "0.00"}`
                      : `${baseWallet?.balance ? parseFloat(baseWallet.balance).toFixed(8) : "0.00000000"}`}{" "}
                    <span className="text-muted-foreground">
                      {side === "BUY" ? "USDT" : base}
                    </span>
                  </span>
                </div>
              </div>

              {/* Form Fields */}
              <form onSubmit={handleSubmit} className="space-y-3">
                {/* Quantity Input */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[11px] text-muted-foreground font-medium">
                      الكمية ({base})
                    </label>
                    {/* Quick percentage buttons */}
                    <div className="flex items-center gap-1">
                      {[25, 50, 75, 100].map((pct) => {
                        const maxQty =
                          side === "BUY"
                            ? quoteWallet?.balance && p?.price
                              ? (parseFloat(quoteWallet.balance) /
                                  (p.price * (1 + feeRate))) *
                                (pct / 100)
                              : 0
                            : baseWallet?.balance
                              ? parseFloat(baseWallet.balance) * (pct / 100)
                              : 0;
                        return (
                          <button
                            key={pct}
                            type="button"
                            onClick={() =>
                              setForm({ ...form, quantity: maxQty.toFixed(8) })
                            }
                            className={`
                              px-2 py-0.5 rounded text-[10px] font-medium transition-all duration-200
                              ${
                                side === "BUY"
                                  ? "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/15"
                                  : "bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/15"
                              }
                            `}
                          >
                            {pct}%
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      step="any"
                      className="input-field pl-4 pr-16"
                      placeholder="0.00"
                      value={form.quantity}
                      onChange={(e) =>
                        setForm({ ...form, quantity: e.target.value })
                      }
                      required
                    />
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground font-medium">
                      {base}
                    </span>
                  </div>
                </div>

                {/* Price Input (LIMIT / STOP_LIMIT) */}
                {(orderType === "LIMIT" || orderType === "STOP_LIMIT") && (
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-[11px] text-muted-foreground font-medium">
                        السعر (USDT)
                      </label>
                      {!form.price && p?.price && (
                        <button
                          type="button"
                          onClick={() =>
                            setForm({ ...form, price: p.price.toFixed(2) })
                          }
                          className="text-[10px] text-primary hover:underline"
                        >
                          السعر الحالي: {p.price.toFixed(2)}
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <input
                        type="number"
                        step="any"
                        className="input-field pl-4 pr-16"
                        placeholder="0.00"
                        value={form.price}
                        onChange={(e) =>
                          setForm({ ...form, price: e.target.value })
                        }
                        required
                      />
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground font-medium">
                        USDT
                      </span>
                    </div>
                  </div>
                )}

                {/* Stop Price (STOP_LIMIT / TAKE_PROFIT) */}
                {(orderType === "STOP_LIMIT" ||
                  orderType === "TAKE_PROFIT") && (
                  <div>
                    <label className="text-[11px] text-muted-foreground font-medium mb-1.5 block">
                      سعر الإيقاف (USDT)
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step="any"
                        className="input-field pl-4 pr-16"
                        placeholder="0.00"
                        value={form.stopPrice}
                        onChange={(e) =>
                          setForm({ ...form, stopPrice: e.target.value })
                        }
                        required
                      />
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground font-medium">
                        USDT
                      </span>
                    </div>
                  </div>
                )}

                {/* Estimated Cost + Fee */}
                {form.quantity && parseFloat(form.quantity) > 0 && (
                  <div className="glass-panel rounded-xl p-3 space-y-2">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-muted-foreground">
                        {side === "BUY"
                          ? "التكلفة التقديرية"
                          : "القيمة التقديرية"}
                      </span>
                      <span className="font-medium tabular-nums">
                        {estimatedTotal.toFixed(2)} USDT
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-muted-foreground">
                        الرسوم (~{(feeRate * 100).toFixed(2)}%)
                      </span>
                      <span className="font-medium tabular-nums text-muted-foreground">
                        {estimatedFee.toFixed(2)} USDT
                      </span>
                    </div>
                    <div className="border-t border-border/30 pt-2 flex items-center justify-between text-[11px]">
                      <span className="text-muted-foreground font-medium">
                        الإجمالي
                      </span>
                      <span
                        className={`font-bold tabular-nums ${side === "BUY" ? "text-emerald-400" : "text-red-400"}`}
                      >
                        {(
                          estimatedTotal +
                          (side === "BUY" ? estimatedFee : -estimatedFee)
                        ).toFixed(2)}{" "}
                        USDT
                      </span>
                    </div>
                  </div>
                )}

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className={`
                    w-full py-3.5 rounded-xl font-bold text-sm transition-all duration-300 flex items-center justify-center gap-2
                    ${
                      side === "BUY"
                        ? "bg-emerald-500 text-white hover:bg-emerald-400 shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30"
                        : "bg-red-500 text-white hover:bg-red-400 shadow-lg shadow-red-500/20 hover:shadow-red-500/30"
                    }
                    disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none
                  `}
                >
                  {loading ? (
                    <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <ArrowUpDown className="h-4 w-4" />
                  )}
                  {loading
                    ? "جاري التنفيذ..."
                    : `${side === "BUY" ? "شراء" : "بيع"} ${base}`}
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* ──── RIGHT: Order Book + My Orders ──── */}
        <div className="lg:col-span-4 xl:col-span-3 space-y-4">
          {/* ORDER BOOK */}
          <div className="glass-panel rounded-2xl overflow-hidden animate-slide-in-up delay-100">
            <div className="flex items-center justify-between px-4 pt-4 pb-2">
              <div className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-primary" />
                <h3 className="font-bold text-sm">دفتر الأوامر</h3>
              </div>
              <span className="text-[10px] text-muted-foreground">
                {base}/USDT
              </span>
            </div>

            {/* Column Headers */}
            <div className="flex items-center justify-between px-4 py-1.5 text-[10px] text-muted-foreground/60 font-medium border-b border-border/20">
              <span>السعر (USDT)</span>
              <span>الكمية ({base})</span>
            </div>

            {/* Asks (sell orders) */}
            <div className="max-h-[200px] overflow-y-auto">
              {orderBook.asks
                ?.slice(0)
                .reverse()
                .map((ask: any, i: number) => {
                  const qty = parseFloat(ask[1]);
                  const depthPercent = (qty / maxAskQty) * 100;
                  return (
                    <div
                      key={`ask-${i}`}
                      className="relative flex items-center justify-between px-4 py-1.5 text-[11px] hover:bg-red-500/5 transition-colors cursor-pointer"
                      onClick={() =>
                        setForm({ ...form, price: parseFloat(ask[0]).toFixed(2) })
                      }
                    >
                      <div
                        className="absolute top-0 left-0 h-full bg-red-500/8 transition-all duration-300"
                        style={{ width: `${depthPercent}%` }}
                      />
                      <span className="relative text-red-400 font-medium tabular-nums">
                        {parseFloat(ask[0]).toFixed(2)}
                      </span>
                      <span className="relative text-muted-foreground tabular-nums">
                        {qty.toFixed(6)}
                      </span>
                    </div>
                  );
                })}
            </div>

            {/* Spread / Current Price */}
            <div className="flex items-center justify-between px-4 py-2.5 border-y border-border/20 bg-muted/10">
              <div className="flex items-center gap-2">
                <span
                  className={`text-base font-bold tabular-nums ${priceColor}`}
                >
                  {p?.price?.toFixed(2) || "—"}
                </span>
                {p && (
                  <span
                    className={`inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      parseFloat(p.change) >= 0
                        ? "bg-emerald-500/10 text-emerald-400"
                        : "bg-red-500/10 text-red-400"
                    }`}
                  >
                    {parseFloat(p.change) >= 0 ? "+" : ""}
                    {parseFloat(p.change).toFixed(2)}%
                  </span>
                )}
              </div>
              {spread > 0 && (
                <span className="text-[10px] text-muted-foreground">
                  فجوة: {spread.toFixed(2)} ({spreadPercent.toFixed(3)}%)
                </span>
              )}
            </div>

            {/* Bids (buy orders) */}
            <div className="max-h-[200px] overflow-y-auto">
              {orderBook.bids?.slice(0, 10).map((bid: any, i: number) => {
                const qty = parseFloat(bid[1]);
                const depthPercent = (qty / maxBidQty) * 100;
                return (
                  <div
                    key={`bid-${i}`}
                    className="relative flex items-center justify-between px-4 py-1.5 text-[11px] hover:bg-emerald-500/5 transition-colors cursor-pointer"
                    onClick={() =>
                      setForm({
                        ...form,
                        price: parseFloat(bid[0]).toFixed(2),
                      })
                    }
                  >
                    <div
                      className="absolute top-0 left-0 h-full bg-emerald-500/8 transition-all duration-300"
                      style={{ width: `${depthPercent}%` }}
                    />
                    <span className="relative text-emerald-400 font-medium tabular-nums">
                      {parseFloat(bid[0]).toFixed(2)}
                    </span>
                    <span className="relative text-muted-foreground tabular-nums">
                      {qty.toFixed(6)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* MY ORDERS */}
          <div className="glass-panel rounded-2xl overflow-hidden animate-slide-in-up delay-200">
            <div className="flex items-center justify-between px-4 pt-4 pb-2">
              <h3 className="font-bold text-sm">طلباتي</h3>
              <button
                onClick={() => fetchOrders()}
                className="p-1.5 rounded-lg hover:bg-muted/30 text-muted-foreground hover:text-foreground transition-all"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="max-h-[320px] overflow-y-auto">
              {orders.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 px-4">
                  <div className="h-12 w-12 rounded-2xl bg-muted/20 flex items-center justify-center mb-3">
                    <Minus className="h-5 w-5 text-muted-foreground/40" />
                  </div>
                  <p className="text-xs text-muted-foreground text-center">
                    لا توجد طلبات حالياً
                  </p>
                  <p className="text-[10px] text-muted-foreground/50 text-center mt-1">
                    ستظهر طلباتك هنا بعد التنفيذ
                  </p>
                </div>
              ) : (
                orders.slice(0, 10).map((order: any, i: number) => (
                  <div
                    key={i}
                    className="flex items-center justify-between px-4 py-3 border-b border-border/10 last:border-0 hover:bg-muted/5 transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {/* Side indicator */}
                      <div
                        className={`h-8 w-8 rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0 ${
                          order.side === "BUY"
                            ? "bg-emerald-500/10 text-emerald-400"
                            : "bg-red-500/10 text-red-400"
                        }`}
                      >
                        {order.side === "BUY" ? "ش" : "ب"}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs font-bold truncate">
                            {order.symbol?.replace("USDT", "")}/USDT
                          </p>
                          <span
                            className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${
                              order.side === "BUY"
                                ? "bg-emerald-500/10 text-emerald-400"
                                : "bg-red-500/10 text-red-400"
                            }`}
                          >
                            {order.side === "BUY" ? "شراء" : "بيع"}
                          </span>
                        </div>
                        <p className="text-[10px] text-muted-foreground">
                          {ORDER_TYPE_LABELS[order.type] || order.type}
                          {" · "}
                          <span className="tabular-nums">
                            {parseFloat(order.quantity || "0").toFixed(6)}
                          </span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-left">
                        <p className="text-[11px] font-medium tabular-nums">
                          {order.avg_fill_price > 0
                            ? parseFloat(order.avg_fill_price).toFixed(2)
                            : order.price
                              ? parseFloat(order.price).toFixed(2)
                              : "سوقي"}
                        </p>
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`text-[9px] px-1.5 py-0.5 rounded border font-medium ${STATUS_COLORS[order.status] || "bg-muted/20 text-muted-foreground border-border/30"}`}
                          >
                            {STATUS_LABELS[order.status] || order.status}
                          </span>
                          {order.fee > 0 && (
                            <span className="text-[9px] text-muted-foreground tabular-nums">
                              رسوم: {parseFloat(order.fee).toFixed(4)}
                            </span>
                          )}
                        </div>
                      </div>

                      {order.status === "PENDING" && (
                        <button
                          onClick={() => handleCancel(order.id)}
                          className="p-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all border border-red-500/15"
                          title="إلغاء الأمر"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
