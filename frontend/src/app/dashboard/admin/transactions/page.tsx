"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import {
  ArrowRightLeft,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Inbox,
  Filter,
  ChevronLeft,
  ChevronRight,
  X,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  DollarSign,
  CalendarDays,
  Hash,
  User,
  Banknote,
  SendHorizonal,
} from "lucide-react";
import { authGet, authPut } from "@/lib/api";

interface Transaction {
  id: number;
  user_id: number;
  username: string;
  email: string;
  type: "DEPOSIT" | "WITHDRAWAL";
  currency: string;
  amount: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  rejection_reason: string;
  tx_hash: string;
  wallet_address: string;
  created_at: string;
  reviewed_at?: string;
}

const STATUS_TABS = [
  { value: "", label: "الكل", icon: Filter },
  { value: "PENDING", label: "معلق", icon: Clock },
  { value: "APPROVED", label: "مقبول", icon: CheckCircle2 },
  { value: "REJECTED", label: "مرفوض", icon: XCircle },
];

const TYPE_TABS = [
  { value: "", label: "الكل" },
  { value: "DEPOSIT", label: "إيداع" },
  { value: "WITHDRAWAL", label: "سحب" },
];

export default function AdminTransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [reviewing, setReviewing] = useState<number | null>(null);
  const [reviewModal, setReviewModal] = useState<{ id: number; action: "APPROVED" | "REJECTED"; type: string } | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const limit = 20;
  const totalPages = Math.ceil(total / limit);

  useEffect(() => {
    fetchTransactions();
  }, [statusFilter, typeFilter, page]);

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      if (typeFilter) params.set("type", typeFilter);
      params.set("page", page.toString());
      params.set("limit", limit.toString());
      const res = await authGet(`/api/v1/admin/transactions?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setTransactions(Array.isArray(data.data) ? data.data : []);
        setTotal(data.total || 0);
      } else {
        toast.error("فشل تحميل المعاملات");
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
      const res = await authPut(`/api/v1/admin/transactions/${reviewModal.id}/review`, body);
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "فشل مراجعة المعاملة");
        return;
      }
      toast.success(data.message || `تم ${reviewModal.action === "APPROVED" ? "قبول" : "رفض"} المعاملة بنجاح`);
      setTransactions(prev =>
        prev.map(t => t.id === reviewModal.id ? { ...t, status: reviewModal.action, rejection_reason: reviewModal.action === "REJECTED" ? rejectionReason : t.rejection_reason } : t)
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
        return { label: "مقبول", cls: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20", dotColor: "bg-emerald-500" };
      case "PENDING":
        return { label: "معلق", cls: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20", dotColor: "bg-yellow-500" };
      case "REJECTED":
        return { label: "مرفوض", cls: "bg-red-500/10 text-red-400 border-red-500/20", dotColor: "bg-red-500" };
      default:
        return { label: status, cls: "bg-gray-500/10 text-gray-400 border-gray-500/20", dotColor: "bg-gray-500" };
    }
  };

  const getTypeConfig = (type: string) => {
    switch (type) {
      case "DEPOSIT":
        return { label: "إيداع", icon: Banknote, color: "text-emerald-400", bg: "bg-emerald-500/10" };
      case "WITHDRAWAL":
        return { label: "سحب", icon: SendHorizonal, color: "text-red-400", bg: "bg-red-500/10" };
      default:
        return { label: type, icon: ArrowRightLeft, color: "text-muted-foreground", bg: "bg-muted/20" };
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="animate-slide-in-up">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <ArrowRightLeft className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">إدارة المعاملات</h1>
            <p className="text-muted-foreground text-sm mt-0.5">مراجعة ومعالجة عمليات الإيداع والسحب</p>
          </div>
        </div>
      </div>

      {/* ── Info Banner ── */}
      <div className="p-4 rounded-2xl bg-blue-500/5 border border-blue-500/15 animate-slide-in-up" style={{ animationDelay: "50ms" }}>
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-blue-400 shrink-0 mt-0.5" />
          <div className="text-sm text-muted-foreground leading-relaxed">
            <p><span className="font-semibold text-foreground">ملاحظة: </span>قبول إيداع سيتم إضافة الرصيد للمستخدم. رفض سحب سيتم إرجاع الرصيد للمستخدم.</p>
          </div>
        </div>
      </div>

      {/* ── Filter Tabs ── */}
      <div className="glass-panel rounded-2xl p-3 animate-slide-in-up" style={{ animationDelay: "80ms" }}>
        <div className="flex flex-wrap items-center gap-2">
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
          <div className="h-6 w-px bg-border/30 mx-1" />
          {TYPE_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => { setTypeFilter(tab.value); setPage(1); }}
              className={`inline-flex items-center px-3 py-2 rounded-xl text-sm whitespace-nowrap transition-all duration-200 ${
                typeFilter === tab.value
                  ? "bg-blue-500/15 text-blue-400 font-semibold"
                  : "text-muted-foreground hover:bg-muted/30 hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
          {total > 0 && (
            <span className="text-xs text-muted-foreground mr-auto flex items-center gap-1.5 pr-2">
              {total} معاملة
            </span>
          )}
        </div>
      </div>

      {/* ── Transactions Table ── */}
      <div className="glass-panel rounded-2xl overflow-hidden animate-slide-in-up" style={{ animationDelay: "160ms" }}>
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="h-16 w-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
            </div>
            <p className="text-sm text-muted-foreground">جاري تحميل المعاملات...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/40 bg-muted/20">
                  <th className="text-right p-4 text-muted-foreground font-medium">
                    <div className="flex items-center gap-1.5"><Hash className="h-3.5 w-3.5" /> رقم</div>
                  </th>
                  <th className="text-right p-4 text-muted-foreground font-medium">
                    <div className="flex items-center gap-1.5"><User className="h-3.5 w-3.5" /> المستخدم</div>
                  </th>
                  <th className="text-right p-4 text-muted-foreground font-medium">النوع</th>
                  <th className="text-right p-4 text-muted-foreground font-medium">
                    <div className="flex items-center gap-1.5"><DollarSign className="h-3.5 w-3.5" /> المبلغ</div>
                  </th>
                  <th className="text-right p-4 text-muted-foreground font-medium">الحالة</th>
                  <th className="text-right p-4 text-muted-foreground font-medium">
                    <div className="flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" /> التاريخ</div>
                  </th>
                  <th className="text-right p-4 text-muted-foreground font-medium">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => {
                  const statusConfig = getStatusConfig(tx.status);
                  const typeConfig = getTypeConfig(tx.type);
                  const TypeIcon = typeConfig.icon;
                  return (
                    <tr key={tx.id} className="border-b border-border/15 hover:bg-emerald-500/[0.03] transition-all duration-200">
                      <td className="p-4 font-mono text-xs text-muted-foreground">#{tx.id}</td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <div className="h-7 w-7 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shrink-0">
                            <span className="text-[10px] font-bold text-white">{tx.username?.charAt(0)?.toUpperCase() || "U"}</span>
                          </div>
                          <div>
                            <p className="text-xs font-semibold">{tx.username}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold ${typeConfig.bg} ${typeConfig.color}`}>
                          <TypeIcon className="h-3 w-3" />
                          {typeConfig.label}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className="font-semibold tabular-nums">{parseFloat(tx.amount || "0").toFixed(4)}</span>
                        <span className="text-xs text-muted-foreground mr-1">{tx.currency}</span>
                      </td>
                      <td className="p-4">
                        <span className={`inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full font-semibold border ${statusConfig.cls}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${statusConfig.dotColor}`} />
                          {statusConfig.label}
                        </span>
                      </td>
                      <td className="p-4 text-muted-foreground text-xs">
                        {new Date(tx.created_at).toLocaleDateString("ar-EG", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </td>
                      <td className="p-4">
                        {tx.status === "PENDING" && (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setReviewModal({ id: tx.id, action: "APPROVED", type: tx.type })}
                              disabled={reviewing === tx.id}
                              className="inline-flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 px-2.5 py-1.5 rounded-lg transition-all duration-200 border border-transparent hover:border-emerald-500/20"
                            >
                              {reviewing === tx.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                              قبول
                            </button>
                            <button
                              onClick={() => { setReviewModal({ id: tx.id, action: "REJECTED", type: tx.type }); setRejectionReason(""); }}
                              disabled={reviewing === tx.id}
                              className="inline-flex items-center gap-1 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 px-2.5 py-1.5 rounded-lg transition-all duration-200 border border-transparent hover:border-red-500/20"
                            >
                              <XCircle className="h-3 w-3" />
                              رفض
                            </button>
                          </div>
                        )}
                        {tx.status === "REJECTED" && tx.rejection_reason && (
                          <p className="text-xs text-red-400/80 max-w-[200px] truncate" title={tx.rejection_reason}>
                            {tx.rejection_reason}
                          </p>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Empty State */}
        {!loading && transactions.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-in">
            <div className="h-20 w-20 rounded-2xl bg-muted/20 flex items-center justify-center mb-5">
              <Inbox className="h-10 w-10 text-muted-foreground/30" />
            </div>
            <h3 className="text-lg font-bold mb-2">لا توجد معاملات</h3>
            <p className="text-sm text-muted-foreground max-w-xs">لا توجد معاملات مطابقة للفلتر المحدد</p>
          </div>
        )}
      </div>

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
                  {reviewModal.action === "APPROVED" ? "تأكيد قبول المعاملة" : "تأكيد رفض المعاملة"}
                </h3>
              </div>
              <button onClick={() => { setReviewModal(null); setRejectionReason(""); }} className="btn-ghost p-1.5 rounded-lg">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-3 rounded-xl bg-muted/20 border border-border/20 mb-4">
              <p className="text-sm">
                <span className="text-muted-foreground">نوع المعاملة: </span>
                <span className="font-semibold">{reviewModal.type === "DEPOSIT" ? "إيداع" : "سحب"}</span>
              </p>
              {reviewModal.action === "APPROVED" && reviewModal.type === "DEPOSIT" && (
                <p className="text-xs text-emerald-400 mt-1 flex items-center gap-1">
                  <ArrowUpRight className="h-3 w-3" />
                  سيتم إضافة الرصيد للمستخدم
                </p>
              )}
              {reviewModal.action === "APPROVED" && reviewModal.type === "WITHDRAWAL" && (
                <p className="text-xs text-emerald-400 mt-1 flex items-center gap-1">
                  <ArrowDownRight className="h-3 w-3" />
                  سيتم خصم الرصيد من المستخدم
                </p>
              )}
              {reviewModal.action === "REJECTED" && reviewModal.type === "WITHDRAWAL" && (
                <p className="text-xs text-yellow-400 mt-1 flex items-center gap-1">
                  <ArrowUpRight className="h-3 w-3" />
                  سيتم إرجاع الرصيد للمستخدم
                </p>
              )}
            </div>

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
