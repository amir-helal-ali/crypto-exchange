"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  TrendingUp,
  Wallet,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  ArrowRight,
  Sparkles,
  Plus,
  BarChart3,
  Activity,
  Inbox,
  ChevronLeft,
} from "lucide-react";
import { authGet } from "@/lib/api";

const CURRENCY_NAMES: Record<string, string> = {
  BTC: "بيتكوين",
  ETH: "إيثريوم",
  BNB: "بي إن بي",
  SOL: "سولانا",
  XRP: "إكس آر بي",
  ADA: "كاردانو",
  DOGE: "دوجكوين",
  DOT: "بولكادوت",
  USDT: "تيثر",
};

const CURRENCY_COLORS: Record<string, string> = {
  BTC: "#f7931a",
  ETH: "#627eea",
  BNB: "#f0b90b",
  SOL: "#9945ff",
  USDT: "#26a17b",
  XRP: "#23292f",
  ADA: "#0033ad",
  DOGE: "#c2a633",
  DOT: "#e6007a",
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: "معلق",
  FILLED: "منفذ",
  CANCELLED: "ملغي",
  OPEN: "مفتوح",
  TRIGGERED: "مفعّل",
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  FILLED: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  CANCELLED: "bg-red-500/10 text-red-500 border-red-500/20",
  OPEN: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  TRIGGERED: "bg-purple-500/10 text-purple-500 border-purple-500/20",
};

const MARKET_COINS = [
  { symbol: "BTCUSDT", name: "بيتكوين", short: "BTC" },
  { symbol: "ETHUSDT", name: "إيثريوم", short: "ETH" },
  { symbol: "BNBUSDT", name: "بي إن بي", short: "BNB" },
  { symbol: "SOLUSDT", name: "سولانا", short: "SOL" },
];

export default function DashboardPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [priceChanges, setPriceChanges] = useState<Record<string, string>>({});
  const [balances, setBalances] = useState<any[]>([]);
  const [user, setUser] = useState<any>(null);
  const [currentTime, setCurrentTime] = useState<string>("");
  const [currentDate, setCurrentDate] = useState<string>("");

  // Arabic date/time
  useEffect(() => {
    const update = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString("ar-EG", {
          hour: "2-digit",
          minute: "2-digit",
        })
      );
      setCurrentDate(
        now.toLocaleDateString("ar-EG", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      );
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  // Load user
  useEffect(() => {
    try {
      setUser(JSON.parse(localStorage.getItem("user") || "{}"));
    } catch {}
  }, []);

  // Fetch orders & balances
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;

    Promise.all([
      authGet("/api/v1/exchange/orders").then((r) => r.json()),
      authGet("/api/v1/wallet/balances").then((r) => r.json()),
    ])
      .then(([ordersData, walletData]) => {
        setOrders(
          Array.isArray(ordersData)
            ? ordersData
            : Array.isArray(ordersData.orders)
            ? ordersData.orders
            : Array.isArray(ordersData.data)
            ? ordersData.data
            : []
        );
        setBalances(
          Array.isArray(walletData)
            ? walletData
            : Array.isArray(walletData.balances)
            ? walletData.balances
            : Array.isArray(walletData.data)
            ? walletData.data
            : []
        );
      })
      .catch(() => {});
  }, []);

  // WebSocket for live prices
  useEffect(() => {
    const ws = new WebSocket(
      "wss://stream.binance.com:9443/ws/!miniTicker@arr"
    );
    ws.onmessage = (e) => {
      const data = JSON.parse(e.data);
      if (Array.isArray(data)) {
        const updates: Record<string, string> = {};
        const changeUpdates: Record<string, string> = {};
        data.forEach((t: any) => {
          if (
            [
              "BTCUSDT",
              "ETHUSDT",
              "BNBUSDT",
              "SOLUSDT",
              "XRPUSDT",
              "ADAUSDT",
              "DOGEUSDT",
              "DOTUSDT",
            ].includes(t.s)
          ) {
            updates[t.s] = t.c;
            changeUpdates[t.s] = t.P;
          }
        });
        setPrices((prev) => ({ ...prev, ...updates }));
        setPriceChanges((prev) => ({ ...prev, ...changeUpdates }));
      }
    };
    return () => ws.close();
  }, []);

  // Computed values
  const activeBalances = useMemo(
    () => balances.filter((b) => parseFloat(b.balance || "0") > 0),
    [balances]
  );

  const totalPortfolioUSD = useMemo(() => {
    return balances.reduce((sum, b) => {
      const balance = parseFloat(b.balance || "0");
      if (balance <= 0) return sum;
      const currency = b.currency;
      if (currency === "USDT") return sum + balance;
      const price = prices[`${currency}USDT`];
      if (price) return sum + balance * parseFloat(price);
      return sum;
    }, 0);
  }, [balances, prices]);

  const openOrdersCount = useMemo(
    () =>
      orders.filter(
        (o) => o.status === "OPEN" || o.status === "PENDING"
      ).length,
    [orders]
  );

  const portfolioAllocation = useMemo(() => {
    const items = activeBalances
      .map((b) => {
        const balance = parseFloat(b.balance || "0");
        const currency = b.currency;
        let usdValue = 0;
        if (currency === "USDT") {
          usdValue = balance;
        } else {
          const price = prices[`${currency}USDT`];
          if (price) usdValue = balance * parseFloat(price);
        }
        return { currency, balance, usdValue };
      })
      .filter((item) => item.usdValue > 0)
      .sort((a, b) => b.usdValue - a.usdValue);

    const total = items.reduce((sum, item) => sum + item.usdValue, 0);
    return items.map((item) => ({
      ...item,
      percentage: total > 0 ? (item.usdValue / total) * 100 : 0,
    }));
  }, [activeBalances, prices]);

  const recentOrders = useMemo(() => orders.slice(0, 5), [orders]);

  return (
    <div className="space-y-8">
      {/* ═══════════════════════════════════════════
          WELCOME SECTION
      ═══════════════════════════════════════════ */}
      <div className="animate-slide-in-up">
        <div className="glass-panel rounded-2xl p-6 md:p-8 relative overflow-hidden">
          {/* Decorative background */}
          <div className="absolute top-0 left-0 w-64 h-64 bg-emerald-500/5 rounded-full -translate-x-1/2 -translate-y-1/2 blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 right-0 w-48 h-48 bg-teal-500/5 rounded-full translate-x-1/3 translate-y-1/3 blur-3xl pointer-events-none" />

          <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="status-dot-online" />
                <span>متصل</span>
                <span className="text-border">|</span>
                <span>{currentDate}</span>
                <span className="text-border">|</span>
                <span>{currentTime}</span>
              </div>
              <h1 className="text-3xl md:text-4xl font-bold">
                مرحباً بعودتك،{" "}
                <span className="gradient-text">
                  {user?.username || "المستخدم"}!
                </span>
              </h1>
              <p className="text-muted-foreground">
                إليك نظرة شاملة على محفظتك وأسعار السوق الحية
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <Link href="/dashboard/exchange" className="btn-primary gap-2">
                <TrendingUp className="h-4 w-4" />
                تداول الآن
              </Link>
              <Link
                href="/dashboard/wallet"
                className="btn-ghost gap-2 border border-border/50"
              >
                <Plus className="h-4 w-4" />
                إيداع
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════
          STATS GRID
      ═══════════════════════════════════════════ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Wallet Balance - Emerald */}
        <div className="stat-card stat-card-emerald animate-slide-in-up delay-100 card-hover">
          <div className="flex items-center justify-between mb-4">
            <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <Wallet className="h-5 w-5 text-emerald-500" />
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground/50" />
          </div>
          <p className="text-2xl md:text-3xl font-bold tabular-nums animate-count-up">
            ${totalPortfolioUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            رصيد المحفظة
          </p>
          <p className="text-[10px] text-emerald-500 mt-1">
            {activeBalances.length} أصل نشط
          </p>
        </div>

        {/* Open Orders - Blue */}
        <div className="stat-card stat-card-blue animate-slide-in-up delay-200 card-hover">
          <div className="flex items-center justify-between mb-4">
            <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
              <Activity className="h-5 w-5 text-blue-500" />
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground/50" />
          </div>
          <p className="text-2xl md:text-3xl font-bold tabular-nums animate-count-up">
            {openOrdersCount}
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            طلبات مفتوحة
          </p>
          <p className="text-[10px] text-blue-500 mt-1">
            {openOrdersCount > 0 ? "قيد التنفيذ" : "لا توجد طلبات"}
          </p>
        </div>

        {/* Total Orders - Purple */}
        <div className="stat-card stat-card-purple animate-slide-in-up delay-300 card-hover">
          <div className="flex items-center justify-between mb-4">
            <div className="h-10 w-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
              <Clock className="h-5 w-5 text-purple-500" />
            </div>
            <Link href="/dashboard/history">
              <ArrowRight className="h-4 w-4 text-muted-foreground/50 hover:text-foreground transition-colors" />
            </Link>
          </div>
          <p className="text-2xl md:text-3xl font-bold tabular-nums animate-count-up">
            {orders.length}
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            الطلبات الكلية
          </p>
          <p className="text-[10px] text-purple-500 mt-1">
            إجمالي الصفقات
          </p>
        </div>

        {/* BTC Price - Orange */}
        <div className="stat-card stat-card-orange animate-slide-in-up delay-400 card-hover">
          <div className="flex items-center justify-between mb-4">
            <div className="h-10 w-10 rounded-xl bg-orange-500/10 flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-orange-500" />
            </div>
            <Link href="/dashboard/exchange">
              <ArrowRight className="h-4 w-4 text-muted-foreground/50 hover:text-foreground transition-colors" />
            </Link>
          </div>
          <p className="text-2xl md:text-3xl font-bold tabular-nums animate-count-up">
            {prices["BTCUSDT"]
              ? `$${parseFloat(prices["BTCUSDT"]).toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}`
              : "—"}
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            سعر BTC
          </p>
          <p className={`text-[10px] mt-1 ${
            priceChanges["BTCUSDT"]
              ? parseFloat(priceChanges["BTCUSDT"]) >= 0
                ? "text-emerald-500"
                : "text-red-500"
              : "text-muted-foreground"
          }`}>
            {priceChanges["BTCUSDT"]
              ? `${parseFloat(priceChanges["BTCUSDT"]) >= 0 ? "+" : ""}${parseFloat(priceChanges["BTCUSDT"]).toFixed(2)}%`
              : ""}
          </p>
        </div>
      </div>

      {/* ═══════════════════════════════════════════
          PORTFOLIO CHART + RECENT ORDERS
      ═══════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Portfolio Allocation */}
        <div className="glass-panel rounded-2xl p-6 animate-slide-in-up delay-300">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="font-bold text-lg flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                توزيع المحفظة
              </h2>
            </div>
            <Link
              href="/dashboard/wallet"
              className="text-xs text-primary hover:underline flex items-center gap-1 transition-all hover:gap-2"
            >
              عرض الكل
              <ChevronLeft className="h-3 w-3" />
            </Link>
          </div>

          {/* Total Value */}
          <div className="text-center mb-6">
            <p className="text-sm text-muted-foreground mb-1">
              إجمالي قيمة المحفظة
            </p>
            <p className="text-4xl font-bold gradient-text tabular-nums">
              $
              {totalPortfolioUSD.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </p>
          </div>

          {/* Portfolio Bars */}
          <div className="space-y-3 max-h-72 overflow-y-auto">
            {portfolioAllocation.length > 0 ? (
              portfolioAllocation.slice(0, 6).map((item) => (
                <div key={item.currency} className="group">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2.5">
                      <div
                        className="h-7 w-7 rounded-lg flex items-center justify-center text-[10px] font-bold text-white"
                        style={{
                          backgroundColor:
                            CURRENCY_COLORS[item.currency] || "#6b7280",
                        }}
                      >
                        {item.currency.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-medium">
                          {item.currency}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {CURRENCY_NAMES[item.currency] || item.currency}
                        </p>
                      </div>
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-bold tabular-nums">
                        ${item.usdValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                      <p className="text-[10px] text-muted-foreground tabular-nums">
                        {item.percentage.toFixed(1)}%
                      </p>
                    </div>
                  </div>
                  <div className="w-full h-2 rounded-full bg-muted/30 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700 ease-out"
                      style={{
                        width: `${Math.max(item.percentage, 2)}%`,
                        backgroundColor:
                          CURRENCY_COLORS[item.currency] || "#6b7280",
                        opacity: 0.8,
                      }}
                    />
                  </div>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                <Wallet className="h-10 w-10 mb-3 opacity-30" />
                <p className="text-sm">لا توجد أرصدة في المحفظة</p>
                <Link
                  href="/dashboard/wallet"
                  className="text-xs text-primary hover:underline mt-2"
                >
                  قم بإيداع أموال للبدء
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Recent Orders */}
        <div className="glass-panel rounded-2xl p-6 animate-slide-in-up delay-400">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-bold text-lg flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              آخر الصفقات
            </h2>
            <Link
              href="/dashboard/history"
              className="text-xs text-primary hover:underline flex items-center gap-1 transition-all hover:gap-2"
            >
              عرض الكل
              <ChevronLeft className="h-3 w-3" />
            </Link>
          </div>

          {recentOrders.length > 0 ? (
            <div className="space-y-1 max-h-96 overflow-y-auto">
              {/* Header */}
              <div className="grid grid-cols-12 gap-2 px-3 py-2 text-[10px] text-muted-foreground font-medium border-b border-border/30">
                <div className="col-span-3">الزوج</div>
                <div className="col-span-2">النوع</div>
                <div className="col-span-3 text-center">الكمية</div>
                <div className="col-span-2 text-center">الحالة</div>
                <div className="col-span-2 text-left">السعر</div>
              </div>
              {recentOrders.map((order: any, i: number) => (
                <div
                  key={i}
                  className={`grid grid-cols-12 gap-2 items-center px-3 py-3 rounded-xl transition-colors ${
                    i % 2 === 0 ? "bg-muted/10" : ""
                  } hover:bg-muted/20`}
                >
                  {/* Symbol + Buy/Sell Icon */}
                  <div className="col-span-3 flex items-center gap-2">
                    <div
                      className={`p-1.5 rounded-lg shrink-0 ${
                        order.side === "BUY"
                          ? "bg-emerald-500/10"
                          : "bg-red-500/10"
                      }`}
                    >
                      {order.side === "BUY" ? (
                        <ArrowUpRight className="h-3 w-3 text-emerald-500" />
                      ) : (
                        <ArrowDownRight className="h-3 w-3 text-red-500" />
                      )}
                    </div>
                    <span className="text-xs font-medium truncate">
                      {order.symbol}
                    </span>
                  </div>

                  {/* Type */}
                  <div className="col-span-2">
                    <span
                      className={`text-[10px] font-medium ${
                        order.side === "BUY"
                          ? "text-emerald-500"
                          : "text-red-500"
                      }`}
                    >
                      {order.side === "BUY" ? "شراء" : "بيع"}
                    </span>
                    <p className="text-[10px] text-muted-foreground">
                      {order.type === "MARKET"
                        ? "سوقي"
                        : order.type === "LIMIT"
                        ? "محدد"
                        : order.type === "STOP_LIMIT"
                        ? "وقف"
                        : "جني أرباح"}
                    </p>
                  </div>

                  {/* Quantity */}
                  <div className="col-span-3 text-center">
                    <p className="text-xs font-medium tabular-nums">
                      {parseFloat(order.quantity || "0").toFixed(6)}
                    </p>
                  </div>

                  {/* Status */}
                  <div className="col-span-2 text-center">
                    <span
                      className={`inline-flex text-[10px] px-2 py-0.5 rounded-full border ${
                        STATUS_COLORS[order.status] ||
                        "bg-muted/20 text-muted-foreground border-border/30"
                      }`}
                    >
                      {STATUS_LABELS[order.status] || order.status}
                    </span>
                  </div>

                  {/* Price */}
                  <div className="col-span-2 text-left">
                    <p className="text-xs font-medium tabular-nums">
                      {order.avg_fill_price > 0
                        ? `$${parseFloat(order.avg_fill_price).toFixed(2)}`
                        : order.price
                        ? `$${parseFloat(order.price).toFixed(2)}`
                        : "سوقي"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-14 text-muted-foreground">
              <div className="h-16 w-16 rounded-2xl bg-muted/20 flex items-center justify-center mb-4">
                <Inbox className="h-8 w-8 opacity-40" />
              </div>
              <p className="text-sm font-medium">لا توجد صفقات بعد</p>
              <p className="text-xs mt-1">
                ابدأ التداول الآن واستكشف الأسواق
              </p>
              <Link
                href="/dashboard/exchange"
                className="btn-primary mt-4 gap-2 text-xs"
              >
                <TrendingUp className="h-3.5 w-3.5" />
                تداول الآن
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════
          MARKET OVERVIEW
      ═══════════════════════════════════════════ */}
      <div className="animate-slide-in-up delay-500">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-lg flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            نظرة سريعة على السوق
          </h2>
          <Link
            href="/dashboard/exchange"
            className="text-xs text-primary hover:underline flex items-center gap-1 transition-all hover:gap-2"
          >
            التداول المتقدم
            <ChevronLeft className="h-3 w-3" />
          </Link>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {MARKET_COINS.map((coin) => {
            const price = prices[coin.symbol];
            const change = priceChanges[coin.symbol];
            const isPositive = change ? parseFloat(change) >= 0 : true;
            const changeValue = change ? parseFloat(change) : 0;

            return (
              <Link
                key={coin.symbol}
                href="/dashboard/exchange"
                className="glass-panel-hover rounded-2xl p-5 card-hover relative overflow-hidden group"
              >
                {/* Colored border indicator */}
                <div
                  className={`absolute top-0 right-0 left-0 h-0.5 transition-all duration-300 ${
                    isPositive
                      ? "bg-emerald-500/60"
                      : "bg-red-500/60"
                  }`}
                />

                {/* Background glow */}
                <div
                  className={`absolute top-0 left-0 w-24 h-24 rounded-full blur-3xl pointer-events-none transition-opacity duration-300 opacity-0 group-hover:opacity-100 ${
                    isPositive ? "bg-emerald-500/5" : "bg-red-500/5"
                  }`}
                />

                <div className="relative">
                  {/* Coin header */}
                  <div className="flex items-center gap-3 mb-4">
                    <div
                      className="h-9 w-9 rounded-xl flex items-center justify-center text-xs font-bold text-white"
                      style={{
                        backgroundColor:
                          CURRENCY_COLORS[coin.short] || "#6b7280",
                      }}
                    >
                      {coin.short.charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-bold">{coin.name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {coin.short}
                      </p>
                    </div>
                  </div>

                  {/* Price */}
                  <p className="text-xl font-bold tabular-nums mb-1">
                    {price
                      ? `$${parseFloat(price).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}`
                      : "—"}
                  </p>

                  {/* Change */}
                  <div className="flex items-center justify-between">
                    <div
                      className={`flex items-center gap-1 text-xs font-medium ${
                        isPositive ? "text-emerald-500" : "text-red-500"
                      }`}
                    >
                      {isPositive ? (
                        <ArrowUpRight className="h-3 w-3" />
                      ) : (
                        <ArrowDownRight className="h-3 w-3" />
                      )}
                      <span className="tabular-nums">
                        {change
                          ? `${changeValue >= 0 ? "+" : ""}${changeValue.toFixed(2)}%`
                          : "0.00%"}
                      </span>
                    </div>

                    {/* Mini sparkline placeholder */}
                    <div className="w-16 h-6 flex items-end gap-[2px]">
                      {[40, 65, 45, 70, 55, 80, 60, 75, 50, 85].map(
                        (h, idx) => (
                          <div
                            key={idx}
                            className={`flex-1 rounded-t-sm transition-all duration-300 ${
                              isPositive
                                ? "bg-emerald-500/30"
                                : "bg-red-500/30"
                            }`}
                            style={{
                              height: `${h}%`,
                              opacity: 0.4 + (idx / 10) * 0.6,
                            }}
                          />
                        )
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
