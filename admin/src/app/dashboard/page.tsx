"use client";

import { useEffect, useState } from "react";
import { LayoutDashboard, Users, Wallet, Clock, TrendingUp } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

export default function AdminDashboard() {
  const [stats, setStats] = useState<any>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;

    Promise.all([
      fetch(`${API}/api/admin/stats`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      fetch(`${API}/api/admin/audit-logs`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
    ]).then(([statsData, logsData]) => {
      setStats(statsData);
      setAuditLogs(Array.isArray(logsData) ? logsData : Array.isArray(logsData.logs) ? logsData.logs : []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center py-20"><span className="spinner h-8 w-8" /></div>;

  const statCards = [
    { label: "إجمالي المستخدمين", value: stats?.totalUsers?.toString() || "0", icon: Users, color: "text-blue-500", bg: "bg-blue-500/10" },
    { label: "إجمالي الطلبات", value: stats?.totalOrders?.toString() || "0", icon: TrendingUp, color: "text-purple-500", bg: "bg-purple-500/10" },
    { label: "إجمالي المعاملات", value: stats?.totalTransactions?.toString() || "0", icon: Wallet, color: "text-emerald-500", bg: "bg-emerald-500/10" },
    { label: "سحوبات معلقة", value: stats?.pendingWithdrawals?.toString() || "0", icon: Clock, color: "text-yellow-500", bg: "bg-yellow-500/10" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">الإحصائيات</h1>
        <p className="text-muted-foreground mt-1">نظرة عامة على منصة EgMoney</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map((item, i) => {
          const Icon = item.icon;
          return (
            <div key={i} className="glass-panel rounded-2xl p-5">
              <div className={`inline-flex p-2.5 rounded-xl ${item.bg} mb-3`}><Icon className={`h-5 w-5 ${item.color}`} /></div>
              <p className="text-2xl font-bold">{item.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{item.label}</p>
            </div>
          );
        })}
      </div>

      <div className="glass-panel rounded-2xl p-6">
        <h2 className="font-bold text-lg mb-4">سجل التدقيق</h2>
        <div className="space-y-2">
          {auditLogs.map((log: any, i: number) => (
            <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-muted/20">
              <div>
                <p className="text-sm">{log.action || log.message}</p>
                <p className="text-xs text-muted-foreground">{log.admin_email || log.admin || "admin"}</p>
              </div>
              <span className="text-xs text-muted-foreground">{new Date(log.created_at || log.CreatedAt).toLocaleDateString("ar-EG", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
            </div>
          ))}
          {auditLogs.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">لا توجد سجلات تدقيق</p>}
        </div>
      </div>
    </div>
  );
}
