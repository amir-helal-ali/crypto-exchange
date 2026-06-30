<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { auth } from '$lib/api/endpoints';
  import { parseApiResponse, forceLogout } from '$lib/api/client';
  import { authStore } from '$lib/stores/auth';
  import { toasts } from '$lib/stores/toast';
  import Button from '$lib/components/Button.svelte';
  import {
    Mail, Lock, Eye, EyeOff, ArrowLeft, ShieldCheck, Zap, TrendingUp,
    Loader2, Fingerprint, Sparkles, Crown, Activity, ChevronLeft
  } from 'lucide-svelte';
  import ParticleBackground from '$lib/components/ParticleBackground.svelte';

  let email = $state('');
  let password = $state('');
  let twoFaCode = $state('');
  let showPassword = $state(false);
  let loading = $state(false);
  let requires2FA = $state(false);
  let tempToken = $state('');
  let errors = $state<Record<string, string>>({});

  onMount(() => {
    if (authStore.isAuthenticated()) {
      goto('/dashboard');
    }
  });

  async function handleSubmit(e: Event) {
    e.preventDefault();
    errors = {};

    if (!email.trim()) {
      errors.email = 'البريد الإلكتروني مطلوب';
      return;
    }
    if (!password) {
      errors.password = 'كلمة المرور مطلوبة';
      return;
    }

    loading = true;
    try {
      if (requires2FA) {
        if (!twoFaCode.trim() || twoFaCode.length !== 6) {
          errors.twoFaCode = 'أدخل رمز 2FA المكوّن من 6 أرقام';
          loading = false;
          return;
        }
        const res = await auth.verify2FA(tempToken, twoFaCode);
        const data = await parseApiResponse<{
          token: string;
          refresh_token: string;
          user: any;
        }>(res);
        localStorage.setItem('token', data.token);
        localStorage.setItem('refresh_token', data.refresh_token);
        localStorage.setItem('user', JSON.stringify(data.user));
        authStore.setUser(data.user);
        toasts.success('مرحباً بعودتك!');
        await goto('/dashboard');
        return;
      }

      const res = await auth.login({ email: email.trim(), password });
      const data = await res.json();

      if (data.requires_2fa) {
        requires2FA = true;
        tempToken = data.temp_token;
        toasts.info('أدخل رمز المصادقة الثنائية');
        loading = false;
        return;
      }

      if (!res.ok) throw new Error(data.error || 'فشل تسجيل الدخول');

      localStorage.setItem('token', data.token || data.data?.token);
      localStorage.setItem('refresh_token', data.refresh_token || data.data?.refresh_token);
      localStorage.setItem('user', JSON.stringify(data.user || data.data?.user));
      authStore.setUser(data.user || data.data?.user);
      toasts.success('مرحباً بعودتك!');
      await goto('/dashboard');
    } catch (err: any) {
      toasts.error(err.message || 'فشل تسجيل الدخول. تحقق من بياناتك.');
    } finally {
      loading = false;
    }
  }

  const features = [
    { icon: Zap, label: 'تنفيذ فوري', sub: '< 10 مللي ثانية', color: 'mint' },
    { icon: ShieldCheck, label: 'أمان مصرفي', sub: '2FA + تشفير', color: 'azure' },
    { icon: TrendingUp, label: 'سيولة عالية', sub: '+200 زوج تداول', color: 'gold' }
  ];

  // Static class lookups (Tailwind JIT safe)
  const colorClasses: Record<string, { bg: string; border: string; text: string }> = {
    mint: { bg: 'bg-accent-mint/10', border: 'border-accent-mint/20', text: 'text-accent-mint' },
    azure: { bg: 'bg-accent-azure/10', border: 'border-accent-azure/20', text: 'text-accent-azure' },
    gold: { bg: 'bg-accent-gold/10', border: 'border-accent-gold/20', text: 'text-accent-gold' },
    violet: { bg: 'bg-accent-violet/10', border: 'border-accent-violet/20', text: 'text-accent-violet' },
    rose: { bg: 'bg-accent-rose/10', border: 'border-accent-rose/20', text: 'text-accent-rose' }
  };
</script>

<ParticleBackground />

<div class="min-h-screen flex items-center justify-center p-4 sm:p-6 relative">
  <!-- Top fixed gradient strip -->
  <div class="fixed top-0 inset-x-0 h-px pointer-events-none z-50" style="background: linear-gradient(90deg, transparent, rgba(245, 181, 68, 0.5), rgba(168, 85, 247, 0.4), transparent);"></div>

  <div class="w-full max-w-5xl grid lg:grid-cols-2 gap-0 panel-glow overflow-hidden relative" style="min-height: 620px;">
    <!-- Inner topbar gradient highlight -->
    <div class="absolute top-0 inset-x-0 h-px pointer-events-none z-10" style="background: linear-gradient(90deg, transparent 10%, rgba(245, 181, 68, 0.6) 50%, transparent 90%);"></div>

    <!-- Left side — brand showcase -->
    <div class="relative hidden lg:flex flex-col justify-between p-10 overflow-hidden">
      <div class="absolute inset-0 bg-gradient-to-br from-accent-violet/12 via-transparent to-accent-gold/12"></div>
      <div class="absolute top-0 right-0 w-72 h-72 bg-accent-gold/15 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 animate-float"></div>
      <div class="absolute bottom-0 left-0 w-72 h-72 bg-accent-violet/15 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2 animate-float" style="animation-delay: 2s;"></div>
      <div class="absolute inset-0 grid-bg opacity-20"></div>

      <!-- Logo -->
      <div class="relative z-10">
        <a href="/" class="flex items-center gap-2.5 group">
          <div class="relative w-10 h-10 rounded-xl bg-gradient-to-br from-accent-gold via-accent-rose to-accent-violet flex items-center justify-center font-black text-ink-950 text-lg transition-transform group-hover:scale-105">
            <span class="absolute inset-0 rounded-xl opacity-50 blur-md bg-gradient-to-br from-accent-gold to-accent-violet"></span>
            <span class="relative">N</span>
          </div>
          <span class="text-xl font-bold text-white tracking-tight">NEXUS Exchange</span>
        </a>
      </div>

      <!-- Hero text -->
      <div class="relative z-10 space-y-6">
        <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent-gold/10 border border-accent-gold/25 text-accent-gold text-[10px] font-bold tracking-wide">
          <span class="relative flex h-1.5 w-1.5">
            <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-gold opacity-60"></span>
            <span class="relative inline-flex rounded-full h-1.5 w-1.5 bg-accent-gold"></span>
          </span>
          منصة التداول رقم 1 في الشرق الأوسط
        </div>

        <h1 class="text-4xl font-bold leading-tight text-balance tracking-tight">
          منصة التداول
          <span class="text-aurora block" style="text-shadow: 0 0 30px rgba(245, 181, 68, 0.25);">الأكثر احترافية</span>
        </h1>
        <p class="text-slate-300 text-lg leading-relaxed">
          تداول بثقة على منصة تجمع بين السرعة والأمان والسيولة العالية. انضم إلى آلاف المتداولين المحترفين.
        </p>

        <!-- Features list — premium style -->
        <div class="space-y-3 pt-2">
          {#each features as feat}
            {@const c = colorClasses[feat.color]}
            <div class="flex items-center gap-3 text-slate-200 group">
              <div class="w-10 h-10 rounded-xl {c.bg} {c.border} border flex items-center justify-center group-hover:scale-105 transition-transform">
                <feat.icon size={17} class={c.text} />
              </div>
              <div class="flex-1">
                <p class="text-sm font-semibold text-white">{feat.label}</p>
                <p class="text-[11px] text-slate-400">{feat.sub}</p>
              </div>
              <ChevronLeft size={14} class="text-slate-600 group-hover:text-slate-400 group-hover:-translate-x-1 transition-all" />
            </div>
          {/each}
        </div>
      </div>

      <!-- Footer -->
      <div class="relative z-10 flex items-center justify-between">
        <div class="text-xs text-slate-400">© 2026 NEXUS Exchange</div>
        <div class="flex items-center gap-1.5 text-[10px] text-slate-500">
          <Activity size={10} class="text-accent-mint" />
          <span>جميع الأنظمة تعمل</span>
        </div>
      </div>
    </div>

    <!-- Right side — login form -->
    <div class="p-8 sm:p-12 flex flex-col justify-center bg-ink-950/40 relative">
      <div class="absolute inset-0 pointer-events-none" style="background: radial-gradient(ellipse 100% 60% at 50% 0%, rgba(168, 85, 247, 0.05), transparent 60%);"></div>

      <!-- Mobile logo -->
      <div class="lg:hidden mb-8 flex items-center gap-2.5 relative">
        <div class="relative w-10 h-10 rounded-xl bg-gradient-to-br from-accent-gold via-accent-rose to-accent-violet flex items-center justify-center font-black text-ink-950 text-lg">
          <span class="absolute inset-0 rounded-xl opacity-50 blur-md bg-gradient-to-br from-accent-gold to-accent-violet"></span>
          <span class="relative">N</span>
        </div>
        <span class="text-xl font-bold text-white tracking-tight">NEXUS</span>
      </div>

      <div class="mb-8 relative">
        <div class="flex items-center gap-2 mb-2">
          {#if requires2FA}
            <div class="w-9 h-9 rounded-xl bg-accent-violet/10 border border-accent-violet/20 flex items-center justify-center">
              <Fingerprint size={18} class="text-accent-violet" />
            </div>
          {:else}
            <div class="w-9 h-9 rounded-xl bg-accent-gold/10 border border-accent-gold/20 flex items-center justify-center">
              <Lock size={18} class="text-accent-gold" />
            </div>
          {/if}
          <h2 class="text-2xl font-bold text-white tracking-tight">
            {requires2FA ? 'تحقق ثنائي' : 'تسجيل الدخول'}
          </h2>
        </div>
        <p class="text-slate-400 text-sm">
          {requires2FA
            ? 'أدخل رمز المصادقة من تطبيق المصادقة لديك'
            : 'أدخل بياناتك للوصول إلى حسابك'}
        </p>
      </div>

      <form onsubmit={handleSubmit} class="space-y-5">
        {#if requires2FA}
          <div>
            <label class="input-label" for="2fa">رمز التحقق</label>
            <input
              id="2fa"
              bind:value={twoFaCode}
              type="text"
              maxlength="6"
              inputmode="numeric"
              placeholder="000000"
              class="input text-center text-2xl tracking-[0.5em] font-mono"
            />
            {#if errors.twoFaCode}
              <p class="mt-1.5 text-xs text-accent-rose">{errors.twoFaCode}</p>
            {/if}
            <p class="mt-2 text-[11px] text-slate-500 flex items-center gap-1.5">
              <Fingerprint size={11} class="text-slate-600" />
              أدخل الرمز المكوّن من 6 أرقام من تطبيق المصادقة
            </p>
          </div>
        {:else}
          <div>
            <label class="input-label flex items-center gap-1.5" for="email">
              <Mail size={11} class="text-accent-gold" />
              البريد الإلكتروني
            </label>
            <div class="relative">
              <div class="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 pointer-events-none">
                <Mail size={16} />
              </div>
              <input
                id="email"
                bind:value={email}
                type="email"
                autocomplete="email"
                placeholder="you@example.com"
                class="input pr-10 {errors.email ? 'border-accent-rose/60' : ''}"
              />
            </div>
            {#if errors.email}
              <p class="mt-1.5 text-xs text-accent-rose">{errors.email}</p>
            {/if}
          </div>

          <div>
            <div class="flex items-center justify-between mb-1.5">
              <label class="text-xs font-medium text-slate-400 flex items-center gap-1.5" for="password">
                <Lock size={11} class="text-accent-gold" />
                كلمة المرور
              </label>
              <a href="/forgot-password" class="text-xs text-accent-gold hover:underline flex items-center gap-1">
                نسيت كلمة المرور؟ <ChevronLeft size={11} />
              </a>
            </div>
            <div class="relative">
              <div class="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 pointer-events-none">
                <Lock size={16} />
              </div>
              <input
                id="password"
                bind:value={password}
                type={showPassword ? 'text' : 'password'}
                autocomplete="current-password"
                placeholder="••••••••"
                class="input pr-10 pl-10 {errors.password ? 'border-accent-rose/60' : ''}"
              />
              <button
                type="button"
                class="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 hover:text-white transition-colors"
                onclick={() => (showPassword = !showPassword)}
                aria-label="إظهار/إخفاء كلمة المرور"
              >
                {#if showPassword}<EyeOff size={16} />{:else}<Eye size={16} />{/if}
              </button>
            </div>
            {#if errors.password}
              <p class="mt-1.5 text-xs text-accent-rose">{errors.password}</p>
            {/if}
          </div>
        {/if}

        <Button type="submit" {loading} fullWidth size="lg">
          {#if !loading}
            {requires2FA ? 'تحقق' : 'تسجيل الدخول'}
            <ArrowLeft size={18} />
          {/if}
        </Button>
      </form>

      {#if !requires2FA}
        <!-- Divider -->
        <div class="my-6 flex items-center gap-3">
          <div class="flex-1 h-px bg-gradient-to-l from-white/10 to-transparent"></div>
          <span class="text-[10px] text-slate-500 uppercase tracking-wider">أو</span>
          <div class="flex-1 h-px bg-gradient-to-r from-white/10 to-transparent"></div>
        </div>

        <div class="text-center text-sm text-slate-400">
          ليس لديك حساب؟
          <a href="/register" class="text-accent-gold font-medium hover:underline mr-1 inline-flex items-center gap-1">
            أنشئ حساباً جديداً <ChevronLeft size={12} />
          </a>
        </div>
      {:else}
        <button
          class="mt-6 text-sm text-slate-400 hover:text-white transition-colors flex items-center gap-1.5"
          onclick={() => {
            requires2FA = false;
            twoFaCode = '';
            tempToken = '';
          }}
        >
          <ArrowLeft size={14} class="rotate-180" />
          العودة لتسجيل الدخول
        </button>
      {/if}
    </div>
  </div>
</div>
