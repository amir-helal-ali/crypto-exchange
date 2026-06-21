<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { auth } from '$lib/api/endpoints';
  import { toasts } from '$lib/stores/toast';
  import Button from '$lib/components/Button.svelte';
  import { Lock, Eye, EyeOff, CheckCircle2, AlertCircle } from 'lucide-svelte';
  import ParticleBackground from '$lib/components/ParticleBackground.svelte';
  import ThemeToggle from '$lib/components/ThemeToggle.svelte';

  let password = $state('');
  let confirmPassword = $state('');
  let showPassword = $state(false);
  let loading = $state(false);
  let status = $state<'form' | 'success' | 'error' | 'invalid'>('form');
  let errorMsg = $state('');
  let token = $state('');

  onMount(() => {
    token = new URLSearchParams(window.location.search).get('token') || '';
    if (!token) {
      status = 'invalid';
    }
  });

  async function handleSubmit(e: Event) {
    e.preventDefault();
    if (password.length < 8) {
      errorMsg = 'كلمة المرور يجب أن تكون 8 أحرف على الأقل';
      return;
    }
    if (password !== confirmPassword) {
      errorMsg = 'كلمتا المرور غير متطابقتين';
      return;
    }
    loading = true;
    errorMsg = '';
    try {
      const res = await auth.resetPassword(token, password);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'فشل إعادة التعيين');
      }
      status = 'success';
      toasts.success('تم إعادة تعيين كلمة المرور');
      setTimeout(() => goto('/login'), 2000);
    } catch (err: any) {
      errorMsg = err.message;
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
    {#if status === 'success'}
      <div class="text-center py-6">
        <div class="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-accent-mint/10 border border-accent-mint/20 mb-4">
          <CheckCircle2 size={28} class="text-accent-mint" />
        </div>
        <h1 class="text-2xl font-bold text-white mb-2">تم بنجاح!</h1>
        <p class="text-slate-400 text-sm mb-6">سيتم تحويلك إلى صفحة تسجيل الدخول</p>
        <Button href="/login" fullWidth>تسجيل الدخول</Button>
      </div>
    {:else if status === 'invalid'}
      <div class="text-center py-6">
        <div class="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-accent-rose/10 border border-accent-rose/20 mb-4">
          <AlertCircle size={28} class="text-accent-rose" />
        </div>
        <h1 class="text-2xl font-bold text-white mb-2">رابط غير صالح</h1>
        <p class="text-slate-400 text-sm mb-6">رابط إعادة التعيين غير صحيح أو منتهي الصلاحية</p>
        <Button href="/forgot-password" variant="secondary" fullWidth>
          طلب رابط جديد
        </Button>
      </div>
    {:else}
      <div class="text-center mb-6">
        <div class="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-accent-gold/10 border border-accent-gold/20 mb-4">
          <Lock size={24} class="text-accent-gold" />
        </div>
        <h1 class="text-2xl font-bold text-white mb-2">إعادة تعيين كلمة المرور</h1>
        <p class="text-slate-400 text-sm">أدخل كلمة المرور الجديدة</p>
      </div>

      <form onsubmit={handleSubmit} class="space-y-4">
        <div>
          <label class="input-label" for="password">كلمة المرور الجديدة</label>
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
              class="input pr-10 pl-10"
            />
            <button
              type="button"
              class="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 hover:text-white"
              onclick={() => (showPassword = !showPassword)}
            >
              {#if showPassword}<EyeOff size={16} />{:else}<Eye size={16} />{/if}
            </button>
          </div>
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
              class="input pr-10"
            />
          </div>
        </div>

        {#if errorMsg}<p class="text-xs text-accent-rose">{errorMsg}</p>{/if}

        <Button type="submit" {loading} fullWidth size="lg">
          {#if !loading}إعادة التعيين{/if}
        </Button>
      </form>
    {/if}
  </div>
</div>
