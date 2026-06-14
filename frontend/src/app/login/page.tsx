"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import {
  Eye,
  EyeOff,
  LogIn,
  ArrowLeft,
  Mail,
  Lock,
  Zap,
  RefreshCw,
  ShieldCheck,
  ArrowRight,
  Sparkles,
} from "lucide-react";

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
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown((prev) => prev - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setRequiresVerify(false);
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/v1/auth/login`, {
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
        setTempToken(data.temp_token);
        setShow2FA(true);
        return;
      }

      if (!res.ok) {
        setError(data.error || "فشل تسجيل الدخول");
        return;
      }

      localStorage.setItem("token", data.token);
      localStorage.setItem("refresh_token", data.refresh_token || "");
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
      const res = await fetch(`${API}/api/v1/auth/verify-2fa`, {
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
      localStorage.setItem("refresh_token", data.refresh_token || "");
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
      const res = await fetch(`${API}/api/v1/auth/resend-verification`, {
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
      <div className="min-h-screen flex items-center justify-center p-4 bg-background relative overflow-hidden" dir="rtl">
        {/* Animated Background Orbs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 right-1/4 w-[500px] h-[500px] bg-emerald-500/15 rounded-full blur-[120px] animate-pulse-glow" />
          <div className="absolute bottom-1/4 left-1/4 w-[400px] h-[400px] bg-teal-500/10 rounded-full blur-[100px] animate-pulse-glow delay-500" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-emerald-600/5 rounded-full blur-[150px]" />
          <div className="absolute inset-0 bg-grid-pattern opacity-40" />
        </div>

        {/* 2FA Card */}
        <div className={`relative w-full max-w-md ${mounted ? "animate-scale-in" : "opacity-0"}`}>
          <div className="glass-panel-strong rounded-3xl p-8 animated-border">
            {/* 2FA Icon */}
            <div className="text-center mb-8">
              <div className="relative inline-flex">
                <div className="w-20 h-20 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center glow-emerald">
                  <ShieldCheck className="h-10 w-10 text-emerald-500" />
                </div>
                <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center">
                  <Zap className="h-3 w-3 text-white" />
                </div>
              </div>
              <h1 className="text-2xl font-bold mt-5 mb-2">المصادقة الثنائية</h1>
              <p className="text-sm text-muted-foreground leading-relaxed">
                أدخل رمز المصادقة من تطبيق المصادقة الخاص بك
              </p>
            </div>

            {/* Error */}
            {error && (
              <div className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm mb-6 flex items-center gap-2 animate-scale-in">
                <div className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
                {error}
              </div>
            )}

            {/* 2FA Form */}
            <form onSubmit={handle2FAVerify} className="space-y-6">
              <div>
                <label className="block text-sm font-medium mb-2">رمز المصادقة</label>
                <div className="relative">
                  <input
                    type="text"
                    className="input-field text-center text-3xl tracking-[0.5em] font-mono py-4 h-16"
                    placeholder="000000"
                    value={twoFACode}
                    onChange={(e) => setTwoFACode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    maxLength={6}
                    required
                    autoFocus
                    dir="ltr"
                  />
                  <div className="absolute left-4 top-1/2 -translate-y-1/2">
                    <ShieldCheck className="h-5 w-5 text-muted-foreground/40" />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-2 text-center">
                  الرمز مكون من 6 أرقام
                </p>
              </div>
              <button
                type="submit"
                disabled={twoFALoading || twoFACode.length !== 6}
                className="btn-primary w-full gap-2 py-3 text-base"
              >
                {twoFALoading ? (
                  <span className="spinner h-5 w-5" />
                ) : (
                  <ShieldCheck className="h-5 w-5" />
                )}
                {twoFALoading ? "جاري التحقق..." : "تأكيد الرمز"}
              </button>
            </form>

            <button
              onClick={() => {
                setShow2FA(false);
                setTempToken("");
                setTwoFACode("");
                setError("");
              }}
              className="text-sm text-muted-foreground hover:text-foreground mt-6 block mx-auto transition-colors duration-200 flex items-center gap-1.5"
            >
              <ArrowRight className="h-3.5 w-3.5" />
              رجوع لتسجيل الدخول
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background relative overflow-hidden" dir="rtl">
      {/* Animated Background Orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -right-32 w-[500px] h-[500px] bg-emerald-500/15 rounded-full blur-[120px] animate-pulse-glow" />
        <div className="absolute -bottom-32 -left-32 w-[400px] h-[400px] bg-teal-500/10 rounded-full blur-[100px] animate-pulse-glow delay-500" />
        <div className="absolute top-1/3 left-1/3 w-[300px] h-[300px] bg-emerald-400/5 rounded-full blur-[80px] animate-float" />
        <div className="absolute bottom-1/3 right-1/3 w-[350px] h-[350px] bg-teal-400/8 rounded-full blur-[90px] animate-float delay-300" />
        <div className="absolute inset-0 bg-grid-pattern opacity-40" />
      </div>

      {/* Login Card */}
      <div className={`relative w-full max-w-md ${mounted ? "animate-slide-in-up" : "opacity-0"}`}>
        <div className="glass-panel-strong rounded-3xl p-8 animated-border">
          {/* Logo & Header */}
          <div className="text-center mb-8">
            <Link href="/" className="inline-flex items-center gap-2 mb-4 group">
              <div className="relative">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20 group-hover:shadow-emerald-500/30 transition-shadow duration-300">
                  <Zap className="h-6 w-6 text-white" />
                </div>
                <div className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 animate-pulse-glow" />
              </div>
              <span className="text-3xl font-bold gradient-text">EgMoney</span>
            </Link>
            <h1 className="text-2xl font-bold mb-2">تسجيل الدخول</h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              أهلاً بعودتك! أدخل بيانات حسابك للمتابعة
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div
              className={`p-3.5 rounded-2xl border text-sm mb-6 flex items-start gap-2.5 animate-scale-in ${
                requiresVerify
                  ? "bg-yellow-500/10 border-yellow-500/20 text-yellow-400"
                  : "bg-red-500/10 border-red-500/20 text-red-400"
              }`}
            >
              <div
                className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${
                  requiresVerify ? "bg-yellow-500" : "bg-red-500"
                }`}
              />
              <div className="flex-1">
                {error}
                {requiresVerify && (
                  <button
                    onClick={handleResendVerification}
                    disabled={resendLoading || resendCooldown > 0}
                    className="mt-2 text-xs underline flex items-center gap-1 hover:text-yellow-300 disabled:opacity-50 transition-colors duration-200"
                  >
                    {resendLoading ? (
                      <span className="spinner h-3 w-3" />
                    ) : (
                      <RefreshCw className="h-3 w-3" />
                    )}
                    {resendCooldown > 0
                      ? `إعادة إرسال بعد ${resendCooldown}ث`
                      : "إعادة إرسال رابط التأكيد"}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email Field */}
            <div className="space-y-2">
              <label className="block text-sm font-medium">البريد الإلكتروني</label>
              <div className="relative">
                <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/50 pointer-events-none">
                  <Mail className="h-4.5 w-4.5" />
                </div>
                <input
                  type="email"
                  className="input-field pr-11"
                  placeholder="admin@eg-money.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                  dir="ltr"
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-2">
              <label className="block text-sm font-medium">كلمة المرور</label>
              <div className="relative">
                <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/50 pointer-events-none">
                  <Lock className="h-4.5 w-4.5" />
                </div>
                <input
                  type={show ? "text" : "password"}
                  className="input-field pr-11 pl-11"
                  placeholder="••••••••"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShow(!show)}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors duration-200"
                >
                  {show ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
                </button>
              </div>
            </div>

            {/* Forgot Password */}
            <div className="flex justify-end">
              <Link
                href="/forgot-password"
                className="text-sm text-emerald-400 hover:text-emerald-300 transition-colors duration-200"
              >
                نسيت كلمة المرور؟
              </Link>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full gap-2.5 py-3 text-base relative overflow-hidden group"
            >
              {loading ? (
                <span className="spinner h-5 w-5" />
              ) : (
                <LogIn className="h-5 w-5 group-hover:translate-x-0.5 transition-transform duration-200" />
              )}
              {loading ? "جاري تسجيل الدخول..." : "تسجيل الدخول"}
            </button>
          </form>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border/40" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-card/80 backdrop-blur-xl px-4 text-xs text-muted-foreground">
                <Sparkles className="h-3 w-3 inline-block ml-1" />
                أو
              </span>
            </div>
          </div>

          {/* Register Link */}
          <div className="text-center">
            <p className="text-sm text-muted-foreground">
              ليس لديك حساب؟{" "}
              <Link
                href="/register"
                className="text-emerald-400 hover:text-emerald-300 font-medium transition-colors duration-200"
              >
                إنشاء حساب جديد
              </Link>
            </p>
          </div>

          {/* Back to Home */}
          <div className="mt-6 pt-6 border-t border-border/30 text-center">
            <Link
              href="/"
              className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 transition-colors duration-200"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              العودة للرئيسية
            </Link>
          </div>
        </div>

        {/* Security Badge */}
        <div className="mt-4 text-center">
          <p className="text-xs text-muted-foreground/50 flex items-center justify-center gap-1.5">
            <ShieldCheck className="h-3 w-3" />
            اتصال مشفر وآمن 256-bit SSL
          </p>
        </div>
      </div>
    </div>
  );
}
