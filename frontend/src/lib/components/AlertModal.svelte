<script lang="ts">
  import { priceAlerts, type AlertDirection } from '$lib/stores/priceAlerts';
  import { marketStore, type MarketTicker } from '$lib/stores/market';
  import { toasts } from '$lib/stores/toast';
  import { usdToEgp, egpCompact } from '$lib/utils/currency';
  import Modal from './Modal.svelte';
  import { Bell, TrendingUp, TrendingDown, X, AlertCircle } from 'lucide-svelte';
  import { onMount, onDestroy } from 'svelte';

  let {
    open = $bindable(false),
    symbol = 'BTCUSDT'
  }: {
    open: boolean;
    symbol?: string;
  } = $props();

  let direction = $state<AlertDirection>('above');
  let targetPrice = $state<string>('');
  let note = $state<string>('');
  let loading = $state(false);
  let ticker = $state<MarketTicker | undefined>(undefined);
  let unsub: (() => void) | null = null;

  onMount(() => {
    unsub = marketStore.subscribe((t) => {
      ticker = t[symbol];
      // Pre-fill target price with current price if empty
      if (ticker && !targetPrice) {
        targetPrice = ticker.price.toString();
      }
    });
  });

  onDestroy(() => unsub?.());

  // When symbol changes externally, re-pre-fill target price
  let lastSymbol: string | null = null;
  $effect(() => {
    if (lastSymbol === null) {
      lastSymbol = symbol;
      return;
    }
    if (open && symbol !== lastSymbol) {
      lastSymbol = symbol;
      targetPrice = '';
    }
  });

  const baseAsset = $derived(symbol.replace(/USDT$|BUSD$|USDC$/, ''));
  const currentPrice = $derived(ticker?.price || 0);
  const targetNum = $derived(parseFloat(targetPrice) || 0);
  const diffPct = $derived(
    currentPrice > 0 && targetNum > 0 ? ((targetNum - currentPrice) / currentPrice) * 100 : 0
  );

  function handleSubmit(e: Event) {
    e.preventDefault();
    if (targetNum <= 0) {
      toasts.error('الرجاء إدخال سعر صحيح');
      return;
    }
    if (targetNum === currentPrice && currentPrice > 0) {
      toasts.info('السعر الهدف يساوي السعر الحالي — قد يتم تفعيل التنبيه فوراً');
    }
    loading = true;
    priceAlerts.add({
      symbol,
      baseAsset,
      quoteAsset: 'USDT',
      direction,
      targetPrice: targetNum,
      note: note.trim() || undefined
    });
    setTimeout(() => {
      loading = false;
      open = false;
      toasts.success('تم إنشاء التنبيه بنجاح');
      // Reset
      targetPrice = '';
      note = '';
    }, 200);
  }

  function quickPreset(pct: number) {
    if (currentPrice <= 0) return;
    const newPrice = currentPrice * (1 + pct / 100);
    direction = pct > 0 ? 'above' : 'below';
    targetPrice = newPrice.toFixed(currentPrice < 1 ? 6 : 2);
  }
</script>

<Modal {open} onClose={() => (open = false)} title="إنشاء تنبيه سعر" size="md">
  <form onsubmit={handleSubmit} class="space-y-5">
    <!-- Symbol + current price -->
    <div class="panel p-4 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-accent-gold/20 to-accent-violet/10 border border-accent-gold/20 flex items-center justify-center font-bold text-white">
          {baseAsset.slice(0, 3)}
        </div>
        <div>
          <p class="font-bold text-white text-base">{baseAsset}/USDT</p>
          <p class="text-xs text-slate-400">
            السعر الحالي:
            <span class="font-mono text-accent-gold tabular-nums ml-1">
              ${currentPrice.toFixed(currentPrice < 1 ? 6 : 2)}
            </span>
          </p>
        </div>
      </div>
      <div class="text-left">
        <p class="text-[10px] text-slate-500 uppercase tracking-wider">≈ ج.م</p>
        <p class="text-sm font-bold text-white tabular-nums">{egpCompact(usdToEgp(currentPrice, 48.5))}</p>
      </div>
    </div>

    <!-- Direction toggle -->
    <div>
      <span class="input-label">نوع التنبيه</span>
      <div class="grid grid-cols-2 gap-2">
        <button
          type="button"
          onclick={() => (direction = 'above')}
          class="flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all {direction === 'above'
            ? 'border-accent-mint bg-accent-mint/10 text-accent-mint'
            : 'border-white/10 text-slate-400 hover:border-white/20'}"
        >
          <TrendingUp size={18} />
          <span class="font-semibold">عندما يرتفع فوق</span>
        </button>
        <button
          type="button"
          onclick={() => (direction = 'below')}
          class="flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all {direction === 'below'
            ? 'border-accent-rose bg-accent-rose/10 text-accent-rose'
            : 'border-white/10 text-slate-400 hover:border-white/20'}"
        >
          <TrendingDown size={18} />
          <span class="font-semibold">عندما ينخفض تحت</span>
        </button>
      </div>
    </div>

    <!-- Target price -->
    <div>
      <label class="input-label" for="alert-target">السعر الهدف (USD)</label>
      <div class="relative">
        <span class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-sm pointer-events-none">$</span>
        <input
          id="alert-target"
          type="number"
          step="any"
          min="0"
          bind:value={targetPrice}
          placeholder="0.00"
          class="input pr-8 font-mono tabular-nums"
          required
        />
      </div>
      {#if targetNum > 0 && currentPrice > 0}
        <p class="text-xs text-slate-400 mt-1.5 flex items-center gap-1">
          <span class="{diffPct > 0 ? 'text-accent-mint' : diffPct < 0 ? 'text-accent-rose' : ''} font-medium">
            {diffPct > 0 ? '+' : ''}{diffPct.toFixed(2)}%
          </span>
          <span>من السعر الحالي</span>
        </p>
      {/if}

      <!-- Quick presets -->
      <div class="flex flex-wrap gap-1.5 mt-2">
        <button type="button" onclick={() => quickPreset(5)} class="pill-mint text-[10px] cursor-pointer">+5%</button>
        <button type="button" onclick={() => quickPreset(10)} class="pill-mint text-[10px] cursor-pointer">+10%</button>
        <button type="button" onclick={() => quickPreset(25)} class="pill-mint text-[10px] cursor-pointer">+25%</button>
        <button type="button" onclick={() => quickPreset(-5)} class="pill-rose text-[10px] cursor-pointer">-5%</button>
        <button type="button" onclick={() => quickPreset(-10)} class="pill-rose text-[10px] cursor-pointer">-10%</button>
        <button type="button" onclick={() => quickPreset(-25)} class="pill-rose text-[10px] cursor-pointer">-25%</button>
      </div>
    </div>

    <!-- Optional note -->
    <div>
      <label class="input-label" for="alert-note">ملاحظة (اختياري)</label>
      <input
        id="alert-note"
        type="text"
        bind:value={note}
        maxlength="80"
        placeholder="مثال: ابيع عند هذا السعر"
        class="input"
      />
    </div>

    <!-- Info banner -->
    <div class="flex items-start gap-2 p-3 rounded-xl bg-accent-azure/5 border border-accent-azure/15 text-xs text-slate-300">
      <AlertCircle size={14} class="text-accent-azure shrink-0 mt-0.5" />
      <p>سيتم إشعارك فور لمس السعر للسعر الهدف. تأكد من تفعيل إشعارات المتصفح للحصول على تنبيهات فورية.</p>
    </div>

    <!-- Actions -->
    <div class="flex gap-2 pt-2">
      <button
        type="button"
        onclick={() => (open = false)}
        class="btn-secondary flex-1"
      >
        إلغاء
      </button>
      <button
        type="submit"
        disabled={loading || targetNum <= 0}
        class="btn-primary flex-1"
      >
        {#if loading}
          <span class="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></span>
        {:else}
          <Bell size={16} />
        {/if}
        إنشاء التنبيه
      </button>
    </div>
  </form>
</Modal>
