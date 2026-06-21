<script lang="ts">
  import { onMount } from 'svelte';
  import { auth } from '$lib/api/endpoints';
  import { parseApiResponse, ApiError } from '$lib/api/client';
  import { toasts } from '$lib/stores/toast';
  import { authStore } from '$lib/stores/auth';
  import NavTabs from '$lib/components/NavTabs.svelte';
  import { Shield, Smartphone, Key, Monitor, LogOut, Plus, Check, AlertTriangle, Lock, Fingerprint } from 'lucide-svelte';

  let twoFaEnabled = $state(false);
  let showSetup = $state(false);
  let qrCode = $state('');
  let secret = $state('');
  let setupCode = $state('');
  let loading = $state(false);
  let sessions = $state<any[]>([]);
  let activeTab = $state<'2fa' | 'sessions' | 'api'>('2fa');

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
</script>

<svelte:head><title>الأمان — NEXUS</title></svelte:head>

<div class="max-w-3xl mx-auto space-y-5">
  <div>
    <h1 class="text-2xl sm:text-3xl font-bold text-white">الأمان</h1>
    <p class="text-sm text-slate-400 mt-1">حماية حسابك والتحكم في الجلسات</p>
  </div>

  <!-- Security overview pills -->
  <div class="grid grid-cols-3 gap-3">
    <div class="panel p-4 text-center">
      <div class="w-10 h-10 rounded-xl {twoFaEnabled ? 'bg-accent-mint/15' : 'bg-accent-gold/15'} flex items-center justify-center mx-auto mb-2">
        <Shield size={18} class={twoFaEnabled ? 'text-accent-mint' : 'text-accent-gold'} />
      </div>
      <p class="text-xs text-slate-400">2FA</p>
      <p class="text-sm font-bold {twoFaEnabled ? 'text-accent-mint' : 'text-accent-gold'}">
        {twoFaEnabled ? 'مفعّلة' : 'معطّلة'}
      </p>
    </div>
    <div class="panel p-4 text-center">
      <div class="w-10 h-10 rounded-xl bg-accent-azure/15 flex items-center justify-center mx-auto mb-2">
        <Monitor size={18} class="text-accent-azure" />
      </div>
      <p class="text-xs text-slate-400">الجلسات</p>
      <p class="text-sm font-bold text-white">{sessions.length}</p>
    </div>
    <div class="panel p-4 text-center">
      <div class="w-10 h-10 rounded-xl bg-accent-violet/15 flex items-center justify-center mx-auto mb-2">
        <Key size={18} class="text-accent-violet" />
      </div>
      <p class="text-xs text-slate-400">مفاتيح API</p>
      <p class="text-sm font-bold text-white">0</p>
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
    <div class="panel p-6">
      <div class="flex items-start justify-between mb-4">
        <div class="flex items-start gap-3">
          <div class="w-11 h-11 rounded-xl {twoFaEnabled ? 'bg-accent-mint/10 border-accent-mint/20' : 'bg-accent-gold/10 border-accent-gold/20'} border flex items-center justify-center">
            <Shield size={20} class={twoFaEnabled ? 'text-accent-mint' : 'text-accent-gold'} />
          </div>
          <div>
            <h3 class="text-base font-bold text-white">المصادقة الثنائية (2FA)</h3>
            <p class="text-xs text-slate-400 mt-0.5">طبقة حماية إضافية لحسابك</p>
          </div>
        </div>
        {#if twoFaEnabled}
          <span class="pill-mint"><Check size={10} /> مفعّلة</span>
        {:else}
          <span class="pill-gold">غير مفعّلة</span>
        {/if}
      </div>

      {#if !showSetup && !twoFaEnabled}
        <button onclick={setup2FA} disabled={loading} class="btn-primary">
          <Plus size={16} /> تفعيل 2FA
        </button>
      {:else if showSetup}
        <div class="space-y-4">
          {#if qrCode}
            <div class="flex justify-center">
              <img src={qrCode} alt="QR Code" class="w-48 h-48 rounded-xl bg-white p-3" />
            </div>
          {/if}
          {#if secret}
            <div class="panel p-3 bg-ink-950/60">
              <p class="text-[10px] text-slate-500 mb-1">المفتاح السري:</p>
              <code class="text-xs font-mono text-accent-gold break-all">{secret}</code>
            </div>
          {/if}
          <div>
            <span class="input-label">أدخل الرمز من تطبيق المصادقة</span>
            <input
              bind:value={setupCode}
              type="text"
              maxlength="6"
              inputmode="numeric"
              placeholder="000000"
              class="input text-center text-xl tracking-[0.4em] font-mono"
            />
          </div>
          <div class="flex gap-2">
            <button onclick={confirmEnable2FA} disabled={loading} class="btn-primary flex-1">
              تأكيد التفعيل
            </button>
            <button onclick={() => (showSetup = false)} class="btn-secondary">إلغاء</button>
          </div>
        </div>
      {:else if twoFaEnabled}
        <button onclick={disable2FA} class="btn-secondary">
          <AlertTriangle size={14} /> إلغاء التفعيل
        </button>
      {/if}
    </div>
  {:else if activeTab === 'sessions'}
    <div class="panel overflow-hidden">
      <div class="px-5 py-4 border-b border-white/5 flex items-center justify-between">
        <h3 class="text-sm font-bold text-white flex items-center gap-2">
          <Monitor size={16} class="text-accent-gold" /> الجلسات النشطة
        </h3>
        <span class="text-xs text-slate-500">{sessions.length} جلسة</span>
      </div>
      {#if sessions.length === 0}
        <div class="py-8 text-center text-slate-500 text-sm">لا توجد جلسات</div>
      {:else}
        <div class="divide-y divide-white/5">
          {#each sessions as s}
            <div class="flex items-center justify-between px-5 py-3 hover:bg-white/[0.02]">
              <div class="flex items-center gap-3">
                <div class="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center">
                  <Smartphone size={14} class="text-slate-300" />
                </div>
                <div>
                  <p class="text-sm font-medium text-white">{s.device || s.user_agent || 'جهاز'}</p>
                  <p class="text-xs text-slate-400">{s.ip_address || 'IP غير معروف'}</p>
                </div>
              </div>
              {#if s.current}
                <span class="pill-mint text-[10px]">الحالية</span>
              {:else}
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
                  class="text-accent-rose hover:bg-accent-rose/10 p-1.5 rounded-lg"
                  aria-label="إنهاء الجلسة"
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
    <div class="panel p-6">
      <h3 class="text-base font-bold text-white mb-2 flex items-center gap-2">
        <Key size={18} class="text-accent-gold" /> مفاتيح API
      </h3>
      <p class="text-xs text-slate-400 mb-4 leading-relaxed">
        أنشئ مفاتيح API للوصول البرمجي إلى حسابك. استخدم المفاتيح بمسؤولية ولا تشاركها مع أي طرف خارجي.
      </p>
      <div class="panel p-4 bg-accent-gold/5 border-accent-gold/20 mb-4">
        <div class="flex items-start gap-2">
          <Lock size={14} class="text-accent-gold shrink-0 mt-0.5" />
          <p class="text-[11px] text-slate-300 leading-relaxed">
            سيتم تطبيق صلاحيات القراءة فقط افتراضياً. تحتاج الصلاحيات الأخرى (تداول، سحب) إلى تفعيل 2FA أولاً.
          </p>
        </div>
      </div>
      <button onclick={() => toasts.info('سيتم إضافة هذه الميزة قريباً')} class="btn-secondary">
        <Plus size={14} /> إنشاء مفتاح جديد
      </button>
    </div>
  {/if}
</div>
