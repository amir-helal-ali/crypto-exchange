"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import {
  LayoutDashboard,
  Users,
  FileText,
  ArrowRightLeft,
  Clock,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  UserCheck,
  DollarSign,
  Activity,
  BarChart3,
  Loader2,
  ChevronLeft,
  Megaphone,
  Coins,
} from "lucide-react";
import { authGet } from "@/lib/api";

interface AdminStats {
  total_users: number;
  total_orders: number;
  total_transactions: number;
  pending_kyc: number;
  pending_transactions: number;
  total_volume?: string;
  active_users_today?: number;
}

const STAT_CARDS = [
  {
    key: "total_users" as const,
    label: "إجمالي المستخدمين",
    icon: Users,
    color: "emerald",
    gradient: "from-emerald-500 to-teal-600",
    bgLight: "bg-emerald-500/10",
    textColor: "text-emerald-500",
    statCard: "stat-card-emerald",
    href: "/dashboard/admin/users",
  },
  {
    key: "total_orders" as const,
    label: "إجمالي الأوامر",
    icon: TrendingUp,
    color: "blue",
    gradient: "from-blue-500 to-cyan-600",
    bgLight: "bg-blue-500/10",
    textColor: "text-blue-500",
    statCard: "stat-card-blue",
    href: "/dashboard/admin/transactions",
  },
  {
    key: "total_transactions" as const,
    label: "إجمالي المعاملات",
    icon: ArrowRightLeft,
    color: "purple",
    gradient: "from-purple-500 to-violet-600",
    bgLight: "bg-purple-500/10",
    textColor: "text-purple-500",
    statCard: "stat-card-purple",
    href: "/dashboard/admin/transactions",
  },
  {
    key: "pending_kyc" as const,
    label: "طلبات تحقق معلقة",
    icon: Clock,
    color: "yellow",
    gradient: "from-yellow-500 to-amber-600",
    bgLight: "bg-yellow-500/10",
    textColor: "text-yellow-500",
    statCard: "stat-card-yellow",
    href: "/dashboard/admin/kyc",
  },
  {
    key: "pending_transactions" as const,
    label: "معاملات معلقة",
    icon: AlertTriangle,
    color: "orange",
    gradient: "from-orange-500 to-red-600",
    bgLight: "bg-orange-500/10",
    textColor: "text-orange-500",
    statCard: "stat-card-orange",
    href: "/dashboard/admin/transactions",
  },
];

const QUICK_ACTIONS = [
  {
    label: "إدارة المستخدمين",
    icon: Users,
    href: "/dashboard/admin/users",
    desc: "عرض وإدارة حسابات المستخدمين",
    gradient: "from-emerald-500 to-teal-600",
  },
  {
    label: "طلبات التحقق",
    icon: FileText,
    href: "/dashboard/admin/kyc",
    desc: "مراجعة طلبات KYC المعلقة",
    gradient: "from-blue-500 to-cyan-600",
  },
  {
    label: "مراجعة المعاملات",
    icon: ArrowRightLeft,
    href: "/dashboard/admin/transactions",
    desc: "الموافقة أو الرفض على المعاملات",
    gradient: "from-purple-500 to-violet-600",
  },
  {
    label: "إدارة الإعلانات",
    icon: Megaphone,
    href: "/dashboard/admin/ads",
    desc: "إنشاء وتعديل الإعلانات",
    gradient: "from-orange-500 to-amber-600",
  },
  {
    label: "إدارة الرسوم",
    icon: Coins,
    href: "/dashboard/admin/fees",
    desc: "تعديل جداول الرسوم",
    gradient: "from-teal-500 to-emerald-600",
  },
];

export default function AdminDashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const res = await authGet("/api/v1/admin/stats");
      if (res.ok) {
        const data = await res.json();
        setStats(data.data || data);
      } else {
        toast.error("فشل تحميل إحصائيات لوحة الإدارة");
      }
    } catch {
      toast.error("حدث خطأ في الاتصال");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <div className="h-16 w-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
        </div>
        <p className="text-sm text-muted-foreground">جاري تحميل لوحة الإدارة...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="animate-slide-in-up">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <LayoutDashboard className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">لوحة الإدارة</h1>
            <p className="text-muted-foreground text-sm mt-0.5">إدارة ومراقبة منصة التداول</p>
          </div>
        </div>
      </div>

      {/* ── Stats Grid ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {STAT_CARDS.map((card, i) => {
          const Icon = card.icon;
          const value = stats?.[card.key] ?? 0;
          return (
            <Link
              key={card.key}
              href={card.href}
              className={`stat-card ${card.statCard} glass-panel-hover group animate-slide-in-up`}
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <div className="flex items-center justify-between mb-3">
                <div className={`h-10 w-10 rounded-xl ${card.bgLight} flex items-center justify-center`}>
                  <Icon className={`h-5 w-5 ${card.textColor}`} />
                </div>
                <ChevronLeft className="h-4 w-4 text-muted-foreground/30 group-hover:text-muted-foreground transition-colors" />
              </div>
              <p className="text-2xl font-bold tabular-nums animate-count-up">
                {typeof value === "number" ? value.toLocaleString("ar-EG") : value}
              </p>
              <p className="text-xs text-muted-foreground mt-1">{card.label}</p>
            </Link>
          );
        })}
      </div>

      {/* ── Quick Actions ── */}
      <div className="animate-slide-in-up" style={{ animationDelay: "400ms" }}>
        <div className="flex items-center gap-3 mb-4">
          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
            <Activity className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-bold">إجراءات سريعة</h2>
            <p className="text-xs text-muted-foreground">الوصول السريع لأدوات الإدارة</p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {QUICK_ACTIONS.map((action, i) => {
            const Icon = action.icon;
            return (
              <Link
                key={action.href}
                href={action.href}
                className="glass-panel rounded-2xl p-5 glass-panel-hover group animate-scale-in"
                style={{ animationDelay: `${(i + 5) * 60}ms` }}
              >
                <div className={`h-11 w-11 rounded-xl bg-gradient-to-br ${action.gradient} flex items-center justify-center shadow-lg mb-3`}>
                  <Icon className="h-5 w-5 text-white" />
                </div>
                <h3 className="font-bold text-sm mb-1 group-hover:text-primary transition-colors">{action.label}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{action.desc}</p>
              </Link>
            );
          })}
        </div>
      </div>

      {/* ── Info Cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-slide-in-up" style={{ animationDelay: "500ms" }}>
        <div className="glass-panel rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-9 w-9 rounded-lg bg-yellow-500/10 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
            </div>
            <h3 className="font-bold">عناصر تحتاج مراجعة</h3>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-xl bg-yellow-500/5 border border-yellow-500/10">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-yellow-500" />
                <span className="text-sm">طلبات تحقق معلقة</span>
              </div>
              <span className="text-sm font-bold text-yellow-500">
                {stats?.pending_kyc ?? 0}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-orange-500/5 border border-orange-500/10">
              <div className="flex items-center gap-2">
                <ArrowRightLeft className="h-4 w-4 text-orange-500" />
                <span className="text-sm">معاملات معلقة</span>
              </div>
              <span className="text-sm font-bold text-orange-500">
                {stats?.pending_transactions ?? 0}
              </span>
            </div>
          </div>
        </div>

        <div className="glass-panel rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-9 w-9 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <BarChart3 className="h-5 w-5 text-emerald-500" />
            </div>
            <h3 className="font-bold">ملخص النظام</h3>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-xl bg-muted/20 border border-border/20">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">إجمالي المستخدمين</span>
              </div>
              <span className="text-sm font-bold">
                {stats?.total_users?.toLocaleString("ar-EG") ?? 0}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-muted/20 border border-border/20">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">إجمالي الأوامر</span>
              </div>
              <span className="text-sm font-bold">
                {stats?.total_orders?.toLocaleString("ar-EG") ?? 0}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-muted/20 border border-border/20">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">إجمالي المعاملات</span>
              </div>
              <span className="text-sm font-bold">
                {stats?.total_transactions?.toLocaleString("ar-EG") ?? 0}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
