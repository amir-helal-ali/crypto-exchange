"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Wallet, Send, ArrowDownToLine, Copy, Check } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

const CURRENCIES = ["BTC", "ETH", "USDT", "BNB", "SOL", "XRP", "ADA", "DOGE", "DOT"];

export default function WalletPage() {
  const [balances, setBalances] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [withdrawForm, setWithdrawForm] = useState({ currency: "USDT", amount: "", address: "" });
  const [withdrawLoading, setWithdrawLoading] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;

    const fetchData = () => {
      fetch(`${API}/api/wallet/balances`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json()).then(d => setBalances(Array.isArray(d) ? d : Array.isArray(d.balances) ? d.balances : [])).catch(() => {});
      fetch(`${API}/api/wallet/transactions`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json()).then(d => setTransactions(Array.isArray(d) ? d : Array.isArray(d.transactions) ? d.transactions : [])).catch(() => {});
    };
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const ws = new WebSocket("wss://stream.binance.com:9443/ws/!miniTicker@arr");
    ws.onmessage = (e) => {
      const data = JSON.parse(e.data);
      if (Array.isArray(data)) {
        const updates: Record<string, string> = {};
        data.forEach((t: any) => { if (CURRENCIES.some(c => `${c}USDT` === t.s)) updates[t.s.replace("USDT", "")] = t.c; });
        setPrices(prev => ({ ...prev, ...updates }));
      }
    };
    return () => ws.close();
  }, []);

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = localStorage.getItem("token");
    if (!token) { toast.error("يرجى تسجيل الدخول"); return; }
    setWithdrawLoading(true);
    try {
      const res = await fetch(`${API}/api/wallet/withdraw`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(withdrawForm),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "فشل طلب السحب"); return; }
      toast.success("تم تقديم طلب السحب بنجاح");
      setShowWithdraw(false);
      setWithdrawForm({ currency: "USDT", amount: "", address: "" });
      fetch(`${API}/api/wallet/balances`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()).then(d => setBalances(Array.isArray(d) ? d : Array.isArray(d.balances) ? d.balances : [])).catch(() => {});
      fetch(`${API}/api/wallet/transactions`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()).then(d => setTransactions(Array.isArray(d) ? d : Array.isArray(d.transactions) ? d.transactions : [])).catch(() => {});
    } catch { toast.error("حدث خطأ في الاتصال"); }
    finally { setWithdrawLoading(false); }
  };

  const getCurrencyBalance = (currency: string) => {
    const b = balances.find((b: any) => b.currency === currency);
    return b ? parseFloat(b.balance) : 0;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">المحفظة</h1>
        <p className="text-muted-foreground mt-1">إدارة أرصدة العملات الرقمية الخاصة بك</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {CURRENCIES.map(currency => {
          const balance = getCurrencyBalance(currency);
          const usdtPrice = prices[currency] ? parseFloat(prices[currency]) : 0;
          const usdValue = currency === "USDT" ? balance : balance * usdtPrice;
          return (
            <div key={currency} className="glass-panel rounded-2xl p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">{currency.charAt(0)}</div>
                  <div>
                    <p className="font-bold">{currency}</p>
                  </div>
                </div>
                <div className={`p-1.5 rounded-lg ${balance > 0 ? "bg-emerald-500/10" : "bg-muted/30"}`}>
                  <Wallet className={`h-4 w-4 ${balance > 0 ? "text-emerald-500" : "text-muted-foreground"}`} />
                </div>
              </div>
              <p className="text-2xl font-bold tabular-nums">{balance.toFixed(8)}</p>
              <p className="text-xs text-muted-foreground mt-1">≈ ${usdValue.toFixed(2)} USD</p>
            </div>
          );
        })}
      </div>

      <div className="glass-panel rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-lg">المعاملات</h2>
          <button onClick={() => setShowWithdraw(!showWithdraw)} className="btn-primary text-sm gap-2">
            <Send className="h-4 w-4" /> سحب
          </button>
        </div>

        {showWithdraw && (
          <form onSubmit={handleWithdraw} className="glass-panel-strong rounded-2xl p-5 mb-6 space-y-4">
            <h3 className="font-bold">طلب سحب</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs text-muted-foreground mb-1">العملة</label>
                <select className="input-field" value={withdrawForm.currency} onChange={e => setWithdrawForm({ ...withdrawForm, currency: e.target.value })}>
                  {CURRENCIES.filter(c => c !== "USDT" || true).map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">الكمية</label>
                <input type="number" step="any" className="input-field" placeholder="0.00" value={withdrawForm.amount} onChange={e => setWithdrawForm({ ...withdrawForm, amount: e.target.value })} required />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">عنوان المحفظة</label>
                <input type="text" className="input-field" placeholder="عنوان المحفظة" value={withdrawForm.address} onChange={e => setWithdrawForm({ ...withdrawForm, address: e.target.value })} required />
              </div>
            </div>
            <div className="flex justify-end">
              <button type="submit" disabled={withdrawLoading} className="btn-primary">
                {withdrawLoading ? <span className="spinner h-4 w-4" /> : <Send className="h-4 w-4" />}
                {withdrawLoading ? "جاري المعالجة..." : "تأكيد السحب"}
              </button>
            </div>
          </form>
        )}

        <div className="space-y-2">
          {transactions.map((tx: any, i: number) => (
            <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-muted/20">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${tx.type === "DEPOSIT" ? "bg-emerald-500/10" : "bg-red-500/10"}`}>
                  {tx.type === "DEPOSIT" ? <ArrowDownToLine className="h-4 w-4 text-emerald-500" /> : <Send className="h-4 w-4 text-red-500" />}
                </div>
                <div>
                  <p className="text-sm font-medium">{tx.type === "DEPOSIT" ? "إيداع" : "سحب"} {tx.currency}</p>
                  <p className="text-[10px] text-muted-foreground">{new Date(tx.created_at || tx.CreatedAt).toLocaleDateString("ar-EG")}</p>
                </div>
              </div>
              <div className="text-left flex items-center gap-3">
                <div>
                  <p className={`text-sm font-bold tabular-nums ${tx.type === "DEPOSIT" ? "text-emerald-500" : "text-red-500"}`}>
                    {tx.type === "DEPOSIT" ? "+" : "-"}{parseFloat(tx.amount || "0").toFixed(8)}
                  </p>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${tx.status === "COMPLETED" ? "bg-emerald-500/10 text-emerald-500" : tx.status === "PENDING" ? "bg-yellow-500/10 text-yellow-500" : "bg-red-500/10 text-red-500"}`}>
                    {tx.status === "COMPLETED" ? "مكتمل" : tx.status === "PENDING" ? "قيد الانتظار" : "فشل"}
                  </span>
                </div>
                {tx.tx_id && (
                  <button onClick={() => { navigator.clipboard.writeText(tx.tx_id); setCopiedIndex(i); setTimeout(() => setCopiedIndex(null), 2000); }} className="p-1.5 rounded-lg hover:bg-muted/50 transition-all">
                    {copiedIndex === i ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5 text-muted-foreground" />}
                  </button>
                )}
              </div>
            </div>
          ))}
          {transactions.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">لا توجد معاملات بعد</p>}
        </div>
      </div>
    </div>
  );
}
