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
  Activity,
  Clock,
  ChevronDown,
  Settings2,
  Maximize2,
} from "lucide-react";
import { authGet, authPost } from "@/lib/api";
import ProChart, { ProChartHandle, Candle } from "@/components/ProChart";

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
  const [timeframe, setTimeframe] = useState("15m");
  const [candles, setCandles] = useState<Candle[]>([]);
  const [marketTrades, setMarketTrades] = useState<any[]>([]);
  const [showPairDropdown, setShowPairDropdown] = useState(false);
  const [crosshairData, setCrosshairData] = useState<Candle | null>(null);
  const [bottomTab, setBottomTab] = useState<"orders" | "trades">("orders");

  const chartRef = useRef<ProChartHandle>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const prevPrices = useRef<Record<string, number>>({});
  const pairDropdownRef = useRef<HTMLDivElement>(null);

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

  const fetchKlines = useCallback(async () => {
    try {
      const res = await fetch(
        `https://api.binance.com/api/v3/klines?symbol=${selectedPair}&interval=${timeframe}&limit=500`
      );
      if (!res.ok) return;
      const data = await res.json();
      const candleData: Candle[] = data.map((k: any) => ({
        time: Math.floor(k[0] / 1000),
        open: parseFloat(k[1]),
        high: parseFloat(k[2]),
        low: parseFloat(k[3]),
        close: parseFloat(k[4]),
        volume: parseFloat(k[5]),
      }));
      setCandles(candleData);
    } catch (e) {
      console.error("Failed to fetch klines:", e);
    }
  }, [selectedPair, timeframe]);

  const fetchMarketTrades = useCallback(async () => {
    try {
      const res = await fetch(
        `https://api.binance.com/api/v3/trades?symbol=${selectedPair}&limit=20`
      );
      if (!res.ok) return;
      const data = await res.json();
      setMarketTrades(
        data.map((t: any) => ({
          id: t.id,
          price: parseFloat(t.price),
          qty: parseFloat(t.qty),
          time: t.time,
          isBuyerMaker: t.isBuyerMaker,
        }))
      );
    } catch {}
  }, [selectedPair]);

  useEffect(() => {
    fetchOrders();
    fetchWallets();
    fetchFees();
    fetchKlines();
    fetchMarketTrades();
  }, [fetchOrders, fetchWallets, fetchFees, fetchKlines, fetchMarketTrades]);

  /* ─────── Binance WebSocket (Ticker + Depth) ─────── */

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
            quoteVolume: d.q,
            openPrice: d.o,
          },
        }));
      } else if (d.e === "depthUpdate") {
        if (d.bids)
          setOrderBook({ bids: d.bids.slice(0, 15), asks: d.asks.slice(0, 15) });
      }
    };
    wsRef.current = ws;
    return () => ws.close();
  }, [selectedPair]);

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
      if (d.e === "kline" && chartRef.current) {
        const k = d.k;
        chartRef.current.updateLastCandle({
          time: Math.floor(k.t / 1000),
          open: parseFloat(k.o),
          high: parseFloat(k.h),
          low: parseFloat(k.l),
          close: parseFloat(k.c),
          volume: parseFloat(k.v),
        });
      }
    };
    return () => ws.close();
  }, [selectedPair, timeframe]);

  /* ─────── Real-time Trade WebSocket ─────── */

  useEffect(() => {
    const ws = new WebSocket("wss://stream.binance.com:9443/ws");
    ws.onopen = () =>
      ws.send(
        JSON.stringify({
          method: "SUBSCRIBE",
          params: [`${selectedPair.toLowerCase()}@trade`],
          id: 1,
        })
      );
    ws.onmessage = (e) => {
      const d = JSON.parse(e.data);
      if (d.e === "trade") {
        setMarketTrades((prev) => {
          const newTrade = {
            id: d.t,
            price: parseFloat(d.p),
            qty: parseFloat(d.q),
            time: d.T,
            isBuyerMaker: d.m,
          };
          const updated = [newTrade, ...prev].slice(0, 30);
          return updated;
        });
      }
    };
    return () => ws.close();
  }, [selectedPair]);

  /* ─────── Close pair dropdown on outside click ─────── */

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        pairDropdownRef.current &&
        !pairDropdownRef.current.contains(e.target as Node)
      ) {
        setShowPairDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

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

  /* Total bid/ask volume */
  const totalBidVol = orderBook.bids?.reduce(
    (s, b) => s + parseFloat(b[1]),
    0
  );
  const totalAskVol = orderBook.asks?.reduce(
    (s, a) => s + parseFloat(a[1]),
    0
  );

  /* ─────── Crosshair handler ─────── */
  const handleCrosshairMove = useCallback(
    (data: { candle: Candle | null; x: number; y: number } | null) => {
      setCrosshairData(data?.candle || null);
    },
    []
  );

  /* ─────── Render ─────── */

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] gap-2 animate-fade-in overflow-hidden">
      {/* ═══════ TOP BAR ═══════ */}
      <div className="glass-panel rounded-xl px-3 py-2 flex items-center gap-3 shrink-0">
        {/* Pair Selector */}
        <div className="relative" ref={pairDropdownRef}>
          <button
            onClick={() => setShowPairDropdown(!showPairDropdown)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/30 hover:bg-muted/40 transition-all border border-border/30"
          >
            <span className="text-primary text-base">{CURRENCY_ICONS[base]}</span>
            <span className="text-sm font-bold">{base}/USDT</span>
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          </button>

          {showPairDropdown && (
            <div className="absolute top-full mt-1 right-0 w-56 glass-panel-strong rounded-xl border border-border/50 overflow-hidden z-50 shadow-2xl">
              {PAIRS.map((pair) => {
                const pairBase = pair.replace("USDT", "");
                const isActive = selectedPair === pair;
                const pairPrice = prices[pair];
                return (
                  <button
                    key={pair}
                    onClick={() => {
                      setSelectedPair(pair);
                      setShowPairDropdown(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 text-xs transition-all hover:bg-muted/30 ${
                      isActive ? "bg-primary/10 text-primary" : ""
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{CURRENCY_ICONS[pairBase]}</span>
                      <span className="font-bold">{pairBase}/USDT</span>
                    </div>
                    {pairPrice && (
                      <span
                        className={`font-medium tabular-nums ${
                          parseFloat(pairPrice.change) >= 0
                            ? "text-emerald-400"
                            : "text-red-400"
                        }`}
                      >
                        {parseFloat(pairPrice.change) >= 0 ? "+" : ""}
                        {parseFloat(pairPrice.change).toFixed(2)}%
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Current Price */}
        <div className="flex items-center gap-2">
          <span className={`text-xl font-bold tabular-nums ${priceColor}`}>
            {p?.price?.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 8,
            }) || "—"}
          </span>
          {p && (
            <span
              className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold ${
                parseFloat(p.change) >= 0
                  ? "bg-emerald-500/10 text-emerald-400"
                  : "bg-red-500/10 text-red-400"
              }`}
            >
              {parseFloat(p.change) >= 0 ? (
                <TrendingUp className="h-2.5 w-2.5" />
              ) : (
                <TrendingDown className="h-2.5 w-2.5" />
              )}
              {parseFloat(p.change) >= 0 ? "+" : ""}
              {parseFloat(p.change).toFixed(2)}%
            </span>
          )}
        </div>

        {/* Quick Stats */}
        {p && (
          <div className="flex items-center gap-4 text-[11px] mr-auto">
            <div className="flex flex-col">
              <span className="text-muted-foreground/50 text-[9px]">24h أعلى</span>
              <span className="font-medium text-emerald-400 tabular-nums">
                {p.high?.toLocaleString()}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-muted-foreground/50 text-[9px]">24h أدنى</span>
              <span className="font-medium text-red-400 tabular-nums">
                {p.low?.toLocaleString()}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-muted-foreground/50 text-[9px]">حجم 24h</span>
              <span className="font-medium tabular-nums">
                {p.quoteVolume
                  ? parseFloat(p.quoteVolume) > 1e9
                    ? (parseFloat(p.quoteVolume) / 1e9).toFixed(2) + "B"
                    : parseFloat(p.quoteVolume) > 1e6
                      ? (parseFloat(p.quoteVolume) / 1e6).toFixed(2) + "M"
                      : parseFloat(p.quoteVolume).toFixed(0) + "K"
                  : "—"}{" "}
                USDT
              </span>
            </div>
          </div>
        )}

        {/* Crosshair OHLCV */}
        {crosshairData && (
          <div className="flex items-center gap-3 text-[10px] font-mono">
            <span className="text-muted-foreground">
              O <span className="text-foreground">{crosshairData.open.toFixed(2)}</span>
            </span>
            <span className="text-muted-foreground">
              H <span className="text-emerald-400">{crosshairData.high.toFixed(2)}</span>
            </span>
            <span className="text-muted-foreground">
              L <span className="text-red-400">{crosshairData.low.toFixed(2)}</span>
            </span>
            <span className="text-muted-foreground">
              C{" "}
              <span className={crosshairData.close >= crosshairData.open ? "text-emerald-400" : "text-red-400"}>
                {crosshairData.close.toFixed(2)}
              </span>
            </span>
            <span className="text-muted-foreground">
              V <span className="text-foreground">{crosshairData.volume.toFixed(2)}</span>
            </span>
          </div>
        )}

        {/* Live indicator */}
        <div className="flex items-center gap-1 text-[10px] text-emerald-400">
          <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.6)] animate-pulse" />
          مباشر
        </div>
      </div>

      {/* ═══════ MAIN LAYOUT ═══════ */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-2 min-h-0">
        {/* ──── LEFT: Chart + Bottom Panel ──── */}
        <div className="lg:col-span-8 xl:col-span-9 flex flex-col gap-2 min-h-0">
          {/* CHART AREA */}
          <div className="glass-panel rounded-xl overflow-hidden flex-1 flex flex-col min-h-0">
            {/* Chart Header */}
            <div className="flex items-center gap-2 px-3 py-2 border-b border-border/20 shrink-0">
              {/* Timeframe Selector */}
              <div className="flex items-center gap-0.5 bg-muted/20 rounded-lg p-0.5">
                {TIMEFRAMES.map((tf) => (
                  <button
                    key={tf.value}
                    onClick={() => setTimeframe(tf.value)}
                    className={`px-2.5 py-1 rounded-md text-[10px] font-medium transition-all duration-200 ${
                      timeframe === tf.value
                        ? "bg-primary/20 text-primary shadow-sm"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                    }`}
                  >
                    {tf.label}
                  </button>
                ))}
              </div>

              {/* Chart Type Icons */}
              <div className="flex items-center gap-1 mr-2">
                <button className="p-1 rounded text-primary hover:bg-muted/20 transition-all" title="شموع">
                  <BarChart3 className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="flex-1" />

              {/* MA Legend */}
              <div className="flex items-center gap-3 text-[9px]">
                <span className="flex items-center gap-1">
                  <span className="inline-block w-3 h-0.5 rounded bg-[#f0b90b]" />
                  <span className="text-[#f0b90b]">SMA 20</span>
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block w-3 h-0.5 rounded bg-[#8b5cf6]" />
                  <span className="text-[#8b5cf6]">EMA 50</span>
                </span>
              </div>
            </div>

            {/* Custom Chart */}
            <div className="flex-1 min-h-0 relative">
              <ProChart
                ref={chartRef}
                candles={candles}
                onCrosshairMove={handleCrosshairMove}
                className="w-full h-full"
              />
            </div>
          </div>

          {/* BOTTOM PANEL: Orders / Market Trades */}
          <div className="glass-panel rounded-xl overflow-hidden shrink-0" style={{ height: "200px" }}>
            {/* Tabs */}
            <div className="flex items-center border-b border-border/20 px-2 shrink-0">
              <button
                onClick={() => setBottomTab("orders")}
                className={`px-3 py-2 text-[11px] font-medium border-b-2 transition-all ${
                  bottomTab === "orders"
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                طلباتي ({orders.length})
              </button>
              <button
                onClick={() => setBottomTab("trades")}
                className={`px-3 py-2 text-[11px] font-medium border-b-2 transition-all ${
                  bottomTab === "trades"
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                صفقات السوق
              </button>
              <div className="flex-1" />
              {bottomTab === "orders" && (
                <button
                  onClick={() => fetchOrders()}
                  className="p-1 rounded hover:bg-muted/30 text-muted-foreground hover:text-foreground transition-all mr-1"
                >
                  <RefreshCw className="h-3 w-3" />
                </button>
              )}
            </div>

            {/* Content */}
            <div className="overflow-y-auto" style={{ height: "calc(100% - 33px)" }}>
              {bottomTab === "orders" ? (
                orders.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-6 px-4">
                    <div className="h-8 w-8 rounded-xl bg-muted/20 flex items-center justify-center mb-2">
                      <Minus className="h-4 w-4 text-muted-foreground/40" />
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      لا توجد طلبات حالياً
                    </p>
                  </div>
                ) : (
                  <table className="w-full text-[11px]">
                    <thead>
                      <tr className="text-muted-foreground/60 border-b border-border/10">
                        <th className="text-right px-3 py-1.5 font-medium">الزوج</th>
                        <th className="text-right px-3 py-1.5 font-medium">النوع</th>
                        <th className="text-right px-3 py-1.5 font-medium">الجانب</th>
                        <th className="text-right px-3 py-1.5 font-medium">السعر</th>
                        <th className="text-right px-3 py-1.5 font-medium">الكمية</th>
                        <th className="text-right px-3 py-1.5 font-medium">الحالة</th>
                        <th className="text-right px-3 py-1.5 font-medium"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {orders.slice(0, 20).map((order: any, i: number) => (
                        <tr
                          key={i}
                          className="border-b border-border/5 hover:bg-muted/5 transition-colors"
                        >
                          <td className="px-3 py-1.5 font-medium">
                            {order.symbol?.replace("USDT", "")}/USDT
                          </td>
                          <td className="px-3 py-1.5 text-muted-foreground">
                            {ORDER_TYPE_LABELS[order.type] || order.type}
                          </td>
                          <td className="px-3 py-1.5">
                            <span
                              className={`text-[10px] font-bold ${
                                order.side === "BUY"
                                  ? "text-emerald-400"
                                  : "text-red-400"
                              }`}
                            >
                              {order.side === "BUY" ? "شراء" : "بيع"}
                            </span>
                          </td>
                          <td className="px-3 py-1.5 tabular-nums">
                            {order.avg_fill_price > 0
                              ? parseFloat(order.avg_fill_price).toFixed(2)
                              : order.price
                                ? parseFloat(order.price).toFixed(2)
                                : "سوقي"}
                          </td>
                          <td className="px-3 py-1.5 tabular-nums">
                            {parseFloat(order.quantity || "0").toFixed(6)}
                          </td>
                          <td className="px-3 py-1.5">
                            <span
                              className={`text-[9px] px-1.5 py-0.5 rounded border font-medium ${
                                STATUS_COLORS[order.status] ||
                                "bg-muted/20 text-muted-foreground border-border/30"
                              }`}
                            >
                              {STATUS_LABELS[order.status] || order.status}
                            </span>
                          </td>
                          <td className="px-3 py-1.5">
                            {order.status === "PENDING" && (
                              <button
                                onClick={() => handleCancel(order.id)}
                                className="p-1 rounded bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all border border-red-500/15"
                                title="إلغاء الأمر"
                              >
                                <X className="h-2.5 w-2.5" />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )
              ) : (
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="text-muted-foreground/60 border-b border-border/10">
                      <th className="text-right px-3 py-1.5 font-medium">السعر (USDT)</th>
                      <th className="text-right px-3 py-1.5 font-medium">الكمية ({base})</th>
                      <th className="text-right px-3 py-1.5 font-medium">الوقت</th>
                    </tr>
                  </thead>
                  <tbody>
                    {marketTrades.map((trade: any, i: number) => (
                      <tr
                        key={trade.id || i}
                        className="border-b border-border/5 hover:bg-muted/5 transition-colors"
                      >
                        <td
                          className={`px-3 py-1 tabular-nums font-medium ${
                            trade.isBuyerMaker
                              ? "text-red-400"
                              : "text-emerald-400"
                          }`}
                        >
                          {trade.price.toFixed(
                            trade.price >= 1 ? 2 : 6
                          )}
                        </td>
                        <td className="px-3 py-1 tabular-nums text-muted-foreground">
                          {trade.qty.toFixed(6)}
                        </td>
                        <td className="px-3 py-1 text-muted-foreground tabular-nums">
                          {new Date(trade.time).toLocaleTimeString("ar-EG", {
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                          })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

        {/* ──── RIGHT: Order Book + Order Form ──── */}
        <div className="lg:col-span-4 xl:col-span-3 flex flex-col gap-2 min-h-0">
          {/* ORDER BOOK */}
          <div className="glass-panel rounded-xl overflow-hidden flex flex-col" style={{ flex: "1 1 55%" }}>
            <div className="flex items-center justify-between px-3 py-2 border-b border-border/20 shrink-0">
              <div className="flex items-center gap-1.5">
                <BookOpen className="h-3.5 w-3.5 text-primary" />
                <h3 className="font-bold text-xs">دفتر الأوامر</h3>
              </div>
              <div className="flex items-center gap-2 text-[9px]">
                <span className="text-muted-foreground">
                  {base}/USDT
                </span>
              </div>
            </div>

            {/* Column Headers */}
            <div className="flex items-center px-3 py-1 text-[9px] text-muted-foreground/50 font-medium border-b border-border/10 shrink-0">
              <span className="flex-1">السعر</span>
              <span className="flex-1 text-center">الكمية</span>
              <span className="flex-1 text-left">الإجمالي</span>
            </div>

            {/* Asks (sell orders) */}
            <div className="flex-1 overflow-y-auto min-h-0">
              {orderBook.asks
                ?.slice(0)
                .reverse()
                .map((ask: any, i: number) => {
                  const qty = parseFloat(ask[1]);
                  const price = parseFloat(ask[0]);
                  const total = qty * price;
                  const depthPercent = (qty / maxAskQty) * 100;
                  return (
                    <div
                      key={`ask-${i}`}
                      className="relative flex items-center px-3 py-[3px] text-[10px] hover:bg-red-500/5 transition-colors cursor-pointer"
                      onClick={() =>
                        setForm({ ...form, price: price.toFixed(2) })
                      }
                    >
                      <div
                        className="absolute top-0 left-0 h-full bg-red-500/[0.06] transition-all duration-300"
                        style={{ width: `${depthPercent}%` }}
                      />
                      <span className="relative flex-1 text-red-400 font-medium tabular-nums">
                        {price.toFixed(price >= 1 ? 2 : 6)}
                      </span>
                      <span className="relative flex-1 text-center text-muted-foreground tabular-nums">
                        {qty.toFixed(4)}
                      </span>
                      <span className="relative flex-1 text-left text-muted-foreground/60 tabular-nums">
                        {total.toFixed(2)}
                      </span>
                    </div>
                  );
                })}
            </div>

            {/* Spread / Current Price */}
            <div className="flex items-center justify-between px-3 py-1.5 border-y border-border/20 bg-muted/5 shrink-0">
              <div className="flex items-center gap-2">
                <span
                  className={`text-sm font-bold tabular-nums ${priceColor}`}
                >
                  {p?.price?.toFixed(p?.price >= 1 ? 2 : 6) || "—"}
                </span>
                {p && (
                  <span
                    className={`text-[9px] font-bold px-1 py-0.5 rounded ${
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
                <span className="text-[9px] text-muted-foreground tabular-nums">
                  فجوة: {spread.toFixed(2)} ({spreadPercent.toFixed(3)}%)
                </span>
              )}
            </div>

            {/* Bids (buy orders) */}
            <div className="flex-1 overflow-y-auto min-h-0">
              {orderBook.bids?.slice(0, 15).map((bid: any, i: number) => {
                const qty = parseFloat(bid[1]);
                const price = parseFloat(bid[0]);
                const total = qty * price;
                const depthPercent = (qty / maxBidQty) * 100;
                return (
                  <div
                    key={`bid-${i}`}
                    className="relative flex items-center px-3 py-[3px] text-[10px] hover:bg-emerald-500/5 transition-colors cursor-pointer"
                    onClick={() =>
                      setForm({
                        ...form,
                        price: price.toFixed(2),
                      })
                    }
                  >
                    <div
                      className="absolute top-0 left-0 h-full bg-emerald-500/[0.06] transition-all duration-300"
                      style={{ width: `${depthPercent}%` }}
                    />
                    <span className="relative flex-1 text-emerald-400 font-medium tabular-nums">
                      {price.toFixed(price >= 1 ? 2 : 6)}
                    </span>
                    <span className="relative flex-1 text-center text-muted-foreground tabular-nums">
                      {qty.toFixed(4)}
                    </span>
                    <span className="relative flex-1 text-left text-muted-foreground/60 tabular-nums">
                      {total.toFixed(2)}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Bid/Ask volume bar */}
            <div className="px-3 py-1.5 border-t border-border/10 shrink-0">
              <div className="flex items-center gap-2 text-[9px]">
                <span className="text-emerald-400 tabular-nums">
                  {totalBidVol?.toFixed(2) || "0"} {base}
                </span>
                <div className="flex-1 h-1 rounded-full bg-muted/30 overflow-hidden">
                  <div
                    className="h-full bg-emerald-500/40 rounded-full transition-all duration-300"
                    style={{
                      width: `${
                        totalBidVol && totalAskVol
                          ? (totalBidVol / (totalBidVol + totalAskVol)) * 100
                          : 50
                      }%`,
                    }}
                  />
                </div>
                <span className="text-red-400 tabular-nums">
                  {totalAskVol?.toFixed(2) || "0"} {base}
                </span>
              </div>
            </div>
          </div>

          {/* ORDER FORM */}
          <div
            className={`glass-panel rounded-xl overflow-hidden shrink-0 transition-colors duration-500 ${
              side === "BUY"
                ? "ring-1 ring-emerald-500/10"
                : "ring-1 ring-red-500/10"
            }`}
          >
            {/* Buy/Sell Header Toggle */}
            <div className="flex p-1 m-2 mb-0 rounded-lg bg-muted/20">
              {(["BUY", "SELL"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setSide(s)}
                  className={`flex-1 py-2 rounded-md text-xs font-bold transition-all duration-300 ${
                    side === s
                      ? s === "BUY"
                        ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/25"
                        : "bg-red-500 text-white shadow-lg shadow-red-500/25"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {s === "BUY" ? "شراء" : "بيع"} {base}
                </button>
              ))}
            </div>

            <div className="p-2.5 space-y-2.5">
              {/* Order Type Tabs */}
              <div className="flex items-center gap-0.5 bg-muted/15 rounded-lg p-0.5">
                {(
                  ["MARKET", "LIMIT", "STOP_LIMIT", "TAKE_PROFIT"] as const
                ).map((t) => (
                  <button
                    key={t}
                    onClick={() => setOrderType(t)}
                    className={`flex-1 py-1.5 px-1 rounded-md text-[9px] font-medium transition-all duration-200 text-center ${
                      orderType === t
                        ? side === "BUY"
                          ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20"
                          : "bg-red-500/15 text-red-400 border border-red-500/20"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/20 border border-transparent"
                    }`}
                  >
                    {ORDER_TYPE_LABELS[t]}
                  </button>
                ))}
              </div>

              {/* Available Balance */}
              <div
                className={`flex items-center justify-between p-2 rounded-lg border text-[10px] ${
                  side === "BUY"
                    ? "bg-emerald-500/5 border-emerald-500/10"
                    : "bg-red-500/5 border-red-500/10"
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <Wallet className="h-3 w-3 text-muted-foreground" />
                  <span className="text-muted-foreground">الرصيد المتاح</span>
                </div>
                <span className="font-medium tabular-nums">
                  {side === "BUY"
                    ? `${quoteWallet?.balance ? parseFloat(quoteWallet.balance).toFixed(2) : "0.00"}`
                    : `${baseWallet?.balance ? parseFloat(baseWallet.balance).toFixed(8) : "0.00000000"}`}{" "}
                  <span className="text-muted-foreground">
                    {side === "BUY" ? "USDT" : base}
                  </span>
                </span>
              </div>

              {/* Form Fields */}
              <form onSubmit={handleSubmit} className="space-y-2">
                {/* Quantity Input */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] text-muted-foreground font-medium">
                      الكمية ({base})
                    </label>
                    <div className="flex items-center gap-0.5">
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
                              setForm({
                                ...form,
                                quantity: maxQty.toFixed(8),
                              })
                            }
                            className={`px-1.5 py-0.5 rounded text-[9px] font-medium transition-all duration-200 ${
                              side === "BUY"
                                ? "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                                : "bg-red-500/10 text-red-400 hover:bg-red-500/20"
                            }`}
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
                      className="input-field text-xs py-2 pl-4 pr-12"
                      placeholder="0.00"
                      value={form.quantity}
                      onChange={(e) =>
                        setForm({ ...form, quantity: e.target.value })
                      }
                      required
                    />
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground font-medium">
                      {base}
                    </span>
                  </div>
                </div>

                {/* Price Input (LIMIT / STOP_LIMIT) */}
                {(orderType === "LIMIT" || orderType === "STOP_LIMIT") && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[10px] text-muted-foreground font-medium">
                        السعر (USDT)
                      </label>
                      {!form.price && p?.price && (
                        <button
                          type="button"
                          onClick={() =>
                            setForm({
                              ...form,
                              price: p.price.toFixed(2),
                            })
                          }
                          className="text-[9px] text-primary hover:underline"
                        >
                          الحالي: {p.price.toFixed(2)}
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <input
                        type="number"
                        step="any"
                        className="input-field text-xs py-2 pl-4 pr-12"
                        placeholder="0.00"
                        value={form.price}
                        onChange={(e) =>
                          setForm({ ...form, price: e.target.value })
                        }
                        required
                      />
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground font-medium">
                        USDT
                      </span>
                    </div>
                  </div>
                )}

                {/* Stop Price (STOP_LIMIT / TAKE_PROFIT) */}
                {(orderType === "STOP_LIMIT" ||
                  orderType === "TAKE_PROFIT") && (
                  <div>
                    <label className="text-[10px] text-muted-foreground font-medium mb-1 block">
                      سعر الإيقاف (USDT)
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step="any"
                        className="input-field text-xs py-2 pl-4 pr-12"
                        placeholder="0.00"
                        value={form.stopPrice}
                        onChange={(e) =>
                          setForm({ ...form, stopPrice: e.target.value })
                        }
                        required
                      />
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground font-medium">
                        USDT
                      </span>
                    </div>
                  </div>
                )}

                {/* Estimated Cost + Fee */}
                {form.quantity && parseFloat(form.quantity) > 0 && (
                  <div className="bg-muted/10 rounded-lg p-2 space-y-1.5">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-muted-foreground">
                        {side === "BUY"
                          ? "التكلفة التقديرية"
                          : "القيمة التقديرية"}
                      </span>
                      <span className="font-medium tabular-nums">
                        {estimatedTotal.toFixed(2)} USDT
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-muted-foreground">
                        الرسوم (~{(feeRate * 100).toFixed(2)}%)
                      </span>
                      <span className="font-medium tabular-nums text-muted-foreground">
                        {estimatedFee.toFixed(4)} USDT
                      </span>
                    </div>
                    <div className="border-t border-border/20 pt-1.5 flex items-center justify-between text-[10px]">
                      <span className="text-muted-foreground font-medium">
                        الإجمالي
                      </span>
                      <span
                        className={`font-bold tabular-nums ${
                          side === "BUY" ? "text-emerald-400" : "text-red-400"
                        }`}
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
                  className={`w-full py-2.5 rounded-lg font-bold text-xs transition-all duration-300 flex items-center justify-center gap-1.5 ${
                    side === "BUY"
                      ? "bg-emerald-500 text-white hover:bg-emerald-400 shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30"
                      : "bg-red-500 text-white hover:bg-red-400 shadow-lg shadow-red-500/20 hover:shadow-red-500/30"
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
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
        </div>
      </div>
    </div>
  );
}
