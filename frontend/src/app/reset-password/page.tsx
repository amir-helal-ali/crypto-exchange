"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Lock,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Zap,
  ShieldCheck,
  Shield,
  Check,
  X,
} from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

export default function ResetPasswordPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!token) {
      setError("رابط إعادة التعيين غير صالح. لا يوجد رمز توثيق.");
    }
  }, [token]);

  // Password strength
  const getStrength = () => {
    if (!password) return 0;
    let score = 0;
    if (password.length >= 8) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[a-z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    return score;
  };

  const strength = getStrength();
  const strengthLabel = ["", "ضعيفة جداً", "ضعيفة", "متوسطة", "جيدة", "قوية"][strength];
  const strengthColor = [
    "",
    "bg-red-500",
    "bg-orange-500",
    "bg-yellow-500",
    "bg-emerald-400",
    "bg-emerald-500",
  ][strength];
  const strengthTextColor = [
    "",
    "text-red-500",
    "text-orange-500",
    "text-yellow-500",
    "text-emerald-400",
    "text-emerald-500",
  ][strength];

  const requirements = [
    { met: password.length >= 8, label: "8 أحرف على الأقل" },
    { met: /[A-Z]/.test(password), label: "حرف كبير واحد" },
    { met: /[a-z]/.test(password), label: "حرف صغير واحد" },
    { met: /[0-9]/.test(password), label: "رقم واحد" },
    { met: /[^A-Za-z0-9]/.test(password), label: "رمز خاص واحد" },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("كلمة المرور غير متطابقة");
      return;
    }
    if (password.length < 8) {
      setError("كلمة المرور يجب أن تكون 8 أحرف على الأقل");
      return;
    }
    if (!/[A-Z]/.test(password)) {
      setError("كلمة المرور يجب أن تحتوي على حرف كبير واحد على الأقل");
      return;
    }
    if (!/[a-z]/.test(password)) {
      setError("كلمة المرور يجب أن تحتوي على حرف صغير واحد على الأقل");
      return;
    }
    if (!/[0-9]/.test(password)) {
      setError("كلمة المرور يجب أن تحتوي على رقم واحد على الأقل");
      return;
    }
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      setError("كلمة المرور يجب أن تحتوي على رمز خاص واحد على الأقل");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API}/api/v1/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, new_password: password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "فشل إعادة تعيين كلمة المرور"); return; }
      setDone(true);
      setTimeout(() => router.push("/login"), 3000);
    } catch { setError("حدث خطأ في الاتصال"); }
    finally { setLoading(false); }
  };

  // ── Invalid Token State ──
  if (!token && error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background relative overflow-hidden" dir="rtl">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-32 -right-32 w-[500px] h-[500px] bg-red-500/10 rounded-full blur-[120px] animate-pulse-glow" />
          <div className="absolute -bottom-32 -left-32 w-[400px] h-[400px] bg-red-400/5 rounded-full blur-[100px] animate-pulse-glow delay-500" />
          <div className="absolute inset-0 bg-grid-pattern opacity-40" />
        </div>
        <div className={`relative w-full max-w-md ${mounted ? "animate-slide-in-up" : "opacity-0"}`}>
          <div className="glass-panel-strong rounded-3xl p-8 animated-border text-center">
            <div className="relative inline-flex mb-6">
              <div className="w-20 h-20 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                <AlertCircle className="h-10 w-10 text-red-500" />
              </div>
            </div>
            <h1 className="text-2xl font-bold mb-3 text-red-400">رابط غير صالح</h1>
            <p className="text-sm text-muted-foreground leading-relaxed mb-8">{error}</p>
            <Link href="/forgot-password" className="btn-primary w-full gap-2.5 py-3 text-base">
              طلب رابط جديد
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── Success State ──
  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background relative overflow-hidden" dir="rtl">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-32 -right-32 w-[500px] h-[500px] bg-emerald-500/15 rounded-full blur-[120px] animate-pulse-glow" />
          <div className="absolute -bottom-32 -left-32 w-[400px] h-[400px] bg-teal-500/10 rounded-full blur-[100px] animate-pulse-glow delay-500" />
          <div className="absolute inset-0 bg-grid-pattern opacity-40" />
        </div>
        <div className={`relative w-full max-w-md ${mounted ? "animate-slide-in-up" : "opacity-0"}`}>
          <div className="glass-panel-strong rounded-3xl p-8 animated-border text-center animate-scale-in">
            <div className="relative inline-flex mb-6">
              <div className="w-20 h-20 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center glow-emerald">
                <CheckCircle2 className="h-10 w-10 text-emerald-500" />
              </div>
              <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center">
                <Zap className="h-3 w-3 text-white" />
              </div>
            </div>
            <h1 className="text-2xl font-bold mb-3 text-emerald-400">تم إعادة التعيين!</h1>
            <p className="text-sm text-muted-foreground leading-relaxed mb-8">
              تم إعادة تعيين كلمة المرور بنجاح. جاري التحويل إلى صفحة الدخول...
            </p>
            <Link href="/login" className="btn-primary w-full gap-2.5 py-3 text-base">
              تسجيل الدخول
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── Main Form ──
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

      {/* Card */}
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
            <h1 className="text-2xl font-bold mb-2">تعيين كلمة مرور جديدة</h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              أدخل كلمة المرور الجديدة أدناه
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm mb-6 flex items-center gap-2.5 animate-scale-in">
              <div className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Password Field */}
            <div className="space-y-2">
              <label className="block text-sm font-medium">كلمة المرور الجديدة</label>
              <div className="relative">
                <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/50 pointer-events-none">
                  <Lock className="h-4.5 w-4.5" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  className="input-field pr-11 pl-11"
                  placeholder="أدخل كلمة المرور الجديدة"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  minLength={8}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors duration-200"
                >
                  {showPassword ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
                </button>
              </div>

              {/* Strength Indicator */}
              {password && (
                <div className="space-y-2 animate-fade-in">
                  <div className="flex gap-1.5">
                    {[1, 2, 3, 4, 5].map((level) => (
                      <div
                        key={level}
                        className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                          level <= strength ? strengthColor : "bg-muted/30"
                        }`}
                      />
                    ))}
                  </div>
                  <p className={`text-xs ${strengthTextColor}`}>
                    قوة كلمة المرور: {strengthLabel}
                  </p>
                </div>
              )}

              {/* Requirements */}
              {password && (
                <div className="space-y-1.5 animate-fade-in">
                  {requirements.map((req, i) => (
                    <div key={i} className="flex items-center gap-2">
                      {req.met ? (
                        <Check className="h-3 w-3 text-emerald-500" />
                      ) : (
                        <X className="h-3 w-3 text-muted-foreground/30" />
                      )}
                      <span className={`text-xs ${req.met ? "text-emerald-500" : "text-muted-foreground/50"}`}>
                        {req.label}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Confirm Password Field */}
            <div className="space-y-2">
              <label className="block text-sm font-medium">تأكيد كلمة المرور</label>
              <div className="relative">
                <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/50 pointer-events-none">
                  <Shield className="h-4.5 w-4.5" />
                </div>
                <input
                  type={showConfirm ? "text" : "password"}
                  className="input-field pr-11 pl-11"
                  placeholder="أعد كتابة كلمة المرور"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  required
                  minLength={8}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors duration-200"
                >
                  {showConfirm ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
                </button>
              </div>
              {confirmPassword && (
                <div className="flex items-center gap-2 animate-fade-in">
                  {password === confirmPassword ? (
                    <>
                      <Check className="h-3 w-3 text-emerald-500" />
                      <span className="text-xs text-emerald-500">كلمة المرور متطابقة</span>
                    </>
                  ) : (
                    <>
                      <X className="h-3 w-3 text-red-500" />
                      <span className="text-xs text-red-500">كلمة المرور غير متطابقة</span>
                    </>
                  )}
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full gap-2.5 py-3 text-base relative overflow-hidden group"
            >
              {loading ? (
                <span className="spinner h-5 w-5" />
              ) : (
                <Lock className="h-5 w-5 group-hover:translate-x-0.5 transition-transform duration-200" />
              )}
              {loading ? "جاري الحفظ..." : "تعيين كلمة المرور"}
            </button>
          </form>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border/40" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-card/80 backdrop-blur-xl px-4 text-xs text-muted-foreground">أو</span>
            </div>
          </div>

          {/* Back to Login */}
          <div className="text-center">
            <Link
              href="/login"
              className="text-sm text-emerald-400 hover:text-emerald-300 font-medium inline-flex items-center gap-1.5 transition-colors duration-200"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              العودة لتسجيل الدخول
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
