"use client";

import { useEffect, useState, Fragment } from "react";
import { useRouter } from "next/navigation";
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
  X,
  ArrowRight,
  Shield,
  Zap,
} from "lucide-react";
import { authGet } from "@/lib/api";

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

const CURRENCY_NAMES: Record<string, string> = {
  BTC: "Bitcoin",
  ETH: "Ethereum",
  USDT: "Tether",
  BNB: "BNB",
  SOL: "Solana",
  XRP: "Ripple",
  ADA: "Cardano",
  DOGE: "Dogecoin",
  DOT: "Polkadot",
};

const CURRENCY_NETWORKS: Record<string, { name: string; network: string; address_example: string }[]> = {
  BTC: [
    { name: "Bitcoin", network: "BTC", address_example: "bc1q..." },
    { name: "BEP20", network: "BSC", address_example: "0x..." },
  ],
  ETH: [
    { name: "Ethereum (ERC20)", network: "ERC20", address_example: "0x..." },
    { name: "BEP20", network: "BSC", address_example: "0x..." },
    { name: "Arbitrum", network: "ARB", address_example: "0x..." },
  ],
  USDT: [
    { name: "Ethereum (ERC20)", network: "ERC20", address_example: "0x..." },
    { name: "TRC20", network: "TRC20", address_example: "T..." },
    { name: "BEP20", network: "BSC", address_example: "0x..." },
    { name: "Solana", network: "SOL", address_example: "..." },
  ],
  BNB: [
    { name: "BEP20", network: "BSC", address_example: "0x..." },
  ],
  SOL: [
    { name: "Solana", network: "SOL", address_example: "..." },
  ],
  XRP: [
    { name: "XRP Ledger", network: "XRP", address_example: "r..." },
  ],
  ADA: [
    { name: "Cardano", network: "ADA", address_example: "addr1..." },
  ],
  DOGE: [
    { name: "Dogecoin", network: "DOGE", address_example: "D..." },
  ],
  DOT: [
    { name: "Polkadot", network: "DOT", address_example: "15..." },
  ],
};

export default function WalletPage() {
  const router = useRouter();
  const [balances, setBalances] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  // Modal states
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);

  // Deposit modal form
  const [depositForm, setDepositForm] = useState({
    currency: "USDT",
    network: "",
    amount: "",
    tx_id: "",
  });

  // Withdraw modal form
  const [withdrawForm, setWithdrawForm] = useState({
    currency: "USDT",
    network: "",
    amount: "",
    address: "",
  });

  // Initialize network when currency changes
  const getFirstNetwork = (currency: string) => {
    const networks = CURRENCY_NETWORKS[currency];
    return networks && networks.length > 0 ? networks[0].network : "";
  };

  // Fetch data
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

  // Deposit modal handlers
  const openDepositModal = () => {
    const firstNetwork = getFirstNetwork("USDT");
    setDepositForm({ currency: "USDT", network: firstNetwork, amount: "", tx_id: "" });
    setShowDepositModal(true);
    setShowWithdrawModal(false);
  };

  const handleDepositCurrencyChange = (currency: string) => {
    const firstNetwork = getFirstNetwork(currency);
    setDepositForm({ ...depositForm, currency, network: firstNetwork });
  };

  const handleDepositContinue = () => {
    if (!depositForm.currency || !depositForm.network || !depositForm.amount || parseFloat(depositForm.amount) <= 0) {
      toast.error("يرجى ملء جميع الحقول المطلوبة");
      return;
    }
    const params = new URLSearchParams({
      network: depositForm.network,
      amount: depositForm.amount,
    });
    if (depositForm.tx_id) params.set("tx_id", depositForm.tx_id);
    setShowDepositModal(false);
    router.push(`/dashboard/wallet/deposit/${depositForm.currency}?${params.toString()}`);
  };

  // Withdraw modal handlers
  const openWithdrawModal = () => {
    const firstNetwork = getFirstNetwork("USDT");
    setWithdrawForm({ currency: "USDT", network: firstNetwork, amount: "", address: "" });
    setShowWithdrawModal(true);
    setShowDepositModal(false);
  };

  const handleWithdrawCurrencyChange = (currency: string) => {
    const firstNetwork = getFirstNetwork(currency);
    setWithdrawForm({ ...withdrawForm, currency, network: firstNetwork });
  };

  const handleWithdrawContinue = () => {
    if (!withdrawForm.currency || !withdrawForm.network || !withdrawForm.amount || parseFloat(withdrawForm.amount) <= 0) {
      toast.error("يرجى ملء جميع الحقول المطلوبة");
      return;
    }
    if (!withdrawForm.address) {
      toast.error("يرجى إدخال عنوان المحفظة");
      return;
    }
    const params = new URLSearchParams({
      network: withdrawForm.network,
      amount: withdrawForm.amount,
      address: withdrawForm.address,
    });
    setShowWithdrawModal(false);
    router.push(`/dashboard/wallet/withdraw/${withdrawForm.currency}?${params.toString()}`);
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

      {/* ── Action Buttons (TOP) ── */}
      <div className="grid grid-cols-2 gap-4 animate-slide-in-up" style={{ animationDelay: "100ms", animationFillMode: "both" }}>
        <button
          onClick={openDepositModal}
          className="group relative overflow-hidden rounded-2xl glass-panel p-5 flex items-center gap-4 hover:bg-emerald-500/5 transition-all duration-300 border-2 border-transparent hover:border-emerald-500/20"
        >
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20 group-hover:scale-110 transition-transform">
            <ArrowDownToLine className="h-6 w-6 text-white" />
          </div>
          <div className="text-right flex-1">
            <p className="font-bold text-base">إيداع</p>
            <p className="text-xs text-muted-foreground mt-0.5">تحويل عملات إلى محفظتك</p>
          </div>
          <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-emerald-400 group-hover:translate-x-[-4px] transition-all" />
        </button>

        <button
          onClick={openWithdrawModal}
          className="group relative overflow-hidden rounded-2xl glass-panel p-5 flex items-center gap-4 hover:bg-red-500/5 transition-all duration-300 border-2 border-transparent hover:border-red-500/20"
        >
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center shadow-lg shadow-red-500/20 group-hover:scale-110 transition-transform">
            <Send className="h-6 w-6 text-white" />
          </div>
          <div className="text-right flex-1">
            <p className="font-bold text-base">سحب</p>
            <p className="text-xs text-muted-foreground mt-0.5">سحب عملات من محفظتك</p>
          </div>
          <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-red-400 group-hover:translate-x-[-4px] transition-all" />
        </button>
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
                      {CURRENCY_NAMES[currency] || currency}
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

      {/* ── Deposit Modal ── */}
      {showDepositModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={() => setShowDepositModal(false)}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" />

          {/* Modal Content */}
          <div
            className="relative w-full max-w-lg glass-panel-strong rounded-3xl p-6 animate-scale-in z-10"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={() => setShowDepositModal(false)}
              className="absolute top-4 left-4 h-8 w-8 rounded-lg flex items-center justify-center hover:bg-muted/50 transition-colors"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>

            {/* Modal Header */}
            <div className="flex items-center gap-3 mb-6">
              <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                <ArrowDownToLine className="h-6 w-6 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-xl">إيداع عملات رقمية</h3>
                <p className="text-xs text-muted-foreground">تحويل عملات إلى محفظتك</p>
              </div>
            </div>

            {/* Info Box */}
            <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/15 flex items-start gap-3 mb-5">
              <Info className="h-5 w-5 text-blue-400 shrink-0 mt-0.5" />
              <p className="text-sm text-muted-foreground leading-relaxed">
                قم بتحويل العملات الرقمية إلى محفظتك الخارجية، ثم قدّم طلب إيداع مع إرفاق رقم المعاملة (TxID). سيتم مراجعة الطلب وإضافة الرصيد بعد التأكيد من قبل الإدارة.
              </p>
            </div>

            {/* Form Fields */}
            <div className="space-y-4">
              {/* Currency Selector */}
              <div>
                <label className="block text-sm font-medium mb-2 text-muted-foreground">العملة</label>
                <div className="relative">
                  <select
                    className="input-field appearance-none pr-4 pl-10"
                    value={depositForm.currency}
                    onChange={(e) => handleDepositCurrencyChange(e.target.value)}
                  >
                    {CURRENCIES.map((c) => (
                      <option key={c} value={c}>
                        {CURRENCY_ICONS[c]} {c} - {CURRENCY_NAMES[c]}
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <div className={`h-7 w-7 rounded-lg bg-gradient-to-br ${CURRENCY_COLORS[depositForm.currency]} flex items-center justify-center text-xs font-bold text-white`}>
                      {CURRENCY_ICONS[depositForm.currency]}
                    </div>
                  </div>
                  <ChevronDown className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                </div>
              </div>

              {/* Network Selector */}
              <div>
                <label className="block text-sm font-medium mb-2 text-muted-foreground">الشبكة</label>
                <div className="relative">
                  <select
                    className="input-field appearance-none pr-4"
                    value={depositForm.network}
                    onChange={(e) => setDepositForm({ ...depositForm, network: e.target.value })}
                  >
                    {(CURRENCY_NETWORKS[depositForm.currency] || []).map((net) => (
                      <option key={net.network} value={net.network}>
                        {net.name} ({net.network})
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                </div>
                {depositForm.network && (
                  <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1.5">
                    <Shield className="h-3 w-3" />
                    مثال على العنوان: <span dir="ltr" className="text-foreground/70">{CURRENCY_NETWORKS[depositForm.currency]?.find(n => n.network === depositForm.network)?.address_example}</span>
                  </p>
                )}
              </div>

              {/* Amount Input */}
              <div>
                <label className="block text-sm font-medium mb-2 text-muted-foreground">الكمية</label>
                <div className="relative">
                  <input
                    type="number"
                    step="any"
                    className="input-field pl-16"
                    placeholder="0.00"
                    value={depositForm.amount}
                    onChange={(e) => setDepositForm({ ...depositForm, amount: e.target.value })}
                    min="0.001"
                  />
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground bg-muted/50 px-2 py-1 rounded-lg">
                    {depositForm.currency}
                  </div>
                </div>
              </div>

              {/* TxID Input */}
              <div>
                <label className="block text-sm font-medium mb-2 text-muted-foreground">رقم المعاملة (TxID) - اختياري</label>
                <div className="relative">
                  <input
                    type="text"
                    className="input-field pl-10"
                    placeholder="0xabc123..."
                    value={depositForm.tx_id}
                    onChange={(e) => setDepositForm({ ...depositForm, tx_id: e.target.value })}
                    dir="ltr"
                  />
                  <Hash className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowDepositModal(false)}
                className="btn-ghost flex-1 py-3"
              >
                إلغاء
              </button>
              <button
                onClick={handleDepositContinue}
                className="btn-primary bg-emerald-600 hover:bg-emerald-500 gap-2 flex-1 py-3"
              >
                <ArrowDownToLine className="h-4 w-4" />
                متابعة
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Withdraw Modal ── */}
      {showWithdrawModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={() => setShowWithdrawModal(false)}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" />

          {/* Modal Content */}
          <div
            className="relative w-full max-w-lg glass-panel-strong rounded-3xl p-6 animate-scale-in z-10"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={() => setShowWithdrawModal(false)}
              className="absolute top-4 left-4 h-8 w-8 rounded-lg flex items-center justify-center hover:bg-muted/50 transition-colors"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>

            {/* Modal Header */}
            <div className="flex items-center gap-3 mb-6">
              <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center shadow-lg shadow-red-500/20">
                <Send className="h-6 w-6 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-xl">سحب عملات رقمية</h3>
                <p className="text-xs text-muted-foreground">سحب عملات من محفظتك</p>
              </div>
            </div>

            {/* Warning Box */}
            <div className="p-4 rounded-xl bg-yellow-500/5 border border-yellow-500/15 flex items-start gap-3 mb-5">
              <AlertTriangle className="h-5 w-5 text-yellow-500 shrink-0 mt-0.5" />
              <p className="text-sm text-muted-foreground leading-relaxed">
                سيتم خصم المبلغ من رصيدك فوراً وإنشاء طلب سحب معلق. سيتم معالجة السحب بعد مراجعة الإدارة. تأكد من صحة العنوان والشبكة.
              </p>
            </div>

            {/* Available Balance */}
            <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/20 border border-border/30 mb-5">
              <Wallet className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">الرصيد المتاح:</span>
              <span className="text-sm font-bold">
                {getCurrencyBalance(withdrawForm.currency).toFixed(getCurrencyBalance(withdrawForm.currency) > 1 ? 4 : 8)} {withdrawForm.currency}
              </span>
              <span className="text-xs text-muted-foreground">
                ≈ $
                {(
                  (withdrawForm.currency === "USDT"
                    ? getCurrencyBalance(withdrawForm.currency)
                    : getCurrencyBalance(withdrawForm.currency) * (prices[withdrawForm.currency] ? parseFloat(prices[withdrawForm.currency]) : 0))
                ).toFixed(2)}
              </span>
            </div>

            {/* Form Fields */}
            <div className="space-y-4">
              {/* Currency Selector */}
              <div>
                <label className="block text-sm font-medium mb-2 text-muted-foreground">العملة</label>
                <div className="relative">
                  <select
                    className="input-field appearance-none pr-4 pl-10"
                    value={withdrawForm.currency}
                    onChange={(e) => handleWithdrawCurrencyChange(e.target.value)}
                  >
                    {CURRENCIES.map((c) => (
                      <option key={c} value={c}>
                        {CURRENCY_ICONS[c]} {c} - {CURRENCY_NAMES[c]}
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <div className={`h-7 w-7 rounded-lg bg-gradient-to-br ${CURRENCY_COLORS[withdrawForm.currency]} flex items-center justify-center text-xs font-bold text-white`}>
                      {CURRENCY_ICONS[withdrawForm.currency]}
                    </div>
                  </div>
                  <ChevronDown className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                </div>
              </div>

              {/* Network Selector */}
              <div>
                <label className="block text-sm font-medium mb-2 text-muted-foreground">الشبكة</label>
                <div className="relative">
                  <select
                    className="input-field appearance-none pr-4"
                    value={withdrawForm.network}
                    onChange={(e) => setWithdrawForm({ ...withdrawForm, network: e.target.value })}
                  >
                    {(CURRENCY_NETWORKS[withdrawForm.currency] || []).map((net) => (
                      <option key={net.network} value={net.network}>
                        {net.name} ({net.network})
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                </div>
              </div>

              {/* Amount Input */}
              <div>
                <label className="block text-sm font-medium mb-2 text-muted-foreground">الكمية</label>
                <div className="relative">
                  <input
                    type="number"
                    step="any"
                    className="input-field pl-16"
                    placeholder="0.00"
                    value={withdrawForm.amount}
                    onChange={(e) => setWithdrawForm({ ...withdrawForm, amount: e.target.value })}
                    min="0.001"
                  />
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground bg-muted/50 px-2 py-1 rounded-lg">
                    {withdrawForm.currency}
                  </div>
                </div>
                {/* Quick fill max */}
                <button
                  type="button"
                  onClick={() => setWithdrawForm({ ...withdrawForm, amount: getCurrencyBalance(withdrawForm.currency).toString() })}
                  className="text-xs text-emerald-400 hover:text-emerald-300 mt-1.5 transition-colors"
                >
                  <Zap className="h-3 w-3 inline ml-1" />
                  استخدام الرصيد الكامل
                </button>
              </div>

              {/* Wallet Address Input */}
              <div>
                <label className="block text-sm font-medium mb-2 text-muted-foreground">عنوان المحفظة</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder={`أدخل عنوان ${withdrawForm.currency} على شبكة ${withdrawForm.network || "..."}`}
                  value={withdrawForm.address}
                  onChange={(e) => setWithdrawForm({ ...withdrawForm, address: e.target.value })}
                  dir="ltr"
                />
                <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1.5">
                  <Shield className="h-3 w-3" />
                  تأكد من تطابق الشبكة مع العنوان لتجنب فقدان الأموال
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowWithdrawModal(false)}
                className="btn-ghost flex-1 py-3"
              >
                إلغاء
              </button>
              <button
                onClick={handleWithdrawContinue}
                className="btn-primary bg-red-600 hover:bg-red-500 gap-2 flex-1 py-3"
                style={{ boxShadow: "0 0 20px rgba(239,68,68,0.15), 0 2px 4px rgba(0,0,0,0.1)" }}
              >
                <Send className="h-4 w-4" />
                متابعة
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
