"use client";

import { useEffect, useRef, useState } from "react";
import {
  Bell,
  CheckCheck,
  Trash2,
  X,
  TrendingUp,
  TrendingDown,
  Info,
  AlertCircle,
} from "lucide-react";

export interface NotificationItem {
  id: string;
  type: "order_filled" | "order_placed" | "order_cancelled" | "alert" | "info" | "error";
  title: string;
  message: string;
  timestamp: number;
  read: boolean;
}

interface NotificationsInboxProps {
  open: boolean;
  onClose: () => void;
}

const STORAGE_KEY = "exchange_notifications";

/* Default seed notifications for first-time users */
const SEED_NOTIFICATIONS: NotificationItem[] = [
  {
    id: "welcome",
    type: "info",
    title: "مرحباً بك في منصة التداول",
    message:
      "تم تفعيل جميع الميزات الاحترافية. استخدم Ctrl+K للبحث السريع عن زوج، أو Ctrl+B/S لتبديل الشراء/البيع.",
    timestamp: Date.now(),
    read: false,
  },
];

/**
 * Notifications Inbox — Binance/Bybit-style notifications panel.
 *
 * Listens for custom events from the exchange page:
 * - exchange:notification (adds a new notification)
 * - Shows unread badge count
 * - Mark all as read / clear all actions
 * - Color-coded by type (success/info/warning/error)
 * - Persists to localStorage
 */
export default function NotificationsInbox({
  open,
  onClose,
}: NotificationsInboxProps) {
  const [notifications, setNotifications] = useState<NotificationItem[]>(
    SEED_NOTIFICATIONS
  );
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const notifRef = useRef<NotificationItem[]>(notifications);
  notifRef.current = notifications;

  /* Load from localStorage */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setNotifications(parsed);
      }
    } catch {}
  }, []);

  /* Persist on change */
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications));
    } catch {}
  }, [notifications]);

  /* Listen for new notifications via custom event */
  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<Partial<NotificationItem>>;
      const notif: NotificationItem = {
        id: `n_${Date.now()}_${Math.random()}`,
        type: ce.detail.type || "info",
        title: ce.detail.title || "إشعار",
        message: ce.detail.message || "",
        timestamp: Date.now(),
        read: false,
      };
      setNotifications((prev) => [notif, ...prev].slice(0, 100));
    };
    window.addEventListener("exchange:notification", handler);
    return () =>
      window.removeEventListener("exchange:notification", handler);
  }, []);

  /* Close on Escape */
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  /* Actions */
  const markAllRead = () => {
    setNotifications((prev) =>
      prev.map((n) => ({ ...n, read: true }))
    );
  };

  const clearAll = () => {
    setNotifications([]);
  };

  const deleteOne = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const markOneRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  /* Filter */
  const filtered =
    filter === "unread"
      ? notifications.filter((n) => !n.read)
      : notifications;

  const unreadCount = notifications.filter((n) => !n.read).length;

  if (!open) return null;

  /* Type-based styling */
  const getTypeStyle = (type: NotificationItem["type"]) => {
    switch (type) {
      case "order_filled":
        return {
          icon: TrendingUp,
          color: "text-emerald-400",
          bg: "bg-emerald-500/5",
          border: "border-emerald-500/15",
        };
      case "order_placed":
        return {
          icon: Info,
          color: "text-blue-400",
          bg: "bg-blue-500/5",
          border: "border-blue-500/15",
        };
      case "order_cancelled":
        return {
          icon: X,
          color: "text-red-400",
          bg: "bg-red-500/5",
          border: "border-red-500/15",
        };
      case "alert":
        return {
          icon: AlertCircle,
          color: "text-yellow-400",
          bg: "bg-yellow-500/5",
          border: "border-yellow-500/15",
        };
      case "error":
        return {
          icon: AlertCircle,
          color: "text-red-400",
          bg: "bg-red-500/5",
          border: "border-red-500/15",
        };
      default:
        return {
          icon: Info,
          color: "text-muted-foreground",
          bg: "bg-muted/5",
          border: "border-border/15",
        };
    }
  };

  /* Relative time format */
  const formatRelativeTime = (ts: number) => {
    const diff = Date.now() - ts;
    if (diff < 60_000) return "الآن";
    if (diff < 3_600_000) return `قبل ${Math.floor(diff / 60_000)} دقيقة`;
    if (diff < 86_400_000) return `قبل ${Math.floor(diff / 3_600_000)} ساعة`;
    return `قبل ${Math.floor(diff / 86_400_000)} يوم`;
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="glass-panel-strong rounded-2xl w-full max-w-md max-h-[85vh] overflow-hidden border-2 border-primary/20 shadow-2xl animate-slide-in-up flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-border/30 bg-primary/5">
          <div className="flex items-center gap-2">
            <div className="relative">
              <div className="h-7 w-7 rounded-lg bg-primary flex items-center justify-center text-white">
                <Bell className="h-4 w-4" />
              </div>
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 h-3.5 min-w-3.5 px-0.5 rounded-full bg-red-500 text-white text-[8px] font-bold flex items-center justify-center">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </div>
            <div>
              <h3 className="font-bold text-sm text-primary">الإشعارات</h3>
              <p className="text-[10px] text-muted-foreground">
                {unreadCount} غير مقروء من أصل {notifications.length}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-muted/30 text-muted-foreground hover:text-foreground transition-all"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Filter + actions */}
        <div className="flex items-center gap-1 p-2 border-b border-border/20">
          <button
            onClick={() => setFilter("all")}
            className={`px-2 py-1 rounded text-[10px] font-medium transition-all ${
              filter === "all"
                ? "bg-primary/20 text-primary"
                : "text-muted-foreground hover:bg-muted/30"
            }`}
          >
            الكل ({notifications.length})
          </button>
          <button
            onClick={() => setFilter("unread")}
            className={`px-2 py-1 rounded text-[10px] font-medium transition-all ${
              filter === "unread"
                ? "bg-primary/20 text-primary"
                : "text-muted-foreground hover:bg-muted/30"
            }`}
          >
            غير مقروء ({unreadCount})
          </button>
          <div className="flex-1" />
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="p-1 rounded hover:bg-muted/30 text-muted-foreground hover:text-foreground transition-all flex items-center gap-0.5 text-[9px]"
              title="تعليم الكل كمقروء"
            >
              <CheckCheck className="h-3 w-3" />
              تعليم الكل
            </button>
          )}
          {notifications.length > 0 && (
            <button
              onClick={clearAll}
              className="p-1 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-all"
              title="حذف الكل"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          )}
        </div>

        {/* Notifications list */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 px-4">
              <Bell className="h-8 w-8 text-muted-foreground/30 mb-2" />
              <p className="text-[11px] text-muted-foreground">
                {filter === "unread"
                  ? "لا توجد إشعارات غير مقروءة"
                  : "لا توجد إشعارات"}
              </p>
            </div>
          ) : (
            filtered.map((notif) => {
              const style = getTypeStyle(notif.type);
              const Icon = style.icon;
              return (
                <div
                  key={notif.id}
                  onClick={() => markOneRead(notif.id)}
                  className={`relative p-2.5 border-b border-border/10 cursor-pointer transition-all hover:bg-muted/10 ${style.bg} ${
                    !notif.read ? "border-r-2 border-r-primary" : ""
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <div
                      className={`h-6 w-6 rounded-lg ${style.bg} ${style.border} border flex items-center justify-center shrink-0 mt-0.5`}
                    >
                      <Icon className={`h-3 w-3 ${style.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <h4 className="font-bold text-[11px] truncate">
                          {notif.title}
                        </h4>
                        <span className="text-[9px] text-muted-foreground/70 shrink-0">
                          {formatRelativeTime(notif.timestamp)}
                        </span>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">
                        {notif.message}
                      </p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteOne(notif.id);
                      }}
                      className="p-0.5 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-all shrink-0"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </div>
                  {!notif.read && (
                    <span className="absolute top-2 left-2 h-1.5 w-1.5 rounded-full bg-primary" />
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

/* Helper to push a notification from anywhere in the app */
export function pushNotification(notif: Partial<NotificationItem>) {
  window.dispatchEvent(
    new CustomEvent("exchange:notification", { detail: notif })
  );
}
