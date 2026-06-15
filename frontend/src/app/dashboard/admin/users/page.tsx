"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import {
  Users,
  Search,
  Loader2,
  Mail,
  Shield,
  UserCheck,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  Inbox,
  CalendarDays,
  Filter,
  CheckCircle2,
  XCircle,
  X,
} from "lucide-react";
import { authGet, authPut } from "@/lib/api";

interface UserItem {
  id: number;
  username: string;
  email: string;
  role: string;
  email_verified: boolean;
  kyc_status: string;
  created_at: string;
}

const ROLE_OPTIONS = [
  { value: "USER", label: "مستخدم", color: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  { value: "ADMIN", label: "مدير", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
];

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [updatingRole, setUpdatingRole] = useState<number | null>(null);
  const [verifyingEmail, setVerifyingEmail] = useState<number | null>(null);
  const [roleModal, setRoleModal] = useState<{ userId: number; currentRole: string } | null>(null);
  const limit = 20;
  const totalPages = Math.ceil(total / limit);

  useEffect(() => {
    fetchUsers();
  }, [page, roleFilter]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (roleFilter) params.set("role", roleFilter);
      if (search) params.set("search", search);
      params.set("page", page.toString());
      params.set("limit", limit.toString());
      const res = await authGet(`/api/v1/admin/users?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setUsers(Array.isArray(data.data) ? data.data : []);
        setTotal(data.total || 0);
      } else {
        toast.error("فشل تحميل المستخدمين");
      }
    } catch {
      toast.error("حدث خطأ في الاتصال");
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setPage(1);
    fetchUsers();
  };

  const handleUpdateRole = async (userId: number, newRole: string) => {
    setUpdatingRole(userId);
    try {
      const res = await authPut(`/api/v1/admin/user/${userId}/role`, { role: newRole });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "فشل تحديث الدور");
        return;
      }
      toast.success(data.message || "تم تحديث الدور بنجاح");
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
      setRoleModal(null);
    } catch {
      toast.error("حدث خطأ في الاتصال");
    } finally {
      setUpdatingRole(null);
    }
  };

  const handleVerifyEmail = async (userId: number) => {
    setVerifyingEmail(userId);
    try {
      const res = await authPut(`/api/v1/admin/user/${userId}/verify-email`);
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "فشل تأكيد البريد");
        return;
      }
      toast.success(data.message || "تم تأكيد البريد الإلكتروني بنجاح");
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, email_verified: true } : u));
    } catch {
      toast.error("حدث خطأ في الاتصال");
    } finally {
      setVerifyingEmail(null);
    }
  };

  const getRoleBadge = (role: string) => {
    const roleOption = ROLE_OPTIONS.find(r => r.value === role);
    if (!roleOption) return { label: role, color: "bg-gray-500/10 text-gray-400 border-gray-500/20" };
    return roleOption;
  };

  const getKycBadge = (status: string) => {
    switch (status) {
      case "APPROVED":
        return { label: "مؤكد", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" };
      case "PENDING":
        return { label: "معلق", color: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" };
      case "REJECTED":
        return { label: "مرفوض", color: "bg-red-500/10 text-red-400 border-red-500/20" };
      default:
        return { label: "غير مقدم", color: "bg-gray-500/10 text-gray-400 border-gray-500/20" };
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="animate-slide-in-up">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <Users className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">إدارة المستخدمين</h1>
            <p className="text-muted-foreground text-sm mt-0.5">عرض وإدارة حسابات المستخدمين والأدوار</p>
          </div>
        </div>
      </div>

      {/* ── Search & Filter ── */}
      <div className="glass-panel rounded-2xl p-4 animate-slide-in-up" style={{ animationDelay: "80ms" }}>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              className="input-field pr-10"
              placeholder="بحث بالاسم أو البريد الإلكتروني..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />
          </div>
          <div className="flex gap-2">
            <select
              className="input-field w-auto min-w-[140px]"
              value={roleFilter}
              onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
            >
              <option value="">جميع الأدوار</option>
              <option value="USER">مستخدم</option>
              <option value="ADMIN">مدير</option>
            </select>
            <button onClick={handleSearch} className="btn-primary gap-2">
              <Search className="h-4 w-4" />
              بحث
            </button>
          </div>
        </div>
      </div>

      {/* ── Users Table ── */}
      <div className="glass-panel rounded-2xl overflow-hidden animate-slide-in-up" style={{ animationDelay: "160ms" }}>
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="h-16 w-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
            </div>
            <p className="text-sm text-muted-foreground">جاري تحميل المستخدمين...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/40 bg-muted/20">
                  <th className="text-right p-4 text-muted-foreground font-medium">
                    <div className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5" /> المستخدم</div>
                  </th>
                  <th className="text-right p-4 text-muted-foreground font-medium">
                    <div className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" /> البريد الإلكتروني</div>
                  </th>
                  <th className="text-right p-4 text-muted-foreground font-medium">
                    <div className="flex items-center gap-1.5"><Shield className="h-3.5 w-3.5" /> الدور</div>
                  </th>
                  <th className="text-right p-4 text-muted-foreground font-medium">
                    <div className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" /> التحقق</div>
                  </th>
                  <th className="text-right p-4 text-muted-foreground font-medium">KYC</th>
                  <th className="text-right p-4 text-muted-foreground font-medium">
                    <div className="flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" /> التاريخ</div>
                  </th>
                  <th className="text-right p-4 text-muted-foreground font-medium">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => {
                  const roleBadge = getRoleBadge(user.role);
                  const kycBadge = getKycBadge(user.kyc_status);
                  return (
                    <tr key={user.id} className="border-b border-border/15 hover:bg-emerald-500/[0.03] transition-all duration-200">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shrink-0">
                            <span className="text-xs font-bold text-white">{user.username?.charAt(0)?.toUpperCase() || "U"}</span>
                          </div>
                          <span className="font-semibold">{user.username}</span>
                        </div>
                      </td>
                      <td className="p-4 text-muted-foreground" dir="ltr">
                        {user.email}
                      </td>
                      <td className="p-4">
                        <span className={`inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full font-semibold border ${roleBadge.color}`}>
                          {roleBadge.label}
                        </span>
                      </td>
                      <td className="p-4">
                        {user.email_verified ? (
                          <span className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <CheckCircle2 className="h-3 w-3" /> مؤكد
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full font-semibold bg-red-500/10 text-red-400 border border-red-500/20">
                            <XCircle className="h-3 w-3" /> غير مؤكد
                          </span>
                        )}
                      </td>
                      <td className="p-4">
                        <span className={`inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full font-semibold border ${kycBadge.color}`}>
                          {kycBadge.label}
                        </span>
                      </td>
                      <td className="p-4 text-muted-foreground text-xs">
                        {new Date(user.created_at).toLocaleDateString("ar-EG", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setRoleModal({ userId: user.id, currentRole: user.role })}
                            disabled={updatingRole === user.id}
                            className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 px-2.5 py-1.5 rounded-lg transition-all duration-200 border border-transparent hover:border-blue-500/20"
                          >
                            {updatingRole === user.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Shield className="h-3 w-3" />
                            )}
                            تغيير الدور
                          </button>
                          {!user.email_verified && (
                            <button
                              onClick={() => handleVerifyEmail(user.id)}
                              disabled={verifyingEmail === user.id}
                              className="inline-flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 px-2.5 py-1.5 rounded-lg transition-all duration-200 border border-transparent hover:border-emerald-500/20"
                            >
                              {verifyingEmail === user.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <UserCheck className="h-3 w-3" />
                              )}
                              تأكيد البريد
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Empty State */}
        {!loading && users.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-in">
            <div className="h-20 w-20 rounded-2xl bg-muted/20 flex items-center justify-center mb-5">
              <Inbox className="h-10 w-10 text-muted-foreground/30" />
            </div>
            <h3 className="text-lg font-bold mb-2">لا توجد نتائج</h3>
            <p className="text-sm text-muted-foreground max-w-xs">لم يتم العثور على مستخدمين مطابقين لمعايير البحث</p>
          </div>
        )}
      </div>

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 animate-slide-in-up" style={{ animationDelay: "240ms" }}>
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="btn-ghost text-sm gap-1 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronRight className="h-4 w-4" />
            السابق
          </button>
          <div className="flex items-center gap-1 mx-2">
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum: number;
              if (totalPages <= 5) pageNum = i + 1;
              else if (page <= 3) pageNum = i + 1;
              else if (page >= totalPages - 2) pageNum = totalPages - 4 + i;
              else pageNum = page - 2 + i;
              return (
                <button
                  key={pageNum}
                  onClick={() => setPage(pageNum)}
                  className={`w-9 h-9 rounded-xl text-sm font-medium transition-all duration-200 ${
                    pageNum === page
                      ? "bg-primary/15 text-primary shadow-sm shadow-primary/10"
                      : "text-muted-foreground hover:bg-muted/30 hover:text-foreground"
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}
          </div>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="btn-ghost text-sm gap-1 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            التالي
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-xs text-muted-foreground pr-3 border-r border-border/30 mr-2">
            صفحة <span className="font-semibold text-foreground">{page}</span> من {totalPages}
          </span>
        </div>
      )}

      {/* ── Role Change Modal ── */}
      {roleModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-fade-in" style={{ backdropFilter: "blur(4px)" }}>
          <div className="glass-panel-strong rounded-2xl p-6 w-full max-w-sm animate-scale-in">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <Shield className="h-5 w-5 text-blue-500" />
                </div>
                <h3 className="font-bold">تغيير دور المستخدم</h3>
              </div>
              <button onClick={() => setRoleModal(null)} className="btn-ghost p-1.5 rounded-lg">
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-sm text-muted-foreground mb-4">
              الدور الحالي: <span className="font-semibold text-foreground">{getRoleBadge(roleModal.currentRole).label}</span>
            </p>

            <div className="space-y-2 mb-6">
              {ROLE_OPTIONS.map((role) => (
                <button
                  key={role.value}
                  onClick={() => handleUpdateRole(roleModal.userId, role.value)}
                  disabled={updatingRole === roleModal.userId}
                  className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all duration-200 hover:bg-muted/20 ${
                    roleModal.currentRole === role.value
                      ? "border-primary/30 bg-primary/5"
                      : "border-border/30"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className={`inline-flex items-center text-[11px] px-2.5 py-1 rounded-full font-semibold border ${role.color}`}>
                      {role.label}
                    </span>
                    {roleModal.currentRole === role.value && (
                      <span className="text-[10px] text-muted-foreground">(الحالي)</span>
                    )}
                  </div>
                  {updatingRole === roleModal.userId ? (
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  ) : (
                    <ChevronLeft className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>
              ))}
            </div>

            <button onClick={() => setRoleModal(null)} className="btn-ghost w-full">
              إلغاء
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
