"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import {
  LayoutDashboard,
  TrendingUp,
  Wallet,
  Clock,
  User,
  LogOut,
  Menu,
  X,
  ChevronDown,
  Shield,
  FileText,
  Bell,
  Check,
  CheckCheck,
  ArrowUpRight,
  ArrowDownRight,
  ShieldCheck,
  AlertTriangle,
  Ban,
  Banknote,
  SendHorizonal,
  Zap,
  Home,
} from "lucide-react";
import { authGet, authPut } from "@/lib/api";

/* ─────────── Navigation Config ─────────── */
const NAV_SECTIONS = [
  {
    items: [
      { href: "/dashboard", icon: LayoutDashboard, label: "لوحة التحكم" },
      { href: "/dashboard/exchange", icon: TrendingUp, label: "التداول" },
      { href: "/dashboard/wallet", icon: Wallet, label: "المحفظة" },
      { href: "/dashboard/history", icon: Clock, label: "سجل الصفقات" },
    ],
  },
  {
    title: "الحساب",
    items: [
      { href: "/dashboard/notifications", icon: Bell, label: "الإشعارات" },
      { href: "/dashboard/kyc", icon: FileText, label: "التحقق" },
      { href: "/dashboard/security", icon: Shield, label: "الأمان" },
      { href: "/dashboard/profile", icon: User, label: "الملف الشخصي" },
    ],
  },
];

const TICKER_SYMBOLS = [
  { symbol: "BTCUSDT", label: "BTC", color: "text-amber-400" },
  { symbol: "ETHUSDT", label: "ETH", color: "text-blue-400" },
  { symbol: "BNBUSDT", label: "BNB", color: "text-yellow-400" },
  { symbol: "SOLUSDT", label: "SOL", color: "text-purple-400" },
];

/* ─────────── Types ─────────── */
interface Notification {
  id: number;
  type: string;
  title: string;
  body: string;
  data: string;
  read: boolean;
  created_at: string;
}

/* ─────────── Icon Map (lucide-react) ─────────── */
const NOTIF_ICON_MAP: Record<string, { icon: any; bg: string; fg: string }> = {
  ORDER_FILLED: { icon: Check, bg: "bg-emerald-500/15", fg: "text-emerald-400" },
  ORDER_CANCELLED: { icon: Ban, bg: "bg-red-500/15", fg: "text-red-400" },
  ORDER_TRIGGERED: { icon: Zap, bg: "bg-amber-500/15", fg: "text-amber-400" },
  DEPOSIT_APPROVED: { icon: Banknote, bg: "bg-emerald-500/15", fg: "text-emerald-400" },
  WITHDRAWAL_APPROVED: { icon: SendHorizonal, bg: "bg-teal-500/15", fg: "text-teal-400" },
  WITHDRAWAL_REJECTED: { icon: AlertTriangle, bg: "bg-red-500/15", fg: "text-red-400" },
  KYC_APPROVED: { icon: ShieldCheck, bg: "bg-emerald-500/15", fg: "text-emerald-400" },
  KYC_REJECTED: { icon: AlertTriangle, bg: "bg-orange-500/15", fg: "text-orange-400" },
};
const DEFAULT_NOTIF_ICON = { icon: Bell, bg: "bg-primary/15", fg: "text-primary" };

/* ─────────── Component ─────────── */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<any>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [prices, setPrices] = useState<Record<string, { price: string; change: number }>>({});
  const [prevPrices, setPrevPrices] = useState<Record<string, string>>({});
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  /* ── Auth & Price WebSocket ── */
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) { router.push("/login"); return; }
    try { setUser(JSON.parse(localStorage.getItem("user") || "{}")); } catch { router.push("/login"); }

    const ws = new WebSocket("wss://stream.binance.com:9443/ws/!miniTicker@arr");
    ws.onmessage = (e) => {
      const data = JSON.parse(e.data);
      if (Array.isArray(data)) {
        const updates: Record<string, { price: string; change: number }> = {};
        const newPrev: Record<string, string> = {};
        data.forEach((t: any) => {
          if (["BTCUSDT", "ETHUSDT", "BNBUSDT", "SOLUSDT"].includes(t.s)) {
            const prev = prevPrices[t.s];
            const change = prev ? (parseFloat(t.c) - parseFloat(prev)) / parseFloat(prev) * 100 : 0;
            updates[t.s] = { price: t.c, change };
            newPrev[t.s] = t.c;
          }
        });
        setPrices(prev => {
          const merged = { ...prev };
          Object.keys(updates).forEach(k => {
            merged[k] = { ...prev[k], ...updates[k] };
          });
          return merged;
        });
        setPrevPrices(p => ({ ...p, ...newPrev }));
      }
    };
    return () => ws.close();
  }, [router]);

  /* ── Notifications + User WebSocket ── */
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
    const interval = setInterval(fetchNotifs, 30000);

    const token = localStorage.getItem("token");
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
    const wsUrl = apiUrl.replace(/^http/, "ws") + "/ws/user?token=" + token;
    let userWs: WebSocket | null = null;
    let reconnectTimer: number;

    const connectUserWs = () => {
      try {
        userWs = new WebSocket(wsUrl);
        userWs.onmessage = (e) => {
          try {
            const event = JSON.parse(e.data);
            if (event.type === "order_fill") {
              toast.success(`تم تنفيذ الأمر: ${event.data.side === "BUY" ? "شراء" : "بيع"} ${event.data.quantity} ${event.data.symbol}`);
            } else if (event.type === "order_trigger") {
              toast(`تم تفعيل الأمر الشرطي: ${event.data.symbol}`, { icon: "⚡" });
            } else if (event.type === "deposit_approved") {
              toast.success(`تم تأكيد الإيداع: ${event.data.amount} ${event.data.currency}`);
            } else if (event.type === "withdrawal_approved") {
              toast.success(`تم تأكيد السحب: ${event.data.amount} ${event.data.currency}`);
            } else if (event.type === "withdrawal_rejected") {
              toast.error(`تم رفض السحب: ${event.data.amount} ${event.data.currency}`);
            } else if (event.type === "kyc_APPROVED") {
              toast.success("تمت الموافقة على التحقق من الهوية");
            } else if (event.type === "kyc_REJECTED") {
              toast.error("تم رفض طلب التحقق من الهوية");
            }
            fetchNotifs();
          } catch {}
        };
        userWs.onclose = () => { reconnectTimer = window.setTimeout(connectUserWs, 5000); };
        userWs.onerror = () => { userWs?.close(); };
      } catch {}
    };
    connectUserWs();

    return () => {
      clearInterval(interval);
      clearTimeout(reconnectTimer);
      userWs?.close();
    };
  }, []);

  /* ── Click Outside ── */
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setUserMenuOpen(false);
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  /* ── Handlers ── */
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

  const formatPrice = (val: string | undefined) => {
    if (!val) return "—";
    const n = parseFloat(val);
    if (n >= 1000) return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 6 });
  };

  /* ── Loading ── */
  if (!user) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="spinner h-10 w-10" />
        <span className="text-sm text-muted-foreground animate-pulse">جاري التحميل...</span>
      </div>
    </div>
  );

  /* ── Render ── */
  return (
    <div className="min-h-screen bg-background">
      {/* ═══════════════ HEADER ═══════════════ */}
      <header className="fixed top-0 left-0 right-0 z-40 h-16 border-b border-border/30"
        style={{ background: "rgba(10, 12, 18, 0.75)", backdropFilter: "blur(24px) saturate(1.8)", WebkitBackdropFilter: "blur(24px) saturate(1.8)" }}
      >
        <div className="flex items-center justify-between h-full px-4 lg:px-6">
          {/* Right side: Logo + Mobile toggle */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="btn-ghost p-2 md:hidden rounded-xl"
              aria-label="فتح القائمة"
            >
              {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            <Link href="/dashboard" className="flex items-center gap-2.5 group">
              <div className="h-8 w-8 rounded-lg bg-primary/15 flex items-center justify-center glow-emerald">
                <span className="text-primary font-black text-sm">E</span>
              </div>
              <span className="text-lg font-bold gradient-text hidden sm:block tracking-tight">EgMoney</span>
            </Link>
          </div>

          {/* Center: Live Price Ticker */}
          <div className="hidden md:flex items-center gap-1 lg:gap-5">
            {TICKER_SYMBOLS.map(({ symbol, label, color }) => {
              const pData = prices[symbol];
              const price = pData?.price;
              const change = pData?.change ?? 0;
              const isUp = change >= 0;
              return (
                <div key={symbol} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg hover:bg-muted/20 transition-colors">
                  <span className={`text-[11px] font-semibold ${color}`}>{label}</span>
                  <span className="text-xs font-semibold text-foreground tabular-nums">
                    ${formatPrice(price)}
                  </span>
                  <span className={`text-[10px] font-semibold tabular-nums flex items-center gap-0.5 ${isUp ? "text-emerald-400" : "text-red-400"}`}>
                    {isUp ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                    {Math.abs(change).toFixed(2)}%
                  </span>
                </div>
              );
            })}
          </div>

          {/* Left side: Notifications + User */}
          <div className="flex items-center gap-2">
            {/* Notification Bell */}
            <div className="relative" ref={notifRef}>
              <button
                onClick={() => setNotifOpen(!notifOpen)}
                className="btn-ghost p-2.5 rounded-xl relative group"
                aria-label="الإشعارات"
              >
                <Bell className="h-5 w-5 transition-transform group-hover:rotate-12 duration-200" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 h-4 min-w-[16px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.5)]">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </button>

              {/* Notifications Dropdown */}
              {notifOpen && (
                <div className="absolute left-0 mt-3 w-80 glass-panel-strong rounded-2xl shadow-2xl border border-border/30 z-50 max-h-[420px] flex flex-col animate-slide-in-down overflow-hidden">
                  {/* Header */}
                  <div className="flex items-center justify-between p-4 border-b border-border/20">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-sm">الإشعارات</h3>
                      {unreadCount > 0 && (
                        <span className="text-[10px] font-semibold bg-primary/15 text-primary px-2 py-0.5 rounded-full">
                          {unreadCount} جديد
                        </span>
                      )}
                    </div>
                    {unreadCount > 0 && (
                      <button
                        onClick={handleMarkAllRead}
                        className="text-[11px] text-primary hover:text-primary/80 transition-colors flex items-center gap-1 font-medium"
                      >
                        <CheckCheck className="h-3.5 w-3.5" />
                        تعيين الكل كمقروء
                      </button>
                    )}
                  </div>

                  {/* Notification List */}
                  <div className="overflow-y-auto flex-1 max-h-80 custom-scrollbar">
                    {notifications.length === 0 ? (
                      <div className="p-8 text-center">
                        <Bell className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
                        <p className="text-sm text-muted-foreground">لا توجد إشعارات</p>
                      </div>
                    ) : (
                      notifications.map((notif, i) => {
                        const iconData = NOTIF_ICON_MAP[notif.type] || DEFAULT_NOTIF_ICON;
                        const NotifIcon = iconData.icon;
                        return (
                          <div
                            key={notif.id}
                            className={`p-3.5 border-b border-border/10 cursor-pointer transition-all duration-200 hover:bg-muted/15 ${!notif.read ? "bg-primary/[0.04]" : ""}`}
                            onClick={() => !notif.read && handleMarkRead(notif.id)}
                            style={{ animationDelay: `${i * 40}ms` }}
                          >
                            <div className="flex items-start gap-3">
                              {/* Icon */}
                              <div className={`shrink-0 h-8 w-8 rounded-lg ${iconData.bg} flex items-center justify-center`}>
                                <NotifIcon className={`h-4 w-4 ${iconData.fg}`} />
                              </div>
                              {/* Content */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="text-sm font-semibold truncate">{notif.title}</p>
                                  {!notif.read && (
                                    <span className="shrink-0 h-2 w-2 rounded-full bg-primary shadow-[0_0_6px_rgba(16,185,129,0.5)] animate-pulse" />
                                  )}
                                </div>
                                <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">{notif.body}</p>
                                <p className="text-[10px] text-muted-foreground/60 mt-1.5">{formatTimeAgo(notif.created_at)}</p>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Footer */}
                  {notifications.length > 0 && (
                    <div className="p-3 border-t border-border/20">
                      <Link
                        href="/dashboard/notifications"
                        onClick={() => setNotifOpen(false)}
                        className="block text-center text-xs font-medium text-primary hover:text-primary/80 transition-colors py-1"
                      >
                        عرض جميع الإشعارات
                      </Link>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* User Menu */}
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-2.5 btn-ghost px-2 py-1.5 rounded-xl group"
              >
                {/* Avatar with gradient ring */}
                <div className="relative">
                  <div className="h-8 w-8 rounded-full bg-gradient-to-br from-emerald-400 via-teal-400 to-emerald-600 p-[2px]">
                    <div className="h-full w-full rounded-full bg-card flex items-center justify-center">
                      <span className="text-xs font-bold text-primary">{user.username?.charAt(0)?.toUpperCase() || "U"}</span>
                    </div>
                  </div>
                  <span className="absolute -bottom-0.5 -left-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 border-2 border-card status-dot-online" />
                </div>
                <div className="hidden sm:flex flex-col items-start">
                  <span className="text-sm font-semibold leading-tight">{user.username}</span>
                  <span className="text-[10px] text-muted-foreground leading-tight">
                    {user.role === "ADMIN" ? "مدير" : "مستخدم"}
                  </span>
                </div>
                <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 ${userMenuOpen ? "rotate-180" : ""}`} />
              </button>

              {/* User Dropdown */}
              {userMenuOpen && (
                <div className="absolute left-0 mt-3 w-56 glass-panel-strong rounded-2xl p-2 shadow-2xl border border-border/30 z-50 animate-slide-in-down overflow-hidden">
                  {/* User Info */}
                  <div className="px-3 py-3 mb-1">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-gradient-to-br from-emerald-400 via-teal-400 to-emerald-600 p-[2px]">
                        <div className="h-full w-full rounded-full bg-card flex items-center justify-center">
                          <span className="text-sm font-bold text-primary">{user.username?.charAt(0)?.toUpperCase() || "U"}</span>
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{user.username}</p>
                        <p className="text-[11px] text-muted-foreground truncate">{user.email}</p>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center gap-1.5">
                      <span className="text-[10px] font-medium bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                        {user.role === "ADMIN" ? "مدير النظام" : "مستخدم"}
                      </span>
                    </div>
                  </div>

                  <div className="h-px bg-border/20 mx-2" />

                  {/* Menu Items */}
                  <Link
                    href="/dashboard/profile"
                    className="flex items-center gap-3 w-full px-3 py-2.5 text-sm rounded-xl hover:bg-muted/20 transition-colors group"
                    onClick={() => setUserMenuOpen(false)}
                  >
                    <User className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                    <span>الملف الشخصي</span>
                  </Link>
                  <Link
                    href="/dashboard/security"
                    className="flex items-center gap-3 w-full px-3 py-2.5 text-sm rounded-xl hover:bg-muted/20 transition-colors group"
                    onClick={() => setUserMenuOpen(false)}
                  >
                    <Shield className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                    <span>الأمان والحماية</span>
                  </Link>

                  <div className="h-px bg-border/20 mx-2 my-1" />

                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-3 w-full px-3 py-2.5 text-sm rounded-xl text-red-400 hover:bg-red-500/10 transition-colors group"
                  >
                    <LogOut className="h-4 w-4 group-hover:text-red-400 transition-colors" />
                    <span className="font-medium">تسجيل الخروج</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ═══════════════ SIDEBAR ═══════════════ */}
      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-30 md:hidden animate-fade-in"
          onClick={() => setSidebarOpen(false)}
          style={{ backdropFilter: "blur(4px)" }}
        />
      )}

      <aside
        className={`fixed top-16 right-0 bottom-0 z-30 w-64 border-l border-border/20 transform transition-transform duration-300 ease-in-out md:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "translate-x-full"
        }`}
        style={{ background: "rgba(10, 12, 18, 0.88)", backdropFilter: "blur(20px) saturate(1.5)", WebkitBackdropFilter: "blur(20px) saturate(1.5)" }}
      >
        <div className="flex flex-col h-full">
          {/* Logo Section */}
          <div className="px-5 pt-6 pb-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/10 flex items-center justify-center border border-emerald-500/10">
                <span className="text-primary font-black text-base">E</span>
              </div>
              <div>
                <h2 className="text-base font-bold gradient-text tracking-tight">EgMoney</h2>
                <p className="text-[10px] text-muted-foreground">منصة التداول الرقمية</p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto custom-scrollbar px-3 pb-4">
            {NAV_SECTIONS.map((section, si) => (
              <div key={si}>
                {section.title && (
                  <div className="flex items-center gap-2 px-4 pt-5 pb-2">
                    <span className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-widest">{section.title}</span>
                    <div className="flex-1 h-px bg-border/15" />
                  </div>
                )}
                <div className="space-y-0.5">
                  {section.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = pathname === item.href;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setSidebarOpen(false)}
                        className={`nav-item ${isActive ? "nav-item-active" : "nav-item-inactive"}`}
                      >
                        <Icon className={`h-[18px] w-[18px] transition-colors ${isActive ? "text-primary" : ""}`} />
                        <span>{item.label}</span>
                        {isActive && (
                          <div className="mr-auto h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_6px_rgba(16,185,129,0.5)]" />
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* Separator */}
            <div className="my-4 mx-3 h-px bg-border/20" />

            {/* Home Link */}
            <Link
              href="/"
              className="nav-item nav-item-inactive"
              onClick={() => setSidebarOpen(false)}
            >
              <Home className="h-[18px] w-[18px]" />
              <span>الصفحة الرئيسية</span>
            </Link>
          </nav>

          {/* Bottom Gradient Line */}
          <div className="px-4 pb-4">
            <div className="h-px bg-gradient-to-l from-transparent via-emerald-500/30 to-transparent" />
          </div>
        </div>
      </aside>

      {/* ═══════════════ MAIN CONTENT ═══════════════ */}
      <main className="pt-16 pr-0 md:pr-64 min-h-screen transition-all duration-300">
        <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">{children}</div>
      </main>
    </div>
  );
}
