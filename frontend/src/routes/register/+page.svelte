<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { auth } from '$lib/api/endpoints';
  import { toasts } from '$lib/stores/toast';
  import { authStore } from '$lib/stores/auth';
  import Button from '$lib/components/Button.svelte';
  import {
    Mail, Lock, User, Eye, EyeOff, ArrowLeft, Check, X,
    ShieldCheck, Zap, TrendingUp, Crown, Sparkles, ChevronLeft,
    Activity, Loader2
  } from 'lucide-svelte';
  import ParticleBackground from '$lib/components/ParticleBackground.svelte';

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
    if (!p) return { score: 0, label: '', percent: 0, color: '#475569' };
    let score = 0;
    if (p.length >= 8) score++;
    if (p.length >= 12) score++;
    if (/[a-z]/.test(p) && /[A-Z]/.test(p)) score++;
    if (/\d/.test(p)) score++;
    if (/[^a-zA-Z0-9]/.test(p)) score++;
    const labels = ['', 'ضعيفة جداً', 'ضعيفة', 'متوسطة', 'قوية', 'قوية جداً'];
    const colors = ['#475569', '#f43f7a', '#f43f7a', '#f5b544', '#3b82f6', '#22d3a4'];
    return {
      score,
      label: labels[score],
      color: colors[score],
      percent: (score / 5) * 100
    };
  });

  // Password requirements checklist
  const requirements = $derived([
    { label: '8 أحرف على الأقل', met: password.length >= 8 },
    { label: 'حرف كبير وصغير', met: /[a-z]/.test(password) && /[A-Z]/.test(password) },
    { label: 'رقم واحد على الأقل', met: /\d/.test(password) },
    { label: 'رمز خاص', met: /[^a-zA-Z0-9]/.test(password) }
  ]);

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

  const benefits = [
    { icon: Zap, label: 'تنفيذ فوري', sub: '< 10 مللي ثانية', color: 'mint' },
    { icon: ShieldCheck, label: 'أمان مصرفي', sub: '2FA + تشفير', color: 'azure' },
    { icon: TrendingUp, label: 'سيولة عالية', sub: '+200 زوج', color: 'gold' }
  ];

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
  <div class="fixed top-0 inset-x-0 h-px pointer-events-none z-50" style="background: linear-gradient(90deg, transparent, rgba(168, 85, 247, 0.5), rgba(245, 181, 68, 0.4), transparent);"></div>

  <div class="w-full max-w-5xl grid lg:grid-cols-2 gap-0 panel-glow overflow-hidden relative" style="min-height: 620px;">
    <!-- Inner topbar gradient highlight -->
    <div class="absolute top-0 inset-x-0 h-px pointer-events-none z-10" style="background: linear-gradient(90deg, transparent 10%, rgba(168, 85, 247, 0.6) 50%, transparent 90%);"></div>

    <!-- Left — register form -->
    <div class="p-8 sm:p-10 flex flex-col justify-center bg-ink-950/40 order-2 lg:order-1 relative">
      <div class="absolute inset-0 pointer-events-none" style="background: radial-gradient(ellipse 100% 60% at 50% 0%, rgba(245, 181, 68, 0.05), transparent 60%);"></div>

      <!-- Mobile logo -->
      <div class="lg:hidden mb-6 flex items-center gap-2.5 relative">
        <div class="relative w-10 h-10 rounded-xl bg-gradient-to-br from-accent-gold via-accent-rose to-accent-violet flex items-center justify-center font-black text-ink-950 text-lg">
          <span class="absolute inset-0 rounded-xl opacity-50 blur-md bg-gradient-to-br from-accent-gold to-accent-violet"></span>
          <span class="relative">N</span>
        </div>
        <span class="text-xl font-bold text-white tracking-tight">NEXUS</span>
      </div>

      <div class="mb-6 relative">
        <div class="flex items-center gap-2 mb-2">
          <div class="w-9 h-9 rounded-xl bg-accent-violet/10 border border-accent-violet/20 flex items-center justify-center">
            <Sparkles size={18} class="text-accent-violet" />
          </div>
          <h2 class="text-2xl font-bold text-white tracking-tight">إنشاء حساب جديد</h2>
        </div>
        <p class="text-slate-400 text-sm">ابدأ رحلتك في التداول خلال دقيقة واحدة</p>
      </div>

      <form onsubmit={handleSubmit} class="space-y-4 relative">
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
          {#if errors.email}<p class="mt-1.5 text-xs text-accent-rose">{errors.email}</p>{/if}
        </div>

        <div>
          <label class="input-label flex items-center gap-1.5" for="username">
            <User size={11} class="text-accent-gold" />
            اسم المستخدم
          </label>
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
          <label class="input-label flex items-center gap-1.5" for="password">
            <Lock size={11} class="text-accent-gold" />
            كلمة المرور
          </label>
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
              class="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 hover:text-white transition-colors"
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
              <span class="text-xs font-medium tabular-nums" style="color: {passwordStrength.color}">
                {passwordStrength.label}
              </span>
            </div>
            <!-- Requirements checklist -->
            <div class="mt-2 grid grid-cols-2 gap-1">
              {#each requirements as req}
                <div class="flex items-center gap-1.5 text-[10px]">
                  {#if req.met}
                    <Check size={10} class="text-accent-mint" />
                    <span class="text-accent-mint/80">{req.label}</span>
                  {:else}
                    <X size={10} class="text-slate-600" />
                    <span class="text-slate-500">{req.label}</span>
                  {/if}
                </div>
              {/each}
            </div>
          {/if}
          {#if errors.password}<p class="mt-1.5 text-xs text-accent-rose">{errors.password}</p>{/if}
        </div>

        <div>
          <label class="input-label flex items-center gap-1.5" for="confirmPassword">
            <Check size={11} class="text-accent-gold" />
            تأكيد كلمة المرور
          </label>
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

      <!-- Divider -->
      <div class="my-5 flex items-center gap-3">
        <div class="flex-1 h-px bg-gradient-to-l from-white/10 to-transparent"></div>
        <span class="text-[10px] text-slate-500 uppercase tracking-wider">أو</span>
        <div class="flex-1 h-px bg-gradient-to-r from-white/10 to-transparent"></div>
      </div>

      <div class="text-center text-sm text-slate-400">
        لديك حساب بالفعل؟
        <a href="/login" class="text-accent-gold font-medium hover:underline mr-1 inline-flex items-center gap-1">
          سجل دخولك <ChevronLeft size={12} />
        </a>
      </div>
    </div>

    <!-- Right — brand showcase -->
    <div class="relative hidden lg:flex flex-col justify-between p-10 overflow-hidden order-1 lg:order-2">
      <div class="absolute inset-0 bg-gradient-to-bl from-accent-gold/10 via-transparent to-accent-violet/10"></div>
      <div class="absolute top-0 left-0 w-72 h-72 bg-accent-violet/15 rounded-full blur-3xl -translate-y-1/2 -translate-x-1/2 animate-float"></div>
      <div class="absolute bottom-0 right-0 w-72 h-72 bg-accent-gold/15 rounded-full blur-3xl translate-y-1/2 translate-x-1/2 animate-float" style="animation-delay: 2s;"></div>
      <div class="absolute inset-0 grid-bg opacity-20"></div>

      <!-- Logo -->
      <div class="relative z-10 flex justify-end">
        <a href="/" class="flex items-center gap-2.5 group">
          <span class="text-xl font-bold text-white tracking-tight">NEXUS Exchange</span>
          <div class="relative w-10 h-10 rounded-xl bg-gradient-to-br from-accent-gold via-accent-rose to-accent-violet flex items-center justify-center font-black text-ink-950 text-lg transition-transform group-hover:scale-105">
            <span class="absolute inset-0 rounded-xl opacity-50 blur-md bg-gradient-to-br from-accent-gold to-accent-violet"></span>
            <span class="relative">N</span>
          </div>
        </a>
      </div>

      <!-- Hero text -->
      <div class="relative z-10 space-y-6 text-right">
        <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent-violet/10 border border-accent-violet/25 text-accent-violet text-[10px] font-bold tracking-wide">
          <Sparkles size={10} />
          انضم لأكثر من 2 مليون متداول
        </div>

        <h1 class="text-4xl font-bold leading-tight text-balance">
          ابدأ رحلتك في عالم
          <span class="text-aurora block" style="text-shadow: 0 0 30px rgba(168, 85, 247, 0.3);">العملات الرقمية</span>
        </h1>
        <p class="text-slate-300 text-lg leading-relaxed">
          منصة موثوقة تقدم لك أدوات احترافية وتجربة تداول سلسة وآمنة.
        </p>

        <!-- Benefits list — premium style -->
        <div class="space-y-3 pt-2">
          {#each benefits as b}
            {@const c = colorClasses[b.color]}
            <div class="flex items-center gap-3 text-slate-200 group">
              <div class="w-10 h-10 rounded-xl {c.bg} {c.border} border flex items-center justify-center group-hover:scale-105 transition-transform">
                <b.icon size={17} class={c.text} />
              </div>
              <div class="flex-1">
                <p class="text-sm font-semibold text-white">{b.label}</p>
                <p class="text-[11px] text-slate-400">{b.sub}</p>
              </div>
            </div>
          {/each}
        </div>

        <!-- Stats grid -->
        <div class="grid grid-cols-3 gap-3 pt-4">
          <div class="text-center p-3 rounded-xl bg-white/[0.02] border border-white/5">
            <div class="text-2xl font-bold text-gold-gradient tabular-nums">+2M</div>
            <div class="text-[10px] text-slate-400 mt-0.5">متداول نشط</div>
          </div>
          <div class="text-center p-3 rounded-xl bg-white/[0.02] border border-white/5">
            <div class="text-2xl font-bold text-gold-gradient tabular-nums">$50B</div>
            <div class="text-[10px] text-slate-400 mt-0.5">حجم يومي</div>
          </div>
          <div class="text-center p-3 rounded-xl bg-white/[0.02] border border-white/5">
            <div class="text-2xl font-bold text-gold-gradient tabular-nums">+200</div>
            <div class="text-[10px] text-slate-400 mt-0.5">عملة رقمية</div>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="relative z-10 flex items-center justify-between">
        <div class="flex items-center gap-1.5 text-[10px] text-slate-500">
          <Activity size={10} class="text-accent-mint" />
          <span>جميع الأنظمة تعمل</span>
        </div>
        <div class="text-xs text-slate-400">© 2026 NEXUS Exchange</div>
      </div>
    </div>
  </div>
</div>
