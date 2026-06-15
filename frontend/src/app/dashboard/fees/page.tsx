"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import {
  Coins,
  Loader2,
  Percent,
  User,
  TrendingUp,
  Info,
  ShieldCheck,
} from "lucide-react";
import { authGet } from "@/lib/api";

interface FeeSchedule {
  id?: number;
  user_type: string;
  order_type: string;
  maker_fee: string;
  taker_fee: string;
}

const USER_TYPES = [
  { value: "REGULAR", label: "مستخدم عادي", desc: "حساب أساسي بدون تحقق", icon: User, color: "from-blue-500 to-cyan-600" },
  { value: "VIP", label: "VIP مستخدم", desc: "حساب مميز مع تحقق كامل", icon: ShieldCheck, color: "from-amber-500 to-yellow-600" },
  { value: "MARKET_MAKER", label: "صانع سوق", desc: "مزود سيولة للسوق", icon: TrendingUp, color: "from-purple-500 to-violet-600" },
];

const ORDER_TYPES = [
  { value: "MARKET", label: "أمر سوقي" },
  { value: "LIMIT", label: "أمر محدد" },
  { value: "STOP_LIMIT", label: "أمر وقف خسارة" },
  { value: "TAKE_PROFIT", label: "أمر جني أرباح" },
];

export default function PublicFeesPage() {
  const [fees, setFees] = useState<FeeSchedule[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFees();
  }, []);

  const fetchFees = async () => {
    setLoading(true);
    try {
      const res = await authGet("/api/v1/fees");
      if (res.ok) {
        const data = await res.json();
        setFees(Array.isArray(data.data) ? data.data : []);
      } else {
        toast.error("فشل تحميل جداول الرسوم");
      }
    } catch {
      toast.error("حدث خطأ في الاتصال");
    } finally {
      setLoading(false);
    }
  };

  const getUserTypeLabel = (type: string) => {
    const option = USER_TYPES.find(o => o.value === type);
    return option?.label || type;
  };

  const getOrderTypeLabel = (type: string) => {
    const option = ORDER_TYPES.find(o => o.value === type);
    return option?.label || type;
  };

  // Group fees by user type
  const groupedFees = fees.reduce((acc, fee) => {
    if (!acc[fee.user_type]) acc[fee.user_type] = [];
    acc[fee.user_type].push(fee);
    return acc;
  }, {} as Record<string, FeeSchedule[]>);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <div className="h-16 w-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
        </div>
        <p className="text-sm text-muted-foreground">جاري تحميل جداول الرسوم...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="animate-slide-in-up">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <Coins className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">جداول الرسوم</h1>
            <p className="text-muted-foreground text-sm mt-0.5">رسوم التداول حسب نوع المستخدم والأمر</p>
          </div>
        </div>
      </div>

      {/* ── Info Banner ── */}
      <div className="p-4 rounded-2xl bg-blue-500/5 border border-blue-500/15 animate-slide-in-up" style={{ animationDelay: "50ms" }}>
        <div className="flex items-start gap-3">
          <Info className="h-5 w-5 text-blue-400 shrink-0 mt-0.5" />
          <div className="text-sm text-muted-foreground leading-relaxed">
            <p><span className="font-semibold text-foreground">صانع السوق (Maker): </span>الرسوم المطبقة عند وضع أمر محدد يضيف سيولة للسوق.</p>
            <p><span className="font-semibold text-foreground">آخذ السوق (Taker): </span>الرسوم المطبقة عند أخذ أمر من السوق (أوامر سوقية فورية).</p>
          </div>
        </div>
      </div>

      {/* ── Fee Schedules ── */}
      {fees.length === 0 ? (
        <div className="glass-panel rounded-2xl p-10 text-center animate-fade-in">
          <Coins className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
          <h3 className="text-lg font-bold mb-2">لا توجد جداول رسوم</h3>
          <p className="text-sm text-muted-foreground">لم يتم العثور على جداول رسوم متاحة حالياً</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedFees).map(([userType, userFees], gi) => {
            const userTypeConfig = USER_TYPES.find(ut => ut.value === userType);
            const TypeIcon = userTypeConfig?.icon || User;
            const gradient = userTypeConfig?.color || "from-emerald-500 to-teal-600";
            return (
              <div
                key={userType}
                className="glass-panel rounded-2xl p-6 animate-slide-in-up"
                style={{ animationDelay: `${(gi + 1) * 100}ms` }}
              >
                {/* User Type Header */}
                <div className="flex items-center gap-3 mb-5">
                  <div className={`h-10 w-10 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center shadow-lg`}>
                    <TypeIcon className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base">{getUserTypeLabel(userType)}</h3>
                    <p className="text-xs text-muted-foreground">{userTypeConfig?.desc || ""}</p>
                  </div>
                </div>

                {/* Fee Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/40 bg-muted/10">
                        <th className="text-right p-3 text-muted-foreground font-medium">
                          <div className="flex items-center gap-1.5"><TrendingUp className="h-3.5 w-3.5" /> نوع الأمر</div>
                        </th>
                        <th className="text-center p-3 text-muted-foreground font-medium">
                          <div className="flex items-center justify-center gap-1.5"><Percent className="h-3.5 w-3.5" /> رسوم صانع السوق</div>
                        </th>
                        <th className="text-center p-3 text-muted-foreground font-medium">
                          <div className="flex items-center justify-center gap-1.5"><Percent className="h-3.5 w-3.5" /> رسوم آخذ السوق</div>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {userFees.map((fee, fi) => (
                        <tr key={fi} className="border-b border-border/10">
                          <td className="p-3 font-medium text-sm">
                            {getOrderTypeLabel(fee.order_type)}
                          </td>
                          <td className="p-3 text-center">
                            <span className="inline-flex items-center gap-1 bg-emerald-500/10 text-emerald-400 px-3 py-1 rounded-lg text-sm font-semibold tabular-nums">
                              {fee.maker_fee}%
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            <span className="inline-flex items-center gap-1 bg-blue-500/10 text-blue-400 px-3 py-1 rounded-lg text-sm font-semibold tabular-nums">
                              {fee.taker_fee}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
