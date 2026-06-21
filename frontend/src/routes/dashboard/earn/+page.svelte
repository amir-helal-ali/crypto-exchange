<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { wallet as walletApi } from '$lib/api/endpoints';
  import { parseApiResponse } from '$lib/api/client';
  import { marketStore, type MarketTicker } from '$lib/stores/market';
  import { toasts } from '$lib/stores/toast';
  import { usdToEgp, egpCompact, usdEgpRate } from '$lib/utils/currency';
  import Modal from '$lib/components/Modal.svelte';
  import {
    TrendingUp,
    Lock,
    Unlock,
    Coins,
    Calculator,
    Clock,
    Award,
    Info,
    Zap,
    Sparkles,
    ChevronLeft,
    Loader2,
    Flame,
    Gift,
    Star
  } from 'lucide-svelte';

  // Live tickers from marketStore
  let tickers = $state<Record<string, MarketTicker>>({});
  let unsubMarket: (() => void) | null = null;

  interface StakingPool {
    id: string;
    asset: string;
    name: string;
    logo: string;
    color: string;
    aprFlexible: number;
    apr30: number;
    apr90: number;
    apr180: number;
    minStake: number;
    tvlUsd: number;
    popular?: boolean;
    hot?: boolean;
  }

  interface UserPosition {
    id: string;
    pool: StakingPool;
    amount: number;
    duration: 'flexible' | 30 | 90 | 180;
    apr: number;
    startDate: string;
    endDate: string | null;
    rewardsEarned: number;
    status: 'active' | 'withdrawn' | 'locked';
  }

  let currentRate = $state(48.5);
  let balances = $state<Record<string, number>>({});
  let positions = $state<UserPosition[]>([]);
  let pools = $state<StakingPool[]>([
    { id: 'btc', asset: 'BTC', name: 'Bitcoin', logo: '₿', color: '#f7931a', aprFlexible: 2.5, apr30: 4.2, apr90: 6.8, apr180: 9.5, minStake: 0.001, tvlUsd: 78_500_000, popular: true },
    { id: 'eth', asset: 'ETH', name: 'Ethereum', logo: 'Ξ', color: '#627eea', aprFlexible: 3.2, apr30: 5.5, apr90: 8.1, apr180: 12.0, minStake: 0.01, tvlUsd: 28_900_000, hot: true },
    { id: 'sol', asset: 'SOL', name: 'Solana', logo: '◎', color: '#9945ff', aprFlexible: 5.0, apr30: 8.0, apr90: 11.5, apr180: 16.0, minStake: 0.5, tvlUsd: 22_300_000 },
    { id: 'bnb', asset: 'BNB', name: 'BNB', logo: '⬡', color: '#f0b90b', aprFlexible: 4.1, apr30: 6.8, apr90: 10.2, apr180: 14.5, minStake: 0.1, tvlUsd: 51_200_000 },
    { id: 'usdt', asset: 'USDT', name: 'Tether', logo: '$', color: '#26a17b', aprFlexible: 8.5, apr30: 12.0, apr90: 15.5, apr180: 19.0, minStake: 10, tvlUsd: 12_500_000, popular: true },
    { id: 'avax', asset: 'AVAX', name: 'Avalanche', logo: '▲', color: '#e84142', aprFlexible: 4.5, apr30: 7.2, apr90: 10.8, apr180: 15.0, minStake: 1, tvlUsd: 9_800_000 },
    { id: 'ada', asset: 'ADA', name: 'Cardano', logo: '₳', color: '#0033ad', aprFlexible: 4.0, apr30: 6.5, apr90: 9.8, apr180: 13.5, minStake: 10, tvlUsd: 2_100_000 },
    { id: 'dot', asset: 'DOT', name: 'Polkadot', logo: '●', color: '#e6007a', aprFlexible: 6.5, apr30: 9.5, apr90: 13.5, apr180: 18.0, minStake: 5, tvlUsd: 5_400_000 }
  ]);

  let stakingModal = $state<{ open: boolean; pool: StakingPool | null }>({ open: false, pool: null });
  let stakeAmount = $state('');
  let stakeDuration = $state<'flexible' | 30 | 90 | 180>('flexible');
  let staking = $state(false);

  let calcAsset = $state('ETH');
  let calcAmount = $state(1);
  let calcDuration = $state<'flexible' | 30 | 90 | 180>(90);
  let sortBy = $state<'popular' | 'apr' | 'tvl'>('popular');

  const unsubRate = usdEgpRate.subscribe((r) => (currentRate = r));

  let rewardsTick = $state(0);
  let tickInterval: any;

  onMount(async () => {
    unsubMarket = marketStore.subscribe((t) => (tickers = t));
    await Promise.all([loadBalances(), loadPositions()]);
    tickInterval = setInterval(() => { rewardsTick += 0.0001; }, 1500);
  });

  onDestroy(() => {
    unsubRate();
    clearInterval(tickInterval);
    unsubMarket?.();
  });

  async function loadBalances() {
    try {
      const res = await walletApi.getBalances();
      const data = (await parseApiResponse<any[]>(res)) || [];
      const map: Record<string, number> = {};
      for (const b of data) map[b.currency] = parseFloat(b.balance);
      balances = map;
    } catch {}
  }

  async function loadPositions() {
    positions = [
      {
        id: '1', pool: pools[1], amount: 0.5, duration: 90, apr: 8.1,
        startDate: new Date(Date.now() - 30 * 86400000).toISOString(),
        endDate: new Date(Date.now() + 60 * 86400000).toISOString(),
        rewardsEarned: 0.033, status: 'locked'
      },
      {
        id: '2', pool: pools[4], amount: 1000, duration: 'flexible' as const, apr: 8.5,
        startDate: new Date(Date.now() - 15 * 86400000).toISOString(),
        endDate: null, rewardsEarned: 3.5, status: 'active'
      }
    ];
  }

  function getAssetPrice(asset: string): number {
    if (asset === 'USDT') return 1;
    const ticker = tickers[`${asset}USDT`];
    return ticker?.price || 0;
  }

  function getApr(pool: StakingPool, duration: 'flexible' | 30 | 90 | 180): number {
    if (duration === 'flexible') return pool.aprFlexible;
    if (duration === 30) return pool.apr30;
    if (duration === 90) return pool.apr90;
    return pool.apr180;
  }

  function formatNumber(n: number, decimals = 4): string {
    if (!isFinite(n)) n = 0;
    return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: decimals });
  }

  function timeRemaining(endDate: string | null): string {
    if (!endDate) return 'مرن';
    const days = Math.ceil((new Date(endDate).getTime() - Date.now()) / 86400000);
    if (days <= 0) return 'انتهت المدة';
    return `${days} يوم`;
  }

  const totalStakedUsd = $derived(
    positions.reduce((sum, p) => sum + p.amount * getAssetPrice(p.pool.asset), 0)
  );
  const totalStakedEgp = $derived(usdToEgp(totalStakedUsd, currentRate));
  const totalRewardsUsd = $derived(
    positions.reduce((sum, p) => sum + p.rewardsEarned * getAssetPrice(p.pool.asset), 0)
  );
  const totalRewardsEgp = $derived(usdToEgp(totalRewardsUsd, currentRate));
  const activePositionsCount = $derived(positions.filter((p) => p.status !== 'withdrawn').length);
  const dailyRewardsUsd = $derived(
    positions.reduce((sum, p) => {
      const yearly = (p.amount * p.apr) / 100;
      return sum + (yearly / 365) * getAssetPrice(p.pool.asset);
    }, 0)
  );

  const calcPool = $derived(pools.find((p) => p.asset === calcAsset) || pools[0]);
  const calcApr = $derived(getApr(calcPool, calcDuration));
  const calcYearlyReward = $derived((calcAmount * calcApr) / 100);
  const calcDailyReward = $derived(calcYearlyReward / 365);
  const calcMonthlyReward = $derived(calcYearlyReward / 12);
  const calcDurationLabel = $derived(calcDuration === 'flexible' ? 'مرن' : `${calcDuration} يوم`);

  const sortedPools = $derived.by(() => {
    const arr = [...pools];
    if (sortBy === 'apr') arr.sort((a, b) => getApr(b, 90) - getApr(a, 90));
    else if (sortBy === 'tvl') arr.sort((a, b) => b.tvlUsd - a.tvlUsd);
    else arr.sort((a, b) => (b.popular ? 1 : 0) - (a.popular ? 1 : 0) || b.tvlUsd - a.tvlUsd);
    return arr;
  });

  function openStakeModal(pool: StakingPool) {
    stakingModal = { open: true, pool };
    stakeAmount = '';
    stakeDuration = 'flexible';
  }

  function closeStakeModal() {
    stakingModal = { open: false, pool: null };
  }

  function setMaxAmount() {
    if (!stakingModal.pool) return;
    stakeAmount = String(balances[stakingModal.pool.asset] || 0);
  }

  async function confirmStake() {
    if (!stakingModal.pool) return;
    const amount = parseFloat(stakeAmount);
    if (!isFinite(amount) || amount <= 0) { toasts.error('أدخل مبلغاً صحيحاً'); return; }
    if (amount < stakingModal.pool.minStake) {
      toasts.error(`الحد الأدنى لل staking هو ${stakingModal.pool.minStake} ${stakingModal.pool.asset}`); return;
    }
    const bal = balances[stakingModal.pool.asset] || 0;
    if (amount > bal) { toasts.error(`لا يوجد رصيد كافٍ من ${stakingModal.pool.asset}`); return; }
    staking = true;
    try {
      await new Promise((r) => setTimeout(r, 1200));
      const newPosition: UserPosition = {
        id: Date.now().toString(),
        pool: stakingModal.pool,
        amount,
        duration: stakeDuration,
        apr: getApr(stakingModal.pool, stakeDuration),
        startDate: new Date().toISOString(),
        endDate: stakeDuration === 'flexible' ? null : new Date(Date.now() + stakeDuration * 86400000).toISOString(),
        rewardsEarned: 0,
        status: stakeDuration === 'flexible' ? 'active' : 'locked'
      };
      positions = [newPosition, ...positions];
      balances[stakingModal.pool.asset] -= amount;
      toasts.success(`تم staking ${amount} ${stakingModal.pool.asset} بنجاح`);
      closeStakeModal();
    } catch (e: any) {
      toasts.error(e?.message || 'فشل في عملية ال staking');
    } finally {
      staking = false;
    }
  }

  async function unstake(position: UserPosition) {
    if (position.status === 'locked' && position.endDate) {
      const days = Math.ceil((new Date(position.endDate).getTime() - Date.now()) / 86400000);
      if (days > 0) { toasts.error(`لا يمكن السحب قبل انتهاء فترة القفل (${days} يوم متبقي)`); return; }
    }
    try {
      balances[position.pool.asset] = (balances[position.pool.asset] || 0) + position.amount + position.rewardsEarned;
      positions = positions.map((p) => (p.id === position.id ? { ...p, status: 'withdrawn' as const } : p));
      toasts.success(`تم سحب ${position.amount} ${position.pool.asset} + ${position.rewardsEarned.toFixed(4)} مكافآت`);
    } catch {
      toasts.error('فشل في السحب');
    }
  }
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && closeStakeModal()} />

<div class="space-y-6">
  <!-- Header -->
  <div class="flex flex-wrap items-center justify-between gap-4">
    <div class="flex items-center gap-3">
      <div class="w-11 h-11 rounded-2xl bg-gradient-to-br from-accent-gold to-accent-violet flex items-center justify-center">
        <Sparkles size={22} class="text-ink-950" />
      </div>
      <div>
        <h1 class="text-2xl font-bold text-white">Earn & Staking</h1>
        <p class="text-sm text-slate-400">اجعل عملاتك تعمل من أجلك — اربح حتى 19% سنوياً</p>
      </div>
    </div>
    <div class="flex items-center gap-2 text-xs">
      <div class="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
        <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
        مكافآت تُحتسب كل ساعة
      </div>
    </div>
  </div>

  <!-- Hero Stats -->
  <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
    <div class="panel p-5 relative overflow-hidden">
      <div class="absolute inset-0 bg-gradient-to-br from-accent-gold/5 to-transparent"></div>
      <div class="relative">
        <div class="flex items-center justify-between mb-3">
          <div class="w-9 h-9 rounded-lg bg-accent-gold/15 flex items-center justify-center">
            <Lock size={16} class="text-accent-gold" />
          </div>
          <span class="text-[10px] text-slate-500 uppercase tracking-wider">Total Staked</span>
        </div>
        <p class="text-xl font-bold text-white font-mono tabular-nums">{egpCompact(totalStakedEgp)}</p>
        <p class="text-xs text-slate-400 mt-1">${totalStakedUsd.toLocaleString('en-US', { maximumFractionDigits: 2 })} USD</p>
      </div>
    </div>

    <div class="panel p-5 relative overflow-hidden">
      <div class="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent"></div>
      <div class="relative">
        <div class="flex items-center justify-between mb-3">
          <div class="w-9 h-9 rounded-lg bg-emerald-500/15 flex items-center justify-center">
            <Gift size={16} class="text-emerald-400" />
          </div>
          <span class="text-[10px] text-slate-500 uppercase tracking-wider">Rewards</span>
        </div>
        <p class="text-xl font-bold text-emerald-400 font-mono tabular-nums">
          {egpCompact(totalRewardsEgp + rewardsTick)}
        </p>
        <p class="text-xs text-slate-400 mt-1">${totalRewardsUsd.toFixed(2)} USD</p>
      </div>
    </div>

    <div class="panel p-5 relative overflow-hidden">
      <div class="absolute inset-0 bg-gradient-to-br from-accent-violet/5 to-transparent"></div>
      <div class="relative">
        <div class="flex items-center justify-between mb-3">
          <div class="w-9 h-9 rounded-lg bg-accent-violet/15 flex items-center justify-center">
            <TrendingUp size={16} class="text-accent-violet" />
          </div>
          <span class="text-[10px] text-slate-500 uppercase tracking-wider">Daily Income</span>
        </div>
        <p class="text-xl font-bold text-white font-mono tabular-nums">
          {egpCompact(usdToEgp(dailyRewardsUsd, currentRate))}
        </p>
        <p class="text-xs text-emerald-400 mt-1">≈ ${dailyRewardsUsd.toFixed(4)}/يوم</p>
      </div>
    </div>

    <div class="panel p-5 relative overflow-hidden">
      <div class="absolute inset-0 bg-gradient-to-br from-accent-rose/5 to-transparent"></div>
      <div class="relative">
        <div class="flex items-center justify-between mb-3">
          <div class="w-9 h-9 rounded-lg bg-accent-rose/15 flex items-center justify-center">
            <Zap size={16} class="text-accent-rose" />
          </div>
          <span class="text-[10px] text-slate-500 uppercase tracking-wider">Positions</span>
        </div>
        <p class="text-xl font-bold text-white font-mono tabular-nums">{activePositionsCount}</p>
        <p class="text-xs text-slate-400 mt-1">مراكز نشطة</p>
      </div>
    </div>
  </div>

  <!-- Calculator + My Positions -->
  <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
    <div class="panel p-6 lg:col-span-2">
      <div class="flex items-center gap-2 mb-5">
        <Calculator size={18} class="text-accent-gold" />
        <h2 class="text-base font-bold text-white">حاسبة المكافآت</h2>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div>
          <label class="block text-xs text-slate-400 mb-2">العملة</label>
          <select bind:value={calcAsset} class="input w-full bg-ink-900/60">
            {#each pools as p}
              <option value={p.asset}>{p.asset} — {p.name}</option>
            {/each}
          </select>
        </div>
        <div>
          <label class="block text-xs text-slate-400 mb-2">المبلغ</label>
          <input type="number" bind:value={calcAmount} min="0" step="0.01" class="input w-full bg-ink-900/60 font-mono" />
        </div>
        <div>
          <label class="block text-xs text-slate-400 mb-2">مدة القفل</label>
          <div class="flex gap-1">
            {#each [['flexible', 'مرن'], [30, '30ي'], [90, '90ي'], [180, '180ي']] as [val, label]}
              <button
                onclick={() => (calcDuration = val as any)}
                class="flex-1 py-2 px-1 text-xs rounded-lg transition-all {calcDuration === val
                  ? 'bg-accent-gold/20 text-accent-gold border border-accent-gold/40 font-bold'
                  : 'bg-ink-900/40 text-slate-400 border border-white/5 hover:border-white/10'}"
              >
                {label}
              </button>
            {/each}
          </div>
        </div>
      </div>

      <div class="bg-gradient-to-br from-accent-gold/10 to-accent-violet/5 rounded-2xl p-5 border border-accent-gold/15">
        <div class="grid grid-cols-3 gap-4">
          <div class="text-center">
            <p class="text-[10px] text-slate-400 uppercase tracking-wider mb-1">العائد اليومي</p>
            <p class="text-lg font-bold text-emerald-400 font-mono tabular-nums">{calcDailyReward.toFixed(6)}</p>
            <p class="text-[10px] text-slate-500">{calcAsset}</p>
          </div>
          <div class="text-center border-x border-white/5">
            <p class="text-[10px] text-slate-400 uppercase tracking-wider mb-1">العائد الشهري</p>
            <p class="text-lg font-bold text-emerald-400 font-mono tabular-nums">{calcMonthlyReward.toFixed(6)}</p>
            <p class="text-[10px] text-slate-500">{calcAsset}</p>
          </div>
          <div class="text-center">
            <p class="text-[10px] text-slate-400 uppercase tracking-wider mb-1">العائد السنوي</p>
            <p class="text-lg font-bold text-accent-gold font-mono tabular-nums">{calcYearlyReward.toFixed(6)}</p>
            <p class="text-[10px] text-slate-500">{calcAsset}</p>
          </div>
        </div>

        <div class="mt-4 pt-4 border-t border-white/5 flex items-center justify-between">
          <div class="flex items-center gap-2 text-xs text-slate-400">
            <Info size={12} />
            <span>APR: <span class="text-accent-gold font-bold">{calcApr}%</span> • المدة: <span class="text-white">{calcDurationLabel}</span></span>
          </div>
          <p class="text-sm text-white font-mono tabular-nums">
            ≈ {egpCompact(usdToEgp(calcYearlyReward * getAssetPrice(calcAsset), currentRate))} / سنة
          </p>
        </div>
      </div>
    </div>

    <div class="panel p-5">
      <div class="flex items-center justify-between mb-4">
        <div class="flex items-center gap-2">
          <Award size={16} class="text-accent-violet" />
          <h2 class="text-sm font-bold text-white">مراكزي</h2>
        </div>
        <span class="text-xs text-slate-400">{activePositionsCount} نشط</span>
      </div>

      <div class="space-y-3 max-h-[340px] overflow-y-auto pr-1">
        {#if positions.filter((p) => p.status !== 'withdrawn').length === 0}
          <div class="py-12 text-center">
            <Lock size={32} class="mx-auto mb-2 text-slate-600" />
            <p class="text-sm text-slate-400 mb-3">لا توجد مراكز staking نشطة</p>
            <p class="text-xs text-slate-500">اختر pool من الأسفل للبدء</p>
          </div>
        {:else}
          {#each positions.filter((p) => p.status !== 'withdrawn') as pos}
            <div class="bg-ink-900/40 rounded-xl p-3 border border-white/5 hover:border-white/10 transition-colors">
              <div class="flex items-center justify-between mb-2">
                <div class="flex items-center gap-2">
                  <div
                    class="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                    style="background-color: {pos.pool.color}20; color: {pos.pool.color}"
                  >
                    {pos.pool.logo}
                  </div>
                  <div>
                    <p class="text-sm font-semibold text-white">{pos.pool.asset}</p>
                    <p class="text-[10px] text-slate-500">{pos.apr}% APR • {pos.duration === 'flexible' ? 'مرن' : pos.duration + 'ي'}</p>
                  </div>
                </div>
                {#if pos.status === 'locked'}
                  <Lock size={12} class="text-amber-400" />
                {:else}
                  <Unlock size={12} class="text-emerald-400" />
                {/if}
              </div>
              <div class="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <p class="text-slate-500">المبلغ</p>
                  <p class="text-white font-mono">{formatNumber(pos.amount)}</p>
                </div>
                <div>
                  <p class="text-slate-500">المكافآت</p>
                  <p class="text-emerald-400 font-mono">{formatNumber(pos.rewardsEarned)}</p>
                </div>
              </div>
              <div class="mt-2 pt-2 border-t border-white/5 flex items-center justify-between">
                <span class="text-[10px] text-slate-500 flex items-center gap-1">
                  <Clock size={10} />
                  {timeRemaining(pos.endDate)}
                </span>
                <button
                  onclick={() => unstake(pos)}
                  class="text-[11px] text-accent-rose hover:underline"
                >
                  {pos.status === 'locked' ? 'عرض' : 'سحب'}
                </button>
              </div>
            </div>
          {/each}
        {/if}
      </div>
    </div>
  </div>

  <!-- Pools -->
  <div class="panel p-6">
    <div class="flex flex-wrap items-center justify-between gap-3 mb-5">
      <div>
        <h2 class="text-base font-bold text-white">Staking Pools</h2>
        <p class="text-xs text-slate-400 mt-0.5">اختر عملتك المفضلة وابدأ بكسب المكافآت</p>
      </div>
      <div class="flex items-center gap-1 bg-ink-900/50 rounded-lg p-1">
        {#each [['popular', 'الأكثر شعبية'], ['apr', 'أعلى APR'], ['tvl', 'أعلى TVL']] as [val, label]}
          <button
            onclick={() => (sortBy = val as any)}
            class="px-3 py-1.5 text-xs rounded-md transition-all {sortBy === val
              ? 'bg-accent-gold/20 text-accent-gold font-semibold'
              : 'text-slate-400 hover:text-white'}"
          >
            {label}
          </button>
        {/each}
      </div>
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {#each sortedPools as pool (pool.id)}
        {@const apr90 = getApr(pool, 90)}
        {@const bal = balances[pool.asset] || 0}
        <div class="relative bg-ink-900/40 rounded-2xl p-4 border border-white/5 hover:border-accent-gold/30 transition-all group">
          {#if pool.hot}
            <div class="absolute top-3 left-3 flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent-rose/15 text-accent-rose text-[9px] font-bold">
              <Flame size={9} /> HOT
            </div>
          {/if}
          {#if pool.popular}
            <div class="absolute top-3 left-3 {pool.hot ? 'top-7' : ''} flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent-gold/15 text-accent-gold text-[9px] font-bold">
              <Star size={9} /> POPULAR
            </div>
          {/if}

          <div class="flex items-center gap-2 mb-4 mt-5">
            <div
              class="w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold"
              style="background-color: {pool.color}20; color: {pool.color}"
            >
              {pool.logo}
            </div>
            <div>
              <p class="text-sm font-bold text-white">{pool.asset}</p>
              <p class="text-[10px] text-slate-500">{pool.name}</p>
            </div>
          </div>

          <div class="mb-3">
            <p class="text-[10px] text-slate-400 uppercase tracking-wider">APR (90 يوم)</p>
            <div class="flex items-baseline gap-1">
              <span class="text-2xl font-bold bg-gradient-to-r from-accent-gold to-accent-rose bg-clip-text text-transparent">
                {apr90}%
              </span>
              <span class="text-[10px] text-slate-500">/ سنوياً</span>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-1 text-[10px] mb-3">
            <div class="flex justify-between bg-white/3 rounded px-2 py-1">
              <span class="text-slate-500">مرن</span>
              <span class="text-slate-300 font-mono">{pool.aprFlexible}%</span>
            </div>
            <div class="flex justify-between bg-white/3 rounded px-2 py-1">
              <span class="text-slate-500">180ي</span>
              <span class="text-slate-300 font-mono">{pool.apr180}%</span>
            </div>
          </div>

          <div class="space-y-1 text-[10px] text-slate-500 mb-4">
            <div class="flex justify-between">
              <span>الحد الأدنى</span>
              <span class="text-slate-300 font-mono">{pool.minStake} {pool.asset}</span>
            </div>
            <div class="flex justify-between">
              <span>TVL</span>
              <span class="text-slate-300 font-mono">${(pool.tvlUsd / 1e6).toFixed(1)}M</span>
            </div>
            <div class="flex justify-between">
              <span>رصيدك</span>
              <span class="{bal > 0 ? 'text-emerald-400' : 'text-slate-600'} font-mono">{formatNumber(bal)} {pool.asset}</span>
            </div>
          </div>

          <button
            onclick={() => openStakeModal(pool)}
            disabled={bal <= 0}
            class="w-full py-2 rounded-lg text-sm font-semibold transition-all {bal > 0
              ? 'bg-gradient-to-r from-accent-gold to-accent-violet text-ink-950 hover:opacity-90'
              : 'bg-white/5 text-slate-500 cursor-not-allowed'}"
          >
            {bal > 0 ? 'Stake الآن' : 'لا يوجد رصيد'}
          </button>
        </div>
      {/each}
    </div>
  </div>

  <!-- How it works -->
  <div class="panel p-6">
    <div class="flex items-center gap-2 mb-5">
      <Info size={16} class="text-accent-gold" />
      <h2 class="text-base font-bold text-white">كيف يعمل ال Staking؟</h2>
    </div>
    <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
      {#each [
        { num: '01', icon: Coins, title: 'اختر العملة', desc: 'تصفح ال pools واختر العملة التي تريد staking بها' },
        { num: '02', icon: Lock, title: 'حدد المدة', desc: 'اختر مدة مرنة أو مقفولة لمدة 30/90/180 يوم' },
        { num: '03', icon: TrendingUp, title: 'اربح المكافآت', desc: 'تُحسب المكافآت يومياً وتُضاف تلقائياً إلى رصيدك' },
        { num: '04', icon: Unlock, title: 'اسحب أرباحك', desc: 'في المدة المرنة اسحب في أي وقت، أو بعد انتهاء فترة القفل' }
      ] as step}
        <div class="relative bg-ink-900/30 rounded-xl p-4 border border-white/5">
          <div class="absolute top-3 left-3 text-3xl font-black text-white/5">{step.num}</div>
          <div class="relative">
            <div class="w-10 h-10 rounded-xl bg-accent-gold/10 flex items-center justify-center mb-3">
              <step.icon size={18} class="text-accent-gold" />
            </div>
            <p class="text-sm font-bold text-white mb-1">{step.title}</p>
            <p class="text-xs text-slate-400 leading-relaxed">{step.desc}</p>
          </div>
        </div>
      {/each}
    </div>
  </div>
</div>

<!-- Staking Modal -->
{#if stakingModal.open && stakingModal.pool}
  {@const pool = stakingModal.pool}
  {@const bal = balances[pool.asset] || 0}
  {@const amount = parseFloat(stakeAmount) || 0}
  {@const apr = getApr(pool, stakeDuration)}
  {@const yearlyReward = (amount * apr) / 100}
  <Modal onClose={closeStakeModal}>
    <div class="p-6 w-[440px] max-w-full">
      <div class="flex items-center justify-between mb-5">
        <div class="flex items-center gap-3">
          <div
            class="w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold"
            style="background-color: {pool.color}20; color: {pool.color}"
          >
            {pool.logo}
          </div>
          <div>
            <h3 class="text-base font-bold text-white">Stake {pool.asset}</h3>
            <p class="text-xs text-slate-400">{pool.name}</p>
          </div>
        </div>
        <button onclick={closeStakeModal} class="text-slate-400 hover:text-white p-1">
          <ChevronLeft size={20} />
        </button>
      </div>

      <div class="mb-4">
        <div class="flex items-center justify-between mb-2">
          <label class="text-xs text-slate-400">المبلغ</label>
          <button onclick={setMaxAmount} class="text-[10px] text-accent-gold hover:underline">
            الحد الأقصى: {formatNumber(bal)} {pool.asset}
          </button>
        </div>
        <div class="relative">
          <input
            type="number"
            bind:value={stakeAmount}
            placeholder="0.00"
            min={pool.minStake}
            step="0.0001"
            class="input w-full bg-ink-900/60 text-lg font-mono pr-16"
          />
          <span class="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">
            {pool.asset}
          </span>
        </div>
        <div class="flex justify-between text-[10px] text-slate-500 mt-1">
          <span>الحد الأدنى: {pool.minStake} {pool.asset}</span>
          <span>≈ {egpCompact(usdToEgp(amount * getAssetPrice(pool.asset), currentRate))}</span>
        </div>
      </div>

      <div class="mb-5">
        <label class="block text-xs text-slate-400 mb-2">مدة القفل</label>
        <div class="grid grid-cols-4 gap-2">
          {#each [['flexible', 'مرن'], [30, '30 يوم'], [90, '90 يوم'], [180, '180 يوم']] as [val, label]}
            {@const thisApr = getApr(pool, val as any)}
            <button
              onclick={() => (stakeDuration = val as any)}
              class="p-2 rounded-lg border transition-all {stakeDuration === val
                ? 'bg-accent-gold/15 border-accent-gold/40'
                : 'bg-ink-900/40 border-white/5 hover:border-white/10'}"
            >
              <p class="text-xs font-bold text-white mb-0.5">{label}</p>
              <p class="text-[10px] text-accent-gold font-mono">{thisApr}%</p>
            </button>
          {/each}
        </div>
      </div>

      <div class="bg-ink-900/50 rounded-xl p-4 mb-5 space-y-2">
        <div class="flex justify-between text-sm">
          <span class="text-slate-400">APR</span>
          <span class="text-accent-gold font-bold font-mono">{apr}%</span>
        </div>
        <div class="flex justify-between text-sm">
          <span class="text-slate-400">العائد اليومي</span>
          <span class="text-emerald-400 font-mono">{(yearlyReward / 365).toFixed(6)} {pool.asset}</span>
        </div>
        <div class="flex justify-between text-sm">
          <span class="text-slate-400">العائد الشهري</span>
          <span class="text-emerald-400 font-mono">{(yearlyReward / 12).toFixed(6)} {pool.asset}</span>
        </div>
        <div class="flex justify-between text-sm pt-2 border-t border-white/5">
          <span class="text-slate-400">العائد السنوي</span>
          <span class="text-white font-bold font-mono">{yearlyReward.toFixed(6)} {pool.asset}</span>
        </div>
        <div class="flex justify-between text-xs text-slate-500">
          <span>≈ بالجنيه المصري</span>
          <span class="font-mono">{egpCompact(usdToEgp(yearlyReward * getAssetPrice(pool.asset), currentRate))}</span>
        </div>
      </div>

      <button
        onclick={confirmStake}
        disabled={staking || amount <= 0 || amount > bal || amount < pool.minStake}
        class="w-full py-3 rounded-xl bg-gradient-to-r from-accent-gold to-accent-violet text-ink-950 font-bold hover:opacity-90 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {#if staking}
          <Loader2 size={16} class="animate-spin" />
          جاري المعالجة...
        {:else}
          <Lock size={16} />
          تأكيد Staking
        {/if}
      </button>

      <p class="text-[10px] text-slate-500 text-center mt-3 flex items-center justify-center gap-1">
        <Info size={10} />
        {stakeDuration === 'flexible' ? 'يمكنك السحب في أي وقت بدون رسوم' : 'لا يمكن السحب قبل انتهاء فترة القفل'}
      </p>
    </div>
  </Modal>
{/if}

<style>
  .bg-white\/3 {
    background-color: rgba(255, 255, 255, 0.03);
  }
</style>
