"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import {
  CheckCircle,
  XCircle,
  Mail,
  ArrowLeft,
  RefreshCw,
  LogIn,
  Zap,
  ShieldCheck,
  Loader2,
  AlertTriangle,
} from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

export default function VerifyEmailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [resendLoading, setResendLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendEmail, setResendEmail] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setErrorMessage("رمز التحقق مفقود. يرجى استخدام الرابط المرسل إلى بريدك الإلكتروني.");
      return;
    }

    const verifyEmail = async () => {
      try {
        const res = await fetch(`${API}/api/v1/auth/verify-email?token=${encodeURIComponent(token)}`);
        const data = await res.json();

        if (res.ok && data.success) {
          setStatus("success");
        } else {
          setStatus("error");
          setErrorMessage(data.error || "فشل التحقق من البريد الإلكتروني");
        }
      } catch {
        setStatus("error");
        setErrorMessage("حدث خطأ في الاتصال بالخادم");
      }
    };

    verifyEmail();
  }, [token]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const handleResend = async () => {
    if (!resendEmail || resendCooldown > 0) return;
    setResendLoading(true);
    try {
      const res = await fetch(`${API}/api/v1/auth/resend-verification`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: resendEmail }),
      });
      const data = await res.json();
      if (res.status === 429) {
        setResendCooldown(60);
      }
      toast.success(data.message || "تم إرسال رابط التحقق");
      setResendCooldown(60);
    } catch {
      toast.error("حدث خطأ في الاتصال");
    } finally {
      setResendLoading(false);
    }
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
        <div className="glass-panel-strong rounded-3xl p-8 animated-border text-center">

          {/* ── Loading State ── */}
          {status === "loading" && (
            <div className="animate-fade-in">
              <div className="relative inline-flex mb-6">
                <div className="w-20 h-20 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                  <Loader2 className="h-10 w-10 text-blue-500 animate-spin" />
                </div>
              </div>
              <h1 className="text-2xl font-bold mb-3">جاري التحقق...</h1>
              <p className="text-sm text-muted-foreground leading-relaxed">
                يرجى الانتظار بينما نتحقق من بريدك الإلكتروني
              </p>
              <div className="mt-6 flex justify-center">
                <div className="flex gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse-glow" />
                  <div className="w-2 h-2 rounded-full bg-emerald-500/50 animate-pulse-glow delay-200" />
                  <div className="w-2 h-2 rounded-full bg-emerald-500/25 animate-pulse-glow delay-400" />
                </div>
              </div>
            </div>
          )}

          {/* ── Success State ── */}
          {status === "success" && (
            <div className="animate-scale-in">
              <div className="relative inline-flex mb-6">
                <div className="w-20 h-20 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center glow-emerald">
                  <CheckCircle className="h-10 w-10 text-emerald-500" />
                </div>
                <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center">
                  <Zap className="h-3 w-3 text-white" />
                </div>
              </div>
              <h1 className="text-2xl font-bold mb-3 text-emerald-400">تم تأكيد البريد الإلكتروني</h1>
              <p className="text-sm text-muted-foreground leading-relaxed mb-8">
                تم تفعيل حسابك بنجاح! يمكنك الآن تسجيل الدخول والبدء بالتداول.
              </p>
              <button
                onClick={() => router.push("/login")}
                className="btn-primary w-full gap-2.5 py-3 text-base relative overflow-hidden group"
              >
                <LogIn className="h-5 w-5 group-hover:translate-x-0.5 transition-transform duration-200" />
                تسجيل الدخول
              </button>
            </div>
          )}

          {/* ── Error State ── */}
          {status === "error" && (
            <div className="animate-scale-in">
              <div className="relative inline-flex mb-6">
                <div className="w-20 h-20 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                  <XCircle className="h-10 w-10 text-red-500" />
                </div>
              </div>
              <h1 className="text-2xl font-bold mb-3 text-red-400">فشل التحقق</h1>
              <p className="text-sm text-muted-foreground leading-relaxed mb-6">{errorMessage}</p>

              {/* Resend Section */}
              <div className="space-y-4">
                <div className="glass-panel rounded-2xl p-5 text-right">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertTriangle className="h-4 w-4 text-yellow-500" />
                    <p className="text-sm font-medium">إعادة إرسال رابط التحقق</p>
                  </div>
                  <label className="block text-sm font-medium mb-2 text-muted-foreground">
                    أدخل بريدك الإلكتروني
                  </label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/50 pointer-events-none">
                        <Mail className="h-4 w-4" />
                      </div>
                      <input
                        type="email"
                        className="input-field pr-10"
                        placeholder="your@email.com"
                        value={resendEmail}
                        onChange={(e) => setResendEmail(e.target.value)}
                        dir="ltr"
                      />
                    </div>
                    <button
                      onClick={handleResend}
                      disabled={resendLoading || resendCooldown > 0 || !resendEmail}
                      className="btn-primary gap-1.5 shrink-0 px-4"
                    >
                      {resendLoading ? (
                        <span className="spinner h-4 w-4" />
                      ) : (
                        <RefreshCw className="h-4 w-4" />
                      )}
                      {resendCooldown > 0 ? `${resendCooldown}ث` : "إرسال"}
                    </button>
                  </div>
                </div>

                <Link
                  href="/login"
                  className="btn-primary w-full gap-2.5 py-3 text-base inline-flex items-center justify-center"
                >
                  <LogIn className="h-5 w-5" />
                  تسجيل الدخول
                </Link>
              </div>
            </div>
          )}

          {/* Back to Home */}
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
