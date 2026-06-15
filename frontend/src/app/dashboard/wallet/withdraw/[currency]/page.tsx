"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  Clock,
  Copy,
  Check,
  ExternalLink,
  Hash,
  Info,
  Loader2,
  Send,
  Shield,
  Wallet,
  Zap,
  ArrowRight,
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

// Withdrawal fees per currency
const WITHDRAW_FEES: Record<string, Record<string, string>> = {
  BTC: { BTC: "0.0001 BTC", BSC: "0.00005 BTC" },
  ETH: { ERC20: "0.005 ETH", BSC: "0.001 ETH", ARB: "0.0005 ETH" },
  USDT: { ERC20: "10 USDT", TRC20: "1 USDT", BSC: "2 USDT", SOL: "0.5 USDT" },
  BNB: { BSC: "0.05 BNB" },
  SOL: { SOL: "0.01 SOL" },
  XRP: { XRP: "0.25 XRP" },
  ADA: { ADA: "0.5 ADA" },
  DOGE: { DOGE: "5 DOGE" },
  DOT: { DOT: "0.1 DOT" },
};

export default function WithdrawPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();

  const currency = (params.currency as string) || "USDT";
  const network = searchParams.get("network") || "";
  const prefillAmount = searchParams.get("amount") || "";
  const prefillAddress = searchParams.get("address") || "";

  const [amount, setAmount] = useState(prefillAmount);
  const [address, setAddress] = useState(prefillAddress);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [balance, setBalance] = useState(0);

  const gradientColors = CURRENCY_COLORS[currency] || "from-gray-400 to-gray-500";
  const icon = CURRENCY_ICONS[currency] || currency.charAt(0);
  const currencyName = CURRENCY_NAMES[currency] || currency;
  const networks = CURRENCY_NETWORKS[currency] || [];
  const selectedNetwork = networks.find((n) => n.network === network) || networks[0];
  const fee = WITHDRAW_FEES[currency]?.[network] || "0";

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
    if (parseFloat(amount) > balance) {
      toast.error("الكمية تتجاوز الرصيد المتاح");
      return;
    }
    if (!address.trim()) {
      toast.error("يرجى إدخال عنوان المحفظة");
      return;
    }

    setLoading(true);
    try {
      const res = await authPost("/api/v1/wallet/withdraw", {
        currency,
        amount: parseFloat(amount),
        address: address.trim(),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "فشل طلب السحب");
        return;
      }
      toast.success("تم تقديم طلب السحب بنجاح. سيتم مراجعته من قبل الإدارة.");
      setSubmitted(true);
    } catch {
      toast.error("حدث خطأ في الاتصال");
    } finally {
      setLoading(false);
    }
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
          <h2 className="text-2xl font-bold mb-2">تم تقديم طلب السحب</h2>
          <p className="text-muted-foreground mb-6 leading-relaxed">
            تم خصم <span className="text-foreground font-semibold">{amount} {currency}</span> من رصيدك وإنشاء طلب سحب معلق. سيتم معالجة السحب بعد مراجعة الإدارة.
          </p>
          <div className="glass-panel rounded-xl p-4 mb-4 max-w-sm mx-auto">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">العملة</span>
                <span className="font-medium">{currency}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">الكمية</span>
                <span className="font-bold">{amount} {currency}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">العنوان</span>
                <span className="font-mono text-xs max-w-[200px] truncate" dir="ltr">{address}</span>
              </div>
            </div>
          </div>
          <div className="glass-panel rounded-xl p-3 mb-6 max-w-sm mx-auto">
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
          <h1 className="text-2xl font-bold">سحب {currencyName}</h1>
          <p className="text-sm text-muted-foreground">
            شبكة {selectedNetwork?.name || network} · {currency}
          </p>
        </div>
      </div>

      {/* Steps indicator */}
      <div className="flex items-center gap-3 animate-slide-in-up" style={{ animationDelay: "100ms", animationFillMode: "both" }}>
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-red-500 text-white flex items-center justify-center text-xs font-bold">1</div>
          <span className="text-xs font-medium">التفاصيل</span>
        </div>
        <div className="h-px flex-1 bg-border/50" />
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">2</div>
          <span className="text-xs font-medium">التأكيد</span>
        </div>
        <div className="h-px flex-1 bg-border/50" />
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-muted/50 text-muted-foreground flex items-center justify-center text-xs font-bold">3</div>
          <span className="text-xs font-medium text-muted-foreground">المعالجة</span>
        </div>
      </div>

      {/* Warning Box */}
      <div className="p-4 rounded-xl bg-yellow-500/5 border border-yellow-500/15 flex items-start gap-3 animate-slide-in-up" style={{ animationDelay: "120ms", animationFillMode: "both" }}>
        <AlertTriangle className="h-5 w-5 text-yellow-500 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-yellow-500 mb-1">تنبيه مهم</p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            سيتم خصم المبلغ من رصيدك فوراً وإنشاء طلب سحب معلق. سيتم معالجة السحب بعد مراجعة الإدارة. تأكد من صحة العنوان والشبكة لتجنب فقدان الأموال.
          </p>
        </div>
      </div>

      {/* Withdraw Form */}
      <form onSubmit={handleSubmit} className="glass-panel-strong rounded-2xl p-6 space-y-5 animate-slide-in-up" style={{ animationDelay: "150ms", animationFillMode: "both" }}>
        <div className="flex items-center gap-3 mb-1">
          <div className="h-9 w-9 rounded-lg bg-red-500/10 flex items-center justify-center">
            <Send className="h-5 w-5 text-red-500" />
          </div>
          <div>
            <h3 className="font-bold text-lg">تفاصيل السحب</h3>
            <p className="text-xs text-muted-foreground">أدخل كمية السحب وعنوان المحفظة المستلمة</p>
          </div>
        </div>

        {/* Available Balance */}
        <div className="flex items-center justify-between p-4 rounded-xl bg-muted/20 border border-border/30">
          <div className="flex items-center gap-3">
            <Wallet className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">الرصيد المتاح</p>
              <p className="text-lg font-bold">{balance.toFixed(balance > 1 ? 4 : 8)} {currency}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setAmount(balance.toString())}
            className="text-xs px-3 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors font-medium flex items-center gap-1"
          >
            <Zap className="h-3 w-3" />
            الكل
          </button>
        </div>

        {/* Network Display */}
        <div>
          <label className="block text-sm font-medium mb-2 text-muted-foreground">الشبكة</label>
          <div className="p-3 rounded-xl bg-muted/10 border border-border/20 flex items-center gap-3">
            <Shield className="h-4 w-4 text-emerald-500" />
            <div>
              <p className="text-sm font-medium">{selectedNetwork?.name || network}</p>
              <p className="text-xs text-muted-foreground">{selectedNetwork?.network || network}</p>
            </div>
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
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              min="0.001"
            />
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground bg-muted/50 px-2 py-1 rounded-lg">
              {currency}
            </div>
          </div>
          {/* Amount validation */}
          {amount && parseFloat(amount) > balance && (
            <p className="text-xs text-red-400 mt-1.5 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              الكمية تتجاوز الرصيد المتاح
            </p>
          )}
        </div>

        {/* Wallet Address Input */}
        <div>
          <label className="block text-sm font-medium mb-2 text-muted-foreground">عنوان المحفظة المستلمة</label>
          <input
            type="text"
            className="input-field"
            placeholder={`أدخل عنوان ${currency} على شبكة ${selectedNetwork?.name || network}`}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            required
            dir="ltr"
          />
          <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1.5">
            <Shield className="h-3 w-3" />
            تأكد من تطابق الشبكة مع العنوان لتجنب فقدان الأموال
          </p>
        </div>

        {/* Fee Notice */}
        <div className="p-4 rounded-xl bg-muted/10 border border-border/20">
          <div className="flex items-center gap-2 mb-2">
            <Info className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm font-medium">رسوم السحب</p>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">رسوم الشبكة</span>
              <span className="font-medium">{fee}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">ستستلم</span>
              <span className="font-bold text-emerald-400">
                {amount && parseFloat(amount) > 0
                  ? `${Math.max(0, parseFloat(amount) - parseFloat(fee.split(' ')[0])).toFixed(8)} ${currency}`
                  : `0.00 ${currency}`}
              </span>
            </div>
          </div>
        </div>

        {/* Summary */}
        <div className="p-4 rounded-xl bg-muted/10 border border-border/20">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="h-4 w-4 text-emerald-500" />
            <p className="text-sm font-medium">ملخص السحب</p>
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
            <div className="flex justify-between">
              <span className="text-muted-foreground">العنوان</span>
              <span className="font-mono text-xs max-w-[200px] truncate" dir="ltr">{address || "—"}</span>
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
            disabled={loading || (amount ? parseFloat(amount) > balance : false)}
            className="btn-primary bg-red-600 hover:bg-red-500 gap-2 flex-1 py-3"
            style={{ boxShadow: "0 0 20px rgba(239,68,68,0.15), 0 2px 4px rgba(0,0,0,0.1)" }}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            {loading ? "جاري المعالجة..." : "تأكيد السحب"}
          </button>
        </div>
      </form>
    </div>
  );
}
