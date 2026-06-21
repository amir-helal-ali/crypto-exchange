<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { auth } from '$lib/api/endpoints';
  import { toasts } from '$lib/stores/toast';
  import { authStore } from '$lib/stores/auth';
  import Button from '$lib/components/Button.svelte';
  import { Mail, Lock, User, Eye, EyeOff, ArrowLeft, Check, X } from 'lucide-svelte';
  import ParticleBackground from '$lib/components/ParticleBackground.svelte';
  import ThemeToggle from '$lib/components/ThemeToggle.svelte';

  let email = $state('');
  let username = $state('');
  let password = $state('');
  let confirmPassword = $state('');
  let showPassword = $state(false);
  let loading = $state(false);
  let errors = $state<Record<string, string>>({});
  let agreedToTerms = $state(false);

  onMount(() => {
    if (authStore.isAuthenticated()) goto('/dashboard');
  });

  // Password strength meter
  const passwordStrength = $derived.by(() => {
    const p = password;
    if (!p) return { score: 0, label: '', percent: 0 };
    let score = 0;
    if (p.length >= 8) score++;
    if (p.length >= 12) score++;
    if (/[a-z]/.test(p) && /[A-Z]/.test(p)) score++;
    if (/\d/.test(p)) score++;
    if (/[^a-zA-Z0-9]/.test(p)) score++;
    const labels = ['', 'ضعيفة', 'متوسطة', 'جيدة', 'قوية', 'قوية جداً'];
    const colors = ['', '#f43f7a', '#f5b544', '#3b82f6', '#22d3a4', '#22d3a4'];
    return {
      score,
      label: labels[score],
      color: colors[score],
      percent: (score / 5) * 100
    };
  });

  async function handleSubmit(e: Event) {
    e.preventDefault();
    errors = {};

    if (!email.trim()) {
      errors.email = 'البريد الإلكتروني مطلوب';
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = 'صيغة البريد غير صحيحة';
      return;
    }
    if (!username.trim() || username.length < 3) {
      errors.username = 'اسم المستخدم يجب أن يكون 3 أحرف على الأقل';
      return;
    }
    if (password.length < 8) {
      errors.password = 'كلمة المرور يجب أن تكون 8 أحرف على الأقل';
      return;
    }
    if (password !== confirmPassword) {
      errors.confirmPassword = 'كلمتا المرور غير متطابقتين';
      return;
    }
    if (!agreedToTerms) {
      toasts.warning('يجب الموافقة على الشروط والأحكام');
      return;
    }

    loading = true;
    try {
      const res = await auth.register({
        email: email.trim(),
        username: username.trim(),
        password
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'فشل إنشاء الحساب');

      toasts.success('تم إنشاء الحساب بنجاح! تحقق من بريدك الإلكتروني.');
      await goto('/login');
    } catch (err: any) {
      toasts.error(err.message || 'فشل إنشاء الحساب');
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
    <!-- Left — register form -->
    <div class="p-8 sm:p-12 flex flex-col justify-center bg-ink-950/40 order-2 lg:order-1">
      <div class="mb-8">
        <h2 class="text-2xl font-bold text-white mb-2">إنشاء حساب جديد</h2>
        <p class="text-slate-400 text-sm">ابدأ رحلتك في التداول خلال دقيقة واحدة</p>
      </div>

      <form onsubmit={handleSubmit} class="space-y-4">
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
          {#if errors.email}<p class="mt-1.5 text-xs text-accent-rose">{errors.email}</p>{/if}
        </div>

        <div>
          <label class="input-label" for="username">اسم المستخدم</label>
          <div class="relative">
            <div class="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 pointer-events-none">
              <User size={16} />
            </div>
            <input
              id="username"
              bind:value={username}
              type="text"
              autocomplete="username"
              placeholder="username"
              class="input pr-10 {errors.username ? 'border-accent-rose/60' : ''}"
            />
          </div>
          {#if errors.username}<p class="mt-1.5 text-xs text-accent-rose">{errors.username}</p>{/if}
        </div>

        <div>
          <label class="input-label" for="password">كلمة المرور</label>
          <div class="relative">
            <div class="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 pointer-events-none">
              <Lock size={16} />
            </div>
            <input
              id="password"
              bind:value={password}
              type={showPassword ? 'text' : 'password'}
              autocomplete="new-password"
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
          {#if password}
            <div class="mt-2 flex items-center gap-2">
              <div class="flex-1 h-1.5 bg-ink-800 rounded-full overflow-hidden">
                <div
                  class="h-full rounded-full transition-all duration-300"
                  style="width: {passwordStrength.percent}%; background: {passwordStrength.color};"
                ></div>
              </div>
              <span class="text-xs font-medium" style="color: {passwordStrength.color}">
                {passwordStrength.label}
              </span>
            </div>
          {/if}
          {#if errors.password}<p class="mt-1.5 text-xs text-accent-rose">{errors.password}</p>{/if}
        </div>

        <div>
          <label class="input-label" for="confirmPassword">تأكيد كلمة المرور</label>
          <div class="relative">
            <div class="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 pointer-events-none">
              <Lock size={16} />
            </div>
            <input
              id="confirmPassword"
              bind:value={confirmPassword}
              type={showPassword ? 'text' : 'password'}
              autocomplete="new-password"
              placeholder="••••••••"
              class="input pr-10 {errors.confirmPassword ? 'border-accent-rose/60' : ''}"
            />
            {#if confirmPassword}
              <div class="absolute inset-y-0 left-0 flex items-center pl-3">
                {#if password === confirmPassword}
                  <Check size={16} class="text-accent-mint" />
                {:else}
                  <X size={16} class="text-accent-rose" />
                {/if}
              </div>
            {/if}
          </div>
          {#if errors.confirmPassword}<p class="mt-1.5 text-xs text-accent-rose">{errors.confirmPassword}</p>{/if}
        </div>

        <label class="flex items-start gap-2.5 cursor-pointer group">
          <input
            type="checkbox"
            bind:checked={agreedToTerms}
            class="mt-1 w-4 h-4 rounded border-white/10 bg-ink-900 text-accent-gold focus:ring-accent-gold/50"
          />
          <span class="text-xs text-slate-400 leading-relaxed group-hover:text-slate-300">
            أوافق على
            <a href="/terms" class="text-accent-gold hover:underline">الشروط والأحكام</a>
            و
            <a href="/privacy" class="text-accent-gold hover:underline">سياسة الخصوصية</a>
          </span>
        </label>

        <Button type="submit" {loading} fullWidth size="lg">
          {#if !loading}
            إنشاء الحساب
            <ArrowLeft size={18} />
          {/if}
        </Button>
      </form>

      <div class="mt-6 text-center text-sm text-slate-400">
        لديك حساب بالفعل؟
        <a href="/login" class="text-accent-gold font-medium hover:underline mr-1">
          سجل دخولك
        </a>
      </div>
    </div>

    <!-- Right — brand showcase -->
    <div class="relative hidden lg:flex flex-col justify-between p-10 overflow-hidden order-1 lg:order-2">
      <div class="absolute inset-0 bg-gradient-to-bl from-accent-gold/10 via-transparent to-accent-violet/10"></div>
      <div class="absolute top-0 left-0 w-64 h-64 bg-accent-violet/10 rounded-full blur-3xl -translate-y-1/2 -translate-x-1/2"></div>
      <div class="absolute bottom-0 right-0 w-64 h-64 bg-accent-gold/10 rounded-full blur-3xl translate-y-1/2 translate-x-1/2"></div>

      <div class="relative z-10 flex justify-end">
        <a href="/" class="flex items-center gap-2.5">
          <span class="text-xl font-bold text-white">NEXUS Exchange</span>
          <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-accent-gold to-accent-rose flex items-center justify-center font-black text-ink-950 text-lg">
            N
          </div>
        </a>
      </div>

      <div class="relative z-10 space-y-6 text-right">
        <h1 class="text-4xl font-bold leading-tight text-balance">
          ابدأ رحلتك في عالم
          <span class="text-aurora block">العملات الرقمية</span>
        </h1>
        <p class="text-slate-300 text-lg leading-relaxed">
          انضم إلى أكثر من 2 مليون متداول حول العالم. منصة موثوقة تقدم لك أدوات احترافية وتجربة تداول سلسة.
        </p>

        <div class="grid grid-cols-3 gap-4 pt-4">
          <div class="text-center">
            <div class="text-2xl font-bold text-gold-gradient">+2M</div>
            <div class="text-xs text-slate-400 mt-1">متداول نشط</div>
          </div>
          <div class="text-center">
            <div class="text-2xl font-bold text-gold-gradient">$50B</div>
            <div class="text-xs text-slate-400 mt-1">حجم تداول يومي</div>
          </div>
          <div class="text-center">
            <div class="text-2xl font-bold text-gold-gradient">+200</div>
            <div class="text-xs text-slate-400 mt-1">عملة رقمية</div>
          </div>
        </div>
      </div>

      <div class="relative z-10 text-xs text-slate-400 text-left">
        © 2026 NEXUS Exchange. جميع الحقوق محفوظة.
      </div>
    </div>
  </div>
</div>
