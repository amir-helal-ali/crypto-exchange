"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Search, Shield, ShieldOff } from "lucide-react";
import { authGet, authPut } from "@/lib/api";

export default function AdminUsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchUsers = () => {
    const token = localStorage.getItem("token");
    if (!token) return;
    setLoading(true);
    authGet("/api/v1/admin/users")
      .then(r => r.json()).then(d => setUsers(Array.isArray(d) ? d : Array.isArray(d.users) ? d.users : [])).catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleRoleChange = async (userId: number, role: string) => {
    try {
      const res = await authPut(`/api/v1/admin/user/${userId}/role`, { role });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "فشل تحديث الدور"); return; }
      toast.success("تم تحديث دور المستخدم");
      fetchUsers();
    } catch { toast.error("حدث خطأ في الاتصال"); }
  };

  const filtered = users.filter(u => 
    u.username?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">المستخدمين</h1>
        <p className="text-muted-foreground mt-1">إدارة مستخدمي المنصة</p>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input type="text" className="input-field pr-10" placeholder="بحث عن مستخدم..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="glass-panel rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50">
                <th className="text-right p-4 text-muted-foreground font-medium">المستخدم</th>
                <th className="text-right p-4 text-muted-foreground font-medium">البريد</th>
                <th className="text-right p-4 text-muted-foreground font-medium">الدور</th>
                <th className="text-right p-4 text-muted-foreground font-medium">KYC</th>
                <th className="text-right p-4 text-muted-foreground font-medium">تاريخ التسجيل</th>
                <th className="text-right p-4 text-muted-foreground font-medium">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u: any, i: number) => (
                <tr key={i} className="border-b border-border/20 hover:bg-muted/10 transition-all">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">{u.username?.charAt(0)?.toUpperCase()}</div>
                      <span className="font-medium">{u.username}</span>
                    </div>
                  </td>
                  <td className="p-4 text-muted-foreground">{u.email}</td>
                  <td className="p-4">
                    <span className={`text-[11px] px-2 py-0.5 rounded font-medium ${u.role === "ADMIN" ? "bg-purple-500/10 text-purple-500" : "bg-blue-500/10 text-blue-500"}`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="p-4">
                    <span className={`text-[11px] px-2 py-0.5 rounded font-medium ${
                      u.kyc_status === "VERIFIED" ? "bg-emerald-500/10 text-emerald-500" :
                      u.kyc_status === "PENDING" ? "bg-yellow-500/10 text-yellow-500" :
                      u.kyc_status === "REJECTED" ? "bg-red-500/10 text-red-500" :
                      "bg-gray-500/10 text-gray-400"
                    }`}>
                      {u.kyc_status === "VERIFIED" ? "موثق" : u.kyc_status === "PENDING" ? "قيد المراجعة" : u.kyc_status === "REJECTED" ? "مرفوض" : "غير موثق"}
                    </span>
                  </td>
                  <td className="p-4 text-muted-foreground text-xs">{u.created_at ? new Date(u.created_at).toLocaleDateString("ar-EG") : "—"}</td>
                  <td className="p-4">
                    <button
                      onClick={() => handleRoleChange(u.id, u.role === "ADMIN" ? "USER" : "ADMIN")}
                      className={`p-2 rounded-lg transition-all ${u.role === "ADMIN" ? "bg-red-500/10 text-red-500 hover:bg-red-500/20" : "bg-primary/10 text-primary hover:bg-primary/20"}`}
                      title={u.role === "ADMIN" ? "إزالة صلاحية الإدارة" : "منح صلاحية الإدارة"}
                    >
                      {u.role === "ADMIN" ? <ShieldOff className="h-4 w-4" /> : <Shield className="h-4 w-4" />}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!loading && filtered.length === 0 && <div className="text-center py-12 text-muted-foreground">لا يوجد مستخدمين</div>}
      </div>
    </div>
  );
}
