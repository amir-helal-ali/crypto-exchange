"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import {
  Search,
  Check,
  X,
  Copy,
  CheckCircle2,
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  Clock,
  CheckCircle,
  XCircle,
  Filter,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Wifi,
} from "lucide-react";
import { authGet, authPut } from "@/lib/api";
import { adminStream } from "@/lib/stream";

export default function AdminTransactionsPage() {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [reviewingId, setReviewingId] = useState<number | null>(null);
  const [txInputs, setTxInputs] = useState<Record<number, string>>({});
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [liveNewCount, setLiveNewCount] = useState(0);

  const fetchTransactions = () => {
    const token = localStorage.getItem("token");
    if (!token) return;
    setLoading(true);
    authGet(`/api/v1/admin/transactions?page=${page}&limit=20`)
      .then(r => r.json()).then(d => {
        const data = d.data;
        setTransactions(Array.isArray(data) ? data : []);
        if (d.total) setTotalPages(Math.ceil(d.total / 20));
      }).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { fetchTransactions(); }, [page]);

  // Live updates via SSE — auto-refresh list when a new transaction arrives
  useEffect(() => {
    const unsub = adminStream.on("tx", () => {
      setLiveNewCount((n) => n + 1);
      // If user is on page 1 and no search/filter active, silently refresh
      if (page === 1 && statusFilter === "ALL" && !search) {
        const token = localStorage.getItem("token");
        if (!token) return;
        authGet(`/api/v1/admin/transactions?page=1&limit=20`)
          .then((r) => r.json())
          .then((d) => {
            const data = d.data;
            if (Array.isArray(data)) setTransactions(data);
          })
          .catch(() => {});
      }
    });
    return unsub;
  }, [page, statusFilter, search]);

  // Dismiss the "new transactions" pill when the list is manually refreshed
  useEffect(() => { setLiveNewCount(0); }, [page]);

  const handleReview = async (id: number, action: "approve" | "reject") => {
    setReviewingId(id);
    try {
      const body: any = { action };
      if (action === "approve" && txInputs[id]) body.tx_id = txInputs[id];
      const res = await authPut(`/api/v1/admin/transactions/${id}/review`, body);
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "فشل المراجعة"); return; }
      toast.success(data.message || (action === "approve" ? "تمت الموافقة على المعاملة" : "تم رفض المعاملة"));
      fetchTransactions();
    } catch { toast.error("حدث خطأ في الاتصال"); }
    finally { setReviewingId(null); }
  };

  const filtered = transactions.filter(t => {
    const matchesSearch =
      t.user?.username?.toLowerCase().includes(search.toLowerCase()) ||
      t.user?.email?.toLowerCase().includes(search.toLowerCase()) ||
      t.currency?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "ALL" || t.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Stats
  const pendingCount = transactions.filter(t => t.status === "PENDING").length;
  const completedCount = transactions.filter(t => t.status === "COMPLETED").length;
  const rejectedCount = transactions.filter(t => t.status === "REJECTED").length;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "COMPLETED": return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
      case "PENDING": return "bg-yellow-500/10 text-yellow-400 border-yellow-500/20";
      case "REJECTED": return "bg-red-500/10 text-red-400 border-red-500/20";
      default: return "bg-muted/20 text-muted-foreground border-border/30";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "COMPLETED": return CheckCircle;
      case "PENDING": return Clock;
      case "REJECTED": return XCircle;
      default: return Clock;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "COMPLETED": return "مكتمل";
      case "PENDING": return "قيد الانتظار";
      case "REJECTED": return "مرفوض";
      default: return status;
    }
  };

  if (loading && transactions.length === 0) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="flex flex-col items-center gap-4">
          <span className="spinner h-8 w-8" />
          <p className="text-sm text-muted-foreground">جاري تحميل المعاملات...</p>
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
            <Wallet className="h-5 w-5 text-emerald-500" />
          </div>
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold">المعاملات</h1>
            <p className="text-sm text-muted-foreground">إدارة عمليات السحب والإيداع ومراجعة الطلبات</p>
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
                onClick={() => { setLiveNewCount(0); fetchTransactions(); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 transition-colors animate-pulse"
              >
                <ArrowDownLeft className="h-3.5 w-3.5" />
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
              <p className="text-[11px] text-muted-foreground">قيد الانتظار</p>
            </div>
          </div>
        </div>
        <div className="stat-card stat-card-emerald">
          <div className="relative z-10 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10">
              <CheckCircle className="h-5 w-5 text-emerald-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{completedCount}</p>
              <p className="text-[11px] text-muted-foreground">مكتملة</p>
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
              <p className="text-[11px] text-muted-foreground">مرفوضة</p>
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
              placeholder="بحث باسم المستخدم أو البريد أو العملة..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {/* Status Filter */}
          <div className="relative">
            <Filter className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50 pointer-events-none" />
            <select
              className="input-field pr-10 appearance-none min-w-[140px]"
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
            >
              <option value="ALL">جميع الحالات</option>
              <option value="PENDING">قيد الانتظار</option>
              <option value="COMPLETED">مكتمل</option>
              <option value="REJECTED">مرفوض</option>
            </select>
          </div>
        </div>
      </div>

      {/* ─── Transactions Table ─── */}
      <div className="glass-panel rounded-2xl overflow-hidden animate-slide-in-up delay-300">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50 bg-muted/10">
                <th className="text-right p-4 text-muted-foreground font-medium">المستخدم</th>
                <th className="text-right p-4 text-muted-foreground font-medium">النوع</th>
                <th className="text-right p-4 text-muted-foreground font-medium">العملة</th>
                <th className="text-right p-4 text-muted-foreground font-medium">الكمية</th>
                <th className="text-right p-4 text-muted-foreground font-medium">العنوان</th>
                <th className="text-right p-4 text-muted-foreground font-medium">TxID</th>
                <th className="text-right p-4 text-muted-foreground font-medium">الحالة</th>
                <th className="text-right p-4 text-muted-foreground font-medium">التاريخ</th>
                <th className="text-right p-4 text-muted-foreground font-medium">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-16">
                    <Wallet className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-muted-foreground font-medium">لا توجد معاملات</p>
                    <p className="text-xs text-muted-foreground/60 mt-1">ستظهر المعاملات هنا عند إجراء عمليات إيداع أو سحب</p>
                  </td>
                </tr>
              ) : (
                filtered.map((tx: any, i: number) => {
                  const StatusIcon = getStatusIcon(tx.status);
                  return (
                    <tr key={i} className="border-b border-border/20 hover:bg-muted/5 transition-all">
                      <td className="p-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <span className="text-xs font-bold text-primary">
                              {(tx.user?.username || tx.username || "?")[0]?.toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium text-sm">{tx.user?.username || tx.username || "—"}</p>
                            <p className="text-[10px] text-muted-foreground">{tx.user?.email || tx.email || ""}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${
                          tx.type === "deposit"
                            ? "bg-emerald-500/10 text-emerald-400"
                            : "bg-red-500/10 text-red-400"
                        }`}>
                          {tx.type === "deposit" ? (
                            <ArrowDownLeft className="h-3 w-3" />
                          ) : (
                            <ArrowUpRight className="h-3 w-3" />
                          )}
                          {tx.type === "deposit" ? "إيداع" : "سحب"}
                        </div>
                      </td>
                      <td className="p-4 font-medium">{tx.currency}</td>
                      <td className="p-4 tabular-nums font-medium">
                        <span className={tx.type === "deposit" ? "text-emerald-400" : "text-red-400"}>
                          {tx.type === "deposit" ? "+" : "-"}{parseFloat(tx.amount || "0").toFixed(8)}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-muted-foreground max-w-[100px] truncate block font-mono">{tx.address || "—"}</span>
                          {tx.address && (
                            <button onClick={() => { navigator.clipboard.writeText(tx.address); setCopiedId(tx.id); setTimeout(() => setCopiedId(null), 2000); }} className="text-muted-foreground hover:text-foreground flex-shrink-0 transition-colors">
                              {copiedId === tx.id ? <CheckCircle2 className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-muted-foreground max-w-[80px] truncate block font-mono">{tx.tx_id || "—"}</span>
                          {tx.tx_id && (
                            <button onClick={() => { navigator.clipboard.writeText(tx.tx_id); setCopiedId(tx.id); setTimeout(() => setCopiedId(null), 2000); }} className="text-muted-foreground hover:text-foreground flex-shrink-0 transition-colors">
                              {copiedId === tx.id ? <CheckCircle2 className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="p-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border ${getStatusBadge(tx.status)}`}>
                          <StatusIcon className="h-3 w-3" />
                          {getStatusLabel(tx.status)}
                        </span>
                      </td>
                      <td className="p-4 text-muted-foreground text-xs whitespace-nowrap">
                        {new Date(tx.createdAt || tx.created_at).toLocaleDateString("ar-EG", { year: "numeric", month: "short", day: "numeric" })}
                      </td>
                      <td className="p-4">
                        {tx.status === "PENDING" && (
                          <div className="flex items-center gap-2">
                            <div className="flex flex-col gap-1.5">
                              <input
                                type="text"
                                className="input-field text-xs py-1 px-2 w-28"
                                placeholder="أدخل TxID"
                                value={txInputs[tx.id] || ""}
                                onChange={e => setTxInputs(prev => ({ ...prev, [tx.id]: e.target.value }))}
                              />
                              <div className="flex gap-1.5">
                                <button
                                  onClick={() => handleReview(tx.id, "approve")}
                                  disabled={reviewingId === tx.id}
                                  className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 transition-all disabled:opacity-50"
                                  title="موافقة"
                                >
                                  {reviewingId === tx.id ? <span className="spinner h-3 w-3" /> : <Check className="h-3.5 w-3.5" />}
                                </button>
                                <button
                                  onClick={() => handleReview(tx.id, "reject")}
                                  disabled={reviewingId === tx.id}
                                  className="p-2 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-all disabled:opacity-50"
                                  title="رفض"
                                >
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
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
              صفحة {page} من {totalPages}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="btn-ghost p-2 disabled:opacity-30"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const p = Math.max(1, Math.min(page - 2, totalPages - 4)) + i;
                if (p > totalPages) return null;
                return (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      p === page ? "bg-primary text-primary-foreground" : "bg-muted/30 text-muted-foreground hover:bg-muted/50"
                    }`}
                  >
                    {p}
                  </button>
                );
              })}
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
