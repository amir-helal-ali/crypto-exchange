<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { wallet } from '$lib/api/endpoints';
  import { parseApiResponse, ApiError } from '$lib/api/client';
  import { toasts } from '$lib/stores/toast';
  import { formatPrice } from '$lib/utils/format';
  import { ArrowUpFromLine, AlertCircle, ChevronRight } from 'lucide-svelte';

  let currency = $state('USDT');
  let amount = $state('');
  let address = $state('');
  let twoFaCode = $state('');
  let loading = $state(false);

  // Mock fee
  const fee = $derived(0.001);

  onMount(() => {
    currency = $page.params.currency || 'USDT';
  });

  async function handleSubmit() {
    if (!amount || parseFloat(amount) <= 0) {
      toasts.error('أدخل مبلغاً صحيحاً');
      return;
    }
    if (!address.trim()) {
      toasts.error('أدخل عنوان الاستلام');
      return;
    }
    loading = true;
    try {
      const res = await wallet.withdraw({
        currency,
        amount: parseFloat(amount),
        address: address.trim(),
        two_fa_code: twoFaCode || undefined
      });
      await parseApiResponse(res);
      toasts.success('تم إرسال طلب السحب');
      amount = '';
      address = '';
      twoFaCode = '';
    } catch (err: any) {
      if (err instanceof ApiError) toasts.error(err.message);
      else toasts.error('فشل السحب');
    } finally {
      loading = false;
    }
  }
</script>

<svelte:head><title>سحب {currency} — NEXUS</title></svelte:head>

<div class="max-w-2xl mx-auto space-y-5">
  <div class="flex items-center gap-2 text-sm">
    <a href="/dashboard/wallet" class="text-slate-400 hover:text-white">المحفظة</a>
    <ChevronRight size={14} class="text-slate-600" />
    <span class="text-white">سحب {currency}</span>
  </div>

  <div class="panel p-6">
    <div class="flex items-center gap-3 mb-6">
      <div class="w-12 h-12 rounded-2xl bg-accent-rose/10 border border-accent-rose/20 flex items-center justify-center">
        <ArrowUpFromLine size={22} class="text-accent-rose" />
      </div>
      <div>
        <h1 class="text-xl font-bold text-white">سحب {currency}</h1>
        <p class="text-xs text-slate-400">أرسل العملات إلى عنوان خارجي</p>
      </div>
    </div>

    <form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }} class="space-y-4">
      <div>
        <label class="input-label" for="address">عنوان الاستلام ({currency})</label>
        <input
          id="address"
          bind:value={address}
          type="text"
          placeholder="أدخل العنوان"
          class="input font-mono text-sm"
        />
      </div>

      <div>
        <label class="input-label" for="amount">المبلغ</label>
        <div class="relative">
          <input
            id="amount"
            bind:value={amount}
            type="number"
            step="0.000001"
            placeholder="0.00"
            class="input pr-3 pl-20 font-mono"
          />
          <span class="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-500">{currency}</span>
        </div>
        <div class="flex items-center justify-between mt-1.5 text-[10px] text-slate-500">
          <span>الرسوم: {fee} {currency}</span>
          <span>ستستلم: {amount ? (parseFloat(amount) - fee).toFixed(6) : '0.00'} {currency}</span>
        </div>
      </div>

      <div>
        <label class="input-label" for="2fa">رمز المصادقة الثنائية (إذا مفعّل)</label>
        <input
          id="2fa"
          bind:value={twoFaCode}
          type="text"
          maxlength="6"
          inputmode="numeric"
          placeholder="000000"
          class="input text-center tracking-[0.3em] font-mono"
        />
      </div>

      <div class="panel p-4 bg-accent-rose/5 border-accent-rose/20">
        <div class="flex items-start gap-3">
          <AlertCircle size={18} class="text-accent-rose shrink-0 mt-0.5" />
          <div class="text-xs text-slate-300 leading-relaxed">
            <p class="font-bold text-accent-rose mb-1">تحذير</p>
            <ul class="space-y-1 list-disc list-inside">
              <li>تأكد من صحة العنوان — لا يمكن استرجاع العملات المُرسلة لعنوان خاطئ</li>
              <li>الحد الأدنى للسحب: 0.001 {currency}</li>
              <li>قد تستغرق المعاملة 10-30 دقيقة للتأكيد</li>
            </ul>
          </div>
        </div>
      </div>

      <button type="submit" disabled={loading} class="btn-sell w-full py-3">
        {#if loading}
          <svg class="animate-spin h-4 w-4 mx-auto" viewBox="0 0 24 24" fill="none">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        {:else}
          تأكيد السحب
        {/if}
      </button>
    </form>
  </div>
</div>
