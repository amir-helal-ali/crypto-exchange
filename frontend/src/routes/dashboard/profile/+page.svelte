<script lang="ts">
  import { onMount } from 'svelte';
  import { wallet } from '$lib/api/endpoints';
  import { authStore } from '$lib/stores/auth';
  import { parseApiResponse, ApiError } from '$lib/api/client';
  import { toasts } from '$lib/stores/toast';
  import { usdToEgp, egpCompact, usdEgpRate } from '$lib/utils/currency';
  import { wallet as walletApi } from '$lib/api/endpoints';
  import NavTabs from '$lib/components/NavTabs.svelte';
  import { User, Mail, Calendar, Shield, Save, Check, Lock, Bell, Coins, Globe } from 'lucide-svelte';

  let fullName = $state('');
  let username = $state('');
  let email = $state('');
  let loading = $state(false);
  let verified = $state(false);
  let activeTab = $state<'personal' | 'security' | 'preferences'>('personal');
  let currentRate = $state(48.5);
  let balances = $state<any[]>([]);
  let totalUsd = $state(0);
  let totalEgp = $state(0);

  // Display preferences (EGP-first by default)
  let preferredCurrency = $state<'EGP' | 'USD'>('EGP');
  let preferredLanguage = $state<'ar' | 'en'>('ar');
  let emailNotifs = $state(true);
  let pushNotifs = $state(true);

  const unsubRate = usdEgpRate.subscribe((r) => (currentRate = r));

  onMount(() => {
(async () => {
    if ($authStore) {
      fullName = $authStore.full_name || '';
      username = $authStore.username || '';
      email = $authStore.email || '';
      verified = $authStore.email_verified || false;
    }
    try {
      const res = await wallet.getUserInfo();
      const data = await parseApiResponse<any>(res);
      if (data) {
        fullName = data.full_name || fullName;
        username = data.username || username;
        email = data.email || email;
        verified = data.email_verified ?? verified;
      }
    } catch {}

    // Load balances for stats summary
    try {
      const bRes = await walletApi.getBalances();
      const data = (await parseApiResponse<any[]>(bRes)) || [];
      balances = data.filter((b) => parseFloat(b.balance) > 0);
      totalUsd = balances.reduce((sum, b) => {
        const bal = parseFloat(b.balance);
        return sum + (b.currency === 'USDT' ? bal : 0);
      }, 0);
      totalEgp = usdToEgp(totalUsd, currentRate);
    } catch {}

    // Load saved prefs
    if (typeof localStorage !== 'undefined') {
      const pc = localStorage.getItem('preferred_currency');
      if (pc === 'EGP' || pc === 'USD') preferredCurrency = pc;
      const pl = localStorage.getItem('preferred_language');
      if (pl === 'ar' || pl === 'en') preferredLanguage = pl;
    }
  })();
  return unsubRate;
});

  async function handleSave() {
    if (!fullName.trim()) {
      toasts.error('الاسم الكامل مطلوب');
      return;
    }
    loading = true;
    try {
      const res = await wallet.updateProfile({ full_name: fullName.trim() });
      await parseApiResponse(res);
      toasts.success('تم تحديث الملف الشخصي');
    } catch (err: any) {
      if (err instanceof ApiError) toasts.error(err.message);
      else toasts.error('فشل التحديث');
    } finally {
      loading = false;
    }
  }

  function savePreferences() {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('preferred_currency', preferredCurrency);
      localStorage.setItem('preferred_language', preferredLanguage);
    }
    toasts.success('تم حفظ التفضيلات');
  }
</script>

<svelte:head><title>الملف الشخصي — NEXUS</title></svelte:head>

<div class="max-w-3xl mx-auto space-y-5">
  <div>
    <h1 class="text-2xl sm:text-3xl font-bold text-white">الملف الشخصي</h1>
    <p class="text-sm text-slate-400 mt-1">إدارة معلوماتك الشخصية وتفضيلاتك</p>
  </div>

  <!-- Profile header card -->
  <div class="panel p-6 relative overflow-hidden">
    <div class="absolute inset-0 opacity-25 pointer-events-none" aria-hidden="true">
      <div class="absolute -top-10 -right-10 w-40 h-40 bg-accent-gold/20 blur-3xl rounded-full"></div>
    </div>
    <div class="relative flex items-center gap-4">
      <div class="w-20 h-20 rounded-2xl bg-gradient-to-br from-accent-gold to-accent-rose flex items-center justify-center text-2xl font-bold text-ink-950 shrink-0">
        {(username || '??').slice(0, 2).toUpperCase()}
      </div>
      <div class="min-w-0 flex-1">
        <h2 class="text-xl font-bold text-white truncate">{fullName || username || 'مستخدم'}</h2>
        <p class="text-sm text-slate-400 truncate">{email}</p>
        <div class="flex items-center gap-2 mt-2 flex-wrap">
          {#if verified}
            <span class="pill-mint"><Check size={10} /> بريد مُوثّق</span>
          {:else}
            <span class="pill-gold">بريد غير مُوثّق</span>
          {/if}
          <span class="pill bg-accent-gold/10 text-accent-gold border border-accent-gold/20">
            <Coins size={10} /> {egpCompact(totalEgp)}
          </span>
        </div>
      </div>
    </div>
  </div>

  <!-- Nav tabs -->
  <NavTabs
    value={activeTab}
    onchange={(key) => (activeTab = key as any)}
    items={[
      { key: 'personal', label: 'المعلومات الشخصية', icon: User },
      { key: 'security', label: 'الأمان', icon: Shield },
      { key: 'preferences', label: 'التفضيلات', icon: Globe }
    ]}
  />

  {#if activeTab === 'personal'}
    <div class="panel p-6">
      <form onsubmit={(e) => { e.preventDefault(); handleSave(); }} class="space-y-4">
        <div>
          <label class="input-label" for="fullName">الاسم الكامل</label>
          <div class="relative">
            <User size={16} class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input id="fullName" bind:value={fullName} type="text" class="input pr-10" placeholder="الاسم الكامل" />
          </div>
        </div>

        <div>
          <label class="input-label" for="username">اسم المستخدم</label>
          <div class="relative">
            <User size={16} class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input id="username" bind:value={username} type="text" disabled class="input pr-10 opacity-60" />
          </div>
          <p class="text-[10px] text-slate-500 mt-1">لا يمكن تغيير اسم المستخدم</p>
        </div>

        <div>
          <label class="input-label" for="email">البريد الإلكتروني</label>
          <div class="relative">
            <Mail size={16} class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input id="email" bind:value={email} type="email" disabled class="input pr-10 opacity-60" />
          </div>
          <p class="text-[10px] text-slate-500 mt-1">لا يمكن تغيير البريد الإلكتروني</p>
        </div>

        <button type="submit" disabled={loading} class="btn-primary">
          {#if loading}
            <svg class="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          {:else}
            <Save size={16} /> حفظ التغييرات
          {/if}
        </button>
      </form>
    </div>
  {:else if activeTab === 'security'}
    <div class="panel p-6 space-y-4">
      <h3 class="text-base font-bold text-white flex items-center gap-2">
        <Lock size={18} class="text-accent-gold" /> تغيير كلمة المرور
      </h3>
      <form onsubmit={(e) => { e.preventDefault(); toasts.info('سيتم إضافة هذه الميزة قريباً'); }} class="space-y-4">
        <div>
          <label class="input-label" for="curPwd">كلمة المرور الحالية</label>
          <input id="curPwd" type="password" class="input" placeholder="••••••••" />
        </div>
        <div class="grid sm:grid-cols-2 gap-4">
          <div>
            <label class="input-label" for="newPwd">كلمة المرور الجديدة</label>
            <input id="newPwd" type="password" class="input" placeholder="••••••••" />
          </div>
          <div>
            <label class="input-label" for="confPwd">تأكيد كلمة المرور</label>
            <input id="confPwd" type="password" class="input" placeholder="••••••••" />
          </div>
        </div>
        <button type="submit" class="btn-secondary">تغيير كلمة المرور</button>
      </form>

      <div class="border-t border-white/5 pt-4">
        <a href="/dashboard/security" class="flex items-center justify-between p-3 rounded-xl hover:bg-white/5 transition-colors">
          <div class="flex items-center gap-3">
            <Shield size={18} class="text-accent-mint" />
            <div>
              <p class="text-sm font-medium text-white">المصادقة الثنائية والجلسات</p>
              <p class="text-xs text-slate-400">إدارة 2FA والجلسات النشطة ومفاتيح API</p>
            </div>
          </div>
          <span class="text-xs text-accent-gold">→</span>
        </a>
      </div>
    </div>
  {:else if activeTab === 'preferences'}
    <div class="panel p-6 space-y-5">
      <div>
        <h3 class="text-base font-bold text-white mb-4 flex items-center gap-2">
          <Globe size={18} class="text-accent-gold" /> تفضيلات العرض
        </h3>

        <!-- Currency preference -->
        <div class="space-y-2">
          <span class="input-label">العملة الأساسية للعرض</span>
          <div class="grid grid-cols-2 gap-2">
            <button
              type="button"
              onclick={() => (preferredCurrency = 'EGP')}
              class="p-3 rounded-xl border text-right transition-all {preferredCurrency === 'EGP'
                ? 'border-accent-gold/40 bg-accent-gold/10'
                : 'border-white/10 bg-white/[0.02] hover:bg-white/5'}"
            >
              <div class="flex items-center justify-between">
                <div>
                  <p class="text-sm font-bold text-white">ج.م</p>
                  <p class="text-[10px] text-slate-400">الجنيه المصري</p>
                </div>
                {#if preferredCurrency === 'EGP'}
                  <Check size={16} class="text-accent-gold" />
                {/if}
              </div>
            </button>
            <button
              type="button"
              onclick={() => (preferredCurrency = 'USD')}
              class="p-3 rounded-xl border text-right transition-all {preferredCurrency === 'USD'
                ? 'border-accent-gold/40 bg-accent-gold/10'
                : 'border-white/10 bg-white/[0.02] hover:bg-white/5'}"
            >
              <div class="flex items-center justify-between">
                <div>
                  <p class="text-sm font-bold text-white">USD</p>
                  <p class="text-[10px] text-slate-400">دولار أمريكي</p>
                </div>
                {#if preferredCurrency === 'USD'}
                  <Check size={16} class="text-accent-gold" />
                {/if}
              </div>
            </button>
          </div>
          <p class="text-[10px] text-slate-500 mt-1">
            الجنيه المصري هو العملة الافتراضية في المنصة. سيتم عرض جميع الأرصدة والصفقات بهذه العملة.
          </p>
        </div>

        <!-- Language preference -->
        <div class="space-y-2 mt-4">
          <span class="input-label">اللغة</span>
          <div class="grid grid-cols-2 gap-2">
            <button
              type="button"
              onclick={() => (preferredLanguage = 'ar')}
              class="p-3 rounded-xl border text-right transition-all {preferredLanguage === 'ar'
                ? 'border-accent-gold/40 bg-accent-gold/10'
                : 'border-white/10 bg-white/[0.02] hover:bg-white/5'}"
            >
              <div class="flex items-center justify-between">
                <div>
                  <p class="text-sm font-bold text-white">العربية</p>
                  <p class="text-[10px] text-slate-400">RTL</p>
                </div>
                {#if preferredLanguage === 'ar'}
                  <Check size={16} class="text-accent-gold" />
                {/if}
              </div>
            </button>
            <button
              type="button"
              onclick={() => (preferredLanguage = 'en')}
              class="p-3 rounded-xl border text-right transition-all {preferredLanguage === 'en'
                ? 'border-accent-gold/40 bg-accent-gold/10'
                : 'border-white/10 bg-white/[0.02] hover:bg-white/5'}"
            >
              <div class="flex items-center justify-between">
                <div>
                  <p class="text-sm font-bold text-white">English</p>
                  <p class="text-[10px] text-slate-400">LTR</p>
                </div>
                {#if preferredLanguage === 'en'}
                  <Check size={16} class="text-accent-gold" />
                {/if}
              </div>
            </button>
          </div>
        </div>

        <!-- Notifications -->
        <div class="space-y-3 mt-4">
          <span class="input-label">الإشعارات</span>
          <label class="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/5 cursor-pointer">
            <div class="flex items-center gap-3">
              <Mail size={16} class="text-slate-300" />
              <div>
                <p class="text-sm font-medium text-white">إشعارات البريد الإلكتروني</p>
                <p class="text-[10px] text-slate-500">تلقي تحديثات الصفقات والمعاملات</p>
              </div>
            </div>
            <button
              type="button"
              aria-label="تبديل إشعارات البريد الإلكتروني"
              onclick={() => (emailNotifs = !emailNotifs)}
              class="relative w-10 h-6 rounded-full transition-colors {emailNotifs ? 'bg-accent-mint' : 'bg-white/10'}"
            >
              <span class="absolute top-0.5 {emailNotifs ? 'left-0.5' : 'right-0.5'} w-5 h-5 rounded-full bg-white transition-all"></span>
            </button>
          </label>
          <label class="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/5 cursor-pointer">
            <div class="flex items-center gap-3">
              <Bell size={16} class="text-slate-300" />
              <div>
                <p class="text-sm font-medium text-white">الإشعارات الفورية</p>
                <p class="text-[10px] text-slate-500">تنبيهات في المتصفح</p>
              </div>
            </div>
            <button
              type="button"
              aria-label="تبديل الإشعارات الفورية"
              onclick={() => (pushNotifs = !pushNotifs)}
              class="relative w-10 h-6 rounded-full transition-colors {pushNotifs ? 'bg-accent-mint' : 'bg-white/10'}"
            >
              <span class="absolute top-0.5 {pushNotifs ? 'left-0.5' : 'right-0.5'} w-5 h-5 rounded-full bg-white transition-all"></span>
            </button>
          </label>
        </div>
      </div>

      <button onclick={savePreferences} class="btn-primary w-full">
        <Save size={16} /> حفظ التفضيلات
      </button>
    </div>
  {/if}
</div>
