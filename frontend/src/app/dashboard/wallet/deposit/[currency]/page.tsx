"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import {
  ArrowDownToLine,
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  Clock,
  Copy,
  Check,
  Hash,
  Info,
  Loader2,
  Shield,
  Wallet,
  AlertTriangle,
  ExternalLink,
  Zap,
} from "lucide-react";
import { authGet, authPost } from "@/lib/api";

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
  BTC: "₿", ETH: "Ξ", USDT: "₮", BNB: "B", SOL: "S",
  XRP: "X", ADA: "A", DOGE: "D", DOT: "●",
};

const CURRENCY_NAMES: Record<string, string> = {
  BTC: "Bitcoin", ETH: "Ethereum", USDT: "Tether", BNB: "BNB",
  SOL: "Solana", XRP: "Ripple", ADA: "Cardano", DOGE: "Dogecoin", DOT: "Polkadot",
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
  BNB: [{ name: "BEP20", network: "BSC", address_example: "0x..." }],
  SOL: [{ name: "Solana", network: "SOL", address_example: "..." }],
  XRP: [{ name: "XRP Ledger", network: "XRP", address_example: "r..." }],
  ADA: [{ name: "Cardano", network: "ADA", address_example: "addr1..." }],
  DOGE: [{ name: "Dogecoin", network: "DOGE", address_example: "D..." }],
  DOT: [{ name: "Polkadot", network: "DOT", address_example: "15..." }],
};

// Simulated deposit addresses per currency/network
const DEPOSIT_ADDRESSES: Record<string, Record<string, string>> = {
  BTC: { BTC: "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh", BSC: "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18" },
  ETH: { ERC20: "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18", BSC: "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18", ARB: "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18" },
  USDT: { ERC20: "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18", TRC20: "TN2Y3cZpLinAVYWRjYPxxnTVcEd1oAS8su", BSC: "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18", SOL: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU" },
  BNB: { BSC: "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18" },
  SOL: { SOL: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU" },
  XRP: { XRP: "rN7n3473SaZBCG4dFL83w7a1RXtXtbk2Dq" },
  ADA: { ADA: "addr1qx2fxv2umyhttkxyxp8x0dlpdt3k6cwng5pxj3jhsydzer3n0d3vllhmq66y5h4zxcz7j8c0wst8r4e2z5t6t8m9z6y" },
  DOGE: { DOGE: "DH5yaieqoZN36f2DiVCLx6YJ5Gk9BYLZVA" },
  DOT: { DOT: "15oF4uVJwmo4TdGW7VfQxNLavjCXviqWrztPu8CAkFde5zTC" },
};

export default function DepositPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();

  const currency = (params.currency as string) || "USDT";
  const network = searchParams.get("network") || "";
  const prefillAmount = searchParams.get("amount") || "";
  const prefillTxId = searchParams.get("tx_id") || "";

  const [amount, setAmount] = useState(prefillAmount);
  const [txId, setTxId] = useState(prefillTxId);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [balance, setBalance] = useState(0);

  const gradientColors = CURRENCY_COLORS[currency] || "from-gray-400 to-gray-500";
  const icon = CURRENCY_ICONS[currency] || currency.charAt(0);
  const currencyName = CURRENCY_NAMES[currency] || currency;
  const networks = CURRENCY_NETWORKS[currency] || [];
  const selectedNetwork = networks.find((n) => n.network === network) || networks[0];
  const depositAddress = DEPOSIT_ADDRESSES[currency]?.[network] || "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18";

  useEffect(() => {
    const fetchBalance = async () => {
      try {
        const res = await authGet("/api/v1/wallet/balances");
        const data = await res.json();
        const bals = Array.isArray(data) ? data : Array.isArray(data.balances) ? data.balances : [];
        const b = bals.find((b: any) => b.currency === currency);
        if (b) setBalance(parseFloat(b.balance));
      } catch {}
    };
    fetchBalance();
  }, [currency]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || parseFloat(amount) <= 0) {
      toast.error("يرجى إدخال كمية صحيحة");
      return;
    }
    if (!txId.trim()) {
      toast.error("يرجى إدخال رقم المعاملة (TxID)");
      return;
    }

    setLoading(true);
    try {
      const res = await authPost("/api/v1/wallet/deposit", {
        currency,
        amount: parseFloat(amount),
        tx_id: txId.trim(),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "فشل طلب الإيداع");
        return;
      }
      toast.success("تم تقديم طلب الإيداع بنجاح. سيتم مراجعته وإضافة الرصيد بعد التأكيد.");
      setSubmitted(true);
    } catch {
      toast.error("حدث خطأ في الاتصال");
    } finally {
      setLoading(false);
    }
  };

  const copyAddress = () => {
    navigator.clipboard.writeText(depositAddress);
    setCopiedAddress(true);
    toast.success("تم نسخ العنوان");
    setTimeout(() => setCopiedAddress(false), 2000);
  };

  // Success state
  if (submitted) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Back button */}
        <button
          onClick={() => router.push("/dashboard/wallet")}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          العودة إلى المحفظة
        </button>

        <div className="glass-panel-strong rounded-3xl p-8 text-center animate-scale-in">
          <div className="flex justify-center mb-6">
            <div className="h-20 w-20 rounded-2xl bg-emerald-500/10 flex items-center justify-center animate-scale-in">
              <CheckCircle2 className="h-10 w-10 text-emerald-500" />
            </div>
          </div>
          <h2 className="text-2xl font-bold mb-2">تم تقديم طلب الإيداع</h2>
          <p className="text-muted-foreground mb-6 leading-relaxed">
            تم تقديم طلب إيداع <span className="text-foreground font-semibold">{amount} {currency}</span> بنجاح. سيتم مراجعة الطلب وإضافة الرصيد إلى محفظتك بعد التأكيد من قبل الإدارة.
          </p>
          <div className="glass-panel rounded-xl p-4 mb-6 max-w-sm mx-auto">
            <div className="flex items-center gap-2 justify-center text-sm text-muted-foreground">
              <Clock className="h-4 w-4 text-yellow-500" />
              حالة الطلب: <span className="text-yellow-400 font-medium">قيد الانتظار</span>
            </div>
          </div>
          <button
            onClick={() => router.push("/dashboard/wallet")}
            className="btn-primary bg-emerald-600 hover:bg-emerald-500 gap-2"
          >
            <Wallet className="h-4 w-4" />
            العودة إلى المحفظة
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Back button */}
      <button
        onClick={() => router.push("/dashboard/wallet")}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors animate-slide-in-up"
      >
        <ChevronLeft className="h-4 w-4" />
        العودة إلى المحفظة
      </button>

      {/* Header */}
      <div className="flex items-center gap-4 animate-slide-in-up" style={{ animationDelay: "50ms", animationFillMode: "both" }}>
        <div className={`h-14 w-14 rounded-2xl bg-gradient-to-br ${gradientColors} flex items-center justify-center text-2xl font-bold text-white shadow-lg`}>
          {icon}
        </div>
        <div>
          <h1 className="text-2xl font-bold">إيداع {currencyName}</h1>
          <p className="text-sm text-muted-foreground">
            شبكة {selectedNetwork?.name || network} · {currency}
          </p>
        </div>
      </div>

      {/* Steps indicator */}
      <div className="flex items-center gap-3 animate-slide-in-up" style={{ animationDelay: "100ms", animationFillMode: "both" }}>
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs font-bold">1</div>
          <span className="text-xs font-medium">العنوان</span>
        </div>
        <div className="h-px flex-1 bg-border/50" />
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">2</div>
          <span className="text-xs font-medium">التحويل</span>
        </div>
        <div className="h-px flex-1 bg-border/50" />
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-muted/50 text-muted-foreground flex items-center justify-center text-xs font-bold">3</div>
          <span className="text-xs font-medium text-muted-foreground">التأكيد</span>
        </div>
      </div>

      {/* Deposit Address Card */}
      <div className="glass-panel-strong rounded-2xl p-6 animate-slide-in-up" style={{ animationDelay: "150ms", animationFillMode: "both" }}>
        <div className="flex items-center gap-3 mb-4">
          <div className="h-9 w-9 rounded-lg bg-emerald-500/10 flex items-center justify-center">
            <Wallet className="h-5 w-5 text-emerald-500" />
          </div>
          <div>
            <h3 className="font-bold">عنوان الإيداع</h3>
            <p className="text-xs text-muted-foreground">أرسل {currency} إلى هذا العنوان على شبكة {selectedNetwork?.name || network}</p>
          </div>
        </div>

        {/* Network badge */}
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xs px-3 py-1 rounded-full bg-primary/10 text-primary font-medium border border-primary/20">
            {selectedNetwork?.name || network}
          </span>
          <span className="text-xs px-3 py-1 rounded-full bg-muted/50 text-muted-foreground border border-border/30">
            {currency}
          </span>
        </div>

        {/* Address display */}
        <div className="flex items-center gap-3 p-4 rounded-xl bg-muted/20 border border-border/30">
          <p className="text-sm font-mono flex-1 break-all" dir="ltr">
            {depositAddress}
          </p>
          <button
            onClick={copyAddress}
            className="h-9 w-9 rounded-lg flex items-center justify-center hover:bg-muted/50 transition-colors border border-border/30 shrink-0"
            title="نسخ العنوان"
          >
            {copiedAddress ? (
              <Check className="h-4 w-4 text-emerald-500" />
            ) : (
              <Copy className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
        </div>

        {/* Warning */}
        <div className="p-3 rounded-xl bg-red-500/5 border border-red-500/15 flex items-start gap-2.5 mt-4">
          <AlertTriangle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            تأكد من إرسال {currency} فقط على شبكة {selectedNetwork?.name || network}. إرسال عملات أخرى أو استخدام شبكة مختلفة قد يؤدي إلى فقدان أموالك.
          </p>
        </div>
      </div>

      {/* Deposit Form */}
      <form onSubmit={handleSubmit} className="glass-panel-strong rounded-2xl p-6 space-y-5 animate-slide-in-up" style={{ animationDelay: "200ms", animationFillMode: "both" }}>
        <div className="flex items-center gap-3 mb-1">
          <div className="h-9 w-9 rounded-lg bg-emerald-500/10 flex items-center justify-center">
            <ArrowDownToLine className="h-5 w-5 text-emerald-500" />
          </div>
          <div>
            <h3 className="font-bold text-lg">تأكيد الإيداع</h3>
            <p className="text-xs text-muted-foreground">أدخل تفاصيل المعاملة بعد التحويل</p>
          </div>
        </div>

        {/* Info Box */}
        <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/15 flex items-start gap-3">
          <Info className="h-5 w-5 text-blue-400 shrink-0 mt-0.5" />
          <p className="text-sm text-muted-foreground leading-relaxed">
            بعد إرسال العملات إلى العنوان أعلاه، أدخل الكمية ورقم المعاملة (TxID) أدناه. سيتم مراجعة طلبك من قبل الإدارة وإضافة الرصيد بعد التأكيد.
          </p>
        </div>

        {/* Current Balance */}
        <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/20 border border-border/30">
          <Wallet className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">الرصيد الحالي:</span>
          <span className="text-sm font-bold">{balance.toFixed(balance > 1 ? 4 : 8)} {currency}</span>
        </div>

        {/* Amount */}
        <div>
          <label className="block text-sm font-medium mb-2 text-muted-foreground">الكمية</label>
          <div className="relative">
            <input
              type="number"
              step="any"
              className="input-field pl-16"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              min="0.001"
            />
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground bg-muted/50 px-2 py-1 rounded-lg">
              {currency}
            </div>
          </div>
        </div>

        {/* TxID */}
        <div>
          <label className="block text-sm font-medium mb-2 text-muted-foreground">رقم المعاملة (TxID)</label>
          <div className="relative">
            <input
              type="text"
              className="input-field pl-10"
              placeholder="أدخل رقم المعاملة من المحفظة الخارجية..."
              value={txId}
              onChange={(e) => setTxId(e.target.value)}
              required
              dir="ltr"
            />
            <Hash className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          </div>
          <p className="text-xs text-muted-foreground mt-1.5">
            يمكنك العثور على TxID في سجل معاملات المحفظة الخارجية
          </p>
        </div>

        {/* Network Confirmation */}
        <div className="p-4 rounded-xl bg-muted/10 border border-border/20">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="h-4 w-4 text-emerald-500" />
            <p className="text-sm font-medium">ملخص الإيداع</p>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">العملة</span>
              <span className="font-medium flex items-center gap-1.5">
                <span className={`inline-block h-5 w-5 rounded bg-gradient-to-br ${gradientColors} text-[10px] font-bold text-white flex items-center justify-center`}>{icon}</span>
                {currency}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">الشبكة</span>
              <span className="font-medium">{selectedNetwork?.name || network}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">الكمية</span>
              <span className="font-bold">{amount || "0.00"} {currency}</span>
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={() => router.push("/dashboard/wallet")}
            className="btn-ghost flex-1 py-3"
          >
            إلغاء
          </button>
          <button
            type="submit"
            disabled={loading}
            className="btn-primary bg-emerald-600 hover:bg-emerald-500 gap-2 flex-1 py-3"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ArrowDownToLine className="h-4 w-4" />
            )}
            {loading ? "جاري المعالجة..." : "تأكيد الإيداع"}
          </button>
        </div>
      </form>
    </div>
  );
}
