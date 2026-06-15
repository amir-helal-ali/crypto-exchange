"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import {
  Search,
  Shield,
  ShieldOff,
  Users,
  Filter,
  UserCheck,
  UserX,
  Mail,
  Calendar,
  MailCheck,
  MailX,
} from "lucide-react";
import { authGet, authPut } from "@/lib/api";

export default function AdminUsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState<string>("ALL");
  const [kycFilter, setKycFilter] = useState<string>("ALL");

  const fetchUsers = () => {
    const token = localStorage.getItem("token");
    if (!token) return;
    setLoading(true);
    authGet("/api/v1/admin/users")
      .then((r) => r.json())
      .then((d) => {
        // API returns { success: true, data: [...], total: N }
        const usersList = d?.data || d;
        setUsers(Array.isArray(usersList) ? usersList : []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleRoleChange = async (userId: number, role: string) => {
    try {
      const res = await authPut(`/api/v1/admin/user/${userId}/role`, { role });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "فشل تحديث الدور");
        return;
      }
      toast.success("تم تحديث دور المستخدم");
      fetchUsers();
    } catch {
      toast.error("حدث خطأ في الاتصال");
    }
  };

  const handleVerifyEmail = async (userId: number) => {
    try {
      const res = await authPut(`/api/v1/admin/user/${userId}/verify-email`);
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "فشل توثيق البريد");
        return;
      }
      toast.success("تم توثيق البريد الإلكتروني بنجاح");
      fetchUsers();
    } catch {
      toast.error("حدث خطأ في الاتصال");
    }
  };

  const filtered = users.filter((u) => {
    const matchesSearch =
      u.username?.toLowerCase().includes(search.toLowerCase()) ||
      u.email?.toLowerCase().includes(search.toLowerCase());
    const matchesRole = roleFilter === "ALL" || u.role === roleFilter;
    const matchesKyc = kycFilter === "ALL" || u.kyc_status === kycFilter;
    return matchesSearch && matchesRole && matchesKyc;
  });

  const totalUsers = users.length;
  const adminCount = users.filter((u) => u.role === "ADMIN").length;
  const verifiedCount = users.filter((u) => u.kyc_status === "VERIFIED").length;
  const emailVerifiedCount = users.filter((u) => u.email_verified).length;

  const getKycBadge = (status: string) => {
    switch (status) {
      case "VERIFIED":
        return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
      case "PENDING":
        return "bg-yellow-500/10 text-yellow-400 border-yellow-500/20";
      case "REJECTED":
        return "bg-red-500/10 text-red-400 border-red-500/20";
      default:
        return "bg-muted/20 text-muted-foreground border-border/30";
    }
  };

  const getKycLabel = (status: string) => {
    switch (status) {
      case "VERIFIED":
        return "موثق";
      case "PENDING":
        return "قيد المراجعة";
      case "REJECTED":
        return "مرفوض";
      default:
        return "غير موثق";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="flex flex-col items-center gap-4">
          <span className="spinner h-8 w-8" />
          <p className="text-sm text-muted-foreground">جاري تحميل المستخدمين...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ─── Header ─── */}
      <div className="animate-slide-in-down">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
            <Users className="h-5 w-5 text-blue-500" />
          </div>
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold">المستخدمين</h1>
            <p className="text-sm text-muted-foreground">
              إدارة مستخدمي المنصة والتحكم في صلاحياتهم
            </p>
          </div>
        </div>
      </div>

      {/* ─── Stats Row ─── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 animate-slide-in-up delay-100">
        <div className="glass-panel rounded-xl p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-500/10">
            <Users className="h-4 w-4 text-blue-500" />
          </div>
          <div>
            <p className="text-lg font-bold">{totalUsers}</p>
            <p className="text-[11px] text-muted-foreground">إجمالي المستخدمين</p>
          </div>
        </div>
        <div className="glass-panel rounded-xl p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-purple-500/10">
            <Shield className="h-4 w-4 text-purple-500" />
          </div>
          <div>
            <p className="text-lg font-bold">{adminCount}</p>
            <p className="text-[11px] text-muted-foreground">مديرين</p>
          </div>
        </div>
        <div className="glass-panel rounded-xl p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-emerald-500/10">
            <MailCheck className="h-4 w-4 text-emerald-500" />
          </div>
          <div>
            <p className="text-lg font-bold">{emailVerifiedCount}</p>
            <p className="text-[11px] text-muted-foreground">بريد موثق</p>
          </div>
        </div>
        <div className="glass-panel rounded-xl p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-teal-500/10">
            <UserCheck className="h-4 w-4 text-teal-500" />
          </div>
          <div>
            <p className="text-lg font-bold">{verifiedCount}</p>
            <p className="text-[11px] text-muted-foreground">KYC موثق</p>
          </div>
        </div>
      </div>

      {/* ─── Search & Filter Bar ─── */}
      <div className="glass-panel rounded-2xl p-4 animate-slide-in-up delay-200">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
            <input
              type="text"
              className="input-field pr-10"
              placeholder="بحث باسم المستخدم أو البريد الإلكتروني..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Role Filter */}
          <div className="relative">
            <Filter className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50 pointer-events-none" />
            <select
              className="input-field pr-10 appearance-none min-w-[140px]"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
            >
              <option value="ALL">جميع الأدوار</option>
              <option value="ADMIN">مدير</option>
              <option value="USER">مستخدم</option>
            </select>
          </div>

          {/* KYC Filter */}
          <div className="relative">
            <Shield className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50 pointer-events-none" />
            <select
              className="input-field pr-10 appearance-none min-w-[140px]"
              value={kycFilter}
              onChange={(e) => setKycFilter(e.target.value)}
            >
              <option value="ALL">جميع حالات KYC</option>
              <option value="VERIFIED">موثق</option>
              <option value="PENDING">قيد المراجعة</option>
              <option value="REJECTED">مرفوض</option>
              <option value="NONE">غير موثق</option>
            </select>
          </div>
        </div>
      </div>

      {/* ─── Users Table ─── */}
      <div className="glass-panel rounded-2xl overflow-hidden animate-slide-in-up delay-300">
        {filtered.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/20">
                  <th className="text-right p-4 text-muted-foreground font-medium text-xs">
                    المستخدم
                  </th>
                  <th className="text-right p-4 text-muted-foreground font-medium text-xs hidden md:table-cell">
                    البريد الإلكتروني
                  </th>
                  <th className="text-right p-4 text-muted-foreground font-medium text-xs">
                    الدور
                  </th>
                  <th className="text-right p-4 text-muted-foreground font-medium text-xs">
                    البريد
                  </th>
                  <th className="text-right p-4 text-muted-foreground font-medium text-xs">
                    KYC
                  </th>
                  <th className="text-right p-4 text-muted-foreground font-medium text-xs hidden lg:table-cell">
                    تاريخ التسجيل
                  </th>
                  <th className="text-right p-4 text-muted-foreground font-medium text-xs">
                    إجراءات
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u: any, i: number) => (
                  <tr
                    key={i}
                    className="border-b border-border/10 hover:bg-muted/10 transition-colors duration-150"
                  >
                    {/* User */}
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center text-sm font-bold text-primary border border-primary/20">
                          {u.username?.charAt(0)?.toUpperCase() || "U"}
                        </div>
                        <div>
                          <p className="font-medium text-sm">{u.username}</p>
                          <p className="text-xs text-muted-foreground md:hidden">
                            {u.email}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Email */}
                    <td className="p-4 text-muted-foreground text-xs hidden md:table-cell">
                      <div className="flex items-center gap-1.5">
                        <Mail className="h-3 w-3 text-muted-foreground/40" />
                        {u.email}
                      </div>
                    </td>

                    {/* Role */}
                    <td className="p-4">
                      <span
                        className={`inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg font-medium border ${
                          u.role === "ADMIN"
                            ? "bg-purple-500/10 text-purple-400 border-purple-500/20"
                            : "bg-blue-500/10 text-blue-400 border-blue-500/20"
                        }`}
                      >
                        {u.role === "ADMIN" ? (
                          <Shield className="h-3 w-3" />
                        ) : (
                          <Users className="h-3 w-3" />
                        )}
                        {u.role === "ADMIN" ? "مدير" : "مستخدم"}
                      </span>
                    </td>

                    {/* Email Verified */}
                    <td className="p-4">
                      {u.email_verified ? (
                        <span className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg font-medium border bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                          <MailCheck className="h-3 w-3" />
                          موثق
                        </span>
                      ) : (
                        <button
                          onClick={() => handleVerifyEmail(u.id)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium border bg-yellow-500/10 text-yellow-400 border-yellow-500/20 hover:bg-yellow-500/20 transition-all duration-200"
                          title="توثيق البريد الإلكتروني"
                        >
                          <MailX className="h-3 w-3" />
                          توثيق
                        </button>
                      )}
                    </td>

                    {/* KYC */}
                    <td className="p-4">
                      <span
                        className={`inline-flex items-center text-[11px] px-2.5 py-1 rounded-lg font-medium border ${getKycBadge(
                          u.kyc_status
                        )}`}
                      >
                        {getKycLabel(u.kyc_status)}
                      </span>
                    </td>

                    {/* Date */}
                    <td className="p-4 text-muted-foreground text-xs hidden lg:table-cell">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="h-3 w-3 text-muted-foreground/40" />
                        {u.created_at
                          ? new Date(u.created_at).toLocaleDateString("ar-EG", {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            })
                          : "—"}
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="p-4">
                      <button
                        onClick={() =>
                          handleRoleChange(
                            u.id,
                            u.role === "ADMIN" ? "USER" : "ADMIN"
                          )
                        }
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                          u.role === "ADMIN"
                            ? "bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20"
                            : "bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20"
                        }`}
                        title={
                          u.role === "ADMIN"
                            ? "إزالة صلاحية الإدارة"
                            : "منح صلاحية الإدارة"
                        }
                      >
                        {u.role === "ADMIN" ? (
                          <>
                            <ShieldOff className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">إزالة الصلاحية</span>
                          </>
                        ) : (
                          <>
                            <Shield className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">منح الصلاحية</span>
                          </>
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          /* Empty State */
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-20 h-20 rounded-2xl bg-muted/20 flex items-center justify-center mb-4">
              <UserX className="h-10 w-10 text-muted-foreground/30" />
            </div>
            <p className="text-sm text-muted-foreground font-medium">
              {search || roleFilter !== "ALL" || kycFilter !== "ALL"
                ? "لا توجد نتائج مطابقة للبحث"
                : "لا يوجد مستخدمين"}
            </p>
            <p className="text-xs text-muted-foreground/50 mt-1">
              {search || roleFilter !== "ALL" || kycFilter !== "ALL"
                ? "جرب تغيير معايير البحث أو الفلتر"
                : "سيظهر المستخدمون هنا عند تسجيلهم في المنصة"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
