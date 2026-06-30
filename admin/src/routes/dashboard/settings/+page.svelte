<script lang="ts">
  import { onMount } from 'svelte';
  import {
    Settings, Globe, ShieldCheck, Lock, Loader2, Save, AlertCircle,
    CheckCircle2, XCircle, RefreshCw, FileKey, Activity, Server, Wrench, ExternalLink
  } from 'lucide-svelte';
  import { authGet, authPost, authPut, API } from '$lib/api/client';

  type TabId = 'overview' | 'domains' | 'ssl' | 'security' | 'features';
  const tabs: { id: TabId; label: string; icon: typeof Settings }[] = [
    { id: 'overview', label: 'نظرة عامة', icon: Activity },
    { id: 'domains', label: 'النطاقات', icon: Globe },
    { id: 'ssl', label: 'SSL', icon: Lock },
    { id: 'security', label: 'الأمان', icon: ShieldCheck },
    { id: 'features', label: 'الميزات', icon: Wrench }
  ];
  let activeTab = $state<TabId>('overview');
  let settings = $state<Record<string, any>>({});
  let originalSettings = $state<Record<string, any>>({});
  let loading = $state(true);
  let error = $state<string | null>(null);
  let saving = $state(false);
  let saveSuccess = $state(false);
  let nginxReloading = $state(false);
  let changedKeys = $state<Set<string>>(new Set());

  function trackChange(key: string, value: any) {
    settings[key] = value;
    if (originalSettings[key] === value) changedKeys.delete(key);
    else changedKeys.add(key);
    changedKeys = new Set(changedKeys);
    settings = { ...settings };
  }

  let hasChanges = $derived(changedKeys.size > 0);

  async function loadSettings() {
    loading = true; error = null;
    try {
      const res = await authGet('/api/v1/admin/settings');
      if (!res.ok) throw new Error('فشل تحميل الإعدادات');
      const json = await res.json();
      if (json.success) {
        const flat: Record<string, any> = {};
        for (const [group, vals] of Object.entries(json.data)) {
          if (typeof vals === 'object' && vals !== null) {
            for (const [k, v] of Object.entries(vals as Record<string, any>)) { flat[`${group}.${k}`] = v; }
          }
        }
        settings = flat; originalSettings = { ...flat }; changedKeys = new Set();
      }
    } catch (e: any) { error = e.message; }
    finally { loading = false; }
  }

  async function saveSettings() {
    saving = true; saveSuccess = false; error = null;
    try {
      const grouped: Record<string, Record<string, any>> = {};
      for (const key of changedKeys) {
        const [group, ...rest] = key.split('.');
        const field = rest.join('.');
        if (!grouped[group]) grouped[group] = {};
        grouped[group][field] = settings[key];
      }
      const res = await authPut('/api/v1/admin/settings', grouped);
      if (!res.ok) throw new Error('فشل حفظ الإعدادات');
      originalSettings = { ...settings }; changedKeys = new Set(); saveSuccess = true;
      setTimeout(() => { saveSuccess = false; }, 3000);
    } catch (e: any) { error = e.message; }
    finally { saving = false; }
  }

  async function reloadNginx() {
    nginxReloading = true;
    try {
      const res = await authPost('/api/v1/admin/nginx/reload');
      if (!res.ok) throw new Error('فشل إعادة تحميل nginx');
    } catch (e: any) { error = e.message; }
    finally { nginxReloading = false; }
  }

  onMount(() => { loadSettings(); });

  function getSetting(key: string): any { return settings[key] ?? ''; }

  // Settings field definitions per tab
  const domainFields = [
    { key: 'domains.main_domain', label: 'النطاق الرئيسي', type: 'text', placeholder: 'example.com' },
    { key: 'domains.admin_domain', label: 'نطاق لوحة الإدارة', type: 'text', placeholder: 'admin.example.com' },
    { key: 'domains.api_domain', label: 'نطاق API', type: 'text', placeholder: 'api.example.com' },
  ];

  const sslFields = [
    { key: 'ssl.ssl_enabled', label: 'تفعيل SSL', type: 'toggle' },
    { key: 'ssl.ssl_email', label: 'بريد SSL', type: 'text', placeholder: 'admin@example.com' },
    { key: 'ssl.ssl_type', label: 'نوع SSL', type: 'select', options: ['letsencrypt', 'custom'] },
  ];

  const securityFields = [
    { key: 'security.registration_enabled', label: 'تفعيل التسجيل', type: 'toggle' },
    { key: 'security.two_fa_enabled', label: 'تفعيل التحقق الثنائي', type: 'toggle' },
    { key: 'security.kyc_required', label: 'طلب KYC للسحب', type: 'toggle' },
    { key: 'security.max_login_attempts', label: 'محاولات تسجيل الدخول', type: 'number', placeholder: '5' },
  ];

  const featureFields = [
    { key: 'features.p2p_enabled', label: 'تفعيل P2P', type: 'toggle' },
    { key: 'features.futures_enabled', label: 'تفعيل العقود الآجلة', type: 'toggle' },
    { key: 'features.staking_enabled', label: 'تفعيل Staking', type: 'toggle' },
    { key: 'features.referral_enabled', label: 'تفعيل الإحالة', type: 'toggle' },
    { key: 'features.ads_enabled', label: 'تفعيل الإعلانات', type: 'toggle' },
  ];
</script>

<div class="space-y-6">
  <div class="flex items-center justify-between flex-wrap gap-4">
    <div>
      <h1 class="text-2xl lg:text-3xl font-extrabold text-gold-gradient">إعدادات النظام</h1>
      <p class="text-sm mt-1" style="color: var(--text-tertiary);">إدارة إعدادات المنصة</p>
    </div>
    <div class="flex items-center gap-3">
      {#if hasChanges}
        <button class="btn-secondary flex items-center gap-2" onclick={loadSettings}><RefreshCw size={16} />تراجع</button>
      {/if}
      <button class="btn-primary flex items-center gap-2" onclick={saveSettings} disabled={saving || !hasChanges}>
        {#if saving}<Loader2 size={16} class="animate-spin" />{:else if saveSuccess}<CheckCircle2 size={16} />{:else}<Save size={16} />{/if}
        {#if saveSuccess}تم الحفظ{:else if saving}جاري الحفظ...{:else}حفظ التغييرات{/if}
      </button>
    </div>
  </div>

  {#if error}
    <div class="panel p-4 flex items-center gap-3" style="border-color: rgba(244,63,122,0.3);">
      <AlertCircle size={20} style="color: #f43f7a;" /><p class="text-sm" style="color: #f43f7a;">{error}</p>
      <button class="mr-auto btn-ghost text-xs" onclick={() => error = null}>إغلاق</button>
    </div>
  {/if}

  <!-- Tabs -->
  <div class="panel p-1.5 flex items-center gap-1 overflow-x-auto scrollbar-none">
    {#each tabs as tab}
      <button class="tab-btn flex items-center gap-2 whitespace-nowrap {activeTab === tab.id ? 'active' : ''}" onclick={() => activeTab = tab.id}>
        <tab.icon size={16} /><span>{tab.label}</span>
      </button>
    {/each}
  </div>

  {#if loading}
    <div class="panel p-12 flex flex-col items-center gap-4"><Loader2 size={32} class="animate-spin" style="color: var(--accent-gold);" /><p class="text-sm" style="color: var(--text-secondary);">جارٍ تحميل الإعدادات...</p></div>
  {:else}
    <!-- Overview Tab -->
    {#if activeTab === 'overview'}
      <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div class="stat-card">
          <div class="flex items-center gap-3 mb-4"><div class="p-2.5 rounded-lg" style="background: rgba(59,130,246,0.12);"><Globe size={20} style="color: #3b82f6;" /></div><div><h3 class="font-bold">النطاقات</h3><p class="text-xs" style="color: var(--text-tertiary);">إعدادات النطاقات و DNS</p></div></div>
          <div class="space-y-2 text-sm">
            <div class="flex justify-between"><span style="color: var(--text-secondary);">النطاق الرئيسي</span><span class="font-mono" dir="ltr">{getSetting('domains.main_domain') || '—'}</span></div>
            <div class="flex justify-between"><span style="color: var(--text-secondary);">نطاق الأدمن</span><span class="font-mono" dir="ltr">{getSetting('domains.admin_domain') || '—'}</span></div>
          </div>
        </div>
        <div class="stat-card">
          <div class="flex items-center gap-3 mb-4"><div class="p-2.5 rounded-lg" style="background: rgba(34,211,164,0.12);"><Lock size={20} style="color: #22d3a4;" /></div><div><h3 class="font-bold">SSL</h3><p class="text-xs" style="color: var(--text-tertiary);">حالة الشهادة الأمنية</p></div></div>
          <div class="space-y-2 text-sm">
            <div class="flex justify-between"><span style="color: var(--text-secondary);">الحالة</span>{#if getSetting('ssl.ssl_enabled') === 'true' || getSetting('ssl.ssl_enabled') === true}<span class="pill-mint">مفعّل</span>{:else}<span class="pill-rose">معطّل</span>{/if}</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="flex items-center gap-3 mb-4"><div class="p-2.5 rounded-lg" style="background: rgba(168,85,247,0.12);"><ShieldCheck size={20} style="color: #a855f7;" /></div><div><h3 class="font-bold">الأمان</h3><p class="text-xs" style="color: var(--text-tertiary);">إعدادات الأمان والحماية</p></div></div>
          <div class="space-y-2 text-sm">
            <div class="flex justify-between"><span style="color: var(--text-secondary);">التسجيل</span>{#if getSetting('security.registration_enabled') === 'true' || getSetting('security.registration_enabled') === true}<span class="pill-mint">مفعّل</span>{:else}<span class="pill-rose">معطّل</span>{/if}</div>
            <div class="flex justify-between"><span style="color: var(--text-secondary);">2FA</span>{#if getSetting('security.two_fa_enabled') === 'true' || getSetting('security.two_fa_enabled') === true}<span class="pill-mint">مفعّل</span>{:else}<span class="pill-rose">معطّل</span>{/if}</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="flex items-center gap-3 mb-4"><div class="p-2.5 rounded-lg" style="background: rgba(245,181,68,0.12);"><Wrench size={20} style="color: #f5b544;" /></div><div><h3 class="font-bold">الميزات</h3><p class="text-xs" style="color: var(--text-tertiary);">الميزات المفعّلة</p></div></div>
          <div class="flex flex-wrap gap-2">
            {#each ['p2p_enabled', 'futures_enabled', 'staking_enabled', 'referral_enabled'] as fKey}
              {@const val = getSetting(`features.${fKey}`)}
              {#if val === 'true' || val === true}
                <span class="pill-mint text-[10px]">{fKey.replace('_enabled', '')}</span>
              {/if}
            {/each}
          </div>
        </div>
      </div>
    {/if}

    <!-- Domains Tab -->
    {#if activeTab === 'domains'}
      <div class="panel p-6 space-y-5">
        <div class="flex items-center gap-3 mb-2"><Globe size={20} style="color: #3b82f6;" /><h2 class="font-bold">إعدادات النطاقات</h2></div>
        {#each domainFields as field}
          <div>
            <label class="field-label text-xs mb-1.5 block">{field.label}</label>
            <input type="text" class="input-field" value={getSetting(field.key)} placeholder={field.placeholder} dir="ltr"
              oninput={(e) => trackChange(field.key, (e.target as HTMLInputElement).value)} />
          </div>
        {/each}
        <div class="pt-2">
          <button class="btn-secondary flex items-center gap-2" onclick={reloadNginx} disabled={nginxReloading}>
            {#if nginxReloading}<Loader2 size={16} class="animate-spin" />{:else}<RefreshCw size={16} />{/if}
            إعادة تحميل nginx
          </button>
        </div>
      </div>
    {/if}

    <!-- SSL Tab -->
    {#if activeTab === 'ssl'}
      <div class="panel p-6 space-y-5">
        <div class="flex items-center gap-3 mb-2"><Lock size={20} style="color: #22d3a4;" /><h2 class="font-bold">إعدادات SSL</h2></div>
        {#each sslFields as field}
          <div>
            <label class="field-label text-xs mb-1.5 block">{field.label}</label>
            {#if field.type === 'toggle'}
              <button class="btn-ghost p-1" onclick={() => trackChange(field.key, !(getSetting(field.key) === 'true' || getSetting(field.key) === true))}>
                {#if getSetting(field.key) === 'true' || getSetting(field.key) === true}
                  <ToggleRight size={28} style="color: #22d3a4;" />
                {:else}
                  <ToggleLeft size={28} style="color: var(--text-quaternary);" />
                {/if}
              </button>
            {:else if field.type === 'select'}
              <select class="input-field appearance-none cursor-pointer" value={getSetting(field.key)} onchange={(e) => trackChange(field.key, (e.target as HTMLSelectElement).value)} dir="ltr">
                {#each (field.options || []) as opt}<option value={opt}>{opt}</option>{/each}
              </select>
            {:else}
              <input type="text" class="input-field" value={getSetting(field.key)} placeholder={field.placeholder} dir="ltr"
                oninput={(e) => trackChange(field.key, (e.target as HTMLInputElement).value)} />
            {/if}
          </div>
        {/each}
      </div>
    {/if}

    <!-- Security Tab -->
    {#if activeTab === 'security'}
      <div class="panel p-6 space-y-5">
        <div class="flex items-center gap-3 mb-2"><ShieldCheck size={20} style="color: #a855f7;" /><h2 class="font-bold">إعدادات الأمان</h2></div>
        {#each securityFields as field}
          <div>
            <label class="field-label text-xs mb-1.5 block">{field.label}</label>
            {#if field.type === 'toggle'}
              <button class="btn-ghost p-1" onclick={() => trackChange(field.key, !(getSetting(field.key) === 'true' || getSetting(field.key) === true))}>
                {#if getSetting(field.key) === 'true' || getSetting(field.key) === true}
                  <ToggleRight size={28} style="color: #22d3a4;" />
                {:else}
                  <ToggleLeft size={28} style="color: var(--text-quaternary);" />
                {/if}
              </button>
            {:else}
              <input type="number" class="input-field" value={getSetting(field.key)} placeholder={field.placeholder}
                oninput={(e) => trackChange(field.key, (e.target as HTMLInputElement).value)} />
            {/if}
          </div>
        {/each}
      </div>
    {/if}

    <!-- Features Tab -->
    {#if activeTab === 'features'}
      <div class="panel p-6 space-y-5">
        <div class="flex items-center gap-3 mb-2"><Wrench size={20} style="color: #f5b544;" /><h2 class="font-bold">إعدادات الميزات</h2></div>
        {#each featureFields as field}
          <div class="flex items-center justify-between py-2" style="border-bottom: 1px solid var(--border-subtle);">
            <label class="text-sm font-medium">{field.label}</label>
            <button class="btn-ghost p-1" onclick={() => trackChange(field.key, !(getSetting(field.key) === 'true' || getSetting(field.key) === true))}>
              {#if getSetting(field.key) === 'true' || getSetting(field.key) === true}
                <ToggleRight size={28} style="color: #22d3a4;" />
              {:else}
                <ToggleLeft size={28} style="color: var(--text-quaternary);" />
              {/if}
            </button>
          </div>
        {/each}
      </div>
    {/if}
  {/if}
</div>
