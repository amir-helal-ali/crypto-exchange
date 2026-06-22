"use client";

import { useEffect, useState, useCallback } from "react";
import toast from "react-hot-toast";
import {
  Lock,
  Unlock,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Plus,
  RefreshCw,
  Upload,
  Globe,
  Server,
  Zap,
  FileText,
  Calendar,
  Building2,
  Hash,
  KeyRound,
  Loader2,
  Info,
  Rocket,
  Sparkles,
  Eye,
  EyeOff,
  X,
} from "lucide-react";
import { authGet, authPost } from "@/lib/api";
import { ConfirmDialog } from "@/components/ui";

interface SSLStatus {
  enabled: boolean;
  type: string; // "local" | "letsencrypt" | "custom" | "unknown"
  issuer: string;
  issuer_org?: string;
  cert_path: string;
  key_path: string;
  domains: string;
  email?: string;
  generated_at: string;
  exists: boolean;
  subject?: string;
  not_before?: string;
  not_after?: string;
  expires_at?: string;
  days_remaining?: number;
  health?: "healthy" | "warning" | "critical" | "expired";
  sans?: string[];
  key_algorithm?: string;
  signature_algorithm?: string;
  serial_number?: string;
  key_exists?: boolean;
  error?: string;
  ssl_staging?: boolean;
}

type GenerateMode = "local" | "letsencrypt";

export default function SSLTab({
  editValues,
  changedKeys,
  onSSLChanged,
}: {
  editValues: Record<string, string>;
  changedKeys: Set<string>;
  onSSLChanged: () => void;
}) {
  const [status, setStatus] = useState<SSLStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [renewing, setRenewing] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const [showInstall, setShowInstall] = useState(false);
  const [confirmRegen, setConfirmRegen] = useState<null | (() => void)>(null);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authGet("/api/v1/admin/ssl/status");
      if (res.ok) {
        const data = await res.json();
        setStatus(data.data || null);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const handleGenerate = async (mode: GenerateMode, email?: string, staging?: boolean) => {
    setGenerating(true);
    setShowWizard(false);
    try {
      const res = await authPost("/api/v1/admin/ssl/generate", {
        type: mode,
        email: email || undefined,
        staging: staging || false,
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(data.message || "تم توليد الشهادة بنجاح");
        await fetchStatus();
        onSSLChanged();
      } else {
        toast.error(data.error || "فشل توليد الشهادة");
        if (data.output) {
          console.error("Cert generation output:", data.output);
        }
      }
    } catch {
      toast.error("خطأ في الاتصال بالخادم");
    } finally {
      setGenerating(false);
    }
  };

  const handleRenew = async () => {
    setRenewing(true);
    try {
      const res = await authPost("/api/v1/admin/ssl/renew", {});
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(data.message || "تم تجديد الشهادة بنجاح");
        await fetchStatus();
        onSSLChanged();
      } else {
        toast.error(data.error || "فشل التجديد");
      }
    } catch {
      toast.error("خطأ في الاتصال");
    } finally {
      setRenewing(false);
    }
  };

  const handleInstall = async (certPem: string, keyPem: string) => {
    setGenerating(true);
    setShowInstall(false);
    try {
      const res = await authPost("/api/v1/admin/ssl/install", {
        cert_pem: certPem,
        key_pem: keyPem,
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(data.message || "تم تثبيت الشهادة بنجاح");
        await fetchStatus();
        onSSLChanged();
      } else {
        toast.error(data.error || "فشل التثبيت");
      }
    } catch {
      toast.error("خطأ في الاتصال");
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
          <p className="text-sm text-muted-foreground">جاري تحميل حالة الشهادة...</p>
        </div>
      </div>
    );
  }

  const hasCert = status?.exists && status?.key_exists;
  const isExpired = status?.health === "expired";
  const isCritical = status?.health === "critical";
  const isWarning = status?.health === "warning";
  const isHealthy = status?.health === "healthy";

  return (
    <div className="space-y-5">
      {/* Generating overlay */}
      {generating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md">
          <div className="glass-panel-strong rounded-2xl p-8 flex flex-col items-center gap-4 max-w-md">
            <div className="relative">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center border border-primary/20">
                <Lock className="h-8 w-8 text-primary animate-pulse" />
              </div>
              <Loader2 className="absolute -top-1 -right-1 h-5 w-5 animate-spin text-primary" />
            </div>
            <div className="text-center">
              <p className="font-semibold text-foreground">جاري توليد الشهادة...</p>
              <p className="text-xs text-muted-foreground mt-1">
                قد يستغرق هذا من 5 ثوانٍ إلى دقيقتين حسب نوع الشهادة
              </p>
            </div>
            <div className="w-full bg-muted/30 rounded-full h-1 overflow-hidden">
              <div className="h-full bg-gradient-to-l from-emerald-500 to-teal-500 animate-pulse" style={{ width: "60%" }} />
            </div>
          </div>
        </div>
      )}

      {/* ─── Current Certificate Status Card ─── */}
      {hasCert ? (
        <div
          className={`glass-panel rounded-2xl p-6 border-r-2 ${
            isExpired
              ? "border-r-red-500/60"
              : isCritical
              ? "border-r-red-500/60"
              : isWarning
              ? "border-r-yellow-500/60"
              : "border-r-emerald-500/60"
          }`}
        >
          <div className="flex items-start justify-between gap-4 mb-5">
            <div className="flex items-center gap-3">
              <div
                className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                  isExpired || isCritical
                    ? "bg-red-500/10 text-red-400"
                    : isWarning
                    ? "bg-yellow-500/10 text-yellow-400"
                    : "bg-emerald-500/10 text-emerald-400"
                }`}
              >
                {isExpired ? <XCircle className="h-6 w-6" /> : isHealthy ? <CheckCircle2 className="h-6 w-6" /> : <AlertTriangle className="h-6 w-6" />}
              </div>
              <div>
                <h3 className="text-lg font-bold text-foreground">الشهادة الحالية</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {status?.issuer || "—"}
                  {status?.issuer_org && status?.issuer_org !== status?.issuer && ` • ${status.issuer_org}`}
                </p>
              </div>
            </div>
            <HealthBadge health={status?.health} daysRemaining={status?.days_remaining} />
          </div>

          {/* Cert details grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-5">
            <DetailRow icon={<Globe className="h-3.5 w-3.5" />} label="النطاقات (SANs)" value={(status?.sans || []).join("، ") || status?.domains || "—"} dir="ltr" />
            <DetailRow icon={<Building2 className="h-3.5 w-3.5" />} label="النوع" value={getCertTypeLabel(status?.type)} />
            <DetailRow icon={<Calendar className="h-3.5 w-3.5" />} label="تاريخ الانتهاء" value={status?.expires_at || "—"} />
            <DetailRow icon={<Clock className="h-3.5 w-3.5" />} label="الأيام المتبقية" value={`${status?.days_remaining ?? "—"} يوم`} highlight={isWarning || isCritical || isExpired} />
            <DetailRow icon={<Hash className="h-3.5 w-3.5" />} label="الرقم التسلسلي" value={status?.serial_number?.slice(0, 16) + "..." || "—"} dir="ltr" mono />
            <DetailRow icon={<KeyRound className="h-3.5 w-3.5" />} label="خوارزمية المفتاح" value={status?.key_algorithm || "—"} dir="ltr" />
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2 pt-4 border-t border-border/30">
            <button
              onClick={() =>
                setConfirmRegen(() => () => {
                  const mode = (status?.type === "letsencrypt" ? "letsencrypt" : "local") as GenerateMode;
                  handleGenerate(mode, status?.email, status?.ssl_staging);
                })
              }
              className="btn-ghost text-sm gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              إعادة التوليد
            </button>
            {status?.type === "letsencrypt" && (
              <button
                onClick={handleRenew}
                disabled={renewing}
                className="btn-ghost text-sm gap-2"
              >
                {renewing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                تجديد (Renew)
              </button>
            )}
            <button
              onClick={() => setShowInstall(true)}
              className="btn-ghost text-sm gap-2"
            >
              <Upload className="h-4 w-4" />
              تثبيت شهادة موجودة
            </button>
            <button
              onClick={() => setShowWizard(true)}
              className="btn-primary text-sm gap-2 mr-auto"
            >
              <Plus className="h-4 w-4" />
              توليد شهادة جديدة
            </button>
          </div>
        </div>
      ) : (
        /* ─── No Certificate Card ─── */
        <div className="glass-panel rounded-2xl p-8 text-center border-r-2 border-r-yellow-500/60">
          <div className="w-16 h-16 rounded-2xl bg-yellow-500/10 flex items-center justify-center mx-auto mb-4">
            <Unlock className="h-8 w-8 text-yellow-400" />
          </div>
          <h3 className="text-lg font-bold text-foreground mb-1">لا توجد شهادة SSL مُفعّلة</h3>
          <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
            يتم تشفير الاتصال عبر HTTPS باستخدام شهادة SSL. يمكنك توليد شهادة موثوقة بنقرة واحدة — للتنمية المحلية أو للإنتاج.
          </p>
          <div className="flex flex-wrap gap-2 justify-center">
            <button
              onClick={() => setShowWizard(true)}
              className="btn-primary gap-2"
            >
              <Sparkles className="h-4 w-4" />
              توليد شهادة SSL
            </button>
            <button
              onClick={() => setShowInstall(true)}
              className="btn-ghost gap-2"
            >
              <Upload className="h-4 w-4" />
              تثبيت شهادة موجودة
            </button>
          </div>
        </div>
      )}

      {/* ─── Quick info card ─── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <InfoCard
          icon={<Rocket className="h-4 w-4" />}
          title="تنمية محلية"
          description="شهادة موقعة ذاتياً صالحة لمدة سنة. مناسبة للتطوير والاختبار."
          color="emerald"
          onClick={() => handleGenerate("local")}
          disabled={generating}
        />
        <InfoCard
          icon={<ShieldCheck className="h-4 w-4" />}
          title="Let's Encrypt"
          description="شهادة إنتاجية موثوقة في جميع المتصفحات، صالحة لـ 90 يوماً مع تجديد تلقائي."
          color="blue"
          onClick={() => setShowWizard(true)}
          disabled={generating}
        />
        <InfoCard
          icon={<Upload className="h-4 w-4" />}
          title="شهادة مخصصة"
          description="ارفع شهادة من ZeroSSL أو Cloudflare أو CA مدفوع بصيغة PEM."
          color="purple"
          onClick={() => setShowInstall(true)}
          disabled={generating}
        />
      </div>

      {/* ─── How it works ─── */}
      <div className="glass-panel rounded-2xl p-5 bg-blue-500/5 border border-blue-500/20">
        <div className="flex items-start gap-3">
          <Info className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
          <div className="text-xs text-muted-foreground leading-relaxed space-y-2">
            <p className="font-medium text-foreground">كيف يعمل النظام؟</p>
            <p>
              <span className="text-emerald-400 font-medium">للتنمية المحلية:</span> يولّد الـ backend شهادة RSA 2048 موقعة ذاتياً مع SANs لجميع النطاقات المُعدّة. المتصفح سيُظهر تحذيراً (يمكن تجاوله).
            </p>
            <p>
              <span className="text-blue-400 font-medium">للإنتاج (Let's Encrypt):</span> يستخدم النظام certbot مع HTTP-01 challenge عبر nginx. يتطلب نطاقات حقيقية موجّهة لخادمك وبريد إلكتروني لتنبيهات الانتهاء.
            </p>
            <p>
              <span className="text-purple-400 font-medium">شهادة مخصصة:</span> الصق محتوى PEM للشهادة والمفتاح. مفيد لـ ZeroSSL أو Cloudflare Origin CA أو CA مدفوع.
            </p>
            <p className="text-muted-foreground/70 pt-2 border-t border-border/20">
              بعد التوليد، يتم تحديث إعدادات nginx تلقائياً وإعادة تحميله بدون توقف للخدمة.
            </p>
          </div>
        </div>
      </div>

      {/* ─── Wizard Modal ─── */}
      {showWizard && (
        <GenerateWizard
          editValues={editValues}
          onClose={() => setShowWizard(false)}
          onGenerate={handleGenerate}
        />
      )}

      {/* ─── Install Modal ─── */}
      {showInstall && (
        <InstallModal
          onClose={() => setShowInstall(false)}
          onInstall={handleInstall}
        />
      )}

      {/* ─── Confirm regenerate ─── */}
      <ConfirmDialog
        isOpen={!!confirmRegen}
        onClose={() => setConfirmRegen(null)}
        onConfirm={() => {
          confirmRegen?.();
          setConfirmRegen(null);
        }}
        title="تأكيد إعادة توليد الشهادة"
        description={
          <div className="space-y-2">
            <p>سيتم استبدال الشهادة الحالية بشهادة جديدة. قد تنقطع الخدمة لثوانٍ معدودة أثناء إعادة تحميل nginx.</p>
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-2.5 text-xs">
              <span className="text-yellow-400 font-medium">تحذير:</span>{" "}
              <span className="text-muted-foreground">الشهادة الحالية ستحذف ولا يمكن استرجاعها. تأكد من عدم وجود مستخدمين نشطين.</span>
            </div>
          </div>
        }
        confirmLabel="نعم، أعد التوليد"
        destructive
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// GENERATE WIZARD MODAL
// ═══════════════════════════════════════════════════════════════════

function GenerateWizard({
  editValues,
  onClose,
  onGenerate,
}: {
  editValues: Record<string, string>;
  onClose: () => void;
  onGenerate: (mode: GenerateMode, email?: string, staging?: boolean) => void;
}) {
  const [mode, setMode] = useState<GenerateMode | null>(null);
  const [email, setEmail] = useState("");
  const [staging, setStaging] = useState(false);

  const detectedDomains = [
    editValues.main_domain,
    editValues.frontend_domain,
    editValues.backend_domain,
    editValues.admin_domain,
  ].filter(Boolean);

  const hasLocalDomain = detectedDomains.some((d) =>
    [".local", ".localhost", ".test", "localhost", "127.", "192.168."].some((sfx) =>
      d?.toLowerCase().includes(sfx)
    )
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md animate-fade-in" onClick={onClose}>
      <div
        className="relative max-w-2xl w-full mx-4 glass-panel-strong rounded-2xl shadow-2xl animate-scale-in max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border/30 sticky top-0 bg-card/95 backdrop-blur-xl z-10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center border border-primary/20">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <h3 className="text-lg font-bold">توليد شهادة SSL جديدة</h3>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted/20 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Detected domains */}
          <div className="bg-muted/20 rounded-xl p-4">
            <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
              <Globe className="h-3.5 w-3.5" />
              النطاقات المُكتشفة تلقائياً من الإعدادات
            </p>
            <div className="flex flex-wrap gap-1.5">
              {detectedDomains.length === 0 ? (
                <span className="text-xs text-yellow-400">لا توجد نطاقات مُعدّة. اضبط النطاقات في تبويب الدومينات أولاً.</span>
              ) : (
                detectedDomains.map((d, i) => (
                  <span key={i} className="chip chip-info" dir="ltr">
                    {d}
                  </span>
                ))
              )}
            </div>
          </div>

          {/* Mode selection */}
          {!mode && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <button
                onClick={() => setMode("local")}
                className="text-right p-5 rounded-xl border border-border/40 hover:border-emerald-500/40 hover:bg-emerald-500/5 transition-all duration-200 group"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 group-hover:bg-emerald-500/20 transition-colors">
                    <Rocket className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">تنمية محلية</p>
                    <p className="text-[11px] text-muted-foreground">Self-signed • RSA 2048</p>
                  </div>
                </div>
                <ul className="text-xs text-muted-foreground space-y-1">
                  <li className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                    جاهز فوراً (5 ثوانٍ)
                  </li>
                  <li className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                    صالحة لـ 365 يوم
                  </li>
                  <li className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                    تعمل مع .local و localhost
                  </li>
                  <li className="flex items-center gap-1.5 text-yellow-400">
                    <AlertTriangle className="h-3 w-3" />
                    تحذير في المتصفح (يمكن تجاوزه)
                  </li>
                </ul>
              </button>

              <button
                onClick={() => setMode("letsencrypt")}
                className="text-right p-5 rounded-xl border border-border/40 hover:border-blue-500/40 hover:bg-blue-500/5 transition-all duration-200 group"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400 group-hover:bg-blue-500/20 transition-colors">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">Let's Encrypt</p>
                    <p className="text-[11px] text-muted-foreground">إنتاجي • موثوق عالمياً</p>
                  </div>
                </div>
                <ul className="text-xs text-muted-foreground space-y-1">
                  <li className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                    موثوق في جميع المتصفحات
                  </li>
                  <li className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                    صالحة لـ 90 يوم + تجديد تلقائي
                  </li>
                  <li className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                    مجاني تماماً
                  </li>
                  <li className="flex items-center gap-1.5 text-yellow-400">
                    <AlertTriangle className="h-3 w-3" />
                    يتطلب نطاقات حقيقية + Port 80
                  </li>
                </ul>
              </button>
            </div>
          )}

          {/* Mode-specific form */}
          {mode === "local" && (
            <div className="space-y-4 animate-fade-in">
              {hasLocalDomain && (
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-emerald-300">
                    تم اكتشاف نطاقات محلية — هذا النوع مناسب لك. اضغط "توليد الآن" للمتابعة.
                  </p>
                </div>
              )}
              <div className="flex justify-end gap-2">
                <button onClick={() => setMode(null)} className="btn-ghost text-sm">
                  رجوع
                </button>
                <button onClick={() => onGenerate("local")} className="btn-primary gap-2">
                  <Rocket className="h-4 w-4" />
                  توليد الآن
                </button>
              </div>
            </div>
          )}

          {mode === "letsencrypt" && (
            <div className="space-y-4 animate-fade-in">
              {hasLocalDomain && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 flex items-start gap-2">
                  <XCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-red-300">
                    تم اكتشاف نطاقات محلية (.local / localhost). Let's Encrypt لا يمكنه إصدار شهادات لها. استخدم "تنمية محلية" بدلاً من ذلك، أو عدّل النطاقات لتكون حقيقية.
                  </p>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  البريد الإلكتروني <span className="text-red-400">*</span>
                </label>
                <p className="text-xs text-muted-foreground mb-2">
                  يُستخدم لتنبيهات انتهاء الشهادة من Let's Encrypt.
                </p>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@example.com"
                  className="input-field"
                  dir="ltr"
                  required
                />
              </div>
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={staging}
                  onChange={(e) => setStaging(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-border accent-primary"
                />
                <div>
                  <p className="text-sm font-medium text-foreground">استخدام بيئة الاختبار (Staging)</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    يُصدر شهادة من بيئة اختبار Let's Encrypt (غير موثوقة في المتصفح). مفيد للاختبار بدون استهلاك حد المعدل.
                  </p>
                </div>
              </label>
              <div className="flex justify-end gap-2">
                <button onClick={() => setMode(null)} className="btn-ghost text-sm">
                  رجوع
                </button>
                <button
                  onClick={() => onGenerate("letsencrypt", email, staging)}
                  disabled={!email || hasLocalDomain}
                  className="btn-primary gap-2 disabled:opacity-50"
                >
                  <ShieldCheck className="h-4 w-4" />
                  إصدار شهادة Let's Encrypt
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// INSTALL MODAL
// ═══════════════════════════════════════════════════════════════════

function InstallModal({
  onClose,
  onInstall,
}: {
  onClose: () => void;
  onInstall: (certPem: string, keyPem: string) => void;
}) {
  const [certPem, setCertPem] = useState("");
  const [keyPem, setKeyPem] = useState("");
  const [showValues, setShowValues] = useState(false);

  const validPem = (s: string) => s.includes("-----BEGIN") && s.includes("-----END");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md animate-fade-in" onClick={onClose}>
      <div
        className="relative max-w-2xl w-full mx-4 glass-panel-strong rounded-2xl shadow-2xl animate-scale-in max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-border/30 sticky top-0 bg-card/95 backdrop-blur-xl z-10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-500/10 flex items-center justify-center">
              <Upload className="h-4 w-4 text-purple-400" />
            </div>
            <h3 className="text-lg font-bold">تثبيت شهادة موجودة</h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowValues((v) => !v)}
              className="btn-ghost text-xs"
              title={showValues ? "إخفاء" : "إظهار"}
            >
              {showValues ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </button>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted/20 transition-colors">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              <FileText className="h-3.5 w-3.5 inline ml-1" />
              الشهادة (Certificate PEM)
            </label>
            <p className="text-xs text-muted-foreground mb-2">
              الصق محتوى الشهادة بصيغة PEM (يبدأ بـ <code className="bg-muted/30 px-1 rounded text-purple-300">-----BEGIN CERTIFICATE-----</code>).
            </p>
            <textarea
              value={certPem}
              onChange={(e) => setCertPem(e.target.value)}
              placeholder={"-----BEGIN CERTIFICATE-----\nMIIFazCCBFOgAwIBAgISA2Q3N2Z4Q3p...\n-----END CERTIFICATE-----"}
              rows={6}
              className={`input-field font-mono text-xs ${showValues ? "" : "text-transparent bg-black/20"}`}
              dir="ltr"
              style={showValues ? {} : { WebkitTextSecurity: "disc" } as any}
            />
            {certPem && !validPem(certPem) && (
              <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                صيغة PEM غير صحيحة
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              <KeyRound className="h-3.5 w-3.5 inline ml-1" />
              المفتاح الخاص (Private Key PEM)
            </label>
            <p className="text-xs text-muted-foreground mb-2">
              الصق محتوى المفتاح بصيغة PEM (يبدأ بـ <code className="bg-muted/30 px-1 rounded text-purple-300">-----BEGIN PRIVATE KEY-----</code> أو <code className="bg-muted/30 px-1 rounded text-purple-300">RSA PRIVATE KEY</code>).
            </p>
            <textarea
              value={keyPem}
              onChange={(e) => setKeyPem(e.target.value)}
              placeholder={"-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEF...\n-----END PRIVATE KEY-----"}
              rows={6}
              className={`input-field font-mono text-xs ${showValues ? "" : "text-transparent bg-black/20"}`}
              dir="ltr"
              style={showValues ? {} : { WebkitTextSecurity: "disc" } as any}
            />
            {keyPem && !validPem(keyPem) && (
              <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                صيغة PEM غير صحيحة
              </p>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-border/30">
            <button onClick={onClose} className="btn-ghost text-sm">
              إلغاء
            </button>
            <button
              onClick={() => onInstall(certPem, keyPem)}
              disabled={!validPem(certPem) || !validPem(keyPem)}
              className="btn-primary gap-2 disabled:opacity-50"
            >
              <Upload className="h-4 w-4" />
              تثبيت الشهادة
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// SHARED COMPONENTS
// ═══════════════════════════════════════════════════════════════════

function HealthBadge({ health, daysRemaining }: { health?: string; daysRemaining?: number }) {
  if (health === "expired" || (daysRemaining !== undefined && daysRemaining < 0)) {
    return (
      <span className="chip chip-danger">
        <XCircle className="h-3 w-3" />
        منتهية الصلاحية
      </span>
    );
  }
  if (health === "critical" || (daysRemaining !== undefined && daysRemaining < 7)) {
    return (
      <span className="chip chip-danger">
        <AlertTriangle className="h-3 w-3" />
        حرجة ({daysRemaining} يوم)
      </span>
    );
  }
  if (health === "warning" || (daysRemaining !== undefined && daysRemaining < 30)) {
    return (
      <span className="chip chip-warning">
        <Clock className="h-3 w-3" />
        تنتهي قريباً ({daysRemaining} يوم)
      </span>
    );
  }
  return (
    <span className="chip chip-success">
      <CheckCircle2 className="h-3 w-3" />
      سليمة
    </span>
  );
}

function DetailRow({
  icon,
  label,
  value,
  dir,
  mono,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  dir?: "rtl" | "ltr";
  mono?: boolean;
  highlight?: boolean;
}) {
  return (
    <div className="bg-muted/20 rounded-lg p-3">
      <div className="flex items-center gap-1.5 mb-1 text-muted-foreground">
        {icon}
        <span className="text-[11px] font-medium">{label}</span>
      </div>
      <p
        className={`text-sm ${mono ? "font-mono" : ""} ${highlight ? "text-yellow-400" : "text-foreground"} truncate`}
        dir={dir}
        title={value}
      >
        {value}
      </p>
    </div>
  );
}

function InfoCard({
  icon,
  title,
  description,
  color,
  onClick,
  disabled,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  color: "emerald" | "blue" | "purple";
  onClick: () => void;
  disabled?: boolean;
}) {
  const colorMap: Record<string, string> = {
    emerald: "bg-emerald-500/10 text-emerald-400 group-hover:bg-emerald-500/20",
    blue: "bg-blue-500/10 text-blue-400 group-hover:bg-blue-500/20",
    purple: "bg-purple-500/10 text-purple-400 group-hover:bg-purple-500/20",
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="preset-card text-right group disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-lg transition-colors ${colorMap[color]}`}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-foreground">{title}</p>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{description}</p>
        </div>
      </div>
    </button>
  );
}

function getCertTypeLabel(type?: string): string {
  switch (type) {
    case "local":
      return "تنمية محلية (Self-Signed)";
    case "letsencrypt":
      return "Let's Encrypt";
    case "custom":
      return "مخصصة (Custom Upload)";
    default:
      return "غير معروف";
  }
}
