<script lang="ts">
  import { onMount } from 'svelte';
  import { wallet, exchange } from '$lib/api/endpoints';
  import { parseApiResponse } from '$lib/api/client';
  import { formatPrice, formatDate } from '$lib/utils/format';
  import { usdToEgp, egpCompact, formatEGP, egpWithSymbol, usdEgpRate } from '$lib/utils/currency';
  import NavTabs from '$lib/components/NavTabs.svelte';
  import {
    Clock, ChevronDown, ArrowDownToLine, ArrowUpFromLine,
    TrendingUp, Activity, Wallet, Filter, Search, RefreshCw
  } from 'lucide-svelte';

  let transactions = $state<any[]>([]);
  let orders = $state<any[]>([]);
  let loading = $state(true);
  let refreshing = $state(false);
  let tab = $state<'orders' | 'deposits'>('orders');
  let filter = $state<'all' | 'filled' | 'pending' | 'cancelled'>('all');
  let searchQuery = $state('');
  let currentRate = $state(48.5);

  const unsubRate = usdEgpRate.subscribe((r) => (currentRate = r));

  onMount(() => {
    (async () => {
      await Promise.all([loadOrders(), loadTransactions()]);
      loading = false;
    })();
    return unsubRate;
  });

  async function loadOrders() {
    try {
      const res = await exchange.getOrders({ limit: 50 });
      orders = (await parseApiResponse<any[]>(res)) || [];
    } catch {}
  }

  async function loadTransactions() {
    try {
      const res = await wallet.getTransactions({ limit: 50 });
      transactions = (await parseApiResponse<any[]>(res)) || [];
    } catch {}
  }

  async function refresh() {
    refreshing = true;
    await Promise.all([loadOrders(), loadTransactions()]);
    refreshing = false;
  }

  const filteredOrders = $derived(
    orders.filter((o) => {
      const matchesFilter = filter === 'all' || o.status.toLowerCase() === filter;
      const matchesSearch = !searchQuery ||
        o.symbol?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        o.side?.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesFilter && matchesSearch;
    })
  );

  const filteredTx = $derived(
    transactions.filter((tx) => {
      if (!searchQuery) return true;
      return tx.currency?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tx.type?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tx.tx_id?.toLowerCase().includes(searchQuery.toLowerCase());
    })
  );

  // Summary stats
  const totalVolumeEgp = $derived(
    orders
      .filter((o) => o.status === 'FILLED')
      .reduce((sum, o) => sum + usdToEgp(o.price * o.quantity, currentRate), 0)
  );

  const filledCount = $derived(orders.filter((o) => o.status === 'FILLED').length);
  const pendingCount = $derived(orders.filter((o) => o.status === 'PENDING').length);
  const totalDeposits = $derived(
    transactions
      .filter((t) => t.type === 'DEPOSIT' && (t.status === 'COMPLETED' || t.status === 'APPROVED'))
      .reduce((sum, t) => sum + (t.currency === 'USDT' ? usdToEgp(t.amount, currentRate) : 0), 0)
  );

  const filters = [
    { k: 'all', l: 'الكل', count: orders.length },
    { k: 'filled', l: 'مكتملة', count: orders.filter((o) => o.status === 'FILLED').length },
    { k: 'pending', l: 'معلقة', count: pendingCount },
    { k: 'cancelled', l: 'ملغاة', count: orders.filter((o) => o.status === 'CANCELLED').length }
  ] as const;
</script>

<svelte:head><title>سجل الصفقات — NEXUS</title></svelte:head>

<div class="space-y-6 relative">
  <!-- Ambient aurora -->
  <div class="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
    <div class="absolute -top-20 right-1/3 w-80 h-80 bg-accent-azure/6 blur-[120px] rounded-full"></div>
    <div class="absolute bottom-0 -left-32 w-80 h-80 bg-accent-mint/5 blur-[120px] rounded-full"></div>
  </div>

  <!-- Header -->
  <div class="relative flex items-center justify-between">
    <div>
      <div class="flex items-center gap-2.5 mb-1">
        <h1 class="text-2xl sm:text-3xl font-bold text-white tracking-tight">سجل الصفقات</h1>
        <div class="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-accent-mint/10 border border-accent-mint/25">
          <span class="relative flex h-1.5 w-1.5">
            <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-mint opacity-60"></span>
            <span class="relative inline-flex rounded-full h-1.5 w-1.5 bg-accent-mint"></span>
          </span>
          <span class="text-[10px] font-bold text-accent-mint tracking-wide">مباشر</span>
        </div>
      </div>
      <p class="text-sm text-slate-400 mt-1">عرض جميع صفقاتك ومعاملاتك في مكان واحد</p>
    </div>
    <button onclick={refresh} disabled={refreshing} class="btn-ghost" aria-label="تحديث">
      <RefreshCw size={16} class={refreshing ? 'animate-spin' : ''} />
    </button>
  </div>

  <!-- Summary stats banner -->
  <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 relative">
    <div class="panel p-4 relative overflow-hidden group">
      <div class="absolute -top-6 -right-6 w-20 h-20 bg-accent-mint/10 blur-2xl rounded-full group-hover:bg-accent-mint/15 transition-all"></div>
      <div class="relative">
        <div class="flex items-center gap-1.5 mb-2">
          <TrendingUp size={12} class="text-accent-mint" />
          <span class="text-[10px] uppercase tracking-wider text-slate-500 font-bold">حجم التداول</span>
        </div>
        <p class="text-xl font-bold text-white tabular-nums">{egpCompact(totalVolumeEgp)}</p>
        <p class="text-[10px] text-slate-500 mt-0.5">ج.م — صفقات مكتملة</p>
      </div>
    </div>
    <div class="panel p-4 relative overflow-hidden group">
      <div class="absolute -top-6 -right-6 w-20 h-20 bg-accent-gold/10 blur-2xl rounded-full group-hover:bg-accent-gold/15 transition-all"></div>
      <div class="relative">
        <div class="flex items-center gap-1.5 mb-2">
          <Activity size={12} class="text-accent-gold" />
          <span class="text-[10px] uppercase tracking-wider text-slate-500 font-bold">مكتملة</span>
        </div>
        <p class="text-xl font-bold text-white tabular-nums">{filledCount}</p>
        <p class="text-[10px] text-slate-500 mt-0.5">صفقة ناجحة</p>
      </div>
    </div>
    <div class="panel p-4 relative overflow-hidden group">
      <div class="absolute -top-6 -right-6 w-20 h-20 bg-accent-violet/10 blur-2xl rounded-full group-hover:bg-accent-violet/15 transition-all"></div>
      <div class="relative">
        <div class="flex items-center gap-1.5 mb-2">
          <Clock size={12} class="text-accent-violet" />
          <span class="text-[10px] uppercase tracking-wider text-slate-500 font-bold">معلقة</span>
        </div>
        <p class="text-xl font-bold text-white tabular-nums">{pendingCount}</p>
        <p class="text-[10px] text-slate-500 mt-0.5">بانتظار التنفيذ</p>
      </div>
    </div>
    <div class="panel p-4 relative overflow-hidden group">
      <div class="absolute -top-6 -right-6 w-20 h-20 bg-accent-azure/10 blur-2xl rounded-full group-hover:bg-accent-azure/15 transition-all"></div>
      <div class="relative">
        <div class="flex items-center gap-1.5 mb-2">
          <ArrowDownToLine size={12} class="text-accent-azure" />
          <span class="text-[10px] uppercase tracking-wider text-slate-500 font-bold">إيداعات</span>
        </div>
        <p class="text-xl font-bold text-white tabular-nums">{egpCompact(totalDeposits)}</p>
        <p class="text-[10px] text-slate-500 mt-0.5">ج.م — مكتملة</p>
      </div>
    </div>
  </div>

  <!-- Nav tabs -->
  <NavTabs
    value={tab}
    onchange={(key) => (tab = key as any)}
    items={[
      { key: 'orders', label: 'الصفقات', icon: ChevronDown, count: orders.length },
      { key: 'deposits', label: 'الإيداع والسحب', icon: ArrowDownToLine, count: transactions.length }
    ]}
  />

  <!-- Search bar -->
  <div class="relative">
    <Search size={16} class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
    <input
      bind:value={searchQuery}
      type="text"
      placeholder={tab === 'orders' ? 'ابحث برمز الزوج أو النوع...' : 'ابحث بالعملة أو نوع المعاملة أو TX ID...'}
      class="input pr-10"
    />
    {#if searchQuery}
      <button
        onclick={() => (searchQuery = '')}
        class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white p-0.5 rounded"
        aria-label="مسح"
      >
        <Filter size={14} />
      </button>
    {/if}
  </div>

  {#if tab === 'orders'}
    <!-- Filter pills -->
    <div class="flex gap-2 flex-wrap">
      {#each filters as f}
        <button
          onclick={() => (filter = f.k as any)}
          class="px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 {
            filter === f.k
              ? 'bg-accent-gold/15 text-accent-gold border border-accent-gold/30'
              : 'bg-white/[0.03] text-slate-400 hover:bg-white/5 border border-transparent'
          }"
        >
          {f.l}
          {#if f.count > 0}
            <span class="text-[9px] px-1 py-0.5 rounded-full {filter === f.k ? 'bg-accent-gold/20' : 'bg-white/5'} tabular-nums">{f.count}</span>
          {/if}
        </button>
      {/each}
    </div>

    <div class="panel overflow-hidden relative">
      <div class="absolute top-0 inset-x-0 h-px pointer-events-none" style="background: linear-gradient(90deg, transparent, rgba(245, 181, 68, 0.3), transparent);"></div>
      {#if loading}
        <div class="p-6 space-y-3">
          {#each Array(8) as _}<div class="h-12 rounded-xl bg-white/5 animate-shimmer"></div>{/each}
        </div>
      {:else if filteredOrders.length === 0}
        <div class="py-20 text-center">
          <div class="relative inline-block mb-4">
            <div class="absolute inset-0 bg-accent-gold/10 blur-2xl rounded-full"></div>
            <Clock size={48} class="relative text-slate-600 mx-auto" />
          </div>
          <p class="text-sm font-medium text-slate-300">{searchQuery ? 'لا توجد نتائج مطابقة' : 'لا توجد صفقات بعد'}</p>
          <p class="text-xs text-slate-500 mt-1">{searchQuery ? 'جرّب تعديل البحث' : 'ابدأ رحلتك في التداول الآن'}</p>
          {#if !searchQuery}
            <a href="/dashboard/exchange" class="inline-flex items-center gap-1.5 mt-4 px-4 py-2 rounded-xl bg-accent-gold/10 border border-accent-gold/30 text-accent-gold text-xs font-medium hover:bg-accent-gold/20 transition-colors">
              <TrendingUp size={14} /> ابدأ التداول
            </a>
          {/if}
        </div>
      {:else}
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="text-[10px] uppercase tracking-wider text-slate-500 border-b border-white/5 bg-white/[0.01]">
                <th class="text-right font-medium px-5 py-3">التاريخ</th>
                <th class="text-right font-medium px-5 py-3">الزوج</th>
                <th class="text-right font-medium px-5 py-3">النوع</th>
                <th class="text-right font-medium px-5 py-3">السعر (ج.م)</th>
                <th class="text-right font-medium px-5 py-3 hidden sm:table-cell">الكمية</th>
                <th class="text-right font-medium px-5 py-3">الإجمالي (ج.م)</th>
                <th class="text-left font-medium px-5 py-3">الحالة</th>
              </tr>
            </thead>
            <tbody>
              {#each filteredOrders as o}
                <tr class="border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors group">
                  <td class="px-5 py-3 text-xs text-slate-400 whitespace-nowrap">{formatDate(o.created_at)}</td>
                  <td class="px-5 py-3">
                    <div class="flex items-center gap-2">
                      <div class="w-7 h-7 rounded-full bg-gradient-to-br from-accent-gold/20 to-accent-violet/20 border border-white/5 flex items-center justify-center text-[9px] font-bold text-white">
                        {o.symbol?.replace('USDT', '').slice(0, 2)}
                      </div>
                      <span class="font-semibold text-white">{o.symbol}</span>
                    </div>
                  </td>
                  <td class="px-5 py-3">
                    <span class="pill {o.side === 'BUY' ? 'pill-mint' : 'pill-rose'}">
                      {o.side === 'BUY' ? 'شراء' : 'بيع'}
                    </span>
                  </td>
                  <td class="px-5 py-3 font-mono text-slate-300 tabular-nums">{formatEGP(usdToEgp(o.price, currentRate))}</td>
                  <td class="px-5 py-3 font-mono text-slate-400 tabular-nums hidden sm:table-cell">{formatPrice(o.quantity, 6)}</td>
                  <td class="px-5 py-3 font-mono text-white font-semibold tabular-nums">{egpCompact(usdToEgp(o.price * o.quantity, currentRate))}</td>
                  <td class="px-5 py-3 text-left">
                    <span class="pill {o.status === 'FILLED' ? 'pill-mint' : o.status === 'PENDING' ? 'pill-gold' : 'pill-rose'}">
                      {o.status === 'FILLED' ? 'مكتمل' : o.status === 'PENDING' ? 'معلق' : o.status === 'CANCELLED' ? 'ملغى' : o.status}
                    </span>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </div>
  {:else}
    <div class="panel overflow-hidden relative">
      <div class="absolute top-0 inset-x-0 h-px pointer-events-none" style="background: linear-gradient(90deg, transparent, rgba(34, 211, 164, 0.3), transparent);"></div>
      {#if loading}
        <div class="p-6 space-y-3">
          {#each Array(5) as _}<div class="h-12 rounded-xl bg-white/5 animate-shimmer"></div>{/each}
        </div>
      {:else if filteredTx.length === 0}
        <div class="py-20 text-center">
          <div class="relative inline-block mb-4">
            <div class="absolute inset-0 bg-accent-azure/10 blur-2xl rounded-full"></div>
            <Wallet size={48} class="relative text-slate-600 mx-auto" />
          </div>
          <p class="text-sm font-medium text-slate-300">{searchQuery ? 'لا توجد نتائج مطابقة' : 'لا توجد معاملات بعد'}</p>
          <p class="text-xs text-slate-500 mt-1">{searchQuery ? 'جرّب تعديل البحث' : 'أودع عملاتك لبدء التداول'}</p>
          {#if !searchQuery}
            <a href="/dashboard/wallet" class="inline-flex items-center gap-1.5 mt-4 px-4 py-2 rounded-xl bg-accent-mint/10 border border-accent-mint/30 text-accent-mint text-xs font-medium hover:bg-accent-mint/20 transition-colors">
              <ArrowDownToLine size={14} /> إيداع
            </a>
          {/if}
        </div>
      {:else}
        <div class="divide-y divide-white/5">
          {#each filteredTx as tx}
            <div class="flex items-center justify-between px-5 py-4 hover:bg-white/[0.02] transition-colors group">
              <div class="flex items-center gap-3">
                <div class="relative w-11 h-11 rounded-xl {tx.type === 'DEPOSIT' ? 'bg-accent-mint/10 border-accent-mint/20' : 'bg-accent-rose/10 border-accent-rose/20'} border flex items-center justify-center">
                  {#if tx.type === 'DEPOSIT'}
                    <ArrowDownToLine size={18} class="text-accent-mint" />
                  {:else}
                    <ArrowUpFromLine size={18} class="text-accent-rose" />
                  {/if}
                  <span class="absolute -bottom-1 -right-1 text-[8px] font-bold text-white bg-ink-900 rounded px-1 border border-white/10">
                    {tx.currency.slice(0, 3)}
                  </span>
                </div>
                <div>
                  <p class="text-sm font-semibold text-white">
                    {tx.type === 'DEPOSIT' ? 'إيداع' : tx.type === 'WITHDRAWAL' ? 'سحب' : tx.type}
                    <span class="text-slate-500 font-normal">• {tx.currency}</span>
                  </p>
                  <p class="text-xs text-slate-400">{formatDate(tx.created_at)}</p>
                  {#if tx.tx_id}
                    <p class="text-[10px] text-slate-600 font-mono mt-0.5 group-hover:text-slate-400 transition-colors">TX: {tx.tx_id.slice(0, 20)}...</p>
                  {/if}
                </div>
              </div>
              <div class="text-left">
                <p class="text-sm font-mono font-bold {tx.type === 'DEPOSIT' ? 'text-accent-mint' : 'text-accent-rose'} tabular-nums">
                  {tx.type === 'DEPOSIT' ? '+' : '-'}{formatPrice(tx.amount, 6)} {tx.currency}
                </p>
                {#if tx.currency === 'USDT'}
                  <p class="text-[10px] text-slate-500 mt-0.5 tabular-nums">
                    ≈ {egpCompact(usdToEgp(tx.amount, currentRate))} ج.م
                  </p>
                {/if}
                <span class="pill {tx.status === 'COMPLETED' || tx.status === 'APPROVED' ? 'pill-mint' : tx.status === 'PENDING' ? 'pill-gold' : 'pill-rose'} text-[10px] mt-1">
                  {tx.status === 'COMPLETED' || tx.status === 'APPROVED' ? 'مكتمل' : tx.status === 'PENDING' ? 'معلق' : tx.status}
                </span>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  {/if}
</div>
