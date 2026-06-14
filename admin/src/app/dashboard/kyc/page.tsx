"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Check, X, Search } from "lucide-react";
import PromptDialog from "@/components/PromptDialog";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

export default function AdminKYCPage() {
  const [requests, setRequests] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [rejectTarget, setRejectTarget] = useState<number | null>(null);

  const fetchKYC = () => {
    const token = localStorage.getItem("token");
    if (!token) return;
    setLoading(true);
    fetch(`${API}/api/v1/admin/kyc`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => {
        const data = d.data;
        setRequests(Array.isArray(data) ? data : []);
      }).catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchKYC(); }, []);

  const handleReview = async (id: number, status: string, rejectionReason = "") => {
    const token = localStorage.getItem("token");
    try {
      const body: any = { status };
      if (status === "REJECTED" && rejectionReason) {
        body.rejection_reason = rejectionReason;
      }
      const res = await fetch(`${API}/api/v1/admin/kyc/${id}/review`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "فشل المراجعة"); return; }
      toast.success(status === "APPROVED" ? "تم توثيق المستخدم" : "تم رفض الطلب");
      fetchKYC();
    } catch { toast.error("حدث خطأ في الاتصال"); }
  };

  const filtered = requests.filter(r =>
    r.user?.username?.toLowerCase().includes(search.toLowerCase()) ||
    r.user?.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">طلبات KYC</h1>
        <p className="text-muted-foreground mt-1">مراجعة طلبات توثيق الهوية</p>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input type="text" className="input-field pr-10" placeholder="بحث..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="glass-panel rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50">
                <th className="text-right p-4 text-muted-foreground font-medium">المستخدم</th>
                <th className="text-right p-4 text-muted-foreground font-medium">البريد</th>
                <th className="text-right p-4 text-muted-foreground font-medium">نوع الهوية</th>
                <th className="text-right p-4 text-muted-foreground font-medium">الحالة</th>
                <th className="text-right p-4 text-muted-foreground font-medium">تاريخ الطلب</th>
                <th className="text-right p-4 text-muted-foreground font-medium">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((req: any, i: number) => (
                <tr key={i} className="border-b border-border/20 hover:bg-muted/10 transition-all">
                  <td className="p-4 font-medium">{req.user?.username || req.username || "—"}</td>
                  <td className="p-4 text-muted-foreground">{req.user?.email || req.email || "—"}</td>
                  <td className="p-4">{req.document_type || "—"}</td>
                  <td className="p-4">
                    <span className={`text-[11px] px-2 py-0.5 rounded font-medium ${
                      req.status === "APPROVED" ? "bg-emerald-500/10 text-emerald-500" :
                      req.status === "PENDING" ? "bg-yellow-500/10 text-yellow-500" :
                      "bg-red-500/10 text-red-500"
                    }`}>
                      {req.status === "APPROVED" ? "موثق" : req.status === "PENDING" ? "قيد المراجعة" : "مرفوض"}
                    </span>
                  </td>
                  <td className="p-4 text-muted-foreground text-xs">{req.created_at ? new Date(req.created_at).toLocaleDateString("ar-EG") : "—"}</td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      {req.status === "PENDING" && (
                        <>
                          <button onClick={() => handleReview(req.id, "APPROVED")} className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 transition-all" title="موافقة"><Check className="h-4 w-4" /></button>
                          <button onClick={() => setRejectTarget(req.id)} className="p-2 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-all" title="رفض"><X className="h-4 w-4" /></button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!loading && filtered.length === 0 && <div className="text-center py-12 text-muted-foreground">لا توجد طلبات KYC</div>}
      </div>

      {/* Rejection Prompt Dialog */}
      <PromptDialog
        open={rejectTarget !== null}
        title="رفض طلب التحقق"
        message="أدخل سبب الرفض. سيتم إرسال هذا السبب للمستخدم."
        placeholder="مثال: الصورة غير واضحة"
        confirmLabel="رفض"
        cancelLabel="إلغاء"
        onConfirm={(reason) => {
          if (rejectTarget) handleReview(rejectTarget, "REJECTED", reason);
          setRejectTarget(null);
        }}
        onCancel={() => setRejectTarget(null)}
      />
    </div>
  );
}
