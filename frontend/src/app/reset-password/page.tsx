"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Lock, CheckCircle2, AlertCircle } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

export default function ResetPasswordPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) {
      setError("رابط إعادة التعيين غير صالح. لا يوجد رمز توثيق.");
    }
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("كلمة المرور غير متطابقة");
      return;
    }
    if (password.length < 6) {
      setError("كلمة المرور يجب أن تكون 6 أحرف على الأقل");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API}/api/auth/reset-password`, {
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

  if (!token && error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <div className="glass-panel-strong rounded-3xl p-8 max-w-md w-full text-center">
          <div className="inline-flex p-3 rounded-2xl bg-red-500/10 mb-4"><AlertCircle className="h-8 w-8 text-red-500" /></div>
          <h1 className="text-2xl font-bold mb-2">رابط غير صالح</h1>
          <p className="text-sm text-muted-foreground mb-6">{error}</p>
          <Link href="/forgot-password" className="btn-primary">طلب رابط جديد</Link>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <div className="glass-panel-strong rounded-3xl p-8 max-w-md w-full text-center">
          <div className="inline-flex p-3 rounded-2xl bg-emerald-500/10 mb-4"><CheckCircle2 className="h-8 w-8 text-emerald-500" /></div>
          <h1 className="text-2xl font-bold mb-2">تم إعادة التعيين!</h1>
          <p className="text-sm text-muted-foreground mb-6">تم إعادة تعيين كلمة المرور بنجاح. جاري التحويل إلى صفحة الدخول...</p>
          <Link href="/login" className="btn-primary">تسجيل الدخول</Link>
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
            <h1 className="text-2xl font-bold">تعيين كلمة مرور جديدة</h1>
            <p className="text-sm text-muted-foreground mt-1">أدخل كلمة المرور الجديدة أدناه</p>
          </div>
          {error && <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm mb-4">{error}</div>}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">كلمة المرور الجديدة</label>
              <input type="password" className="input-field" placeholder="أدخل كلمة المرور الجديدة" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">تأكيد كلمة المرور</label>
              <input type="password" className="input-field" placeholder="أعد كتابة كلمة المرور" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required minLength={6} />
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full gap-2">
              {loading ? <span className="spinner h-4 w-4" /> : <Lock className="h-4 w-4" />}
              {loading ? "جاري الحفظ..." : "تعيين كلمة المرور"}
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
