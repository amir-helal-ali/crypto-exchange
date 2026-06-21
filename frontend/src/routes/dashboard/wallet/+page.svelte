<script lang="ts">
  import { onMount } from 'svelte';
  import { wallet } from '$lib/api/endpoints';
  import { parseApiResponse } from '$lib/api/client';
  import { formatPrice, formatDate } from '$lib/utils/format';
  import { usdToEgp, egpCompact, egpWithSymbol, formatEGP, usdEgpRate } from '$lib/utils/currency';
  import { marketStore, type MarketTicker } from '$lib/stores/market';
  import NavTabs from '$lib/components/NavTabs.svelte';
  import { ArrowDownToLine, ArrowUpFromLine, Wallet, RefreshCw, ChevronLeft, Plus, Send, Banknote, Clock, Coins } from 'lucide-svelte';

  let balances = $state<any[]>([]);
  let transactions = $state<any[]>([]);
  let loading = $state(true);
  let totalUsd = $state(0);
  let totalEgp = $state(0);
  let currentRate = $state(48.5);
  let tickers = $state<Record<string, MarketTicker>>({});
  let activeTab = $state<'assets' | 'transactions' | 'deposit'>('assets');

  const unsubRate = usdEgpRate.subscribe((r) => (currentRate = r));
  const unsubMarket = marketStore.subscribe((t) => {
    tickers = t;
    recompute();
  });

  onMount(() => {
  (async () => {
    await Promise.all([loadBalances(), loadTransactions()]);
    loading = false
  })();
  return () => {
      unsubRate();
      unsubMarket();
    };
});

  async function loadBalances() {
    try {
      const res = await wallet.getBalances();
      balances = (await parseApiResponse<any[]>(res)) || [];
      recompute();
    } catch {}
  }

  async function loadTransactions() {
    try {
      const res = await wallet.getTransactions({ limit: 30 });
      transactions = (await parseApiResponse<any[]>(res)) || [];
    } catch {}
  }

  function recompute() {
    let sum = 0;
    for (const b of balances) {
      const bal = parseFloat(b.balance);
      if (!isFinite(bal)) continue;
      if (b.currency === 'USDT') {
        sum += bal;
      } else {
        const t = tickers[`${b.currency}USDT`];
        if (t) sum += bal * t.price;
      }
    }
    totalUsd = sum;
    totalEgp = usdToEgp(sum, currentRate);
  }

  function getBalanceUsd(b: any): number {
    const bal = parseFloat(b.balance);
    if (b.currency === 'USDT') return bal;
    const t = tickers[`${b.currency}USDT`];
    return t ? bal * t.price : 0;
  }

  function refresh() {
    loading = true;
    Promise.all([loadBalances(), loadTransactions()]).finally(() => (loading = false));
  }
</script>

<svelte:head><title>المحفظة — NEXUS</title></svelte:head>

<div class="space-y-5">
  <div class="flex items-center justify-between">
    <div>
      <h1 class="text-2xl sm:text-3xl font-bold text-white">المحفظة</h1>
      <p class="text-sm text-slate-400 mt-1">إدارة أرصدتك ومعاملاتك</p>
    </div>
    <button onclick={refresh} class="btn-ghost {loading ? 'animate-spin' : ''}" aria-label="تحديث">
      <RefreshCw size={16} />
    </button>
  </div>

  <!-- Total balance — EGP primary -->
  <div class="panel-glow p-6 sm:p-8 relative overflow-hidden">
    <div class="absolute inset-0 opacity-30 pointer-events-none" aria-hidden="true">
      <div class="absolute -top-12 -right-12 w-48 h-48 bg-accent-gold/20 blur-3xl rounded-full"></div>
      <div class="absolute -bottom-12 -left-12 w-48 h-48 bg-accent-mint/15 blur-3xl rounded-full"></div>
    </div>

    <div class="relative flex items-center justify-between flex-wrap gap-4">
      <div>
        <div class="flex items-center gap-2 mb-1">
          <span class="text-xs text-slate-400 uppercase tracking-wider">إجمالي القيمة</span>
          <span class="pill-gold text-[10px]">ج.م</span>
        </div>
        <p class="text-4xl font-bold text-gold-gradient tabular-nums leading-none">
          {formatEGP(totalEgp)}
        </p>
        <p class="text-xs text-slate-500 mt-2 tabular-nums">
          <span class="text-slate-600">≈</span> ${formatPrice(totalUsd)} USD
        </p>
      </div>
      <div class="flex gap-2">
        <a href="/dashboard/wallet/deposit/USDT" class="btn-buy">
          <ArrowDownToLine size={16} /> إيداع
        </a>
        <a href="/dashboard/wallet/withdraw/USDT" class="btn-sell">
          <ArrowUpFromLine size={16} /> سحب
        </a>
      </div>
    </div>
  </div>

  <!-- Nav tabs -->
  <NavTabs
    value={activeTab}
    onchange={(key) => (activeTab = key as any)}
    items={[
      { key: 'assets', label: 'الأرصدة', icon: Wallet, count: balances.length },
      { key: 'transactions', label: 'المعاملات', icon: Clock, count: transactions.length },
      { key: 'deposit', label: 'إيداع / سحب', icon: Banknote }
    ]}
  />

  {#if activeTab === 'assets'}
    <!-- Balances grid -->
    <div class="panel overflow-hidden">
      <div class="px-5 py-4 border-b border-white/5 flex items-center justify-between">
        <h3 class="text-sm font-bold text-white">أرصدتي</h3>
        <span class="text-xs text-slate-500">{balances.length} عملة</span>
      </div>
      {#if loading}
        <div class="p-6 space-y-3">
          {#each Array(5) as _}<div class="h-14 rounded-xl bg-white/5 animate-shimmer"></div>{/each}
        </div>
      {:else if balances.length === 0}
        <div class="py-16 text-center text-slate-500">
          <Wallet size={40} class="mx-auto mb-3 opacity-30" />
          <p class="text-sm">لا توجد أرصدة. ابدأ بإيداع العملات.</p>
          <a href="/dashboard/wallet/deposit/USDT" class="inline-block mt-3 text-xs text-accent-gold hover:underline">
            إيداع الآن ←
          </a>
        </div>
      {:else}
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="text-[10px] uppercase tracking-wider text-slate-500 border-b border-white/5">
                <th class="text-right font-medium px-5 py-2.5">العملة</th>
                <th class="text-right font-medium px-5 py-2.5">الرصيد المتاح</th>
                <th class="text-left font-medium px-5 py-2.5">القيمة (ج.م)</th>
                <th class="text-left font-medium px-5 py-2.5">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {#each balances as b}
                <tr class="border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors">
                  <td class="px-5 py-3">
                    <div class="flex items-center gap-2.5">
                      <div class="w-9 h-9 rounded-full bg-gradient-to-br from-accent-gold/30 to-accent-violet/30 border border-white/10 flex items-center justify-center text-[11px] font-bold text-white">
                        {b.currency.slice(0, 2)}
                      </div>
                      <span class="font-semibold text-white">{b.currency}</span>
                    </div>
                  </td>
                  <td class="px-5 py-3 font-mono text-slate-200 tabular-nums">{formatPrice(b.balance, 6)}</td>
                  <td class="px-5 py-3 font-mono text-left tabular-nums text-slate-300">
                    {egpWithSymbol(usdToEgp(getBalanceUsd(b), currentRate))}
                  </td>
                  <td class="px-5 py-3 text-left">
                    <div class="flex items-center gap-1 justify-end">
                      <a
                        href="/dashboard/wallet/deposit/{b.currency}"
                        class="p-1.5 rounded-lg text-accent-mint hover:bg-accent-mint/10"
                        aria-label="إيداع"
                      >
                        <ArrowDownToLine size={14} />
                      </a>
                      <a
                        href="/dashboard/wallet/withdraw/{b.currency}"
                        class="p-1.5 rounded-lg text-accent-rose hover:bg-accent-rose/10"
                        aria-label="سحب"
                      >
                        <ArrowUpFromLine size={14} />
                      </a>
                    </div>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </div>
  {:else if activeTab === 'transactions'}
    <!-- Transactions list -->
    <div class="panel overflow-hidden">
      <div class="flex items-center justify-between px-5 py-4 border-b border-white/5">
        <h3 class="text-sm font-bold text-white">آخر المعاملات</h3>
        <a href="/dashboard/history" class="text-xs text-accent-gold hover:underline flex items-center gap-1">
          عرض الكل <ChevronLeft size={12} />
        </a>
      </div>
      {#if transactions.length === 0}
        <div class="py-10 text-center text-slate-500 text-sm">لا توجد معاملات بعد</div>
      {:else}
        <div class="divide-y divide-white/5">
          {#each transactions as tx}
            <div class="flex items-center justify-between px-5 py-3 hover:bg-white/[0.02]">
              <div class="flex items-center gap-3">
                <div class="w-9 h-9 rounded-full {tx.type === 'DEPOSIT' ? 'bg-accent-mint/10' : 'bg-accent-rose/10'} flex items-center justify-center">
                  {#if tx.type === 'DEPOSIT'}
                    <ArrowDownToLine size={14} class="text-accent-mint" />
                  {:else}
                    <ArrowUpFromLine size={14} class="text-accent-rose" />
                  {/if}
                </div>
                <div>
                  <p class="text-sm font-medium text-white">
                    {tx.type === 'DEPOSIT' ? 'إيداع' : tx.type === 'WITHDRAWAL' ? 'سحب' : tx.type}
                  </p>
                  <p class="text-xs text-slate-400">{formatDate(tx.created_at)}</p>
                </div>
              </div>
              <div class="text-left">
                <p class="text-sm font-mono font-semibold {tx.type === 'DEPOSIT' ? 'text-accent-mint' : 'text-accent-rose'}">
                  {tx.type === 'DEPOSIT' ? '+' : '-'}{formatPrice(tx.amount, 6)} {tx.currency}
                </p>
                <span class="pill {tx.status === 'COMPLETED' || tx.status === 'APPROVED' ? 'pill-mint' : tx.status === 'PENDING' ? 'pill-gold' : 'pill-rose'} text-[10px]">
                  {tx.status === 'COMPLETED' || tx.status === 'APPROVED' ? 'مكتمل' : tx.status === 'PENDING' ? 'معلق' : tx.status}
                </span>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  {:else if activeTab === 'deposit'}
    <!-- Quick deposit / withdraw shortcuts -->
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <a
        href="/dashboard/wallet/deposit/USDT"
        class="panel p-6 hover:border-accent-mint/40 transition-all group"
      >
        <div class="w-12 h-12 rounded-xl bg-accent-mint/15 border border-accent-mint/25 flex items-center justify-center mb-4">
          <ArrowDownToLine size={22} class="text-accent-mint" />
        </div>
        <h3 class="text-base font-bold text-white mb-1">إيداع عملة</h3>
        <p class="text-xs text-slate-400 leading-relaxed">
          أودع USDT أو أي عملة مدعومة في محفظتك. سيتم اعتماد الإيداع بعد تأكيدات الشبكة.
        </p>
        <div class="mt-3 text-xs text-accent-mint font-medium flex items-center gap-1">
          ابدأ الإيداع
          <ChevronLeft size={12} class="group-hover:-translate-x-1 transition-transform" />
        </div>
      </a>

      <a
        href="/dashboard/wallet/withdraw/USDT"
        class="panel p-6 hover:border-accent-rose/40 transition-all group"
      >
        <div class="w-12 h-12 rounded-xl bg-accent-rose/15 border border-accent-rose/25 flex items-center justify-center mb-4">
          <ArrowUpFromLine size={22} class="text-accent-rose" />
        </div>
        <h3 class="text-base font-bold text-white mb-1">سحب رصيد</h3>
        <p class="text-xs text-slate-400 leading-relaxed">
          اسحب أرصدتك إلى محفظتك الخارجية. يتم تطبيق رسوم شبكة البلوكتشين فقط دون أي رسوم إضافية.
        </p>
        <div class="mt-3 text-xs text-accent-rose font-medium flex items-center gap-1">
          ابدأ السحب
          <ChevronLeft size={12} class="group-hover:-translate-x-1 transition-transform" />
        </div>
      </a>
    </div>

    <!-- Tip -->
    <div class="panel p-5 bg-accent-gold/5 border-accent-gold/20">
      <div class="flex items-start gap-3">
        <div class="w-9 h-9 rounded-lg bg-accent-gold/15 flex items-center justify-center shrink-0">
          <Coins size={16} class="text-accent-gold" />
        </div>
        <div>
          <p class="text-sm font-bold text-white mb-1">العملة الأساسية في المنصة: الجنيه المصري (ج.م)</p>
          <p class="text-xs text-slate-400 leading-relaxed">
            جميع القيم والإجماليات تُحسب بالجنيه المصري أولاً، مع عرض القيمة المكافئة بالدولار الأمريكي كمرجع.
            سعر الصرف المستخدم: 1 USD ≈ {currentRate.toFixed(2)} ج.م.
          </p>
        </div>
      </div>
    </div>
  {/if}
</div>
