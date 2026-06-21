<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { wallet } from '$lib/api/endpoints';
  import { parseApiResponse, ApiError } from '$lib/api/client';
  import { toasts } from '$lib/stores/toast';
  import { formatPrice } from '$lib/utils/format';
  import { ArrowDownToLine, Copy, Check, AlertCircle, ChevronRight } from 'lucide-svelte';

  let currency = $state('USDT');
  let amount = $state('');
  let txId = $state('');
  let loading = $state(false);
  let depositAddress = $state('');
  let copied = $state(false);

  onMount(() => {
    currency = $page.params.currency || 'USDT';
    // Generate a mock deposit address (in real app, this comes from backend)
    depositAddress = generateMockAddress(currency);
  });

  function generateMockAddress(c: string): string {
    if (c === 'USDT') return '0x' + Math.random().toString(16).slice(2, 42);
    if (c === 'BTC') return 'bc1q' + Math.random().toString(36).slice(2, 38);
    if (c === 'ETH') return '0x' + Math.random().toString(16).slice(2, 42);
    return 'addr_' + Math.random().toString(36).slice(2, 22);
  }

  async function copyAddress() {
    try {
      await navigator.clipboard.writeText(depositAddress);
      copied = true;
      setTimeout(() => (copied = false), 2000);
    } catch {}
  }

  async function handleSubmit() {
    if (!amount || parseFloat(amount) <= 0) {
      toasts.error('أدخل مبلغاً صحيحاً');
      return;
    }
    loading = true;
    try {
      const res = await wallet.deposit({
        currency,
        amount: parseFloat(amount),
        tx_id: txId || undefined
      });
      await parseApiResponse(res);
      toasts.success('تم إرسال طلب الإيداع');
      amount = '';
      txId = '';
    } catch (err: any) {
      if (err instanceof ApiError) toasts.error(err.message);
      else toasts.error('فشل الإيداع');
    } finally {
      loading = false;
    }
  }
</script>

<svelte:head><title>إيداع {currency} — NEXUS</title></svelte:head>

<div class="max-w-2xl mx-auto space-y-5">
  <!-- Breadcrumb -->
  <div class="flex items-center gap-2 text-sm">
    <a href="/dashboard/wallet" class="text-slate-400 hover:text-white">المحفظة</a>
    <ChevronRight size={14} class="text-slate-600" />
    <span class="text-white">إيداع {currency}</span>
  </div>

  <div class="panel p-6">
    <div class="flex items-center gap-3 mb-6">
      <div class="w-12 h-12 rounded-2xl bg-accent-mint/10 border border-accent-mint/20 flex items-center justify-center">
        <ArrowDownToLine size={22} class="text-accent-mint" />
      </div>
      <div>
        <h1 class="text-xl font-bold text-white">إيداع {currency}</h1>
        <p class="text-xs text-slate-400">أرسل العملات إلى العنوان التالي</p>
      </div>
    </div>

    <!-- Deposit address -->
    <div class="mb-6">
      <span class="input-label">عنوان الإيداع ({currency})</span>
      <div class="relative">
        <input
          value={depositAddress}
          readonly
          class="input pr-3 pl-24 font-mono text-sm"
        />
        <button
          onclick={copyAddress}
          class="absolute inset-y-0 left-2 my-1 px-3 rounded-lg bg-accent-gold/15 text-accent-gold hover:bg-accent-gold/25 transition-colors flex items-center gap-1.5 text-xs font-medium"
        >
          {#if copied}<Check size={14} />{:else}<Copy size={14} />{/if}
          {copied ? 'تم النسخ' : 'نسخ'}
        </button>
      </div>
    </div>

    <!-- Warning -->
    <div class="panel p-4 mb-6 bg-accent-gold/5 border-accent-gold/20">
      <div class="flex items-start gap-3">
        <AlertCircle size={18} class="text-accent-gold shrink-0 mt-0.5" />
        <div class="text-xs text-slate-300 leading-relaxed">
          <p class="font-bold text-accent-gold mb-1">تنبيه مهم</p>
          <ul class="space-y-1 list-disc list-inside">
            <li>أرسل فقط {currency} إلى هذا العنوان</li>
            <li>الحد الأدنى للإيداع: 0.0001 {currency}</li>
            <li>تتطلب المعاملات تأكيدات على البلوكتشين</li>
            <li>لن تُعتمد المعاملات بدون تأكيد كافٍ</li>
          </ul>
        </div>
      </div>
    </div>

    <!-- Manual deposit form -->
    <form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }} class="space-y-4">
      <div>
        <label class="input-label" for="amount">المبلغ المُودع</label>
        <input
          id="amount"
          bind:value={amount}
          type="number"
          step="0.000001"
          placeholder="0.00"
          class="input font-mono"
        />
      </div>

      <div>
        <label class="input-label" for="txid">TX ID (اختياري)</label>
        <input
          id="txid"
          bind:value={txId}
          type="text"
          placeholder="0x..."
          class="input font-mono text-sm"
        />
        <p class="text-[10px] text-slate-500 mt-1">أدخل معرف المعاملة لتسريع التحقق</p>
      </div>

      <button type="submit" disabled={loading} class="btn-buy w-full py-3">
        {#if loading}
          <svg class="animate-spin h-4 w-4 mx-auto" viewBox="0 0 24 24" fill="none">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        {:else}
          تأكيد الإيداع
        {/if}
      </button>
    </form>
  </div>
</div>
