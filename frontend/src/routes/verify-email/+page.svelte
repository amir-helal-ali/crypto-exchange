<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { auth } from '$lib/api/endpoints';
  import Button from '$lib/components/Button.svelte';
  import { CheckCircle2, AlertCircle, Loader2 } from 'lucide-svelte';
  import ParticleBackground from '$lib/components/ParticleBackground.svelte';
  import ThemeToggle from '$lib/components/ThemeToggle.svelte';

  let status = $state<'loading' | 'success' | 'error'>('loading');
  let errorMsg = $state('');

  onMount(() => {
(async () => {
    const token = new URLSearchParams(window.location.search).get('token');
    if (!token) {
      status = 'error';
      errorMsg = 'الرابط غير صالح';
      return;
    }
    try {
      const res = await auth.verifyEmail(token);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'فشل التحقق');
      }
      status = 'success';
      setTimeout(() => goto('/login'), 3000);
    } catch (err: any) {
      status = 'error';
      errorMsg = err.message;
    }
  
  })();
});
</script>

<ParticleBackground />

<!-- Floating theme toggle -->
<div class="fixed top-4 left-4 z-50">
  <div class="panel p-1 rounded-xl">
    <ThemeToggle size={20} />
  </div>
</div>

<div class="min-h-screen flex items-center justify-center p-4">
  <div class="w-full max-w-md panel-glow p-8 sm:p-10 text-center">
    {#if status === 'loading'}
      <div class="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-accent-azure/10 border border-accent-azure/20 mb-4">
        <Loader2 size={28} class="text-accent-azure animate-spin" />
      </div>
      <h1 class="text-2xl font-bold text-white mb-2">جاري التحقق...</h1>
      <p class="text-slate-400 text-sm">يرجى الانتظار</p>
    {:else if status === 'success'}
      <div class="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-accent-mint/10 border border-accent-mint/20 mb-4">
        <CheckCircle2 size={28} class="text-accent-mint" />
      </div>
      <h1 class="text-2xl font-bold text-white mb-2">تم التحقق من بريدك!</h1>
      <p class="text-slate-400 text-sm mb-6">سيتم تحويلك إلى صفحة تسجيل الدخول</p>
      <Button href="/login" fullWidth>تسجيل الدخول الآن</Button>
    {:else}
      <div class="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-accent-rose/10 border border-accent-rose/20 mb-4">
        <AlertCircle size={28} class="text-accent-rose" />
      </div>
      <h1 class="text-2xl font-bold text-white mb-2">فشل التحقق</h1>
      <p class="text-slate-400 text-sm mb-6">{errorMsg || 'الرابط غير صالح أو منتهي الصلاحية'}</p>
      <Button href="/login" variant="secondary" fullWidth>العودة لتسجيل الدخول</Button>
    {/if}
  </div>
</div>
