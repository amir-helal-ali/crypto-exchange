"use client";

import { useEffect, useState, useRef, useCallback } from "react";
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
import { getSoundManager, useKeyboardShortcuts } from "@/components/exchange/sound";

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
  const [marketListOpen, setMarketListOpen] = useState(true);
  const [chartFullscreen, setChartFullscreen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [indicators, setIndicators] = useState<ChartIndicators>({
    sma20: true,
    ema50: true,
    bollinger: false,
    rsi: false,
    macd: false,
    volume: true,
  });
  const [showDepthChart, setShowDepthChart] = useState(true);

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
  const handleSubmit = async (form: {
    quantity: string;
    price: string;
    stopPrice: string;
  }) => {
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
        getSoundManager().play("error");
        return;
      }
      toast.success(data.message || "تم تنفيذ الأمر بنجاح");
      // Different sound: filled vs pending
      if (data.data?.status === "FILLED" || data.data?.status === "filled") {
        getSoundManager().play("order_filled");
      } else {
        getSoundManager().play("order_placed");
      }
      fetchOrders();
      fetchWallets();
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
  });

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
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-1.5 min-h-0">
        {/* ─── LEFT: Market List (collapsible) ─── */}
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
          } ${chartFullscreen ? "fixed inset-0 z-50 bg-background/95 backdrop-blur-lg p-2" : ""}`}
        >
          {/* Chart Panel */}
          <div
            className={`glass-panel rounded-xl overflow-hidden flex flex-col min-h-0 ${
              chartFullscreen ? "h-full" : "flex-1"
            }`}
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
            />
            <div className="flex-1 min-h-0 relative">
              <ProChart
                ref={chartRef}
                candles={candles}
                onCrosshairMove={handleCrosshairMove}
                className="w-full h-full"
              />
            </div>
          </div>

          {/* Bottom Orders/History/Balance Panel */}
          {!chartFullscreen && (
            <div className="glass-panel rounded-xl overflow-hidden shrink-0" style={{ height: "220px" }}>
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
            }`}
          >
            {/* Order Book + Depth Chart side by side */}
            <div className="flex gap-1.5 min-h-0" style={{ flex: "1 1 0" }}>
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

            {/* Trade Form */}
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

            {/* Trades Feed */}
            <div className="shrink-0" style={{ height: "180px" }}>
              <TradesFeed
                trades={marketTrades}
                base={base}
                onPriceClick={handlePriceClick}
                maxRows={10}
              />
            </div>
          </div>
        )}
      </div>

      {/* Keyboard shortcuts hint */}
      <div className="hidden md:flex items-center justify-center gap-3 text-[9px] text-muted-foreground/60 py-0.5 shrink-0">
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
          <kbd className="px-1 py-0.5 rounded bg-muted/30 border border-border/30">Space</kbd> تبديل الشراء/البيع
        </span>
      </div>
    </div>
  );
}
