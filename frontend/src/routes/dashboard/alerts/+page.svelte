<script lang="ts">
  import { onMount } from 'svelte';
  import { priceAlerts, type PriceAlert } from '$lib/stores/priceAlerts';
  import { marketStore, type MarketTicker } from '$lib/stores/market';
  import { usdToEgp, egpCompact, formatEGP, usdEgpRate } from '$lib/utils/currency';
  import NavTabs from '$lib/components/NavTabs.svelte';
  import AlertModal from '$lib/components/AlertModal.svelte';
  import ChangeBadge from '$lib/components/ChangeBadge.svelte';
  import {
    Bell,
    BellRing,
    Plus,
    Trash2,
    RotateCcw,
    TrendingUp,
    TrendingDown,
    Search,
    CheckCircle2,
    AlertCircle,
    BellOff,
    ArrowLeft
  } from 'lucide-svelte';

  let alerts = $state<PriceAlert[]>([]);
  let tickers = $state<Record<string, MarketTicker>>({});
  let currentRate = $state(48.5);
  let filter = $state<'all' | 'active' | 'triggered'>('all');
  let searchQuery = $state('');
  let modalOpen = $state(false);
  let notifPermission = $state<NotificationPermission>('default');

  let unsubAlerts: (() => void) | null = null;
  let unsubMarket: (() => void) | null = null;
  let unsubRate: (() => void) | null = null;

  onMount(() => {
    unsubAlerts = priceAlerts.subscribe((a) => (alerts = a));
    unsubMarket = marketStore.subscribe((t) => (tickers = t));
    unsubRate = usdEgpRate.subscribe((r) => (currentRate = r));

    if ('Notification' in window) {
      notifPermission = Notification.permission;
    }

    return () => {
      unsubAlerts?.();
      unsubMarket?.();
      unsubRate?.();
    };
  });

  const filteredAlerts = $derived(
    alerts
      .filter((a) => {
        if (filter === 'active') return a.status === 'active';
        if (filter === 'triggered') return a.status === 'triggered';
        return true;
      })
      .filter((a) => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return (
          a.baseAsset.toLowerCase().includes(q) ||
          a.symbol.toLowerCase().includes(q) ||
          (a.note || '').toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        // Active first, then by createdAt desc
        if (a.status !== b.status) return a.status === 'active' ? -1 : 1;
        return b.createdAt - a.createdAt;
      })
  );

  const activeCount = $derived(alerts.filter((a) => a.status === 'active').length);
  const triggeredCount = $derived(alerts.filter((a) => a.status === 'triggered').length);

  function fmtPrice(p: number): string {
    return p < 1 ? p.toFixed(6) : p < 100 ? p.toFixed(4) : p.toFixed(2);
  }

  function timeAgo(ts: number): string {
    const diff = Date.now() - ts;
    const min = Math.floor(diff / 60000);
    if (min < 1) return 'الآن';
    if (min < 60) return `قبل ${min} دقيقة`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `قبل ${hr} ساعة`;
    const day = Math.floor(hr / 24);
    return `قبل ${day} يوم`;
  }

  function getCurrentPrice(symbol: string): number | null {
    const t = tickers[symbol];
    return t ? t.price : null;
  }

  function distanceToTarget(alert: PriceAlert): { pct: number; status: string; color: string } {
    const price = getCurrentPrice(alert.symbol);
    if (!price) return { pct: 0, status: '—', color: 'text-slate-500' };
    const diff = (alert.targetPrice - price) / price * 100;
    const absPct = Math.abs(diff);
    if (alert.direction === 'above') {
      if (price >= alert.targetPrice) return { pct: absPct, status: 'تم الوصول', color: 'text-accent-mint' };
      return { pct: absPct, status: `يبعد ${absPct.toFixed(1)}%`, color: 'text-slate-400' };
    } else {
      if (price <= alert.targetPrice) return { pct: absPct, status: 'تم الوصول', color: 'text-accent-rose' };
      return { pct: absPct, status: `يبعد ${absPct.toFixed(1)}%`, color: 'text-slate-400' };
    }
  }

  async function enableNotifications() {
    if (!('Notification' in window)) {
      alert('متصفحك لا يدعم الإشعارات');
      return;
    }
    try {
      const perm = await Notification.requestPermission();
      notifPermission = perm;
      if (perm === 'granted') {
        new Notification('تم تفعيل الإشعارات', {
          body: 'ستصلك تنبيهات الأسعار فوراً',
          icon: '/icons/icon-192.png'
        });
      }
    } catch (e) {
      // ignore
    }
  }

  function clearAllTriggered() {
    if (confirm('هل تريد حذف كل التنبيهات المُفعّلة؟')) {
      priceAlerts.clearTriggered();
    }
  }

  function createAlertForSymbol(symbol: string) {
    // Open modal with this symbol
    modalOpen = true;
  }
</script>

<svelte:head><title>التنبيهات — NEXUS</title></svelte:head>

<div class="space-y-6 relative">
  <!-- Ambient aurora -->
  <div class="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
    <div class="absolute -top-20 right-1/4 w-80 h-80 bg-accent-gold/6 blur-[120px] rounded-full animate-pulse-glow"></div>
    <div class="absolute bottom-0 -left-32 w-80 h-80 bg-accent-violet/5 blur-[120px] rounded-full animate-pulse-glow" style="animation-delay: 2s;"></div>
  </div>

  <!-- Header -->
  <div class="relative flex items-center justify-between flex-wrap gap-3">
    <div>
      <div class="flex items-center gap-2.5 mb-1">
        <div class="w-11 h-11 rounded-2xl bg-gradient-to-br from-accent-gold/20 to-accent-violet/10 border border-accent-gold/20 flex items-center justify-center">
          <BellRing size={22} class="text-accent-gold" />
        </div>
        <div>
          <h1 class="text-2xl sm:text-3xl font-bold text-white tracking-tight">تنبيهات الأسعار</h1>
          <p class="text-sm text-slate-400 mt-0.5">تابع أسعار عملاتك المفضلة واحصل على إشعارات فورية</p>
        </div>
      </div>
    </div>
    <button
      onclick={() => (modalOpen = true)}
      class="btn-primary text-sm"
    >
      <Plus size={16} /> تنبيه جديد
    </button>
  </div>

  <!-- Stats row -->
  <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 relative">
    <div class="stat-card group relative overflow-hidden">
      <div class="absolute -top-6 -right-6 w-20 h-20 bg-accent-gold/10 blur-2xl rounded-full group-hover:bg-accent-gold/15 transition-all"></div>
      <div class="relative">
        <div class="flex items-center justify-between mb-3">
          <div class="w-10 h-10 rounded-xl bg-accent-gold/10 border border-accent-gold/20 flex items-center justify-center">
            <Bell size={20} class="text-accent-gold" />
          </div>
          {#if activeCount > 0}
            <span class="relative flex h-2 w-2">
              <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-gold opacity-60"></span>
              <span class="relative inline-flex rounded-full h-2 w-2 bg-accent-gold"></span>
            </span>
          {/if}
        </div>
        <p class="text-2xl font-bold text-white tabular-nums">{activeCount}</p>
        <p class="text-xs text-slate-400 mt-1">تنبيهات بانتظار التفعيل</p>
      </div>
    </div>

    <div class="stat-card group relative overflow-hidden">
      <div class="absolute -top-6 -right-6 w-20 h-20 bg-accent-mint/10 blur-2xl rounded-full group-hover:bg-accent-mint/15 transition-all"></div>
      <div class="relative">
        <div class="flex items-center justify-between mb-3">
          <div class="w-10 h-10 rounded-xl bg-accent-mint/10 border border-accent-mint/20 flex items-center justify-center">
            <CheckCircle2 size={20} class="text-accent-mint" />
          </div>
        </div>
        <p class="text-2xl font-bold text-white tabular-nums">{triggeredCount}</p>
        <p class="text-xs text-slate-400 mt-1">تنبيهات تم تفعيلها</p>
      </div>
    </div>

    <div class="stat-card group relative overflow-hidden">
      <div class="absolute -top-6 -right-6 w-20 h-20 blur-2xl rounded-full group-hover:opacity-100 transition-all {notifPermission === 'granted' ? 'bg-accent-mint/10' : 'bg-accent-rose/10'}"></div>
      <div class="relative">
        <div class="flex items-center justify-between mb-3">
          <div class="w-10 h-10 rounded-xl {notifPermission === 'granted' ? 'bg-accent-mint/10 border-accent-mint/20' : 'bg-accent-rose/10 border-accent-rose/20'} border flex items-center justify-center">
            {#if notifPermission === 'granted'}
              <BellRing size={20} class="text-accent-mint" />
            {:else}
              <BellOff size={20} class="text-accent-rose" />
            {/if}
          </div>
          <span class="text-[10px] font-medium text-slate-500 uppercase tracking-wider">المتصفح</span>
        </div>
        {#if notifPermission === 'granted'}
          <p class="text-2xl font-bold text-accent-mint">مفعّلة</p>
          <p class="text-xs text-slate-400 mt-1">ستصلك الإشعارات</p>
        {:else if notifPermission === 'denied'}
          <p class="text-2xl font-bold text-accent-rose">محظورة</p>
          <p class="text-xs text-slate-400 mt-1">فعّلها من إعدادات المتصفح</p>
        {:else}
          <p class="text-2xl font-bold text-slate-400">معطّلة</p>
          <button onclick={enableNotifications} class="text-xs text-accent-gold hover:underline mt-1">
            تفعيل الآن ←
          </button>
        {/if}
      </div>
    </div>
  </div>

  <!-- Notification permission banner -->
  {#if notifPermission !== 'granted'}
    <div class="panel-glow p-4 flex items-start gap-3 relative overflow-hidden">
      <div class="absolute -top-12 -right-12 w-32 h-32 bg-accent-gold/10 blur-3xl rounded-full"></div>
      <div class="relative w-9 h-9 rounded-xl bg-accent-gold/15 flex items-center justify-center shrink-0">
        <AlertCircle size={18} class="text-accent-gold" />
      </div>
      <div class="flex-1 relative">
        <p class="text-sm font-semibold text-white">فعّل إشعارات المتصفح لتحصل على تنبيهات فورية</p>
        <p class="text-xs text-slate-400 mt-0.5">بدونها ستصلك التنبيهات فقط أثناء استخدام المنصة</p>
      </div>
      <button onclick={enableNotifications} class="btn-primary text-xs px-3 py-1.5">
        تفعيل
      </button>
    </div>
  {/if}

  <!-- Filter tabs + search -->
  <div class="flex items-center justify-between gap-3 flex-wrap">
    <NavTabs
      value={filter}
      onchange={(v) => (filter = v as any)}
      variant="underline"
      items={[
        { key: 'all', label: `الكل (${alerts.length})` },
        { key: 'active', label: `نشط (${activeCount})` },
        { key: 'triggered', label: `مُفعّل (${triggeredCount})` }
      ]}
    />

    <div class="relative flex-1 max-w-xs">
      <Search size={14} class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
      <input
        type="text"
        placeholder="بحث..."
        bind:value={searchQuery}
        class="input pr-9 py-2 text-sm"
      />
    </div>
  </div>

  <!-- Alerts list -->
  {#if filteredAlerts.length === 0}
    <div class="panel p-12 text-center">
      <Bell size={48} class="mx-auto mb-3 text-slate-600" />
      <h3 class="text-lg font-bold text-white mb-1">
        {#if searchQuery}
          لا توجد نتائج للبحث
        {:else if filter === 'active'}
          لا توجد تنبيهات نشطة
        {:else if filter === 'triggered'}
          لا توجد تنبيهات مُفعّلة
        {:else}
          لم تنشئ أي تنبيهات بعد
        {/if}
      </h3>
      <p class="text-sm text-slate-400 mb-4">أنشئ تنبيه سعر ليصلك إشعار فور لمسه للهدف</p>
      <button onclick={() => (modalOpen = true)} class="btn-primary">
        <Plus size={16} /> إنشاء تنبيه
      </button>
    </div>
  {:else}
    <!-- Bulk actions for triggered -->
    {#if triggeredCount > 0 && filter !== 'active'}
      <div class="flex items-center justify-end gap-2 text-xs">
        <button
          onclick={clearAllTriggered}
          class="text-slate-400 hover:text-accent-rose flex items-center gap-1 transition-colors"
        >
          <Trash2 size={12} /> حذف كل المُفعّلة
        </button>
      </div>
    {/if}

    <div class="panel overflow-hidden">
      <!-- Table header (desktop) -->
      <div class="hidden md:grid grid-cols-12 gap-3 px-4 py-3 border-b border-white/5 text-[10px] uppercase tracking-wider text-slate-500 font-bold">
        <div class="col-span-2">العملة</div>
        <div class="col-span-2">النوع</div>
        <div class="col-span-2">السعر الهدف</div>
        <div class="col-span-2">السعر الحالي</div>
        <div class="col-span-2">الحالة</div>
        <div class="col-span-2 text-left">إجراءات</div>
      </div>

      <!-- Rows -->
      {#each filteredAlerts as alert (alert.id)}
        {@const price = getCurrentPrice(alert.symbol)}
        {@const dist = distanceToTarget(alert)}
        <div class="px-4 py-3.5 border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors {alert.status === 'triggered' ? 'opacity-75' : ''}">

          <!-- Desktop layout -->
          <div class="hidden md:grid grid-cols-12 gap-3 items-center">
            <!-- Coin -->
            <div class="col-span-2 flex items-center gap-2">
              <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-accent-gold/15 to-accent-violet/10 border border-white/5 flex items-center justify-center text-[10px] font-bold text-white">
                {alert.baseAsset.slice(0, 3)}
              </div>
              <div>
                <p class="font-semibold text-white text-sm">{alert.baseAsset}</p>
                <p class="text-[10px] text-slate-500">{alert.quoteAsset}</p>
              </div>
            </div>

            <!-- Direction -->
            <div class="col-span-2">
              <span class="inline-flex items-center gap-1 text-xs {alert.direction === 'above' ? 'text-accent-mint' : 'text-accent-rose'}">
                {#if alert.direction === 'above'}
                  <TrendingUp size={12} /> فوق
                {:else}
                  <TrendingDown size={12} /> تحت
                {/if}
              </span>
            </div>

            <!-- Target price -->
            <div class="col-span-2">
              <p class="font-mono text-white text-sm tabular-nums">${fmtPrice(alert.targetPrice)}</p>
              <p class="text-[10px] text-slate-500 tabular-nums">{egpCompact(usdToEgp(alert.targetPrice, currentRate))} ج.م</p>
            </div>

            <!-- Current price -->
            <div class="col-span-2">
              {#if price !== null}
                <p class="font-mono text-slate-300 text-sm tabular-nums">${fmtPrice(price)}</p>
                <p class="text-[10px] text-slate-500">{timeAgo(alert.createdAt)}</p>
              {:else}
                <span class="text-xs text-slate-500">—</span>
              {/if}
            </div>

            <!-- Status -->
            <div class="col-span-2">
              {#if alert.status === 'active'}
                <span class="pill-gold text-[10px]">
                  <span class="w-1.5 h-1.5 rounded-full bg-accent-gold animate-pulse"></span>
                  نشط
                </span>
                {#if price !== null}
                  <p class="text-[10px] mt-1 {dist.color}">{dist.status}</p>
                {/if}
              {:else}
                <span class="pill-mint text-[10px]">مُفعّل</span>
                {#if alert.triggeredAt}
                  <p class="text-[10px] mt-1 text-slate-500">{timeAgo(alert.triggeredAt)}</p>
                {/if}
              {/if}
            </div>

            <!-- Actions -->
            <div class="col-span-2 flex items-center justify-end gap-1">
              {#if alert.status === 'triggered'}
                <button
                  onclick={() => priceAlerts.reactivate(alert.id)}
                  class="p-1.5 rounded-lg hover:bg-white/5 text-slate-400 hover:text-accent-mint transition-colors"
                  title="إعادة تفعيل"
                  aria-label="إعادة تفعيل"
                >
                  <RotateCcw size={14} />
                </button>
              {/if}
              <button
                onclick={() => priceAlerts.remove(alert.id)}
                class="p-1.5 rounded-lg hover:bg-white/5 text-slate-400 hover:text-accent-rose transition-colors"
                title="حذف"
                aria-label="حذف"
              >
                <Trash2 size={14} />
              </button>
            </div>

            <!-- Note (full width below) -->
            {#if alert.note}
              <div class="col-span-12 mt-1 text-xs text-slate-500 italic">
                "{alert.note}"
              </div>
            {/if}
          </div>

          <!-- Mobile layout -->
          <div class="md:hidden space-y-2">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <div class="w-9 h-9 rounded-lg bg-gradient-to-br from-accent-gold/15 to-accent-violet/10 border border-white/5 flex items-center justify-center text-[10px] font-bold text-white">
                  {alert.baseAsset.slice(0, 3)}
                </div>
                <div>
                  <p class="font-bold text-white text-sm">{alert.baseAsset}</p>
                  <p class="text-[10px] text-slate-500">{timeAgo(alert.createdAt)}</p>
                </div>
              </div>
              <div class="flex items-center gap-1">
                {#if alert.status === 'triggered'}
                  <button
                    onclick={() => priceAlerts.reactivate(alert.id)}
                    class="p-1.5 rounded-lg hover:bg-white/5 text-slate-400 hover:text-accent-mint"
                    aria-label="إعادة تفعيل"
                  >
                    <RotateCcw size={14} />
                  </button>
                {/if}
                <button
                  onclick={() => priceAlerts.remove(alert.id)}
                  class="p-1.5 rounded-lg hover:bg-white/5 text-slate-400 hover:text-accent-rose"
                  aria-label="حذف"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>

            <div class="flex items-center justify-between text-xs">
              <span class="inline-flex items-center gap-1 {alert.direction === 'above' ? 'text-accent-mint' : 'text-accent-rose'}">
                {#if alert.direction === 'above'}
                  <TrendingUp size={12} /> فوق
                {:else}
                  <TrendingDown size={12} /> تحت
                {/if}
              </span>
              <span class="font-mono text-white tabular-nums">${fmtPrice(alert.targetPrice)}</span>
            </div>

            <div class="flex items-center justify-between text-xs">
              {#if alert.status === 'active'}
                <span class="pill-gold text-[10px]">
                  <span class="w-1.5 h-1.5 rounded-full bg-accent-gold animate-pulse"></span>
                  {dist.status}
                </span>
              {:else}
                <span class="pill-mint text-[10px]">مُفعّل {alert.triggeredAt ? timeAgo(alert.triggeredAt) : ''}</span>
              {/if}
              {#if price !== null}
                <span class="font-mono text-slate-400 tabular-nums">${fmtPrice(price)}</span>
              {/if}
            </div>

            {#if alert.note}
              <p class="text-xs text-slate-500 italic">"{alert.note}"</p>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  {/if}

  <!-- Back link -->
  <div class="pt-4">
    <a href="/dashboard" class="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-white transition-colors">
      <ArrowLeft size={14} /> العودة للوحة التحكم
    </a>
  </div>
</div>

<AlertModal bind:open={modalOpen} symbol="BTCUSDT" />
