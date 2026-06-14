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
  { value: "", label: "الكل" },
  { value: "ORDER_FILLED", label: "تنفيذ أوامر" },
  { value: "ORDER_CANCELLED", label: "إلغاء أوامر" },
  { value: "ORDER_TRIGGERED", label: "تفعيل أوامر" },
  { value: "DEPOSIT_APPROVED", label: "إيداعات" },
  { value: "WITHDRAWAL_APPROVED", label: "سحوبات" },
  { value: "KYC_APPROVED", label: "تحقق KYC" },
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
      case "ORDER_FILLED": return "✅";
      case "ORDER_CANCELLED": return "❌";
      case "ORDER_TRIGGERED": return "⚡";
      case "DEPOSIT_APPROVED": return "💰";
      case "WITHDRAWAL_APPROVED": return "📤";
      case "WITHDRAWAL_REJECTED": return "🚫";
      case "KYC_APPROVED": return "🛡️";
      case "KYC_REJECTED": return "⚠️";
      default: return "🔔";
    }
  };

  const getNotifColor = (type: string) => {
    switch (type) {
      case "ORDER_FILLED": return "bg-emerald-500/10";
      case "ORDER_CANCELLED": return "bg-red-500/10";
      case "ORDER_TRIGGERED": return "bg-blue-500/10";
      case "DEPOSIT_APPROVED": return "bg-emerald-500/10";
      case "WITHDRAWAL_APPROVED": return "bg-blue-500/10";
      case "WITHDRAWAL_REJECTED": return "bg-red-500/10";
      case "KYC_APPROVED": return "bg-emerald-500/10";
      case "KYC_REJECTED": return "bg-yellow-500/10";
      default: return "bg-muted/10";
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Bell className="h-7 w-7 text-emerald-500" />
            الإشعارات
            {unreadCount > 0 && (
              <span className="text-sm bg-red-500/10 text-red-400 px-2.5 py-0.5 rounded-full">
                {unreadCount} غير مقروء
              </span>
            )}
          </h1>
          <p className="text-muted-foreground mt-1">
            جميع إشعاراتك وتنبيهاتك في مكان واحد
          </p>
        </div>
        {unreadCount > 0 && (
          <button onClick={handleMarkAllRead} className="btn-ghost gap-2 text-sm">
            <CheckCheck className="h-4 w-4" />
            تعيين الكل كمقروء
          </button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="glass-panel rounded-2xl p-3">
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
          {NOTIF_TYPES.map((type) => (
            <button
              key={type.value}
              onClick={() => { setFilter(type.value); setPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-sm whitespace-nowrap transition-colors ${
                filter === type.value
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:bg-muted/30"
              }`}
            >
              {type.label}
            </button>
          ))}
        </div>
      </div>

      {/* Notifications List */}
      {loading ? (
        <div className="flex items-center justify-center min-h-[40vh]">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
        </div>
      ) : notifications.length === 0 ? (
        <div className="glass-panel rounded-2xl p-12 text-center">
          <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-muted/10 flex items-center justify-center">
            <Bell className="h-10 w-10 text-muted-foreground" />
          </div>
          <h2 className="text-xl font-bold mb-2">لا توجد إشعارات</h2>
          <p className="text-muted-foreground">
            {filter ? "لا توجد إشعارات من هذا النوع" : "ستظهر إشعاراتك هنا عند استلامها"}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((notif) => (
            <div
              key={notif.id}
              className={`glass-panel rounded-xl p-4 transition-colors cursor-pointer hover:bg-muted/5 ${
                !notif.read ? "border-l-4 border-l-primary" : ""
              }`}
              onClick={() => !notif.read && handleMarkRead(notif.id)}
            >
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-xl ${getNotifColor(notif.type)} flex items-center justify-center shrink-0`}>
                  <span className="text-lg">{getNotifIcon(notif.type)}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className={`text-sm font-medium ${!notif.read ? "text-foreground" : "text-muted-foreground"}`}>
                      {notif.title}
                    </h3>
                    {!notif.read && <span className="h-2 w-2 rounded-full bg-primary shrink-0" />}
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">{notif.body}</p>
                  <p className="text-xs text-muted-foreground/70 mt-2">
                    {formatDate(notif.created_at)} · {formatTimeAgo(notif.created_at)}
                  </p>
                </div>
                {!notif.read && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleMarkRead(notif.id); }}
                    className="shrink-0 p-1.5 rounded-lg hover:bg-muted/30 text-muted-foreground hover:text-primary transition-colors"
                    title="تعيين كمقروء"
                  >
                    <Check className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="btn-ghost text-sm disabled:opacity-30">
            السابق
          </button>
          <span className="text-sm text-muted-foreground">
            صفحة {page} من {totalPages}
          </span>
          <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="btn-ghost text-sm disabled:opacity-30">
            التالي
          </button>
        </div>
      )}
    </div>
  );
}
