"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Percent, Save, RefreshCw, Info, Shield, ShieldCheck, TrendingUp, TrendingDown, DollarSign } from "lucide-react";
import { authGet, authPut } from "@/lib/api";

interface FeeSchedule {
  id: number;
  user_type: string;
  order_type: string;
  maker_fee: number;
  taker_fee: number;
  min_fee: number;
  created_at: string;
  updated_at: string;
}

export default function AdminFeesPage() {
  const [fees, setFees] = useState<FeeSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<number | null>(null);
  const [editValues, setEditValues] = useState<Record<number, { maker_fee: string; taker_fee: string; min_fee: string }>>({});
  const [changedIds, setChangedIds] = useState<Set<number>>(new Set());

  const fetchFees = async () => {
    setLoading(true);
    try {
      const res = await authGet("/api/v1/admin/fees");
      if (res.ok) {
        const data = await res.json();
        setFees(data.data || []);
        const ev: Record<number, { maker_fee: string; taker_fee: string; min_fee: string }> = {};
        (data.data || []).forEach((f: FeeSchedule) => {
          ev[f.id] = {
            maker_fee: (f.maker_fee * 100).toFixed(4),
            taker_fee: (f.taker_fee * 100).toFixed(4),
            min_fee: f.min_fee.toFixed(8),
          };
        });
        setEditValues(ev);
        setChangedIds(new Set());
      }
    } catch {
      toast.error("فشل تحميل جدول الرسوم");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFees();
  }, []);

  const handleSave = async (feeId: number) => {
    const vals = editValues[feeId];
    if (!vals) return;

    const makerFee = parseFloat(vals.maker_fee) / 100;
    const takerFee = parseFloat(vals.taker_fee) / 100;
    const minFee = parseFloat(vals.min_fee);

    if (isNaN(makerFee) || isNaN(takerFee) || isNaN(minFee)) {
      toast.error("يرجى إدخال قيم صحيحة");
      return;
    }
    if (makerFee < 0 || takerFee < 0 || minFee < 0) {
      toast.error("لا يمكن أن تكون القيم سالبة");
      return;
    }
    if (makerFee > 1 || takerFee > 1) {
      toast.error("نسبة الرسوم لا يمكن أن تتجاوز 100%");
      return;
    }

    setSaving(feeId);
    try {
      const res = await authPut(`/api/v1/admin/fees/${feeId}`, {
        maker_fee: makerFee,
        taker_fee: takerFee,
        min_fee: minFee,
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "فشل تحديث الرسوم");
        return;
      }
      toast.success("تم تحديث جدول الرسوم بنجاح");
      fetchFees();
    } catch {
      toast.error("حدث خطأ في الاتصال");
    } finally {
      setSaving(null);
    }
  };

  const handleFieldChange = (feeId: number, field: string, value: string) => {
    setEditValues(prev => ({
      ...prev,
      [feeId]: { ...prev[feeId], [field]: value },
    }));
    // Check if value differs from original
    const fee = fees.find(f => f.id === feeId);
    if (fee) {
      const originalValue = field === "maker_fee"
        ? (fee.maker_fee * 100).toFixed(4)
        : field === "taker_fee"
          ? (fee.taker_fee * 100).toFixed(4)
          : fee.min_fee.toFixed(8);
      if (value !== originalValue) {
        setChangedIds(prev => new Set(prev).add(feeId));
      } else {
        setChangedIds(prev => {
          const next = new Set(prev);
          next.delete(feeId);
          return next;
        });
      }
    }
  };

  const getUserTypeLabel = (type: string) => {
    switch (type) {
      case "USER": return "مستخدم عادي";
      case "VERIFIED_USER": return "مستخدم موثق";
      default: return type;
    }
  };

  const getOrderTypeLabel = (type: string) => {
    switch (type) {
      case "MARKET": return "سوقي (Market)";
      case "LIMIT": return "محدد (Limit)";
      case "STOP_LIMIT": return "شرطي (Stop Limit)";
      case "TAKE_PROFIT": return "جني أرباح (Take Profit)";
      default: return type;
    }
  };

  const getUserTypeBadgeColor = (type: string) => {
    switch (type) {
      case "USER": return "bg-blue-500/10 text-blue-400 border-blue-500/20";
      case "VERIFIED_USER": return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
      default: return "bg-gray-500/10 text-gray-400 border-gray-500/20";
    }
  };

  const getUserTypeIcon = (type: string) => {
    switch (type) {
      case "USER": return Shield;
      case "VERIFIED_USER": return ShieldCheck;
      default: return Shield;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="flex flex-col items-center gap-4">
          <span className="spinner h-8 w-8" />
          <p className="text-sm text-muted-foreground">جاري تحميل جدول الرسوم...</p>
        </div>
      </div>
    );
  }

  // Summary stats
  const userAvgMaker = fees.filter(f => f.user_type === "USER").reduce((s, f) => s + f.maker_fee, 0) / Math.max(1, fees.filter(f => f.user_type === "USER").length);
  const userAvgTaker = fees.filter(f => f.user_type === "USER").reduce((s, f) => s + f.taker_fee, 0) / Math.max(1, fees.filter(f => f.user_type === "USER").length);
  const verifiedAvgMaker = fees.filter(f => f.user_type === "VERIFIED_USER").reduce((s, f) => s + f.maker_fee, 0) / Math.max(1, fees.filter(f => f.user_type === "VERIFIED_USER").length);
  const verifiedAvgTaker = fees.filter(f => f.user_type === "VERIFIED_USER").reduce((s, f) => s + f.taker_fee, 0) / Math.max(1, fees.filter(f => f.user_type === "VERIFIED_USER").length);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ─── Header ─── */}
      <div className="animate-slide-in-down">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <Percent className="h-5 w-5 text-emerald-500" />
            </div>
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold">رسوم التداول</h1>
              <p className="text-sm text-muted-foreground">إدارة جدول رسوم العمولات حسب نوع المستخدم والأوردر</p>
            </div>
          </div>
          <button onClick={fetchFees} disabled={loading} className="btn-ghost flex items-center gap-2 text-sm">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            تحديث
          </button>
        </div>
      </div>

      {/* ─── Info Card ─── */}
      <div className="glass-panel rounded-2xl p-5 animate-slide-in-up delay-100">
        <div className="flex items-start gap-3">
          <div className="h-9 w-9 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
            <Info className="h-5 w-5 text-blue-400" />
          </div>
          <div className="text-sm text-muted-foreground space-y-1.5">
            <p><strong className="text-foreground">رسوم الصانع (Maker):</strong> تُطبق عندما يضع المستخدم أوردراً محدداً لا يتم تنفيذه فوراً ويضيف سيولة للسوق.</p>
            <p><strong className="text-foreground">رسوم الآخذ (Taker):</strong> تُطبق عندما يأخذ المستخدم أوردراً من السوق (تنفيذ فوري).</p>
            <p><strong className="text-foreground">الحد الأدنى للرسوم:</strong> أقل مبلغ يُخصم كرسوم بغض النظر عن نسبة العمولة.</p>
          </div>
        </div>
      </div>

      {/* ─── Stats Summary Row ─── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 animate-slide-in-up delay-200">
        <div className="stat-card stat-card-blue">
          <div className="relative z-10 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <TrendingUp className="h-4 w-4 text-blue-500" />
            </div>
            <div>
              <p className="text-lg font-bold">{(userAvgMaker * 100).toFixed(2)}%</p>
              <p className="text-[10px] text-muted-foreground">صانع - عادي</p>
            </div>
          </div>
        </div>
        <div className="stat-card stat-card-orange">
          <div className="relative z-10 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-orange-500/10">
              <TrendingDown className="h-4 w-4 text-orange-500" />
            </div>
            <div>
              <p className="text-lg font-bold">{(userAvgTaker * 100).toFixed(2)}%</p>
              <p className="text-[10px] text-muted-foreground">آخذ - عادي</p>
            </div>
          </div>
        </div>
        <div className="stat-card stat-card-emerald">
          <div className="relative z-10 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/10">
              <TrendingUp className="h-4 w-4 text-emerald-500" />
            </div>
            <div>
              <p className="text-lg font-bold">{(verifiedAvgMaker * 100).toFixed(2)}%</p>
              <p className="text-[10px] text-muted-foreground">صانع - موثق</p>
            </div>
          </div>
        </div>
        <div className="stat-card stat-card-teal">
          <div className="relative z-10 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-teal-500/10">
              <TrendingDown className="h-4 w-4 text-teal-500" />
            </div>
            <div>
              <p className="text-lg font-bold">{(verifiedAvgTaker * 100).toFixed(2)}%</p>
              <p className="text-[10px] text-muted-foreground">آخذ - موثق</p>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Fees Table ─── */}
      {fees.length === 0 ? (
        <div className="glass-panel rounded-2xl p-16 text-center animate-slide-in-up delay-300">
          <Percent className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground font-medium">لا توجد جداول رسوم</p>
          <p className="text-xs text-muted-foreground/60 mt-1">سيتم عرض جدول الرسوم هنا عند إضافته</p>
        </div>
      ) : (
        <div className="glass-panel rounded-2xl overflow-hidden animate-slide-in-up delay-300">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50 bg-muted/10">
                  <th className="text-right p-4 text-muted-foreground font-medium">نوع المستخدم</th>
                  <th className="text-right p-4 text-muted-foreground font-medium">نوع الأوردر</th>
                  <th className="text-right p-4 text-muted-foreground font-medium">رسوم الصانع (%)</th>
                  <th className="text-right p-4 text-muted-foreground font-medium">رسوم الآخذ (%)</th>
                  <th className="text-right p-4 text-muted-foreground font-medium">الحد الأدنى</th>
                  <th className="text-right p-4 text-muted-foreground font-medium">آخر تحديث</th>
                  <th className="text-right p-4 text-muted-foreground font-medium">إجراء</th>
                </tr>
              </thead>
              <tbody>
                {fees.map((fee) => {
                  const ev = editValues[fee.id];
                  const UserIcon = getUserTypeIcon(fee.user_type);
                  const hasChanged = changedIds.has(fee.id);
                  return (
                    <tr key={fee.id} className={`border-b border-border/20 hover:bg-muted/5 transition-all ${hasChanged ? "bg-primary/5" : ""}`}>
                      <td className="p-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border ${getUserTypeBadgeColor(fee.user_type)}`}>
                          <UserIcon className="h-3 w-3" />
                          {getUserTypeLabel(fee.user_type)}
                        </span>
                      </td>
                      <td className="p-4 font-medium text-sm">{getOrderTypeLabel(fee.order_type)}</td>
                      <td className="p-4">
                        <div className="relative">
                          <input
                            type="number"
                            step="0.001"
                            min="0"
                            max="100"
                            className={`input-field w-28 text-center font-mono text-sm ${hasChanged ? "border-primary/50 ring-1 ring-primary/20" : ""}`}
                            value={ev?.maker_fee || ""}
                            onChange={(e) => handleFieldChange(fee.id, "maker_fee", e.target.value)}
                          />
                          {hasChanged && (
                            <div className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-primary" />
                          )}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="relative">
                          <input
                            type="number"
                            step="0.001"
                            min="0"
                            max="100"
                            className={`input-field w-28 text-center font-mono text-sm ${hasChanged ? "border-primary/50 ring-1 ring-primary/20" : ""}`}
                            value={ev?.taker_fee || ""}
                            onChange={(e) => handleFieldChange(fee.id, "taker_fee", e.target.value)}
                          />
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="relative">
                          <input
                            type="number"
                            step="0.00000001"
                            min="0"
                            className={`input-field w-32 text-center font-mono text-sm ${hasChanged ? "border-primary/50 ring-1 ring-primary/20" : ""}`}
                            value={ev?.min_fee || ""}
                            onChange={(e) => handleFieldChange(fee.id, "min_fee", e.target.value)}
                          />
                        </div>
                      </td>
                      <td className="p-4 text-muted-foreground text-xs">
                        {fee.updated_at ? new Date(fee.updated_at).toLocaleDateString("ar-EG", { year: "numeric", month: "short", day: "numeric" }) : "—"}
                      </td>
                      <td className="p-4">
                        <button
                          onClick={() => handleSave(fee.id)}
                          disabled={saving === fee.id || !hasChanged}
                          className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium transition-all disabled:opacity-40 ${
                            hasChanged
                              ? "bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20"
                              : "bg-muted/20 text-muted-foreground"
                          }`}
                        >
                          {saving === fee.id ? <span className="spinner h-3.5 w-3.5" /> : <Save className="h-3.5 w-3.5" />}
                          حفظ
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── Fee Summary Cards ─── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-slide-in-up delay-400">
        <div className="glass-panel rounded-2xl p-5 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-l from-blue-500 to-blue-400/50" />
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <Shield className="h-4 w-4 text-blue-500" />
            </div>
            <h3 className="font-bold text-sm text-blue-400">مستخدم عادي</h3>
          </div>
          <div className="space-y-2 text-sm">
            {fees.filter(f => f.user_type === "USER").map(f => (
              <div key={f.id} className="flex justify-between items-center py-2 px-3 rounded-lg hover:bg-muted/10 transition-colors">
                <span className="text-muted-foreground text-xs">{getOrderTypeLabel(f.order_type)}</span>
                <div className="flex items-center gap-4">
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <TrendingUp className="h-3 w-3 text-blue-400" />
                    صانع: <span className="text-foreground font-medium">{(f.maker_fee * 100).toFixed(2)}%</span>
                  </span>
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <TrendingDown className="h-3 w-3 text-orange-400" />
                    آخذ: <span className="text-foreground font-medium">{(f.taker_fee * 100).toFixed(2)}%</span>
                  </span>
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <DollarSign className="h-3 w-3 text-muted-foreground" />
                    <span className="text-foreground font-mono">{f.min_fee.toFixed(8)}</span>
                  </span>
                </div>
              </div>
            ))}
            {fees.filter(f => f.user_type === "USER").length === 0 && (
              <p className="text-xs text-muted-foreground/60 text-center py-4">لا توجد بيانات</p>
            )}
          </div>
        </div>
        <div className="glass-panel rounded-2xl p-5 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-l from-emerald-500 to-teal-400/50" />
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <ShieldCheck className="h-4 w-4 text-emerald-500" />
            </div>
            <h3 className="font-bold text-sm text-emerald-400">مستخدم موثق</h3>
          </div>
          <div className="space-y-2 text-sm">
            {fees.filter(f => f.user_type === "VERIFIED_USER").map(f => (
              <div key={f.id} className="flex justify-between items-center py-2 px-3 rounded-lg hover:bg-muted/10 transition-colors">
                <span className="text-muted-foreground text-xs">{getOrderTypeLabel(f.order_type)}</span>
                <div className="flex items-center gap-4">
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <TrendingUp className="h-3 w-3 text-emerald-400" />
                    صانع: <span className="text-foreground font-medium">{(f.maker_fee * 100).toFixed(2)}%</span>
                  </span>
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <TrendingDown className="h-3 w-3 text-orange-400" />
                    آخذ: <span className="text-foreground font-medium">{(f.taker_fee * 100).toFixed(2)}%</span>
                  </span>
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <DollarSign className="h-3 w-3 text-muted-foreground" />
                    <span className="text-foreground font-mono">{f.min_fee.toFixed(8)}</span>
                  </span>
                </div>
              </div>
            ))}
            {fees.filter(f => f.user_type === "VERIFIED_USER").length === 0 && (
              <p className="text-xs text-muted-foreground/60 text-center py-4">لا توجد بيانات</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
