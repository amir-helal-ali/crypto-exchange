"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import {
  Eye,
  EyeOff,
  UserPlus,
  ArrowLeft,
  Mail,
  RefreshCw,
  Zap,
  User,
  Lock,
  Globe,
  Phone,
  ShieldCheck,
  CheckCircle2,
  Sparkles,
  ArrowRight,
} from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
    full_name: "",
    country: "",
    phone: "",
  });
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [registered, setRegistered] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState("");
  const [resendLoading, setResendLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Cooldown timer for resend
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown((prev) => prev - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  // Password strength indicator
  const getPasswordStrength = (password: string) => {
    const checks = {
      length: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      number: /\d/.test(password),
      special: /[!@#$%^&*(),.?":{}|<>]/.test(password),
    };
    const passed = Object.values(checks).filter(Boolean).length;
    return { checks, passed, total: 5 };
  };

  const passwordStrength = getPasswordStrength(form.password);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/v1/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "فشل إنشاء الحساب");
        return;
      }
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
      const res = await fetch(`${API}/api/v1/auth/resend-verification`, {
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
      <div
        className="min-h-screen flex items-center justify-center p-4 bg-background relative overflow-hidden"
        dir="rtl"
      >
        {/* Animated Background Orbs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 right-1/4 w-[500px] h-[500px] bg-emerald-500/15 rounded-full blur-[120px] animate-pulse-glow" />
          <div className="absolute bottom-1/4 left-1/4 w-[400px] h-[400px] bg-teal-500/10 rounded-full blur-[100px] animate-pulse-glow delay-500" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-emerald-600/5 rounded-full blur-[150px]" />
          <div className="absolute inset-0 bg-grid-pattern opacity-40" />
        </div>

        {/* Verification Success Card */}
        <div className={`relative w-full max-w-md ${mounted ? "animate-scale-in" : "opacity-0"}`}>
          <div className="glass-panel-strong rounded-3xl p-8 animated-border text-center">
            {/* Success Icon with Animation */}
            <div className="relative inline-flex mb-6">
              <div className="w-24 h-24 rounded-3xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center glow-emerald">
                <Mail className="h-12 w-12 text-emerald-500 animate-float" />
              </div>
              <div className="absolute -bottom-1 -left-1 w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/30">
                <CheckCircle2 className="h-5 w-5 text-white" />
              </div>
            </div>

            <h1 className="text-2xl font-bold mb-3">تحقق من بريدك الإلكتروني</h1>
            <p className="text-muted-foreground mb-2">تم إرسال رابط التأكيد إلى</p>
            <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-2 mb-4">
              <Mail className="h-4 w-4 text-emerald-400" />
              <p className="text-emerald-400 font-semibold text-base" dir="ltr">
                {registeredEmail}
              </p>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed mb-8">
              يرجى الضغط على رابط التأكيد في البريد الإلكتروني لتفعيل حسابك.
              <br />
              الرابط صالح لمدة 24 ساعة.
            </p>

            <div className="space-y-3">
              <button
                onClick={handleResendVerification}
                disabled={resendLoading || resendCooldown > 0}
                className="btn-ghost w-full gap-2 border border-border/50 hover:border-emerald-500/30 hover:bg-emerald-500/5"
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
              <Link
                href="/login"
                className="btn-primary w-full inline-flex items-center justify-center gap-2.5 py-3 text-base"
              >
                <ArrowRight className="h-4 w-4" />
                الانتقال لتسجيل الدخول
              </Link>
            </div>

            <div className="mt-6 pt-6 border-t border-border/30">
              <Link
                href="/"
                className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 transition-colors duration-200"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                العودة للرئيسية
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 bg-background relative overflow-hidden"
      dir="rtl"
    >
      {/* Animated Background Orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -right-32 w-[500px] h-[500px] bg-emerald-500/15 rounded-full blur-[120px] animate-pulse-glow" />
        <div className="absolute -bottom-32 -left-32 w-[400px] h-[400px] bg-teal-500/10 rounded-full blur-[100px] animate-pulse-glow delay-500" />
        <div className="absolute top-1/3 left-1/3 w-[300px] h-[300px] bg-emerald-400/5 rounded-full blur-[80px] animate-float" />
        <div className="absolute bottom-1/3 right-1/3 w-[350px] h-[350px] bg-teal-400/8 rounded-full blur-[90px] animate-float delay-300" />
        <div className="absolute inset-0 bg-grid-pattern opacity-40" />
      </div>

      {/* Register Card */}
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
            <h1 className="text-2xl font-bold mb-2">إنشاء حساب</h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              ابدأ رحلة التداول اليوم مع EgMoney
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm mb-6 flex items-start gap-2.5 animate-scale-in">
              <div className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0 mt-1.5" />
              {error}
            </div>
          )}

          {/* Register Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Username Field */}
            <div className="space-y-2">
              <label className="block text-sm font-medium">اسم المستخدم</label>
              <div className="relative">
                <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/50 pointer-events-none">
                  <User className="h-4.5 w-4.5" />
                </div>
                <input
                  type="text"
                  className="input-field pr-11"
                  placeholder="ahmed"
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  required
                  dir="ltr"
                />
              </div>
            </div>

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
                  placeholder="ahmed@email.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                  dir="ltr"
                />
              </div>
            </div>

            {/* Full Name Field */}
            <div className="space-y-2">
              <label className="block text-sm font-medium">الاسم الكامل</label>
              <div className="relative">
                <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/50 pointer-events-none">
                  <User className="h-4.5 w-4.5" />
                </div>
                <input
                  type="text"
                  className="input-field pr-11"
                  placeholder="محمد أحمد"
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                />
              </div>
            </div>

            {/* Country & Phone */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="block text-sm font-medium">الدولة</label>
                <div className="relative">
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/50 pointer-events-none">
                    <Globe className="h-4 w-4" />
                  </div>
                  <input
                    type="text"
                    className="input-field pr-9"
                    placeholder="مصر"
                    value={form.country}
                    onChange={(e) => setForm({ ...form, country: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium">رقم الهاتف</label>
                <div className="relative">
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/50 pointer-events-none">
                    <Phone className="h-4 w-4" />
                  </div>
                  <input
                    type="tel"
                    className="input-field pr-9"
                    placeholder="+20 100 000 0000"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    dir="ltr"
                  />
                </div>
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
                  minLength={8}
                />
                <button
                  type="button"
                  onClick={() => setShow(!show)}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors duration-200"
                >
                  {show ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
                </button>
              </div>

              {/* Password Strength Indicator */}
              {form.password && (
                <div className="mt-3 animate-fade-in">
                  <div className="flex gap-1.5 mb-2">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div
                        key={i}
                        className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                          i < passwordStrength.passed
                            ? passwordStrength.passed <= 2
                              ? "bg-red-500"
                              : passwordStrength.passed <= 3
                              ? "bg-yellow-500"
                              : "bg-emerald-500"
                            : "bg-muted/30"
                        }`}
                      />
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                    {[
                      { label: "8 أحرف على الأقل", met: passwordStrength.checks.length },
                      { label: "حرف كبير", met: passwordStrength.checks.uppercase },
                      { label: "حرف صغير", met: passwordStrength.checks.lowercase },
                      { label: "رقم", met: passwordStrength.checks.number },
                      { label: "رمز خاص", met: passwordStrength.checks.special },
                    ].map((req, i) => (
                      <div
                        key={i}
                        className={`flex items-center gap-1.5 text-xs transition-colors duration-200 ${
                          req.met ? "text-emerald-400" : "text-muted-foreground/50"
                        }`}
                      >
                        <CheckCircle2 className={`h-3 w-3 ${req.met ? "opacity-100" : "opacity-30"}`} />
                        {req.label}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full gap-2.5 py-3 text-base relative overflow-hidden group mt-2"
            >
              {loading ? (
                <span className="spinner h-5 w-5" />
              ) : (
                <UserPlus className="h-5 w-5 group-hover:scale-110 transition-transform duration-200" />
              )}
              {loading ? "جاري إنشاء الحساب..." : "إنشاء حساب"}
            </button>
          </form>

          {/* Email Verification Notice */}
          <div className="mt-4 p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/10 flex items-start gap-2.5">
            <Mail className="h-4 w-4 text-emerald-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground leading-relaxed">
              سيتم إرسال رابط تأكيد إلى بريدك الإلكتروني لتفعيل الحساب
            </p>
          </div>

          {/* Divider */}
          <div className="relative my-5">
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

          {/* Login Link */}
          <div className="text-center">
            <p className="text-sm text-muted-foreground">
              لديك حساب بالفعل؟{" "}
              <Link
                href="/login"
                className="text-emerald-400 hover:text-emerald-300 font-medium transition-colors duration-200"
              >
                تسجيل الدخول
              </Link>
            </p>
          </div>

          {/* Back to Home */}
          <div className="mt-5 pt-5 border-t border-border/30 text-center">
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
