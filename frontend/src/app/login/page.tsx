"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import { Eye, EyeOff, LogIn, ArrowLeft, Mail, RefreshCw } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

export default function LoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", password: "" });
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [requiresVerify, setRequiresVerify] = useState(false);
  const [unverifiedEmail, setUnverifiedEmail] = useState("");
  const [resendLoading, setResendLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Cooldown timer
  useState(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setRequiresVerify(false);
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();

      // Check for email verification required
      if (res.status === 403 && data.code === "EMAIL_NOT_VERIFIED") {
        setRequiresVerify(true);
        setUnverifiedEmail(data.email || form.email);
        setError(data.error || "يرجى تأكيد بريدك الإلكتروني أولاً");
        return;
      }

      // Check for 2FA required
      if (data.requires_2fa) {
        // Store temp token and show 2FA input
        setTempToken(data.temp_token);
        setShow2FA(true);
        return;
      }

      if (!res.ok) {
        setError(data.error || "فشل تسجيل الدخول");
        return;
      }

      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      toast.success("تم تسجيل الدخول بنجاح");
      router.push(data.user.role === "ADMIN" ? "/dashboard" : "/dashboard");
    } catch {
      setError("حدث خطأ في الاتصال");
    } finally {
      setLoading(false);
    }
  };

  const [show2FA, setShow2FA] = useState(false);
  const [tempToken, setTempToken] = useState("");
  const [twoFACode, setTwoFACode] = useState("");
  const [twoFALoading, setTwoFALoading] = useState(false);

  const handle2FAVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setTwoFALoading(true);
    try {
      const res = await fetch(`${API}/api/auth/verify-2fa`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ temp_token: tempToken, code: twoFACode }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "رمز المصادقة غير صحيح");
        return;
      }
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      toast.success("تم تسجيل الدخول بنجاح");
      router.push(data.user.role === "ADMIN" ? "/dashboard" : "/dashboard");
    } catch {
      setError("حدث خطأ في الاتصال");
    } finally {
      setTwoFALoading(false);
    }
  };

  const handleResendVerification = async () => {
    if (resendCooldown > 0) return;
    setResendLoading(true);
    try {
      const res = await fetch(`${API}/api/auth/resend-verification`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: unverifiedEmail }),
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

  // 2FA verification screen
  if (show2FA) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-96 h-96 bg-emerald-500/20 rounded-full blur-3xl" />
          <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl" />
        </div>
        <div className="relative w-full max-w-md">
          <div className="glass-panel-strong rounded-3xl p-8">
            <div className="text-center mb-8">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-blue-500/10 flex items-center justify-center">
                <Mail className="h-8 w-8 text-blue-500" />
              </div>
              <h1 className="text-2xl font-bold">المصادقة الثنائية</h1>
              <p className="text-sm text-muted-foreground mt-1">أدخل رمز المصادقة من تطبيقك</p>
            </div>
            {error && <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm mb-4">{error}</div>}
            <form onSubmit={handle2FAVerify} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">رمز المصادقة</label>
                <input
                  type="text"
                  className="input-field text-center text-2xl tracking-[0.5em] font-mono"
                  placeholder="000000"
                  value={twoFACode}
                  onChange={(e) => setTwoFACode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  maxLength={6}
                  required
                  autoFocus
                  dir="ltr"
                />
              </div>
              <button type="submit" disabled={twoFALoading || twoFACode.length !== 6} className="btn-primary w-full gap-2">
                {twoFALoading ? <span className="spinner h-4 w-4" /> : <LogIn className="h-4 w-4" />}
                {twoFALoading ? "جاري التحقق..." : "تأكيد"}
              </button>
            </form>
            <button onClick={() => { setShow2FA(false); setTempToken(""); setTwoFACode(""); setError(""); }} className="text-sm text-muted-foreground hover:text-foreground mt-4 block mx-auto">
              رجوع
            </button>
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
            <h1 className="text-2xl font-bold">تسجيل الدخول</h1>
            <p className="text-sm text-muted-foreground mt-1">أهلاً بعودتك! أدخل بيانات حسابك</p>
          </div>

          {error && (
            <div className={`p-3 rounded-xl border text-sm mb-4 ${requiresVerify ? 'bg-yellow-500/10 border-yellow-500/20 text-yellow-500' : 'bg-red-500/10 border-red-500/20 text-red-500'}`}>
              {error}
              {requiresVerify && (
                <button
                  onClick={handleResendVerification}
                  disabled={resendLoading || resendCooldown > 0}
                  className="mt-2 text-xs underline flex items-center gap-1 mx-auto hover:text-yellow-300 disabled:opacity-50"
                >
                  {resendLoading ? <span className="spinner h-3 w-3" /> : <RefreshCw className="h-3 w-3" />}
                  {resendCooldown > 0 ? `إعادة إرسال بعد ${resendCooldown}ث` : "إعادة إرسال رابط التأكيد"}
                </button>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">البريد الإلكتروني</label>
              <input type="email" className="input-field" placeholder="admin@eg-money.com" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">كلمة المرور</label>
              <div className="relative">
                <input type={show ? "text" : "password"} className="input-field pl-10" placeholder="••••••••" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required />
                <button type="button" onClick={() => setShow(!show)} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full gap-2">
              {loading ? <span className="spinner h-4 w-4" /> : <LogIn className="h-4 w-4" />}
              {loading ? "جاري تسجيل الدخول..." : "تسجيل الدخول"}
            </button>
          </form>
          <div className="mt-6 text-center space-y-2">
            <Link href="/forgot-password" className="text-sm text-primary hover:underline block">نسيت كلمة المرور؟</Link>
            <p className="text-sm text-muted-foreground">ليس لديك حساب؟ <Link href="/register" className="text-primary hover:underline">إنشاء حساب</Link></p>
          </div>
          <div className="mt-6 pt-6 border-t border-border/50 text-center">
            <Link href="/" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1"><ArrowLeft className="h-3 w-3" /> العودة للرئيسية</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
