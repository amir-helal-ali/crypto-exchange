"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import {
  Globe,
  Save,
  RefreshCw,
  Server,
  ShieldCheck,
  Lock,
  Unlock,
  AlertTriangle,
  CheckCircle2,
  Power,
  PowerOff,
  Rocket,
  Wrench,
} from "lucide-react";
import { authGet, authPost, authPut } from "@/lib/api";

interface SettingsByCategory {
  domains?: Record<string, string>;
  ssl?: Record<string, string>;
  security?: Record<string, string>;
  features?: Record<string, string>;
}

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<SettingsByCategory>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reloadingNginx, setReloadingNginx] = useState(false);
  const [changedKeys, setChangedKeys] = useState<Set<string>>(new Set());
  const [editValues, setEditValues] = useState<Record<string, string>>({});

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await authGet("/api/v1/admin/settings");
      if (res.ok) {
        const data = await res.json();
        setSettings(data.data || {});
        // Flatten into editValues for the form
        const flat: Record<string, string> = {};
        Object.values(data.data || {}).forEach((cat: any) => {
          Object.entries(cat).forEach(([k, v]) => {
            flat[k] = v as string;
          });
        });
        setEditValues(flat);
        setChangedKeys(new Set());
      } else {
        toast.error("فشل تحميل الإعدادات");
      }
    } catch {
      toast.error("خطأ في الاتصال بالخادم");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleChange = (key: string, value: string) => {
    setEditValues((prev) => ({ ...prev, [key]: value }));
    setChangedKeys((prev) => new Set(prev).add(key));
  };

  const handleSave = async () => {
    if (changedKeys.size === 0) {
      toast("لا توجد تغييرات للحفظ", { icon: "ℹ️" });
      return;
    }
    setSaving(true);
    try {
      const updates: Record<string, string> = {};
      changedKeys.forEach((k) => {
        updates[k] = editValues[k];
      });
      const res = await authPut("/api/v1/admin/settings", { settings: updates });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(`تم تحديث ${data.updated?.length || 0} إعداد`);
        if (data.rejected?.length > 0) {
          toast.error(`تم رفض: ${data.rejected.join(", ")}`);
        }
        setChangedKeys(new Set());
        // Auto-reload nginx if domain-related keys changed
        const domainKeys = ["frontend_domain", "backend_domain", "admin_domain", "main_domain", "ssl_enabled", "ssl_cert_path", "ssl_key_path"];
        const needsReload = Object.keys(updates).some((k) => domainKeys.includes(k));
        if (needsReload) {
          toast("جاري إعادة تحميل nginx...", { icon: "🔄" });
          setTimeout(() => handleNginxReload(), 500);
        }
      } else {
        toast.error(data.error || "فشل الحفظ");
      }
    } catch {
      toast.error("خطأ في الاتصال");
    } finally {
      setSaving(false);
    }
  };

  const handleNginxReload = async () => {
    setReloadingNginx(true);
    try {
      const res = await authPost("/api/v1/admin/nginx/reload", {});
      const data = await res.json();
      if (res.ok && data.success) {
        if (data.mode === "dev") {
          toast.success("تم التحديث (وضع التطوير — أعد تشغيل nginx يدوياً)");
        } else {
          toast.success("تم إعادة تحميل nginx بنجاح");
        }
      } else {
        toast.error("فشل إعادة التحميل");
      }
    } catch {
      toast.error("خطأ في الاتصال");
    } finally {
      setReloadingNginx(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  const domains = settings.domains || {};
  const ssl = settings.ssl || {};
  const features = settings.features || {};
  const security = settings.security || {};

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Globe className="w-6 h-6 text-blue-400" />
            إعدادات النظام
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            إدارة الدومينات، شهادات SSL، والميزات. تنطبق التغييرات على جميع الخدمات فوراً.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchSettings}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg flex items-center gap-2 transition"
          >
            <RefreshCw className="w-4 h-4" />
            تحديث
          </button>
          <button
            onClick={handleNginxReload}
            disabled={reloadingNginx}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-lg flex items-center gap-2 transition"
          >
            {reloadingNginx ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Server className="w-4 h-4" />}
            إعادة تحميل Nginx
          </button>
          <button
            onClick={handleSave}
            disabled={saving || changedKeys.size === 0}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg flex items-center gap-2 transition"
          >
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            حفظ التغييرات ({changedKeys.size})
          </button>
        </div>
      </div>

      {/* Domains Section */}
      <Section
        title="الدومينات"
        icon={<Globe className="w-5 h-5" />}
        description="أسماء النطاقات التي يستمع إليها nginx ويوجهها للخدمات المناسبة. كل خدمة يمكن أن تكون على نطاق فرعي مستقل."
      >
        <Field
          label="الدومين الرئيسي"
          hint="النطاق الجذر الذي يُستخدم في الروابط العامة ورسائل البريد."
          value={editValues.main_domain || ""}
          onChange={(v) => handleChange("main_domain", v)}
          placeholder="eg-money.local"
        />
        <Field
          label="دومين الواجهة الأمامية (Frontend)"
          hint="النطاق الذي يُقدّم تطبيق المستخدم (SvelteKit)."
          value={editValues.frontend_domain || ""}
          onChange={(v) => handleChange("frontend_domain", v)}
          placeholder="eg-money.local"
        />
        <Field
          label="دومين الـ API (Backend)"
          hint="النطاق الذي يُقدّم واجهة Go/Gin البرمجية."
          value={editValues.backend_domain || ""}
          onChange={(v) => handleChange("backend_domain", v)}
          placeholder="api.eg-money.local"
        />
        <Field
          label="دومين لوحة الإدارة (Admin)"
          hint="النطاق الذي يُقدّم لوحة Next.js الإدارية."
          value={editValues.admin_domain || ""}
          onChange={(v) => handleChange("admin_domain", v)}
          placeholder="admin.eg-money.local"
        />
      </Section>

      {/* SSL Section */}
      <Section
        title="شهادات SSL"
        icon={editValues.ssl_enabled === "true" ? <Lock className="w-5 h-5" /> : <Unlock className="w-5 h-5" />}
        description="تفعيل تشفير HTTPS والمسارات إلى شهادات SSL. عند التعطيل، يعمل المشروع على HTTP فقط."
      >
        <ToggleField
          label="تفعيل SSL"
          hint="عند التفعيل، يصغي nginx على المنفذ 443 ويُعيد توجيه HTTP → HTTPS."
          checked={editValues.ssl_enabled === "true"}
          onChange={(v) => handleChange("ssl_enabled", v ? "true" : "false")}
        />
        {editValues.ssl_enabled === "true" && (
          <>
            <Field
              label="مسار شهادة SSL (Cert)"
              hint="المسار داخل حاوية nginx لملف الشهادة العامة."
              value={editValues.ssl_cert_path || ""}
              onChange={(v) => handleChange("ssl_cert_path", v)}
              placeholder="/etc/nginx/certs/local.pem"
            />
            <Field
              label="مسار مفتاح SSL (Key)"
              hint="المسار داخل حاوية nginx لملف المفتاح الخاص."
              value={editValues.ssl_key_path || ""}
              onChange={(v) => handleChange("ssl_key_path", v)}
              placeholder="/etc/nginx/certs/local-key.pem"
            />
          </>
        )}
      </Section>

      {/* Security Section */}
      <Section
        title="CORS الأصولات الإضافية"
        icon={<ShieldCheck className="w-5 h-5" />}
        description="قائمة مفصولة بفواصل للنطاقات الإضافية المسموح لها بالوصول للـ API (إضافة للدومينات المُعدّة أعلاه)."
      >
        <Field
          label="أصول CORS إضافية"
          hint="مثال: https://app.example.com, https://wallet.example.com"
          value={editValues.cors_extra_origins || ""}
          onChange={(v) => handleChange("cors_extra_origins", v)}
          placeholder="https://app.example.com, https://wallet.example.com"
        />
      </Section>

      {/* Features Section */}
      <Section
        title="الميزات والصيانة"
        icon={<Wrench className="w-5 h-5" />}
        description="تحكم في فتح التسجيل، وضع الصيانة، والرسائل المخصصة للمستخدمين."
      >
        <ToggleField
          label="فتح التسجيل"
          hint="عند التعطيل، يُرفض إنشاء حسابات جديدة عبر /api/v1/auth/register."
          checked={editValues.registration_open === "true"}
          onChange={(v) => handleChange("registration_open", v ? "true" : "false")}
        />
        <ToggleField
          label="وضع الصيانة"
          hint="عند التفعيل، تظهر رسالة صيانة للمستخدمين ويمكن تعطيل الوصول للوظائف الحساسة."
          checked={editValues.maintenance_mode === "true"}
          onChange={(v) => handleChange("maintenance_mode", v ? "true" : "false")}
        />
        <Field
          label="رسالة الصيانة"
          hint="تظهر للمستخدمين عند تفعيل وضع الصيانة."
          value={editValues.maintenance_message || ""}
          onChange={(v) => handleChange("maintenance_message", v)}
          placeholder="المنصة قيد الصيانة. عودة قريباً."
          multiline
        />
      </Section>

      {/* How it works */}
      <Section
        title="كيف يعمل النظام؟"
        icon={<Rocket className="w-5 h-5" />}
        description="شرح موجز لتدفق البيانات عند تعديل الإعدادات."
      >
        <div className="space-y-3 text-sm text-gray-300">
          <div className="flex items-start gap-3">
            <div className="bg-blue-500/20 text-blue-400 rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0 text-xs font-bold">1</div>
            <div>
              <span className="text-white font-medium">حفظ الإعدادات:</span> تكتب القيم في جدول <code className="bg-gray-800 px-1.5 py-0.5 rounded text-purple-300">system_settings</code> في قاعدة البيانات.
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="bg-blue-500/20 text-blue-400 rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0 text-xs font-bold">2</div>
            <div>
              <span className="text-white font-medium">تحديث ذاكرة الـ Backend:</span> يُحدّث الـ cache الفوري للـ CORS والـ feature flags بدون إعادة تشغيل.
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="bg-blue-500/20 text-blue-400 rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0 text-xs font-bold">3</div>
            <div>
              <span className="text-white font-medium">إشارة Nginx:</span> يكتب الـ backend في ملف trigger مشترك، فيكتشف الـ sidecar في حاوية nginx التغيير.
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="bg-blue-500/20 text-blue-400 rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0 text-xs font-bold">4</div>
            <div>
              <span className="text-white font-medium">إعادة توليد config:</span> يسحب الـ sidecar الإعدادات الجديدة من <code className="bg-gray-800 px-1.5 py-0.5 rounded text-purple-300">/api/v1/config</code> ويولّد nginx.conf جديد.
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="bg-blue-500/20 text-blue-400 rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0 text-xs font-bold">5</div>
            <div>
              <span className="text-white font-medium">Reload آمن:</span> يختبر الـ config بـ <code className="bg-gray-800 px-1.5 py-0.5 rounded text-purple-300">nginx -t</code> ثم يرسل إشارة reload بدون توقف الخدمة.
            </div>
          </div>
        </div>
      </Section>

      {/* Status indicator */}
      <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4">
        <div className="flex items-center gap-3 mb-2">
          {changedKeys.size > 0 ? (
            <>
              <AlertTriangle className="w-5 h-5 text-yellow-400" />
              <span className="text-yellow-400 font-medium">
                لديك {changedKeys.size} تغيير غير محفوظ
              </span>
            </>
          ) : (
            <>
              <CheckCircle2 className="w-5 h-5 text-green-400" />
              <span className="text-green-400 font-medium">جميع التغييرات محفوظة</span>
            </>
          )}
        </div>
        <p className="text-gray-400 text-xs">
          آخر تحديث: {new Date().toLocaleString("ar-EG")}
        </p>
      </div>
    </div>
  );
}

// --- Reusable UI components ---

function Section({
  title,
  icon,
  description,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="text-blue-400">{icon}</div>
        <h2 className="text-lg font-semibold text-white">{title}</h2>
      </div>
      <p className="text-gray-400 text-sm mb-4">{description}</p>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function Field({
  label,
  hint,
  value,
  onChange,
  placeholder,
  multiline,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-300 mb-1">{label}</label>
      {hint && <p className="text-xs text-gray-500 mb-2">{hint}</p>}
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={3}
          className="w-full bg-gray-900 border border-gray-700 text-white rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500 transition"
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-gray-900 border border-gray-700 text-white rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500 transition"
        />
      )}
    </div>
  );
}

function ToggleField({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <div className="flex-1">
        <label className="block text-sm font-medium text-gray-300">{label}</label>
        {hint && <p className="text-xs text-gray-500 mt-1">{hint}</p>}
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
          checked ? "bg-green-500" : "bg-gray-600"
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
            checked ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </button>
    </div>
  );
}
