"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import {
  Coins,
  Loader2,
  Save,
  Percent,
  User,
  TrendingUp,
  RefreshCw,
  AlertTriangle,
} from "lucide-react";
import { authGet, authPut } from "@/lib/api";

interface FeeSchedule {
  id?: number;
  user_type: string;
  order_type: string;
  maker_fee: string;
  taker_fee: string;
}

const USER_TYPES = [
  { value: "REGULAR", label: "مستخدم عادي" },
  { value: "VIP", label: "VIP مستخدم" },
  { value: "MARKET_MAKER", label: "صانع سوق" },
];

const ORDER_TYPES = [
  { value: "MARKET", label: "أمر سوقي" },
  { value: "LIMIT", label: "أمر محدد" },
  { value: "STOP_LIMIT", label: "أمر وقف خسارة" },
  { value: "TAKE_PROFIT", label: "أمر جني أرباح" },
];

export default function AdminFeesPage() {
  const [fees, setFees] = useState<FeeSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingFees, setEditingFees] = useState<FeeSchedule[]>([]);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    fetchFees();
  }, []);

  const fetchFees = async () => {
    setLoading(true);
    try {
      const res = await authGet("/api/v1/admin/fees");
      if (res.ok) {
        const data = await res.json();
        const feeData = Array.isArray(data.data) ? data.data : [];
        setFees(feeData);
        setEditingFees(feeData.map((f: FeeSchedule) => ({ ...f })));
        setHasChanges(false);
      } else {
        toast.error("فشل تحميل جداول الرسوم");
      }
    } catch {
      toast.error("حدث خطأ في الاتصال");
    } finally {
      setLoading(false);
    }
  };

  const handleFeeChange = (index: number, field: "maker_fee" | "taker_fee", value: string) => {
    const updated = [...editingFees];
    updated[index] = { ...updated[index], [field]: value };
    setEditingFees(updated);
    setHasChanges(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await authPut("/api/v1/admin/fees", { fees: editingFees });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "فشل حفظ الرسوم");
        return;
      }
      toast.success(data.message || "تم حفظ الرسوم بنجاح");
      setFees(editingFees.map(f => ({ ...f })));
      setHasChanges(false);
    } catch {
      toast.error("حدث خطأ في الاتصال");
    } finally {
      setSaving(false);
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

  // Group fees by user type for better display
  const groupedFees = editingFees.reduce((acc, fee) => {
    if (!acc[fee.user_type]) acc[fee.user_type] = [];
    acc[fee.user_type].push(fee);
    return acc;
  }, {} as Record<string, FeeSchedule[]>);

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between animate-slide-in-up">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <Coins className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">إدارة الرسوم</h1>
            <p className="text-muted-foreground text-sm mt-0.5">تعديل جداول رسوم التداول حسب نوع المستخدم والأمر</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchFees}
            disabled={loading}
            className="btn-ghost gap-2 text-sm"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            تحديث
          </button>
          {hasChanges && (
            <button
              onClick={handleSave}
              disabled={saving}
              className="btn-primary gap-2 text-sm"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              حفظ التغييرات
            </button>
          )}
        </div>
      </div>

      {/* ── Info Banner ── */}
      <div className="p-4 rounded-2xl bg-yellow-500/5 border border-yellow-500/15 animate-slide-in-up" style={{ animationDelay: "50ms" }}>
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-yellow-400 shrink-0 mt-0.5" />
          <div className="text-sm text-muted-foreground leading-relaxed">
            <p><span className="font-semibold text-foreground">تنبيه: </span>تعديل الرسوم يؤثر على جميع المستخدمين. تأكد من القيم قبل الحفظ. الرسوم تُحسب كنسبة مئوية (مثلاً 0.1 = 0.1%).</p>
          </div>
        </div>
      </div>

      {/* ── Fee Schedules ── */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="h-16 w-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
          </div>
          <p className="text-sm text-muted-foreground">جاري تحميل جداول الرسوم...</p>
        </div>
      ) : editingFees.length === 0 ? (
        <div className="glass-panel rounded-2xl p-10 text-center animate-fade-in">
          <Coins className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
          <h3 className="text-lg font-bold mb-2">لا توجد جداول رسوم</h3>
          <p className="text-sm text-muted-foreground">لم يتم العثور على جداول رسوم. قم بإنشائها من لوحة التحكم.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedFees).map(([userType, userFees], gi) => (
            <div
              key={userType}
              className="glass-panel rounded-2xl p-6 animate-slide-in-up"
              style={{ animationDelay: `${(gi + 1) * 100}ms` }}
            >
              {/* User Type Header */}
              <div className="flex items-center gap-3 mb-5">
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/10 flex items-center justify-center border border-emerald-500/10">
                  <User className="h-5 w-5 text-emerald-500" />
                </div>
                <div>
                  <h3 className="font-bold text-base">{getUserTypeLabel(userType)}</h3>
                  <p className="text-xs text-muted-foreground">
                    {userFees.length} نوع أوامر
                  </p>
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
                        <div className="flex items-center justify-center gap-1.5"><Percent className="h-3.5 w-3.5" /> رسوم صانع السوق (Maker)</div>
                      </th>
                      <th className="text-center p-3 text-muted-foreground font-medium">
                        <div className="flex items-center justify-center gap-1.5"><Percent className="h-3.5 w-3.5" /> رسوم آخذ السوق (Taker)</div>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {userFees.map((fee, fi) => {
                      const editingIndex = editingFees.findIndex(
                        ef => ef.user_type === fee.user_type && ef.order_type === fee.order_type
                      );
                      return (
                        <tr key={fi} className="border-b border-border/10 hover:bg-muted/5 transition-colors">
                          <td className="p-3 font-medium text-sm">
                            {getOrderTypeLabel(fee.order_type)}
                          </td>
                          <td className="p-3">
                            <div className="flex items-center justify-center gap-1">
                              <input
                                type="number"
                                step="0.001"
                                min="0"
                                className="input-field w-28 text-center tabular-nums"
                                value={editingFees[editingIndex]?.maker_fee ?? fee.maker_fee}
                                onChange={(e) => handleFeeChange(editingIndex, "maker_fee", e.target.value)}
                              />
                              <span className="text-xs text-muted-foreground">%</span>
                            </div>
                          </td>
                          <td className="p-3">
                            <div className="flex items-center justify-center gap-1">
                              <input
                                type="number"
                                step="0.001"
                                min="0"
                                className="input-field w-28 text-center tabular-nums"
                                value={editingFees[editingIndex]?.taker_fee ?? fee.taker_fee}
                                onChange={(e) => handleFeeChange(editingIndex, "taker_fee", e.target.value)}
                              />
                              <span className="text-xs text-muted-foreground">%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Save Button (bottom) ── */}
      {hasChanges && (
        <div className="sticky bottom-4 z-20 animate-slide-in-up">
          <div className="glass-panel-strong rounded-2xl p-4 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              <span className="text-yellow-400 font-semibold">⚠</span> لديك تغييرات غير محفوظة
            </p>
            <div className="flex items-center gap-2">
              <button onClick={() => { setEditingFees(fees.map(f => ({ ...f }))); setHasChanges(false); }} className="btn-ghost text-sm">
                تراجع
              </button>
              <button onClick={handleSave} disabled={saving} className="btn-primary gap-2 text-sm">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                حفظ التغييرات
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
