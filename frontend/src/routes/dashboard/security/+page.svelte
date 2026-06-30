<script lang="ts">
  import { onMount } from 'svelte';
  import { auth } from '$lib/api/endpoints';
  import { parseApiResponse, ApiError } from '$lib/api/client';
  import { toasts } from '$lib/stores/toast';
  import { authStore } from '$lib/stores/auth';
  import NavTabs from '$lib/components/NavTabs.svelte';
  import {
    Shield, Smartphone, Key, Monitor, LogOut, Plus, Check,
    AlertTriangle, Lock, Fingerprint, ShieldCheck, ShieldAlert,
    Activity, MapPin, Wifi, Loader2, Sparkles, X, Copy
  } from 'lucide-svelte';

  let twoFaEnabled = $state(false);
  let showSetup = $state(false);
  let qrCode = $state('');
  let secret = $state('');
  let setupCode = $state('');
  let loading = $state(false);
  let sessions = $state<any[]>([]);
  let activeTab = $state<'2fa' | 'sessions' | 'api'>('2fa');
  let copiedSecret = $state(false);

  onMount(() => {
    (async () => {
      twoFaEnabled = $authStore?.two_fa_enabled || false;
      loadSessions();
    })();
  });

  async function loadSessions() {
    try {
      const res = await auth.getSessions();
      sessions = (await parseApiResponse<any[]>(res)) || [];
    } catch {}
  }

  async function setup2FA() {
    loading = true;
    try {
      const res = await auth.setup2FA();
      const data = await parseApiResponse<any>(res);
      qrCode = data.qr_code || data.qrcode || '';
      secret = data.secret || '';
      showSetup = true;
    } catch (err: any) {
      toasts.error('فشل إعداد 2FA');
    } finally {
      loading = false;
    }
  }

  async function confirmEnable2FA() {
    if (!setupCode || setupCode.length !== 6) {
      toasts.error('أدخل رمز 6 أرقام');
      return;
    }
    loading = true;
    try {
      await auth.enable2FA(setupCode);
      toasts.success('تم تفعيل المصادقة الثنائية');
      twoFaEnabled = true;
      showSetup = false;
      setupCode = '';
    } catch (err: any) {
      toasts.error(err instanceof ApiError ? err.message : 'رمز غير صحيح');
    } finally {
      loading = false;
    }
  }

  async function disable2FA() {
    const code = prompt('أدخل رمز المصادقة لإلغاء التفعيل');
    if (!code) return;
    try {
      await auth.disable2FA(code);
      toasts.success('تم إلغاء تفعيل المصادقة الثنائية');
      twoFaEnabled = false;
    } catch {
      toasts.error('فشل إلغاء التفعيل');
    }
  }

  function copySecret() {
    if (secret) {
      navigator.clipboard.writeText(secret);
      copiedSecret = true;
      setTimeout(() => (copiedSecret = false), 2000);
    }
  }

  // Security score calculation (0-100)
  const securityScore = $derived.by(() => {
    let score = 0;
    if (twoFaEnabled) score += 50;
    if (sessions.length <= 2) score += 25; else if (sessions.length <= 5) score += 15;
    score += 25; // baseline for having a verified account
    return Math.min(score, 100);
  });

  const scoreLabel = $derived(
    securityScore >= 90 ? 'ممتاز' :
    securityScore >= 70 ? 'جيد جداً' :
    securityScore >= 50 ? 'جيد' :
    'يحتاج تحسين'
  );

  const scoreColor = $derived(
    securityScore >= 90 ? '#22d3a4' :
    securityScore >= 70 ? '#f5b544' :
    securityScore >= 50 ? '#a855f7' :
    '#fb7185'
  );

  // SVG gauge calculation
  const gaugeRadius = 52;
  const gaugeCircumference = 2 * Math.PI * gaugeRadius;
  const gaugeOffset = $derived(gaugeCircumference - (securityScore / 100) * gaugeCircumference);

  // Security checklist items
  const checklist = $derived([
    { label: 'المصادقة الثنائية (2FA)', done: twoFaEnabled, icon: Fingerprint },
    { label: 'بريد إلكتروني مُوثّق', done: true, icon: Check },
    { label: 'كلمة مرور قوية', done: true, icon: Lock },
    { label: 'جلسات قليلة نشطة', done: sessions.length <= 2, icon: Monitor }
  ]);
</script>

<svelte:head><title>الأمان — NEXUS</title></svelte:head>

<div class="max-w-3xl mx-auto space-y-5 relative">
  <!-- Ambient aurora -->
  <div class="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
    <div class="absolute -top-20 right-1/4 w-80 h-80 bg-accent-mint/6 blur-[120px] rounded-full animate-pulse-glow"></div>
    <div class="absolute bottom-0 -left-32 w-80 h-80 bg-accent-gold/5 blur-[120px] rounded-full animate-pulse-glow" style="animation-delay: 2s;"></div>
  </div>

  <!-- Header -->
  <div class="relative">
    <div class="flex items-center gap-3">
      <div class="w-11 h-11 rounded-2xl bg-gradient-to-br from-accent-mint/15 to-accent-gold/10 border border-accent-mint/20 flex items-center justify-center">
        <Shield size={22} class="text-accent-mint" />
      </div>
      <div>
        <h1 class="text-2xl sm:text-3xl font-bold text-white tracking-tight">الأمان</h1>
        <p class="text-sm text-slate-400 mt-0.5">حماية حسابك والتحكم في الجلسات</p>
      </div>
    </div>
  </div>

  <!-- Security score gauge + checklist -->
  <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
    <!-- Score gauge -->
    <div class="panel p-5 relative overflow-hidden">
      <div class="absolute -top-12 -right-12 w-32 h-32 blur-3xl rounded-full" style="background: {scoreColor}20;"></div>
      <div class="relative flex flex-col items-center">
        <h3 class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 self-start">درجة الأمان</h3>
        <div class="relative w-32 h-32">
          <svg width="128" height="128" viewBox="0 0 128 128" class="-rotate-90">
            <circle cx="64" cy="64" r={gaugeRadius} stroke="rgba(255,255,255,0.05)" stroke-width="8" fill="none" />
            <circle
              cx="64"
              cy="64"
              r={gaugeRadius}
              stroke={scoreColor}
              stroke-width="8"
              fill="none"
              stroke-linecap="round"
              stroke-dasharray={gaugeCircumference}
              stroke-dashoffset={gaugeOffset}
              style="transition: stroke-dashoffset 1s ease-out, stroke 0.5s;"
            />
          </svg>
          <div class="absolute inset-0 flex flex-col items-center justify-center">
            <span class="text-3xl font-bold text-white tabular-nums">{securityScore}</span>
            <span class="text-[9px] text-slate-500 uppercase tracking-wider">من 100</span>
          </div>
        </div>
        <div class="mt-3 flex items-center gap-1.5 px-3 py-1 rounded-full" style="background: {scoreColor}15; border: 1px solid {scoreColor}30;">
          <ShieldCheck size={12} style="color: {scoreColor};" />
          <span class="text-xs font-bold" style="color: {scoreColor};">{scoreLabel}</span>
        </div>
      </div>
    </div>

    <!-- Checklist -->
    <div class="panel p-5">
      <h3 class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">قائمة التحقق</h3>
      <div class="space-y-2.5">
        {#each checklist as item}
          <div class="flex items-center gap-2.5">
            <div class="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 {item.done ? 'bg-accent-mint/15 border border-accent-mint/25' : 'bg-accent-gold/10 border border-accent-gold/20'}">
              {#if item.done}
                <Check size={14} class="text-accent-mint" />
              {:else}
                <item.icon size={14} class="text-accent-gold" />
              {/if}
            </div>
            <span class="text-xs font-medium text-white flex-1">{item.label}</span>
            {#if item.done}
              <span class="text-[9px] font-bold text-accent-mint uppercase tracking-wider">تم</span>
            {:else}
              <span class="text-[9px] font-bold text-accent-gold uppercase tracking-wider">معلّق</span>
            {/if}
          </div>
        {/each}
      </div>
    </div>
  </div>

  <!-- Nav tabs -->
  <NavTabs
    value={activeTab}
    onchange={(key) => (activeTab = key as any)}
    items={[
      { key: '2fa', label: 'المصادقة الثنائية', icon: Fingerprint },
      { key: 'sessions', label: 'الجلسات', icon: Monitor, count: sessions.length },
      { key: 'api', label: 'مفاتيح API', icon: Key }
    ]}
  />

  {#if activeTab === '2fa'}
    <div class="panel p-6 relative overflow-hidden">
      <div class="absolute top-0 inset-x-0 h-px pointer-events-none" style="background: linear-gradient(90deg, transparent, {twoFaEnabled ? 'rgba(34, 211, 164, 0.4)' : 'rgba(245, 181, 68, 0.4)'}, transparent);"></div>
      <div class="absolute -top-12 -right-12 w-32 h-32 blur-3xl rounded-full {twoFaEnabled ? 'bg-accent-mint/10' : 'bg-accent-gold/10'}"></div>

      <div class="relative">
        <div class="flex items-start justify-between mb-5">
          <div class="flex items-start gap-3">
            <div class="relative w-12 h-12 rounded-2xl {twoFaEnabled ? 'bg-accent-mint/10 border-accent-mint/20' : 'bg-accent-gold/10 border-accent-gold/20'} border flex items-center justify-center">
              <Shield size={22} class={twoFaEnabled ? 'text-accent-mint' : 'text-accent-gold'} />
              {#if twoFaEnabled}
                <span class="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-accent-mint flex items-center justify-center border-2 border-ink-900">
                  <Check size={10} class="text-ink-950" />
                </span>
              {/if}
            </div>
            <div>
              <h3 class="text-base font-bold text-white">المصادقة الثنائية (2FA)</h3>
              <p class="text-xs text-slate-400 mt-0.5">طبقة حماية إضافية باستخدام تطبيق TOTP</p>
            </div>
          </div>
          {#if twoFaEnabled}
            <span class="pill-mint flex items-center gap-1"><Check size={10} /> مفعّلة</span>
          {:else}
            <span class="pill-gold flex items-center gap-1"><AlertTriangle size={10} /> غير مفعّلة</span>
          {/if}
        </div>

        {#if twoFaEnabled}
          <!-- Enabled state — premium card -->
          <div class="panel p-4 bg-accent-mint/5 border-accent-mint/15 mb-4">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-xl bg-accent-mint/15 flex items-center justify-center shrink-0">
                <ShieldCheck size={20} class="text-accent-mint" />
              </div>
              <div class="flex-1">
                <p class="text-sm font-semibold text-white">حسابك محمي بالمصادقة الثنائية</p>
                <p class="text-xs text-slate-400 mt-0.5">يُطلب رمز 2FA عند تسجيل الدخول والعمليات الحساسة</p>
              </div>
            </div>
          </div>
          <button onclick={disable2FA} class="btn-secondary text-accent-rose hover:bg-accent-rose/5 border-accent-rose/20">
            <X size={14} /> إلغاء التفعيل
          </button>
        {:else if showSetup}
          <!-- Setup wizard -->
          <div class="space-y-5">
            <!-- Step indicator -->
            <div class="flex items-center justify-center gap-2 mb-4">
              {#each [1, 2, 3] as step}
                <div class="flex items-center gap-2">
                  <div class="w-6 h-6 rounded-full {step === 1 ? 'bg-accent-gold text-ink-950' : 'bg-white/5 text-slate-500'} flex items-center justify-center text-[10px] font-bold">
                    {step}
                  </div>
                  {#if step < 3}
                    <div class="w-8 h-px bg-white/10"></div>
                  {/if}
                </div>
              {/each}
            </div>

            {#if qrCode}
              <div class="flex flex-col items-center gap-3">
                <div class="relative">
                  <div class="absolute inset-0 bg-accent-gold/20 blur-2xl rounded-2xl"></div>
                  <img src={qrCode} alt="QR Code" class="relative w-44 h-44 rounded-2xl bg-white p-3 shadow-2xl" />
                </div>
                <p class="text-xs text-slate-400 text-center max-w-xs">
                  امسح الرمز باستخدام تطبيق المصادقة (Google Authenticator, Authy, 1Password)
                </p>
              </div>
            {/if}

            {#if secret}
              <div class="panel p-3 bg-ink-950/60 border-accent-gold/15">
                <div class="flex items-center justify-between mb-1">
                  <p class="text-[10px] text-slate-500 font-bold uppercase tracking-wider">المفتاح السري</p>
                  <button onclick={copySecret} class="text-[10px] text-accent-gold hover:underline flex items-center gap-1">
                    {#if copiedSecret}
                      <Check size={10} /> تم النسخ
                    {:else}
                      <Copy size={10} /> نسخ
                    {/if}
                  </button>
                </div>
                <code class="text-xs font-mono text-accent-gold break-all leading-relaxed">{secret}</code>
              </div>
            {/if}

            <div>
              <span class="input-label flex items-center gap-1.5">
                <Key size={12} class="text-accent-gold" />
                أدخل الرمز من تطبيق المصادقة
              </span>
              <input
                bind:value={setupCode}
                type="text"
                maxlength="6"
                inputmode="numeric"
                placeholder="000000"
                class="input text-center text-2xl tracking-[0.5em] font-mono font-bold"
              />
              <p class="text-[10px] text-slate-500 mt-1.5 text-center">رمز من 6 أرقام يتجدّد كل 30 ثانية</p>
            </div>

            <div class="flex gap-2">
              <button onclick={confirmEnable2FA} disabled={loading || setupCode.length !== 6} class="btn-primary flex-1">
                {#if loading}
                  <Loader2 size={16} class="animate-spin" /> جارٍ التحقق...
                {:else}
                  <Check size={16} /> تأكيد التفعيل
                {/if}
              </button>
              <button onclick={() => (showSetup = false)} class="btn-secondary">إلغاء</button>
            </div>
          </div>
        {:else}
          <!-- Initial state -->
          <div class="space-y-4">
            <div class="panel p-4 bg-accent-gold/5 border-accent-gold/15 flex items-start gap-3">
              <div class="w-9 h-9 rounded-xl bg-accent-gold/15 flex items-center justify-center shrink-0">
                <ShieldAlert size={18} class="text-accent-gold" />
              </div>
              <div class="flex-1">
                <p class="text-sm font-semibold text-white">حسابك غير محمي بالكامل</p>
                <p class="text-xs text-slate-400 mt-0.5 leading-relaxed">
                  فعّل المصادقة الثنائية لإضافة طبقة حماية إضافية. سيُطلب رمز سري عند كل تسجيل دخول أو عملية حساسة.
                </p>
              </div>
            </div>
            <button onclick={setup2FA} disabled={loading} class="btn-primary w-full py-3">
              {#if loading}
                <Loader2 size={16} class="animate-spin" /> جارٍ التحضير...
              {:else}
                <Plus size={16} /> تفعيل المصادقة الثنائية
              {/if}
            </button>
          </div>
        {/if}
      </div>
    </div>
  {:else if activeTab === 'sessions'}
    <div class="panel overflow-hidden relative">
      <div class="absolute top-0 inset-x-0 h-px pointer-events-none" style="background: linear-gradient(90deg, transparent, rgba(168, 85, 247, 0.3), transparent);"></div>
      <div class="px-5 py-4 border-b border-white/5 flex items-center justify-between">
        <h3 class="text-sm font-bold text-white flex items-center gap-2">
          <div class="w-7 h-7 rounded-lg bg-accent-violet/10 border border-accent-violet/20 flex items-center justify-center">
            <Monitor size={14} class="text-accent-violet" />
          </div>
          الجلسات النشطة
        </h3>
        <span class="text-xs text-slate-500">{sessions.length} جلسة</span>
      </div>
      {#if sessions.length === 0}
        <div class="py-16 text-center">
          <div class="relative inline-block mb-3">
            <div class="absolute inset-0 bg-accent-violet/10 blur-2xl rounded-full"></div>
            <Monitor size={40} class="relative text-slate-600 mx-auto" />
          </div>
          <p class="text-sm font-medium text-slate-300">لا توجد جلسات نشطة</p>
          <p class="text-xs text-slate-500 mt-1">ستظهر هنا جميع الأجهزة المتصلة بحسابك</p>
        </div>
      {:else}
        <div class="divide-y divide-white/5">
          {#each sessions as s}
            <div class="flex items-center justify-between px-5 py-3.5 hover:bg-white/[0.02] transition-colors group">
              <div class="flex items-center gap-3">
                <div class="relative w-10 h-10 rounded-xl bg-white/[0.03] border border-white/5 flex items-center justify-center">
                  {#if s.current}
                    <Smartphone size={16} class="text-accent-mint" />
                  {:else}
                    <Monitor size={16} class="text-slate-400" />
                  {/if}
                  {#if s.current}
                    <span class="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-accent-mint border-2 border-ink-900"></span>
                  {/if}
                </div>
                <div>
                  <p class="text-sm font-semibold text-white flex items-center gap-1.5">
                    {s.device || s.user_agent || 'جهاز'}
                    {#if s.current}
                      <span class="pill-mint text-[9px] px-1.5 py-0">الحالية</span>
                    {/if}
                  </p>
                  <div class="flex items-center gap-3 mt-0.5">
                    <p class="text-xs text-slate-400 flex items-center gap-1">
                      <MapPin size={9} />
                      {s.ip_address || 'IP غير معروف'}
                    </p>
                    {#if s.last_active}
                      <p class="text-[10px] text-slate-500 flex items-center gap-1">
                        <Activity size={9} />
                        {s.last_active}
                      </p>
                    {/if}
                  </div>
                </div>
              </div>
              {#if !s.current}
                <button
                  onclick={async () => {
                    try {
                      await auth.revokeSession(s.id);
                      toasts.success('تم إنهاء الجلسة');
                      loadSessions();
                    } catch {
                      toasts.error('فشل إنهاء الجلسة');
                    }
                  }}
                  class="p-2 rounded-lg text-slate-500 hover:bg-accent-rose/10 hover:text-accent-rose transition-colors opacity-0 group-hover:opacity-100"
                  aria-label="إنهاء الجلسة"
                  title="إنهاء الجلسة"
                >
                  <LogOut size={14} />
                </button>
              {/if}
            </div>
          {/each}
        </div>
      {/if}
    </div>
  {:else if activeTab === 'api'}
    <div class="panel p-6 relative overflow-hidden">
      <div class="absolute -top-12 -right-12 w-32 h-32 bg-accent-gold/8 blur-3xl rounded-full"></div>
      <div class="relative">
        <h3 class="text-base font-bold text-white mb-2 flex items-center gap-2">
          <div class="w-8 h-8 rounded-xl bg-accent-gold/10 border border-accent-gold/20 flex items-center justify-center">
            <Key size={16} class="text-accent-gold" />
          </div>
          مفاتيح API
        </h3>
        <p class="text-xs text-slate-400 mb-4 leading-relaxed">
          أنشئ مفاتيح API للوصول البرمجي إلى حسابك. استخدم المفاتيح بمسؤولية ولا تشاركها مع أي طرف خارجي.
        </p>

        <!-- Permission tiers -->
        <div class="grid grid-cols-3 gap-2 mb-4">
          <div class="panel p-3 text-center bg-accent-mint/5 border-accent-mint/15">
            <Lock size={14} class="text-accent-mint mx-auto mb-1" />
            <p class="text-[10px] font-bold text-white">قراءة</p>
            <p class="text-[9px] text-slate-500 mt-0.5">افتراضي</p>
          </div>
          <div class="panel p-3 text-center bg-accent-gold/5 border-accent-gold/15">
            <Activity size={14} class="text-accent-gold mx-auto mb-1" />
            <p class="text-[10px] font-bold text-white">تداول</p>
            <p class="text-[9px] text-slate-500 mt-0.5">يتطلب 2FA</p>
          </div>
          <div class="panel p-3 text-center bg-accent-rose/5 border-accent-rose/15">
            <AlertTriangle size={14} class="text-accent-rose mx-auto mb-1" />
            <p class="text-[10px] font-bold text-white">سحب</p>
            <p class="text-[9px] text-slate-500 mt-0.5">مُعطّل</p>
          </div>
        </div>

        <div class="panel p-3 bg-accent-gold/5 border-accent-gold/15 mb-4 flex items-start gap-2">
          <Lock size={14} class="text-accent-gold shrink-0 mt-0.5" />
          <p class="text-[11px] text-slate-300 leading-relaxed">
            سيتم تطبيق صلاحيات القراءة فقط افتراضياً. تحتاج الصلاحيات الأخرى (تداول، سحب) إلى تفعيل 2FA أولاً.
          </p>
        </div>
        <button onclick={() => toasts.info('سيتم إضافة هذه الميزة قريباً')} class="btn-secondary w-full">
          <Plus size={14} /> إنشاء مفتاح جديد
        </button>
      </div>
    </div>
  {/if}
</div>
