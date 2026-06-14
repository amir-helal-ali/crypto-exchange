"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { TrendingUp, Wallet, Clock, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { authGet } from "@/lib/api";

export default function DashboardPage() {
  const [stats, setStats] = useState({ totalOrders: 0, totalWallets: 0 });
  const [orders, setOrders] = useState<any[]>([]);
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [balances, setBalances] = useState<any[]>([]);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;

    Promise.all([
      authGet("/api/v1/exchange/orders").then(r => r.json()),
      authGet("/api/v1/wallet/balances").then(r => r.json()),
    ]).then(([ordersData, walletData]) => {
      setOrders(Array.isArray(ordersData) ? ordersData : Array.isArray(ordersData.orders) ? ordersData.orders : []);
      setBalances(Array.isArray(walletData) ? walletData : Array.isArray(walletData.balances) ? walletData.balances : []);
    }).catch(() => {});

    const ws = new WebSocket("wss://stream.binance.com:9443/ws/!miniTicker@arr");
    ws.onmessage = (e) => {
      const data = JSON.parse(e.data);
      if (Array.isArray(data)) {
        const updates: Record<string, string> = {};
        data.forEach((t: any) => { if (["BTCUSDT", "ETHUSDT", "BNBUSDT", "SOLUSDT"].includes(t.s)) updates[t.s] = t.c; });
        setPrices(prev => ({ ...prev, ...updates }));
      }
    };
    return () => ws.close();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">لوحة التحكم</h1>
        <p className="text-muted-foreground mt-1">مرحباً بعودتك! إليك نظرة سريعة على حسابك.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "رصيد المحفظة", value: `${balances.filter(b => parseFloat(b.balance || "0") > 0).length || 0} أصول`, icon: Wallet, color: "text-emerald-500", bg: "bg-emerald-500/10" },
          { label: "طلبات مفتوحة", value: orders.filter(o => o.status === "OPEN" || o.status === "PENDING").length.toString(), icon: TrendingUp, color: "text-blue-500", bg: "bg-blue-500/10" },
          { label: "الطلبات الكلية", value: orders.length.toString(), icon: Clock, color: "text-purple-500", bg: "bg-purple-500/10" },
          { label: "BTC", value: prices["BTCUSDT"] ? `$${parseFloat(prices["BTCUSDT"]).toLocaleString()}` : "—", icon: TrendingUp, color: "text-orange-500", bg: "bg-orange-500/10" },
        ].map((item, i) => {
          const Icon = item.icon;
          return (
            <div key={i} className="glass-panel rounded-2xl p-5">
              <div className={`inline-flex p-2.5 rounded-xl ${item.bg} mb-3`}><Icon className={`h-5 w-5 ${item.color}`} /></div>
              <p className="text-2xl font-bold">{item.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{item.label}</p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-panel rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-lg">آخر الصفقات</h2>
            <Link href="/dashboard/history" className="text-sm text-primary hover:underline">عرض الكل</Link>
          </div>
          {orders.slice(0, 5).map((order: any, i: number) => (
            <div key={i} className="flex items-center justify-between py-3 border-b border-border/30 last:border-0">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${order.side === "BUY" ? "bg-emerald-500/10" : "bg-red-500/10"}`}>
                  {order.side === "BUY" ? <ArrowUpRight className="h-4 w-4 text-emerald-500" /> : <ArrowDownRight className="h-4 w-4 text-red-500" />}
                </div>
                <div>
                  <p className="text-sm font-medium">{order.symbol}</p>
                  <p className="text-xs text-muted-foreground">{order.type || "MARKET"}</p>
                </div>
              </div>
              <div className="text-left">
                <p className={`text-sm font-medium tabular-nums ${order.side === "BUY" ? "text-emerald-500" : "text-red-500"}`}>
                  {order.side === "BUY" ? "شراء" : "بيع"} {parseFloat(order.quantity || "0").toFixed(6)}
                </p>
                <p className="text-[10px] text-muted-foreground">{order.status}</p>
              </div>
            </div>
          ))}
          {orders.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">لا توجد صفقات بعد</p>}
        </div>

        <div className="glass-panel rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-lg">أرصدة المحفظة</h2>
            <Link href="/dashboard/wallet" className="text-sm text-primary hover:underline">عرض الكل</Link>
          </div>
          {balances.filter((b: any) => parseFloat(b.balance || "0") > 0).slice(0, 5).map((bal: any, i: number) => (
            <div key={i} className="flex items-center justify-between py-3 border-b border-border/30 last:border-0">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">{bal.currency?.charAt(0) || "?"}</div>
                <div>
                  <p className="text-sm font-medium">{bal.currency}</p>
                </div>
              </div>
              <div className="text-left">
                <p className="text-sm font-bold tabular-nums">{parseFloat(bal.balance || "0").toFixed(8)}</p>
                <p className="text-[10px] text-muted-foreground">{bal.currency === "USDT" ? `${(parseFloat(bal.balance || "0")).toFixed(2)} USD` : prices[`${bal.currency}USDT`] ? `$${(parseFloat(prices[`${bal.currency}USDT`]) * parseFloat(bal.balance)).toFixed(2)}` : ""}</p>
              </div>
            </div>
          ))}
          {balances.filter((b: any) => parseFloat(b.balance || "0") > 0).length === 0 && <p className="text-sm text-muted-foreground text-center py-8">لا توجد أرصدة</p>}
        </div>
      </div>
    </div>
  );
}
