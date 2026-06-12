"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { LayoutDashboard, Users, ShieldCheck, Wallet, LogOut, Menu, ChevronDown, FileText } from "lucide-react";

const NAV = [
  { href: "/dashboard", icon: LayoutDashboard, label: "الإحصائيات" },
  { href: "/dashboard/users", icon: Users, label: "المستخدمين" },
  { href: "/dashboard/kyc", icon: ShieldCheck, label: "طلبات KYC" },
  { href: "/dashboard/transactions", icon: Wallet, label: "المعاملات" },
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

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    router.push("/login");
  };

  if (!user) return <div className="min-h-screen bg-background flex items-center justify-center"><span className="spinner h-8 w-8" /></div>;

  return (
    <div className="min-h-screen bg-background">
      <header className="fixed top-0 left-0 right-0 z-40 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="flex items-center justify-between h-16 px-4">
          <div className="flex items-center gap-4">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="btn-ghost p-2 md:hidden"><Menu className="h-5 w-5" /></button>
            <span className="text-lg font-bold gradient-text">EgMoney - الإدارة</span>
          </div>
          <div className="relative" ref={menuRef}>
            <button onClick={() => setUserMenuOpen(!userMenuOpen)} className="flex items-center gap-2 btn-ghost text-sm">
              <div className="h-7 w-7 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">{user.username?.charAt(0)?.toUpperCase() || "A"}</div>
              <span className="hidden sm:inline">{user.username}</span>
              <ChevronDown className="h-3 w-3" />
            </button>
            {userMenuOpen && (
              <div className="absolute left-0 mt-2 w-48 glass-panel-strong rounded-xl p-2 shadow-xl border border-border/50 z-50">
                <button onClick={handleLogout} className="flex w-full items-center gap-2 px-3 py-2 text-sm rounded-lg text-red-500 hover:bg-red-500/10">
                  <LogOut className="h-4 w-4" /> تسجيل الخروج
                </button>
              </div>
            )}
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
        </nav>
      </aside>

      {sidebarOpen && <div className="fixed inset-0 bg-black/50 z-20 md:hidden" onClick={() => setSidebarOpen(false)} />}

      <main className="pt-16 pr-0 md:pr-64 min-h-screen">
        <div className="p-4 md:p-8 max-w-7xl mx-auto">{children}</div>
      </main>
    </div>
  );
}
