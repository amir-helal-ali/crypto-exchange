"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Bell, CheckCheck } from "lucide-react";
import { authGet, authPut } from "@/lib/api";

interface NotificationItem {
  id: number;
  type: string;
  title: string;
  body: string;
  data: string;
  read: boolean;
  created_at: string;
}

interface NotificationBellProps {
  /** Custom className for the wrapper div */
  className?: string;
}

const NOTIF_ICON_MAP: Record<string, string> = {
  ORDER_FILLED: "✅",
  ORDER_CANCELLED: "❌",
  ORDER_TRIGGERED: "⚡",
  DEPOSIT_APPROVED: "💰",
  WITHDRAWAL_APPROVED: "📤",
  WITHDRAWAL_REJECTED: "🚫",
  KYC_APPROVED: "🛡",
  KYC_REJECTED: "⚠",
  SECURITY_ALERT: "🔒",
};

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "الآن";
  if (mins < 60) return `منذ ${mins} دقيقة`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `منذ ${hours} ساعة`;
  const days = Math.floor(hours / 24);
  return `منذ ${days} يوم`;
}

export default function NotificationBell({ className = "" }: NotificationBellProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await authGet("/api/v1/notifications?limit=20");
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.data || []);
        setUnreadCount(data.unread_count || 0);
      }
    } catch {}
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleMarkRead = async (id: number) => {
    try {
      await authPut(`/api/v1/notifications/${id}/read`);
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {}
  };

  const handleMarkAllRead = async () => {
    try {
      await authPut("/api/v1/notifications/read-all");
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch {}
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="btn-ghost p-2 relative"
        aria-label="الإشعارات"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 h-4 min-w-[16px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute left-0 mt-2 w-80 glass-panel-strong rounded-xl shadow-xl border border-border/50 z-50 max-h-96 flex flex-col">
          <div className="flex items-center justify-between p-3 border-b border-border/30">
            <h3 className="font-semibold text-sm">الإشعارات</h3>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-xs text-primary hover:underline flex items-center gap-1"
              >
                <CheckCheck className="h-3 w-3" /> تعيين الكل كمقروء
              </button>
            )}
          </div>
          <div className="overflow-y-auto flex-1 max-h-72">
            {notifications.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                لا توجد إشعارات
              </div>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif.id}
                  className={`p-3 border-b border-border/20 cursor-pointer hover:bg-muted/10 transition-colors ${
                    !notif.read ? "bg-primary/5" : ""
                  }`}
                  onClick={() => !notif.read && handleMarkRead(notif.id)}
                >
                  <div className="flex items-start gap-2">
                    <span className="text-lg shrink-0">
                      {NOTIF_ICON_MAP[notif.type] || "🔔"}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate">{notif.title}</p>
                        {!notif.read && (
                          <span className="h-2 w-2 rounded-full bg-primary shrink-0" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                        {notif.body}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {formatTimeAgo(notif.created_at)}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
