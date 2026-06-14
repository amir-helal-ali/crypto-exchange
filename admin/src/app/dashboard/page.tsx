"use client";

import { useEffect, useState, useRef } from "react";
import {
  Users,
  Wallet,
  Clock,
  TrendingUp,
  ArrowDownToLine,
  Shield,
  ScrollText,
  Activity,
  Zap,
  LayoutDashboard,
} from "lucide-react";
import { authGet } from "@/lib/api";

// ─── Count-Up Hook ───
function useCountUp(target: number, duration = 1200) {
  const [count, setCount] = useState(0);
  const started = useRef(false);

  useEffect(() => {
    if (started.current || target === 0) {
      if (target === 0) setCount(0);
      return;
    }
    started.current = true;
    const startTime = performance.now();
    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      setCount(Math.round(eased * target));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [target, duration]);

  return count;
}

// ─── Stat Card Component ───
function StatCard({
  label,
  value,
  icon: Icon,
  colorClass,
  statCardClass,
  delay,
}: {
  label: string;
  value: number;
  icon: any;
  colorClass: string;
  statCardClass: string;
  delay: string;
}) {
  const animatedValue = useCountUp(value);
  return (
    <div
      className={`stat-card ${statCardClass} animate-slide-in-up ${delay}`}
    >
      <div className="relative z-10">
        <div
          className={`inline-flex p-2.5 rounded-xl mb-3 ${colorClass}`}
        >
          <Icon className="h-5 w-5" />
        </div>
        <p className="text-3xl font-bold tabular-nums animate-count-up">
          {animatedValue.toLocaleString("ar-EG")}
        </p>
        <p className="text-xs text-muted-foreground mt-1.5 font-medium">
          {label}
        </p>
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<any>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;

    Promise.all([
      authGet("/api/v1/admin/stats").then((r) => r.json()),
      authGet("/api/v1/admin/audit-logs").then((r) => r.json()),
    ])
      .then(([statsData, logsData]) => {
        setStats(statsData);
        setAuditLogs(
          Array.isArray(logsData)
            ? logsData
            : Array.isArray(logsData.logs)
            ? logsData.logs
            : []
        );
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center glow-emerald animate-pulse">
            <Zap className="h-6 w-6 text-white" />
          </div>
          <span className="spinner h-6 w-6" />
          <p className="text-sm text-muted-foreground">جاري تحميل البيانات...</p>
        </div>
      </div>
    );
  }

  const statCards = [
    {
      label: "إجمالي المستخدمين",
      value: stats?.totalUsers || 0,
      icon: Users,
      colorClass: "bg-blue-500/10 text-blue-500",
      statCardClass: "stat-card-blue",
    },
    {
      label: "إجمالي الطلبات",
      value: stats?.totalOrders || 0,
      icon: TrendingUp,
      colorClass: "bg-purple-500/10 text-purple-500",
      statCardClass: "stat-card-purple",
    },
    {
      label: "إجمالي المعاملات",
      value: stats?.totalTransactions || 0,
      icon: Wallet,
      colorClass: "bg-emerald-500/10 text-emerald-500",
      statCardClass: "stat-card-emerald",
    },
    {
      label: "إيداعات معلقة",
      value: stats?.pendingDeposits || 0,
      icon: ArrowDownToLine,
      colorClass: "bg-teal-500/10 text-teal-500",
      statCardClass: "stat-card-teal",
    },
    {
      label: "سحوبات معلقة",
      value: stats?.pendingWithdrawals || 0,
      icon: Clock,
      colorClass: "bg-yellow-500/10 text-yellow-500",
      statCardClass: "stat-card-yellow",
    },
    {
      label: "تحقق معلق KYC",
      value: stats?.pendingKYC || 0,
      icon: Shield,
      colorClass: "bg-orange-500/10 text-orange-500",
      statCardClass: "stat-card-orange",
    },
  ];

  const delays = ["delay-100", "delay-200", "delay-300", "delay-400", "delay-500", "delay-600"];

  const getActionBadge = (action: string) => {
    const lower = (action || "").toLowerCase();
    if (lower.includes("login") || lower.includes("دخول"))
      return "bg-blue-500/10 text-blue-400 border-blue-500/20";
    if (lower.includes("approve") || lower.includes("موافق"))
      return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
    if (lower.includes("reject") || lower.includes("رفض"))
      return "bg-red-500/10 text-red-400 border-red-500/20";
    if (lower.includes("update") || lower.includes("تحديث"))
      return "bg-purple-500/10 text-purple-400 border-purple-500/20";
    if (lower.includes("delete") || lower.includes("حذف"))
      return "bg-red-500/10 text-red-400 border-red-500/20";
    if (lower.includes("create") || lower.includes("إنش"))
      return "bg-teal-500/10 text-teal-400 border-teal-500/20";
    return "bg-muted/30 text-muted-foreground border-border/30";
  };

  return (
    <div className="space-y-8">
      {/* ─── Welcome Header ─── */}
      <div className="animate-slide-in-down">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <LayoutDashboard className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold">لوحة الإدارة</h1>
            <p className="text-sm text-muted-foreground">
              نظرة عامة على منصة EgMoney والنشاط الأخير
            </p>
          </div>
        </div>
      </div>

      {/* ─── Stat Cards Grid ─── */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        {statCards.map((item, i) => (
          <StatCard
            key={i}
            label={item.label}
            value={item.value}
            icon={item.icon}
            colorClass={item.colorClass}
            statCardClass={item.statCardClass}
            delay={delays[i]}
          />
        ))}
      </div>

      {/* ─── Audit Logs Section ─── */}
      <div className="glass-panel rounded-2xl overflow-hidden animate-slide-in-up delay-500">
        {/* Header */}
        <div className="p-6 border-b border-border/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-purple-500/10 flex items-center justify-center">
                <ScrollText className="h-4.5 w-4.5 text-purple-500" />
              </div>
              <div>
                <h2 className="text-lg font-bold">سجل التدقيق</h2>
                <p className="text-xs text-muted-foreground">آخر العمليات التي قام بها المديرون</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Activity className="h-3.5 w-3.5 text-emerald-500" />
              <span className="status-dot-online" />
              <span>مباشر</span>
            </div>
          </div>
        </div>

        {/* Table */}
        {auditLogs.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/20">
                  <th className="text-right p-4 text-muted-foreground font-medium text-xs">
                    الإجراء
                  </th>
                  <th className="text-right p-4 text-muted-foreground font-medium text-xs">
                    المدير
                  </th>
                  <th className="text-right p-4 text-muted-foreground font-medium text-xs">
                    التاريخ
                  </th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.map((log: any, i: number) => (
                  <tr
                    key={i}
                    className="border-b border-border/10 hover:bg-muted/10 transition-colors duration-150"
                  >
                    <td className="p-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium border ${getActionBadge(
                          log.action || log.message || ""
                        )}`}
                      >
                        {log.action || log.message}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">
                          {(log.admin_email || log.admin || "A")
                            .charAt(0)
                            .toUpperCase()}
                        </div>
                        <span className="text-muted-foreground text-xs">
                          {log.admin_email || log.admin || "admin"}
                        </span>
                      </div>
                    </td>
                    <td className="p-4 text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(
                        log.created_at || log.CreatedAt
                      ).toLocaleDateString("ar-EG", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-2xl bg-muted/20 flex items-center justify-center mb-4">
              <ScrollText className="h-8 w-8 text-muted-foreground/30" />
            </div>
            <p className="text-sm text-muted-foreground font-medium">لا توجد سجلات تدقيق</p>
            <p className="text-xs text-muted-foreground/50 mt-1">
              ستظهر هنا سجلات العمليات التي يقوم بها المديرون
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
