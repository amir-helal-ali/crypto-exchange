"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import {
  User,
  Mail,
  Save,
  Shield,
  Lock,
  Eye,
  EyeOff,
  MapPin,
  Phone,
  Loader2,
  BadgeCheck,
  KeyRound,
  UserCircle,
} from "lucide-react";
import { authGet, authPut, authPost } from "@/lib/api";

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
    fetchUserInfo();
  }, []);

  const fetchUserInfo = async () => {
    try {
      const res = await authGet("/api/v1/user/info");
      if (res.ok) {
        const data = await res.json();
        const userData = data.data || data;
        setUser(userData);
        setProfileForm({
          full_name: userData.full_name || "",
          country: userData.country || "",
          phone: userData.phone || "",
        });
        // Update localStorage for other components
        localStorage.setItem("user", JSON.stringify(userData));
      } else {
        // Fallback to localStorage if API fails
        const userData = JSON.parse(localStorage.getItem("user") || "{}");
        setUser(userData);
        setProfileForm({
          full_name: userData.full_name || "",
          country: userData.country || "",
          phone: userData.phone || "",
        });
      }
    } catch {
      // Fallback to localStorage
      const userData = JSON.parse(localStorage.getItem("user") || "{}");
      setUser(userData);
      setProfileForm({
        full_name: userData.full_name || "",
        country: userData.country || "",
        phone: userData.phone || "",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await authPut("/api/v1/user/profile", profileForm);
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "فشل تحديث الملف");
        return;
      }
      const updatedUser = { ...user, ...profileForm };
      localStorage.setItem("user", JSON.stringify(updatedUser));
      setUser(updatedUser);
      toast.success("تم تحديث الملف الشخصي");
    } catch {
      toast.error("حدث خطأ في الاتصال");
    } finally {
      setSaving(false);
    }
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
      if (!res.ok) {
        toast.error(data.error || "فشل تغيير كلمة المرور");
        return;
      }
      toast.success("تم تغيير كلمة المرور بنجاح");
      setPasswordForm({ current_password: "", new_password: "", confirm_password: "" });
    } catch {
      toast.error("حدث خطأ في الاتصال");
    } finally {
      setChangingPwd(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="animate-slide-in-up">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <UserCircle className="h-5 w-5 text-white" />
          </div>
          الملف الشخصي
        </h1>
        <p className="text-muted-foreground mt-2 text-sm">إدارة معلومات حسابك وإعدادات الأمان</p>
      </div>

      {/* ── Two-Column Layout ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LEFT: Profile Info Card */}
        <div className="glass-panel rounded-2xl overflow-hidden animate-slide-in-up" style={{ animationDelay: "100ms", animationFillMode: "both" }}>
          {/* Profile Header with gradient */}
          <div className="relative h-28 bg-gradient-to-l from-emerald-600 via-teal-600 to-emerald-700 overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_30%,rgba(255,255,255,0.12),transparent_60%)]" />
            <div className="absolute inset-0 bg-dots-pattern opacity-20" />
          </div>

          {/* Avatar that overlaps the header */}
          <div className="relative px-6 -mt-12">
            <div className="inline-block">
              <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center text-3xl font-bold text-white ring-4 ring-card shadow-xl shadow-emerald-500/20">
                {user.username?.charAt(0)?.toUpperCase() || "U"}
              </div>
            </div>
          </div>

          {/* User Info */}
          <div className="px-6 pt-3 pb-2">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold">{user.full_name || user.username}</h2>
              {user.role && (
                <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium flex items-center gap-1">
                  <BadgeCheck className="h-3 w-3" />
                  {user.role === "admin" ? "مدير" : user.role === "super_admin" ? "مدير عام" : "مستخدم"}
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5" />
              {user.email}
            </p>
          </div>

          {/* Edit Form */}
          <form onSubmit={handleUpdateProfile} className="p-6 pt-4 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2 text-muted-foreground flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5" />
                  الاسم الكامل
                </label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="أدخل اسمك الكامل"
                  value={profileForm.full_name}
                  onChange={(e) => setProfileForm({ ...profileForm, full_name: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 text-muted-foreground flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5" />
                  البريد الإلكتروني
                </label>
                <input
                  type="email"
                  className="input-field opacity-60 cursor-not-allowed"
                  value={user.email}
                  disabled
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2 text-muted-foreground flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5" />
                  الدولة
                </label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="مصر"
                  value={profileForm.country}
                  onChange={(e) => setProfileForm({ ...profileForm, country: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 text-muted-foreground flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5" />
                  رقم الهاتف
                </label>
                <input
                  type="tel"
                  className="input-field"
                  placeholder="+20 100 000 0000"
                  value={profileForm.phone}
                  onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                />
              </div>
            </div>
            <div className="pt-2">
              <button type="submit" disabled={saving} className="btn-primary gap-2 min-w-[140px]">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {saving ? "جاري الحفظ..." : "حفظ التغييرات"}
              </button>
            </div>
          </form>
        </div>

        {/* RIGHT: Password Change Card */}
        <div className="glass-panel rounded-2xl p-6 animate-slide-in-up" style={{ animationDelay: "200ms", animationFillMode: "both" }}>
          {/* Lock Icon Header */}
          <div className="flex items-center gap-4 mb-6">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border border-primary/10">
              <KeyRound className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold">الأمان</h2>
              <p className="text-sm text-muted-foreground">تغيير كلمة المرور</p>
            </div>
          </div>

          {/* Security level indicator */}
          <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/10 mb-6 flex items-center gap-3">
            <Shield className="h-5 w-5 text-emerald-500 shrink-0" />
            <p className="text-sm text-muted-foreground">
              نوصي باستخدام كلمة مرور قوية تحتوي على أحرف كبيرة وصغيرة وأرقام ورموز.
            </p>
          </div>

          <form onSubmit={handleChangePassword} className="space-y-5">
            {/* Current Password */}
            <div>
              <label className="block text-sm font-medium mb-2 text-muted-foreground">كلمة المرور الحالية</label>
              <div className="relative">
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <Lock className="h-4 w-4 text-muted-foreground" />
                </div>
                <input
                  type={showPwd.current ? "text" : "password"}
                  className="input-field pr-10 pl-10"
                  placeholder="••••••••"
                  value={passwordForm.current_password}
                  onChange={(e) => setPasswordForm({ ...passwordForm, current_password: e.target.value })}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPwd({ ...showPwd, current: !showPwd.current })}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPwd.current ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* New Password */}
            <div>
              <label className="block text-sm font-medium mb-2 text-muted-foreground">كلمة المرور الجديدة</label>
              <div className="relative">
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <Lock className="h-4 w-4 text-muted-foreground" />
                </div>
                <input
                  type={showPwd.new ? "text" : "password"}
                  className="input-field pr-10 pl-10"
                  placeholder="••••••••"
                  value={passwordForm.new_password}
                  onChange={(e) => setPasswordForm({ ...passwordForm, new_password: e.target.value })}
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPwd({ ...showPwd, new: !showPwd.new })}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPwd.new ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-sm font-medium mb-2 text-muted-foreground">تأكيد كلمة المرور</label>
              <div className="relative">
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <Lock className="h-4 w-4 text-muted-foreground" />
                </div>
                <input
                  type={showPwd.confirm ? "text" : "password"}
                  className="input-field pr-10 pl-10"
                  placeholder="••••••••"
                  value={passwordForm.confirm_password}
                  onChange={(e) => setPasswordForm({ ...passwordForm, confirm_password: e.target.value })}
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPwd({ ...showPwd, confirm: !showPwd.confirm })}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPwd.confirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {passwordForm.confirm_password && passwordForm.new_password !== passwordForm.confirm_password && (
                <p className="text-xs text-red-400 mt-1.5 flex items-center gap-1">
                  <EyeOff className="h-3 w-3" />
                  كلمة المرور غير متطابقة
                </p>
              )}
            </div>

            <div className="pt-2">
              <button type="submit" disabled={changingPwd} className="btn-primary gap-2 min-w-[160px]">
                {changingPwd ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}
                {changingPwd ? "جاري التغيير..." : "تغيير كلمة المرور"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
