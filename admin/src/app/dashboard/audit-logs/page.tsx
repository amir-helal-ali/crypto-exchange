"use client";

import { useEffect, useState, useCallback } from "react";
import toast from "react-hot-toast";
import {
  FileText,
  Search,
  Download,
  Filter,
  ChevronLeft,
  ChevronRight,
  Loader2,
  X,
  User,
  Shield,
  Calendar,
} from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

// Action type labels in Arabic
const ACTION_LABELS: Record<string, string> = {
  REGISTER: "تسجيل حساب",
  LOGIN: "تسجيل دخول",
  LOGIN_2FA: "دخول بمصادقة ثنائية",
  LOGOUT: "تسجيل خروج",
  EMAIL_VERIFIED: "تأكيد البريد",
  PASSWORD_RESET_REQUESTED: "طلب إعادة تعيين كلمة المرور",
  PASSWORD_RESET_COMPLETED: "إعادة تعيين كلمة المرور",
  UPDATE_USER_ROLE: "تغيير دور المستخدم",
  KYC_SUBMITTED: "تقديم طلب KYC",
  KYC_APPROVED: "قبول KYC",
  KYC_REJECTED: "رفض KYC",
  DEPOSIT_APPROVED: "موافقة إيداع",
  DEPOSIT_REJECTED: "رفض إيداع",
  WITHDRAWAL_APPROVED: "موافقة سحب",
  WITHDRAWAL_REJECTED: "رفض سحب",
  ORDER_PLACED: "إنشاء أوردر",
  ORDER_CANCELLED: "إلغاء أوردر",
  ORDER_FILLED: "تنفيذ أوردر",
  ORDER_TRIGGERED: "تفعيل أوردر",
  TWO_FA_ENABLED: "تفعيل المصادقة الثنائية",
  TWO_FA_DISABLED: "تعطيل المصادقة الثنائية",
  PROFILE_UPDATED: "تحديث الملف الشخصي",
  PASSWORD_CHANGED: "تغيير كلمة المرور",
};

// Action category colors
const ACTION_COLORS: Record<string, { bg: string; text: string }> = {
  REGISTER: { bg: "bg-blue-500/10", text: "text-blue-400" },
  LOGIN: { bg: "bg-emerald-500/10", text: "text-emerald-400" },
  LOGIN_2FA: { bg: "bg-emerald-500/10", text: "text-emerald-400" },
  LOGOUT: { bg: "bg-gray-500/10", text: "text-gray-400" },
  EMAIL_VERIFIED: { bg: "bg-emerald-500/10", text: "text-emerald-400" },
  PASSWORD_RESET_REQUESTED: { bg: "bg-yellow-500/10", text: "text-yellow-400" },
  PASSWORD_RESET_COMPLETED: { bg: "bg-emerald-500/10", text: "text-emerald-400" },
  UPDATE_USER_ROLE: { bg: "bg-purple-500/10", text: "text-purple-400" },
  KYC_SUBMITTED: { bg: "bg-blue-500/10", text: "text-blue-400" },
  KYC_APPROVED: { bg: "bg-emerald-500/10", text: "text-emerald-400" },
  KYC_REJECTED: { bg: "bg-red-500/10", text: "text-red-400" },
  DEPOSIT_APPROVED: { bg: "bg-emerald-500/10", text: "text-emerald-400" },
  DEPOSIT_REJECTED: { bg: "bg-red-500/10", text: "text-red-400" },
  WITHDRAWAL_APPROVED: { bg: "bg-emerald-500/10", text: "text-emerald-400" },
  WITHDRAWAL_REJECTED: { bg: "bg-red-500/10", text: "text-red-400" },
  ORDER_PLACED: { bg: "bg-blue-500/10", text: "text-blue-400" },
  ORDER_CANCELLED: { bg: "bg-yellow-500/10", text: "text-yellow-400" },
  ORDER_FILLED: { bg: "bg-emerald-500/10", text: "text-emerald-400" },
  ORDER_TRIGGERED: { bg: "bg-cyan-500/10", text: "text-cyan-400" },
  TWO_FA_ENABLED: { bg: "bg-emerald-500/10", text: "text-emerald-400" },
  TWO_FA_DISABLED: { bg: "bg-yellow-500/10", text: "text-yellow-400" },
  PROFILE_UPDATED: { bg: "bg-blue-500/10", text: "text-blue-400" },
  PASSWORD_CHANGED: { bg: "bg-yellow-500/10", text: "text-yellow-400" },
};

interface AuditLog {
  id: number;
  user_id: number;
  action: string;
  details: string;
  ipAddress: string;
  username: string;
  createdAt: string;
}

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [exporting, setExporting] = useState(false);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });
      if (actionFilter) params.set("action", actionFilter);
      if (search) params.set("search", search);
      if (dateFrom) params.set("date_from", dateFrom);
      if (dateTo) params.set("date_to", dateTo);

      const res = await fetch(`${API}/api/v1/admin/audit-logs?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setLogs(Array.isArray(data.data) ? data.data : []);
        setTotal(data.total || 0);
      } else {
        toast.error(data.error || "فشل تحميل السجلات");
      }
    } catch {
      toast.error("حدث خطأ في الاتصال");
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, actionFilter, dateFrom, dateTo]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleSearch = () => {
    setSearch(searchInput);
    setPage(1);
  };

  const handleClearFilters = () => {
    setSearch("");
    setSearchInput("");
    setActionFilter("");
    setDateFrom("");
    setDateTo("");
    setPage(1);
  };

  const handleExport = async () => {
    setExporting(true);
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      const params = new URLSearchParams();
      if (actionFilter) params.set("action", actionFilter);
      if (search) params.set("search", search);
      if (dateFrom) params.set("date_from", dateFrom);
      if (dateTo) params.set("date_to", dateTo);

      const res = await fetch(`${API}/api/v1/admin/audit-logs/export?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        toast.error("فشل تصدير السجلات");
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("تم تصدير السجلات بنجاح");
    } catch {
      toast.error("حدث خطأ أثناء التصدير");
    } finally {
      setExporting(false);
    }
  };

  const totalPages = Math.ceil(total / limit);
  const hasActiveFilters = search || actionFilter || dateFrom || dateTo;

  // Get unique action types from labels for filter dropdown
  const actionOptions = Object.keys(ACTION_LABELS).sort();

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <FileText className="h-7 w-7 text-emerald-500" />
            سجلات التدقيق
          </h1>
          <p className="text-muted-foreground mt-1">
            عرض وتصفية جميع الأنشطة على المنصة ({total.toLocaleString("ar-EG")} سجل)
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`btn-ghost gap-2 ${showFilters || hasActiveFilters ? "bg-primary/10 text-primary" : ""}`}
          >
            <Filter className="h-4 w-4" />
            تصفية
            {hasActiveFilters && (
              <span className="w-2 h-2 rounded-full bg-primary inline-block" />
            )}
          </button>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="btn-primary gap-2"
          >
            {exporting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            تصدير CSV
          </button>
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="glass-panel rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold flex items-center gap-2">
              <Filter className="h-4 w-4 text-emerald-500" />
              خيارات التصفية
            </h3>
            {hasActiveFilters && (
              <button
                onClick={handleClearFilters}
                className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1"
              >
                <X className="h-3 w-3" />
                مسح الكل
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Search */}
            <div>
              <label className="block text-sm font-medium mb-1.5">
                <Search className="h-3.5 w-3.5 inline ml-1" />
                بحث في التفاصيل
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  className="input-field flex-1"
                  placeholder="بحث..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                />
                <button onClick={handleSearch} className="btn-ghost shrink-0">
                  <Search className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Action Type */}
            <div>
              <label className="block text-sm font-medium mb-1.5">
                <Shield className="h-3.5 w-3.5 inline ml-1" />
                نوع الإجراء
              </label>
              <select
                className="input-field"
                value={actionFilter}
                onChange={(e) => {
                  setActionFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">جميع الأنواع</option>
                {actionOptions.map((action) => (
                  <option key={action} value={action}>
                    {ACTION_LABELS[action]}
                  </option>
                ))}
              </select>
            </div>

            {/* Date From */}
            <div>
              <label className="block text-sm font-medium mb-1.5">
                <Calendar className="h-3.5 w-3.5 inline ml-1" />
                من تاريخ
              </label>
              <input
                type="date"
                className="input-field"
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value);
                  setPage(1);
                }}
              />
            </div>

            {/* Date To */}
            <div>
              <label className="block text-sm font-medium mb-1.5">
                <Calendar className="h-3.5 w-3.5 inline ml-1" />
                إلى تاريخ
              </label>
              <input
                type="date"
                className="input-field"
                value={dateTo}
                onChange={(e) => {
                  setDateTo(e.target.value);
                  setPage(1);
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Logs Table */}
      <div className="glass-panel rounded-2xl overflow-hidden">
        {/* Desktop Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50">
                <th className="text-right p-4 font-medium text-muted-foreground">الوقت</th>
                <th className="text-right p-4 font-medium text-muted-foreground">المستخدم</th>
                <th className="text-right p-4 font-medium text-muted-foreground">الإجراء</th>
                <th className="text-right p-4 font-medium text-muted-foreground">التفاصيل</th>
                <th className="text-right p-4 font-medium text-muted-foreground">IP</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="text-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-emerald-500 mx-auto mb-2" />
                    <p className="text-muted-foreground text-sm">جاري التحميل...</p>
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-12">
                    <FileText className="h-10 w-10 text-muted-foreground/50 mx-auto mb-2" />
                    <p className="text-muted-foreground">لا توجد سجلات مطابقة</p>
                    {hasActiveFilters && (
                      <button
                        onClick={handleClearFilters}
                        className="text-sm text-primary hover:underline mt-2"
                      >
                        مسح عوامل التصفية
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const colorConfig = ACTION_COLORS[log.action] || {
                    bg: "bg-gray-500/10",
                    text: "text-gray-400",
                  };
                  return (
                    <tr
                      key={log.id}
                      className="border-b border-border/30 hover:bg-muted/10 transition-colors"
                    >
                      <td className="p-4 whitespace-nowrap">
                        <span className="text-xs text-muted-foreground">
                          {new Date(log.createdAt).toLocaleDateString("ar-EG", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                        <br />
                        <span className="text-xs text-muted-foreground/70">
                          {new Date(log.createdAt).toLocaleTimeString("ar-EG", {
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                          })}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <User className="h-3.5 w-3.5 text-primary" />
                          </div>
                          <span className="font-medium text-sm">
                            {log.username}
                          </span>
                        </div>
                      </td>
                      <td className="p-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium ${colorConfig.bg} ${colorConfig.text}`}
                        >
                          {ACTION_LABELS[log.action] || log.action}
                        </span>
                      </td>
                      <td className="p-4 max-w-xs">
                        <p className="text-sm text-muted-foreground truncate" title={log.details}>
                          {log.details || "-"}
                        </p>
                      </td>
                      <td className="p-4">
                        <span
                          className="text-xs font-mono text-muted-foreground/70"
                          dir="ltr"
                        >
                          {log.ipAddress || "-"}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between p-4 border-t border-border/50">
            <p className="text-sm text-muted-foreground">
              عرض {((page - 1) * limit) + 1} - {Math.min(page * limit, total)} من {total}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="btn-ghost p-2 disabled:opacity-30"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
              <span className="text-sm font-medium">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                className="btn-ghost p-2 disabled:opacity-30"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
