"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle, XCircle, Mail, ArrowLeft, RefreshCw, LogIn } from "lucide-react";

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
      alert(data.message || data.error || "تم إرسال رابط التحقق");
      setResendCooldown(60);
    } catch {
      alert("حدث خطأ في الاتصال");
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-emerald-500/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl" />
      </div>
      <div className="relative w-full max-w-md">
        <div className="glass-panel-strong rounded-3xl p-8 text-center">
          {status === "loading" && (
            <>
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-blue-500/10 flex items-center justify-center">
                <span className="spinner h-8 w-8 text-blue-500" />
              </div>
              <h1 className="text-2xl font-bold mb-3">جاري التحقق...</h1>
              <p className="text-muted-foreground">يرجى الانتظار بينما نتحقق من بريدك الإلكتروني</p>
            </>
          )}

          {status === "success" && (
            <>
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-emerald-500/10 flex items-center justify-center">
                <CheckCircle className="h-10 w-10 text-emerald-500" />
              </div>
              <h1 className="text-2xl font-bold mb-3 text-emerald-400">تم تأكيد البريد الإلكتروني</h1>
              <p className="text-muted-foreground mb-6">
                تم تفعيل حسابك بنجاح! يمكنك الآن تسجيل الدخول والبدء بالتداول.
              </p>
              <button
                onClick={() => router.push("/login")}
                className="btn-primary w-full gap-2 inline-flex items-center justify-center"
              >
                <LogIn className="h-4 w-4" />
                تسجيل الدخول
              </button>
            </>
          )}

          {status === "error" && (
            <>
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-red-500/10 flex items-center justify-center">
                <XCircle className="h-10 w-10 text-red-500" />
              </div>
              <h1 className="text-2xl font-bold mb-3 text-red-400">فشل التحقق</h1>
              <p className="text-muted-foreground mb-6">{errorMessage}</p>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5 text-right">أدخل بريدك الإلكتروني لإعادة إرسال الرابط</label>
                  <div className="flex gap-2">
                    <input
                      type="email"
                      className="input-field flex-1"
                      placeholder="your@email.com"
                      value={resendEmail}
                      onChange={(e) => setResendEmail(e.target.value)}
                      dir="ltr"
                    />
                    <button
                      onClick={handleResend}
                      disabled={resendLoading || resendCooldown > 0 || !resendEmail}
                      className="btn-ghost gap-1 shrink-0"
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

                <Link href="/login" className="btn-primary w-full inline-flex items-center justify-center gap-2">
                  <LogIn className="h-4 w-4" />
                  تسجيل الدخول
                </Link>
              </div>
            </>
          )}

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
