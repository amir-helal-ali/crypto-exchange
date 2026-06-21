"use client";

import { useEffect, useState, useCallback, useRef } from "react";
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
  Copy,
  Check,
  ExternalLink,
  Wifi,
  Loader2,
  Activity,
  Settings as SettingsIcon,
  Database,
  Zap,
  History,
  Eye,
  EyeOff,
  Cpu,
} from "lucide-react";
import { authGet, authPost, authPut } from "@/lib/api";
import { Tabs, ConfirmDialog } from "@/components/ui";

interface SettingsByCategory {
  domains?: Record<string, string>;
  ssl?: Record<string, string>;
  security?: Record<string, string>;
  features?: Record<string, string>;
}

type DomainStatus = "idle" | "checking" | "online" | "offline";
type TabId = "overview" | "domains" | "security" | "features" | "history";

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<SettingsByCategory>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reloadingNginx, setReloadingNginx] = useState(false);
  const [changedKeys, setChangedKeys] = useState<Set<string>>(new Set());
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [originalValues, setOriginalValues] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [domainStatuses, setDomainStatuses] = useState<Record<string, DomainStatus>>({});
  const [confirmAction, setConfirmAction] = useState<null | {
    title: string;
    description: React.ReactNode;
    confirmLabel: string;
    destructive?: boolean;
    onConfirm: () => void;
  }>(null);
  const [showSecrets, setShowSecrets] = useState(false);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const lastFetchRef = useRef<Date | null>(null);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authGet("/api/v1/admin/settings");
      if (res.ok) {
        const data = await res.json();
        setSettings(data.data || {});
        const flat: Record<string, string> = {};
        Object.values(data.data || {}).forEach((cat: any) => {
          Object.entries(cat).forEach(([k, v]) => {
            flat[k] = v as string;
          });
        });
        setEditValues(flat);
        setOriginalValues(flat);
        setChangedKeys(new Set());
        lastFetchRef.current = new Date();
      } else {
        toast.error("فشل تحميل الإعدادات");
      }
    } catch {
      toast.error("خطأ في الاتصال بالخادم");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchAuditLogs = useCallback(async () => {
    try {
      const res = await authGet("/api/v1/admin/audit-logs?limit=5&action=SETTINGS_UPDATE");
      const data = await res.json();
      if (res.ok && data.success) {
        setAuditLogs(Array.isArray(data.data) ? data.data : []);
      } else {
        // Fallback — fetch latest logs and filter client-side
        const fallback = await authGet("/api/v1/admin/audit-logs?limit=20");
        const fdata = await fallback.json();
        const all = Array.isArray(fdata?.data) ? fdata.data : [];
        setAuditLogs(all.filter((l: any) => (l.action || "").includes("SETTINGS")).slice(0, 5));
      }
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    fetchSettings();
    fetchAuditLogs();
  }, [fetchSettings, fetchAuditLogs]);

  // Keyboard shortcuts: Ctrl/Cmd+S to save
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (changedKeys.size > 0 && !saving) handleSave();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [changedKeys, saving]);

  const handleChange = (key: string, value: string) => {
    setEditValues((prev) => ({ ...prev, [key]: value }));
    setChangedKeys((prev) => {
      const next = new Set(prev);
      if (originalValues[key] === value) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleSave = async (opts?: { skipConfirm?: boolean }) => {
    if (changedKeys.size === 0) {
      toast("لا توجد تغييرات للحفظ", { icon: "ℹ️" });
      return;
    }

    // Sensitive keys require confirmation
    const sensitiveKeys = ["main_domain", "frontend_domain", "backend_domain", "admin_domain", "ssl_enabled"];
    const touchingSensitive = Array.from(changedKeys).some((k) => sensitiveKeys.includes(k));

    if (!opts?.skipConfirm && touchingSensitive) {
      setConfirmAction({
        title: "تأكيد تغيير الإعدادات الحساسة",
        description: (
          <div className="space-y-2">
            <p>أنت على وشك تعديل إعدادات الدومين أو SSL. هذا قد يؤثر على وصول المستخدمين للمنصة.</p>
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-2.5 text-xs">
              <span className="text-yellow-400 font-medium">التغييرات المعلقة:</span>
              <ul className="mt-1.5 space-y-0.5 text-yellow-300/90">
                {Array.from(changedKeys).filter((k) => sensitiveKeys.includes(k)).map((k) => (
                  <li key={k} dir="ltr" className="font-mono">
                    {k}: <span className="text-muted-foreground line-through">{originalValues[k] || "—"}</span> → <span className="text-yellow-300">{editValues[k]}</span>
                  </li>
                ))}
              </ul>
            </div>
            <p className="text-xs text-muted-foreground">سيتم حفظ الإعدادات وإعادة تحميل nginx تلقائياً.</p>
          </div>
        ),
        confirmLabel: "حفظ وتطبيق",
        destructive: false,
        onConfirm: async () => {
          setConfirmAction(null);
          await doSave(true);
        },
      });
      return;
    }

    await doSave(touchingSensitive);
  };

  const doSave = async (reloadNginx: boolean) => {
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
          toast.error(`تم رفض: ${data.rejected.join("، ")}`);
        }
        setOriginalValues({ ...editValues });
        setChangedKeys(new Set());
        fetchAuditLogs();
        if (reloadNginx) {
          toast("جاري إعادة تحميل nginx...", { icon: "🔄" });
          setTimeout(() => handleNginxReload(), 600);
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
        // Re-test all domains after reload
        setTimeout(() => testAllDomains(), 1500);
      } else {
        toast.error("فشل إعادة التحميل");
      }
    } catch {
      toast.error("خطأ في الاتصال");
    } finally {
      setReloadingNginx(false);
    }
  };

  const handleCopy = async (text: string, label: string) => {
    if (!text) {
      toast.error("لا يوجد نص للنسخ");
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`تم نسخ ${label}`, { icon: "📋" });
    } catch {
      toast.error("فشل النسخ");
    }
  };

  const testDomain = async (key: string) => {
    const domain = editValues[key];
    if (!domain) {
      toast.error("الدومين غير مُعرّف");
      return;
    }
    setDomainStatuses((prev) => ({ ...prev, [key]: "checking" }));
    try {
      // Use the /api/v1/config endpoint which is public + lightweight
      const proto = editValues.ssl_enabled === "true" ? "https" : "http";
      const url = `${proto}://${domain}/api/v1/config`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(url, { signal: controller.signal, mode: "cors" });
      clearTimeout(timeoutId);
      if (res.ok) {
        setDomainStatuses((prev) => ({ ...prev, [key]: "online" }));
        toast.success(`${domain} متصل`, { icon: "✅" });
      } else {
        setDomainStatuses((prev) => ({ ...prev, [key]: "offline" }));
        toast.error(`${domain} أعاد ${res.status}`);
      }
    } catch (e: any) {
      setDomainStatuses((prev) => ({ ...prev, [key]: "offline" }));
      // Likely CORS or network — not necessarily a real outage
      toast(`تعذر الوصول لـ ${domain} (قد يكون بسبب CORS)`, { icon: "⚠️" });
    }
  };

  const testAllDomains = () => {
    ["frontend_domain", "backend_domain", "admin_domain", "main_domain"].forEach((k, i) => {
      if (editValues[k]) setTimeout(() => testDomain(k), i * 200);
    });
  };

  const handleReset = () => {
    setEditValues({ ...originalValues });
    setChangedKeys(new Set());
    toast("تم التراجع عن جميع التغييرات", { icon: "↩️" });
  };

  const applyPreset = (preset: "ssl-on" | "ssl-off" | "maintenance-on" | "maintenance-off") => {
    const updates: Record<string, string> = {
      "ssl-on": { ssl_enabled: "true" },
      "ssl-off": { ssl_enabled: "false" },
      "maintenance-on": { maintenance_mode: "true" },
      "maintenance-off": { maintenance_mode: "false" },
    }[preset];

    Object.entries(updates).forEach(([k, v]) => handleChange(k, v));
    toast.success("تم تطبيق الإعداد المسبق", { icon: "⚡" });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center glow-emerald animate-pulse">
            <SettingsIcon className="h-6 w-6 text-white" />
          </div>
          <span className="spinner h-6 w-6" />
          <p className="text-sm text-muted-foreground">جاري تحميل الإعدادات...</p>
        </div>
      </div>
    );
  }

  const sslEnabled = editValues.ssl_enabled === "true";
  const maintenanceMode = editValues.maintenance_mode === "true";
  const registrationOpen = editValues.registration_open === "true";
  const proto = sslEnabled ? "https" : "http";

  const tabs = [
    { id: "overview", label: "نظرة عامة", icon: <Activity className="h-4 w-4" /> },
    { id: "domains", label: "الدومينات", icon: <Globe className="h-4 w-4" /> },
    {
      id: "security",
      label: "الأمان",
      icon: <ShieldCheck className="h-4 w-4" />,
      badge: sslEnabled ? (
        <span className="chip chip-success !px-1.5 !py-0 !text-[10px]">SSL</span>
      ) : null,
    },
    {
      id: "features",
      label: "الميزات",
      icon: <Wrench className="h-4 w-4" />,
      badge: maintenanceMode ? (
        <span className="chip chip-warning !px-1.5 !py-0 !text-[10px]">صيانة</span>
      ) : null,
    },
    { id: "history", label: "آخر التغييرات", icon: <History className="h-4 w-4" /> },
  ];

  const tabItems = tabs as any[];

  const changedDomains = ["frontend_domain", "backend_domain", "admin_domain", "main_domain"].filter(
    (k) => changedKeys.has(k)
  ).length;

  return (
    <div className="space-y-6 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4 animate-slide-in-down">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center border border-primary/20">
            <SettingsIcon className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold">إعدادات النظام</h1>
            <p className="text-sm text-muted-foreground">
              إدارة الدومينات، شهادات SSL، والميزات — تنطبق التغييرات على جميع الخدمات فوراً.
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchSettings}
            className="btn-ghost"
            title="إعادة تحميل الإعدادات من الخادم"
          >
            <RefreshCw className="h-4 w-4" />
            تحديث
          </button>
          <button
            onClick={handleNginxReload}
            disabled={reloadingNginx}
            className="btn-ghost gap-2"
            title="إعادة توليد وإعادة تحميل nginx.conf"
          >
            {reloadingNginx ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Server className="h-4 w-4" />}
            إعادة تحميل Nginx
          </button>
        </div>
      </div>

      {/* Status strip — visible across all tabs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 animate-slide-in-up delay-100">
        <StatusPill
          icon={<Globe className="h-4 w-4" />}
          label="الدومين الرئيسي"
          value={editValues.main_domain || "—"}
          color="teal"
        />
        <StatusPill
          icon={sslEnabled ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
          label="حالة SSL"
          value={sslEnabled ? "مُفعّل" : "مُعطّل"}
          color={sslEnabled ? "emerald" : "yellow"}
        />
        <StatusPill
          icon={<Power className="h-4 w-4" />}
          label="التسجيل"
          value={registrationOpen ? "مفتوح" : "مغلق"}
          color={registrationOpen ? "emerald" : "red"}
        />
        <StatusPill
          icon={<Wrench className="h-4 w-4" />}
          label="وضع الصيانة"
          value={maintenanceMode ? "مُفعّل" : "مُعطّل"}
          color={maintenanceMode ? "yellow" : "emerald"}
        />
      </div>

      {/* Tabs */}
      <div className="animate-slide-in-up delay-200">
        <Tabs items={tabItems} active={activeTab} onChange={(id) => setActiveTab(id as TabId)} />
      </div>

      {/* Tab Content */}
      <div className="animate-fade-in" key={activeTab}>
        {activeTab === "overview" && (
          <OverviewTab
            editValues={editValues}
            sslEnabled={sslEnabled}
            maintenanceMode={maintenanceMode}
            registrationOpen={registrationOpen}
            domainStatuses={domainStatuses}
            changedKeys={changedKeys}
            onTestAll={testAllDomains}
            onNavigate={setActiveTab}
            onPreset={applyPreset}
            auditLogs={auditLogs}
            lastFetch={lastFetchRef.current}
          />
        )}

        {activeTab === "domains" && (
          <DomainsTab
            editValues={editValues}
            originalValues={originalValues}
            changedKeys={changedKeys}
            sslEnabled={sslEnabled}
            domainStatuses={domainStatuses}
            onChange={handleChange}
            onCopy={handleCopy}
            onTest={testDomain}
            onTestAll={testAllDomains}
          />
        )}

        {activeTab === "security" && (
          <SecurityTab
            editValues={editValues}
            changedKeys={changedKeys}
            showSecrets={showSecrets}
            onToggleSecrets={() => setShowSecrets((v) => !v)}
            onChange={handleChange}
          />
        )}

        {activeTab === "features" && (
          <FeaturesTab
            editValues={editValues}
            changedKeys={changedKeys}
            onChange={handleChange}
          />
        )}

        {activeTab === "history" && (
          <HistoryTab auditLogs={auditLogs} onRefresh={fetchAuditLogs} />
        )}
      </div>

      {/* Sticky Action Bar */}
      {changedKeys.size > 0 && (
        <div className="action-bar animate-slide-in-up">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <AlertTriangle className="h-5 w-5 text-yellow-400 shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">
                لديك {changedKeys.size} تغيير غير محفوظ
                {changedDomains > 0 && (
                  <span className="text-yellow-400"> ({changedDomains} دومين)</span>
                )}
              </p>
              <p className="text-[11px] text-muted-foreground">
                اضغط Ctrl/Cmd+S للحفظ السريع
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleReset}
              disabled={saving}
              className="btn-ghost text-xs"
            >
              تراجع
            </button>
            <button
              onClick={() => handleSave()}
              disabled={saving}
              className="btn-primary text-sm"
            >
              {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              حفظ التغييرات ({changedKeys.size})
            </button>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={!!confirmAction}
        onClose={() => !saving && setConfirmAction(null)}
        onConfirm={() => confirmAction?.onConfirm()}
        title={confirmAction?.title || ""}
        description={confirmAction?.description}
        confirmLabel={confirmAction?.confirmLabel || "تأكيد"}
        destructive={confirmAction?.destructive}
        loading={saving}
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// OVERVIEW TAB
// ═══════════════════════════════════════════════════════════════════

function OverviewTab({
  editValues,
  sslEnabled,
  maintenanceMode,
  registrationOpen,
  domainStatuses,
  changedKeys,
  onTestAll,
  onNavigate,
  onPreset,
  auditLogs,
  lastFetch,
}: {
  editValues: Record<string, string>;
  sslEnabled: boolean;
  maintenanceMode: boolean;
  registrationOpen: boolean;
  domainStatuses: Record<string, DomainStatus>;
  changedKeys: Set<string>;
  onTestAll: () => void;
  onNavigate: (t: TabId) => void;
  onPreset: (p: "ssl-on" | "ssl-off" | "maintenance-on" | "maintenance-off") => void;
  auditLogs: any[];
  lastFetch: Date | null;
}) {
  const domains = [
    { key: "main_domain", label: "الرئيسي", icon: Globe, color: "teal" },
    { key: "frontend_domain", label: "Frontend", icon: Globe, color: "emerald" },
    { key: "backend_domain", label: "API", icon: Server, color: "blue" },
    { key: "admin_domain", label: "Admin", icon: ShieldCheck, color: "purple" },
  ] as const;

  return (
    <div className="space-y-6">
      {/* Quick actions */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider">
          إجراءات سريعة
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <button
            onClick={() => onPreset("ssl-on")}
            className="preset-card text-right group"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 group-hover:bg-emerald-500/20 transition-colors">
                <Lock className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">تفعيل SSL</p>
                <p className="text-[11px] text-muted-foreground">HTTPS + redirect</p>
              </div>
            </div>
          </button>
          <button
            onClick={() => onPreset("ssl-off")}
            className="preset-card text-right group"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-yellow-500/10 text-yellow-400 group-hover:bg-yellow-500/20 transition-colors">
                <Unlock className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">تعطيل SSL</p>
                <p className="text-[11px] text-muted-foreground">HTTP فقط</p>
              </div>
            </div>
          </button>
          <button
            onClick={() => onPreset("maintenance-on")}
            className="preset-card text-right group"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-yellow-500/10 text-yellow-400 group-hover:bg-yellow-500/20 transition-colors">
                <PowerOff className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">وضع الصيانة</p>
                <p className="text-[11px] text-muted-foreground">إيقاف مؤقت</p>
              </div>
            </div>
          </button>
          <button
            onClick={() => onPreset("maintenance-off")}
            className="preset-card text-right group"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 group-hover:bg-emerald-500/20 transition-colors">
                <Power className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">إنهاء الصيانة</p>
                <p className="text-[11px] text-muted-foreground">استئناف الخدمة</p>
              </div>
            </div>
          </button>
        </div>
      </div>

      {/* Domain status grid */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            حالة الدومينات
          </h3>
          <button
            onClick={onTestAll}
            className="btn-ghost text-xs"
          >
            <Wifi className="h-3.5 w-3.5" />
            اختبار الكل
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {domains.map((d) => {
            const status = domainStatuses[d.key] || "idle";
            const domain = editValues[d.key];
            const Icon = d.icon;
            const changed = changedKeys.has(d.key);
            return (
              <div
                key={d.key}
                className={`domain-card domain-card-${d.color === "teal" ? "main" : d.color}`}
              >
                <div className="relative z-10 flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className={`p-2 rounded-lg bg-${d.color}-500/10 text-${d.color}-400 shrink-0`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-medium text-muted-foreground">{d.label}</p>
                        {changed && (
                          <span className="chip chip-warning !px-1.5 !py-0 !text-[10px]">معدّل</span>
                        )}
                      </div>
                      <p className="text-sm font-mono text-foreground truncate mt-0.5" dir="ltr">
                        {domain || "—"}
                      </p>
                    </div>
                  </div>
                  <DomainStatusBadge status={status} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent activity */}
      <div className="glass-panel rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-purple-400" />
            <h3 className="font-semibold">آخر التغييرات على الإعدادات</h3>
          </div>
          <button
            onClick={() => onNavigate("history")}
            className="btn-ghost text-xs"
          >
            عرض الكل
          </button>
        </div>
        {auditLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Database className="h-8 w-8 text-muted-foreground/30 mb-2" />
            <p className="text-sm text-muted-foreground">لا توجد تغييرات مسجلة بعد</p>
          </div>
        ) : (
          <div className="space-y-3">
            {auditLogs.slice(0, 4).map((log: any, i: number) => (
              <div key={i} className="timeline-item timeline-item-info">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm text-foreground font-medium truncate" dir="ltr">
                      {log.details || log.action}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      بواسطة <span className="font-medium text-foreground/80">{log.username || "admin"}</span>
                    </p>
                  </div>
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap shrink-0">
                    {new Date(log.createdAt).toLocaleString("ar-EG", {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* System info */}
      <div className="glass-panel rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <Cpu className="h-4 w-4 text-blue-400" />
          <h3 className="font-semibold">معلومات النظام</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <InfoRow label="SSL" value={sslEnabled ? "مُفعّل" : "مُعطّل"} ok={sslEnabled} />
          <InfoRow label="التسجيل" value={registrationOpen ? "مفتوح" : "مغلق"} ok={registrationOpen} />
          <InfoRow label="الصيانة" value={maintenanceMode ? "نشطة" : "متوقفة"} ok={!maintenanceMode} />
          <InfoRow
            label="آخر تحديث"
            value={lastFetch ? lastFetch.toLocaleTimeString("ar-EG") : "—"}
            neutral
          />
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// DOMAINS TAB
// ═══════════════════════════════════════════════════════════════════

function DomainsTab({
  editValues,
  originalValues,
  changedKeys,
  sslEnabled,
  domainStatuses,
  onChange,
  onCopy,
  onTest,
  onTestAll,
}: {
  editValues: Record<string, string>;
  originalValues: Record<string, string>;
  changedKeys: Set<string>;
  sslEnabled: boolean;
  domainStatuses: Record<string, DomainStatus>;
  onChange: (k: string, v: string) => void;
  onCopy: (text: string, label: string) => void;
  onTest: (k: string) => void;
  onTestAll: () => void;
}) {
  const proto = sslEnabled ? "https" : "http";

  const fields = [
    {
      key: "main_domain",
      label: "الدومين الرئيسي",
      hint: "النطاق الجذر المستخدم في الروابط العامة ورسائل البريد.",
      placeholder: "eg-money.local",
      icon: Globe,
      color: "teal",
    },
    {
      key: "frontend_domain",
      label: "دومين الواجهة الأمامية (Frontend)",
      hint: "النطاق الذي يُقدّم تطبيق المستخدم (SvelteKit).",
      placeholder: "eg-money.local",
      icon: Globe,
      color: "emerald",
    },
    {
      key: "backend_domain",
      label: "دومين الـ API (Backend)",
      hint: "النطاق الذي يُقدّم واجهة Go/Gin البرمجية.",
      placeholder: "api.eg-money.local",
      icon: Server,
      color: "blue",
    },
    {
      key: "admin_domain",
      label: "دومين لوحة الإدارة (Admin)",
      hint: "النطاق الذي يُقدّم لوحة Next.js الإدارية.",
      placeholder: "admin.eg-money.local",
      icon: ShieldCheck,
      color: "purple",
    },
  ] as const;

  return (
    <div className="space-y-5">
      {/* Helper banner */}
      <div className="glass-panel rounded-2xl p-4 flex items-start gap-3 border-r-2 border-r-blue-500/50">
        <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 shrink-0">
          <Rocket className="h-4 w-4" />
        </div>
        <div className="flex-1">
          <p className="text-sm text-foreground font-medium">
            تعديل أسماء النطاقات الفرعية (subdomains)
          </p>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
            عند الحفظ، يولّد nginx تلقائياً <code className="bg-muted/30 px-1 py-0.5 rounded text-purple-300">server_name</code> جديد لكل خدمة
            ويُعيد تحميل الإعدادات بدون توقف. تأكد من إضافة DNS records أو إدخالات hosts محلية لكل نطاق فرعي.
          </p>
        </div>
        <button
          onClick={onTestAll}
          className="btn-ghost text-xs shrink-0"
        >
          <Wifi className="h-3.5 w-3.5" />
          اختبار الكل
        </button>
      </div>

      {/* Domain cards with full edit + status */}
      <div className="space-y-4">
        {fields.map((f) => {
          const Icon = f.icon;
          const changed = changedKeys.has(f.key);
          const status = domainStatuses[f.key] || "idle";
          const value = editValues[f.key] || "";
          const preview = value ? `${proto}://${value}` : "";

          return (
            <div
              key={f.key}
              className={`domain-card domain-card-${f.color === "teal" ? "main" : f.color} ${changed ? "ring-1 ring-yellow-500/30" : ""}`}
            >
              <div className="relative z-10 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg bg-${f.color}-500/10 text-${f.color}-400`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <label className="text-sm font-medium text-foreground">{f.label}</label>
                        {changed && (
                          <span className="chip chip-warning !px-1.5 !py-0">
                            <span className="text-yellow-400">●</span>
                            معدّل
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{f.hint}</p>
                    </div>
                  </div>
                  <DomainStatusBadge status={status} />
                </div>

                {/* Input row */}
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="flex-1 relative">
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-mono text-muted-foreground/60 pointer-events-none">
                      {proto}://
                    </span>
                    <input
                      type="text"
                      value={value}
                      onChange={(e) => onChange(f.key, e.target.value)}
                      placeholder={f.placeholder}
                      className="input-field pr-16 font-mono text-sm"
                      dir="ltr"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => onCopy(value, f.label)}
                      className="copy-btn border border-border/30"
                      title="نسخ"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => onTest(f.key)}
                      disabled={status === "checking"}
                      className="btn-ghost text-xs px-3"
                      title="اختبار الاتصال"
                    >
                      {status === "checking" ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Wifi className="h-3.5 w-3.5" />
                      )}
                      اختبار
                    </button>
                    {value && (
                      <a
                        href={preview}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="copy-btn border border-border/30"
                        title="فتح في تبويب جديد"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </div>
                </div>

                {/* Diff preview */}
                {changed && (
                  <div className="text-xs flex items-center gap-2 bg-yellow-500/5 border border-yellow-500/20 rounded-lg p-2 animate-fade-in">
                    <span className="text-muted-foreground">القيمة المحفوظة:</span>
                    <span className="font-mono text-red-400 line-through" dir="ltr">
                      {originalValues[f.key] || "—"}
                    </span>
                    <span className="text-muted-foreground">←</span>
                    <span className="font-mono text-emerald-400" dir="ltr">
                      {value}
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* DNS hint */}
      <div className="glass-panel rounded-2xl p-4 bg-blue-500/5 border border-blue-500/20">
        <div className="flex items-start gap-3">
          <Database className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
          <div className="text-xs text-muted-foreground leading-relaxed">
            <p className="font-medium text-foreground mb-1">للتطوير المحلي:</p>
            أضف الإدخالات التالية في ملف <code className="bg-muted/30 px-1 py-0.5 rounded text-purple-300">/etc/hosts</code>:
            <pre className="mt-1.5 text-[11px] font-mono bg-muted/20 rounded p-2 overflow-x-auto" dir="ltr">
{`127.0.0.1  ${editValues.main_domain || "eg-money.local"}
127.0.0.1  ${editValues.frontend_domain || "eg-money.local"}
127.0.0.1  ${editValues.backend_domain || "api.eg-money.local"}
127.0.0.1  ${editValues.admin_domain || "admin.eg-money.local"}`}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// SECURITY TAB
// ═══════════════════════════════════════════════════════════════════

function SecurityTab({
  editValues,
  changedKeys,
  showSecrets,
  onToggleSecrets,
  onChange,
}: {
  editValues: Record<string, string>;
  changedKeys: Set<string>;
  showSecrets: boolean;
  onToggleSecrets: () => void;
  onChange: (k: string, v: string) => void;
}) {
  const sslEnabled = editValues.ssl_enabled === "true";

  return (
    <div className="space-y-5">
      {/* SSL Section */}
      <Section
        title="شهادات SSL"
        icon={sslEnabled ? <Lock className="h-5 w-5 text-emerald-400" /> : <Unlock className="h-5 w-5 text-yellow-400" />}
        description="تفعيل تشفير HTTPS والمسارات إلى شهادات SSL. عند التعطيل، يعمل المشروع على HTTP فقط."
        accent={sslEnabled ? "emerald" : "yellow"}
      >
        <ToggleRow
          label="تفعيل SSL"
          hint="عند التفعيل، يصغي nginx على المنفذ 443 ويُعيد توجيه HTTP → HTTPS."
          checked={sslEnabled}
          onChange={(v) => onChange("ssl_enabled", v ? "true" : "false")}
          changed={changedKeys.has("ssl_enabled")}
        />
        {sslEnabled && (
          <div className="space-y-4 pt-2 border-t border-border/20 animate-fade-in">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-sm font-medium text-foreground">
                  مسار شهادة SSL (Cert)
                </label>
                <button
                  onClick={onToggleSecrets}
                  className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                >
                  {showSecrets ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                  {showSecrets ? "إخفاء" : "إظهار"}
                </button>
              </div>
              <p className="text-xs text-muted-foreground mb-2">
                المسار داخل حاوية nginx لملف الشهادة العامة.
              </p>
              <input
                type={showSecrets ? "text" : "password"}
                value={editValues.ssl_cert_path || ""}
                onChange={(e) => onChange("ssl_cert_path", e.target.value)}
                placeholder="/etc/nginx/certs/local.pem"
                className={`input-field font-mono text-sm ${changedKeys.has("ssl_cert_path") ? "ring-1 ring-yellow-500/30" : ""}`}
                dir="ltr"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                مسار مفتاح SSL (Key)
              </label>
              <p className="text-xs text-muted-foreground mb-2">
                المسار داخل حاوية nginx لملف المفتاح الخاص.
              </p>
              <input
                type={showSecrets ? "text" : "password"}
                value={editValues.ssl_key_path || ""}
                onChange={(e) => onChange("ssl_key_path", e.target.value)}
                placeholder="/etc/nginx/certs/local-key.pem"
                className={`input-field font-mono text-sm ${changedKeys.has("ssl_key_path") ? "ring-1 ring-yellow-500/30" : ""}`}
                dir="ltr"
              />
            </div>
          </div>
        )}
      </Section>

      {/* CORS Section */}
      <Section
        title="CORS — الأصولات الإضافية"
        icon={<ShieldCheck className="h-5 w-5 text-blue-400" />}
        description="قائمة مفصولة بفواصل للنطاقات الإضافية المسموح لها بالوصول للـ API (إضافة للدومينات المُعدّة في تبويب الدومينات)."
        accent="blue"
      >
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">
            أصول CORS إضافية
          </label>
          <p className="text-xs text-muted-foreground mb-2">
            مثال: <code className="bg-muted/30 px-1 py-0.5 rounded text-purple-300">https://app.example.com, https://wallet.example.com</code>
          </p>
          <textarea
            value={editValues.cors_extra_origins || ""}
            onChange={(e) => onChange("cors_extra_origins", e.target.value)}
            placeholder="https://app.example.com, https://wallet.example.com"
            rows={3}
            className={`input-field font-mono text-sm ${changedKeys.has("cors_extra_origins") ? "ring-1 ring-yellow-500/30" : ""}`}
            dir="ltr"
          />
        </div>
        <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/20 rounded-lg p-3">
          <Zap className="h-3.5 w-3.5 text-blue-400 shrink-0 mt-0.5" />
          <p>
            الإعدادات التالية تُضاف تلقائياً لأصول CORS المسموح بها: النطاق الرئيسي، الواجهة، الـ API، ولوحة الإدارة.
            لا حاجة لتكرارها هنا.
          </p>
        </div>
      </Section>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// FEATURES TAB
// ═══════════════════════════════════════════════════════════════════

function FeaturesTab({
  editValues,
  changedKeys,
  onChange,
}: {
  editValues: Record<string, string>;
  changedKeys: Set<string>;
  onChange: (k: string, v: string) => void;
}) {
  const maintenanceMode = editValues.maintenance_mode === "true";
  const registrationOpen = editValues.registration_open === "true";

  return (
    <div className="space-y-5">
      <Section
        title="التسجيل والمصادقة"
        icon={<Power className="h-5 w-5 text-emerald-400" />}
        description="تحكم في فتح أو إغلاق إنشاء حسابات جديدة على المنصة."
        accent={registrationOpen ? "emerald" : "red"}
      >
        <ToggleRow
          label="فتح التسجيل"
          hint="عند التعطيل، يُرفض إنشاء حسابات جديدة عبر /api/v1/auth/register مع رسالة توضيحية."
          checked={registrationOpen}
          onChange={(v) => onChange("registration_open", v ? "true" : "false")}
          changed={changedKeys.has("registration_open")}
        />
      </Section>

      <Section
        title="وضع الصيانة"
        icon={<Wrench className="h-5 w-5 text-yellow-400" />}
        description="عند التفعيل، تظهر رسالة صيانة للمستخدمين. يُفضّل تفعيله أثناء التحديثات الجذرية."
        accent={maintenanceMode ? "yellow" : "emerald"}
      >
        <ToggleRow
          label="تفعيل وضع الصيانة"
          hint="يُعيد الـ API خطأ 503 لجميع الطلبات غير الـ /api/v1/health* و /api/v1/config."
          checked={maintenanceMode}
          onChange={(v) => onChange("maintenance_mode", v ? "true" : "false")}
          changed={changedKeys.has("maintenance_mode")}
        />
        <div className={maintenanceMode ? "block animate-fade-in" : "hidden"}>
          <label className="block text-sm font-medium text-foreground mb-1">
            رسالة الصيانة
          </label>
          <p className="text-xs text-muted-foreground mb-2">
            تظهر للمستخدمين عند تفعيل وضع الصيانة.
          </p>
          <textarea
            value={editValues.maintenance_message || ""}
            onChange={(e) => onChange("maintenance_message", e.target.value)}
            placeholder="المنصة قيد الصيانة. عودة قريباً."
            rows={3}
            className={`input-field text-sm ${changedKeys.has("maintenance_message") ? "ring-1 ring-yellow-500/30" : ""}`}
          />
        </div>
      </Section>

      {/* How it works */}
      <Section
        title="كيف يعمل النظام؟"
        icon={<Rocket className="h-5 w-5 text-purple-400" />}
        description="شرح موجز لتدفق البيانات عند تعديل الإعدادات."
        accent="purple"
      >
        <div className="space-y-3 text-sm text-muted-foreground">
          {[
            { step: 1, title: "حفظ الإعدادات", desc: "تكتب القيم في جدول system_settings في قاعدة البيانات.", color: "blue" },
            { step: 2, title: "تحديث ذاكرة الـ Backend", desc: "يُحدّث الـ cache الفوري للـ CORS والـ feature flags بدون إعادة تشغيل.", color: "emerald" },
            { step: 3, title: "إشارة Nginx", desc: "يكتب الـ backend في ملف trigger مشترك، فيكتشف الـ sidecar في حاوية nginx التغيير.", color: "purple" },
            { step: 4, title: "إعادة توليد config", desc: "يسحب الـ sidecar الإعدادات الجديدة من /api/v1/config ويولّد nginx.conf جديد.", color: "teal" },
            { step: 5, title: "Reload آمن", desc: "يختبر الـ config بـ nginx -t ثم يرسل إشارة reload بدون توقف الخدمة.", color: "emerald" },
          ].map((s) => (
            <div key={s.step} className="flex items-start gap-3">
              <div className={`bg-${s.color}-500/20 text-${s.color}-400 rounded-full w-6 h-6 flex items-center justify-center shrink-0 text-xs font-bold`}>
                {s.step}
              </div>
              <div>
                <span className="text-foreground font-medium">{s.title}:</span>{" "}
                {s.desc}
              </div>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// HISTORY TAB
// ═══════════════════════════════════════════════════════════════════

function HistoryTab({ auditLogs, onRefresh }: { auditLogs: any[]; onRefresh: () => void }) {
  return (
    <div className="glass-panel rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-purple-400" />
          <h3 className="font-semibold">سجل تغييرات الإعدادات</h3>
        </div>
        <button onClick={onRefresh} className="btn-ghost text-xs">
          <RefreshCw className="h-3.5 w-3.5" />
          تحديث
        </button>
      </div>

      {auditLogs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-muted/20 flex items-center justify-center mb-4">
            <History className="h-8 w-8 text-muted-foreground/30" />
          </div>
          <p className="text-sm text-muted-foreground font-medium">لا توجد تغييرات مسجلة</p>
          <p className="text-xs text-muted-foreground/50 mt-1">
            ستظهر هنا آخر العمليات على إعدادات النظام
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {auditLogs.map((log: any, i: number) => (
            <div key={i} className="timeline-item timeline-item-info">
              <div className="flex items-start justify-between gap-3 mb-1">
                <p className="text-sm font-medium text-foreground" dir="ltr">
                  {log.details || log.action}
                </p>
                <span className="text-[10px] text-muted-foreground whitespace-nowrap shrink-0">
                  {new Date(log.createdAt).toLocaleString("ar-EG", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  بواسطة <span className="font-medium text-foreground/80">{log.username || "admin"}</span>
                </span>
                {log.ipAddress && (
                  <span className="font-mono" dir="ltr">
                    {log.ipAddress}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// SHARED COMPONENTS
// ═══════════════════════════════════════════════════════════════════

function StatusPill({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: "emerald" | "yellow" | "red" | "teal" | "blue" | "purple";
}) {
  const colorMap: Record<string, string> = {
    emerald: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    yellow: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    red: "bg-red-500/10 text-red-400 border-red-500/20",
    teal: "bg-teal-500/10 text-teal-400 border-teal-500/20",
    blue: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    purple: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  };
  return (
    <div className={`glass-panel rounded-xl p-3 border ${colorMap[color].split(" ").slice(-1)[0]}`}>
      <div className="flex items-center gap-2 mb-1">
        <span className={colorMap[color]}>{icon}</span>
        <span className="text-[11px] text-muted-foreground font-medium">{label}</span>
      </div>
      <p className={`text-sm font-semibold truncate ${colorMap[color].split(" ")[1]}`} dir="ltr" title={value}>
        {value}
      </p>
    </div>
  );
}

function DomainStatusBadge({ status }: { status: DomainStatus }) {
  if (status === "idle") {
    return <span className="chip chip-default">لم يُختبر</span>;
  }
  if (status === "checking") {
    return (
      <span className="chip chip-info">
        <Loader2 className="h-3 w-3 animate-spin" />
        جاري الاختبار
      </span>
    );
  }
  if (status === "online") {
    return (
      <span className="chip chip-success">
        <Check className="h-3 w-3" />
        متصل
      </span>
    );
  }
  return (
    <span className="chip chip-danger">
      <AlertTriangle className="h-3 w-3" />
      غير متصل
    </span>
  );
}

function Section({
  title,
  icon,
  description,
  accent = "blue",
  children,
}: {
  title: string;
  icon: React.ReactNode;
  description: string;
  accent?: "emerald" | "yellow" | "blue" | "purple" | "red" | "teal";
  children: React.ReactNode;
}) {
  const accentMap: Record<string, string> = {
    emerald: "border-r-emerald-500/60",
    yellow: "border-r-yellow-500/60",
    blue: "border-r-blue-500/60",
    purple: "border-r-purple-500/60",
    red: "border-r-red-500/60",
    teal: "border-r-teal-500/60",
  };
  return (
    <div className={`glass-panel rounded-2xl p-6 border-r-2 ${accentMap[accent]}`}>
      <div className="flex items-center gap-3 mb-2">
        <div className="shrink-0">{icon}</div>
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      </div>
      <p className="text-gray-400 text-sm mb-4">{description}</p>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function ToggleRow({
  label,
  hint,
  checked,
  onChange,
  changed,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  changed?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <label className="block text-sm font-medium text-foreground">{label}</label>
          {changed && (
            <span className="chip chip-warning !px-1.5 !py-0 !text-[10px]">
              <span className="text-yellow-400">●</span>
              معدّل
            </span>
          )}
        </div>
        {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-all duration-200 shrink-0 ${
          checked
            ? "bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.4)]"
            : "bg-gray-600"
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-all duration-200 ${
            checked ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </button>
    </div>
  );
}

function InfoRow({ label, value, ok, neutral }: { label: string; value: string; ok?: boolean; neutral?: boolean }) {
  return (
    <div className="bg-muted/20 rounded-lg p-3">
      <p className="text-[11px] text-muted-foreground mb-0.5">{label}</p>
      <p
        className={`text-sm font-semibold ${
          neutral ? "text-foreground" : ok ? "text-emerald-400" : "text-yellow-400"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
