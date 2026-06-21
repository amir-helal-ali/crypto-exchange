<script lang="ts">
  import { onMount } from 'svelte';
  import { wallet, exchange } from '$lib/api/endpoints';
  import { parseApiResponse } from '$lib/api/client';
  import { formatPrice, formatDate } from '$lib/utils/format';
  import { usdToEgp, egpCompact, formatEGP, egpWithSymbol, usdEgpRate } from '$lib/utils/currency';
  import NavTabs from '$lib/components/NavTabs.svelte';
  import { Clock, ChevronDown, ArrowDownToLine, ArrowUpFromLine } from 'lucide-svelte';

  let transactions = $state<any[]>([]);
  let orders = $state<any[]>([]);
  let loading = $state(true);
  let tab = $state<'orders' | 'deposits'>('orders');
  let filter = $state<'all' | 'filled' | 'pending' | 'cancelled'>('all');
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

  const filteredOrders = $derived(
    filter === 'all' ? orders : orders.filter((o) => o.status.toLowerCase() === filter)
  );
</script>

<svelte:head><title>سجل الصفقات — NEXUS</title></svelte:head>

<div class="space-y-5">
  <div>
    <h1 class="text-2xl sm:text-3xl font-bold text-white">سجل الصفقات</h1>
    <p class="text-sm text-slate-400 mt-1">عرض جميع صفقاتك ومعاملاتك</p>
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

  {#if tab === 'orders'}
    <!-- Filter pills -->
    <div class="flex gap-2 flex-wrap">
      {#each [{ k: 'all', l: 'الكل' }, { k: 'filled', l: 'مكتملة' }, { k: 'pending', l: 'معلقة' }, { k: 'cancelled', l: 'ملغاة' }] as f}
        <button
          onclick={() => (filter = f.k as any)}
          class="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors {filter === f.k ? 'bg-accent-gold/15 text-accent-gold' : 'bg-white/[0.03] text-slate-400 hover:bg-white/5'}"
        >
          {f.l}
        </button>
      {/each}
    </div>

    <div class="panel overflow-hidden">
      {#if loading}
        <div class="p-6 space-y-3">
          {#each Array(8) as _}<div class="h-12 rounded-xl bg-white/5 animate-shimmer"></div>{/each}
        </div>
      {:else if filteredOrders.length === 0}
        <div class="py-16 text-center text-slate-500">
          <Clock size={40} class="mx-auto mb-3 opacity-30" />
          <p class="text-sm">لا توجد صفقات</p>
        </div>
      {:else}
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="text-[10px] uppercase tracking-wider text-slate-500 border-b border-white/5">
                <th class="text-right font-medium px-5 py-3">التاريخ</th>
                <th class="text-right font-medium px-5 py-3">الزوج</th>
                <th class="text-right font-medium px-5 py-3">النوع</th>
                <th class="text-right font-medium px-5 py-3">السعر (ج.م)</th>
                <th class="text-right font-medium px-5 py-3">الكمية</th>
                <th class="text-right font-medium px-5 py-3">الإجمالي (ج.م)</th>
                <th class="text-left font-medium px-5 py-3">الحالة</th>
              </tr>
            </thead>
            <tbody>
              {#each filteredOrders as o}
                <tr class="border-b border-white/5 last:border-0 hover:bg-white/[0.02]">
                  <td class="px-5 py-3 text-xs text-slate-400">{formatDate(o.created_at)}</td>
                  <td class="px-5 py-3 font-semibold text-white">{o.symbol}</td>
                  <td class="px-5 py-3">
                    <span class="pill {o.side === 'BUY' ? 'pill-mint' : 'pill-rose'}">
                      {o.side === 'BUY' ? 'شراء' : 'بيع'}
                    </span>
                  </td>
                  <td class="px-5 py-3 font-mono text-slate-300 tabular-nums">{formatEGP(usdToEgp(o.price, currentRate))}</td>
                  <td class="px-5 py-3 font-mono text-slate-300 tabular-nums">{formatPrice(o.quantity, 6)}</td>
                  <td class="px-5 py-3 font-mono text-slate-300 tabular-nums">{egpCompact(usdToEgp(o.price * o.quantity, currentRate))}</td>
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
    <div class="panel overflow-hidden">
      {#if loading}
        <div class="p-6 space-y-3">
          {#each Array(5) as _}<div class="h-12 rounded-xl bg-white/5 animate-shimmer"></div>{/each}
        </div>
      {:else if transactions.length === 0}
        <div class="py-16 text-center text-slate-500">
          <Clock size={40} class="mx-auto mb-3 opacity-30" />
          <p class="text-sm">لا توجد معاملات</p>
        </div>
      {:else}
        <div class="divide-y divide-white/5">
          {#each transactions as tx}
            <div class="flex items-center justify-between px-5 py-4 hover:bg-white/[0.02]">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-full {tx.type === 'DEPOSIT' ? 'bg-accent-mint/10' : 'bg-accent-rose/10'} flex items-center justify-center font-bold text-xs">
                  {tx.currency.slice(0, 2)}
                </div>
                <div>
                  <p class="text-sm font-medium text-white">
                    {tx.type === 'DEPOSIT' ? 'إيداع' : tx.type === 'WITHDRAWAL' ? 'سحب' : tx.type} {tx.currency}
                  </p>
                  <p class="text-xs text-slate-400">{formatDate(tx.created_at)}</p>
                  {#if tx.tx_id}
                    <p class="text-[10px] text-slate-500 font-mono mt-0.5">TX: {tx.tx_id.slice(0, 16)}...</p>
                  {/if}
                </div>
              </div>
              <div class="text-left">
                <p class="text-sm font-mono font-semibold {tx.type === 'DEPOSIT' ? 'text-accent-mint' : 'text-accent-rose'}">
                  {tx.type === 'DEPOSIT' ? '+' : '-'}{formatPrice(tx.amount, 6)} {tx.currency}
                </p>
                {#if tx.currency === 'USDT'}
                  <p class="text-[10px] text-slate-500 mt-0.5 tabular-nums">
                    ≈ {egpCompact(usdToEgp(tx.amount, currentRate))}
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
