"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import {
  Shield,
  ShieldCheck,
  ShieldOff,
  QrCode,
  Key,
  Copy,
  Download,
  AlertTriangle,
  CheckCircle,
  Loader2,
} from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

interface User {
  id: number;
  email: string;
  username: string;
  two_fa_enabled: boolean;
  email_verified: boolean;
}

export default function SecurityPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // 2FA Setup State
  const [setupStep, setSetupStep] = useState<"idle" | "setup" | "verify" | "backup">("idle");
  const [totpSecret, setTotpSecret] = useState("");
  const [otpauthUrl, setOtpauthUrl] = useState("");
  const [verifyCode, setVerifyCode] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [setupLoading, setSetupLoading] = useState(false);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const qrRef = useRef<HTMLDivElement>(null);

  // Disable 2FA State
  const [showDisable, setShowDisable] = useState(false);
  const [disablePassword, setDisablePassword] = useState("");
  const [disableCode, setDisableCode] = useState("");
  const [disableLoading, setDisableLoading] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login");
      return;
    }

    const userData = localStorage.getItem("user");
    if (userData) {
      try {
        setUser(JSON.parse(userData));
      } catch {
        router.push("/login");
        return;
      }
    }
    setLoading(false);
  }, [router]);

  const authHeaders = () => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${localStorage.getItem("token")}`,
  });

  // --- 2FA Setup Flow ---
  const handleSetup2FA = async () => {
    setSetupLoading(true);
    try {
      const res = await fetch(`${API}/api/auth/setup-2fa`, {
        method: "POST",
        headers: authHeaders(),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "فشل إعداد المصادقة الثنائية");
        return;
      }
      setTotpSecret(data.secret);
      setOtpauthUrl(data.otpauth_url);
      setSetupStep("setup");
    } catch {
      toast.error("حدث خطأ في الاتصال");
    } finally {
      setSetupLoading(false);
    }
  };

  const handleVerify2FA = async () => {
    if (verifyCode.length !== 6) {
      toast.error("يجب إدخال 6 أرقام");
      return;
    }
    setVerifyLoading(true);
    try {
      const res = await fetch(`${API}/api/auth/enable-2fa`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ code: verifyCode }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "رمز التحقق غير صحيح");
        return;
      }
      setBackupCodes(data.backup_codes || []);
      setSetupStep("backup");

      // Update local user data
      if (user) {
        const updatedUser = { ...user, two_fa_enabled: true };
        setUser(updatedUser);
        localStorage.setItem("user", JSON.stringify(updatedUser));
      }

      toast.success(data.message || "تم تفعيل المصادقة الثنائية بنجاح!");
    } catch {
      toast.error("حدث خطأ في الاتصال");
    } finally {
      setVerifyLoading(false);
    }
  };

  const handleDisable2FA = async () => {
    if (!disablePassword || !disableCode) {
      toast.error("يجب إدخال كلمة المرور ورمز التحقق");
      return;
    }
    setDisableLoading(true);
    try {
      const res = await fetch(`${API}/api/auth/disable-2fa`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ password: disablePassword, code: disableCode }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "فشل تعطيل المصادقة الثنائية");
        return;
      }

      if (user) {
        const updatedUser = { ...user, two_fa_enabled: false };
        setUser(updatedUser);
        localStorage.setItem("user", JSON.stringify(updatedUser));
      }

      setShowDisable(false);
      setDisablePassword("");
      setDisableCode("");
      setSetupStep("idle");
      toast.success(data.message || "تم تعطيل المصادقة الثنائية");
    } catch {
      toast.error("حدث خطأ في الاتصال");
    } finally {
      setDisableLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("تم النسخ");
  };

  const downloadBackupCodes = () => {
    const content = `EgMoney - رموز الاحتياط للمصادقة الثنائية\nتاريخ الإنشاء: ${new Date().toLocaleDateString("ar-EG")}\n\n${backupCodes.map((c, i) => `${i + 1}. ${c}`).join("\n")}\n\n⚠️ احفظ هذه الرموز في مكان آمن. كل رمز يُستخدم مرة واحدة فقط.\nإذا فقدت الوصول لتطبيق المصادقة، يمكنك استخدام هذه الرموز لتسجيل الدخول.`;
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "egmoney-backup-codes.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-3">
          <Shield className="h-7 w-7 text-emerald-500" />
          الأمان والحماية
        </h1>
        <p className="text-muted-foreground mt-1">إدارة إعدادات أمان حسابك</p>
      </div>

      {/* Email Verification Status */}
      <div className="glass-panel rounded-2xl p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {user.email_verified ? (
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                <CheckCircle className="h-5 w-5 text-emerald-500" />
              </div>
            ) : (
              <div className="w-10 h-10 rounded-xl bg-yellow-500/10 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-yellow-500" />
              </div>
            )}
            <div>
              <h3 className="font-semibold">تأكيد البريد الإلكتروني</h3>
              <p className="text-sm text-muted-foreground">{user.email}</p>
            </div>
          </div>
          <span
            className={`text-sm px-3 py-1 rounded-full ${
              user.email_verified
                ? "bg-emerald-500/10 text-emerald-500"
                : "bg-yellow-500/10 text-yellow-500"
            }`}
          >
            {user.email_verified ? "مؤكد" : "غير مؤكد"}
          </span>
        </div>
      </div>

      {/* Two-Factor Authentication */}
      <div className="glass-panel rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
            {user.two_fa_enabled ? (
              <ShieldCheck className="h-5 w-5 text-blue-500" />
            ) : (
              <ShieldOff className="h-5 w-5 text-muted-foreground" />
            )}
          </div>
          <div>
            <h3 className="font-semibold">المصادقة الثنائية (2FA)</h3>
            <p className="text-sm text-muted-foreground">
              طبقة حماية إضافية لحسابك
            </p>
          </div>
          <span
            className={`text-sm px-3 py-1 rounded-full mr-auto ${
              user.two_fa_enabled
                ? "bg-emerald-500/10 text-emerald-500"
                : "bg-red-500/10 text-red-400"
            }`}
          >
            {user.two_fa_enabled ? "مفعلة" : "غير مفعلة"}
          </span>
        </div>

        {/* 2FA is NOT enabled - Show setup flow */}
        {!user.two_fa_enabled && setupStep === "idle" && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/10">
              <p className="text-sm text-muted-foreground leading-relaxed">
                المصادقة الثنائية تضيف طبقة حماية إضافية لحسابك. عند تفعيلها،
                سيُطلب منك إدخال رمز تحقق من تطبيق المصادقة (مثل Google
                Authenticator أو Authy) عند كل تسجيل دخول.
              </p>
            </div>
            <button
              onClick={handleSetup2FA}
              disabled={setupLoading}
              className="btn-primary gap-2"
            >
              {setupLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Shield className="h-4 w-4" />
              )}
              إعداد المصادقة الثنائية
            </button>
          </div>
        )}

        {/* Step 1: Show QR Code */}
        {setupStep === "setup" && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-yellow-500/5 border border-yellow-500/10">
              <p className="text-sm text-yellow-500 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                امسح رمز QR بتطبيق المصادقة أولاً، ثم أدخل الكود أدناه
              </p>
            </div>

            {/* QR Code - using external QR API */}
            <div className="flex justify-center">
              <div
                ref={qrRef}
                className="bg-white rounded-2xl p-4 inline-block"
              >
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(otpauthUrl)}`}
                  alt="2FA QR Code"
                  width={200}
                  height={200}
                  className="rounded-lg"
                />
              </div>
            </div>

            {/* Manual Entry */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-muted-foreground text-center">
                أو أدخل المفتاح يدوياً
              </label>
              <div className="flex items-center gap-2">
                <code
                  className="flex-1 bg-background/50 border border-border/50 rounded-lg px-3 py-2 text-sm font-mono text-center tracking-wider break-all"
                  dir="ltr"
                >
                  {totpSecret}
                </code>
                <button
                  onClick={() => copyToClipboard(totpSecret)}
                  className="btn-ghost shrink-0"
                >
                  <Copy className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Verify Code Input */}
            <div className="space-y-2">
              <label className="block text-sm font-medium">
                أدخل رمز التحقق من تطبيق المصادقة
              </label>
              <input
                type="text"
                className="input-field text-center text-2xl tracking-[0.5em] font-mono"
                placeholder="000000"
                value={verifyCode}
                onChange={(e) =>
                  setVerifyCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
                maxLength={6}
                dir="ltr"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setSetupStep("idle");
                  setVerifyCode("");
                }}
                className="btn-ghost flex-1"
              >
                إلغاء
              </button>
              <button
                onClick={handleVerify2FA}
                disabled={verifyLoading || verifyCode.length !== 6}
                className="btn-primary flex-1 gap-2"
              >
                {verifyLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle className="h-4 w-4" />
                )}
                تفعيل
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Show Backup Codes */}
        {setupStep === "backup" && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/10">
              <p className="text-sm text-red-400 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                احفظ رموز الاحتياط في مكان آمن! لن تظهر مرة أخرى. يمكنك
                استخدامها لتسجيل الدخول إذا فقدت الوصول لتطبيق المصادقة.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {backupCodes.map((code, i) => (
                <div
                  key={i}
                  className="bg-background/50 border border-border/50 rounded-lg px-3 py-2 text-center font-mono text-sm tracking-wider"
                  dir="ltr"
                >
                  {code}
                </div>
              ))}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => copyToClipboard(backupCodes.join("\n"))}
                className="btn-ghost flex-1 gap-2"
              >
                <Copy className="h-4 w-4" />
                نسخ الكل
              </button>
              <button
                onClick={downloadBackupCodes}
                className="btn-primary flex-1 gap-2"
              >
                <Download className="h-4 w-4" />
                تحميل
              </button>
            </div>

            <button
              onClick={() => setSetupStep("idle")}
              className="btn-primary w-full"
            >
              لقد حفظت رموز الاحتياط - متابعة
            </button>
          </div>
        )}

        {/* 2FA IS enabled - Show disable option */}
        {user.two_fa_enabled && !showDisable && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/10">
              <p className="text-sm text-emerald-400 flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 shrink-0" />
                المصادقة الثنائية مُفعلة على حسابك. سيُطلب منك رمز التحقق عند
                كل تسجيل دخول.
              </p>
            </div>
            <button
              onClick={() => setShowDisable(true)}
              className="btn-ghost gap-2 text-red-400 hover:text-red-300 hover:bg-red-500/10"
            >
              <ShieldOff className="h-4 w-4" />
              تعطيل المصادقة الثنائية
            </button>
          </div>
        )}

        {/* Disable 2FA Form */}
        {user.two_fa_enabled && showDisable && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/10">
              <p className="text-sm text-red-400 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                تعطيل المصادقة الثنائية يقلل أمان حسابك. سيُطلب منك كلمة المرور
                ورمز التحقق لتأكيد التعطيل.
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">
                كلمة المرور
              </label>
              <input
                type="password"
                className="input-field"
                placeholder="أدخل كلمة المرور"
                value={disablePassword}
                onChange={(e) => setDisablePassword(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">
                رمز التحقق (TOTP أو رمز احتياط)
              </label>
              <input
                type="text"
                className="input-field text-center text-xl tracking-[0.3em] font-mono"
                placeholder="أدخل الرمز"
                value={disableCode}
                onChange={(e) => setDisableCode(e.target.value.toUpperCase())}
                dir="ltr"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowDisable(false);
                  setDisablePassword("");
                  setDisableCode("");
                }}
                className="btn-ghost flex-1"
              >
                إلغاء
              </button>
              <button
                onClick={handleDisable2FA}
                disabled={
                  disableLoading || !disablePassword || !disableCode
                }
                className="flex-1 gap-2 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-50 inline-flex items-center justify-center"
              >
                {disableLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ShieldOff className="h-4 w-4" />
                )}
                تعطيل المصادقة الثنائية
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Security Tips */}
      <div className="glass-panel rounded-2xl p-6">
        <h3 className="font-semibold mb-3 flex items-center gap-2">
          <Key className="h-5 w-5 text-emerald-500" />
          نصائح أمنية
        </h3>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li className="flex items-start gap-2">
            <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
            استخدم كلمة مرور قوية وفريدة لحسابك
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
            فعّل المصادقة الثنائية لحماية إضافية
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
            احفظ رموز الاحتياط في مكان آمن خارج الإنترنت
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
            لا تشارك رمز التحقق أو رموز الاحتياط مع أي شخص
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
            تحقق من نشاط حسابك بانتظام من خلال سجل التدقيق
          </li>
        </ul>
      </div>
    </div>
  );
}
