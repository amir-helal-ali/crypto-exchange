<script lang="ts">
  import { onMount } from 'svelte';
  import {
    Settings,
    Globe,
    ShieldCheck,
    Lock,
    ToggleLeft,
    ToggleRight,
    Loader2,
    Save,
    AlertCircle,
    CheckCircle2,
    XCircle,
    RefreshCw,
    FileKey,
    Upload,
    Activity,
    Server,
    Wrench,
    MessageSquare,
    X,
    ExternalLink
  } from 'lucide-svelte';
  import { authGet, authPost, authPut, API } from '$lib/api/client';

  // ─── Tab System ───
  type TabId = 'overview' | 'domains' | 'ssl' | 'security' | 'features';
  interface TabDef {
    id: TabId;
    label: string;
    icon: typeof Settings;
  }
  const tabs: TabDef[] = [
    { id: 'overview', label: 'نظرة عامة', icon: Activity },
    { id: 'domains', label: 'النطاقات', icon: Globe },
    { id: 'ssl', label: 'SSL', icon: Lock },
    { id: 'security', label: 'الأمان', icon: ShieldCheck },
    { id: 'features', label: 'الميزات', icon: Wrench }
  ];
  let activeTab = $state<TabId>('overview');

  // ─── Settings State ───
  let settings = $state<Record<string, any>>({});
  let originalSettings = $state<Record<string, any>>({});
  let loading = $state(true);
  let error = $state<string | null>(null);
  let saving = $state(false);
  let saveSuccess = $state(false);
  let nginxReloading = $state(false);

  // ─── Changed Keys Tracking ───
  let changedKeys = $state<Set<string>>(new Set());

  function trackChange(key: string, value: any) {
    settings[key] = value;
    if (originalSettings[key] === value) {
      changedKeys.delete(key);
    } else {
      changedKeys.add(key);
    }
    changedKeys = new Set(changedKeys); // trigger reactivity
  }

  let hasChanges = $derived(changedKeys.size > 0);

  // ─── Domain Health ───
  interface DomainHealth {
    key: string;
    domain: string;
    status: 'checking' | 'up' | 'down';
    latency?: number;
  }
  let domainHealth = $state<DomainHealth[]>([]);
  let healthChecking = $state(false);

  // ─── SSL State ───
  interface SSLStatus {
    valid: boolean;
    issuer?: string;
    expires_at?: string;
    days_left?: number;
    domains?: string[];
    fingerprint?: string;
  }
  let sslStatus = $state<SSLStatus | null>(null);
  let sslLoading = $state(false);
  let sslGenerating = $state(false);
  let sslRenewing = $state(false);

  // SSL Generate form
  let sslGenType = $state<'local' | 'letsencrypt'>('letsencrypt');
  let sslGenDomains = $state('');
  let sslGenEmail = $state('');
  let sslGenStaging = $state(false);

  // SSL Install form
  let sslInstallOpen = $state(false);
  let sslInstallCert = $state('');
  let sslInstallKey = $state('');
  let sslInstallDomains = $state('');
  let sslInstalling = $state(false);

  // ─── Feature Flags ───
  interface FeatureFlag {
    key: string;
    label: string;
    description: string;
  }
  const featureFlags: FeatureFlag[] = [
    { key: 'feature_trading', label: 'التداول', description: 'تفعيل واجهة التداول للمستخدمين' },
    { key: 'feature_deposits', label: 'الإيداع', description: 'السماح بعمليات الإيداع' },
    { key: 'feature_withdrawals', label: 'السحب', description: 'السماح بعمليات السحب' },
    { key: 'feature_kyc', label: 'التحقق من الهوية', description: 'تفعيل متطلبات التحقق KYC' },
    { key: 'feature_referral', label: 'الإحالة', description: 'برنامج الإحالة والمكافآت' },
    { key: 'feature_api_access', label: 'الوصول عبر API', description: 'السماح بالوصول عبر واجهة برمجة التطبيقات' },
    { key: 'feature_notifications', label: 'الإشعارات', description: 'إرسال إشعارات البريد الإلكتروني والضغط' },
    { key: 'feature_p2p', label: 'التداول P2P', description: 'سوق التداول من نظير لنظير' }
  ];

  // ─── Fetch Settings ───
  async function fetchSettings() {
    loading = true;
    error = null;
    try {
      const res = await authGet('/api/v1/admin/settings');
      if (!res.ok) throw new Error('فشل تحميل الإعدادات');
      const json = await res.json();
      if (json.success) {
        settings = { ...json.data };
        originalSettings = { ...json.data };
        changedKeys = new Set();
      }
    } catch (e: any) {
      error = e.message;
    } finally {
      loading = false;
    }
  }

  // ─── Save Settings ───
  async function saveSettings() {
    if (!hasChanges) return;
    saving = true;
    saveSuccess = false;
    error = null;
    try {
      const changes: Record<string, any> = {};
      for (const key of changedKeys) {
        changes[key] = settings[key];
      }
      const res = await authPut('/api/v1/admin/settings', { settings: changes });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.message || 'فشل حفظ الإعدادات');
      }

      // If domain keys changed, reload nginx
      const domainKeys = ['frontend_domain', 'backend_domain', 'admin_domain', 'main_domain'];
      const hasDomainChanges = changedKeys.intersection
        ? changedKeys.intersection(new Set(domainKeys)).size > 0
        : [...changedKeys].some(k => domainKeys.includes(k));

      if (hasDomainChanges) {
        await reloadNginx();
      }

      originalSettings = { ...settings };
      changedKeys = new Set();
      saveSuccess = true;
      setTimeout(() => (saveSuccess = false), 3000);
    } catch (e: any) {
      error = e.message;
    } finally {
      saving = false;
    }
  }

  // ─── Reload Nginx ───
  async function reloadNginx() {
    nginxReloading = true;
    try {
      const res = await authPost('/api/v1/admin/nginx/reload');
      if (!res.ok) throw new Error('فشل إعادة تحميل Nginx');
    } catch (e: any) {
      error = e.message;
    } finally {
      nginxReloading = false;
    }
  }

  // ─── Domain Health Check ───
  async function checkDomainHealth() {
    healthChecking = true;
    const domainKeys = ['frontend_domain', 'backend_domain', 'admin_domain', 'main_domain'];
    const labelMap: Record<string, string> = {
      frontend_domain: 'الواجهة',
      backend_domain: 'الخادم',
      admin_domain: 'لوحة الإدارة',
      main_domain: 'النطاق الرئيسي'
    };

    domainHealth = domainKeys
      .filter(k => settings[k])
      .map(k => ({
        key: k,
        domain: settings[k],
        status: 'checking' as const
      }));

    await Promise.all(
      domainHealth.map(async (item, i) => {
        try {
          const start = performance.now();
          const domain = settings[item.key];
          const proto = domain.startsWith('http') ? '' : 'https://';
          const res = await fetch(`${proto}${domain}/api/v1/config`, {
            method: 'GET',
            mode: 'no-cors',
            signal: AbortSignal.timeout(8000)
          });
          const latency = Math.round(performance.now() - start);
          domainHealth[i] = { ...domainHealth[i], status: 'up', latency };
        } catch {
          domainHealth[i] = { ...domainHealth[i], status: 'down' };
        }
      })
    );
    healthChecking = false;
  }

  // ─── SSL Status ───
  async function fetchSSLStatus() {
    sslLoading = true;
    try {
      const res = await authGet('/api/v1/admin/ssl/status');
      if (!res.ok) throw new Error('فشل تحميل حالة SSL');
      const json = await res.json();
      if (json.success) {
        sslStatus = json.data;
      }
    } catch (e: any) {
      sslStatus = null;
    } finally {
      sslLoading = false;
    }
  }

  // ─── SSL Generate ───
  async function generateSSL() {
    sslGenerating = true;
    error = null;
    try {
      const domains = sslGenDomains
        .split(',')
        .map(d => d.trim())
        .filter(Boolean);
      const body: any = {
        type: sslGenType,
        domains
      };
      if (sslGenType === 'letsencrypt') {
        body.email = sslGenEmail;
        body.staging = sslGenStaging;
      }
      const res = await authPost('/api/v1/admin/ssl/generate', body);
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.message || 'فشل إنشاء شهادة SSL');
      }
      await fetchSSLStatus();
      sslGenDomains = '';
      sslGenEmail = '';
      sslGenStaging = false;
      saveSuccess = true;
      setTimeout(() => (saveSuccess = false), 3000);
    } catch (e: any) {
      error = e.message;
    } finally {
      sslGenerating = false;
    }
  }

  // ─── SSL Renew ───
  async function renewSSL() {
    sslRenewing = true;
    error = null;
    try {
      const res = await authPost('/api/v1/admin/ssl/renew');
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.message || 'فشل تجديد شهادة SSL');
      }
      await fetchSSLStatus();
      saveSuccess = true;
      setTimeout(() => (saveSuccess = false), 3000);
    } catch (e: any) {
      error = e.message;
    } finally {
      sslRenewing = false;
    }
  }

  // ─── SSL Install ───
  async function installSSL() {
    sslInstalling = true;
    error = null;
    try {
      const domains = sslInstallDomains
        .split(',')
        .map(d => d.trim())
        .filter(Boolean);
      const res = await authPost('/api/v1/admin/ssl/install', {
        cert_pem: sslInstallCert,
        key_pem: sslInstallKey,
        domains
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.message || 'فشل تثبيت شهادة SSL');
      }
      sslInstallOpen = false;
      sslInstallCert = '';
      sslInstallKey = '';
      sslInstallDomains = '';
      await fetchSSLStatus();
      saveSuccess = true;
      setTimeout(() => (saveSuccess = false), 3000);
    } catch (e: any) {
      error = e.message;
    } finally {
      sslInstalling = false;
    }
  }

  // ─── Domain Labels ───
  const domainLabels: Record<string, string> = {
    frontend_domain: 'نطاق الواجهة',
    backend_domain: 'نطاق الخادم',
    admin_domain: 'نطاق لوحة الإدارة',
    main_domain: 'النطاق الرئيسي'
  };

  const domainPlaceholders: Record<string, string> = {
    frontend_domain: 'app.example.com',
    backend_domain: 'api.example.com',
    admin_domain: 'admin.example.com',
    main_domain: 'example.com'
  };

  // ─── Overview Domain Cards Config ───
  const overviewDomainCards = [
    { key: 'main_domain', label: 'النطاق الرئيسي', icon: ExternalLink },
    { key: 'frontend_domain', label: 'الواجهة', icon: Globe },
    { key: 'backend_domain', label: 'الخادم', icon: Server },
    { key: 'admin_domain', label: 'لوحة الإدارة', icon: Settings }
  ];

  // ─── Domain Tab Field Cards ───
  const domainFieldCards = [
    { key: 'main_domain', label: 'النطاق الرئيسي', placeholder: 'example.com', icon: ExternalLink },
    { key: 'frontend_domain', label: 'نطاق الواجهة', placeholder: 'app.example.com', icon: Globe },
    { key: 'backend_domain', label: 'نطاق الخادم', placeholder: 'api.example.com', icon: Server },
    { key: 'admin_domain', label: 'نطاق لوحة الإدارة', placeholder: 'admin.example.com', icon: Settings }
  ];

  // ─── Lifecycle ───
  onMount(async () => {
    await fetchSettings();
    await checkDomainHealth();
  });

  $effect(() => {
    if (activeTab === 'ssl' && !sslStatus) {
      fetchSSLStatus();
    }
  });
</script>

<!-- ─── SSL Install Modal ─── -->
{#if sslInstallOpen}
  <div
    class="fixed inset-0 z-[100] flex items-center justify-center p-4"
    onkeydown={(e) => e.key === 'Escape' && (sslInstallOpen = false)}
  >
    <div
      class="absolute inset-0 bg-black/80 backdrop-blur-md"
      onclick={() => (sslInstallOpen = false)}
      role="presentation"
    ></div>

    <div class="relative z-10 w-full max-w-2xl panel p-6 space-y-5">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="flex items-center justify-center w-10 h-10 rounded-xl" style="background: rgba(168,85,247,0.12);">
            <Upload size={20} style="color: #a855f7;" />
          </div>
          <h3 class="font-bold">تثبيت شهادة SSL مخصصة</h3>
        </div>
        <button
          class="btn-ghost rounded-lg p-1.5"
          onclick={() => (sslInstallOpen = false)}
          aria-label="إغلاق"
        >
          <X size={18} />
        </button>
      </div>

      <div>
        <label class="block text-xs font-medium mb-2" style="color: var(--text-secondary);">
          النطاقات <span style="color: #f43f7a;">*</span>
        </label>
        <input
          type="text"
          class="input-field"
          placeholder="example.com, www.example.com"
          bind:value={sslInstallDomains}
          dir="ltr"
        />
        <p class="text-xs mt-1" style="color: var(--text-quaternary);">افصل بين النطاقات بفاصلة</p>
      </div>

      <div>
        <label class="block text-xs font-medium mb-2" style="color: var(--text-secondary);">
          شهادة PEM <span style="color: #f43f7a;">*</span>
        </label>
        <textarea
          class="input-field min-h-[160px] resize-y font-mono text-xs"
          placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----"
          bind:value={sslInstallCert}
          dir="ltr"
        ></textarea>
      </div>

      <div>
        <label class="block text-xs font-medium mb-2" style="color: var(--text-secondary);">
          مفتاح PEM <span style="color: #f43f7a;">*</span>
        </label>
        <textarea
          class="input-field min-h-[160px] resize-y font-mono text-xs"
          placeholder="-----BEGIN PRIVATE KEY-----&#10;...&#10;-----END PRIVATE KEY-----"
          bind:value={sslInstallKey}
          dir="ltr"
        ></textarea>
      </div>

      <div class="flex items-center gap-3 justify-end">
        <button
          class="btn-secondary"
          onclick={() => (sslInstallOpen = false)}
          disabled={sslInstalling}
        >
          إلغاء
        </button>
        <button
          class="btn-primary flex items-center gap-2"
          onclick={installSSL}
          disabled={sslInstalling || !sslInstallCert || !sslInstallKey || !sslInstallDomains}
        >
          {#if sslInstalling}
            <Loader2 size={16} class="animate-spin" />
          {:else}
            <Upload size={16} />
          {/if}
          تثبيت الشهادة
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- ─── Main Content ─── -->
<div class="space-y-6">
  <!-- Header -->
  <div class="flex items-center justify-between flex-wrap gap-4">
    <div>
      <h1 class="text-2xl lg:text-3xl font-extrabold text-gold-gradient">الإعدادات</h1>
      <p class="text-sm mt-1" style="color: var(--text-tertiary);">إدارة إعدادات النظام والنطاقات والأمان</p>
    </div>
    <div class="flex items-center gap-3">
      {#if nginxReloading}
        <span class="pill-gold">
          <Loader2 size={12} class="animate-spin" />
          جارٍ إعادة تحميل Nginx
        </span>
      {/if}
      {#if saveSuccess}
        <span class="pill-mint">
          <CheckCircle2 size={12} />
          تم الحفظ بنجاح
        </span>
      {/if}
    </div>
  </div>

  <!-- Error Banner -->
  {#if error}
    <div class="panel p-4 flex items-center gap-3" style="border-color: rgba(244,63,122,0.3);">
      <AlertCircle size={20} style="color: #f43f7a;" />
      <p class="text-sm" style="color: #f43f7a;">{error}</p>
      <button class="mr-auto btn-ghost text-xs" onclick={() => (error = null)}>إغلاق</button>
    </div>
  {/if}

  <!-- Tab Navigation -->
  <div class="panel overflow-hidden">
    <div class="flex items-center overflow-x-auto scrollbar-none" style="border-bottom: 1px solid var(--border-subtle);">
      {#each tabs as tab}
        <button
          class="tab-btn flex items-center gap-2 whitespace-nowrap"
          class:active={activeTab === tab.id}
          onclick={() => (activeTab = tab.id)}
        >
          <tab.icon size={16} />
          {tab.label}
        </button>
      {/each}
    </div>

    <!-- Tab Content -->
    <div class="p-6">
      {#if loading}
        <!-- Skeleton -->
        <div class="space-y-5">
          {#each Array(4) as _}
            <div class="flex items-center gap-4">
              <div class="animate-shimmer h-10 w-10 rounded-xl" style="background: rgba(255,255,255,0.06);"></div>
              <div class="flex-1 space-y-2">
                <div class="animate-shimmer h-4 w-32 rounded" style="background: rgba(255,255,255,0.06);"></div>
                <div class="animate-shimmer h-3 w-48 rounded" style="background: rgba(255,255,255,0.04);"></div>
              </div>
            </div>
          {/each}
        </div>
      {:else}
        <!-- ═══════════════════════════════════════════ -->
        <!-- TAB 1: نظرة عامة (Overview) -->
        <!-- ═══════════════════════════════════════════ -->
        {#if activeTab === 'overview'}
          <div class="space-y-6">
            <!-- System Status Cards -->
            <div>
              <h2 class="text-lg font-bold mb-4 flex items-center gap-2">
                <Activity size={20} style="color: var(--accent-gold);" />
                حالة النظام
              </h2>

              <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {#each overviewDomainCards as card}
                  {@const health = domainHealth.find(h => h.key === card.key)}
                  <div class="stat-card">
                    <div class="flex items-center justify-between mb-3">
                      <div class="flex items-center gap-2">
                        <div
                          class="flex items-center justify-center w-9 h-9 rounded-lg"
                          style="background: {health?.status === 'up'
                            ? 'rgba(34,211,164,0.12)'
                            : health?.status === 'down'
                              ? 'rgba(244,63,122,0.12)'
                              : 'rgba(245,181,68,0.12)'};"
                        >
                          <card.icon
                            size={18}
                            style="color: {health?.status === 'up'
                              ? '#22d3a4'
                              : health?.status === 'down'
                                ? '#f43f7a'
                                : '#f5b544'};"
                          />
                        </div>
                        <span class="text-xs font-medium" style="color: var(--text-secondary);">
                          {card.label}
                        </span>
                      </div>
                      {#if health?.status === 'checking'}
                        <Loader2 size={16} class="animate-spin" style="color: var(--text-quaternary);" />
                      {:else if health?.status === 'up'}
                        <span class="pill-mint text-[10px]">
                          <CheckCircle2 size={10} />
                          يعمل
                        </span>
                      {:else if health?.status === 'down'}
                        <span class="pill-rose text-[10px]">
                          <XCircle size={10} />
                          معطّل
                        </span>
                      {/if}
                    </div>
                    <p class="text-xs font-mono truncate" style="color: var(--text-tertiary);" dir="ltr">
                      {settings[card.key] || '—'}
                    </p>
                    {#if health?.latency}
                      <p class="text-[10px] mt-1 font-mono" style="color: var(--text-quaternary);" dir="ltr">
                        {health.latency}ms
                      </p>
                    {/if}
                  </div>
                {/each}
              </div>
            </div>

            <div class="glass-divider"></div>

            <!-- Quick Status Summary -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <!-- Maintenance Mode -->
              <div class="panel p-4 flex items-center gap-4">
                <div
                  class="flex items-center justify-center w-11 h-11 rounded-xl"
                  style="background: {settings.maintenance_mode ? 'rgba(244,63,122,0.12)' : 'rgba(34,211,164,0.12)'};"
                >
                  {#if settings.maintenance_mode}
                    <AlertCircle size={20} style="color: #f43f7a;" />
                  {:else}
                    <CheckCircle2 size={20} style="color: #22d3a4;" />
                  {/if}
                </div>
                <div>
                  <p class="text-sm font-bold">وضع الصيانة</p>
                  <p class="text-xs" style="color: var(--text-tertiary);">
                    {settings.maintenance_mode ? 'مفعّل — الموقع غير متاح للمستخدمين' : 'معطّل — الموقع يعمل بشكل طبيعي'}
                  </p>
                </div>
              </div>

              <!-- Registration -->
              <div class="panel p-4 flex items-center gap-4">
                <div
                  class="flex items-center justify-center w-11 h-11 rounded-xl"
                  style="background: {settings.registration_open ? 'rgba(34,211,164,0.12)' : 'rgba(245,181,68,0.12)'};"
                >
                  {#if settings.registration_open}
                    <CheckCircle2 size={20} style="color: #22d3a4;" />
                  {:else}
                    <Lock size={20} style="color: #f5b544;" />
                  {/if}
                </div>
                <div>
                  <p class="text-sm font-bold">التسجيل</p>
                  <p class="text-xs" style="color: var(--text-tertiary);">
                    {settings.registration_open ? 'مفتوح — يمكن للمستخدمين التسجيل' : 'مغلق — التسجيل غير متاح'}
                  </p>
                </div>
              </div>
            </div>

            <!-- Refresh health check -->
            <div class="flex justify-end">
              <button
                class="btn-ghost flex items-center gap-2 text-xs"
                onclick={checkDomainHealth}
                disabled={healthChecking}
              >
                <RefreshCw size={14} class={healthChecking ? 'animate-spin' : ''} />
                إعادة فحص النطاقات
              </button>
            </div>
          </div>

        <!-- ═══════════════════════════════════════════ -->
        <!-- TAB 2: النطاقات (Domains) -->
        <!-- ═══════════════════════════════════════════ -->
        {:else if activeTab === 'domains'}
          <div class="space-y-6">
            <div>
              <h2 class="text-lg font-bold mb-1 flex items-center gap-2">
                <Globe size={20} style="color: var(--accent-azure);" />
                إعدادات النطاقات
              </h2>
              <p class="text-xs mb-5" style="color: var(--text-tertiary);">
                تعديل نطاقات المنصة. سيتم إعادة تحميل Nginx تلقائيًا عند الحفظ.
              </p>
            </div>

            <div class="space-y-4">
              {#each domainFieldCards as card}
                <div class="panel p-4">
                  <div class="flex items-start gap-4">
                    <div class="flex items-center justify-center w-10 h-10 rounded-xl shrink-0" style="background: rgba(59,130,246,0.12);">
                      <card.icon size={18} style="color: #3b82f6;" />
                    </div>
                    <div class="flex-1 space-y-2">
                      <div class="flex items-center gap-2">
                        <label class="text-sm font-semibold">{card.label}</label>
                        {#if changedKeys.has(card.key)}
                          <span class="pill-gold text-[10px]">معدّل</span>
                        {/if}
                      </div>
                      <input
                        type="text"
                        class="input-field font-mono text-sm"
                        placeholder={card.placeholder}
                        value={settings[card.key] || ''}
                        oninput={(e) => trackChange(card.key, (e.target as HTMLInputElement).value)}
                        dir="ltr"
                      />
                      {#if domainHealth.find(h => h.key === card.key)?.status === 'up'}
                        <p class="text-[10px] flex items-center gap-1" style="color: #22d3a4;">
                          <CheckCircle2 size={10} />
                          يعمل — {domainHealth.find(h => h.key === card.key)?.latency}ms
                        </p>
                      {:else if domainHealth.find(h => h.key === card.key)?.status === 'down'}
                        <p class="text-[10px] flex items-center gap-1" style="color: #f43f7a;">
                          <XCircle size={10} />
                          غير متاح
                        </p>
                      {/if}
                    </div>
                  </div>
                </div>
              {/each}
            </div>

            <div class="glass-divider"></div>

            <!-- Nginx Manual Reload -->
            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm font-semibold">إعادة تحميل Nginx</p>
                <p class="text-xs" style="color: var(--text-tertiary);">إعادة تحميل إعدادات الخادم يدويًا</p>
              </div>
              <button
                class="btn-secondary flex items-center gap-2"
                onclick={reloadNginx}
                disabled={nginxReloading}
              >
                {#if nginxReloading}
                  <Loader2 size={14} class="animate-spin" />
                {:else}
                  <RefreshCw size={14} />
                {/if}
                إعادة تحميل
              </button>
            </div>
          </div>

        <!-- ═══════════════════════════════════════════ -->
        <!-- TAB 3: SSL -->
        <!-- ═══════════════════════════════════════════ -->
        {:else if activeTab === 'ssl'}
          <div class="space-y-6">
            <!-- Current SSL Status -->
            <div>
              <h2 class="text-lg font-bold mb-4 flex items-center gap-2">
                <Lock size={20} style="color: var(--accent-mint);" />
                حالة شهادة SSL
              </h2>

              {#if sslLoading}
                <div class="space-y-3">
                  {#each Array(3) as _}
                    <div class="animate-shimmer h-5 w-48 rounded" style="background: rgba(255,255,255,0.06);"></div>
                  {/each}
                </div>
              {:else if sslStatus}
                <div class="panel p-5 space-y-4">
                  <div class="flex items-center gap-3 mb-4">
                    {#if sslStatus.valid}
                      <div class="flex items-center justify-center w-12 h-12 rounded-xl" style="background: rgba(34,211,164,0.12);">
                        <Lock size={22} style="color: #22d3a4;" />
                      </div>
                      <div>
                        <p class="font-bold text-sm" style="color: #22d3a4;">الشهادة صالحة</p>
                        <p class="text-xs" style="color: var(--text-tertiary);">SSL يعمل بشكل طبيعي</p>
                      </div>
                    {:else}
                      <div class="flex items-center justify-center w-12 h-12 rounded-xl" style="background: rgba(244,63,122,0.12);">
                        <AlertCircle size={22} style="color: #f43f7a;" />
                      </div>
                      <div>
                        <p class="font-bold text-sm" style="color: #f43f7a;">الشهادة غير صالحة</p>
                        <p class="text-xs" style="color: var(--text-tertiary);">يحتاج إلى تجديد أو تثبيت جديد</p>
                      </div>
                    {/if}
                  </div>

                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                    {#if sslStatus.issuer}
                      <div>
                        <p class="text-xs font-medium mb-1" style="color: var(--text-quaternary);">الجهة المصدرة</p>
                        <p class="font-medium">{sslStatus.issuer}</p>
                      </div>
                    {/if}
                    {#if sslStatus.expires_at}
                      <div>
                        <p class="text-xs font-medium mb-1" style="color: var(--text-quaternary);">تاريخ الانتهاء</p>
                        <p class="font-medium">{new Date(sslStatus.expires_at).toLocaleDateString('ar-EG', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}</p>
                      </div>
                    {/if}
                    {#if sslStatus.days_left !== undefined}
                      <div>
                        <p class="text-xs font-medium mb-1" style="color: var(--text-quaternary);">الأيام المتبقية</p>
                        <p
                          class="font-bold font-mono"
                          style="color: {sslStatus.days_left > 30
                            ? '#22d3a4'
                            : sslStatus.days_left > 7
                              ? '#f5b544'
                              : '#f43f7a'};"
                        >
                          {sslStatus.days_left} يوم
                        </p>
                      </div>
                    {/if}
                    {#if sslStatus.fingerprint}
                      <div>
                        <p class="text-xs font-medium mb-1" style="color: var(--text-quaternary);">البصمة</p>
                        <p class="font-mono text-xs truncate" style="color: var(--text-tertiary);" dir="ltr">
                          {sslStatus.fingerprint}
                        </p>
                      </div>
                    {/if}
                  </div>

                  {#if sslStatus.domains && sslStatus.domains.length > 0}
                    <div>
                      <p class="text-xs font-medium mb-2" style="color: var(--text-quaternary);">النطاقات المشمولة</p>
                      <div class="flex flex-wrap gap-2">
                        {#each sslStatus.domains as domain}
                          <span class="pill-azure text-[10px]">
                            <Globe size={10} />
                            {domain}
                          </span>
                        {/each}
                      </div>
                    </div>
                  {/if}
                </div>
              {:else}
                <div class="panel p-8 text-center">
                  <Lock size={40} class="mx-auto mb-3 opacity-20" style="color: var(--text-quaternary);" />
                  <p class="font-bold" style="color: var(--text-secondary);">لا توجد شهادة SSL</p>
                  <p class="text-xs mt-1" style="color: var(--text-quaternary);">أنشئ شهادة جديدة أو ثبّت شهادة مخصصة</p>
                </div>
              {/if}
            </div>

            <div class="glass-divider"></div>

            <!-- Actions -->
            <div class="flex flex-wrap gap-3">
              <button
                class="btn-secondary flex items-center gap-2"
                onclick={renewSSL}
                disabled={sslRenewing}
              >
                {#if sslRenewing}
                  <Loader2 size={14} class="animate-spin" />
                {:else}
                  <RefreshCw size={14} />
                {/if}
                تجديد الشهادة
              </button>
              <button
                class="btn-secondary flex items-center gap-2"
                onclick={fetchSSLStatus}
                disabled={sslLoading}
              >
                <Activity size={14} />
                فحص الحالة
              </button>
              <button
                class="btn-secondary flex items-center gap-2"
                onclick={() => (sslInstallOpen = true)}
              >
                <Upload size={14} />
                تثبيت شهادة مخصصة
              </button>
            </div>

            <div class="glass-divider"></div>

            <!-- Generate New Certificate -->
            <div>
              <h3 class="text-base font-bold mb-4 flex items-center gap-2">
                <FileKey size={18} style="color: var(--accent-violet);" />
                إنشاء شهادة جديدة
              </h3>

              <div class="panel p-5 space-y-4">
                <!-- Type Selector -->
                <div>
                  <label class="block text-xs font-medium mb-2" style="color: var(--text-secondary);">نوع الشهادة</label>
                  <div class="flex gap-3">
                    <button
                      class="flex-1 p-3 rounded-xl text-sm font-medium transition-all cursor-pointer border"
                      style={sslGenType === 'letsencrypt'
                        ? 'background: rgba(34,211,164,0.12); border-color: rgba(34,211,164,0.3); color: #22d3a4;'
                        : 'background: rgba(255,255,255,0.04); border-color: var(--border-subtle); color: var(--text-secondary);'}
                      onclick={() => (sslGenType = 'letsencrypt')}
                    >
                      <Lock size={16} class="mx-auto mb-1" />
                      Let's Encrypt
                    </button>
                    <button
                      class="flex-1 p-3 rounded-xl text-sm font-medium transition-all cursor-pointer border"
                      style={sslGenType === 'local'
                        ? 'background: rgba(245,181,68,0.12); border-color: rgba(245,181,68,0.3); color: #f5b544;'
                        : 'background: rgba(255,255,255,0.04); border-color: var(--border-subtle); color: var(--text-secondary);'}
                      onclick={() => (sslGenType = 'local')}
                    >
                      <FileKey size={16} class="mx-auto mb-1" />
                      محلية (Self-signed)
                    </button>
                  </div>
                </div>

                <!-- Domains -->
                <div>
                  <label class="block text-xs font-medium mb-2" style="color: var(--text-secondary);">
                    النطاقات <span style="color: #f43f7a;">*</span>
                  </label>
                  <input
                    type="text"
                    class="input-field font-mono text-sm"
                    placeholder="example.com, www.example.com"
                    bind:value={sslGenDomains}
                    dir="ltr"
                  />
                  <p class="text-xs mt-1" style="color: var(--text-quaternary);">افصل بين النطاقات بفاصلة</p>
                </div>

                {#if sslGenType === 'letsencrypt'}
                  <!-- Email -->
                  <div>
                    <label class="block text-xs font-medium mb-2" style="color: var(--text-secondary);">
                      البريد الإلكتروني <span style="color: #f43f7a;">*</span>
                    </label>
                    <input
                      type="email"
                      class="input-field font-mono text-sm"
                      placeholder="admin@example.com"
                      bind:value={sslGenEmail}
                      dir="ltr"
                    />
                  </div>

                  <!-- Staging Toggle -->
                  <div class="flex items-center justify-between p-3 rounded-xl" style="background: rgba(255,255,255,0.03);">
                    <div>
                      <p class="text-sm font-medium">وضع الاختبار (Staging)</p>
                      <p class="text-xs" style="color: var(--text-quaternary);">استخدم خوادم Let's Encrypt التجريبية</p>
                    </div>
                    <button
                      class="cursor-pointer transition-all"
                      onclick={() => (sslGenStaging = !sslGenStaging)}
                    >
                      {#if sslGenStaging}
                        <ToggleRight size={32} style="color: var(--accent-gold);" />
                      {:else}
                        <ToggleLeft size={32} style="color: var(--text-quaternary);" />
                      {/if}
                    </button>
                  </div>
                {/if}

                <!-- Generate Button -->
                <button
                  class="btn-primary w-full flex items-center justify-center gap-2"
                  onclick={generateSSL}
                  disabled={sslGenerating || !sslGenDomains || (sslGenType === 'letsencrypt' && !sslGenEmail)}
                >
                  {#if sslGenerating}
                    <Loader2 size={16} class="animate-spin" />
                    جارٍ إنشاء الشهادة...
                  {:else}
                    <FileKey size={16} />
                    إنشاء شهادة {sslGenType === 'letsencrypt' ? 'Let\'s Encrypt' : 'محلية'}
                  {/if}
                </button>
              </div>
            </div>
          </div>

        <!-- ═══════════════════════════════════════════ -->
        <!-- TAB 4: الأمان (Security) -->
        <!-- ═══════════════════════════════════════════ -->
        {:else if activeTab === 'security'}
          <div class="space-y-6">
            <div>
              <h2 class="text-lg font-bold mb-1 flex items-center gap-2">
                <ShieldCheck size={20} style="color: var(--accent-rose);" />
                إعدادات الأمان
              </h2>
              <p class="text-xs mb-5" style="color: var(--text-tertiary);">
                التحكم في وضع الصيانة وتسجيل المستخدمين
              </p>
            </div>

            <!-- Maintenance Mode -->
            <div class="panel p-5">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-4">
                  <div
                    class="flex items-center justify-center w-12 h-12 rounded-xl"
                    style="background: {settings.maintenance_mode ? 'rgba(244,63,122,0.12)' : 'rgba(34,211,164,0.12)'};"
                  >
                    {#if settings.maintenance_mode}
                      <AlertCircle size={22} style="color: #f43f7a;" />
                    {:else}
                      <CheckCircle2 size={22} style="color: #22d3a4;" />
                    {/if}
                  </div>
                  <div>
                    <div class="flex items-center gap-2">
                      <p class="text-sm font-bold">وضع الصيانة</p>
                      {#if changedKeys.has('maintenance_mode')}
                        <span class="pill-gold text-[10px]">معدّل</span>
                      {/if}
                    </div>
                    <p class="text-xs mt-0.5" style="color: var(--text-tertiary);">
                      عند التفعيل، سيظهر للمستخدمين رسالة صيانة بدلاً من المنصة
                    </p>
                  </div>
                </div>
                <button
                  class="cursor-pointer transition-all"
                  onclick={() => trackChange('maintenance_mode', !settings.maintenance_mode)}
                >
                  {#if settings.maintenance_mode}
                    <ToggleRight size={36} style="color: #f43f7a;" />
                  {:else}
                    <ToggleLeft size={36} style="color: var(--text-quaternary);" />
                  {/if}
                </button>
              </div>

              {#if settings.maintenance_mode}
                <div
                  class="mt-4 p-3 rounded-lg text-xs"
                  style="background: rgba(244,63,122,0.06); border: 1px solid rgba(244,63,122,0.12); color: var(--text-secondary);"
                >
                  <AlertCircle size={13} class="inline ml-1" style="color: #f43f7a;" />
                  تحذير: المنصة حاليًا في وضع الصيانة. المستخدمون لن يتمكنوا من الوصول.
                </div>
              {/if}
            </div>

            <!-- Registration Open -->
            <div class="panel p-5">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-4">
                  <div
                    class="flex items-center justify-center w-12 h-12 rounded-xl"
                    style="background: {settings.registration_open ? 'rgba(34,211,164,0.12)' : 'rgba(245,181,68,0.12)'};"
                  >
                    {#if settings.registration_open}
                      <CheckCircle2 size={22} style="color: #22d3a4;" />
                    {:else}
                      <Lock size={22} style="color: #f5b544;" />
                    {/if}
                  </div>
                  <div>
                    <div class="flex items-center gap-2">
                      <p class="text-sm font-bold">فتح التسجيل</p>
                      {#if changedKeys.has('registration_open')}
                        <span class="pill-gold text-[10px]">معدّل</span>
                      {/if}
                    </div>
                    <p class="text-xs mt-0.5" style="color: var(--text-tertiary);">
                      السماح للمستخدمين الجدد بإنشاء حسابات
                    </p>
                  </div>
                </div>
                <button
                  class="cursor-pointer transition-all"
                  onclick={() => trackChange('registration_open', !settings.registration_open)}
                >
                  {#if settings.registration_open}
                    <ToggleRight size={36} style="color: #22d3a4;" />
                  {:else}
                    <ToggleLeft size={36} style="color: var(--text-quaternary);" />
                  {/if}
                </button>
              </div>
            </div>
          </div>

        <!-- ═══════════════════════════════════════════ -->
        <!-- TAB 5: الميزات (Features) -->
        <!-- ═══════════════════════════════════════════ -->
        {:else if activeTab === 'features'}
          <div class="space-y-6">
            <div>
              <h2 class="text-lg font-bold mb-1 flex items-center gap-2">
                <Wrench size={20} style="color: var(--accent-cyan);" />
                الميزات والتخزينات
              </h2>
              <p class="text-xs mb-5" style="color: var(--text-tertiary);">
                تفعيل أو تعطيل ميزات المنصة
              </p>
            </div>

            <!-- Feature Flags Grid -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              {#each featureFlags as flag}
                {@const enabled = !!settings[flag.key]}
                <div class="panel p-4">
                  <div class="flex items-center justify-between">
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center gap-2">
                        <p class="text-sm font-bold">{flag.label}</p>
                        {#if changedKeys.has(flag.key)}
                          <span class="pill-gold text-[10px]">معدّل</span>
                        {/if}
                      </div>
                      <p class="text-xs mt-0.5" style="color: var(--text-tertiary);">
                        {flag.description}
                      </p>
                    </div>
                    <button
                      class="cursor-pointer transition-all shrink-0 mr-3"
                      onclick={() => trackChange(flag.key, !settings[flag.key])}
                    >
                      {#if enabled}
                        <ToggleRight size={34} style="color: #22d3a4;" />
                      {:else}
                        <ToggleLeft size={34} style="color: var(--text-quaternary);" />
                      {/if}
                    </button>
                  </div>
                </div>
              {/each}
            </div>

            <div class="glass-divider"></div>

            <!-- Maintenance Message -->
            <div>
              <h3 class="text-base font-bold mb-3 flex items-center gap-2">
                <MessageSquare size={18} style="color: var(--accent-gold);" />
                رسالة الصيانة
              </h3>
              <div class="panel p-5 space-y-3">
                <div class="flex items-center gap-2 mb-1">
                  <p class="text-xs" style="color: var(--text-tertiary);">
                    تظهر هذه الرسالة عند تفعيل وضع الصيانة
                  </p>
                  {#if changedKeys.has('maintenance_message')}
                    <span class="pill-gold text-[10px]">معدّل</span>
                  {/if}
                </div>
                <textarea
                  class="input-field min-h-[120px] resize-y"
                  placeholder="الموقع حالياً تحت الصيانة. سنعود قريباً..."
                  value={settings.maintenance_message || ''}
                  oninput={(e) => trackChange('maintenance_message', (e.target as HTMLTextAreaElement).value)}
                  dir="rtl"
                ></textarea>
                {#if settings.maintenance_message}
                  <div class="p-3 rounded-lg text-xs" style="background: rgba(245,181,68,0.06); border: 1px solid rgba(245,181,68,0.12);">
                    <p class="font-semibold mb-1" style="color: var(--accent-gold);">معاينة:</p>
                    <p style="color: var(--text-secondary);">{settings.maintenance_message}</p>
                  </div>
                {/if}
              </div>
            </div>
          </div>
        {/if}
      {/if}
    </div>
  </div>
</div>

<!-- ─── Sticky Save Bar ─── -->
{#if hasChanges}
  <div
    class="fixed bottom-0 left-0 right-0 z-50 p-4"
    style="background: var(--bg-ink-950-95); backdrop-filter: blur(16px); border-top: 1px solid rgba(245,181,68,0.2); box-shadow: 0 -4px 24px rgba(0,0,0,0.4);"
  >
    <div class="max-w-5xl mx-auto flex items-center justify-between">
      <div class="flex items-center gap-3">
        <div class="flex items-center justify-center w-8 h-8 rounded-lg" style="background: rgba(245,181,68,0.12);">
          <AlertCircle size={16} style="color: #f5b544;" />
        </div>
        <div>
          <p class="text-sm font-bold">تغييرات غير محفوظة</p>
          <p class="text-xs" style="color: var(--text-tertiary);">
            {changedKeys.size} {changedKeys.size === 1 ? 'تعديل' : 'تعديلات'} غير محفوظة
          </p>
        </div>
      </div>
      <div class="flex items-center gap-3">
        <button
          class="btn-ghost text-xs"
          onclick={() => {
            settings = { ...originalSettings };
            changedKeys = new Set();
          }}
          disabled={saving}
        >
          تراجع
        </button>
        <button
          class="btn-primary flex items-center gap-2"
          onclick={saveSettings}
          disabled={saving}
        >
          {#if saving}
            <Loader2 size={16} class="animate-spin" />
            جارٍ الحفظ...
          {:else}
            <Save size={16} />
            حفظ التغييرات
          {/if}
        </button>
      </div>
    </div>
  </div>
{/if}
