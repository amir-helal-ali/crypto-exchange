<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { auth } from '$lib/api/endpoints';
  import { parseApiResponse, forceLogout } from '$lib/api/client';
  import { authStore } from '$lib/stores/auth';
  import { toasts } from '$lib/stores/toast';
  import Button from '$lib/components/Button.svelte';
  import { Mail, Lock, Eye, EyeOff, ArrowLeft, ShieldCheck, Zap, TrendingUp } from 'lucide-svelte';
  import ParticleBackground from '$lib/components/ParticleBackground.svelte';
  import ThemeToggle from '$lib/components/ThemeToggle.svelte';

  let email = $state('');
  let password = $state('');
  let twoFaCode = $state('');
  let showPassword = $state(false);
  let loading = $state(false);
  let requires2FA = $state(false);
  let tempToken = $state('');
  let errors = $state<Record<string, string>>({});

  // Redirect if already logged in
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
</script>

<ParticleBackground />

<!-- Floating theme toggle -->
<div class="fixed top-4 left-4 z-50">
  <div class="panel p-1 rounded-xl">
    <ThemeToggle size={20} />
  </div>
</div>

<div class="min-h-screen flex items-center justify-center p-4 sm:p-6">
  <div class="w-full max-w-5xl grid lg:grid-cols-2 gap-0 panel-glow overflow-hidden" style="min-height: 600px;">
    <!-- Left side — brand showcase -->
    <div class="relative hidden lg:flex flex-col justify-between p-10 overflow-hidden">
      <div class="absolute inset-0 bg-gradient-to-br from-accent-violet/10 via-transparent to-accent-gold/10"></div>
      <div class="absolute top-0 right-0 w-64 h-64 bg-accent-gold/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
      <div class="absolute bottom-0 left-0 w-64 h-64 bg-accent-violet/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2"></div>

      <div class="relative z-10">
        <a href="/" class="flex items-center gap-2.5">
          <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-accent-gold to-accent-rose flex items-center justify-center font-black text-ink-950 text-lg">
            N
          </div>
          <span class="text-xl font-bold text-white">NEXUS Exchange</span>
        </a>
      </div>

      <div class="relative z-10 space-y-6">
        <h1 class="text-4xl font-bold leading-tight text-balance">
          منصة التداول
          <span class="text-aurora block">الأكثر احترافية</span>
        </h1>
        <p class="text-slate-300 text-lg leading-relaxed">
          تداول بثقة على منصة تجمع بين السرعة والأمان والسيولة العالية. انضم إلى آلاف المتداولين المحترفين.
        </p>
        <div class="space-y-3 pt-4">
          <div class="flex items-center gap-3 text-slate-200">
            <div class="w-9 h-9 rounded-lg bg-accent-mint/10 border border-accent-mint/20 flex items-center justify-center">
              <Zap size={16} class="text-accent-mint" />
            </div>
            <span>تنفيذ فوري للصفقات بأقل من 10 مللي ثانية</span>
          </div>
          <div class="flex items-center gap-3 text-slate-200">
            <div class="w-9 h-9 rounded-lg bg-accent-azure/10 border border-accent-azure/20 flex items-center justify-center">
              <ShieldCheck size={16} class="text-accent-azure" />
            </div>
            <span>أمان بمستوى البنوك مع المصادقة الثنائية</span>
          </div>
          <div class="flex items-center gap-3 text-slate-200">
            <div class="w-9 h-9 rounded-lg bg-accent-gold/10 border border-accent-gold/20 flex items-center justify-center">
              <TrendingUp size={16} class="text-accent-gold" />
            </div>
            <span>أكثر من 200 زوج تداول بسيولة عالية</span>
          </div>
        </div>
      </div>

      <div class="relative z-10 text-xs text-slate-400">
        © 2026 NEXUS Exchange. جميع الحقوق محفوظة.
      </div>
    </div>

    <!-- Right side — login form -->
    <div class="p-8 sm:p-12 flex flex-col justify-center bg-ink-950/40">
      <div class="lg:hidden mb-8 flex items-center gap-2.5">
        <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-accent-gold to-accent-rose flex items-center justify-center font-black text-ink-950 text-lg">
          N
        </div>
        <span class="text-xl font-bold text-white">NEXUS</span>
      </div>

      <div class="mb-8">
        <h2 class="text-2xl font-bold text-white mb-2">
          {requires2FA ? 'تحقق ثنائي' : 'تسجيل الدخول'}
        </h2>
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
          </div>
        {:else}
          <div>
            <label class="input-label" for="email">البريد الإلكتروني</label>
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
              <label class="text-xs font-medium text-slate-400" for="password">كلمة المرور</label>
              <a href="/forgot-password" class="text-xs text-accent-gold hover:underline">
                نسيت كلمة المرور؟
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
                class="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 hover:text-white"
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
        <div class="mt-6 text-center text-sm text-slate-400">
          ليس لديك حساب؟
          <a href="/register" class="text-accent-gold font-medium hover:underline mr-1">
            أنشئ حساباً جديداً
          </a>
        </div>
      {:else}
        <button
          class="mt-6 text-sm text-slate-400 hover:text-white transition-colors"
          onclick={() => {
            requires2FA = false;
            twoFaCode = '';
            tempToken = '';
          }}
        >
          → العودة لتسجيل الدخول
        </button>
      {/if}
    </div>
  </div>
</div>
