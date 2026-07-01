<script lang="ts">
  import { onMount } from 'svelte';
  import { authGet, authPost, authPut } from '$lib/api/client';
  import PageHeader from '$lib/components/PageHeader.svelte';
  import ErrorAlert from '$lib/components/ErrorAlert.svelte';
  import {
    Settings, Globe, ShieldCheck, Lock, Loader2, Save, AlertCircle,
    CheckCircle2, RefreshCw, Activity, Server, Wrench, ExternalLink,
    ToggleLeft, ToggleRight, Wifi, Shield, Zap, Users, Rocket, Megaphone,
    ArrowLeftRight
  } from 'lucide-svelte';

  // ─── Types ───────────────────────────────────────────────────
  interface DomainSettings {
    main_domain: string;
    admin_domain: string;
    api_domain: string;
  }

  interface SslSettings {
    ssl_enabled: boolean;
    ssl_email: string;
    ssl_type: 'letsencrypt' | 'custom';
  }

  interface SecuritySettings {
    registration_enabled: boolean;
    two_fa_enabled: boolean;
    kyc_required: boolean;
    max_login_attempts: number;
  }

  interface FeatureSettings {
    p2p_enabled: boolean;
    futures_enabled: boolean;
    staking_enabled: boolean;
    referral_enabled: boolean;
    ads_enabled: boolean;
  }

  interface AllSettings {
    domains: DomainSettings;
    ssl: SslSettings;
    security: SecuritySettings;
    features: FeatureSettings;
  }

  type TabKey = 'overview' | 'domains' | 'ssl' | 'security' | 'features';

  // ─── State ───────────────────────────────────────────────────
  let activeTab = $state<TabKey>('overview');
  let loading = $state(true);
  let saving = $state(false);
  let error = $state<string | null>(null);
  let successMessage = $state<string | null>(null);
  let nginxReloading = $state(false);
  let nginxMessage = $state<string | null>(null);

  let savedSettings = $state<AllSettings | null>(null);
  let currentSettings = $state<AllSettings | null>(null);

  // ─── Tabs Config ─────────────────────────────────────────────
  const tabs: { key: TabKey; label: string; icon: typeof Settings }[] = [
    { key: 'overview', label: 'نظرة عامة', icon: Activity },
    { key: 'domains', label: 'النطاقات', icon: Globe },
    { key: 'ssl', label: 'SSL', icon: Lock },
    { key: 'security', label: 'الأمان', icon: Shield },
    { key: 'features', label: 'الميزات', icon: Wrench }
  ];

  // ─── Derived ─────────────────────────────────────────────────
  let hasChanges = $derived.by(() => {
    if (!savedSettings || !currentSettings) return false;
    return JSON.stringify(savedSettings) !== JSON.stringify(currentSettings);
  });

  let changedCategories = $derived.by(() => {
    if (!savedSettings || !currentSettings) return new Set<string>();
    const changed = new Set<string>();
    const categories: (keyof AllSettings)[] = ['domains', 'ssl', 'security', 'features'];
    for (const cat of categories) {
      if (JSON.stringify(savedSettings[cat]) !== JSON.stringify(currentSettings[cat])) {
        changed.add(cat);
      }
    }
    return changed;
  });

  let securityScore = $derived.by(() => {
    if (!currentSettings) return 0;
    return [currentSettings.security.registration_enabled, currentSettings.security.two_fa_enabled, currentSettings.security.kyc_required, currentSettings.security.max_login_attempts >= 3].filter(Boolean).length;
  });

  let enabledFeaturesCount = $derived.by(() => {
    if (!currentSettings) return 0;
    return [currentSettings.features.p2p_enabled, currentSettings.features.futures_enabled, currentSettings.features.staking_enabled, currentSettings.features.referral_enabled, currentSettings.features.ads_enabled].filter(Boolean).length;
  });

  // ─── Data Loading ────────────────────────────────────────────
  async function fetchSettings() {
    error = null;
    try {
      const res = await authGet('/api/v1/admin/settings');
      if (!res.ok) throw new Error('فشل تحميل الإعدادات');
      const json = await res.json();
      if (json.success && json.data) {
        savedSettings = JSON.parse(JSON.stringify(json.data));
        currentSettings = JSON.parse(JSON.stringify(json.data));
      }
    } catch (e: any) {
      error = e.message || 'حدث خطأ أثناء تحميل الإعدادات';
    } finally {
      loading = false;
    }
  }

  // ─── Save ────────────────────────────────────────────────────
  async function saveSettings() {
    if (!hasChanges || !savedSettings || !currentSettings) return;
    saving = true;
    successMessage = null;
    error = null;

    try {
      const payload: Record<string, any> = {};
      for (const cat of changedCategories) {
        payload[cat] = currentSettings[cat as keyof AllSettings];
      }

      const res = await authPut('/api/v1/admin/settings', payload);
      if (!res.ok) throw new Error('فشل حفظ الإعدادات');
      const json = await res.json();
      if (json.success) {
        savedSettings = JSON.parse(JSON.stringify(currentSettings));
        successMessage = 'تم حفظ الإعدادات بنجاح';
        setTimeout(() => { successMessage = null; }, 4000);
      } else {
        throw new Error(json.message || 'فشل حفظ الإعدادات');
      }
    } catch (e: any) {
      error = e.message || 'حدث خطأ أثناء حفظ الإعدادات';
    } finally {
      saving = false;
    }
  }

  // ─── Revert ──────────────────────────────────────────────────
  function revertChanges() {
    if (savedSettings) {
      currentSettings = JSON.parse(JSON.stringify(savedSettings));
    }
  }

  // ─── Nginx Reload ────────────────────────────────────────────
  async function reloadNginx() {
    nginxReloading = true;
    nginxMessage = null;
    try {
      const res = await authPost('/api/v1/admin/nginx/reload');
      const json = await res.json();
      if (json.success) {
        nginxMessage = 'تم إعادة تحميل Nginx بنجاح';
      } else {
        nginxMessage = 'فشل إعادة تحميل Nginx';
      }
    } catch {
      nginxMessage = 'فشل الاتصال بالخادم';
    } finally {
      nginxReloading = false;
      setTimeout(() => { nginxMessage = null; }, 4000);
    }
  }

  // ─── Toggle Helper ───────────────────────────────────────────
  function toggleField(category: keyof AllSettings, field: string) {
    if (!currentSettings) return;
    const cat = currentSettings[category] as Record<string, any>;
    cat[field] = !cat[field];
    currentSettings = { ...currentSettings };
  }

  // ─── Field Update Helper ─────────────────────────────────────
  function updateField(category: keyof AllSettings, field: string, value: any) {
    if (!currentSettings) return;
    const cat = currentSettings[category] as Record<string, any>;
    cat[field] = value;
    currentSettings = { ...currentSettings };
  }

  // ─── Lifecycle ───────────────────────────────────────────────
  onMount(() => {
    fetchSettings();
  });
</script>

<!-- Aurora Background -->
<div class="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
  <div class="absolute -top-32 right-1/4 w-[500px] h-[500px] rounded-full opacity-[0.06] blur-[120px]" style="background: var(--accent-gold);"></div>
  <div class="absolute top-1/3 -left-20 w-[400px] h-[400px] rounded-full opacity-[0.05] blur-[100px]" style="background: var(--accent-violet);"></div>
  <div class="absolute bottom-10 right-10 w-[350px] h-[350px] rounded-full opacity-[0.04] blur-[100px]" style="background: var(--accent-mint);"></div>
</div>

<div class="relative z-10 space-y-6">
  <!-- Page Header -->
  <PageHeader title="إعدادات النظام" subtitle="إدارة إعدادات المنصة">
    {#if hasChanges}
      <button
        class="btn-ghost flex items-center gap-2 text-sm"
        onclick={revertChanges}
        disabled={saving}
      >
        <RefreshCw size={16} />
        <span>تراجع</span>
      </button>
    {/if}
    <button
      class="btn-primary flex items-center gap-2 text-sm"
      onclick={saveSettings}
      disabled={!hasChanges || saving}
    >
      {#if saving}
        <Loader2 size={16} class="animate-spin" />
        <span>جاري الحفظ...</span>
      {:else}
        <Save size={16} />
        <span>حفظ التغييرات</span>
      {/if}
    </button>
  </PageHeader>

  <!-- Success Message -->
  {#if successMessage}
    <div class="panel p-4 flex items-center gap-3 animate-slide-down" style="border-color: rgba(34,211,164,0.2);">
      <CheckCircle2 size={20} class="shrink-0" style="color: #22d3a4;" />
      <p class="text-sm" style="color: #22d3a4;">{successMessage}</p>
    </div>
  {/if}

  <!-- Error Alert -->
  {#if error}
    <ErrorAlert message={error} onclose={() => { error = null; }} />
  {/if}

  <!-- Tab Bar -->
  <div class="panel p-1.5 flex items-center gap-1 overflow-x-auto scrollbar-none">
    {#each tabs as tab}
      <button
        class="tab-btn {activeTab === tab.key ? 'active' : ''}"
        onclick={() => activeTab = tab.key}
      >
        <tab.icon size={16} />
        <span>{tab.label}</span>
        {#if changedCategories.has(tab.key) && tab.key !== 'overview'}
          <span class="w-2 h-2 rounded-full bg-[#f5b544] shrink-0"></span>
        {/if}
      </button>
    {/each}
  </div>

  <!-- Loading State -->
  {#if loading}
    <div class="panel p-12 flex flex-col items-center justify-center gap-4">
      <Loader2 size={32} class="animate-spin" style="color: var(--text-quaternary);" />
      <p class="text-sm" style="color: var(--text-quaternary);">جاري تحميل الإعدادات...</p>
    </div>
  {:else if currentSettings}
    <!-- ═══════════════════════════════════════════════════════════ -->
    <!-- OVERVIEW TAB -->
    <!-- ═══════════════════════════════════════════════════════════ -->
    {#if activeTab === 'overview'}
      <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
        <!-- Domains Card -->
        <div class="panel p-6 space-y-4">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div class="flex items-center justify-center w-10 h-10 rounded-xl" style="background: rgba(59,130,246,0.1);">
                <Globe size={20} style="color: #3b82f6;" />
              </div>
              <div>
                <h3 class="font-bold text-sm">النطاقات</h3>
                <p class="text-xs" style="color: var(--text-quaternary);">إعدادات النطاق والـ DNS</p>
              </div>
            </div>
            <span class="status-pill active">مكوّن</span>
          </div>
          <div class="space-y-2">
            <div class="flex items-center justify-between py-2 px-3 rounded-lg" style="background: var(--bg-overlay-5);">
              <span class="text-xs" style="color: var(--text-tertiary);">النطاق الرئيسي</span>
              <span class="text-xs font-medium">{currentSettings.domains.main_domain || '—'}</span>
            </div>
            <div class="flex items-center justify-between py-2 px-3 rounded-lg" style="background: var(--bg-overlay-5);">
              <span class="text-xs" style="color: var(--text-tertiary);">نطاق الإدارة</span>
              <span class="text-xs font-medium">{currentSettings.domains.admin_domain || '—'}</span>
            </div>
            <div class="flex items-center justify-between py-2 px-3 rounded-lg" style="background: var(--bg-overlay-5);">
              <span class="text-xs" style="color: var(--text-tertiary);">نطاق API</span>
              <span class="text-xs font-medium">{currentSettings.domains.api_domain || '—'}</span>
            </div>
          </div>
          <button class="btn-ghost w-full text-xs justify-center" onclick={() => activeTab = 'domains'}>
            إدارة النطاقات
            <ExternalLink size={12} />
          </button>
        </div>

        <!-- SSL Card -->
        <div class="panel p-6 space-y-4">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div class="flex items-center justify-center w-10 h-10 rounded-xl" style="background: rgba(34,211,164,0.1);">
                <Lock size={20} style="color: #22d3a4;" />
              </div>
              <div>
                <h3 class="font-bold text-sm">شهادة SSL</h3>
                <p class="text-xs" style="color: var(--text-quaternary);">تشفير وإصدار الشهادات</p>
              </div>
            </div>
            <span class="status-pill {currentSettings.ssl.ssl_enabled ? 'active' : 'inactive'}">
              {currentSettings.ssl.ssl_enabled ? 'مفعّل' : 'معطّل'}
            </span>
          </div>
          <div class="space-y-2">
            <div class="flex items-center justify-between py-2 px-3 rounded-lg" style="background: var(--bg-overlay-5);">
              <span class="text-xs" style="color: var(--text-tertiary);">الحالة</span>
              <span class="text-xs font-medium" style="color: {currentSettings.ssl.ssl_enabled ? '#22d3a4' : '#f43f7a'};">
                {currentSettings.ssl.ssl_enabled ? 'مفعّل' : 'معطّل'}
              </span>
            </div>
            <div class="flex items-center justify-between py-2 px-3 rounded-lg" style="background: var(--bg-overlay-5);">
              <span class="text-xs" style="color: var(--text-tertiary);">النوع</span>
              <span class="text-xs font-medium">{currentSettings.ssl.ssl_type === 'letsencrypt' ? "Let's Encrypt" : 'مخصص'}</span>
            </div>
            <div class="flex items-center justify-between py-2 px-3 rounded-lg" style="background: var(--bg-overlay-5);">
              <span class="text-xs" style="color: var(--text-tertiary);">البريد الإلكتروني</span>
              <span class="text-xs font-medium">{currentSettings.ssl.ssl_email || '—'}</span>
            </div>
          </div>
          <button class="btn-ghost w-full text-xs justify-center" onclick={() => activeTab = 'ssl'}>
            إدارة SSL
            <ExternalLink size={12} />
          </button>
        </div>

        <!-- Security Card -->
        <div class="panel p-6 space-y-4">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div class="flex items-center justify-center w-10 h-10 rounded-xl" style="background: rgba(168,85,247,0.1);">
                <Shield size={20} style="color: #a855f7;" />
              </div>
              <div>
                <h3 class="font-bold text-sm">الأمان</h3>
                <p class="text-xs" style="color: var(--text-quaternary);">التسجيل والمصادقة والتحقق</p>
              </div>
            </div>
            <span class="status-pill {currentSettings.security.two_fa_enabled ? 'active' : 'inactive'}">
              {currentSettings.security.two_fa_enabled ? 'محمي' : 'تحذير'}
            </span>
          </div>
          <div class="space-y-2">
            <div class="flex items-center justify-between py-2 px-3 rounded-lg" style="background: var(--bg-overlay-5);">
              <span class="text-xs" style="color: var(--text-tertiary);">التسجيل</span>
              <span class="text-xs font-medium" style="color: {currentSettings.security.registration_enabled ? '#22d3a4' : '#f43f7a'};">
                {currentSettings.security.registration_enabled ? 'مفتوح' : 'مغلق'}
              </span>
            </div>
            <div class="flex items-center justify-between py-2 px-3 rounded-lg" style="background: var(--bg-overlay-5);">
              <span class="text-xs" style="color: var(--text-tertiary);">المصادقة الثنائية</span>
              <span class="text-xs font-medium" style="color: {currentSettings.security.two_fa_enabled ? '#22d3a4' : '#f43f7a'};">
                {currentSettings.security.two_fa_enabled ? 'مفعّلة' : 'معطّلة'}
              </span>
            </div>
            <div class="flex items-center justify-between py-2 px-3 rounded-lg" style="background: var(--bg-overlay-5);">
              <span class="text-xs" style="color: var(--text-tertiary);">التحقق KYC</span>
              <span class="text-xs font-medium" style="color: {currentSettings.security.kyc_required ? '#22d3a4' : '#f43f7a'};">
                {currentSettings.security.kyc_required ? 'مطلوب' : 'اختياري'}
              </span>
            </div>
            <div class="flex items-center justify-between py-2 px-3 rounded-lg" style="background: var(--bg-overlay-5);">
              <span class="text-xs" style="color: var(--text-tertiary);">حد المحاولات</span>
              <span class="text-xs font-medium">{currentSettings.security.max_login_attempts} محاولات</span>
            </div>
          </div>
          <button class="btn-ghost w-full text-xs justify-center" onclick={() => activeTab = 'security'}>
            إدارة الأمان
            <ExternalLink size={12} />
          </button>
        </div>

        <!-- Features Card -->
        <div class="panel p-6 space-y-4">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div class="flex items-center justify-center w-10 h-10 rounded-xl" style="background: rgba(245,181,68,0.1);">
                <Wrench size={20} style="color: #f5b544;" />
              </div>
              <div>
                <h3 class="font-bold text-sm">الميزات</h3>
                <p class="text-xs" style="color: var(--text-quaternary);">التحكم في ميزات المنصة</p>
              </div>
            </div>
            <span class="status-pill active">نشط</span>
          </div>
          <div class="space-y-2">
            <div class="flex items-center justify-between py-2 px-3 rounded-lg" style="background: var(--bg-overlay-5);">
              <span class="text-xs" style="color: var(--text-tertiary);">تداول P2P</span>
              <span class="text-xs font-medium" style="color: {currentSettings.features.p2p_enabled ? '#22d3a4' : '#f43f7a'};">
                {currentSettings.features.p2p_enabled ? 'مفعّل' : 'معطّل'}
              </span>
            </div>
            <div class="flex items-center justify-between py-2 px-3 rounded-lg" style="background: var(--bg-overlay-5);">
              <span class="text-xs" style="color: var(--text-tertiary);">العقود الآجلة</span>
              <span class="text-xs font-medium" style="color: {currentSettings.features.futures_enabled ? '#22d3a4' : '#f43f7a'};">
                {currentSettings.features.futures_enabled ? 'مفعّل' : 'معطّل'}
              </span>
            </div>
            <div class="flex items-center justify-between py-2 px-3 rounded-lg" style="background: var(--bg-overlay-5);">
              <span class="text-xs" style="color: var(--text-tertiary);">الستيكينغ</span>
              <span class="text-xs font-medium" style="color: {currentSettings.features.staking_enabled ? '#22d3a4' : '#f43f7a'};">
                {currentSettings.features.staking_enabled ? 'مفعّل' : 'معطّل'}
              </span>
            </div>
            <div class="flex items-center justify-between py-2 px-3 rounded-lg" style="background: var(--bg-overlay-5);">
              <span class="text-xs" style="color: var(--text-tertiary);">الإحالة</span>
              <span class="text-xs font-medium" style="color: {currentSettings.features.referral_enabled ? '#22d3a4' : '#f43f7a'};">
                {currentSettings.features.referral_enabled ? 'مفعّل' : 'معطّل'}
              </span>
            </div>
            <div class="flex items-center justify-between py-2 px-3 rounded-lg" style="background: var(--bg-overlay-5);">
              <span class="text-xs" style="color: var(--text-tertiary);">الإعلانات</span>
              <span class="text-xs font-medium" style="color: {currentSettings.features.ads_enabled ? '#22d3a4' : '#f43f7a'};">
                {currentSettings.features.ads_enabled ? 'مفعّل' : 'معطّل'}
              </span>
            </div>
          </div>
          <button class="btn-ghost w-full text-xs justify-center" onclick={() => activeTab = 'features'}>
            إدارة الميزات
            <ExternalLink size={12} />
          </button>
        </div>
      </div>
    {/if}

    <!-- ═══════════════════════════════════════════════════════════ -->
    <!-- DOMAINS TAB -->
    <!-- ═══════════════════════════════════════════════════════════ -->
    {#if activeTab === 'domains'}
      <div class="panel p-6 space-y-6">
        <div class="flex items-center gap-3">
          <div class="flex items-center justify-center w-10 h-10 rounded-xl" style="background: rgba(59,130,246,0.1);">
            <Globe size={20} style="color: #3b82f6;" />
          </div>
          <div>
            <h2 class="text-lg font-bold">إعدادات النطاقات</h2>
            <p class="text-xs" style="color: var(--text-quaternary);">تكوين النطاقات الرئيسية للمنصة</p>
          </div>
        </div>

        <div class="glass-divider"></div>

        <div class="space-y-5">
          <!-- Main Domain -->
          <div class="space-y-2">
            <label class="text-sm font-medium" style="color: var(--text-secondary);">
              <span class="flex items-center gap-2">
                <Server size={14} style="color: var(--accent-azure);" />
                النطاق الرئيسي
              </span>
            </label>
            <input
              type="text"
              class="input-field w-full"
              placeholder="example.com"
              value={currentSettings.domains.main_domain}
              oninput={(e) => updateField('domains', 'main_domain', (e.target as HTMLInputElement).value)}
              dir="ltr"
            />
            <p class="text-xs" style="color: var(--text-quaternary);">النطاق الأساسي للموقع</p>
          </div>

          <!-- Admin Domain -->
          <div class="space-y-2">
            <label class="text-sm font-medium" style="color: var(--text-secondary);">
              <span class="flex items-center gap-2">
                <ShieldCheck size={14} style="color: var(--accent-violet);" />
                نطاق لوحة الإدارة
              </span>
            </label>
            <input
              type="text"
              class="input-field w-full"
              placeholder="admin.example.com"
              value={currentSettings.domains.admin_domain}
              oninput={(e) => updateField('domains', 'admin_domain', (e.target as HTMLInputElement).value)}
              dir="ltr"
            />
            <p class="text-xs" style="color: var(--text-quaternary);">النطاق المخصص للوحة التحكم</p>
          </div>

          <!-- API Domain -->
          <div class="space-y-2">
            <label class="text-sm font-medium" style="color: var(--text-secondary);">
              <span class="flex items-center gap-2">
                <Wifi size={14} style="color: var(--accent-mint);" />
                نطاق API
              </span>
            </label>
            <input
              type="text"
              class="input-field w-full"
              placeholder="api.example.com"
              value={currentSettings.domains.api_domain}
              oninput={(e) => updateField('domains', 'api_domain', (e.target as HTMLInputElement).value)}
              dir="ltr"
            />
            <p class="text-xs" style="color: var(--text-quaternary);">النطاق المخصص لواجهة البرمجة</p>
          </div>
        </div>

        <div class="glass-divider"></div>

        <!-- Nginx Reload -->
        <div class="flex items-center justify-between p-4 rounded-xl" style="background: var(--bg-overlay-5);">
          <div class="flex items-center gap-3">
            <div class="flex items-center justify-center w-9 h-9 rounded-lg" style="background: rgba(59,130,246,0.08);">
              <RefreshCw size={16} style="color: #3b82f6;" class={nginxReloading ? 'animate-spin' : ''} />
            </div>
            <div>
              <p class="text-sm font-medium">إعادة تحميل Nginx</p>
              <p class="text-xs" style="color: var(--text-quaternary);">تطبيق التغييرات على خادم الويب</p>
            </div>
          </div>
          <div class="flex items-center gap-3">
            {#if nginxMessage}
              <span class="text-xs" style="color: {nginxMessage.includes('بنجاح') ? '#22d3a4' : '#f43f7a'};">
                {nginxMessage}
              </span>
            {/if}
            <button
              class="btn-ghost flex items-center gap-2 text-xs"
              onclick={reloadNginx}
              disabled={nginxReloading}
            >
              {#if nginxReloading}
                <Loader2 size={14} class="animate-spin" />
              {:else}
                <RefreshCw size={14} />
              {/if}
              <span>إعادة تحميل</span>
            </button>
          </div>
        </div>
      </div>
    {/if}

    <!-- ═══════════════════════════════════════════════════════════ -->
    <!-- SSL TAB -->
    <!-- ═══════════════════════════════════════════════════════════ -->
    {#if activeTab === 'ssl'}
      <div class="panel p-6 space-y-6">
        <div class="flex items-center gap-3">
          <div class="flex items-center justify-center w-10 h-10 rounded-xl" style="background: rgba(34,211,164,0.1);">
            <Lock size={20} style="color: #22d3a4;" />
          </div>
          <div>
            <h2 class="text-lg font-bold">إعدادات SSL</h2>
            <p class="text-xs" style="color: var(--text-quaternary);">إدارة شهادات الأمان والتشفير</p>
          </div>
        </div>

        <div class="glass-divider"></div>

        <div class="space-y-5">
          <!-- SSL Enabled Toggle -->
          <div class="flex items-center justify-between p-4 rounded-xl" style="background: var(--bg-overlay-5);">
            <div class="flex items-center gap-3">
              <div class="flex items-center justify-center w-9 h-9 rounded-lg" style="background: rgba(34,211,164,0.08);">
                <ShieldCheck size={16} style="color: #22d3a4;" />
              </div>
              <div>
                <p class="text-sm font-medium">تفعيل SSL</p>
                <p class="text-xs" style="color: var(--text-quaternary);">تشغيل تشفير HTTPS لجميع النطاقات</p>
              </div>
            </div>
            <button
              class="toggle-track {currentSettings.ssl.ssl_enabled ? 'active' : ''}"
              onclick={() => toggleField('ssl', 'ssl_enabled')}
              role="switch"
              aria-checked={currentSettings.ssl.ssl_enabled}
            >
              <span class="toggle-thumb"></span>
            </button>
          </div>

          <!-- SSL Email -->
          <div class="space-y-2">
            <label class="text-sm font-medium" style="color: var(--text-secondary);">
              <span class="flex items-center gap-2">
                <Zap size={14} style="color: var(--accent-gold);" />
                البريد الإلكتروني لـ SSL
              </span>
            </label>
            <input
              type="email"
              class="input-field w-full"
              placeholder="admin@example.com"
              value={currentSettings.ssl.ssl_email}
              oninput={(e) => updateField('ssl', 'ssl_email', (e.target as HTMLInputElement).value)}
              dir="ltr"
            />
            <p class="text-xs" style="color: var(--text-quaternary);">البريد الإلكتروني المستخدم لإشعارات SSL وتجديد الشهادات</p>
          </div>

          <!-- SSL Type Select -->
          <div class="space-y-2">
            <label class="text-sm font-medium" style="color: var(--text-secondary);">
              <span class="flex items-center gap-2">
                <Lock size={14} style="color: var(--accent-azure);" />
                نوع الشهادة
              </span>
            </label>
            <select
              class="input-field w-full"
              value={currentSettings.ssl.ssl_type}
              onchange={(e) => updateField('ssl', 'ssl_type', (e.target as HTMLSelectElement).value)}
            >
              <option value="letsencrypt">Let's Encrypt (تلقائي)</option>
              <option value="custom">شهادة مخصصة</option>
            </select>
            <p class="text-xs" style="color: var(--text-quaternary);">
              {#if currentSettings.ssl.ssl_type === 'letsencrypt'}
                سيتم إصدار وتجديد الشهادات تلقائياً عبر Let's Encrypt
              {:else}
                يجب رفع شهادة SSL مخصصة يدوياً على الخادم
              {/if}
            </p>
          </div>
        </div>

        <!-- SSL Status Banner -->
        <div class="p-4 rounded-xl border" style="background: {currentSettings.ssl.ssl_enabled ? 'rgba(34,211,164,0.05)' : 'rgba(244,63,122,0.05)'}; border-color: {currentSettings.ssl.ssl_enabled ? 'rgba(34,211,164,0.15)' : 'rgba(244,63,122,0.15)'};">
          <div class="flex items-center gap-3">
            {#if currentSettings.ssl.ssl_enabled}
              <CheckCircle2 size={20} style="color: #22d3a4;" />
              <div>
                <p class="text-sm font-medium" style="color: #22d3a4;">SSL مفعّل</p>
                <p class="text-xs" style="color: var(--text-quaternary);">جميع الاتصالات مشفرة وآمنة</p>
              </div>
            {:else}
              <AlertCircle size={20} style="color: #f43f7a;" />
              <div>
                <p class="text-sm font-medium" style="color: #f43f7a;">SSL معطّل</p>
                <p class="text-xs" style="color: var(--text-quaternary);">الاتصالات غير مشفرة — يُنصح بتفعيل SSL فوراً</p>
              </div>
            {/if}
          </div>
        </div>
      </div>
    {/if}

    <!-- ═══════════════════════════════════════════════════════════ -->
    <!-- SECURITY TAB -->
    <!-- ═══════════════════════════════════════════════════════════ -->
    {#if activeTab === 'security'}
      <div class="panel p-6 space-y-6">
        <div class="flex items-center gap-3">
          <div class="flex items-center justify-center w-10 h-10 rounded-xl" style="background: rgba(168,85,247,0.1);">
            <Shield size={20} style="color: #a855f7;" />
          </div>
          <div>
            <h2 class="text-lg font-bold">إعدادات الأمان</h2>
            <p class="text-xs" style="color: var(--text-quaternary);">التحكم في سياسات الأمان والمصادقة</p>
          </div>
        </div>

        <div class="glass-divider"></div>

        <div class="space-y-4">
          <!-- Registration Enabled -->
          <div class="flex items-center justify-between p-4 rounded-xl" style="background: var(--bg-overlay-5);">
            <div class="flex items-center gap-3">
              <div class="flex items-center justify-center w-9 h-9 rounded-lg" style="background: rgba(59,130,246,0.08);">
                <Users size={16} style="color: #3b82f6;" />
              </div>
              <div>
                <p class="text-sm font-medium">فتح التسجيل</p>
                <p class="text-xs" style="color: var(--text-quaternary);">السماح للمستخدمين الجدد بإنشاء حسابات</p>
              </div>
            </div>
            <button
              class="toggle-track {currentSettings.security.registration_enabled ? 'active' : ''}"
              onclick={() => toggleField('security', 'registration_enabled')}
              role="switch"
              aria-checked={currentSettings.security.registration_enabled}
            >
              <span class="toggle-thumb"></span>
            </button>
          </div>

          <!-- Two-Factor Authentication -->
          <div class="flex items-center justify-between p-4 rounded-xl" style="background: var(--bg-overlay-5);">
            <div class="flex items-center gap-3">
              <div class="flex items-center justify-center w-9 h-9 rounded-lg" style="background: rgba(168,85,247,0.08);">
                <ShieldCheck size={16} style="color: #a855f7;" />
              </div>
              <div>
                <p class="text-sm font-medium">المصادقة الثنائية (2FA)</p>
                <p class="text-xs" style="color: var(--text-quaternary);">إلزام المستخدمين بتفعيل المصادقة الثنائية</p>
              </div>
            </div>
            <button
              class="toggle-track {currentSettings.security.two_fa_enabled ? 'active' : ''}"
              onclick={() => toggleField('security', 'two_fa_enabled')}
              role="switch"
              aria-checked={currentSettings.security.two_fa_enabled}
            >
              <span class="toggle-thumb"></span>
            </button>
          </div>

          <!-- KYC Required -->
          <div class="flex items-center justify-between p-4 rounded-xl" style="background: var(--bg-overlay-5);">
            <div class="flex items-center gap-3">
              <div class="flex items-center justify-center w-9 h-9 rounded-lg" style="background: rgba(34,211,164,0.08);">
                <ShieldCheck size={16} style="color: #22d3a4;" />
              </div>
              <div>
                <p class="text-sm font-medium">إلزام التحقق KYC</p>
                <p class="text-xs" style="color: var(--text-quaternary);">طلب التحقق من الهوية قبل إجراء المعاملات</p>
              </div>
            </div>
            <button
              class="toggle-track {currentSettings.security.kyc_required ? 'active' : ''}"
              onclick={() => toggleField('security', 'kyc_required')}
              role="switch"
              aria-checked={currentSettings.security.kyc_required}
            >
              <span class="toggle-thumb"></span>
            </button>
          </div>

          <!-- Max Login Attempts -->
          <div class="p-4 rounded-xl space-y-3" style="background: var(--bg-overlay-5);">
            <div class="flex items-center gap-3">
              <div class="flex items-center justify-center w-9 h-9 rounded-lg" style="background: rgba(244,63,122,0.08);">
                <Lock size={16} style="color: #f43f7a;" />
              </div>
              <div>
                <p class="text-sm font-medium">الحد الأقصى لمحاولات تسجيل الدخول</p>
                <p class="text-xs" style="color: var(--text-quaternary);">عدد المحاولات المسموح بها قبل حظر الحساب مؤقتاً</p>
              </div>
            </div>
            <div class="flex items-center gap-4">
              <input
                type="number"
                class="input-field w-32 text-center"
                min="1"
                max="20"
                value={currentSettings.security.max_login_attempts}
                oninput={(e) => {
                  const val = parseInt((e.target as HTMLInputElement).value) || 5;
                  updateField('security', 'max_login_attempts', Math.max(1, Math.min(20, val)));
                }}
              />
              <span class="text-xs" style="color: var(--text-quaternary);">محاولة (1 - 20)</span>
            </div>
          </div>
        </div>

        <!-- Security Score -->
        <div class="p-4 rounded-xl border" style="background: rgba(168,85,247,0.03); border-color: rgba(168,85,247,0.12);">
          <div class="flex items-center gap-3 mb-3">
            <Shield size={18} style="color: #a855f7;" />
            <p class="text-sm font-bold" style="color: #a855f7;">مستوى الأمان</p>
          </div>
          <div class="flex items-center gap-3">
            <div class="flex-1 h-2 rounded-full overflow-hidden" style="background: var(--bg-overlay-10);">
              <div
                class="h-full rounded-full transition-all duration-700"
                style="width: {(securityScore / 4) * 100}%; background: {securityScore >= 3 ? '#22d3a4' : securityScore >= 2 ? '#f5b544' : '#f43f7a'};"
              ></div>
            </div>
            <span class="text-xs font-bold tabular-nums" style="color: {securityScore >= 3 ? '#22d3a4' : securityScore >= 2 ? '#f5b544' : '#f43f7a'};">{securityScore}/4</span>
          </div>
          <p class="text-xs mt-2" style="color: var(--text-quaternary);">
            {#if securityScore >= 3}
              مستوى أمان عالي — معظم إعدادات الحماية مفعّلة
            {:else if securityScore >= 2}
              مستوى أمان متوسط — يُنصح بتفعيل المزيد من إعدادات الحماية
            {:else}
              مستوى أمان منخفض — يجب تفعيل إعدادات الحماية الأساسية فوراً
            {/if}
          </p>
        </div>
      </div>
    {/if}

    <!-- ═══════════════════════════════════════════════════════════ -->
    <!-- FEATURES TAB -->
    <!-- ═══════════════════════════════════════════════════════════ -->
    {#if activeTab === 'features'}
      <div class="panel p-6 space-y-6">
        <div class="flex items-center gap-3">
          <div class="flex items-center justify-center w-10 h-10 rounded-xl" style="background: rgba(245,181,68,0.1);">
            <Wrench size={20} style="color: #f5b544;" />
          </div>
          <div>
            <h2 class="text-lg font-bold">إعدادات الميزات</h2>
            <p class="text-xs" style="color: var(--text-quaternary);">التحكم في ميزات المنصة المتاحة للمستخدمين</p>
          </div>
        </div>

        <div class="glass-divider"></div>

        <div class="space-y-4">
          <!-- P2P Trading -->
          <div class="flex items-center justify-between p-4 rounded-xl" style="background: var(--bg-overlay-5);">
            <div class="flex items-center gap-3">
              <div class="flex items-center justify-center w-9 h-9 rounded-lg" style="background: rgba(59,130,246,0.08);">
                <ArrowLeftRight size={16} style="color: #3b82f6;" />
              </div>
              <div>
                <p class="text-sm font-medium">تداول P2P</p>
                <p class="text-xs" style="color: var(--text-quaternary);">السماح بالتداول المباشر بين المستخدمين</p>
              </div>
            </div>
            <button
              class="toggle-track {currentSettings.features.p2p_enabled ? 'active' : ''}"
              onclick={() => toggleField('features', 'p2p_enabled')}
              role="switch"
              aria-checked={currentSettings.features.p2p_enabled}
            >
              <span class="toggle-thumb"></span>
            </button>
          </div>

          <!-- Futures Trading -->
          <div class="flex items-center justify-between p-4 rounded-xl" style="background: var(--bg-overlay-5);">
            <div class="flex items-center gap-3">
              <div class="flex items-center justify-center w-9 h-9 rounded-lg" style="background: rgba(245,181,68,0.08);">
                <Rocket size={16} style="color: #f5b544;" />
              </div>
              <div>
                <p class="text-sm font-medium">العقود الآجلة</p>
                <p class="text-xs" style="color: var(--text-quaternary);">تفعيل تداول العقود الآجلة والرافعة المالية</p>
              </div>
            </div>
            <button
              class="toggle-track {currentSettings.features.futures_enabled ? 'active' : ''}"
              onclick={() => toggleField('features', 'futures_enabled')}
              role="switch"
              aria-checked={currentSettings.features.futures_enabled}
            >
              <span class="toggle-thumb"></span>
            </button>
          </div>

          <!-- Staking -->
          <div class="flex items-center justify-between p-4 rounded-xl" style="background: var(--bg-overlay-5);">
            <div class="flex items-center gap-3">
              <div class="flex items-center justify-center w-9 h-9 rounded-lg" style="background: rgba(34,211,164,0.08);">
                <Zap size={16} style="color: #22d3a4;" />
              </div>
              <div>
                <p class="text-sm font-medium">الستيكينغ</p>
                <p class="text-xs" style="color: var(--text-quaternary);">تفعيل ميزة حجز العملات وكسب المكافآت</p>
              </div>
            </div>
            <button
              class="toggle-track {currentSettings.features.staking_enabled ? 'active' : ''}"
              onclick={() => toggleField('features', 'staking_enabled')}
              role="switch"
              aria-checked={currentSettings.features.staking_enabled}
            >
              <span class="toggle-thumb"></span>
            </button>
          </div>

          <!-- Referral -->
          <div class="flex items-center justify-between p-4 rounded-xl" style="background: var(--bg-overlay-5);">
            <div class="flex items-center gap-3">
              <div class="flex items-center justify-center w-9 h-9 rounded-lg" style="background: rgba(168,85,247,0.08);">
                <Users size={16} style="color: #a855f7;" />
              </div>
              <div>
                <p class="text-sm font-medium">برنامج الإحالة</p>
                <p class="text-xs" style="color: var(--text-quaternary);">تفعيل نظام الدعوات والمكافآت</p>
              </div>
            </div>
            <button
              class="toggle-track {currentSettings.features.referral_enabled ? 'active' : ''}"
              onclick={() => toggleField('features', 'referral_enabled')}
              role="switch"
              aria-checked={currentSettings.features.referral_enabled}
            >
              <span class="toggle-thumb"></span>
            </button>
          </div>

          <!-- Ads -->
          <div class="flex items-center justify-between p-4 rounded-xl" style="background: var(--bg-overlay-5);">
            <div class="flex items-center gap-3">
              <div class="flex items-center justify-center w-9 h-9 rounded-lg" style="background: rgba(244,63,122,0.08);">
                <Megaphone size={16} style="color: #f43f7a;" />
              </div>
              <div>
                <p class="text-sm font-medium">الإعلانات</p>
                <p class="text-xs" style="color: var(--text-quaternary);">تفعيل نظام الإعلانات على المنصة</p>
              </div>
            </div>
            <button
              class="toggle-track {currentSettings.features.ads_enabled ? 'active' : ''}"
              onclick={() => toggleField('features', 'ads_enabled')}
              role="switch"
              aria-checked={currentSettings.features.ads_enabled}
            >
              <span class="toggle-thumb"></span>
            </button>
          </div>
        </div>

        <!-- Active Features Summary -->
        <div class="p-4 rounded-xl border" style="background: rgba(245,181,68,0.03); border-color: rgba(245,181,68,0.12);">
          <div class="flex items-center gap-3 mb-3">
            <Activity size={18} style="color: #f5b544;" />
            <p class="text-sm font-bold" style="color: #f5b544;">ملخص الميزات النشطة</p>
          </div>
          <div class="flex items-center gap-4 flex-wrap">
            <div class="flex items-center gap-2 px-3 py-1.5 rounded-lg" style="background: rgba(34,211,164,0.08);">
              <CheckCircle2 size={14} style="color: #22d3a4;" />
              <span class="text-xs font-medium" style="color: #22d3a4;">{enabledFeaturesCount} مفعّلة</span>
            </div>
            <div class="flex items-center gap-2 px-3 py-1.5 rounded-lg" style="background: rgba(244,63,122,0.08);">
              <AlertCircle size={14} style="color: #f43f7a;" />
              <span class="text-xs font-medium" style="color: #f43f7a;">{5 - enabledFeaturesCount} معطّلة</span>
            </div>
          </div>
        </div>
      </div>
    {/if}
  {:else if !loading}
    <div class="panel p-12 flex flex-col items-center justify-center gap-4">
      <AlertCircle size={32} style="color: var(--text-quaternary);" />
      <p class="text-sm" style="color: var(--text-quaternary);">فشل تحميل الإعدادات</p>
      <button class="btn-ghost flex items-center gap-2 text-sm" onclick={fetchSettings}>
        <RefreshCw size={14} />
        <span>إعادة المحاولة</span>
      </button>
    </div>
  {/if}

  <!-- Unsaved Changes Footer -->
  {#if hasChanges && !loading}
    <div class="fixed bottom-0 left-0 right-0 z-50 animate-slide-up" style="margin-right: var(--sidebar-width, 272px);">
      <div class="mx-6 mb-4 panel p-4 flex items-center justify-between" style="border-color: rgba(245,181,68,0.25); background: rgba(245,181,68,0.05);">
        <div class="flex items-center gap-3">
          <AlertCircle size={18} style="color: #f5b544;" />
          <p class="text-sm" style="color: #f5b544;">لديك تغييرات غير محفوظة</p>
        </div>
        <div class="flex items-center gap-3">
          <button class="btn-ghost text-xs" onclick={revertChanges} disabled={saving}>
            تراجع
          </button>
          <button
            class="btn-primary flex items-center gap-2 text-xs"
            onclick={saveSettings}
            disabled={saving}
          >
            {#if saving}
              <Loader2 size={14} class="animate-spin" />
              <span>جاري الحفظ...</span>
            {:else}
              <Save size={14} />
              <span>حفظ التغييرات</span>
            {/if}
          </button>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  /* ─── Status Pill ─────────────────────────────────────────── */
  .status-pill {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 10px;
    border-radius: 9999px;
    font-size: 11px;
    font-weight: 600;
    white-space: nowrap;
    line-height: 1;
  }
  .status-pill.active {
    background: rgba(34, 211, 164, 0.1);
    color: #22d3a4;
    border: 1px solid rgba(34, 211, 164, 0.2);
  }
  .status-pill.inactive {
    background: rgba(244, 63, 122, 0.1);
    color: #f43f7a;
    border: 1px solid rgba(244, 63, 122, 0.2);
  }

  /* ─── Toggle Track ────────────────────────────────────────── */
  .toggle-track {
    position: relative;
    display: flex;
    align-items: center;
    width: 44px;
    height: 24px;
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.1);
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    flex-shrink: 0;
    padding: 0;
  }
  .toggle-track:hover {
    background: rgba(255, 255, 255, 0.12);
  }
  .toggle-track.active {
    background: rgba(34, 211, 164, 0.25);
    border-color: rgba(34, 211, 164, 0.4);
  }

  /* ─── Toggle Thumb ────────────────────────────────────────── */
  .toggle-thumb {
    position: absolute;
    right: 3px;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.5);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
  }
  .toggle-track.active .toggle-thumb {
    right: 23px;
    background: #22d3a4;
    box-shadow: 0 0 8px rgba(34, 211, 164, 0.4), 0 1px 3px rgba(0, 0, 0, 0.3);
  }

  /* ─── Tab Button ──────────────────────────────────────────── */
  .tab-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 16px;
    border-radius: 10px;
    font-size: 13px;
    font-weight: 500;
    color: var(--text-tertiary);
    background: transparent;
    border: none;
    cursor: pointer;
    transition: all 0.2s ease;
    white-space: nowrap;
    font-family: inherit;
  }
  .tab-btn:hover {
    background: rgba(255, 255, 255, 0.04);
    color: var(--text-secondary);
  }
  .tab-btn.active {
    background: rgba(245, 181, 68, 0.1);
    color: #f5b544;
    box-shadow: 0 0 0 1px rgba(245, 181, 68, 0.15);
  }

  /* ─── Input Field ─────────────────────────────────────────── */
  .input-field {
    width: 100%;
    padding: 10px 14px;
    border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(255, 255, 255, 0.03);
    color: var(--text-primary);
    font-size: 14px;
    font-family: inherit;
    outline: none;
    transition: all 0.2s ease;
  }
  .input-field:focus {
    border-color: rgba(245, 181, 68, 0.4);
    background: rgba(255, 255, 255, 0.05);
    box-shadow: 0 0 0 3px rgba(245, 181, 68, 0.08);
  }
  .input-field::placeholder {
    color: var(--text-quaternary);
  }
  .input-field:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  select.input-field {
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: left 12px center;
    padding-left: 36px;
  }
  select.input-field option {
    background: #0f0f1a;
    color: var(--text-primary);
  }

  /* ─── Glass Divider ───────────────────────────────────────── */
  .glass-divider {
    height: 1px;
    background: linear-gradient(to left, transparent, rgba(255, 255, 255, 0.06), transparent);
  }

  /* ─── Panel ───────────────────────────────────────────────── */
  .panel {
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 16px;
    backdrop-filter: blur(12px);
  }

  /* ─── Animations ──────────────────────────────────────────── */
  @keyframes slide-up {
    from { transform: translateY(20px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }
  .animate-slide-up {
    animation: slide-up 0.3s ease-out;
  }

  @keyframes slide-down {
    from { transform: translateY(-10px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }
  .animate-slide-down {
    animation: slide-down 0.3s ease-out;
  }

  @keyframes scale-in {
    from { transform: scale(0.95); opacity: 0; }
    to { transform: scale(1); opacity: 1; }
  }
  .animate-scale-in {
    animation: scale-in 0.2s ease-out;
  }

  @keyframes fade-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  .animate-fade-in {
    animation: fade-in 0.3s ease-out;
  }
</style>
