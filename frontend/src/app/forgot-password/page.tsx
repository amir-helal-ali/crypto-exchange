"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Mail, CheckCircle2, Zap, ShieldCheck, Send } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/v1/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "فشل إرسال طلب إعادة تعيين كلمة المرور"); return; }
      setSent(true);
    } catch { setError("حدث خطأ في الاتصال"); }
    finally { setLoading(false); }
  };

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

          {sent ? (
            /* ── Success State ── */
            <div className="text-center animate-scale-in">
              <div className="relative inline-flex mb-6">
                <div className="w-20 h-20 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center glow-emerald">
                  <Mail className="h-10 w-10 text-emerald-500 animate-float" />
                </div>
                <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center">
                  <CheckCircle2 className="h-3.5 w-3.5 text-white" />
                </div>
              </div>
              <h1 className="text-2xl font-bold mb-3">تم الإرسال بنجاح</h1>
              <p className="text-sm text-muted-foreground leading-relaxed mb-2">
                إذا كان البريد الإلكتروني مسجلاً لدينا، ستتلقى رابط إعادة تعيين كلمة المرور
              </p>
              <p className="text-xs text-muted-foreground/60 mb-8">
                تحقق من صندوق الوارد والمجلد غير المرغوب فيه
              </p>
              <Link href="/login" className="btn-primary w-full gap-2.5 py-3 text-base">
                <ArrowLeft className="h-4 w-4" />
                العودة لتسجيل الدخول
              </Link>
            </div>
          ) : (
            /* ── Form State ── */
            <>
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
                <h1 className="text-2xl font-bold mb-2">نسيت كلمة المرور</h1>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  أدخل بريدك الإلكتروني وسنرسل لك رابط إعادة التعيين
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
              <form onSubmit={handleSubmit} className="space-y-6">
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
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      required
                      dir="ltr"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary w-full gap-2.5 py-3 text-base relative overflow-hidden group"
                >
                  {loading ? (
                    <span className="spinner h-5 w-5" />
                  ) : (
                    <Send className="h-5 w-5 group-hover:translate-x-0.5 transition-transform duration-200" />
                  )}
                  {loading ? "جاري الإرسال..." : "إرسال رابط إعادة التعيين"}
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
            </>
          )}
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
