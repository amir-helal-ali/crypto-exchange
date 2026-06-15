"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import {
  Bell,
  Check,
  CheckCheck,
  Loader2,
  Filter,
  ChevronRight,
  ChevronLeft,
  ShoppingCart,
  XCircle,
  Zap,
  ArrowDownToLine,
  Send,
  ShieldCheck,
  AlertTriangle,
  Ban,
  BellOff,
  Circle,
  Hash,
} from "lucide-react";
import { authGet, authPut } from "@/lib/api";

interface Notification {
  id: number;
  type: string;
  title: string;
  body: string;
  data: string;
  read: boolean;
  created_at: string;
}

const NOTIF_TYPES = [
  { value: "", label: "الكل", icon: Bell },
  { value: "ORDER_FILLED", label: "تنفيذ أوامر", icon: ShoppingCart },
  { value: "ORDER_CANCELLED", label: "إلغاء أوامر", icon: XCircle },
  { value: "ORDER_TRIGGERED", label: "تفعيل أوامر", icon: Zap },
  { value: "DEPOSIT_APPROVED", label: "إيداعات", icon: ArrowDownToLine },
  { value: "WITHDRAWAL_APPROVED", label: "سحوبات", icon: Send },
  { value: "KYC_APPROVED", label: "تحقق KYC", icon: ShieldCheck },
];

export default function NotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [filter, setFilter] = useState("");
  const limit = 20;

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login");
      return;
    }
    fetchNotifications();
  }, [router, page, filter]);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const res = await authGet(
        `/api/v1/notifications?limit=${limit}&page=${page}`
      );
      if (res.ok) {
        const data = await res.json();
        let notifs = data.data || [];
        if (filter) {
          notifs = notifs.filter((n: Notification) => n.type === filter);
        }
        setNotifications(notifs);
        setTotal(data.total || notifs.length);
        setUnreadCount(data.unread_count || 0);
      }
    } catch {
      toast.error("حدث خطأ في الاتصال");
    } finally {
      setLoading(false);
    }
  };

  const handleMarkRead = async (id: number) => {
    try {
      await authPut(`/api/v1/notifications/${id}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      toast.error("حدث خطأ");
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await authPut("/api/v1/notifications/read-all");
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
      toast.success("تم تعيين الكل كمقروء");
    } catch {
      toast.error("حدث خطأ");
    }
  };

  const getNotifIcon = (type: string) => {
    switch (type) {
      case "ORDER_FILLED": return ShoppingCart;
      case "ORDER_CANCELLED": return XCircle;
      case "ORDER_TRIGGERED": return Zap;
      case "DEPOSIT_APPROVED": return ArrowDownToLine;
      case "WITHDRAWAL_APPROVED": return Send;
      case "WITHDRAWAL_REJECTED": return Ban;
      case "KYC_APPROVED": return ShieldCheck;
      case "KYC_REJECTED": return AlertTriangle;
      default: return Bell;
    }
  };

  const getNotifColor = (type: string) => {
    switch (type) {
      case "ORDER_FILLED": return { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/20", accent: "border-l-emerald-500" };
      case "ORDER_CANCELLED": return { bg: "bg-red-500/10", text: "text-red-400", border: "border-red-500/20", accent: "border-l-red-500" };
      case "ORDER_TRIGGERED": return { bg: "bg-blue-500/10", text: "text-blue-400", border: "border-blue-500/20", accent: "border-l-blue-500" };
      case "DEPOSIT_APPROVED": return { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/20", accent: "border-l-emerald-500" };
      case "WITHDRAWAL_APPROVED": return { bg: "bg-blue-500/10", text: "text-blue-400", border: "border-blue-500/20", accent: "border-l-blue-500" };
      case "WITHDRAWAL_REJECTED": return { bg: "bg-red-500/10", text: "text-red-400", border: "border-red-500/20", accent: "border-l-red-500" };
      case "KYC_APPROVED": return { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/20", accent: "border-l-emerald-500" };
      case "KYC_REJECTED": return { bg: "bg-yellow-500/10", text: "text-yellow-400", border: "border-yellow-500/20", accent: "border-l-yellow-500" };
      default: return { bg: "bg-muted/20", text: "text-muted-foreground", border: "border-border/20", accent: "border-l-primary" };
    }
  };

  const formatTimeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "الآن";
    if (mins < 60) return `منذ ${mins} دقيقة`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `منذ ${hours} ساعة`;
    const days = Math.floor(hours / 24);
    return `منذ ${days} يوم`;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("ar-EG", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6 max-w-3xl">
      {/* ── Header Section ── */}
      <div className="flex items-start sm:items-center justify-between gap-4 animate-slide-in-up">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20 relative">
            <Bell className="h-6 w-6 text-white" />
            {unreadCount > 0 && (
              <span className="absolute -top-1.5 -left-1.5 min-w-[20px] h-5 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center shadow-lg shadow-red-500/30 animate-scale-in">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">الإشعارات</h1>
            <p className="text-muted-foreground text-sm mt-0.5">جميع إشعاراتك وتنبيهاتك في مكان واحد</p>
          </div>
        </div>

        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            className="btn-ghost gap-2 text-sm shrink-0 border border-border/30 hover:border-primary/30"
          >
            <CheckCheck className="h-4 w-4 text-primary" />
            تعيين الكل كمقروء
          </button>
        )}
      </div>

      {/* ── Filter Tabs ── */}
      <div
        className="glass-panel rounded-2xl p-3 animate-slide-in-up"
        style={{ animationDelay: "80ms" }}
      >
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Filter className="h-4 w-4 text-primary" />
          </div>
          {NOTIF_TYPES.map((type) => {
            const Icon = type.icon;
            return (
              <button
                key={type.value}
                onClick={() => {
                  setFilter(type.value);
                  setPage(1);
                }}
                className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm whitespace-nowrap transition-all duration-200 ${
                  filter === type.value
                    ? "bg-primary/15 text-primary font-semibold shadow-sm shadow-primary/10"
                    : "text-muted-foreground hover:bg-muted/30 hover:text-foreground"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {type.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Notifications List ── */}
      {loading ? (
        <div className="flex flex-col items-center justify-center min-h-[40vh] gap-3 animate-fade-in">
          <div className="h-16 w-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
          </div>
          <p className="text-sm text-muted-foreground">جاري تحميل الإشعارات...</p>
        </div>
      ) : notifications.length === 0 ? (
        /* Empty State */
        <div
          className="glass-panel rounded-2xl p-16 text-center animate-scale-in"
          style={{ animationDelay: "120ms" }}
        >
          <div className="h-24 w-24 mx-auto mb-6 rounded-2xl bg-muted/15 flex items-center justify-center">
            <BellOff className="h-12 w-12 text-muted-foreground/25" />
          </div>
          <h2 className="text-xl font-bold mb-2">لا توجد إشعارات</h2>
          <p className="text-sm text-muted-foreground max-w-xs mx-auto leading-relaxed">
            {filter ? "لا توجد إشعارات من هذا النوع. جرّب تصفية أخرى." : "ستظهر إشعاراتك هنا عند استلامها."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((notif, idx) => {
            const colors = getNotifColor(notif.type);
            const Icon = getNotifIcon(notif.type);

            return (
              <div
                key={notif.id}
                className={`glass-panel rounded-xl p-4 transition-all duration-200 cursor-pointer group hover:bg-muted/5 ${
                  !notif.read ? `border-l-4 ${colors.accent}` : ""
                } animate-slide-in-up`}
                style={{ animationDelay: `${Math.min(idx * 40, 300)}ms`, animationFillMode: "both" }}
                onClick={() => !notif.read && handleMarkRead(notif.id)}
              >
                <div className="flex items-start gap-4">
                  {/* Type Icon */}
                  <div
                    className={`w-11 h-11 rounded-xl ${colors.bg} flex items-center justify-center shrink-0 border ${colors.border}`}
                  >
                    <Icon className={`h-5 w-5 ${colors.text}`} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <h3
                        className={`text-sm font-semibold leading-tight ${
                          !notif.read ? "text-foreground" : "text-muted-foreground"
                        }`}
                      >
                        {notif.title}
                      </h3>
                      {!notif.read && (
                        <span className="h-2.5 w-2.5 rounded-full bg-primary shrink-0 shadow-[0_0_8px_rgba(16,185,129,0.4)]" />
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">{notif.body}</p>
                    <p className="text-xs text-muted-foreground/60 mt-2 flex items-center gap-1.5">
                      <Circle className="h-1 w-1 fill-current" />
                      {formatTimeAgo(notif.created_at)}
                    </p>
                  </div>

                  {/* Mark Read Button */}
                  {!notif.read && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMarkRead(notif.id);
                      }}
                      className="shrink-0 h-9 w-9 rounded-xl flex items-center justify-center hover:bg-primary/10 text-muted-foreground hover:text-primary transition-all duration-200 border border-transparent hover:border-primary/20"
                      title="تعيين كمقروء"
                    >
                      <Check className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div
          className="flex items-center justify-center gap-2 pt-2 animate-slide-in-up"
          style={{ animationDelay: "200ms" }}
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
