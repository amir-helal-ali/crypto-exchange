"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import { Eye, EyeOff, UserPlus, ArrowLeft, Mail, RefreshCw } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ username: "", email: "", password: "", full_name: "", country: "", phone: "" });
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [registered, setRegistered] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState("");
  const [resendLoading, setResendLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Cooldown timer for resend
  useState(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "فشل إنشاء الحساب");
        return;
      }
      // Registration successful - show verification message instead of auto-login
      setRegisteredEmail(data.email || form.email);
      setRegistered(true);
      toast.success("تم إنشاء الحساب بنجاح");
    } catch {
      setError("حدث خطأ في الاتصال");
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    if (resendCooldown > 0) return;
    setResendLoading(true);
    try {
      const res = await fetch(`${API}/api/auth/resend-verification`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: registeredEmail }),
      });
      const data = await res.json();
      if (res.status === 429) {
        toast.error(data.error || "يرجى الانتظار قبل طلب رابط جديد");
        setResendCooldown(60);
        return;
      }
      toast.success(data.message || "تم إرسال رابط التحقق");
      setResendCooldown(60);
    } catch {
      toast.error("حدث خطأ في الاتصال");
    } finally {
      setResendLoading(false);
    }
  };

  // Registration success - show verification message
  if (registered) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-96 h-96 bg-emerald-500/20 rounded-full blur-3xl" />
          <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl" />
        </div>
        <div className="relative w-full max-w-md">
          <div className="glass-panel-strong rounded-3xl p-8 text-center">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-emerald-500/10 flex items-center justify-center">
              <Mail className="h-10 w-10 text-emerald-500" />
            </div>
            <h1 className="text-2xl font-bold mb-3">تحقق من بريدك الإلكتروني</h1>
            <p className="text-muted-foreground mb-2">
              تم إرسال رابط التأكيد إلى
            </p>
            <p className="text-emerald-400 font-semibold mb-4 text-lg">{registeredEmail}</p>
            <p className="text-sm text-muted-foreground mb-6">
              يرجى الضغط على رابط التأكيد في البريد الإلكتروني لتفعيل حسابك.
              الرابط صالح لمدة 24 ساعة.
            </p>
            <div className="space-y-3">
              <button
                onClick={handleResendVerification}
                disabled={resendLoading || resendCooldown > 0}
                className="btn-ghost w-full gap-2"
              >
                {resendLoading ? (
                  <span className="spinner h-4 w-4" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                {resendCooldown > 0
                  ? `إعادة الإرسال بعد ${resendCooldown} ثانية`
                  : "إعادة إرسال رابط التأكيد"}
              </button>
              <Link href="/login" className="btn-primary w-full inline-flex items-center justify-center gap-2">
                الانتقال لتسجيل الدخول
              </Link>
            </div>
            <div className="mt-6 pt-6 border-t border-border/50">
              <Link href="/" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
                <ArrowLeft className="h-3 w-3" /> العودة للرئيسية
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-emerald-500/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl" />
      </div>
      <div className="relative w-full max-w-md">
        <div className="glass-panel-strong rounded-3xl p-8">
          <div className="text-center mb-8">
            <Link href="/" className="text-2xl font-bold gradient-text inline-block mb-2">EgMoney</Link>
            <h1 className="text-2xl font-bold">إنشاء حساب</h1>
            <p className="text-sm text-muted-foreground mt-1">ابدأ رحلة التداول اليوم</p>
          </div>
          {error && <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm mb-4">{error}</div>}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">اسم المستخدم</label>
              <input type="text" className="input-field" placeholder="ahmed" value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} required />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">البريد الإلكتروني</label>
              <input type="email" className="input-field" placeholder="ahmed@email.com" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">الاسم الكامل</label>
              <input type="text" className="input-field" placeholder="محمد أحمد" value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">الدولة</label>
                <input type="text" className="input-field" placeholder="مصر" value={form.country} onChange={e => setForm({ ...form, country: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">رقم الهاتف</label>
                <input type="tel" className="input-field" placeholder="+20 100 000 0000" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">كلمة المرور</label>
              <div className="relative">
                <input type={show ? "text" : "password"} className="input-field pl-10" placeholder="••••••••" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required minLength={6} />
                <button type="button" onClick={() => setShow(!show)} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full gap-2">
              {loading ? <span className="spinner h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
              {loading ? "جاري إنشاء الحساب..." : "إنشاء حساب"}
            </button>
          </form>
          <p className="text-xs text-muted-foreground mt-4 text-center">
            سيتم إرسال رابط تأكيد إلى بريدك الإلكتروني لتفعيل الحساب
          </p>
          <div className="mt-4 text-center space-y-2">
            <p className="text-sm text-muted-foreground">لديك حساب بالفعل؟ <Link href="/login" className="text-primary hover:underline">تسجيل الدخول</Link></p>
          </div>
          <div className="mt-4 pt-4 border-t border-border/50 text-center">
            <Link href="/" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1"><ArrowLeft className="h-3 w-3" /> العودة للرئيسية</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
