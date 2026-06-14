"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { LayoutDashboard, TrendingUp, Wallet, Clock, User, LogOut, Menu, X, ChevronDown, BarChart3, Shield, FileText, Bell, Check, CheckCheck } from "lucide-react";
import { authGet, authPut } from "@/lib/api";

const NAV = [
  { href: "/dashboard", icon: LayoutDashboard, label: "لوحة التحكم" },
  { href: "/dashboard/exchange", icon: TrendingUp, label: "التداول" },
  { href: "/dashboard/wallet", icon: Wallet, label: "المحفظة" },
  { href: "/dashboard/history", icon: Clock, label: "سجل الصفقات" },
  { href: "/dashboard/notifications", icon: Bell, label: "الإشعارات" },
  { href: "/dashboard/kyc", icon: FileText, label: "التحقق" },
  { href: "/dashboard/security", icon: Shield, label: "الأمان" },
  { href: "/dashboard/profile", icon: User, label: "الملف الشخصي" },
];

interface Notification {
  id: number;
  type: string;
  title: string;
  body: string;
  data: string;
  read: boolean;
  created_at: string;
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<any>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) { router.push("/login"); return; }
    try { setUser(JSON.parse(localStorage.getItem("user") || "{}")); } catch { router.push("/login"); }

    const ws = new WebSocket("wss://stream.binance.com:9443/ws/!miniTicker@arr");
    ws.onmessage = (e) => {
      const data = JSON.parse(e.data);
      if (Array.isArray(data)) {
        const updates: Record<string, string> = {};
        data.forEach((t: any) => { if (["BTCUSDT", "ETHUSDT", "BNBUSDT", "SOLUSDT"].includes(t.s)) updates[t.s] = t.c; });
        setPrices(prev => ({ ...prev, ...updates }));
      }
    };
    return () => ws.close();
  }, [router]);

  // Fetch notifications periodically
  useEffect(() => {
    const fetchNotifs = async () => {
      try {
        const res = await authGet("/api/v1/notifications?limit=20");
        if (res.ok) {
          const data = await res.json();
          setNotifications(data.data || []);
          setUnreadCount(data.unread_count || 0);
        }
      } catch {}
    };
    fetchNotifs();
    const interval = setInterval(fetchNotifs, 30000); // refresh every 30s
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setUserMenuOpen(false);
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    const refreshToken = localStorage.getItem("refresh_token");
    const token = localStorage.getItem("token");
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"}/api/v1/auth/logout`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
    } catch {}
    localStorage.removeItem("token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("user");
    router.push("/login");
  };

  const handleMarkRead = async (id: number) => {
    try {
      await authPut(`/api/v1/notifications/${id}/read`);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch {}
  };

  const handleMarkAllRead = async () => {
    try {
      await authPut("/api/v1/notifications/read-all");
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch {}
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

  if (!user) return <div className="min-h-screen bg-background flex items-center justify-center"><span className="spinner h-8 w-8" /></div>;

  return (
    <div className="min-h-screen bg-background">
      <header className="fixed top-0 left-0 right-0 z-40 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="flex items-center justify-between h-16 px-4">
          <div className="flex items-center gap-4">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="btn-ghost p-2 md:hidden"><Menu className="h-5 w-5" /></button>
            <Link href="/dashboard" className="text-lg font-bold gradient-text hidden sm:block">EgMoney</Link>
          </div>
          <div className="hidden md:flex items-center gap-4 text-xs">
            {["BTCUSDT", "ETHUSDT", "BNBUSDT", "SOLUSDT"].map(s => (
              <span key={s} className="text-muted-foreground">{s.replace("USDT", "")} <span className="text-foreground font-medium tabular-nums">${parseFloat(prices[s] || "0").toLocaleString()}</span></span>
            ))}
          </div>
          <div className="flex items-center gap-2">
            {/* Notification Bell */}
            <div className="relative" ref={notifRef}>
              <button onClick={() => setNotifOpen(!notifOpen)} className="btn-ghost p-2 relative">
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 h-4 min-w-[16px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </button>
              {notifOpen && (
                <div className="absolute left-0 mt-2 w-80 glass-panel-strong rounded-xl shadow-xl border border-border/50 z-50 max-h-96 flex flex-col">
                  <div className="flex items-center justify-between p-3 border-b border-border/30">
                    <h3 className="font-semibold text-sm">الإشعارات</h3>
                    {unreadCount > 0 && (
                      <button onClick={handleMarkAllRead} className="text-xs text-primary hover:underline flex items-center gap-1">
                        <CheckCheck className="h-3 w-3" /> تعيين الكل كمقروء
                      </button>
                    )}
                  </div>
                  <div className="overflow-y-auto flex-1 max-h-72">
                    {notifications.length === 0 ? (
                      <div className="p-6 text-center text-sm text-muted-foreground">لا توجد إشعارات</div>
                    ) : (
                      notifications.map((notif) => (
                        <div
                          key={notif.id}
                          className={`p-3 border-b border-border/20 cursor-pointer hover:bg-muted/10 transition-colors ${!notif.read ? "bg-primary/5" : ""}`}
                          onClick={() => !notif.read && handleMarkRead(notif.id)}
                        >
                          <div className="flex items-start gap-2">
                            <span className="text-lg shrink-0">{getNotifIcon(notif.type)}</span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-medium truncate">{notif.title}</p>
                                {!notif.read && <span className="h-2 w-2 rounded-full bg-primary shrink-0" />}
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{notif.body}</p>
                              <p className="text-[10px] text-muted-foreground mt-1">{formatTimeAgo(notif.created_at)}</p>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* User Menu */}
            <div className="relative" ref={menuRef}>
              <button onClick={() => setUserMenuOpen(!userMenuOpen)} className="flex items-center gap-2 btn-ghost text-sm">
                <div className="h-7 w-7 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">{user.username?.charAt(0)?.toUpperCase() || "U"}</div>
                <span className="hidden sm:inline">{user.username}</span>
                <ChevronDown className="h-3 w-3" />
              </button>
              {userMenuOpen && (
                <div className="absolute left-0 mt-2 w-48 glass-panel-strong rounded-xl p-2 shadow-xl border border-border/50 z-50">
                  <Link href="/dashboard/profile" className="block w-full text-right px-3 py-2 text-sm rounded-lg hover:bg-muted/50" onClick={() => setUserMenuOpen(false)}>الملف الشخصي</Link>
                  <Link href="/dashboard/security" className="block w-full text-right px-3 py-2 text-sm rounded-lg hover:bg-muted/50" onClick={() => setUserMenuOpen(false)}>الأمان والحماية</Link>
                  <button onClick={handleLogout} className="flex w-full items-center gap-2 px-3 py-2 text-sm rounded-lg text-red-500 hover:bg-red-500/10">
                    <LogOut className="h-4 w-4" /> تسجيل الخروج
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <aside className={`fixed top-16 right-0 bottom-0 z-30 w-64 bg-background/95 backdrop-blur-xl border-l border-border/50 transform transition-transform duration-200 ${sidebarOpen ? "translate-x-0" : "translate-x-full"} md:translate-x-0`}>
        <nav className="p-4 space-y-1">
          {NAV.map(item => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link key={item.href} href={item.href} onClick={() => setSidebarOpen(false)} className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm transition-all ${isActive ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-muted/30 hover:text-foreground"}`}>
                <Icon className="h-5 w-5" /> {item.label}
              </Link>
            );
          })}
          <hr className="my-4 border-border/50" />
          <Link href="/" className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm text-muted-foreground hover:bg-muted/30 hover:text-foreground transition-all">
            <BarChart3 className="h-5 w-5" /> الصفحة الرئيسية
          </Link>
        </nav>
      </aside>

      {sidebarOpen && <div className="fixed inset-0 bg-black/50 z-20 md:hidden" onClick={() => setSidebarOpen(false)} />}

      <main className="pt-16 pr-0 md:pr-64 min-h-screen">
        <div className="p-4 md:p-8 max-w-7xl mx-auto">{children}</div>
      </main>
    </div>
  );
}
