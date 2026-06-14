"use client";

import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  ArrowDownRight,
  Filter,
  Loader2,
  ChevronRight,
  ChevronLeft,
  History,
  BarChart3,
  Tag,
  Repeat,
  Hash,
  DollarSign,
  Coins,
  CheckCircle2,
  Clock,
  XCircle,
  Zap,
  CalendarDays,
  Ban,
  Inbox,
  TrendingUp,
} from "lucide-react";
import { authGet, authPost } from "@/lib/api";
import toast from "react-hot-toast";

const STATUS_TABS = [
  { value: "", label: "الكل", icon: BarChart3 },
  { value: "PENDING", label: "معلق", icon: Clock },
  { value: "FILLED", label: "منفذ", icon: CheckCircle2 },
  { value: "CANCELLED", label: "ملغي", icon: XCircle },
  { value: "TRIGGERED", label: "مفعّل", icon: Zap },
];

export default function HistoryPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 20;

  const totalPages = Math.ceil(total / limit);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;
    fetchOrders();
  }, [statusFilter, page]);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      params.set("page", page.toString());
      params.set("limit", limit.toString());
      const r = await authGet(`/api/v1/exchange/orders?${params.toString()}`);
      const d = await r.json();
      setOrders(Array.isArray(d.data) ? d.data : []);
      setTotal(d.total || 0);
    } catch {
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async (orderId: number) => {
    try {
      const res = await authPost(`/api/v1/exchange/order/${orderId}/cancel`);
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "فشل إلغاء الأمر");
        return;
      }
      toast.success(data.message || "تم إلغاء الأمر بنجاح");
      fetchOrders();
    } catch {
      toast.error("حدث خطأ في الاتصال");
    }
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case "FILLED":
        return {
          label: "منفذ",
          cls: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20",
          icon: CheckCircle2,
          dotColor: "bg-emerald-500",
        };
      case "PENDING":
        return {
          label: "معلق",
          cls: "bg-yellow-500/15 text-yellow-400 border border-yellow-500/20",
          icon: Clock,
          dotColor: "bg-yellow-500",
        };
      case "CANCELLED":
        return {
          label: "ملغي",
          cls: "bg-gray-500/15 text-gray-400 border border-gray-500/20",
          icon: XCircle,
          dotColor: "bg-gray-500",
        };
      case "TRIGGERED":
        return {
          label: "مفعّل",
          cls: "bg-blue-500/15 text-blue-400 border border-blue-500/20",
          icon: Zap,
          dotColor: "bg-blue-500",
        };
      default:
        return {
          label: status,
          cls: "bg-red-500/15 text-red-400 border border-red-500/20",
          icon: XCircle,
          dotColor: "bg-red-500",
        };
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "MARKET": return "سوقي";
      case "LIMIT": return "محدد";
      case "STOP_LIMIT": return "وقف خسارة";
      case "TAKE_PROFIT": return "جني أرباح";
      default: return type;
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Header Section ── */}
      <div className="animate-slide-in-up">
        <div className="flex items-center gap-3 mb-2">
          <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <History className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">سجل الصفقات</h1>
            <p className="text-muted-foreground text-sm mt-0.5">جميع الصفقات المنفذة والمعلقة</p>
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
                onClick={() => {
                  setStatusFilter(tab.value);
                  setPage(1);
                }}
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
              <Hash className="h-3 w-3" />
              {total} أمر
            </span>
          )}
        </div>
      </div>

      {/* ── Data Table ── */}
      <div
        className="glass-panel rounded-2xl overflow-hidden animate-slide-in-up"
        style={{ animationDelay: "160ms" }}
      >
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="h-16 w-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
            </div>
            <p className="text-sm text-muted-foreground">جاري تحميل الصفقات...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/40 bg-muted/20">
                  <th className="text-right p-4 text-muted-foreground font-medium">
                    <div className="flex items-center gap-1.5">
                      <TrendingUp className="h-3.5 w-3.5" />
                      السوق
                    </div>
                  </th>
                  <th className="text-right p-4 text-muted-foreground font-medium">
                    <div className="flex items-center gap-1.5">
                      <Tag className="h-3.5 w-3.5" />
                      نوع الأمر
                    </div>
                  </th>
                  <th className="text-right p-4 text-muted-foreground font-medium">
                    <div className="flex items-center gap-1.5">
                      <Repeat className="h-3.5 w-3.5" />
                      الاتجاه
                    </div>
                  </th>
                  <th className="text-right p-4 text-muted-foreground font-medium">
                    <div className="flex items-center gap-1.5">
                      <Coins className="h-3.5 w-3.5" />
                      الكمية
                    </div>
                  </th>
                  <th className="text-right p-4 text-muted-foreground font-medium">
                    <div className="flex items-center gap-1.5">
                      <DollarSign className="h-3.5 w-3.5" />
                      سعر الدخول
                    </div>
                  </th>
                  <th className="text-right p-4 text-muted-foreground font-medium">
                    <div className="flex items-center gap-1.5">
                      <DollarSign className="h-3.5 w-3.5" />
                      سعر التنفيذ
                    </div>
                  </th>
                  <th className="text-right p-4 text-muted-foreground font-medium">
                    <div className="flex items-center gap-1.5">
                      <Coins className="h-3.5 w-3.5" />
                      الرسوم
                    </div>
                  </th>
                  <th className="text-right p-4 text-muted-foreground font-medium">الحالة</th>
                  <th className="text-right p-4 text-muted-foreground font-medium">
                    <div className="flex items-center gap-1.5">
                      <CalendarDays className="h-3.5 w-3.5" />
                      التاريخ
                    </div>
                  </th>
                  <th className="text-right p-4 text-muted-foreground font-medium">إجراء</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order: any, i: number) => {
                  const statusConfig = getStatusConfig(order.status);
                  return (
                    <tr
                      key={i}
                      className="border-b border-border/15 hover:bg-emerald-500/[0.03] transition-all duration-200 group"
                    >
                      <td className="p-4">
                        <span className="font-semibold text-foreground">{order.symbol}</span>
                      </td>
                      <td className="p-4 text-muted-foreground">{getTypeLabel(order.type)}</td>
                      <td className="p-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold ${
                            order.side === "BUY"
                              ? "bg-emerald-500/10 text-emerald-400"
                              : "bg-red-500/10 text-red-400"
                          }`}
                        >
                          {order.side === "BUY" ? (
                            <ArrowUpRight className="h-3.5 w-3.5" />
                          ) : (
                            <ArrowDownRight className="h-3.5 w-3.5" />
                          )}
                          {order.side === "BUY" ? "شراء" : "بيع"}
                        </span>
                      </td>
                      <td className="p-4 tabular-nums font-medium">{parseFloat(order.quantity || "0").toFixed(8)}</td>
                      <td className="p-4 tabular-nums text-muted-foreground">
                        {order.price ? parseFloat(order.price).toFixed(2) : "—"}
                      </td>
                      <td className="p-4 tabular-nums text-emerald-400 font-medium">
                        {order.avg_fill_price ? parseFloat(order.avg_fill_price).toFixed(2) : "—"}
                      </td>
                      <td className="p-4 tabular-nums text-muted-foreground">
                        {order.fee > 0 ? (
                          <span>
                            {parseFloat(order.fee).toFixed(4)}{" "}
                            <span className="text-muted-foreground/60">{order.fee_currency || "USDT"}</span>
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="p-4">
                        <span
                          className={`inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full font-semibold ${statusConfig.cls}`}
                        >
                          <span className={`h-1.5 w-1.5 rounded-full ${statusConfig.dotColor}`} />
                          {statusConfig.label}
                        </span>
                      </td>
                      <td className="p-4 text-muted-foreground text-xs">
                        <div className="flex flex-col">
                          <span>
                            {new Date(order.created_at || order.CreatedAt).toLocaleDateString("ar-EG", {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            })}
                          </span>
                          <span className="text-muted-foreground/60">
                            {new Date(order.created_at || order.CreatedAt).toLocaleTimeString("ar-EG", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                      </td>
                      <td className="p-4">
                        {order.status === "PENDING" && (
                          <button
                            onClick={() => handleCancel(order.id)}
                            className="inline-flex items-center gap-1 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 px-2.5 py-1.5 rounded-lg transition-all duration-200 border border-transparent hover:border-red-500/20"
                          >
                            <Ban className="h-3 w-3" />
                            إلغاء
                          </button>
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
        {!loading && orders.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-in">
            <div className="h-20 w-20 rounded-2xl bg-muted/20 flex items-center justify-center mb-5">
              <Inbox className="h-10 w-10 text-muted-foreground/30" />
            </div>
            <h3 className="text-lg font-bold mb-2">لا توجد صفقات بعد</h3>
            <p className="text-sm text-muted-foreground max-w-xs">
              {statusFilter
                ? "لا توجد صفقات بالحالة المحددة. جرّب تصفية أخرى."
                : "ستظهر صفقاتك هنا بعد تنفيذ أول عملية تداول."}
            </p>
          </div>
        )}
      </div>

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div
          className="flex items-center justify-center gap-2 animate-slide-in-up"
          style={{ animationDelay: "240ms" }}
        >
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="btn-ghost text-sm gap-1 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronRight className="h-4 w-4" />
            السابق
          </button>

          <div className="flex items-center gap-1 mx-2">
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum: number;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (page <= 3) {
                pageNum = i + 1;
              } else if (page >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
              } else {
                pageNum = page - 2 + i;
              }
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
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
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
    </div>
  );
}
