"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import {
  FileText,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  User,
  CreditCard,
  Fingerprint,
  CalendarDays,
  ExternalLink,
  Inbox,
  Filter,
  ChevronLeft,
  ChevronRight,
  X,
  AlertTriangle,
  ShieldCheck,
  ShieldAlert,
  Eye,
} from "lucide-react";
import { authGet, authPut } from "@/lib/api";

interface KYCRequest {
  id: number;
  user_id: number;
  username: string;
  email: string;
  full_name: string;
  document_type: string;
  document_number: string;
  document_url: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  rejection_reason: string;
  created_at: string;
  reviewed_at?: string;
}

const STATUS_TABS = [
  { value: "", label: "الكل", icon: Filter },
  { value: "PENDING", label: "معلق", icon: Clock },
  { value: "APPROVED", label: "مقبول", icon: CheckCircle2 },
  { value: "REJECTED", label: "مرفوض", icon: XCircle },
];

const getDocTypeLabel = (type: string) => {
  switch (type) {
    case "passport": return "جواز سفر";
    case "national_id": return "بطاقة وطنية";
    case "driving_license": return "رخصة قيادة";
    default: return type;
  }
};

export default function AdminKYCPage() {
  const [requests, setRequests] = useState<KYCRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [reviewing, setReviewing] = useState<number | null>(null);
  const [reviewModal, setReviewModal] = useState<{ id: number; action: "APPROVED" | "REJECTED" } | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const limit = 20;
  const totalPages = Math.ceil(total / limit);

  useEffect(() => {
    fetchRequests();
  }, [statusFilter, page]);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      params.set("page", page.toString());
      params.set("limit", limit.toString());
      const res = await authGet(`/api/v1/admin/kyc?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setRequests(Array.isArray(data.data) ? data.data : []);
        setTotal(data.total || 0);
      } else {
        toast.error("فشل تحميل طلبات التحقق");
      }
    } catch {
      toast.error("حدث خطأ في الاتصال");
    } finally {
      setLoading(false);
    }
  };

  const handleReview = async () => {
    if (!reviewModal) return;
    if (reviewModal.action === "REJECTED" && !rejectionReason.trim()) {
      toast.error("يرجى إدخال سبب الرفض");
      return;
    }
    setReviewing(reviewModal.id);
    try {
      const body: any = { status: reviewModal.action };
      if (reviewModal.action === "REJECTED") {
        body.rejection_reason = rejectionReason;
      }
      const res = await authPut(`/api/v1/admin/kyc/${reviewModal.id}/review`, body);
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "فشل مراجعة الطلب");
        return;
      }
      toast.success(data.message || `تم ${reviewModal.action === "APPROVED" ? "قبول" : "رفض"} الطلب بنجاح`);
      setRequests(prev =>
        prev.map(r => r.id === reviewModal.id ? { ...r, status: reviewModal.action, rejection_reason: reviewModal.action === "REJECTED" ? rejectionReason : r.rejection_reason } : r)
      );
      setReviewModal(null);
      setRejectionReason("");
    } catch {
      toast.error("حدث خطأ في الاتصال");
    } finally {
      setReviewing(null);
    }
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case "APPROVED":
        return {
          label: "مقبول",
          cls: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
          icon: ShieldCheck,
          dotColor: "bg-emerald-500",
        };
      case "PENDING":
        return {
          label: "معلق",
          cls: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
          icon: Clock,
          dotColor: "bg-yellow-500",
        };
      case "REJECTED":
        return {
          label: "مرفوض",
          cls: "bg-red-500/10 text-red-400 border-red-500/20",
          icon: ShieldAlert,
          dotColor: "bg-red-500",
        };
      default:
        return {
          label: status,
          cls: "bg-gray-500/10 text-gray-400 border-gray-500/20",
          icon: Clock,
          dotColor: "bg-gray-500",
        };
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="animate-slide-in-up">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <FileText className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">طلبات التحقق (KYC)</h1>
            <p className="text-muted-foreground text-sm mt-0.5">مراجعة طلبات التحقق من الهوية</p>
          </div>
        </div>
      </div>

      {/* ── Filter Tabs ── */}
      <div className="glass-panel rounded-2xl p-3 animate-slide-in-up" style={{ animationDelay: "80ms" }}>
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Filter className="h-4 w-4 text-primary" />
          </div>
          {STATUS_TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.value}
                onClick={() => { setStatusFilter(tab.value); setPage(1); }}
                className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm whitespace-nowrap transition-all duration-200 ${
                  statusFilter === tab.value
                    ? "bg-primary/15 text-primary font-semibold shadow-sm shadow-primary/10"
                    : "text-muted-foreground hover:bg-muted/30 hover:text-foreground"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            );
          })}
          {total > 0 && (
            <span className="text-xs text-muted-foreground mr-auto flex items-center gap-1.5 pr-2">
              {total} طلب
            </span>
          )}
        </div>
      </div>

      {/* ── KYC Cards ── */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="h-16 w-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
          </div>
          <p className="text-sm text-muted-foreground">جاري تحميل الطلبات...</p>
        </div>
      ) : requests.length === 0 ? (
        <div className="glass-panel rounded-2xl flex flex-col items-center justify-center py-20 text-center animate-fade-in">
          <div className="h-20 w-20 rounded-2xl bg-muted/20 flex items-center justify-center mb-5">
            <Inbox className="h-10 w-10 text-muted-foreground/30" />
          </div>
          <h3 className="text-lg font-bold mb-2">لا توجد طلبات</h3>
          <p className="text-sm text-muted-foreground max-w-xs">لا توجد طلبات تحقق مطابقة للفلتر المحدد</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {requests.map((req, i) => {
            const statusConfig = getStatusConfig(req.status);
            const StatusIcon = statusConfig.icon;
            return (
              <div
                key={req.id}
                className="glass-panel rounded-2xl p-5 animate-slide-in-up"
                style={{ animationDelay: `${Math.min(i * 60, 400)}ms` }}
              >
                {/* Top row: status + user */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shrink-0">
                      <span className="text-sm font-bold text-white">{req.username?.charAt(0)?.toUpperCase() || "U"}</span>
                    </div>
                    <div>
                      <p className="font-semibold text-sm">{req.username}</p>
                      <p className="text-xs text-muted-foreground" dir="ltr">{req.email}</p>
                    </div>
                  </div>
                  <span className={`inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full font-semibold border ${statusConfig.cls}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${statusConfig.dotColor}`} />
                    {statusConfig.label}
                  </span>
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-2 gap-2.5 mb-4">
                  <div className="bg-background/60 rounded-xl p-3 border border-border/20">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <User className="h-3 w-3 text-muted-foreground" />
                      <p className="text-[10px] text-muted-foreground">الاسم الكامل</p>
                    </div>
                    <p className="text-xs font-semibold">{req.full_name}</p>
                  </div>
                  <div className="bg-background/60 rounded-xl p-3 border border-border/20">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <CreditCard className="h-3 w-3 text-muted-foreground" />
                      <p className="text-[10px] text-muted-foreground">نوع المستند</p>
                    </div>
                    <p className="text-xs font-semibold">{getDocTypeLabel(req.document_type)}</p>
                  </div>
                  <div className="bg-background/60 rounded-xl p-3 border border-border/20">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Fingerprint className="h-3 w-3 text-muted-foreground" />
                      <p className="text-[10px] text-muted-foreground">رقم المستند</p>
                    </div>
                    <p className="text-xs font-semibold font-mono" dir="ltr">{req.document_number}</p>
                  </div>
                  <div className="bg-background/60 rounded-xl p-3 border border-border/20">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <CalendarDays className="h-3 w-3 text-muted-foreground" />
                      <p className="text-[10px] text-muted-foreground">تاريخ التقديم</p>
                    </div>
                    <p className="text-xs font-semibold">
                      {new Date(req.created_at).toLocaleDateString("ar-EG")}
                    </p>
                  </div>
                </div>

                {/* Document Link */}
                {req.document_url && (
                  <a
                    href={req.document_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 p-2.5 rounded-xl bg-blue-500/5 border border-blue-500/10 hover:bg-blue-500/10 transition-all duration-200 mb-4 text-xs text-blue-400"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    عرض المستند
                    <ExternalLink className="h-3 w-3 mr-auto" />
                  </a>
                )}

                {/* Rejection Reason */}
                {req.status === "REJECTED" && req.rejection_reason && (
                  <div className="p-3 rounded-xl bg-red-500/5 border border-red-500/10 mb-4">
                    <div className="flex items-center gap-2 mb-1.5">
                      <AlertTriangle className="h-3.5 w-3.5 text-red-400" />
                      <p className="text-[11px] font-semibold text-red-400">سبب الرفض</p>
                    </div>
                    <p className="text-xs text-muted-foreground">{req.rejection_reason}</p>
                  </div>
                )}

                {/* Actions */}
                {req.status === "PENDING" && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => setReviewModal({ id: req.id, action: "APPROVED" })}
                      disabled={reviewing === req.id}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500/10 text-emerald-400 text-xs font-semibold border border-emerald-500/20 hover:bg-emerald-500/20 transition-all duration-200"
                    >
                      {reviewing === req.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                      قبول
                    </button>
                    <button
                      onClick={() => { setReviewModal({ id: req.id, action: "REJECTED" }); setRejectionReason(""); }}
                      disabled={reviewing === req.id}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-red-500/10 text-red-400 text-xs font-semibold border border-red-500/20 hover:bg-red-500/20 transition-all duration-200"
                    >
                      {reviewing === req.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
                      رفض
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 animate-slide-in-up">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="btn-ghost text-sm gap-1 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronRight className="h-4 w-4" />
            السابق
          </button>
          <div className="flex items-center gap-1 mx-2">
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum: number;
              if (totalPages <= 5) pageNum = i + 1;
              else if (page <= 3) pageNum = i + 1;
              else if (page >= totalPages - 2) pageNum = totalPages - 4 + i;
              else pageNum = page - 2 + i;
              return (
                <button
                  key={pageNum}
                  onClick={() => setPage(pageNum)}
                  className={`w-9 h-9 rounded-xl text-sm font-medium transition-all duration-200 ${
                    pageNum === page
                      ? "bg-primary/15 text-primary shadow-sm shadow-primary/10"
                      : "text-muted-foreground hover:bg-muted/30 hover:text-foreground"
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}
          </div>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="btn-ghost text-sm gap-1 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            التالي
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-xs text-muted-foreground pr-3 border-r border-border/30 mr-2">
            صفحة <span className="font-semibold text-foreground">{page}</span> من {totalPages}
          </span>
        </div>
      )}

      {/* ── Review Modal ── */}
      {reviewModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-fade-in" style={{ backdropFilter: "blur(4px)" }}>
          <div className="glass-panel-strong rounded-2xl p-6 w-full max-w-md animate-scale-in">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${
                  reviewModal.action === "APPROVED" ? "bg-emerald-500/10" : "bg-red-500/10"
                }`}>
                  {reviewModal.action === "APPROVED" ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-500" />
                  )}
                </div>
                <h3 className="font-bold">
                  {reviewModal.action === "APPROVED" ? "تأكيد قبول الطلب" : "تأكيد رفض الطلب"}
                </h3>
              </div>
              <button onClick={() => { setReviewModal(null); setRejectionReason(""); }} className="btn-ghost p-1.5 rounded-lg">
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-sm text-muted-foreground mb-4">
              {reviewModal.action === "APPROVED"
                ? "هل أنت متأكد من قبول طلب التحقق هذا؟ سيتم منح المستخدم صلاحيات التحقق الكاملة."
                : "يرجى إدخال سبب الرفض. سيتم إرساله للمستخدم."}
            </p>

            {reviewModal.action === "REJECTED" && (
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">سبب الرفض *</label>
                <textarea
                  className="input-field min-h-[100px] resize-none"
                  placeholder="أدخل سبب الرفض..."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                />
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={handleReview}
                disabled={reviewing !== null || (reviewModal.action === "REJECTED" && !rejectionReason.trim())}
                className={`flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 disabled:opacity-50 ${
                  reviewModal.action === "APPROVED"
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/30"
                    : "bg-red-500/20 text-red-400 border border-red-500/20 hover:bg-red-500/30"
                }`}
              >
                {reviewing !== null ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {reviewModal.action === "APPROVED" ? "تأكيد القبول" : "تأكيد الرفض"}
              </button>
              <button
                onClick={() => { setReviewModal(null); setRejectionReason(""); }}
                className="btn-ghost flex-1"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
