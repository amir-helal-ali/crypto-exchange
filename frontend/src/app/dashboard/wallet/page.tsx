"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import {
  Wallet,
  Send,
  ArrowDownToLine,
  Copy,
  Check,
  Loader2,
  TrendingUp,
  Info,
  AlertTriangle,
  ChevronDown,
  Hash,
  Clock,
  CircleDot,
} from "lucide-react";
import { authGet, authPost } from "@/lib/api";

const CURRENCIES = ["BTC", "ETH", "USDT", "BNB", "SOL", "XRP", "ADA", "DOGE", "DOT"];

const CURRENCY_COLORS: Record<string, string> = {
  BTC: "from-orange-500 to-amber-500",
  ETH: "from-blue-400 to-indigo-500",
  USDT: "from-emerald-400 to-teal-500",
  BNB: "from-yellow-400 to-amber-500",
  SOL: "from-purple-400 to-violet-500",
  XRP: "from-sky-400 to-blue-500",
  ADA: "from-cyan-400 to-teal-500",
  DOGE: "from-amber-400 to-yellow-500",
  DOT: "from-pink-400 to-rose-500",
};

const CURRENCY_ICONS: Record<string, string> = {
  BTC: "₿",
  ETH: "Ξ",
  USDT: "₮",
  BNB: "B",
  SOL: "S",
  XRP: "X",
  ADA: "A",
  DOGE: "D",
  DOT: "●",
};

export default function WalletPage() {
  const [balances, setBalances] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [showDeposit, setShowDeposit] = useState(false);
  const [withdrawForm, setWithdrawForm] = useState({ currency: "USDT", amount: "", address: "" });
  const [depositForm, setDepositForm] = useState({ currency: "USDT", amount: "", tx_id: "" });
  const [withdrawLoading, setWithdrawLoading] = useState(false);
  const [depositLoading, setDepositLoading] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [copiedTxId, setCopiedTxId] = useState(false);

  const fetchData = async () => {
    try {
      const [balRes, txRes] = await Promise.all([
        authGet("/api/v1/wallet/balances"),
        authGet("/api/v1/wallet/transactions"),
      ]);
      const balData = await balRes.json();
      const txData = await txRes.json();
      setBalances(Array.isArray(balData) ? balData : Array.isArray(balData.balances) ? balData.balances : []);
      setTransactions(Array.isArray(txData) ? txData : Array.isArray(txData.transactions) ? txData.transactions : []);
    } catch {}
  };

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;
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
        data.forEach((t: any) => {
          if (CURRENCIES.some((c) => `${c}USDT` === t.s)) updates[t.s.replace("USDT", "")] = t.c;
        });
        setPrices((prev) => ({ ...prev, ...updates }));
      }
    };
    return () => ws.close();
  }, []);

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    setWithdrawLoading(true);
    try {
      const res = await authPost("/api/v1/wallet/withdraw", withdrawForm);
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "فشل طلب السحب");
        return;
      }
      toast.success("تم تقديم طلب السحب بنجاح. سيتم مراجعته من قبل الإدارة.");
      setShowWithdraw(false);
      setWithdrawForm({ currency: "USDT", amount: "", address: "" });
      fetchData();
    } catch {
      toast.error("حدث خطأ في الاتصال");
    } finally {
      setWithdrawLoading(false);
    }
  };

  const handleDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    setDepositLoading(true);
    try {
      const res = await authPost("/api/v1/wallet/deposit", depositForm);
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "فشل طلب الإيداع");
        return;
      }
      toast.success("تم تقديم طلب الإيداع بنجاح. سيتم مراجعته وإضافة الرصيد بعد التأكيد.");
      setShowDeposit(false);
      setDepositForm({ currency: "USDT", amount: "", tx_id: "" });
      fetchData();
    } catch {
      toast.error("حدث خطأ في الاتصال");
    } finally {
      setDepositLoading(false);
    }
  };

  const getCurrencyBalance = (currency: string) => {
    const b = balances.find((b: any) => b.currency === currency);
    return b ? parseFloat(b.balance) : 0;
  };

  const totalUSD = CURRENCIES.reduce((sum, currency) => {
    const balance = getCurrencyBalance(currency);
    const usdtPrice = prices[currency] ? parseFloat(prices[currency]) : 0;
    const usdValue = currency === "USDT" ? balance : balance * usdtPrice;
    return sum + usdValue;
  }, 0);

  const getStatusStyle = (status: string) => {
    const s = status?.toUpperCase();
    if (s === "COMPLETED") return { label: "مكتمل", cls: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20" };
    if (s === "PENDING") return { label: "قيد الانتظار", cls: "bg-yellow-500/15 text-yellow-400 border border-yellow-500/20" };
    return { label: "مرفوض", cls: "bg-red-500/15 text-red-400 border border-red-500/20" };
  };

  return (
    <div className="space-y-6">
      {/* ── Header Section ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-slide-in-up">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Wallet className="h-5 w-5 text-white" />
            </div>
            المحفظة
          </h1>
          <p className="text-muted-foreground mt-2 text-sm">إدارة أرصدة العملات الرقمية الخاصة بك</p>
        </div>

        {/* Total Portfolio Value Card */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-l from-emerald-600 via-teal-600 to-emerald-700 p-5 min-w-[220px] shadow-xl shadow-emerald-500/20 animate-scale-in">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.15),transparent_60%)]" />
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-4 w-4 text-emerald-200" />
              <p className="text-sm font-medium text-emerald-100">إجمالي المحفظة</p>
            </div>
            <p className="text-3xl font-bold text-white tabular-nums tracking-tight">${totalUSD.toFixed(2)}</p>
            <p className="text-xs text-emerald-200/70 mt-1">USDT معادل</p>
          </div>
        </div>
      </div>

      {/* ── Currency Grid ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {CURRENCIES.map((currency, idx) => {
          const balance = getCurrencyBalance(currency);
          const usdtPrice = prices[currency] ? parseFloat(prices[currency]) : 0;
          const usdValue = currency === "USDT" ? balance : balance * usdtPrice;
          const portfolioPercent = totalUSD > 0 ? (usdValue / totalUSD) * 100 : 0;
          const gradientColors = CURRENCY_COLORS[currency] || "from-gray-400 to-gray-500";
          const icon = CURRENCY_ICONS[currency] || currency.charAt(0);

          return (
            <div
              key={currency}
              className={`glass-panel-hover rounded-2xl p-5 card-hover animate-slide-in-up`}
              style={{ animationDelay: `${idx * 60}ms`, animationFillMode: "both" }}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div
                    className={`h-11 w-11 rounded-xl bg-gradient-to-br ${gradientColors} flex items-center justify-center text-lg font-bold text-white shadow-lg`}
                  >
                    {icon}
                  </div>
                  <div>
                    <p className="font-bold text-base">{currency}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {currency === "USDT" ? "Tether" : currency === "BTC" ? "Bitcoin" : currency === "ETH" ? "Ethereum" : currency}
                    </p>
                  </div>
                </div>
                {balance > 0 && (
                  <div className="status-dot-online status-dot" />
                )}
              </div>

              <p className="text-2xl font-bold tabular-nums tracking-tight">{balance.toFixed(balance > 0 ? (balance > 1 ? 4 : 8) : 2)}</p>
              <p className="text-xs text-muted-foreground mt-0.5">≈ ${usdValue.toFixed(2)} USD</p>

              {/* Mini progress bar */}
              {balance > 0 && (
                <div className="mt-3">
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
                    <span>نسبة المحفظة</span>
                    <span>{portfolioPercent.toFixed(1)}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted/30 overflow-hidden">
                    <div
                      className={`h-full rounded-full bg-gradient-to-l ${gradientColors} transition-all duration-700`}
                      style={{ width: `${Math.min(portfolioPercent, 100)}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Action Buttons ── */}
      <div className="flex items-center gap-3 animate-slide-in-up" style={{ animationDelay: "200ms" }}>
        <button
          onClick={() => {
            setShowDeposit(!showDeposit);
            setShowWithdraw(false);
          }}
          className={`inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-medium transition-all duration-200 border-2 ${
            showDeposit
              ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/40"
              : "border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 hover:border-emerald-500/50"
          }`}
        >
          <ArrowDownToLine className="h-4 w-4" />
          إيداع
        </button>
        <button
          onClick={() => {
            setShowWithdraw(!showWithdraw);
            setShowDeposit(false);
          }}
          className={`inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
            showWithdraw ? "btn-primary" : "btn-primary"
          }`}
        >
          <Send className="h-4 w-4" />
          سحب
        </button>
      </div>

      {/* ── Deposit Form ── */}
      {showDeposit && (
        <form
          onSubmit={handleDeposit}
          className="glass-panel-strong rounded-2xl p-6 space-y-5 animate-scale-in"
        >
          <div className="flex items-center gap-3 mb-1">
            <div className="h-9 w-9 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <ArrowDownToLine className="h-5 w-5 text-emerald-500" />
            </div>
            <div>
              <h3 className="font-bold text-lg">طلب إيداع</h3>
              <p className="text-xs text-muted-foreground">تحويل عملات رقمية إلى محفظتك</p>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/15 flex items-start gap-3">
            <Info className="h-5 w-5 text-blue-400 shrink-0 mt-0.5" />
            <p className="text-sm text-muted-foreground leading-relaxed">
              قم بتحويل العملات الرقمية إلى محفظتك الخارجية، ثم قدّم طلب إيداع مع إرفاق رقم المعاملة (TxID). سيتم مراجعة الطلب وإضافة الرصيد بعد التأكيد من قبل الإدارة.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2 text-muted-foreground">العملة</label>
              <div className="relative">
                <select
                  className="input-field appearance-none pr-4"
                  value={depositForm.currency}
                  onChange={(e) => setDepositForm({ ...depositForm, currency: e.target.value })}
                >
                  {CURRENCIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <ChevronDown className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2 text-muted-foreground">الكمية</label>
              <input
                type="number"
                step="any"
                className="input-field"
                placeholder="0.00"
                value={depositForm.amount}
                onChange={(e) => setDepositForm({ ...depositForm, amount: e.target.value })}
                required
                min="0.001"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2 text-muted-foreground">رقم المعاملة (TxID)</label>
              <input
                type="text"
                className="input-field"
                placeholder="0xabc123..."
                value={depositForm.tx_id}
                onChange={(e) => setDepositForm({ ...depositForm, tx_id: e.target.value })}
                required
                dir="ltr"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setShowDeposit(false)} className="btn-ghost">إلغاء</button>
            <button
              type="submit"
              disabled={depositLoading}
              className="btn-primary bg-emerald-600 hover:bg-emerald-500 gap-2 min-w-[140px]"
            >
              {depositLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ArrowDownToLine className="h-4 w-4" />
              )}
              {depositLoading ? "جاري المعالجة..." : "تأكيد الإيداع"}
            </button>
          </div>
        </form>
      )}

      {/* ── Withdraw Form ── */}
      {showWithdraw && (
        <form
          onSubmit={handleWithdraw}
          className="glass-panel-strong rounded-2xl p-6 space-y-5 animate-scale-in"
        >
          <div className="flex items-center gap-3 mb-1">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Send className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-bold text-lg">طلب سحب</h3>
              <p className="text-xs text-muted-foreground">سحب عملات رقمية من محفظتك</p>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-yellow-500/5 border border-yellow-500/15 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-yellow-500 shrink-0 mt-0.5" />
            <p className="text-sm text-muted-foreground leading-relaxed">
              سيتم خصم المبلغ من رصيدك فوراً وإنشاء طلب سحب معلق. سيتم معالجة السحب بعد مراجعة الإدارة.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2 text-muted-foreground">العملة</label>
              <div className="relative">
                <select
                  className="input-field appearance-none pr-4"
                  value={withdrawForm.currency}
                  onChange={(e) => setWithdrawForm({ ...withdrawForm, currency: e.target.value })}
                >
                  {CURRENCIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <ChevronDown className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2 text-muted-foreground">الكمية</label>
              <input
                type="number"
                step="any"
                className="input-field"
                placeholder="0.00"
                value={withdrawForm.amount}
                onChange={(e) => setWithdrawForm({ ...withdrawForm, amount: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2 text-muted-foreground">عنوان المحفظة</label>
              <input
                type="text"
                className="input-field"
                placeholder="عنوان المحفظة"
                value={withdrawForm.address}
                onChange={(e) => setWithdrawForm({ ...withdrawForm, address: e.target.value })}
                required
                dir="ltr"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setShowWithdraw(false)} className="btn-ghost">إلغاء</button>
            <button
              type="submit"
              disabled={withdrawLoading}
              className="btn-primary gap-2 min-w-[140px]"
            >
              {withdrawLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              {withdrawLoading ? "جاري المعالجة..." : "تأكيد السحب"}
            </button>
          </div>
        </form>
      )}

      {/* ── Transactions List ── */}
      <div className="glass-panel rounded-2xl overflow-hidden animate-slide-in-up" style={{ animationDelay: "300ms" }}>
        <div className="p-5 border-b border-border/30">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Clock className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="font-bold text-lg">المعاملات</h2>
              <p className="text-xs text-muted-foreground">سجل عمليات الإيداع والسحب</p>
            </div>
          </div>
        </div>

        <div className="p-4">
          {transactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="h-16 w-16 rounded-2xl bg-muted/30 flex items-center justify-center mb-4">
                <CircleDot className="h-8 w-8 text-muted-foreground/40" />
              </div>
              <h3 className="text-base font-semibold mb-1">لا توجد معاملات بعد</h3>
              <p className="text-sm text-muted-foreground">ستظهر معاملاتك هنا بعد إجراء أول عملية إيداع أو سحب</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {transactions.map((tx: any, i: number) => {
                const isDeposit = tx.type === "deposit" || tx.type === "DEPOSIT";
                const statusInfo = getStatusStyle(tx.status);
                const dateStr = new Date(tx.created_at || tx.CreatedAt).toLocaleDateString("ar-EG", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                });
                const timeStr = new Date(tx.created_at || tx.CreatedAt).toLocaleTimeString("ar-EG", {
                  hour: "2-digit",
                  minute: "2-digit",
                });

                return (
                  <div
                    key={i}
                    className="flex items-center gap-4 p-4 rounded-xl bg-background/30 border border-border/30 hover:bg-muted/10 transition-colors"
                  >
                    {/* Type Icon */}
                    <div
                      className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${
                        isDeposit ? "bg-emerald-500/10" : "bg-red-500/10"
                      }`}
                    >
                      {isDeposit ? (
                        <ArrowDownToLine className="h-5 w-5 text-emerald-500" />
                      ) : (
                        <Send className="h-5 w-5 text-red-500" />
                      )}
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold">
                          {isDeposit ? "إيداع" : "سحب"} {tx.currency}
                        </p>
                        <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-medium ${statusInfo.cls}`}>
                          {statusInfo.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Clock className="h-3 w-3 text-muted-foreground" />
                        <p className="text-xs text-muted-foreground">{dateStr} · {timeStr}</p>
                      </div>
                    </div>

                    {/* Amount & Actions */}
                    <div className="text-left flex items-center gap-2 shrink-0">
                      <div>
                        <p
                          className={`text-sm font-bold tabular-nums ${
                            isDeposit ? "text-emerald-400" : "text-red-400"
                          }`}
                        >
                          {isDeposit ? "+" : "-"}
                          {parseFloat(tx.amount || "0").toFixed(8)}
                        </p>
                      </div>
                      {tx.tx_id && (
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(tx.tx_id);
                            setCopiedIndex(i);
                            setTimeout(() => setCopiedIndex(null), 2000);
                          }}
                          className="h-7 w-7 rounded-lg flex items-center justify-center hover:bg-muted/50 transition-colors border border-border/30"
                          title="نسخ TxID"
                        >
                          {copiedIndex === i ? (
                            <Check className="h-3.5 w-3.5 text-emerald-500" />
                          ) : (
                            <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
