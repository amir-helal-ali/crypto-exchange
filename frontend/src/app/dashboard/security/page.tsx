"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import QRCode from "qrcode";
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
  Monitor,
  Smartphone,
  Trash2,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ShieldAlert,
  Lightbulb,
  Globe,
  Chrome,
} from "lucide-react";
import { authGet, authPost } from "@/lib/api";

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
  const [qrDataUrl, setQrDataUrl] = useState("");
  const qrRef = useRef<HTMLDivElement>(null);

  // Disable 2FA State
  const [showDisable, setShowDisable] = useState(false);
  const [disablePassword, setDisablePassword] = useState("");
  const [disableCode, setDisableCode] = useState("");
  const [disableLoading, setDisableLoading] = useState(false);
  const [showDisablePwd, setShowDisablePwd] = useState(false);

  // Sessions State
  const [sessions, setSessions] = useState<any[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);

  // Copied states
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [copiedCodes, setCopiedCodes] = useState(false);

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
    fetchSessions();
  }, [router]);

  const fetchSessions = async () => {
    setSessionsLoading(true);
    try {
      const res = await authGet("/api/v1/auth/sessions");
      if (res.ok) {
        const data = await res.json();
        setSessions(data.data || []);
      }
    } catch {
      // Silently fail
    } finally {
      setSessionsLoading(false);
    }
  };

  const handleRevokeSession = async (sessionId: number) => {
    try {
      const res = await authPost(`/api/v1/auth/sessions/${sessionId}/revoke`);
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "فشل إنهاء الجلسة");
        return;
      }
      toast.success(data.message || "تم إنهاء الجلسة");
      fetchSessions();
    } catch {
      toast.error("حدث خطأ في الاتصال");
    }
  };

  // --- 2FA Setup Flow ---
  const handleSetup2FA = async () => {
    setSetupLoading(true);
    try {
      const res = await authPost("/api/v1/auth/setup-2fa");
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "فشل إعداد المصادقة الثنائية");
        return;
      }
      setTotpSecret(data.secret);
      setOtpauthUrl(data.otpauth_url);
      setSetupStep("setup");
      // Generate QR code locally (security: never send TOTP secret to external service)
      try {
        const dataUrl = await QRCode.toDataURL(data.otpauth_url, {
          width: 200,
          margin: 2,
          color: { dark: "#000000", light: "#ffffff" },
        });
        setQrDataUrl(dataUrl);
      } catch {
        // Fallback: the URL is still available for manual entry
        setQrDataUrl("");
      }
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
      const res = await authPost("/api/v1/auth/enable-2fa", { code: verifyCode });
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
      const res = await authPost("/api/v1/auth/disable-2fa", { password: disablePassword, code: disableCode });
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

  const copyToClipboard = (text: string, type: "secret" | "codes") => {
    navigator.clipboard.writeText(text);
    if (type === "secret") {
      setCopiedSecret(true);
      setTimeout(() => setCopiedSecret(false), 2000);
    } else {
      setCopiedCodes(true);
      setTimeout(() => setCopiedCodes(false), 2000);
    }
    toast.success("تم النسخ");
  };

  const downloadBackupCodes = () => {
    const content = `EgMoney - رموز الاحتياط للمصادقة الثنائية
تاريخ الإنشاء: ${new Date().toLocaleDateString("ar-EG")}

${backupCodes.map((c, i) => `${i + 1}. ${c}`).join("\n")}

⚠️ احفظ هذه الرموز في مكان آمن. كل رمز يُستخدم مرة واحدة فقط.
إذا فقدت الوصول لتطبيق المصادقة، يمكنك استخدام هذه الرموز لتسجيل الدخول.`;
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "egmoney-backup-codes.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  const extractBrowser = (ua: string) => {
    if (!ua) return "متصفح";
    if (ua.includes("Edg/")) return "Edge";
    if (ua.includes("OPR/") || ua.includes("Opera")) return "Opera";
    if (ua.includes("Chrome/")) return "Chrome";
    if (ua.includes("Firefox/")) return "Firefox";
    if (ua.includes("Safari/") && !ua.includes("Chrome")) return "Safari";
    return "متصفح";
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
    <div className="space-y-6 max-w-3xl">
      {/* ── Page Header ── */}
      <div className="animate-slide-in-up">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <Shield className="h-5 w-5 text-white" />
          </div>
          الأمان والحماية
        </h1>
        <p className="text-muted-foreground mt-2 text-sm">إدارة إعدادات أمان حسابك</p>
      </div>

      {/* ── Email Verification Status ── */}
      <div
        className="glass-panel rounded-2xl p-5 animate-slide-in-up"
        style={{ animationDelay: "80ms", animationFillMode: "both" }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div
              className={`h-11 w-11 rounded-xl flex items-center justify-center ${
                user.email_verified ? "bg-emerald-500/10" : "bg-yellow-500/10"
              }`}
            >
              {user.email_verified ? (
                <Mail className="h-5 w-5 text-emerald-500" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-yellow-500" />
              )}
            </div>
            <div>
              <h3 className="font-bold text-base">تأكيد البريد الإلكتروني</h3>
              <p className="text-sm text-muted-foreground mt-0.5">{user.email}</p>
            </div>
          </div>
          <span
            className={`text-xs px-3 py-1.5 rounded-full font-medium ${
              user.email_verified
                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                : "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20"
            }`}
          >
            {user.email_verified ? "مؤكد ✓" : "غير مؤكد"}
          </span>
        </div>
      </div>

      {/* ── Two-Factor Authentication ── */}
      <div
        className="glass-panel rounded-2xl overflow-hidden animate-slide-in-up"
        style={{ animationDelay: "160ms", animationFillMode: "both" }}
      >
        {/* 2FA Card Header */}
        <div className="p-5 border-b border-border/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div
                className={`h-11 w-11 rounded-xl flex items-center justify-center ${
                  user.two_fa_enabled ? "bg-emerald-500/10" : "bg-primary/10"
                }`}
              >
                {user.two_fa_enabled ? (
                  <ShieldCheck className="h-5 w-5 text-emerald-500" />
                ) : (
                  <ShieldOff className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
              <div>
                <h3 className="font-bold text-base">المصادقة الثنائية (2FA)</h3>
                <p className="text-xs text-muted-foreground mt-0.5">طبقة حماية إضافية لحسابك</p>
              </div>
            </div>
            <span
              className={`text-xs px-3 py-1.5 rounded-full font-medium ${
                user.two_fa_enabled
                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                  : "bg-red-500/10 text-red-400 border border-red-500/20"
              }`}
            >
              {user.two_fa_enabled ? "مفعلة" : "غير مفعلة"}
            </span>
          </div>
        </div>

        <div className="p-5">
          {/* 2FA is NOT enabled - Show setup flow */}
          {!user.two_fa_enabled && setupStep === "idle" && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/15 flex items-start gap-3">
                <Shield className="h-5 w-5 text-blue-400 shrink-0 mt-0.5" />
                <p className="text-sm text-muted-foreground leading-relaxed">
                  المصادقة الثنائية تضيف طبقة حماية إضافية لحسابك. عند تفعيلها، سيُطلب منك إدخال رمز تحقق من تطبيق المصادقة (مثل Google Authenticator أو Authy) عند كل تسجيل دخول.
                </p>
              </div>
              <button onClick={handleSetup2FA} disabled={setupLoading} className="btn-primary gap-2 min-w-[180px]">
                {setupLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}
                إعداد المصادقة الثنائية
              </button>
            </div>
          )}

          {/* Step: Show QR Code */}
          {setupStep === "setup" && (
            <div className="space-y-5 animate-scale-in">
              {/* Step indicator */}
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="h-6 w-6 rounded-full bg-emerald-500 text-white text-xs flex items-center justify-center font-bold">1</span>
                  <span className="text-xs font-medium text-emerald-400">مسح الرمز</span>
                </div>
                <div className="h-px flex-1 bg-border/50" />
                <div className="flex items-center gap-1.5">
                  <span className="h-6 w-6 rounded-full bg-muted/50 text-muted-foreground text-xs flex items-center justify-center font-bold">2</span>
                  <span className="text-xs font-medium text-muted-foreground">التحقق</span>
                </div>
                <div className="h-px flex-1 bg-border/50" />
                <div className="flex items-center gap-1.5">
                  <span className="h-6 w-6 rounded-full bg-muted/50 text-muted-foreground text-xs flex items-center justify-center font-bold">3</span>
                  <span className="text-xs font-medium text-muted-foreground">رموز الاحتياط</span>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-yellow-500/5 border border-yellow-500/15 flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-yellow-500 shrink-0 mt-0.5" />
                <p className="text-sm text-muted-foreground leading-relaxed">
                  امسح رمز QR بتطبيق المصادقة أولاً، ثم أدخل الكود أدناه
                </p>
              </div>

              {/* QR Code */}
              <div className="flex justify-center">
                <div ref={qrRef} className="bg-white rounded-2xl p-4 inline-block shadow-xl">
                  {qrDataUrl ? (
                    <img src={qrDataUrl} alt="2FA QR Code" width={200} height={200} className="rounded-lg" />
                  ) : (
                    <QrCode className="h-[200px] w-[200px] text-gray-300" />
                  )}
                </div>
              </div>

              {/* Manual Entry */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-muted-foreground text-center">أو أدخل المفتاح يدوياً</label>
                <div className="flex items-center gap-2">
                  <code
                    className="flex-1 bg-background/50 border border-border/50 rounded-xl px-4 py-2.5 text-sm font-mono text-center tracking-wider break-all"
                    dir="ltr"
                  >
                    {totpSecret}
                  </code>
                  <button
                    onClick={() => copyToClipboard(totpSecret, "secret")}
                    className={`h-10 w-10 rounded-xl flex items-center justify-center border transition-all shrink-0 ${
                      copiedSecret
                        ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500"
                        : "border-border/50 text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                    }`}
                  >
                    {copiedSecret ? <CheckCircle className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Verify Code Input */}
              <div className="space-y-2">
                <label className="block text-sm font-medium">أدخل رمز التحقق من تطبيق المصادقة</label>
                <input
                  type="text"
                  className="input-field text-center text-2xl tracking-[0.5em] font-mono"
                  placeholder="000000"
                  value={verifyCode}
                  onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
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
                  {verifyLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                  تفعيل
                </button>
              </div>
            </div>
          )}

          {/* Step: Show Backup Codes */}
          {setupStep === "backup" && (
            <div className="space-y-5 animate-scale-in">
              {/* Step indicator */}
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="h-6 w-6 rounded-full bg-emerald-500 text-white text-xs flex items-center justify-center font-bold">1</span>
                  <span className="text-xs font-medium text-emerald-400">مسح الرمز</span>
                </div>
                <div className="h-px flex-1 bg-emerald-500/30" />
                <div className="flex items-center gap-1.5">
                  <span className="h-6 w-6 rounded-full bg-emerald-500 text-white text-xs flex items-center justify-center font-bold">2</span>
                  <span className="text-xs font-medium text-emerald-400">التحقق</span>
                </div>
                <div className="h-px flex-1 bg-emerald-500/30" />
                <div className="flex items-center gap-1.5">
                  <span className="h-6 w-6 rounded-full bg-emerald-500 text-white text-xs flex items-center justify-center font-bold">3</span>
                  <span className="text-xs font-medium text-emerald-400">رموز الاحتياط</span>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/15 flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
                <p className="text-sm text-muted-foreground leading-relaxed">
                  احفظ رموز الاحتياط في مكان آمن! لن تظهر مرة أخرى. يمكنك استخدامها لتسجيل الدخول إذا فقدت الوصول لتطبيق المصادقة.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {backupCodes.map((code, i) => (
                  <div
                    key={i}
                    className="bg-background/50 border border-border/40 rounded-xl px-4 py-2.5 text-center font-mono text-sm tracking-wider"
                    dir="ltr"
                  >
                    {code}
                  </div>
                ))}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    copyToClipboard(backupCodes.join("\n"), "codes");
                  }}
                  className={`btn-ghost flex-1 gap-2 ${copiedCodes ? "text-emerald-500" : ""}`}
                >
                  {copiedCodes ? <CheckCircle className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copiedCodes ? "تم النسخ" : "نسخ الكل"}
                </button>
                <button onClick={downloadBackupCodes} className="btn-primary flex-1 gap-2">
                  <Download className="h-4 w-4" />
                  تحميل
                </button>
              </div>

              <button onClick={() => setSetupStep("idle")} className="btn-primary w-full">
                لقد حفظت رموز الاحتياط - متابعة
              </button>
            </div>
          )}

          {/* 2FA IS enabled - Show disable option */}
          {user.two_fa_enabled && !showDisable && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/15 flex items-start gap-3">
                <ShieldCheck className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
                <p className="text-sm text-muted-foreground leading-relaxed">
                  المصادقة الثنائية مُفعلة على حسابك. سيُطلب منك رمز التحقق عند كل تسجيل دخول.
                </p>
              </div>
              <button
                onClick={() => setShowDisable(true)}
                className="btn-danger gap-2"
              >
                <ShieldOff className="h-4 w-4" />
                تعطيل المصادقة الثنائية
              </button>
            </div>
          )}

          {/* Disable 2FA Form */}
          {user.two_fa_enabled && showDisable && (
            <div className="space-y-5 animate-scale-in">
              <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/15 flex items-start gap-3">
                <ShieldAlert className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
                <p className="text-sm text-muted-foreground leading-relaxed">
                  تعطيل المصادقة الثنائية يقلل أمان حسابك. سيُطلب منك كلمة المرور ورمز التحقق لتأكيد التعطيل.
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 text-muted-foreground">كلمة المرور</label>
                <div className="relative">
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <Lock className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <input
                    type={showDisablePwd ? "text" : "password"}
                    className="input-field pr-10 pl-10"
                    placeholder="أدخل كلمة المرور"
                    value={disablePassword}
                    onChange={(e) => setDisablePassword(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowDisablePwd(!showDisablePwd)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showDisablePwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 text-muted-foreground">رمز التحقق (TOTP أو رمز احتياط)</label>
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
                  disabled={disableLoading || !disablePassword || !disableCode}
                  className="btn-danger flex-1 gap-2"
                >
                  {disableLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldOff className="h-4 w-4" />}
                  تعطيل المصادقة الثنائية
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Active Sessions ── */}
      <div
        className="glass-panel rounded-2xl overflow-hidden animate-slide-in-up"
        style={{ animationDelay: "240ms", animationFillMode: "both" }}
      >
        <div className="p-5 border-b border-border/30">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Monitor className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-bold text-base">الجلسات النشطة</h3>
              <p className="text-xs text-muted-foreground mt-0.5">الأجهزة التي سجلت الدخول منها</p>
            </div>
          </div>
        </div>

        <div className="p-4">
          {sessionsLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
            </div>
          ) : sessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="h-14 w-14 rounded-2xl bg-muted/30 flex items-center justify-center mb-3">
                <Monitor className="h-7 w-7 text-muted-foreground/40" />
              </div>
              <p className="text-sm text-muted-foreground">لا توجد جلسات نشطة</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {sessions.map((session: any) => {
                const isMobile = /mobile|android|iphone/i.test(session.user_agent || "");
                const DeviceIcon = isMobile ? Smartphone : Monitor;
                const browser = extractBrowser(session.user_agent || "");
                const isCurrent = session.ip_address === "current";

                return (
                  <div
                    key={session.id}
                    className="flex items-center gap-3 p-3.5 rounded-xl bg-background/30 border border-border/30 hover:bg-muted/10 transition-colors"
                  >
                    <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${isMobile ? "bg-purple-500/10" : "bg-blue-500/10"}`}>
                      <DeviceIcon className={`h-5 w-5 ${isMobile ? "text-purple-400" : "text-blue-400"}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5">
                          <Chrome className="h-3.5 w-3.5 text-muted-foreground" />
                          <p className="text-sm font-medium truncate">{browser}</p>
                        </div>
                        {isCurrent && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                            الجلسة الحالية
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Globe className="h-3 w-3 text-muted-foreground" />
                        <p className="text-xs text-muted-foreground truncate" dir="ltr">
                          {session.ip_address} · {new Date(session.created_at).toLocaleDateString("ar-EG", { year: "numeric", month: "short", day: "numeric" })}
                        </p>
                      </div>
                    </div>
                    {!isCurrent && (
                      <button
                        onClick={() => handleRevokeSession(session.id)}
                        className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors shrink-0 border border-transparent hover:border-red-500/20"
                        title="إنهاء الجلسة"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Security Tips ── */}
      <div
        className="glass-panel rounded-2xl p-5 animate-slide-in-up"
        style={{ animationDelay: "320ms", animationFillMode: "both" }}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="h-10 w-10 rounded-xl bg-yellow-500/10 flex items-center justify-center">
            <Lightbulb className="h-5 w-5 text-yellow-500" />
          </div>
          <div>
            <h3 className="font-bold text-base">نصائح أمنية</h3>
            <p className="text-xs text-muted-foreground mt-0.5">إرشادات لحماية حسابك</p>
          </div>
        </div>

        <div className="space-y-3">
          {[
            { text: "استخدم كلمة مرور قوية وفريدة لحسابك", done: true },
            { text: "فعّل المصادقة الثنائية لحماية إضافية", done: user.two_fa_enabled },
            { text: "احفظ رموز الاحتياط في مكان آمن خارج الإنترنت", done: user.two_fa_enabled },
            { text: "لا تشارك رمز التحقق أو رموز الاحتياط مع أي شخص", done: true },
            { text: "تحقق من نشاط حسابك بانتظام من خلال سجل التدقيق", done: false },
          ].map((tip, i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-background/30 border border-border/20">
              <div
                className={`h-6 w-6 rounded-full flex items-center justify-center shrink-0 ${
                  tip.done ? "bg-emerald-500/10" : "bg-muted/30"
                }`}
              >
                <CheckCircle className={`h-4 w-4 ${tip.done ? "text-emerald-500" : "text-muted-foreground/40"}`} />
              </div>
              <p className={`text-sm ${tip.done ? "text-foreground" : "text-muted-foreground"}`}>{tip.text}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
