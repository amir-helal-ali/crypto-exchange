<script lang="ts">
  import { onMount } from 'svelte';
  import { wallet } from '$lib/api/endpoints';
  import { authStore } from '$lib/stores/auth';
  import { parseApiResponse, ApiError } from '$lib/api/client';
  import { toasts } from '$lib/stores/toast';
  import { usdToEgp, egpCompact, usdEgpRate } from '$lib/utils/currency';
  import { wallet as walletApi } from '$lib/api/endpoints';
  import NavTabs from '$lib/components/NavTabs.svelte';
  import {
    User, Mail, Calendar, Shield, Save, Check, Lock, Bell, Coins,
    Globe, Sparkles, TrendingUp, Award, Fingerprint, Crown, Activity,
    Loader2, ArrowLeft
  } from 'lucide-svelte';

  let fullName = $state('');
  let username = $state('');
  let email = $state('');
  let loading = $state(false);
  let verified = $state(false);
  let twoFaEnabled = $state(false);
  let memberSince = $state('');
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
        twoFaEnabled = $authStore.two_fa_enabled || false;
        memberSince = $authStore.created_at || '';
      }
      try {
        const res = await wallet.getUserInfo();
        const data = await parseApiResponse<any>(res);
        if (data) {
          fullName = data.full_name || fullName;
          username = data.username || username;
          email = data.email || email;
          verified = data.email_verified ?? verified;
          twoFaEnabled = data.two_fa_enabled ?? twoFaEnabled;
          memberSince = data.created_at || memberSince;
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

  // Verification progress
  const verificationSteps = $derived([
    { label: 'بريد مُوثّق', done: verified, icon: Mail },
    { label: 'كلمة مرور قوية', done: true, icon: Lock },
    { label: 'المصادقة الثنائية', done: twoFaEnabled, icon: Fingerprint },
    { label: 'تحقق KYC', done: false, icon: Shield }
  ]);
  const verificationPct = $derived(
    (verificationSteps.filter((s) => s.done).length / verificationSteps.length) * 100
  );

  // Static tier classes (Tailwind JIT-safe)
  const tierClasses: Record<string, { border: string; text: string; bg: string }> = {
    violet: { border: 'border-accent-violet/30', text: 'text-accent-violet', bg: 'bg-accent-violet/15' },
    gold: { border: 'border-accent-gold/30', text: 'text-accent-gold', bg: 'bg-accent-gold/15' },
    azure: { border: 'border-accent-azure/30', text: 'text-accent-azure', bg: 'bg-accent-azure/15' },
    slate: { border: 'border-slate-500/30', text: 'text-slate-400', bg: 'bg-slate-500/15' }
  };

  const tier = $derived.by(() => {
    if (totalEgp > 1000000) return { name: 'VIP', icon: Crown, color: 'violet' as const };
    if (totalEgp > 200000) return { name: 'Gold', icon: Award, color: 'gold' as const };
    if (totalEgp > 50000) return { name: 'Silver', icon: Sparkles, color: 'azure' as const };
    return { name: 'Basic', icon: TrendingUp, color: 'slate' as const };
  });
</script>

<svelte:head><title>الملف الشخصي — NEXUS</title></svelte:head>

<div class="max-w-3xl mx-auto space-y-5 relative">
  <!-- Ambient aurora -->
  <div class="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
    <div class="absolute -top-20 right-1/4 w-80 h-80 bg-accent-gold/6 blur-[120px] rounded-full animate-pulse-glow"></div>
    <div class="absolute bottom-0 -left-32 w-80 h-80 bg-accent-violet/5 blur-[120px] rounded-full animate-pulse-glow" style="animation-delay: 2s;"></div>
  </div>

  <!-- Header -->
  <div class="relative">
    <div class="flex items-center gap-3">
      <div class="w-11 h-11 rounded-2xl bg-gradient-to-br from-accent-gold/20 to-accent-violet/10 border border-accent-gold/20 flex items-center justify-center">
        <User size={22} class="text-accent-gold" />
      </div>
      <div>
        <h1 class="text-2xl sm:text-3xl font-bold text-white tracking-tight">الملف الشخصي</h1>
        <p class="text-sm text-slate-400 mt-0.5">إدارة معلوماتك الشخصية وتفضيلاتك</p>
      </div>
    </div>
  </div>

  <!-- Profile header card — premium -->
  <div class="panel p-6 relative overflow-hidden">
    <div class="absolute inset-0 opacity-50 pointer-events-none" aria-hidden="true">
      <div class="absolute -top-12 -right-12 w-48 h-48 bg-accent-gold/15 blur-3xl rounded-full animate-pulse-glow"></div>
      <div class="absolute -bottom-12 -left-12 w-48 h-48 bg-accent-violet/10 blur-3xl rounded-full"></div>
    </div>
    <div class="absolute inset-0 grid-bg opacity-20 pointer-events-none"></div>

    <div class="relative flex items-center gap-4 flex-wrap">
      <!-- Avatar -->
      <div class="relative shrink-0">
        <div class="w-20 h-20 rounded-2xl bg-gradient-to-br from-accent-gold via-accent-rose to-accent-violet flex items-center justify-center text-2xl font-black text-ink-950">
          {(username || '??').slice(0, 2).toUpperCase()}
        </div>
        <div class="absolute -bottom-1 -right-1 w-7 h-7 rounded-xl bg-ink-900 border {tierClasses[tier.color].border} flex items-center justify-center">
          <tier.icon size={14} class={tierClasses[tier.color].text} />
        </div>
      </div>

      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-2 flex-wrap">
          <h2 class="text-xl font-bold text-white truncate tracking-tight">{fullName || username || 'مستخدم'}</h2>
          <span class="pill-gold flex items-center gap-1 text-[10px]">
            <tier.icon size={10} /> {tier.name}
          </span>
        </div>
        <p class="text-sm text-slate-400 truncate mt-0.5">{email}</p>
        <div class="flex items-center gap-2 mt-2 flex-wrap">
          {#if verified}
            <span class="pill-mint flex items-center gap-1 text-[10px]"><Check size={10} /> بريد مُوثّق</span>
          {:else}
            <span class="pill-rose flex items-center gap-1 text-[10px]"><Mail size={10} /> بريد غير مُوثّق</span>
          {/if}
          {#if twoFaEnabled}
            <span class="pill-mint flex items-center gap-1 text-[10px]"><Shield size={10} /> 2FA</span>
          {:else}
            <span class="pill-gold flex items-center gap-1 text-[10px]"><Shield size={10} /> 2FA غير مفعّل</span>
          {/if}
          <span class="pill bg-accent-gold/10 text-accent-gold border border-accent-gold/20 flex items-center gap-1 text-[10px]">
            <Coins size={10} /> {egpCompact(totalEgp)} ج.م
          </span>
          {#if memberSince}
            <span class="text-[10px] text-slate-500 flex items-center gap-1">
              <Calendar size={9} /> انضم {new Date(memberSince).toLocaleDateString('ar-EG')}
            </span>
          {/if}
        </div>
      </div>
    </div>

    <!-- Verification progress -->
    <div class="relative mt-5 pt-5 border-t border-white/5">
      <div class="flex items-center justify-between mb-2">
        <span class="text-[10px] uppercase tracking-wider text-slate-500 font-bold">مستوى التحقق</span>
        <span class="text-[10px] font-bold text-accent-gold tabular-nums">{verificationPct.toFixed(0)}%</span>
      </div>
      <div class="h-1.5 bg-white/5 rounded-full overflow-hidden">
        <div
          class="h-full bg-gradient-to-r from-accent-gold to-accent-mint transition-all duration-700"
          style="width: {verificationPct}%"
        ></div>
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
    <div class="panel p-6 relative overflow-hidden">
      <div class="absolute top-0 inset-x-0 h-px pointer-events-none" style="background: linear-gradient(90deg, transparent, rgba(245, 181, 68, 0.3), transparent);"></div>
      <form onsubmit={(e) => { e.preventDefault(); handleSave(); }} class="space-y-4">
        <div>
          <label class="input-label flex items-center gap-1.5" for="fullName">
            <User size={12} class="text-accent-gold" />
            الاسم الكامل
          </label>
          <div class="relative">
            <User size={16} class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input id="fullName" bind:value={fullName} type="text" class="input pr-10" placeholder="الاسم الكامل" />
          </div>
        </div>

        <div>
          <label class="input-label flex items-center gap-1.5" for="username">
            <User size={12} class="text-accent-gold" />
            اسم المستخدم
          </label>
          <div class="relative">
            <User size={16} class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input id="username" bind:value={username} type="text" disabled class="input pr-10 opacity-60" />
          </div>
          <p class="text-[10px] text-slate-500 mt-1 flex items-center gap-1">
            <Lock size={9} /> لا يمكن تغيير اسم المستخدم
          </p>
        </div>

        <div>
          <label class="input-label flex items-center gap-1.5" for="email">
            <Mail size={12} class="text-accent-gold" />
            البريد الإلكتروني
          </label>
          <div class="relative">
            <Mail size={16} class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input id="email" bind:value={email} type="email" disabled class="input pr-10 opacity-60" />
          </div>
          <p class="text-[10px] text-slate-500 mt-1 flex items-center gap-1">
            <Lock size={9} /> لا يمكن تغيير البريد الإلكتروني
          </p>
        </div>

        <button type="submit" disabled={loading} class="btn-primary w-full py-3">
          {#if loading}
            <Loader2 size={16} class="animate-spin" /> جارٍ الحفظ...
          {:else}
            <Save size={16} /> حفظ التغييرات
          {/if}
        </button>
      </form>
    </div>
  {:else if activeTab === 'security'}
    <div class="space-y-4">
      <div class="panel p-6 relative overflow-hidden">
        <div class="absolute top-0 inset-x-0 h-px pointer-events-none" style="background: linear-gradient(90deg, transparent, rgba(245, 181, 68, 0.3), transparent);"></div>
        <h3 class="text-base font-bold text-white flex items-center gap-2 mb-4">
          <div class="w-8 h-8 rounded-xl bg-accent-gold/10 border border-accent-gold/20 flex items-center justify-center">
            <Lock size={16} class="text-accent-gold" />
          </div>
          تغيير كلمة المرور
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
      </div>

      <!-- Verification checklist -->
      <div class="panel p-6">
        <h3 class="text-base font-bold text-white flex items-center gap-2 mb-4">
          <div class="w-8 h-8 rounded-xl bg-accent-mint/10 border border-accent-mint/20 flex items-center justify-center">
            <Shield size={16} class="text-accent-mint" />
          </div>
          خطوات التحقق
        </h3>
        <div class="space-y-2.5">
          {#each verificationSteps as step}
            <div class="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-colors">
              <div class="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 {step.done ? 'bg-accent-mint/15 border border-accent-mint/25' : 'bg-accent-gold/10 border border-accent-gold/20'}">
                {#if step.done}
                  <Check size={16} class="text-accent-mint" />
                {:else}
                  <step.icon size={16} class="text-accent-gold" />
                {/if}
              </div>
              <span class="text-sm font-medium text-white flex-1">{step.label}</span>
              {#if step.done}
                <span class="text-[9px] font-bold text-accent-mint uppercase tracking-wider">تم</span>
              {:else}
                <a href="/dashboard/security" class="text-[10px] text-accent-gold hover:underline flex items-center gap-1">
                  تفعيل <ArrowLeft size={10} />
                </a>
              {/if}
            </div>
          {/each}
        </div>
      </div>

      <!-- Security center link -->
      <a href="/dashboard/security" class="panel p-5 hover:border-accent-gold/30 transition-all group flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-accent-mint/15 to-accent-gold/10 border border-accent-mint/20 flex items-center justify-center">
            <Activity size={18} class="text-accent-mint" />
          </div>
          <div>
            <p class="text-sm font-semibold text-white">مركز الأمان</p>
            <p class="text-xs text-slate-400">إدارة 2FA والجلسات ومفاتيح API</p>
          </div>
        </div>
        <ArrowLeft size={16} class="text-slate-500 group-hover:text-accent-gold group-hover:-translate-x-1 transition-all" />
      </a>
    </div>
  {:else if activeTab === 'preferences'}
    <div class="panel p-6 space-y-5 relative overflow-hidden">
      <div class="absolute top-0 inset-x-0 h-px pointer-events-none" style="background: linear-gradient(90deg, transparent, rgba(168, 85, 247, 0.3), transparent);"></div>
      <div>
        <h3 class="text-base font-bold text-white mb-4 flex items-center gap-2">
          <div class="w-8 h-8 rounded-xl bg-accent-violet/10 border border-accent-violet/20 flex items-center justify-center">
            <Globe size={16} class="text-accent-violet" />
          </div>
          تفضيلات العرض
        </h3>

        <!-- Currency preference -->
        <div class="space-y-2">
          <span class="input-label flex items-center gap-1.5">
            <Coins size={12} class="text-accent-gold" />
            العملة الأساسية للعرض
          </span>
          <div class="grid grid-cols-2 gap-2">
            <button
              type="button"
              onclick={() => (preferredCurrency = 'EGP')}
              class="relative p-4 rounded-xl border text-right transition-all overflow-hidden {preferredCurrency === 'EGP'
                ? 'border-accent-gold/40 bg-accent-gold/10'
                : 'border-white/10 bg-white/[0.02] hover:bg-white/5'}"
            >
              {#if preferredCurrency === 'EGP'}
                <div class="absolute -top-6 -right-6 w-20 h-20 bg-accent-gold/15 blur-2xl rounded-full"></div>
              {/if}
              <div class="relative flex items-center justify-between">
                <div>
                  <p class="text-base font-bold text-white">ج.م</p>
                  <p class="text-[10px] text-slate-400">الجنيه المصري</p>
                </div>
                {#if preferredCurrency === 'EGP'}
                  <div class="w-5 h-5 rounded-full bg-accent-gold flex items-center justify-center">
                    <Check size={12} class="text-ink-950" />
                  </div>
                {/if}
              </div>
            </button>
            <button
              type="button"
              onclick={() => (preferredCurrency = 'USD')}
              class="relative p-4 rounded-xl border text-right transition-all overflow-hidden {preferredCurrency === 'USD'
                ? 'border-accent-gold/40 bg-accent-gold/10'
                : 'border-white/10 bg-white/[0.02] hover:bg-white/5'}"
            >
              {#if preferredCurrency === 'USD'}
                <div class="absolute -top-6 -right-6 w-20 h-20 bg-accent-gold/15 blur-2xl rounded-full"></div>
              {/if}
              <div class="relative flex items-center justify-between">
                <div>
                  <p class="text-base font-bold text-white">USD</p>
                  <p class="text-[10px] text-slate-400">دولار أمريكي</p>
                </div>
                {#if preferredCurrency === 'USD'}
                  <div class="w-5 h-5 rounded-full bg-accent-gold flex items-center justify-center">
                    <Check size={12} class="text-ink-950" />
                  </div>
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
          <span class="input-label flex items-center gap-1.5">
            <Globe size={12} class="text-accent-gold" />
            اللغة
          </span>
          <div class="grid grid-cols-2 gap-2">
            <button
              type="button"
              onclick={() => (preferredLanguage = 'ar')}
              class="p-4 rounded-xl border text-right transition-all {preferredLanguage === 'ar'
                ? 'border-accent-gold/40 bg-accent-gold/10'
                : 'border-white/10 bg-white/[0.02] hover:bg-white/5'}"
            >
              <div class="flex items-center justify-between">
                <div>
                  <p class="text-base font-bold text-white">العربية</p>
                  <p class="text-[10px] text-slate-400">RTL</p>
                </div>
                {#if preferredLanguage === 'ar'}
                  <div class="w-5 h-5 rounded-full bg-accent-gold flex items-center justify-center">
                    <Check size={12} class="text-ink-950" />
                  </div>
                {/if}
              </div>
            </button>
            <button
              type="button"
              onclick={() => (preferredLanguage = 'en')}
              class="p-4 rounded-xl border text-right transition-all {preferredLanguage === 'en'
                ? 'border-accent-gold/40 bg-accent-gold/10'
                : 'border-white/10 bg-white/[0.02] hover:bg-white/5'}"
            >
              <div class="flex items-center justify-between">
                <div>
                  <p class="text-base font-bold text-white">English</p>
                  <p class="text-[10px] text-slate-400">LTR</p>
                </div>
                {#if preferredLanguage === 'en'}
                  <div class="w-5 h-5 rounded-full bg-accent-gold flex items-center justify-center">
                    <Check size={12} class="text-ink-950" />
                  </div>
                {/if}
              </div>
            </button>
          </div>
        </div>

        <!-- Notifications -->
        <div class="space-y-3 mt-4">
          <span class="input-label flex items-center gap-1.5">
            <Bell size={12} class="text-accent-gold" />
            الإشعارات
          </span>
          <label class="flex items-center justify-between p-4 rounded-xl bg-white/[0.02] border border-white/5 cursor-pointer hover:bg-white/[0.04] transition-colors">
            <div class="flex items-center gap-3">
              <div class="w-9 h-9 rounded-xl bg-accent-mint/10 flex items-center justify-center">
                <Mail size={16} class="text-accent-mint" />
              </div>
              <div>
                <p class="text-sm font-medium text-white">إشعارات البريد الإلكتروني</p>
                <p class="text-[10px] text-slate-500">تلقي تحديثات الصفقات والمعاملات</p>
              </div>
            </div>
            <button
              type="button"
              aria-label="تبديل إشعارات البريد الإلكتروني"
              onclick={() => (emailNotifs = !emailNotifs)}
              class="relative w-11 h-6 rounded-full transition-colors {emailNotifs ? 'bg-accent-mint' : 'bg-white/10'}"
            >
              <span class="absolute top-0.5 {emailNotifs ? 'left-0.5' : 'right-0.5'} w-5 h-5 rounded-full bg-white shadow transition-all"></span>
            </button>
          </label>
          <label class="flex items-center justify-between p-4 rounded-xl bg-white/[0.02] border border-white/5 cursor-pointer hover:bg-white/[0.04] transition-colors">
            <div class="flex items-center gap-3">
              <div class="w-9 h-9 rounded-xl bg-accent-violet/10 flex items-center justify-center">
                <Bell size={16} class="text-accent-violet" />
              </div>
              <div>
                <p class="text-sm font-medium text-white">الإشعارات الفورية</p>
                <p class="text-[10px] text-slate-500">تنبيهات في المتصفح</p>
              </div>
            </div>
            <button
              type="button"
              aria-label="تبديل الإشعارات الفورية"
              onclick={() => (pushNotifs = !pushNotifs)}
              class="relative w-11 h-6 rounded-full transition-colors {pushNotifs ? 'bg-accent-mint' : 'bg-white/10'}"
            >
              <span class="absolute top-0.5 {pushNotifs ? 'left-0.5' : 'right-0.5'} w-5 h-5 rounded-full bg-white shadow transition-all"></span>
            </button>
          </label>
        </div>
      </div>

      <button onclick={savePreferences} class="btn-primary w-full py-3">
        <Save size={16} /> حفظ التفضيلات
      </button>
    </div>
  {/if}
</div>
