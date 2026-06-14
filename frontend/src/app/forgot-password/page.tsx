"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Mail, CheckCircle2 } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

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

  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <div className="glass-panel-strong rounded-3xl p-8 max-w-md w-full text-center">
          <div className="inline-flex p-3 rounded-2xl bg-emerald-500/10 mb-4"><CheckCircle2 className="h-8 w-8 text-emerald-500" /></div>
          <h1 className="text-2xl font-bold mb-2">تم الإرسال</h1>
          <p className="text-sm text-muted-foreground mb-6">إذا كان البريد الإلكتروني مسجلاً لدينا، ستتلقى رابط إعادة تعيين كلمة المرور</p>
          <Link href="/login" className="btn-primary">العودة لتسجيل الدخول</Link>
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
            <h1 className="text-2xl font-bold">نسيت كلمة المرور</h1>
            <p className="text-sm text-muted-foreground mt-1">أدخل بريدك الإلكتروني وسنرسل لك رابط إعادة التعيين</p>
          </div>
          {error && <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm mb-4">{error}</div>}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">البريد الإلكتروني</label>
              <input type="email" className="input-field" placeholder="ahmed@email.com" value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full gap-2">
              {loading ? <span className="spinner h-4 w-4" /> : <Mail className="h-4 w-4" />}
              {loading ? "جاري الإرسال..." : "إرسال رابط إعادة التعيين"}
            </button>
          </form>
          <div className="mt-6 pt-6 border-t border-border/50 text-center">
            <Link href="/login" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1"><ArrowLeft className="h-3 w-3" /> العودة لتسجيل الدخول</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
