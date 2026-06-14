"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { User, Mail, Save, Shield, Lock, Eye, EyeOff } from "lucide-react";
import { authPut, authPost } from "@/lib/api";

export default function ProfilePage() {
  const [user, setUser] = useState<any>({ username: "", email: "" });
  const [profileForm, setProfileForm] = useState({ full_name: "", country: "", phone: "" });
  const [passwordForm, setPasswordForm] = useState({ current_password: "", new_password: "", confirm_password: "" });
  const [showPwd, setShowPwd] = useState({ current: false, new: false, confirm: false });
  const [saving, setSaving] = useState(false);
  const [changingPwd, setChangingPwd] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;
    const userData = JSON.parse(localStorage.getItem("user") || "{}");
    setUser(userData);
    setProfileForm({
      full_name: userData.full_name || "",
      country: userData.country || "",
      phone: userData.phone || "",
    });
    setLoading(false);
  }, []);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await authPut("/api/v1/user/profile", profileForm);
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "فشل تحديث الملف"); return; }
      const updatedUser = { ...user, ...profileForm };
      localStorage.setItem("user", JSON.stringify(updatedUser));
      setUser(updatedUser);
      toast.success("تم تحديث الملف الشخصي");
    } catch { toast.error("حدث خطأ في الاتصال"); }
    finally { setSaving(false); }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      toast.error("كلمة المرور الجديدة غير متطابقة");
      return;
    }
    setChangingPwd(true);
    try {
      const res = await authPost("/api/v1/user/change-password", {
        current_password: passwordForm.current_password,
        new_password: passwordForm.new_password,
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "فشل تغيير كلمة المرور"); return; }
      toast.success("تم تغيير كلمة المرور بنجاح");
      setPasswordForm({ current_password: "", new_password: "", confirm_password: "" });
    } catch { toast.error("حدث خطأ في الاتصال"); }
    finally { setChangingPwd(false); }
  };

  if (loading) return <div className="flex items-center justify-center py-20"><span className="spinner h-8 w-8" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">الملف الشخصي</h1>
        <p className="text-muted-foreground mt-1">إدارة معلومات حسابك وإعدادات الأمان</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-panel rounded-2xl p-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="h-14 w-14 rounded-2xl bg-primary/20 flex items-center justify-center text-xl font-bold text-primary">{user.username?.charAt(0)?.toUpperCase() || "U"}</div>
            <div>
              <h2 className="text-lg font-bold">{user.username}</h2>
              <p className="text-sm text-muted-foreground">{user.email}</p>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">{user.role}</span>
            </div>
          </div>

          <form onSubmit={handleUpdateProfile} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1.5"><User className="h-3.5 w-3.5 inline ml-1" />الاسم الكامل</label>
                <input type="text" className="input-field" placeholder="أدخل اسمك الكامل" value={profileForm.full_name} onChange={e => setProfileForm({ ...profileForm, full_name: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5"><Mail className="h-3.5 w-3.5 inline ml-1" />البريد الإلكتروني</label>
                <input type="email" className="input-field" value={user.email} disabled />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">الدولة</label>
                <input type="text" className="input-field" placeholder="مصر" value={profileForm.country} onChange={e => setProfileForm({ ...profileForm, country: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">رقم الهاتف</label>
                <input type="tel" className="input-field" placeholder="+20 100 000 0000" value={profileForm.phone} onChange={e => setProfileForm({ ...profileForm, phone: e.target.value })} />
              </div>
            </div>
            <button type="submit" disabled={saving} className="btn-primary gap-2">
              {saving ? <span className="spinner h-4 w-4" /> : <Save className="h-4 w-4" />}
              {saving ? "جاري الحفظ..." : "حفظ التغييرات"}
            </button>
          </form>
        </div>

        <div className="glass-panel rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2.5 rounded-xl bg-primary/10"><Lock className="h-5 w-5 text-primary" /></div>
            <div>
              <h2 className="text-lg font-bold">الأمان</h2>
              <p className="text-sm text-muted-foreground">تغيير كلمة المرور</p>
            </div>
          </div>

          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">كلمة المرور الحالية</label>
              <div className="relative">
                <input type={showPwd.current ? "text" : "password"} className="input-field pl-10" placeholder="••••••••" value={passwordForm.current_password} onChange={e => setPasswordForm({ ...passwordForm, current_password: e.target.value })} required />
                <button type="button" onClick={() => setShowPwd({ ...showPwd, current: !showPwd.current })} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">{showPwd.current ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">كلمة المرور الجديدة</label>
                <div className="relative">
                  <input type={showPwd.new ? "text" : "password"} className="input-field pl-10" placeholder="••••••••" value={passwordForm.new_password} onChange={e => setPasswordForm({ ...passwordForm, new_password: e.target.value })} required minLength={6} />
                  <button type="button" onClick={() => setShowPwd({ ...showPwd, new: !showPwd.new })} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">{showPwd.new ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">تأكيد كلمة المرور</label>
                <div className="relative">
                  <input type={showPwd.confirm ? "text" : "password"} className="input-field pl-10" placeholder="••••••••" value={passwordForm.confirm_password} onChange={e => setPasswordForm({ ...passwordForm, confirm_password: e.target.value })} required minLength={6} />
                  <button type="button" onClick={() => setShowPwd({ ...showPwd, confirm: !showPwd.confirm })} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">{showPwd.confirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
                </div>
              </div>
            </div>
            <button type="submit" disabled={changingPwd} className="btn-primary gap-2">
              {changingPwd ? <span className="spinner h-4 w-4" /> : <Shield className="h-4 w-4" />}
              {changingPwd ? "جاري التغيير..." : "تغيير كلمة المرور"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
