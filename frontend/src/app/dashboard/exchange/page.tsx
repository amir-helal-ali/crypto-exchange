"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import toast from "react-hot-toast";
import { TrendingUp, TrendingDown, ArrowUpDown } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

const PAIRS = ["BTCUSDT", "ETHUSDT", "BNBUSDT", "SOLUSDT", "XRPUSDT", "ADAUSDT", "DOGEUSDT", "DOTUSDT"];

const CURRENCY_NAMES: Record<string, string> = {
  BTC: "بيتكوين", ETH: "إيثريوم", BNB: "بي إن بي", SOL: "سولانا",
  XRP: "إكس آر بي", ADA: "كاردانو", DOGE: "دوجكوين", DOT: "بولكادوت",
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: "معلق",
  FILLED: "منفذ",
  CANCELLED: "ملغي",
  TRIGGERED: "مفعّل",
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: "text-yellow-500",
  FILLED: "text-emerald-500",
  CANCELLED: "text-red-500",
  TRIGGERED: "text-blue-500",
};

export default function ExchangePage() {
  const [selectedPair, setSelectedPair] = useState("BTCUSDT");
  const [prices, setPrices] = useState<Record<string, any>>({});
  const [orderBook, setOrderBook] = useState<{ bids: [string, string][]; asks: [string, string][] }>({ bids: [], asks: [] });
  const [klines, setKlines] = useState<any[]>([]);
  const [side, setSide] = useState<"BUY" | "SELL">("BUY");
  const [orderType, setOrderType] = useState<"MARKET" | "LIMIT" | "STOP_LIMIT" | "TAKE_PROFIT">("MARKET");
  const [form, setForm] = useState({ quantity: "", price: "", stopPrice: "" });
  const [orders, setOrders] = useState<any[]>([]);
  const [wallets, setWallets] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const prevPrices = useRef<Record<string, number>>({});

  const fetchOrders = useCallback(() => {
    const token = localStorage.getItem("token");
    if (!token) return;
    fetch(`${API}/api/exchange/orders`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => {
        const data = d.data;
        setOrders(Array.isArray(data) ? data : []);
      }).catch(() => {});
  }, []);

  const fetchWallets = useCallback(() => {
    const token = localStorage.getItem("token");
    if (!token) return;
    fetch(`${API}/api/wallet/balances`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => {
        const data = d.data;
        setWallets(Array.isArray(data) ? data : []);
      }).catch(() => {});
  }, []);

  useEffect(() => {
    fetchOrders();
    fetchWallets();
  }, [fetchOrders, fetchWallets]);

  useEffect(() => {
    const ws = new WebSocket("wss://stream.binance.com:9443/ws");
    const streams = [`${selectedPair.toLowerCase()}@ticker`, `${selectedPair.toLowerCase()}@depth20@100ms`, `${selectedPair.toLowerCase()}@kline_1m`];
    ws.onopen = () => ws.send(JSON.stringify({ method: "SUBSCRIBE", params: streams, id: 1 }));
    ws.onmessage = (e) => {
      const d = JSON.parse(e.data);
      if (d.e === "24hrTicker") {
        prevPrices.current[selectedPair] = prices[selectedPair]?.price || parseFloat(d.c);
        setPrices((prev: any) => ({ ...prev, [selectedPair]: { price: parseFloat(d.c), high: parseFloat(d.h), low: parseFloat(d.l), volume: d.v, change: d.P } }));
      } else if (d.e === "depthUpdate") {
        if (d.bids) setOrderBook({ bids: d.bids.slice(0, 10), asks: d.asks.slice(0, 10) });
      }
    };
    wsRef.current = ws;
    return () => ws.close();
  }, [selectedPair]);

  useEffect(() => {
    const fetchKlines = async () => {
      try {
        const res = await fetch(`https://api.binance.com/api/v3/klines?symbol=${selectedPair}&interval=1m&limit=100`);
        if (!res.ok) return;
        const data = await res.json();
        setKlines(data.map((k: any) => ({ time: Math.floor(k[0] / 1000), open: parseFloat(k[1]), high: parseFloat(k[2]), low: parseFloat(k[3]), close: parseFloat(k[4]), volume: parseFloat(k[5]) })));
      } catch {}
    };
    fetchKlines();
    const interval = setInterval(fetchKlines, 30000);
    return () => clearInterval(interval);
  }, [selectedPair]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || klines.length === 0) return;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr; canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    const w = rect.width, h = rect.height;
    ctx.clearRect(0, 0, w, h);

    const high = Math.max(...klines.map(k => k.high));
    const low = Math.min(...klines.map(k => k.low));
    const range = high - low || 1;
    const candleW = Math.min((w - 20) / klines.length, 8);
    const gap = Math.max((w - 20 - candleW * klines.length) / (klines.length - 1), 0.5);

    klines.forEach((k, i) => {
      const x = 10 + i * (candleW + gap);
      const isUp = k.close >= k.open;
      const color = isUp ? "#10b981" : "#ef4444";
      const top = h - 10 - ((Math.max(k.open, k.close) - low) / range) * (h - 20);
      const bottom = h - 10 - ((Math.min(k.open, k.close) - low) / range) * (h - 20);
      const bodyH = Math.max(bottom - top, 1);

      ctx.strokeStyle = color; ctx.lineWidth = 1;
      const wickTop = h - 10 - ((k.high - low) / range) * (h - 20);
      const wickBottom = h - 10 - ((k.low - low) / range) * (h - 20);
      ctx.beginPath(); ctx.moveTo(x + candleW / 2, wickTop); ctx.lineTo(x + candleW / 2, wickBottom); ctx.stroke();

      ctx.fillStyle = color;
      ctx.fillRect(x, top, candleW, bodyH);
    });
  }, [klines]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = localStorage.getItem("token");
    if (!token) { toast.error("يرجى تسجيل الدخول أولاً"); return; }
    setLoading(true);
    try {
      const body: any = { symbol: selectedPair, side, type: orderType, quantity: form.quantity };
      if (orderType === "LIMIT" || orderType === "STOP_LIMIT") body.price = form.price;
      if (orderType === "STOP_LIMIT" || orderType === "TAKE_PROFIT") body.stop_price = form.stopPrice;
      const res = await fetch(`${API}/api/exchange/order`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "فشل تنفيذ الأمر"); return; }
      toast.success(data.message || "تم تنفيذ الأمر بنجاح");
      setForm({ quantity: "", price: "", stopPrice: "" });
      fetchOrders();
      fetchWallets();
    } catch { toast.error("حدث خطأ في الاتصال"); }
    finally { setLoading(false); }
  };

  const handleCancel = async (orderId: number) => {
    const token = localStorage.getItem("token");
    if (!token) return;
    try {
      const res = await fetch(`${API}/api/exchange/order/${orderId}/cancel`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "فشل إلغاء الأمر"); return; }
      toast.success(data.message || "تم إلغاء الأمر بنجاح");
      fetchOrders();
      fetchWallets();
    } catch { toast.error("حدث خطأ في الاتصال"); }
  };

  const base = selectedPair.replace("USDT", "");
  const p = prices[selectedPair];
  const prevPrice = prevPrices.current[selectedPair];
  const priceColor = p && prevPrice ? (p.price >= prevPrice ? "text-emerald-500" : "text-red-500") : "text-foreground";

  const baseWallet = wallets.find((w: any) => w.currency === base);
  const quoteWallet = wallets.find((w: any) => w.currency === "USDT");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">التداول</h1>
        <p className="text-muted-foreground mt-1">تداول العملات الرقمية مع بيانات حية من Binance</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {PAIRS.map(pair => (
          <button key={pair} onClick={() => setSelectedPair(pair)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${selectedPair === pair ? "bg-primary text-primary-foreground" : "bg-muted/30 text-muted-foreground hover:bg-muted/50"}`}>
            {pair.replace("USDT", "")}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="glass-panel rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold">{CURRENCY_NAMES[base] || base} / USDT</h2>
                <p className={`text-3xl font-bold tabular-nums ${priceColor}`}>{p?.price?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 }) || "—"}</p>
              </div>
              {p && <div className="text-left text-xs text-muted-foreground space-y-1"><p>أعلى: {p.high?.toLocaleString()}</p><p>أدنى: {p.low?.toLocaleString()}</p><p>حجم: {(p.volume / 1000).toFixed(1)}K</p></div>}
            </div>
            <div className="h-64 w-full bg-muted/20 rounded-xl overflow-hidden">
              <canvas ref={canvasRef} className="w-full h-full" />
            </div>
          </div>

          <div className="glass-panel rounded-2xl p-5">
            <div className="flex items-center gap-4 mb-4">
              <h2 className="font-bold">أمر تداول</h2>
              <div className="flex gap-1">
                {(["BUY", "SELL"] as const).map(s => (
                  <button key={s} onClick={() => setSide(s)} className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${side === s ? (s === "BUY" ? "bg-emerald-500 text-white" : "bg-red-500 text-white") : "bg-muted/30 text-muted-foreground"}`}>
                    {s === "BUY" ? "شراء" : "بيع"}
                  </button>
                ))}
              </div>
            </div>

            {/* Available balance display */}
            <div className="mb-4 p-3 rounded-xl bg-muted/20 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">رصيد {base} المتاح:</span>
                <span className="font-medium tabular-nums">{baseWallet?.balance ? parseFloat(baseWallet.balance).toFixed(8) : "0.00000000"} {base}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">رصيد USDT المتاح:</span>
                <span className="font-medium tabular-nums">{quoteWallet?.balance ? parseFloat(quoteWallet.balance).toFixed(2) : "0.00"} USDT</span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
              {(["MARKET", "LIMIT", "STOP_LIMIT", "TAKE_PROFIT"] as const).map(t => (
                <button key={t} onClick={() => setOrderType(t)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${orderType === t ? "bg-primary/20 text-primary border border-primary/30" : "bg-muted/20 text-muted-foreground border border-border/30"}`}>
                  {t === "MARKET" ? "سوقي" : t === "LIMIT" ? "محدد" : t === "STOP_LIMIT" ? "وقف محدد" : "جني أرباح"}
                </button>
              ))}
            </div>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs text-muted-foreground mb-1">الكمية ({base})</label><input type="number" step="any" className="input-field" placeholder="0.00" value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })} required /></div>
                {(orderType === "LIMIT" || orderType === "STOP_LIMIT") && <div><label className="block text-xs text-muted-foreground mb-1">السعر (USDT)</label><input type="number" step="any" className="input-field" placeholder="0.00" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} required /></div>}
                {(orderType === "STOP_LIMIT" || orderType === "TAKE_PROFIT") && <div><label className="block text-xs text-muted-foreground mb-1">سعر الإيقاف (USDT)</label><input type="number" step="any" className="input-field" placeholder="0.00" value={form.stopPrice} onChange={e => setForm({ ...form, stopPrice: e.target.value })} required /></div>}
              </div>

              {/* Estimated cost/proceeds display */}
              {form.quantity && parseFloat(form.quantity) > 0 && (
                <div className="p-2 rounded-lg bg-muted/10 text-[11px] text-muted-foreground">
                  {side === "BUY" ? (
                    <span>التكلفة التقديرية: {((orderType === "MARKET" ? p?.price : parseFloat(form.price || "0")) * parseFloat(form.quantity)).toFixed(2)} USDT</span>
                  ) : (
                    <span>القيمة التقديرية: {((orderType === "MARKET" ? p?.price : parseFloat(form.price || "0")) * parseFloat(form.quantity)).toFixed(2)} USDT</span>
                  )}
                </div>
              )}

              <button type="submit" disabled={loading} className={`btn-primary w-full ${side === "SELL" ? "!bg-red-500 hover:!bg-red-500/90" : ""}`}>
                {loading ? <span className="spinner h-4 w-4" /> : <ArrowUpDown className="h-4 w-4" />}
                {loading ? "جاري التنفيذ..." : `${side === "BUY" ? "شراء" : "بيع"} ${base}`}
              </button>
            </form>
          </div>
        </div>

        <div className="space-y-4">
          <div className="glass-panel rounded-2xl p-5">
            <h3 className="font-bold text-sm mb-3">دفتر الأوامر</h3>
            <div className="space-y-0.5">
              {orderBook.asks?.slice(0).reverse().map((ask: any, i: number) => (
                <div key={i} className="flex items-center justify-between text-xs py-1">
                  <span className="text-red-500 font-medium tabular-nums">{parseFloat(ask[0]).toFixed(2)}</span>
                  <span className="text-muted-foreground tabular-nums">{parseFloat(ask[1]).toFixed(6)}</span>
                </div>
              ))}
              <div className="border-t border-border/50 my-2 pt-2 flex items-center justify-between text-sm font-bold">
                <span className={p && prevPrice ? (p.price >= prevPrice ? "text-emerald-500" : "text-red-500") : ""}>
                  {p?.price?.toFixed(2) || "—"}
                </span>
                <span className="text-xs text-muted-foreground">{p?.change ? `${parseFloat(p.change) >= 0 ? "+" : ""}${p.change}%` : ""}</span>
              </div>
              {orderBook.bids?.slice(0, 10).map((bid: any, i: number) => (
                <div key={i} className="flex items-center justify-between text-xs py-1">
                  <span className="text-emerald-500 font-medium tabular-nums">{parseFloat(bid[0]).toFixed(2)}</span>
                  <span className="text-muted-foreground tabular-nums">{parseFloat(bid[1]).toFixed(6)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-panel rounded-2xl p-5">
            <h3 className="font-bold text-sm mb-3">طلباتي</h3>
            {orders.slice(0, 10).map((order: any, i: number) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-border/20 last:border-0">
                <div>
                  <p className="text-xs font-medium">{order.symbol}</p>
                  <p className={`text-[10px] ${order.side === "BUY" ? "text-emerald-500" : "text-red-500"}`}>
                    {order.side === "BUY" ? "شراء" : "بيع"} · {order.type === "MARKET" ? "سوقي" : order.type === "LIMIT" ? "محدد" : order.type === "STOP_LIMIT" ? "وقف" : "جني أرباح"}
                  </p>
                </div>
                <div className="text-left">
                  <p className="text-xs font-medium tabular-nums">{parseFloat(order.quantity || "0").toFixed(6)}</p>
                  <p className={`text-[10px] ${STATUS_COLORS[order.status] || "text-muted-foreground"}`}>
                    {STATUS_LABELS[order.status] || order.status}
                    {order.avg_fill_price > 0 && <span className="text-muted-foreground"> @ {parseFloat(order.avg_fill_price).toFixed(2)}</span>}
                  </p>
                </div>
                {order.status === "PENDING" && (
                  <button
                    onClick={() => handleCancel(order.id)}
                    className="text-[10px] px-2 py-1 rounded bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-all"
                  >
                    إلغاء
                  </button>
                )}
              </div>
            ))}
            {orders.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">لا توجد طلبات</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
