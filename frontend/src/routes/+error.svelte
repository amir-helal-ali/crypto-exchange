<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import Button from '$lib/components/Button.svelte';
  import ParticleBackground from '$lib/components/ParticleBackground.svelte';
  import { Home, ArrowLeft, AlertTriangle, WifiOff, Lock, ServerOff } from 'lucide-svelte';

  const status = $derived($page.status || 500);
  const message = $derived($page.error?.message || 'حدث خطأ غير متوقع');

  const config = $derived.by(() => {
    if (status === 404) {
      return {
        icon: AlertTriangle,
        title: 'الصفحة غير موجودة',
        subtitle: 'عذراً، الصفحة التي تبحث عنها غير متوفرة أو تم نقلها',
        accent: 'accent-gold'
      };
    }
    if (status === 401 || status === 403) {
      return {
        icon: Lock,
        title: 'الوصول مرفوض',
        subtitle: 'ليس لديك صلاحية للوصول إلى هذه الصفحة. يرجى تسجيل الدخول',
        accent: 'accent-rose'
      };
    }
    if (status === 502 || status === 503 || status === 504) {
      return {
        icon: WifiOff,
        title: 'انقطاع الاتصال بالخادم',
        subtitle: 'الخادم غير متاح حالياً. يرجى المحاولة مرة أخرى بعد لحظات',
        accent: 'accent-azure'
      };
    }
    return {
      icon: ServerOff,
      title: 'خطأ في الخادم',
      subtitle: 'حدث خطأ داخلي. فريقنا يعمل على حل المشكلة',
      accent: 'accent-violet'
    };
  });
</script>

<ParticleBackground />

<svelte:head>
  <title>{status} — {config.title} | NEXUS Exchange</title>
</svelte:head>

<section class="relative min-h-screen flex items-center justify-center px-4 py-20">
  <div class="absolute inset-0 grid-bg opacity-20"></div>

  <div class="relative z-10 max-w-xl w-full mx-auto text-center">
    <!-- Status code -->
    <div class="relative mb-8 inline-block">
      <div class="text-[10rem] sm:text-[14rem] font-black leading-none text-gold-gradient opacity-90 select-none">
        {status}
      </div>
      <div class="absolute inset-0 flex items-center justify-center">
        <div class="w-24 h-24 sm:w-32 sm:h-32 rounded-full bg-accent-gold/10 border border-accent-gold/30 flex items-center justify-center backdrop-blur-sm">
          <config.icon size={42} class="text-accent-gold" />
        </div>
      </div>
    </div>

    <!-- Title -->
    <h1 class="text-3xl sm:text-4xl font-bold text-white mb-3">
      {config.title}
    </h1>

    <!-- Subtitle -->
    <p class="text-slate-400 text-base sm:text-lg leading-relaxed mb-2 max-w-md mx-auto">
      {config.subtitle}
    </p>

    <!-- Technical message (for debugging) -->
    {#if message && status >= 500}
      <p class="text-xs text-slate-600 font-mono mb-8 px-4 py-2 rounded-lg bg-ink-900/60 border border-white/5 inline-block">
        {message}
      </p>
    {:else}
      <div class="mb-8"></div>
    {/if}

    <!-- Actions -->
    <div class="flex flex-col sm:flex-row items-center justify-center gap-3 mb-10">
      <Button href="/" size="lg" class="px-6 py-3">
        <Home size={18} />
        العودة للرئيسية
      </Button>
      <Button
        variant="secondary"
        size="lg"
        class="px-6 py-3"
        onclick={() => history.length > 1 ? history.back() : goto('/')}
      >
        <ArrowLeft size={18} />
        الصفحة السابقة
      </Button>
    </div>

    <!-- Quick links -->
    <div class="flex flex-wrap items-center justify-center gap-2 text-xs text-slate-500">
      <span>روابط سريعة:</span>
      <a href="/login" class="px-2.5 py-1 rounded-md hover:bg-white/5 hover:text-accent-gold transition-colors">تسجيل الدخول</a>
      <span class="text-slate-700">•</span>
      <a href="/register" class="px-2.5 py-1 rounded-md hover:bg-white/5 hover:text-accent-gold transition-colors">إنشاء حساب</a>
      <span class="text-slate-700">•</span>
      <a href="/dashboard" class="px-2.5 py-1 rounded-md hover:bg-white/5 hover:text-accent-gold transition-colors">لوحة التحكم</a>
    </div>
  </div>
</section>

<style>
  /* Pulse animation for the icon container */
  @keyframes pulseRing {
    0%, 100% { box-shadow: 0 0 0 0 rgba(245, 181, 68, 0.15); }
    50% { box-shadow: 0 0 0 12px rgba(245, 181, 68, 0); }
  }
  .absolute.inset-0.flex.items-center.justify-center > div {
    animation: pulseRing 2.5s ease-in-out infinite;
  }
</style>
