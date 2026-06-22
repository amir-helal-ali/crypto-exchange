"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import {
  Check,
  X,
  Search,
  Eye,
  ShieldCheck,
  Clock,
  CheckCircle2,
  XCircle,
  FileText,
  User,
  Calendar,
  Filter,
  Wifi,
} from "lucide-react";
import PromptDialog from "@/components/PromptDialog";
import { authGet, authPut } from "@/lib/api";
import { adminStream } from "@/lib/stream";

export default function AdminKYCPage() {
  const [requests, setRequests] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [rejectTarget, setRejectTarget] = useState<number | null>(null);
  const [previewDoc, setPreviewDoc] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [liveNewCount, setLiveNewCount] = useState(0);

  const fetchKYC = () => {
    const token = localStorage.getItem("token");
    if (!token) return;
    setLoading(true);
    authGet("/api/v1/admin/kyc")
      .then((r) => r.json())
      .then((d) => {
        const data = d.data;
        setRequests(Array.isArray(data) ? data : []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchKYC();
  }, []);

  // Live updates via SSE — refresh when a new KYC submission arrives
  useEffect(() => {
    const unsub = adminStream.on("kyc", () => {
      setLiveNewCount((n) => n + 1);
      // Silent refresh if no filter/search is active
      if (statusFilter === "ALL" && !search) {
        const token = localStorage.getItem("token");
        if (!token) return;
        authGet("/api/v1/admin/kyc")
          .then((r) => r.json())
          .then((d) => {
            const data = d.data;
            if (Array.isArray(data)) setRequests(data);
          })
          .catch(() => {});
      }
    });
    return unsub;
  }, [statusFilter, search]);

  const handleReview = async (
    id: number,
    status: string,
    rejectionReason = ""
  ) => {
    try {
      const body: any = { status };
      if (status === "REJECTED" && rejectionReason) {
        body.rejection_reason = rejectionReason;
      }
      const res = await authPut(`/api/v1/admin/kyc/${id}/review`, body);
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "فشل المراجعة");
        return;
      }
      toast.success(
        status === "APPROVED" ? "تم توثيق المستخدم" : "تم رفض الطلب"
      );
      fetchKYC();
    } catch {
      toast.error("حدث خطأ في الاتصال");
    }
  };

  const filtered = requests
    .filter((r) => {
      const matchesSearch =
        r.user?.username?.toLowerCase().includes(search.toLowerCase()) ||
        r.user?.email?.toLowerCase().includes(search.toLowerCase());
      const matchesStatus =
        statusFilter === "ALL" || r.status === statusFilter;
      return matchesSearch && matchesStatus;
    });

  // Stats
  const pendingCount = requests.filter((r) => r.status === "PENDING").length;
  const approvedCount = requests.filter((r) => r.status === "APPROVED").length;
  const rejectedCount = requests.filter((r) => r.status === "REJECTED").length;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "APPROVED":
        return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
      case "PENDING":
        return "bg-yellow-500/10 text-yellow-400 border-yellow-500/20";
      case "REJECTED":
        return "bg-red-500/10 text-red-400 border-red-500/20";
      default:
        return "bg-muted/20 text-muted-foreground border-border/30";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "APPROVED":
        return "موثق";
      case "PENDING":
        return "قيد المراجعة";
      case "REJECTED":
        return "مرفوض";
      default:
        return status;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "APPROVED":
        return CheckCircle2;
      case "PENDING":
        return Clock;
      case "REJECTED":
        return XCircle;
      default:
        return Clock;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="flex flex-col items-center gap-4">
          <span className="spinner h-8 w-8" />
          <p className="text-sm text-muted-foreground">جاري تحميل طلبات KYC...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ─── Header ─── */}
      <div className="animate-slide-in-down">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
            <ShieldCheck className="h-5 w-5 text-emerald-500" />
          </div>
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold">طلبات KYC</h1>
            <p className="text-sm text-muted-foreground">
              مراجعة طلبات توثيق الهوية والتحقق من المستندات
            </p>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Wifi className="h-3.5 w-3.5" />
              <span>مباشر</span>
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
            </div>
            {liveNewCount > 0 && (
              <button
                onClick={() => { setLiveNewCount(0); fetchKYC(); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 transition-colors animate-pulse"
              >
                <FileText className="h-3.5 w-3.5" />
                <span>{liveNewCount} جديد — تحديث</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ─── Stats Row ─── */}
      <div className="grid grid-cols-3 gap-3 animate-slide-in-up delay-100">
        <div className="stat-card stat-card-yellow">
          <div className="relative z-10 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-yellow-500/10">
              <Clock className="h-5 w-5 text-yellow-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{pendingCount}</p>
              <p className="text-[11px] text-muted-foreground font-medium">
                قيد المراجعة
              </p>
            </div>
          </div>
        </div>
        <div className="stat-card stat-card-emerald">
          <div className="relative z-10 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{approvedCount}</p>
              <p className="text-[11px] text-muted-foreground font-medium">
                تمت الموافقة
              </p>
            </div>
          </div>
        </div>
        <div className="stat-card stat-card-red">
          <div className="relative z-10 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-red-500/10">
              <XCircle className="h-5 w-5 text-red-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{rejectedCount}</p>
              <p className="text-[11px] text-muted-foreground font-medium">
                مرفوضة
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Search & Filter Bar ─── */}
      <div className="glass-panel rounded-2xl p-4 animate-slide-in-up delay-200">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
            <input
              type="text"
              className="input-field pr-10"
              placeholder="بحث باسم المستخدم أو البريد الإلكتروني..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Status Filter */}
          <div className="relative">
            <Filter className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50 pointer-events-none" />
            <select
              className="input-field pr-10 appearance-none min-w-[160px]"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="ALL">جميع الحالات</option>
              <option value="PENDING">قيد المراجعة</option>
              <option value="APPROVED">موثق</option>
              <option value="REJECTED">مرفوض</option>
            </select>
          </div>
        </div>
      </div>

      {/* ─── KYC Requests Table ─── */}
      <div className="glass-panel rounded-2xl overflow-hidden animate-slide-in-up delay-300">
        {filtered.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/20">
                  <th className="text-right p-4 text-muted-foreground font-medium text-xs">
                    المستخدم
                  </th>
                  <th className="text-right p-4 text-muted-foreground font-medium text-xs hidden md:table-cell">
                    البريد الإلكتروني
                  </th>
                  <th className="text-right p-4 text-muted-foreground font-medium text-xs hidden lg:table-cell">
                    نوع الهوية
                  </th>
                  <th className="text-right p-4 text-muted-foreground font-medium text-xs">
                    المستند
                  </th>
                  <th className="text-right p-4 text-muted-foreground font-medium text-xs">
                    الحالة
                  </th>
                  <th className="text-right p-4 text-muted-foreground font-medium text-xs hidden md:table-cell">
                    التاريخ
                  </th>
                  <th className="text-right p-4 text-muted-foreground font-medium text-xs">
                    إجراءات
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((req: any, i: number) => {
                  const StatusIcon = getStatusIcon(req.status);
                  return (
                    <tr
                      key={i}
                      className="border-b border-border/10 hover:bg-muted/10 transition-colors duration-150"
                    >
                      {/* User */}
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-full bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center text-sm font-bold text-primary border border-primary/20">
                            {(req.user?.username || req.username || "U")
                              .charAt(0)
                              .toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium text-sm">
                              {req.user?.username || req.username || "—"}
                            </p>
                            <p className="text-xs text-muted-foreground md:hidden">
                              {req.user?.email || req.email || "—"}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Email */}
                      <td className="p-4 text-muted-foreground text-xs hidden md:table-cell">
                        {req.user?.email || req.email || "—"}
                      </td>

                      {/* Document Type */}
                      <td className="p-4 text-xs hidden lg:table-cell">
                        <div className="flex items-center gap-1.5">
                          <FileText className="h-3 w-3 text-muted-foreground/40" />
                          {req.document_type || "—"}
                        </div>
                      </td>

                      {/* Document Preview */}
                      <td className="p-4">
                        {req.document_url ? (
                          <button
                            onClick={() => setPreviewDoc(req.document_url)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-all text-xs font-medium border border-blue-500/20"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            عرض المستند
                          </button>
                        ) : (
                          <span className="text-xs text-muted-foreground/50">
                            لا يوجد مستند
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="p-4">
                        <span
                          className={`inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg font-medium border ${getStatusBadge(
                            req.status
                          )}`}
                        >
                          <StatusIcon className="h-3 w-3" />
                          {getStatusLabel(req.status)}
                        </span>
                        {req.rejection_reason && req.status === "REJECTED" && (
                          <p
                            className="text-xs text-red-400/80 mt-1.5 max-w-[200px] truncate"
                            title={req.rejection_reason}
                          >
                            {req.rejection_reason}
                          </p>
                        )}
                      </td>

                      {/* Date */}
                      <td className="p-4 text-muted-foreground text-xs hidden md:table-cell">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-3 w-3 text-muted-foreground/40" />
                          {req.created_at
                            ? new Date(req.created_at).toLocaleDateString(
                                "ar-EG",
                                {
                                  year: "numeric",
                                  month: "short",
                                  day: "numeric",
                                }
                              )
                            : "—"}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="p-4">
                        {req.status === "PENDING" ? (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() =>
                                handleReview(req.id, "APPROVED")
                              }
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-all text-xs font-medium border border-emerald-500/20"
                              title="موافقة"
                            >
                              <Check className="h-3.5 w-3.5" />
                              <span className="hidden sm:inline">موافقة</span>
                            </button>
                            <button
                              onClick={() => setRejectTarget(req.id)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all text-xs font-medium border border-red-500/20"
                              title="رفض"
                            >
                              <X className="h-3.5 w-3.5" />
                              <span className="hidden sm:inline">رفض</span>
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground/40">
                            —
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          /* Empty State */
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-20 h-20 rounded-2xl bg-muted/20 flex items-center justify-center mb-4">
              <ShieldCheck className="h-10 w-10 text-muted-foreground/30" />
            </div>
            <p className="text-sm text-muted-foreground font-medium">
              {search || statusFilter !== "ALL"
                ? "لا توجد نتائج مطابقة للبحث"
                : "لا توجد طلبات KYC"}
            </p>
            <p className="text-xs text-muted-foreground/50 mt-1">
              {search || statusFilter !== "ALL"
                ? "جرب تغيير معايير البحث أو الفلتر"
                : "ستظهر طلبات التوثيق هنا عند تقديمها من المستخدمين"}
            </p>
          </div>
        )}
      </div>

      {/* ─── Document Preview Modal ─── */}
      {previewDoc && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in"
          onClick={() => setPreviewDoc(null)}
        >
          <div
            className="relative max-w-4xl max-h-[90vh] w-full mx-4 animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="glass-panel-strong rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-blue-500/10">
                    <FileText className="h-4 w-4 text-blue-400" />
                  </div>
                  <h3 className="text-lg font-bold">معاينة المستند</h3>
                </div>
                <button
                  onClick={() => setPreviewDoc(null)}
                  className="p-2 rounded-xl hover:bg-muted/30 transition-all"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="rounded-xl overflow-hidden bg-muted/10 max-h-[70vh] overflow-auto">
                {previewDoc.match(/\.(jpg|jpeg|png|gif|webp)$/i) ||
                !previewDoc.match(/\.pdf$/i) ? (
                  <img
                    src={`${
                      process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"
                    }${previewDoc}`}
                    alt="مستند KYC"
                    className="w-full h-auto"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = "";
                      (e.target as HTMLImageElement).alt = "فشل تحميل المستند";
                    }}
                  />
                ) : (
                  <iframe
                    src={`${
                      process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"
                    }${previewDoc}`}
                    className="w-full h-[70vh]"
                    title="مستند KYC"
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Rejection Prompt Dialog ─── */}
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
