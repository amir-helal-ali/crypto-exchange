<script lang="ts">
  import { auth } from '$lib/api/endpoints';
  import { toasts } from '$lib/stores/toast';
  import Button from '$lib/components/Button.svelte';
  import { Mail, ArrowLeft, CheckCircle2 } from 'lucide-svelte';
  import ParticleBackground from '$lib/components/ParticleBackground.svelte';
  import ThemeToggle from '$lib/components/ThemeToggle.svelte';

  let email = $state('');
  let loading = $state(false);
  let sent = $state(false);
  let error = $state('');

  async function handleSubmit(e: Event) {
    e.preventDefault();
    error = '';
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      error = 'أدخل بريداً إلكترونياً صحيحاً';
      return;
    }
    loading = true;
    try {
      const res = await auth.forgotPassword(email.trim());
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'فشل إرسال البريد');
      }
      sent = true;
      toasts.success('تم إرسال رابط استعادة كلمة المرور');
    } catch (err: any) {
      toasts.error(err.message);
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

<div class="min-h-screen flex items-center justify-center p-4">
  <div class="w-full max-w-md panel-glow p-8 sm:p-10">
    <div class="text-center mb-6">
      <div class="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-accent-gold/10 border border-accent-gold/20 mb-4">
        <Mail size={24} class="text-accent-gold" />
      </div>
      <h1 class="text-2xl font-bold text-white mb-2">استعادة كلمة المرور</h1>
      <p class="text-slate-400 text-sm">
        {sent
          ? 'تحقق من بريدك الإلكتروني للحصول على رابط الاستعادة'
          : 'أدخل بريدك الإلكتروني وسنرسل لك رابط الاستعادة'}
      </p>
    </div>

    {#if sent}
      <div class="space-y-4">
        <div class="panel p-4 flex items-start gap-3 bg-accent-mint/5 border-accent-mint/20">
          <CheckCircle2 size={20} class="text-accent-mint shrink-0 mt-0.5" />
          <div class="text-sm text-slate-200">
            تم إرسال رابط الاستعادة إلى
            <span class="font-semibold text-white">{email}</span>
          </div>
        </div>
        <Button href="/login" variant="secondary" fullWidth>
          العودة لتسجيل الدخول
        </Button>
      </div>
    {:else}
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
              class="input pr-10 {error ? 'border-accent-rose/60' : ''}"
            />
          </div>
          {#if error}<p class="mt-1.5 text-xs text-accent-rose">{error}</p>{/if}
        </div>

        <Button type="submit" {loading} fullWidth size="lg">
          {#if !loading}
            إرسال رابط الاستعادة
            <ArrowLeft size={18} />
          {/if}
        </Button>
      </form>
    {/if}

    <div class="mt-6 text-center">
      <a href="/login" class="text-sm text-slate-400 hover:text-accent-gold transition-colors">
        → العودة لتسجيل الدخول
      </a>
    </div>
  </div>
</div>
