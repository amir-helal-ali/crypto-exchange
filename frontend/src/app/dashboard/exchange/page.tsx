"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import toast from "react-hot-toast";
import { authGet, authPost } from "@/lib/api";
import ProChart, { ProChartHandle, Candle } from "@/components/ProChart";

/* Exchange sub-components */
import TickerTape from "@/components/exchange/TickerTape";
import MarketList from "@/components/exchange/MarketList";
import PairHeader from "@/components/exchange/PairHeader";
import ChartToolbar, {
  ChartIndicators,
} from "@/components/exchange/ChartToolbar";
import OrderBookPanel from "@/components/exchange/OrderBookPanel";
import DepthChart from "@/components/exchange/DepthChart";
import TradeForm from "@/components/exchange/TradeForm";
import TradesFeed from "@/components/exchange/TradesFeed";
import OrdersPanel from "@/components/exchange/OrdersPanel";
import DrawingToolbar from "@/components/exchange/DrawingToolbar";
import PriceAlerts from "@/components/exchange/PriceAlerts";
import QuickPairSearch from "@/components/exchange/QuickPairSearch";
import AssetInfoPanel from "@/components/exchange/AssetInfoPanel";
import MobileTabBar, { MobileTab } from "@/components/exchange/MobileTabBar";
import PnLCalculator from "@/components/exchange/PnLCalculator";
import AdvancedOrders from "@/components/exchange/AdvancedOrders";
import OrderConfirmModal, {
  OrderConfirmData,
} from "@/components/exchange/OrderConfirmModal";
import MultiTimeframeStrip from "@/components/exchange/MultiTimeframeStrip";
import MarketSentiment from "@/components/exchange/MarketSentiment";
import ConvertModal from "@/components/exchange/ConvertModal";
import RecurringBuyModal, {
  RecurringPlan,
} from "@/components/exchange/RecurringBuyModal";
import WatchlistsPanel from "@/components/exchange/WatchlistsPanel";
import CheatSheet from "@/components/exchange/CheatSheet";
import OpenPositions from "@/components/exchange/OpenPositions";
import PositionSizeCalculator from "@/components/exchange/PositionSizeCalculator";
import LiquidationsFeed from "@/components/exchange/LiquidationsFeed";
import OpenInterest from "@/components/exchange/OpenInterest";
import ScreenerModal from "@/components/exchange/ScreenerModal";
import NotificationsInbox, {
  pushNotification,
} from "@/components/exchange/NotificationsInbox";
import TutorialOverlay, {
  useTutorialAutoShow,
} from "@/components/exchange/TutorialOverlay";
import MarketsHeatmapModal from "@/components/exchange/MarketsHeatmapModal";
import RecentPairs from "@/components/exchange/RecentPairs";
import { getSoundManager, useKeyboardShortcuts } from "@/components/exchange/sound";
import type { Drawing, DrawingTool } from "@/components/exchange/drawings";
import { DRAWING_COLORS } from "@/components/exchange/drawings";
import { Camera, Search, Zap, Repeat, ListChecks, Filter, Bell, HelpCircle, Grid3x3 } from "lucide-react";

import type {
  TickerData,
  MarketTrade,
  UserOrder,
  Wallet as WalletType,
  FeeSchedule,
  OrderSide,
  OrderType,
  Timeframe,
} from "@/components/exchange/types";

/* ═══════════════════════════════════════════
   Main Exchange Page — Binance/Bybit-grade UI
   ═══════════════════════════════════════════ */
export default function ExchangePage() {
  /* ─────── State ─────── */
  const [selectedPair, setSelectedPair] = useState("BTCUSDT");
  const [prices, setPrices] = useState<Record<string, TickerData>>({});
  const [orderBook, setOrderBook] = useState<{
    bids: [string, string][];
    asks: [string, string][];
  }>({ bids: [], asks: [] });
  const [side, setSide] = useState<OrderSide>("BUY");
  const [orderType, setOrderType] = useState<OrderType>("MARKET");
  const [orders, setOrders] = useState<UserOrder[]>([]);
  const [wallets, setWallets] = useState<WalletType[]>([]);
  const [feeSchedules, setFeeSchedules] = useState<FeeSchedule[]>([]);
  const [loading, setLoading] = useState(false);
  const [timeframe, setTimeframe] = useState<Timeframe>("15m");
  const [candles, setCandles] = useState<Candle[]>([]);
  const [marketTrades, setMarketTrades] = useState<MarketTrade[]>([]);
  const [crosshairData, setCrosshairData] = useState<Candle | null>(null);
  const [chartType, setChartType] = useState<"candles" | "line" | "area">(
    "candles"
  );
  const [heikinAshi, setHeikinAshi] = useState(false);
  const [logScale, setLogScale] = useState(false);
  const [marketListOpen, setMarketListOpen] = useState(true);
  const [chartFullscreen, setChartFullscreen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [indicators, setIndicators] = useState<ChartIndicators>({
    sma20: true,
    ema50: true,
    bollinger: false,
    rsi: false,
    macd: false,
    vwap: false,
    stochastic: false,
    ichimoku: false,
    volume: true,
  });
  const [showDepthChart, setShowDepthChart] = useState(true);

  /* Drawing tools state */
  const [activeTool, setActiveTool] = useState<DrawingTool>("cursor");
  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const [drawingColor, setDrawingColor] = useState<string>(DRAWING_COLORS[0]);

  /* Quick pair search state */
  const [searchOpen, setSearchOpen] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([]);

  /* Order confirmation modal state */
  const [confirmModal, setConfirmModal] = useState<{
    open: boolean;
    data: OrderConfirmData | null;
  }>({ open: false, data: null });

  /* Convert (instant swap) modal state */
  const [convertOpen, setConvertOpen] = useState(false);

  /* Recurring buy (DCA) modal state */
  const [recurringOpen, setRecurringOpen] = useState(false);

  /* Watchlists panel state */
  const [watchlistsOpen, setWatchlistsOpen] = useState(false);

  /* Screener modal state */
  const [screenerOpen, setScreenerOpen] = useState(false);

  /* Notifications inbox state */
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  /* Markets heatmap modal state */
  const [heatmapOpen, setHeatmapOpen] = useState(false);

  /* Tutorial overlay state (auto-shows on first visit) */
  const { shouldShow: showTutorial, markSeen: markTutorialSeen } =
    useTutorialAutoShow();
  const [tutorialOpen, setTutorialOpen] = useState(false);

  /* Mobile active tab state */
  const [mobileTab, setMobileTab] = useState<MobileTab>("chart");

  const chartRef = useRef<ProChartHandle>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const prevPrices = useRef<Record<string, number>>({});

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
        `https://api.binance.com/api/v3/trades?symbol=${selectedPair}&limit=30`
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

  /* Initial fetch */
  useEffect(() => {
    fetchOrders();
    fetchWallets();
    fetchFees();
  }, [fetchOrders, fetchWallets, fetchFees]);

  /* Load drawings for the selected pair from localStorage */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(`exchange_drawings_${selectedPair}`);
      if (raw) {
        setDrawings(JSON.parse(raw));
      } else {
        setDrawings([]);
      }
    } catch {
      setDrawings([]);
    }
  }, [selectedPair]);

  /* Persist drawings to localStorage whenever they change */
  useEffect(() => {
    try {
      localStorage.setItem(
        `exchange_drawings_${selectedPair}`,
        JSON.stringify(drawings)
      );
    } catch {}
  }, [drawings, selectedPair]);

  /* Refetch when pair/timeframe changes */
  useEffect(() => {
    fetchKlines();
    fetchMarketTrades();
  }, [fetchKlines, fetchMarketTrades]);

  /* ─────── Binance WebSocket (Ticker + Depth + All tickers tape) ─────── */
  useEffect(() => {
    const ws = new WebSocket("wss://stream.binance.com:9443/ws");
    const streams = [
      `${selectedPair.toLowerCase()}@ticker`,
      `${selectedPair.toLowerCase()}@depth20@100ms`,
      "!ticker@arr", // all tickers for the tape
    ];
    ws.onopen = () =>
      ws.send(JSON.stringify({ method: "SUBSCRIBE", params: streams, id: 1 }));

    ws.onmessage = (e) => {
      const d = JSON.parse(e.data);

      // Single ticker update
      if (d.e === "24hrTicker" && d.s === selectedPair) {
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
      }
      // All tickers array (for ticker tape)
      else if (Array.isArray(d) && d.length > 0 && d[0]?.e === "24hrTicker") {
        setPrices((prev: any) => {
          const next = { ...prev };
          for (const t of d) {
            if (t.s && t.s.endsWith("USDT")) {
              next[t.s] = {
                price: parseFloat(t.c),
                high: parseFloat(t.h),
                low: parseFloat(t.l),
                volume: t.v,
                change: t.P,
                quoteVolume: t.q,
                openPrice: t.o,
              };
            }
          }
          return next;
        });
      }
      // Depth update
      else if (d.e === "depthUpdate" && d.bids && d.asks) {
        setOrderBook({
          bids: d.bids.slice(0, 15),
          asks: d.asks.slice(0, 15),
        });
      }
    };

    wsRef.current = ws;
    return () => ws.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
          const newTrade: MarketTrade = {
            id: d.t,
            price: parseFloat(d.p),
            qty: parseFloat(d.q),
            time: d.T,
            isBuyerMaker: d.m,
          };
          // dedupe
          if (prev.some((t) => t.id === newTrade.id)) return prev;
          return [newTrade, ...prev].slice(0, 50);
        });
      }
    };
    return () => ws.close();
  }, [selectedPair]);

  /* ─────── Order Handlers ─────── */
  /* Open confirmation modal with order details (Binance/Bybit-style preview) */
  const handleSubmit = (form: {
    quantity: string;
    price: string;
    stopPrice: string;
  }) => {
    setConfirmModal({
      open: true,
      data: {
        side,
        orderType,
        quantity: form.quantity,
        price: form.price,
        stopPrice: form.stopPrice,
        base,
      },
    });
  };

  /* Actually place the order after confirmation */
  const handleConfirmOrder = async (extra: {
    stopLoss?: string;
    takeProfit?: string;
    reduceOnly: boolean;
    postOnly: boolean;
  }) => {
    if (!confirmModal.data) return;
    const form = confirmModal.data;
    setLoading(true);
    try {
      const body: any = {
        symbol: selectedPair,
        side: form.side,
        type: form.orderType,
        quantity: form.quantity,
      };
      if (form.orderType === "LIMIT" || form.orderType === "STOP_LIMIT")
        body.price = form.price;
      if (form.orderType === "STOP_LIMIT" || form.orderType === "TAKE_PROFIT")
        body.stop_price = form.stopPrice;
      if (extra.reduceOnly) body.reduce_only = true;
      if (extra.postOnly) body.post_only = true;

      const res = await authPost("/api/v1/exchange/order", body);
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "فشل تنفيذ الأمر");
        getSoundManager().play("error");
        return;
      }
      toast.success(data.message || "تم تنفيذ الأمر بنجاح");
      // Different sound: filled vs pending
      if (data.data?.status === "FILLED" || data.data?.status === "filled") {
        getSoundManager().play("order_filled");
        pushNotification({
          type: "order_filled",
          title: "تم تنفيذ الأمر",
          message: `${form.side === "BUY" ? "شراء" : "بيع"} ${form.quantity} ${form.base} @ ${form.orderType === "MARKET" ? "سوقي" : form.price}`,
        });
      } else {
        getSoundManager().play("order_placed");
        pushNotification({
          type: "order_placed",
          title: "تم وضع الأمر",
          message: `${form.side === "BUY" ? "شراء" : "بيع"} ${form.quantity} ${form.base} بانتظار التنفيذ`,
        });
      }

      /* If SL/TP provided, show informational toast about attached orders */
      if (extra.stopLoss || extra.takeProfit) {
        const parts: string[] = [];
        if (extra.stopLoss) parts.push(`وقف: ${extra.stopLoss}`);
        if (extra.takeProfit) parts.push(`ربح: ${extra.takeProfit}`);
        toast(`سيتم إعداد SL/TP: ${parts.join(" • ")}`, { icon: "🎯" });
      }

      fetchOrders();
      fetchWallets();
      setConfirmModal({ open: false, data: null });
    } catch {
      toast.error("حدث خطأ في الاتصال");
      getSoundManager().play("error");
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
        getSoundManager().play("error");
        return;
      }
      toast.success(data.message || "تم إلغاء الأمر بنجاح");
      getSoundManager().play("order_cancelled");
      pushNotification({
        type: "order_cancelled",
        title: "تم إلغاء الأمر",
        message: `تم إلغاء الأمر #${orderId}`,
      });
      fetchOrders();
      fetchWallets();
    } catch {
      toast.error("حدث خطأ في الاتصال");
    }
  };

  /* ─────── Keyboard shortcuts ─────── */
  useKeyboardShortcuts({
    onToggleSide: () => setSide((s) => (s === "BUY" ? "SELL" : "BUY")),
    onSetBuy: () => setSide("BUY"),
    onSetSell: () => setSide("SELL"),
    onSetMarket: () => setOrderType("MARKET"),
    onSetLimit: () => setOrderType("LIMIT"),
    onOpenSearch: () => setSearchOpen(true),
    onExportChart: () => {
      if (chartRef.current) {
        chartRef.current.exportPng(`chart_${selectedPair}_${timeframe}.png`);
        toast.success("تم تصدير صورة الشارت");
      }
    },
    onToggleFullscreen: () => setChartFullscreen((v) => !v),
  });

  /* ─────── Load favorites from localStorage ─────── */
  useEffect(() => {
    try {
      const raw = localStorage.getItem("exchange_favorites");
      if (raw) setFavorites(JSON.parse(raw));
    } catch {}
    // Listen for changes from MarketList or QuickPairSearch
    const syncFavorites = () => {
      try {
        const stored = localStorage.getItem("exchange_favorites");
        if (stored) setFavorites(JSON.parse(stored));
      } catch {}
    };
    window.addEventListener("exchange:favorites-changed", syncFavorites);
    return () =>
      window.removeEventListener("exchange:favorites-changed", syncFavorites);
  }, []);

  /* ─────── Persist favorites ─────── */
  useEffect(() => {
    try {
      localStorage.setItem("exchange_favorites", JSON.stringify(favorites));
      window.dispatchEvent(new CustomEvent("exchange:favorites-changed"));
    } catch {}
  }, [favorites]);

  /* ─────── Toggle favorite pair ─────── */
  const toggleFavorite = useCallback((pair: string) => {
    setFavorites((prev) =>
      prev.includes(pair)
        ? prev.filter((p) => p !== pair)
        : [...prev, pair]
    );
  }, []);

  /* ─────── Sync sound enabled state ─────── */
  useEffect(() => {
    getSoundManager().setEnabled(soundEnabled);
  }, [soundEnabled]);

  /* ─────── Crosshair handler ─────── */
  const handleCrosshairMove = useCallback(
    (data: { candle: Candle | null; x: number; y: number } | null) => {
      setCrosshairData(data?.candle || null);
    },
    []
  );

  /* ─────── Order book price click → propagate to form ─────── */
  const handlePriceClick = useCallback((price: number) => {
    window.dispatchEvent(
      new CustomEvent("exchange:set-price", { detail: price })
    );
  }, []);

  /* ─────── Computed ─────── */
  const base = selectedPair.replace("USDT", "");
  const p = prices[selectedPair];
  const prevPrice = prevPrices.current[selectedPair];
  const baseWallet = wallets.find((w) => w.currency === base);
  const quoteWallet = wallets.find((w) => w.currency === "USDT");
  const openOrdersCount = orders.filter((o) => o.status === "PENDING").length;

  /* Convert candles to Heikin Ashi when enabled */
  const displayCandles = useMemo(() => {
    if (!heikinAshi || candles.length === 0) return candles;
    const result: Candle[] = [];
    let prevHAOpen = candles[0].open;
    let prevHAClose = candles[0].close;
    for (let i = 0; i < candles.length; i++) {
      const c = candles[i];
      const haClose = (c.open + c.high + c.low + c.close) / 4;
      const haOpen = i === 0 ? (c.open + c.close) / 2 : (prevHAOpen + prevHAClose) / 2;
      const haHigh = Math.max(c.high, haOpen, haClose);
      const haLow = Math.min(c.low, haOpen, haClose);
      result.push({
        time: c.time,
        open: haOpen,
        high: haHigh,
        low: haLow,
        close: haClose,
        volume: c.volume,
      });
      prevHAOpen = haOpen;
      prevHAClose = haClose;
    }
    return result;
  }, [candles, heikinAshi]);

  /* ═══════════════════════════════════════════
     Render
     ═══════════════════════════════════════════ */
  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] gap-1.5 animate-fade-in overflow-hidden p-1.5">
      {/* ─────── Ticker Tape (top, scrolling) ─────── */}
      <TickerTape
        prices={prices}
        onSelectPair={setSelectedPair}
        selectedPair={selectedPair}
      />

      {/* ─────── Pair Header (price + 24h stats + quick actions) ─────── */}
      <div className="flex items-center gap-1.5">
        <div className="flex-1 min-w-0">
          <PairHeader
            selectedPair={selectedPair}
            prices={prices}
            prevPrice={prevPrice}
            onSelectPair={setSelectedPair}
            crosshairData={crosshairData}
          />
        </div>

        {/* Quick action buttons */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Quick pair search (Ctrl+K) */}
          <button
            onClick={() => setSearchOpen(true)}
            className="glass-panel rounded-lg p-2 text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-all"
            title="بحث سريع عن زوج (Ctrl+K)"
          >
            <Search className="h-4 w-4" />
          </button>

          {/* Screener — find pairs by criteria */}
          <button
            onClick={() => setScreenerOpen(true)}
            className="glass-panel rounded-lg p-2 text-blue-400 hover:bg-blue-500/10 transition-all"
            title="فرز الأسواق"
          >
            <Filter className="h-4 w-4" />
          </button>

          {/* Markets Heatmap */}
          <button
            onClick={() => setHeatmapOpen(true)}
            className="glass-panel rounded-lg p-2 text-emerald-400 hover:bg-emerald-500/10 transition-all"
            title="خريطة الأسواق الحرارية"
          >
            <Grid3x3 className="h-4 w-4" />
          </button>

          {/* Chart screenshot export (Ctrl+E) */}
          <button
            onClick={() => {
              if (chartRef.current) {
                chartRef.current.exportPng(
                  `chart_${selectedPair}_${timeframe}.png`
                );
                toast.success("تم تصدير صورة الشارت");
              }
            }}
            className="glass-panel rounded-lg p-2 text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-all"
            title="تصدير صورة الشارت (Ctrl+E)"
          >
            <Camera className="h-4 w-4" />
          </button>

          {/* P&L Calculator */}
          <PnLCalculator
            pair={selectedPair}
            base={base}
            ticker={p}
            feeRate={
              feeSchedules.find(
                (f) => f.user_type === "regular" && f.order_type === "LIMIT"
              )?.taker_fee ?? 0.001
            }
            currentPrice={p?.price}
          />

          {/* Position Size Calculator (risk-based) */}
          <PositionSizeCalculator
            pair={selectedPair}
            base={base}
            ticker={p}
            currentPrice={p?.price}
            quoteWallet={quoteWallet}
          />

          {/* Convert (instant swap) */}
          <button
            onClick={() => setConvertOpen(true)}
            className="glass-panel rounded-lg p-2 text-primary hover:bg-primary/10 transition-all"
            title="تحويل فوري بين الأصول"
          >
            <Zap className="h-4 w-4" />
          </button>

          {/* Recurring buy (DCA) */}
          <button
            onClick={() => setRecurringOpen(true)}
            className="glass-panel rounded-lg p-2 text-emerald-400 hover:bg-emerald-500/10 transition-all"
            title="خطة شراء متكرر (DCA)"
          >
            <Repeat className="h-4 w-4" />
          </button>

          {/* Watchlists */}
          <button
            onClick={() => setWatchlistsOpen(true)}
            className="glass-panel rounded-lg p-2 text-yellow-400 hover:bg-yellow-500/10 transition-all"
            title="قوائم المراقبة"
          >
            <ListChecks className="h-4 w-4" />
          </button>

          {/* Advanced orders (OCO / Trailing Stop) */}
          <AdvancedOrders
            pair={selectedPair}
            base={base}
            ticker={p}
            currentPrice={p?.price}
            side={side}
            onPlaceOCO={(params) => {
              toast(
                `أمر OCO: ${params.quantity} ${base} • وقف: ${params.stopPrice} • ربح: ${params.takeProfitPrice}`,
                { icon: "🎯" }
              );
              getSoundManager().play("order_placed");
            }}
            onPlaceTrailingStop={(params) => {
              toast(
                `إيقاف متتبع: ${params.quantity} ${base} • تتبع: ${params.trailPercent}%`,
                { icon: "📈" }
              );
              getSoundManager().play("order_placed");
            }}
          />

          {/* Price alerts */}
          <PriceAlerts
            pair={selectedPair}
            currentPrice={p?.price}
            compact
          />

          {/* Notifications inbox */}
          <button
            onClick={() => setNotificationsOpen(true)}
            className="glass-panel rounded-lg p-2 text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-all relative"
            title="الإشعارات"
          >
            <Bell className="h-4 w-4" />
            <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-primary animate-pulse" />
          </button>

          {/* Tutorial / Help */}
          <button
            onClick={() => setTutorialOpen(true)}
            className="glass-panel rounded-lg p-2 text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-all"
            title="دليل الميزات"
          >
            <HelpCircle className="h-4 w-4" />
          </button>

          {/* Sound toggle */}
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`glass-panel rounded-lg p-2 transition-all ${
              soundEnabled
                ? "text-primary hover:bg-primary/10"
                : "text-muted-foreground hover:bg-muted/30"
            }`}
            title={soundEnabled ? "كتم الصوت" : "تشغيل الصوت"}
          >
            {soundEnabled ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
              </svg>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <line x1="23" y1="9" x2="17" y2="15" />
                <line x1="17" y1="9" x2="23" y2="15" />
              </svg>
            )}
          </button>

          {/* Market list toggle */}
          <button
            onClick={() => setMarketListOpen(!marketListOpen)}
            className="glass-panel rounded-lg p-2 text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-all"
            title={marketListOpen ? "إخفاء قائمة الأسواق" : "إظهار قائمة الأسواق"}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="8" y1="6" x2="21" y2="6" />
              <line x1="8" y1="12" x2="21" y2="12" />
              <line x1="8" y1="18" x2="21" y2="18" />
              <line x1="3" y1="6" x2="3.01" y2="6" />
              <line x1="3" y1="12" x2="3.01" y2="12" />
              <line x1="3" y1="18" x2="3.01" y2="18" />
            </svg>
          </button>

          {/* Depth chart toggle */}
          <button
            onClick={() => setShowDepthChart(!showDepthChart)}
            className={`glass-panel rounded-lg p-2 transition-all ${
              showDepthChart
                ? "text-primary hover:bg-primary/10"
                : "text-muted-foreground hover:bg-muted/30"
            }`}
            title={showDepthChart ? "إخفاء منحنى العمق" : "إظهار منحنى العمق"}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 3v18h18" />
              <path d="M7 16l4-8 4 4 5-7" />
            </svg>
          </button>
        </div>
      </div>

      {/* ─────── Main 3-column layout ─────── */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-1.5 min-h-0 pb-14 lg:pb-0">
        {/* ─── LEFT: Market List (collapsible, desktop only) ─── */}
        {marketListOpen && (
          <div className="hidden lg:block lg:col-span-2 min-h-0">
            <MarketList
              prices={prices}
              selectedPair={selectedPair}
              onSelectPair={setSelectedPair}
            />
          </div>
        )}

        {/* ─── CENTER: Chart + Orders Panel ─── */}
        <div
          className={`flex flex-col gap-1.5 min-h-0 ${
            marketListOpen ? "lg:col-span-6 xl:col-span-7" : "lg:col-span-8 xl:col-span-9"
          } ${chartFullscreen ? "fixed inset-0 z-50 bg-background/95 backdrop-blur-lg p-2" : ""} ${
            // On mobile: only show this column when chart or orders tab is active
            mobileTab === "chart" || mobileTab === "orders" ? "flex" : "hidden lg:flex"
          }`}
        >
          {/* Multi-timeframe mini charts strip — hidden on mobile + when chart fullscreen */}
          {!chartFullscreen && (
            <>
              {/* Recent pairs quick switcher */}
              <div className="hidden md:block shrink-0">
                <RecentPairs
                  selectedPair={selectedPair}
                  onSelectPair={setSelectedPair}
                  prices={prices}
                />
              </div>
              <div className="hidden md:block shrink-0">
                <MultiTimeframeStrip
                  pair={selectedPair}
                  activeTimeframe={timeframe}
                  onSelectTimeframe={setTimeframe}
                />
              </div>
            </>
          )}

          {/* Chart Panel — hidden on mobile when orders tab is active */}
          <div
            className={`glass-panel rounded-xl overflow-hidden flex flex-col min-h-0 ${
              chartFullscreen ? "h-full" : "flex-1"
            } ${mobileTab === "orders" ? "hidden lg:flex" : "flex"}`}
          >
            <ChartToolbar
              timeframe={timeframe}
              onTimeframeChange={setTimeframe}
              chartType={chartType}
              onChartTypeChange={setChartType}
              indicators={indicators}
              onIndicatorsChange={setIndicators}
              isFullscreen={chartFullscreen}
              onToggleFullscreen={() => setChartFullscreen((v) => !v)}
              onZoomIn={() => chartRef.current?.zoomIn()}
              onZoomOut={() => chartRef.current?.zoomOut()}
              onResetView={() => chartRef.current?.resetView()}
              heikinAshi={heikinAshi}
              onToggleHeikinAshi={() => setHeikinAshi(!heikinAshi)}
              logScale={logScale}
              onToggleLogScale={() => setLogScale(!logScale)}
            />
            <DrawingToolbar
              activeTool={activeTool}
              onToolChange={setActiveTool}
              activeColor={drawingColor}
              onColorChange={setDrawingColor}
              onClearAll={() => setDrawings([])}
              drawingCount={drawings.length}
            />
            <div className="flex-1 min-h-0 relative">
              <ProChart
                ref={chartRef}
                candles={displayCandles}
                onCrosshairMove={handleCrosshairMove}
                className="w-full h-full"
                chartType={chartType}
                indicators={indicators}
                logScale={logScale}
                activeTool={activeTool}
                drawings={drawings}
                onDrawingsChange={setDrawings}
                drawingColor={drawingColor}
              />
            </div>
          </div>

          {/* Bottom Orders/History/Balance Panel */}
          {!chartFullscreen && (
            <div
              className={`glass-panel rounded-xl overflow-hidden shrink-0 ${
                mobileTab === "chart" ? "hidden lg:block" : "block"
              }`}
              style={{ height: mobileTab === "orders" ? "100%" : "220px" }}
            >
              <OrdersPanel
                orders={orders}
                wallets={wallets}
                onCancel={handleCancel}
                onRefresh={() => {
                  fetchOrders();
                  fetchWallets();
                }}
                base={base}
              />
            </div>
          )}
        </div>

        {/* ─── RIGHT: Order Book + Depth Chart + Trade Form + Trades Feed ─── */}
        {!chartFullscreen && (
          <div
            className={`flex flex-col gap-1.5 min-h-0 ${
              marketListOpen ? "lg:col-span-4 xl:col-span-3" : "lg:col-span-4 xl:col-span-3"
            } ${
              // On mobile: show this column when orderbook or trade tab is active
              mobileTab === "orderbook" || mobileTab === "trade" ? "flex" : "hidden lg:flex"
            }`}
          >
            {/* Order Book + Depth Chart side by side — only show on orderbook tab (mobile) */}
            <div
              className={`flex gap-1.5 min-h-0 ${mobileTab === "trade" ? "hidden lg:flex" : "flex"}`}
              style={{ flex: "1 1 0" }}
            >
              {/* Order book (wider) */}
              <div className="flex-1 min-w-0">
                <OrderBookPanel
                  bids={orderBook.bids}
                  asks={orderBook.asks}
                  ticker={p}
                  prevPrice={prevPrice}
                  base={base}
                  onPriceClick={handlePriceClick}
                  maxRows={10}
                />
              </div>
              {/* Depth chart (narrower) */}
              {showDepthChart && (
                <div className="w-1/3 min-w-0 hidden md:block">
                  <DepthChart
                    bids={orderBook.bids}
                    asks={orderBook.asks}
                    currentPrice={p?.price}
                  />
                </div>
              )}
            </div>

            {/* Trade Form — show on trade tab on mobile, always on desktop */}
            <div className={mobileTab === "orderbook" ? "hidden lg:block" : "block"}>
              <TradeForm
                base={base}
                side={side}
                orderType={orderType}
                onSideChange={setSide}
                onTypeChange={setOrderType}
                onSubmit={handleSubmit}
                loading={loading}
                baseWallet={baseWallet}
                quoteWallet={quoteWallet}
                ticker={p}
                feeSchedules={feeSchedules}
              />
            </div>

            {/* Trades Feed — hidden on mobile (orderbook tab is too cramped) */}
            <div className="shrink-0 hidden lg:block" style={{ height: "180px" }}>
              <TradesFeed
                trades={marketTrades}
                base={base}
                onPriceClick={handlePriceClick}
                maxRows={10}
              />
            </div>

            {/* Market Sentiment widget — hidden on mobile */}
            <div className="hidden lg:block">
              <MarketSentiment
                ticker={p}
                trades={marketTrades}
                base={base}
              />
            </div>

            {/* Open Positions panel with live P&L — hidden on mobile */}
            <div className="hidden lg:block">
              <OpenPositions
                wallets={wallets}
                prices={prices}
                onClosePosition={(currency) => {
                  toast(`سيتم إغلاق مركز ${currency} وتحويله إلى USDT`, {
                    icon: "💼",
                  });
                  getSoundManager().play("order_placed");
                }}
              />
            </div>

            {/* Recent Liquidations feed — hidden on mobile */}
            <div className="hidden lg:block" style={{ height: "180px" }}>
              <LiquidationsFeed pair={selectedPair} base={base} maxRows={15} />
            </div>

            {/* Trader's Cheat Sheet (pivot levels) — hidden on mobile */}
            <div className="hidden lg:block">
              <CheatSheet pair={selectedPair} currentPrice={p?.price} />
            </div>

            {/* Open Interest & Funding Rate (futures data) — hidden on mobile */}
            <div className="hidden lg:block">
              <OpenInterest pair={selectedPair} base={base} />
            </div>

            {/* Asset Info Panel — hidden on mobile */}
            <div className="hidden lg:block">
              <AssetInfoPanel
                base={base}
                pair={selectedPair}
                ticker={p}
              />
            </div>
          </div>
        )}
      </div>

      {/* Keyboard shortcuts hint */}
      <div className="hidden md:flex items-center justify-center gap-3 text-[9px] text-muted-foreground/60 py-0.5 shrink-0">
        <span>
          <kbd className="px-1 py-0.5 rounded bg-muted/30 border border-border/30">Ctrl+K</kbd> بحث
        </span>
        <span>
          <kbd className="px-1 py-0.5 rounded bg-muted/30 border border-border/30">Ctrl+B</kbd> شراء
        </span>
        <span>
          <kbd className="px-1 py-0.5 rounded bg-muted/30 border border-border/30">Ctrl+S</kbd> بيع
        </span>
        <span>
          <kbd className="px-1 py-0.5 rounded bg-muted/30 border border-border/30">Ctrl+M</kbd> سوقي
        </span>
        <span>
          <kbd className="px-1 py-0.5 rounded bg-muted/30 border border-border/30">Ctrl+L</kbd> محدد
        </span>
        <span>
          <kbd className="px-1 py-0.5 rounded bg-muted/30 border border-border/30">Ctrl+E</kbd> لقطة شارت
        </span>
        <span>
          <kbd className="px-1 py-0.5 rounded bg-muted/30 border border-border/30">Ctrl+F</kbd> ملء الشاشة
        </span>
        <span>
          <kbd className="px-1 py-0.5 rounded bg-muted/30 border border-border/30">Space</kbd> تبديل الشراء/البيع
        </span>
      </div>

      {/* ─────── Quick Pair Search Modal (Ctrl+K) ─────── */}
      <QuickPairSearch
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        onSelectPair={setSelectedPair}
        prices={prices}
        selectedPair={selectedPair}
        favorites={favorites}
        onToggleFavorite={toggleFavorite}
      />

      {/* ─────── Order Confirmation Modal (with optional SL/TP) ─────── */}
      <OrderConfirmModal
        open={confirmModal.open}
        data={confirmModal.data}
        ticker={p}
        feeSchedules={feeSchedules}
        onConfirm={handleConfirmOrder}
        onClose={() => setConfirmModal({ open: false, data: null })}
        loading={loading}
      />

      {/* ─────── Convert (Instant Swap) Modal ─────── */}
      <ConvertModal
        open={convertOpen}
        onClose={() => setConvertOpen(false)}
        prices={prices}
        wallets={wallets}
        defaultFrom="USDT"
        defaultTo={base}
        onConfirm={(params) => {
          toast.success(
            `تم تحويل ${params.amount} ${params.from} إلى ${params.expectedReceive} ${params.to}`
          );
          getSoundManager().play("order_filled");
          fetchWallets();
          setConvertOpen(false);
        }}
      />

      {/* ─────── Recurring Buy (DCA) Modal ─────── */}
      <RecurringBuyModal
        open={recurringOpen}
        onClose={() => setRecurringOpen(false)}
        defaultPair={selectedPair}
        ticker={p}
        onConfirm={(plan: RecurringPlan) => {
          const freqLabel = {
            daily: "يومي",
            weekly: "أسبوعي",
            biweekly: "نصف شهري",
            monthly: "شهري",
          }[plan.frequency];
          toast.success(
            `تم إنشاء خطة ${freqLabel}: ${plan.amount} USDT → ${plan.pair.replace("USDT", "")}`
          );
          getSoundManager().play("order_placed");
          setRecurringOpen(false);
        }}
      />

      {/* ─────── Watchlists Panel ─────── */}
      <WatchlistsPanel
        open={watchlistsOpen}
        onClose={() => setWatchlistsOpen(false)}
        onSelectPair={setSelectedPair}
        selectedPair={selectedPair}
        prices={prices}
      />

      {/* ─────── Screener Modal ─────── */}
      <ScreenerModal
        open={screenerOpen}
        onClose={() => setScreenerOpen(false)}
        prices={prices}
        selectedPair={selectedPair}
        onSelectPair={setSelectedPair}
      />

      {/* ─────── Markets Heatmap Modal ─────── */}
      <MarketsHeatmapModal
        open={heatmapOpen}
        onClose={() => setHeatmapOpen(false)}
        prices={prices}
        selectedPair={selectedPair}
        onSelectPair={setSelectedPair}
      />

      {/* ─────── Notifications Inbox ─────── */}
      <NotificationsInbox
        open={notificationsOpen}
        onClose={() => setNotificationsOpen(false)}
      />

      {/* ─────── Tutorial Overlay (auto-show on first visit + manual) ─────── */}
      <TutorialOverlay
        open={showTutorial || tutorialOpen}
        onClose={() => {
          markTutorialSeen();
          setTutorialOpen(false);
        }}
      />

      {/* ─────── Mobile Tab Bar (bottom navigation for small screens) ─────── */}
      <MobileTabBar
        active={mobileTab}
        onChange={setMobileTab}
        onOpenSearch={() => setSearchOpen(true)}
        openOrdersCount={openOrdersCount}
      />
    </div>
  );
}
