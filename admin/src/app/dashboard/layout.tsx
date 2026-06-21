"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard,
  Users,
  ShieldCheck,
  Wallet,
  LogOut,
  Menu,
  ChevronDown,
  Image,
  ScrollText,
  Percent,
  Zap,
  X,
  Shield,
  User,
  Settings,
} from "lucide-react";
import { authPost } from "@/lib/api";

const NAV = [
  { href: "/dashboard", icon: LayoutDashboard, label: "الإحصائيات" },
  { href: "/dashboard/users", icon: Users, label: "المستخدمين" },
  { href: "/dashboard/kyc", icon: ShieldCheck, label: "طلبات KYC" },
  { href: "/dashboard/transactions", icon: Wallet, label: "المعاملات" },
  { href: "/dashboard/audit-logs", icon: ScrollText, label: "سجلات التدقيق" },
  { href: "/dashboard/ads", icon: Image, label: "الإعلانات" },
  { href: "/dashboard/fees", icon: Percent, label: "رسوم التداول" },
  { href: "/dashboard/settings", icon: Settings, label: "إعدادات النظام" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<any>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    const userData = localStorage.getItem("user");
    if (!token || !userData) { router.push("/login"); return; }
    try {
      const parsed = JSON.parse(userData);
      if (parsed.role !== "ADMIN") { router.push("/login"); return; }
      setUser(parsed);
    } catch { router.push("/login"); }
  }, [router]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setUserMenuOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close sidebar on route change
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  const handleLogout = async () => {
    const refreshToken = localStorage.getItem("refresh_token");
    try {
      await authPost("/api/v1/auth/logout", { refresh_token: refreshToken });
    } catch {}
    localStorage.removeItem("token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("user");
    router.push("/login");
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center glow-emerald animate-pulse">
            <Zap className="h-6 w-6 text-white" />
          </div>
          <span className="spinner h-6 w-6" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* ─── Header ─── */}
      <header className="fixed top-0 left-0 right-0 z-40 border-b border-border/50 bg-background/60 backdrop-blur-2xl">
        <div className="absolute inset-0 bg-grid-pattern opacity-20 pointer-events-none" />
        <div className="relative flex items-center justify-between h-16 px-4 lg:px-6">
          {/* Right side: Mobile menu + Branding */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="btn-ghost p-2 lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                <Zap className="h-5 w-5 text-white" />
              </div>
              <div className="hidden sm:flex flex-col">
                <span className="text-base font-bold gradient-text leading-tight">
                  EgMoney
                </span>
                <span className="text-[10px] text-muted-foreground leading-tight">
                  لوحة الإدارة
                </span>
              </div>
            </div>
          </div>

          {/* Left side: User Menu */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl hover:bg-muted/30 transition-all duration-200"
            >
              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 p-[2px]">
                <div className="h-full w-full rounded-full bg-background flex items-center justify-center text-xs font-bold text-primary">
                  {user.username?.charAt(0)?.toUpperCase() || "A"}
                </div>
              </div>
              <div className="hidden sm:flex flex-col items-start">
                <span className="text-sm font-medium leading-tight">{user.username}</span>
                <span className="text-[10px] text-muted-foreground leading-tight">مدير النظام</span>
              </div>
              <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 ${userMenuOpen ? "rotate-180" : ""}`} />
            </button>

            {/* User Dropdown */}
            {userMenuOpen && (
              <div className="absolute left-0 mt-2 w-64 glass-panel-strong rounded-2xl p-2 shadow-2xl z-50 animate-scale-in">
                {/* Profile Section */}
                <div className="p-3 mb-1 rounded-xl bg-muted/20">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 p-[2px]">
                      <div className="h-full w-full rounded-full bg-background flex items-center justify-center text-sm font-bold text-primary">
                        {user.username?.charAt(0)?.toUpperCase() || "A"}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{user.username}</p>
                      <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-1.5">
                    <Shield className="h-3 w-3 text-emerald-500" />
                    <span className="text-[11px] font-medium text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                      مدير النظام
                    </span>
                  </div>
                </div>

                <div className="h-px bg-border/30 mx-2 my-1" />

                <button
                  onClick={handleLogout}
                  className="flex w-full items-center gap-2.5 px-3 py-2.5 text-sm rounded-xl text-red-400 hover:bg-red-500/10 transition-all duration-200"
                >
                  <LogOut className="h-4 w-4" />
                  <span>تسجيل الخروج</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ─── Sidebar ─── */}
      <aside
        className={`fixed top-16 right-0 bottom-0 z-30 w-64 bg-background/95 backdrop-blur-2xl border-l border-border/50 transform transition-transform duration-300 ease-out lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Brand at top of sidebar - visible on lg+ */}
          <div className="hidden lg:flex items-center gap-2.5 p-5 pb-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
              <Zap className="h-4 w-4 text-white" />
            </div>
            <div>
              <span className="text-sm font-bold gradient-text">EgMoney</span>
            </div>
          </div>

          {/* Section Header */}
          <div className="px-5 pt-5 pb-2">
            <span className="text-[11px] font-semibold text-muted-foreground/60 uppercase tracking-wider">
              القائمة الرئيسية
            </span>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
            {NAV.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`nav-item ${isActive ? "nav-item-active" : "nav-item-inactive"}`}
                >
                  <Icon className="h-[18px] w-[18px]" />
                  <span>{item.label}</span>
                  {isActive && (
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-l-full bg-primary" />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Bottom gradient line */}
          <div className="p-4">
            <div className="h-px bg-gradient-to-l from-emerald-500/50 via-teal-500/30 to-transparent rounded-full" />
            <div className="mt-3 flex items-center gap-2 text-[11px] text-muted-foreground/50">
              <Zap className="h-3 w-3" />
              <span>EgMoney Admin v1.0</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-20 lg:hidden animate-fade-in"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ─── Main Content ─── */}
      <main className="pt-16 pr-0 lg:pr-64 min-h-screen transition-all duration-300">
        <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">{children}</div>
      </main>
    </div>
  );
}
