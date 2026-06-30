<script lang="ts">
  /**
   * Copy Trading — Browse and follow top traders. When you follow a trader,
   * every trade they make is automatically replicated in your account at the
   * same proportion. Includes detailed trader stats, performance curves, and
   * active followers count.
   */
  import { onMount } from 'svelte';
  import {
    Copy, Users, TrendingUp, TrendingDown, Crown, Star, Eye,
    Search, Filter, Award, Activity, DollarSign, Percent,
    Target, Clock, Check, Plus, Settings2, Zap, BarChart3,
    ArrowUpRight, ArrowDownRight, Shield, MessageCircle, RefreshCw, X
  } from 'lucide-svelte';
  import { formatPrice, formatCompact, formatPercent } from '$lib/utils/format';
  import { usdToEgp, egpCompact, usdEgpRate } from '$lib/utils/currency';
  import { toasts } from '$lib/stores/toast';

  type Trader = {
    id: string;
    name: string;
    avatar: string;
    verified: boolean;
    rank: number;
    roi30d: number; // % return last 30 days
    roiAll: number; // % return all time
    winRate: number;
    aum: number; // assets under management in USD
    followers: number;
    copiers: number;
    maxDrawdown: number;
    sharpe: number;
    trades30d: number;
    avgHoldHours: number;
    riskScore: 1 | 2 | 3 | 4 | 5;
    favoriteAssets: string[];
    bio: string;
    equityCurve: number[];
    openPositions: { symbol: string; side: 'LONG' | 'SHORT'; pnlPct: number; size: number }[];
    following: boolean;
  };

  let traders = $state<Trader[]>([]);
  let searchQuery = $state('');
  let sortBy = $state<'roi30d' | 'roiALL' | 'aum' | 'followers' | 'winRate' | 'sharpe'>('roi30d');
  let riskFilter = $state<'all' | 'low' | 'medium' | 'high'>('all');
  let selectedTrader = $state<Trader | null>(null);
  let detailOpen = $state(false);
  let copyModalOpen = $state(false);
  let copyAmount = $state(100);
  let copyPercent = $state(10);
  let currentRate = $state(48.5);

  // Generate mock trader data
  function generateTraders() {
    const names = [
      'CryptoPharaoh', 'NileWhale', 'SphinxTrader', 'PyramidMaster',
      'CairoBull', 'AlexBear', 'DesertWolf', 'GoldenScarab',
      'AnubisFX', 'HorusTrader', 'RaCapital', 'IsisQuant'
    ];
    const bios = [
      'متداول محترف منذ 2018 - متخصص في BTC و ETH',
      'استراتيجية Swing trading على العملات الرئيسية',
      'مؤسس أكاديمية للتداول - خبرة 8 سنوات',
      'متداول عقود آجلة - إدارة مخاطر صارمة',
      'تداول يومي عالي التردد - تحليل فني متقدم',
      'مختص في DeFi والعملات البديلة'
    ];
    const assets = ['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'AVAX', 'LINK'];

    return names.map((name, i) => {
      const roi30d = -5 + Math.random() * 80;
      const trades30d = 30 + Math.floor(Math.random() * 200);
      const followers = 100 + Math.floor(Math.random() * 5000);
      const aum = 50000 + Math.random() * 2000000;
      const riskScore = (1 + Math.floor(Math.random() * 5)) as 1|2|3|4|5;

      // Generate equity curve
      const curve: number[] = [];
      let v = 10000;
      for (let j = 0; j < 30; j++) {
        v *= (1 + (Math.random() - 0.4) * 0.05);
        curve.push(v);
      }

      return {
        id: `t${i + 1}`,
        name,
        avatar: name.charAt(0),
        verified: Math.random() > 0.3,
        rank: i + 1,
        roi30d,
        roiALL: roi30d * (1.5 + Math.random() * 4),
        winRate: 55 + Math.random() * 40,
        aum,
        followers,
        copiers: Math.floor(followers * (0.2 + Math.random() * 0.4)),
        maxDrawdown: 5 + Math.random() * 25,
        sharpe: 0.5 + Math.random() * 3,
        trades30d,
        avgHoldHours: 2 + Math.random() * 48,
        riskScore,
        favoriteAssets: assets.slice(0, 2 + Math.floor(Math.random() * 3)),
        bio: bios[i % bios.length],
        equityCurve: curve,
        openPositions: Array.from({ length: 1 + Math.floor(Math.random() * 3) }).map(() => ({
          symbol: assets[Math.floor(Math.random() * assets.length)] + 'USDT',
          side: (Math.random() > 0.4 ? 'LONG' : 'SHORT') as 'LONG' | 'SHORT',
          pnlPct: -8 + Math.random() * 30,
          size: 500 + Math.random() * 5000
        })),
        following: false
      } as Trader;
    });
  }

  onMount(() => {
    traders = generateTraders();
    usdEgpRate.subscribe((r) => (currentRate = r));
  });

  const filteredTraders = $derived.by(() => {
    let arr = [...traders];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      arr = arr.filter((t) => t.name.toLowerCase().includes(q));
    }
    if (riskFilter === 'low') arr = arr.filter((t) => t.riskScore <= 2);
    else if (riskFilter === 'medium') arr = arr.filter((t) => t.riskScore === 3);
    else if (riskFilter === 'high') arr = arr.filter((t) => t.riskScore >= 4);

    switch (sortBy) {
      case 'roi30d': arr.sort((a, b) => b.roi30d - a.roi30d); break;
      case 'roiALL': arr.sort((a, b) => b.roiALL - a.roiALL); break;
      case 'aum': arr.sort((a, b) => b.aum - a.aum); break;
      case 'followers': arr.sort((a, b) => b.followers - a.followers); break;
      case 'winRate': arr.sort((a, b) => b.winRate - a.winRate); break;
      case 'sharpe': arr.sort((a, b) => b.sharpe - a.sharpe); break;
    }
    return arr;
  });

  const stats = $derived.by(() => {
    const totalFollowers = traders.reduce((s, t) => s + t.followers, 0);
    const totalAUM = traders.reduce((s, t) => s + t.aum, 0);
    const avgROI = traders.length > 0 ? traders.reduce((s, t) => s + t.roi30d, 0) / traders.length : 0;
    const verified = traders.filter((t) => t.verified).length;
    return { totalFollowers, totalAUM, avgROI, verified, total: traders.length };
  });

  const followingCount = $derived(traders.filter((t) => t.following).length);

  function toggleFollow(t: Trader) {
    t.following = !t.following;
    traders = [...traders];
    if (t.following) {
      toasts.success(`تتابع الآن ${t.name}`);
    } else {
      toasts.info(`تم إلغاء متابعة ${t.name}`);
    }
  }

  function openDetail(t: Trader) {
    selectedTrader = t;
    detailOpen = true;
  }

  function openCopyModal(t: Trader) {
    selectedTrader = t;
    copyModalOpen = true;
  }

  function confirmCopy() {
    if (!selectedTrader) return;
    selectedTrader.following = true;
    traders = [...traders];
    toasts.success(`تم تفعيل نسخ ${selectedTrader.name} بمبلغ ${copyAmount}$ — نسبة ${copyPercent}% لكل صفقة`);
    copyModalOpen = false;
  }

  function riskColor(score: number): string {
    if (score <= 2) return '#22d3a4';
    if (score === 3) return '#f5b544';
    return '#f43f7a';
  }
  function riskLabel(score: number): string {
    if (score <= 2) return 'منخفض';
    if (score === 3) return 'متوسط';
    return 'مرتفع';
  }

  function sparkPath(curve: number[], w = 80, h = 24): string {
    if (curve.length < 2) return '';
    const max = Math.max(...curve);
    const min = Math.min(...curve);
    const range = max - min || 1;
    return curve.map((v, i) => {
      const x = (i / (curve.length - 1)) * w;
      const y = h - ((v - min) / range) * h;
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
  }

  // Equity curve for selected trader (larger)
  function equityPathLarge(curve: number[]): string {
    if (curve.length < 2) return '';
    const w = 600;
    const h = 180;
    const max = Math.max(...curve);
    const min = Math.min(...curve);
    const range = max - min || 1;
    return curve.map((v, i) => {
      const x = (i / (curve.length - 1)) * w;
      const y = h - ((v - min) / range) * h;
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
  }
</script>

<svelte:head><title>Copy Trading — NEXUS</title></svelte:head>

<div class="space-y-4 pb-20 lg:pb-0 relative">
  <!-- Ambient aurora -->
  <div class="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
    <div class="absolute -top-20 right-1/4 w-96 h-96 bg-accent-gold/7 blur-[120px] rounded-full animate-pulse-glow"></div>
    <div class="absolute bottom-0 -left-32 w-96 h-96 bg-accent-violet/5 blur-[120px] rounded-full animate-pulse-glow" style="animation-delay: 2s;"></div>
    <div class="absolute top-1/2 right-1/3 w-80 h-80 bg-accent-mint/4 blur-[120px] rounded-full animate-pulse-glow" style="animation-delay: 4s;"></div>
  </div>

  <!-- Hero header -->
  <div class="panel p-5 relative overflow-hidden">
    <div class="absolute top-0 inset-x-0 h-px pointer-events-none" style="background: linear-gradient(90deg, transparent, rgba(245, 181, 68, 0.4), transparent);"></div>
    <div class="absolute -top-12 -right-12 w-32 h-32 bg-accent-gold/10 blur-3xl rounded-full"></div>
    <div class="absolute -bottom-12 -left-12 w-32 h-32 bg-accent-violet/8 blur-3xl rounded-full"></div>
    <div class="relative flex items-center justify-between flex-wrap gap-3">
      <div class="flex items-center gap-3">
        <div class="relative w-12 h-12 rounded-2xl bg-gradient-to-br from-accent-gold/20 to-accent-violet/10 border border-accent-gold/25 flex items-center justify-center shrink-0">
          <div class="absolute inset-0 bg-accent-gold/15 blur-xl rounded-2xl"></div>
          <Copy size={24} class="relative text-accent-gold" />
        </div>
        <div>
          <h1 class="text-xl font-bold text-white tracking-tight">نسخ المتداولين</h1>
          <p class="text-xs text-slate-400 mt-0.5">تابع كبار المتداولين وانسخ صفقاتهم تلقائياً بنفس النسبة</p>
        </div>
      </div>
      <div class="flex items-center gap-2 text-xs">
        <div class="px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/5 relative overflow-hidden group hover:border-accent-gold/20 transition-colors">
          <div class="absolute -top-3 -right-3 w-10 h-10 bg-accent-gold/8 blur-2xl rounded-full group-hover:bg-accent-gold/12 transition-all"></div>
          <div class="relative">
            <span class="text-slate-400">تاجراً موثق:</span>
            <span class="text-accent-gold font-bold mr-1 tabular-nums">{stats.verified}</span>
          </div>
        </div>
        <div class="px-3 py-1.5 rounded-lg bg-accent-mint/10 border border-accent-mint/20 relative overflow-hidden group hover:border-accent-mint/30 transition-colors">
          <div class="absolute -top-3 -right-3 w-10 h-10 bg-accent-mint/10 blur-2xl rounded-full group-hover:bg-accent-mint/15 transition-all"></div>
          <div class="relative">
            <span class="text-slate-400">إجمالي AUM:</span>
            <span class="text-accent-mint font-bold mr-1 tabular-nums">${formatCompact(stats.totalAUM)}</span>
          </div>
        </div>
        <div class="px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/5 relative overflow-hidden group hover:border-accent-violet/20 transition-colors">
          <div class="absolute -top-3 -right-3 w-10 h-10 bg-accent-violet/8 blur-2xl rounded-full group-hover:bg-accent-violet/12 transition-all"></div>
          <div class="relative">
            <span class="text-slate-400">تتابع:</span>
            <span class="text-accent-violet font-bold mr-1 tabular-nums">{followingCount}</span>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Filters -->
  <div class="panel p-3 relative overflow-hidden">
    <div class="absolute top-0 inset-x-0 h-px pointer-events-none" style="background: linear-gradient(90deg, transparent, rgba(168, 85, 247, 0.3), transparent);"></div>
    <div class="relative flex flex-wrap items-center gap-2">
      <div class="relative">
        <Search size={14} class="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          type="text"
          placeholder="بحث عن متداول..."
          bind:value={searchQuery}
          class="w-48 bg-white/[0.03] border border-white/5 rounded-md pr-7 pl-3 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-accent-gold/40"
        />
      </div>
      <div class="flex items-center gap-1 text-xs">
        <Filter size={12} class="text-slate-500 ml-1" />
        {#each [{ v: 'all', l: 'الكل' }, { v: 'low', l: 'منخفض المخاطر' }, { v: 'medium', l: 'متوسط' }, { v: 'high', l: 'عالي المخاطر' }] as f}
          <button
            onclick={() => (riskFilter = f.v as any)}
            class="px-2.5 py-1.5 rounded-md transition-colors {riskFilter === f.v ? 'bg-accent-gold/15 text-accent-gold border border-accent-gold/30' : 'text-slate-400 hover:bg-white/5 border border-transparent'}"
          >{f.l}</button>
        {/each}
      </div>
      <div class="flex items-center gap-1 text-xs mr-auto">
        <span class="text-slate-500 text-[11px]">ترتيب حسب:</span>
        <select bind:value={sortBy} class="bg-white/[0.03] border border-white/5 rounded-md px-2 py-1.5 text-xs text-white focus:outline-none focus:border-accent-gold/40">
          <option value="roi30d">العائد 30 يوم</option>
          <option value="roiALL">العائد الكلي</option>
          <option value="aum">حجم الأموال</option>
          <option value="followers">المتابعين</option>
          <option value="winRate">معدل الربح</option>
          <option value="sharpe">معامل شارب</option>
        </select>
      </div>
    </div>
  </div>

  <!-- Top 3 podium -->
  <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
    {#each filteredTraders.slice(0, 3) as t, i}
      <div class="panel p-4 relative overflow-hidden {i === 0 ? 'sm:scale-[1.03] panel-glow' : i === 1 ? '' : ''}">
        <div class="absolute top-0 inset-x-0 h-px pointer-events-none" style="background: linear-gradient(90deg, transparent, {i === 0 ? 'rgba(245, 181, 68, 0.5)' : i === 1 ? 'rgba(203, 213, 232, 0.3)' : 'rgba(244, 63, 122, 0.4)'}, transparent);"></div>
        <div class="absolute -top-8 -right-8 w-24 h-24 blur-3xl rounded-full {i === 0 ? 'bg-accent-gold/15' : i === 1 ? 'bg-slate-300/10' : 'bg-accent-rose/10'}"></div>
        <div class="absolute top-0 left-0 px-2.5 py-1 text-[10px] font-bold rounded-br-xl flex items-center gap-1 {i === 0 ? 'bg-accent-gold text-ink-950' : i === 1 ? 'bg-slate-300 text-ink-950' : 'bg-accent-rose text-white'}">
          {#if i === 0}<Crown size={11} />{/if}
          #{i + 1}
        </div>
        <div class="relative flex items-center gap-3 mb-3 mt-2">
          <div class="w-12 h-12 rounded-full bg-gradient-to-br from-accent-gold/40 to-accent-gold/10 border border-accent-gold/20 flex items-center justify-center text-accent-gold text-xl font-bold shrink-0">
            {t.avatar}
          </div>
          <div class="min-w-0">
            <div class="flex items-center gap-1">
              <span class="font-bold text-white truncate">{t.name}</span>
              {#if t.verified}<Check size={12} class="text-accent-gold shrink-0" />{/if}
            </div>
            <div class="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
              <Users size={9} /> {formatCompact(t.followers)} متابع
            </div>
          </div>
        </div>
        <div class="relative grid grid-cols-3 gap-2 mb-3 text-center">
          <div>
            <div class="text-[10px] text-slate-500">عائد 30 يوم</div>
            <div class="text-sm font-bold tabular-nums {t.roi30d >= 0 ? 'text-accent-mint' : 'text-accent-rose'}">
              {t.roi30d >= 0 ? '+' : ''}{t.roi30d.toFixed(1)}%
            </div>
          </div>
          <div>
            <div class="text-[10px] text-slate-500">معدل الربح</div>
            <div class="text-sm font-bold text-white tabular-nums">{t.winRate.toFixed(0)}%</div>
          </div>
          <div>
            <div class="text-[10px] text-slate-500">المخاطرة</div>
            <div class="text-sm font-bold tabular-nums" style="color: {riskColor(t.riskScore)};">
              {riskLabel(t.riskScore)}
            </div>
          </div>
        </div>
        <svg viewBox="0 0 80 24" class="relative w-full h-6" preserveAspectRatio="none">
          <path d={sparkPath(t.equityCurve)} fill="none" stroke={t.roi30d >= 0 ? '#22d3a4' : '#f43f7a'} stroke-width="1.5" />
        </svg>
        <div class="relative flex items-center gap-1 mt-3">
          <button
            onclick={() => openCopyModal(t)}
            class="btn-primary flex-1 py-1.5 text-xs"
          >
            نسخ
          </button>
          <button
            onclick={() => openDetail(t)}
            class="btn-secondary px-3 py-1.5 text-xs"
            aria-label="عرض التفاصيل"
          >
            <Eye size={12} />
          </button>
        </div>
      </div>
    {/each}
  </div>

  <!-- Full traders table -->
  <div class="panel overflow-hidden relative">
    <div class="absolute top-0 inset-x-0 h-px pointer-events-none" style="background: linear-gradient(90deg, transparent, rgba(245, 181, 68, 0.3), transparent);"></div>
    <div class="px-4 py-3 border-b border-white/5 flex items-center justify-between">
      <h3 class="text-sm font-bold text-white flex items-center gap-2 tracking-tight">
        <div class="w-7 h-7 rounded-lg bg-accent-gold/10 border border-accent-gold/20 flex items-center justify-center">
          <BarChart3 size={14} class="text-accent-gold" />
        </div>
        كل المتداولين
        <span class="text-[10px] text-slate-500 tabular-nums">({filteredTraders.length})</span>
      </h3>
    </div>
    <div class="overflow-x-auto">
      <table class="w-full text-xs">
        <thead>
          <tr class="text-[10px] uppercase tracking-wider text-slate-500 border-b border-white/5 bg-white/[0.02]">
            <th class="text-right font-medium px-4 py-3">#</th>
            <th class="text-right font-medium px-4 py-3">المتداول</th>
            <th class="text-right font-medium px-4 py-3">عائد 30 يوم</th>
            <th class="text-right font-medium px-4 py-3">المنحنى</th>
            <th class="text-right font-medium px-4 py-3">معدل الربح</th>
            <th class="text-right font-medium px-4 py-3">AUM</th>
            <th class="text-right font-medium px-4 py-3">المتابعون</th>
            <th class="text-right font-medium px-4 py-3">المخاطرة</th>
            <th class="text-left font-medium px-4 py-3">إجراء</th>
          </tr>
        </thead>
        <tbody>
          {#each filteredTraders as t, i}
            <tr class="border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors cursor-pointer" onclick={() => openDetail(t)}>
              <td class="px-4 py-3 text-slate-500 font-mono">{i + 1}</td>
              <td class="px-4 py-3">
                <div class="flex items-center gap-2">
                  <div class="w-8 h-8 rounded-full bg-gradient-to-br from-accent-gold/30 to-accent-gold/10 flex items-center justify-center text-accent-gold text-xs font-bold">
                    {t.avatar}
                  </div>
                  <div>
                    <div class="flex items-center gap-1">
                      <span class="font-bold text-white">{t.name}</span>
                      {#if t.verified}<Check size={11} class="text-accent-gold" />{/if}
                    </div>
                    <div class="text-[10px] text-slate-500">{t.favoriteAssets.join(' · ')}</div>
                  </div>
                </div>
              </td>
              <td class="px-4 py-3">
                <span class="font-bold tabular-nums {t.roi30d >= 0 ? 'text-accent-mint' : 'text-accent-rose'}">
                  {t.roi30d >= 0 ? '+' : ''}{t.roi30d.toFixed(2)}%
                </span>
              </td>
              <td class="px-4 py-3">
                <svg viewBox="0 0 80 24" class="w-20 h-6" preserveAspectRatio="none">
                  <path d={sparkPath(t.equityCurve)} fill="none" stroke={t.roi30d >= 0 ? '#22d3a4' : '#f43f7a'} stroke-width="1.5" />
                </svg>
              </td>
              <td class="px-4 py-3 text-slate-300 tabular-nums">{t.winRate.toFixed(1)}%</td>
              <td class="px-4 py-3 text-slate-300 font-mono tabular-nums">${formatCompact(t.aum)}</td>
              <td class="px-4 py-3 text-slate-300 tabular-nums">{formatCompact(t.followers)}</td>
              <td class="px-4 py-3">
                <div class="flex items-center gap-1">
                  <div class="flex gap-0.5">
                    {#each Array(5) as _, idx}
                      <div class="w-1 h-3 rounded-sm" style="background: {idx < t.riskScore ? riskColor(t.riskScore) : 'rgba(255,255,255,0.1)'};"></div>
                    {/each}
                  </div>
                  <span class="text-[10px]" style="color: {riskColor(t.riskScore)};">{riskLabel(t.riskScore)}</span>
                </div>
              </td>
              <td class="px-4 py-3 text-left" onclick={(e) => e.stopPropagation()}>
                <div class="flex items-center gap-1">
                  <button
                    onclick={() => openCopyModal(t)}
                    class="px-3 py-1.5 rounded-md text-xs font-bold bg-accent-gold text-ink-950 hover:bg-accent-gold/90 transition-colors"
                  >
                    {t.following ? 'نسخ' : 'نسخ'}
                  </button>
                  <button
                    onclick={() => toggleFollow(t)}
                    class="px-2 py-1.5 rounded-md text-xs {t.following ? 'bg-accent-mint/15 text-accent-mint' : 'bg-white/[0.03] text-slate-400 hover:bg-white/5'}"
                  >
                    {#if t.following}<Check size={12} />{:else}<Plus size={12} />{/if}
                  </button>
                </div>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </div>

  <!-- How it works -->
  <div class="panel p-4 relative overflow-hidden">
    <div class="absolute top-0 inset-x-0 h-px pointer-events-none" style="background: linear-gradient(90deg, transparent, rgba(34, 211, 164, 0.3), transparent);"></div>
    <h3 class="text-sm font-bold text-white mb-3 flex items-center gap-2 tracking-tight">
      <div class="w-7 h-7 rounded-lg bg-accent-mint/10 border border-accent-mint/20 flex items-center justify-center">
        <Zap size={14} class="text-accent-mint" />
      </div>
      كيف يعمل نسخ التداول؟
    </h3>
    <div class="grid grid-cols-1 md:grid-cols-4 gap-3">
      {#each [{ n: '1', t: 'اختر متداول', d: 'تصفح قائمة المتداولين الموثقين واختر الأنسب لأهدافك بناءً على العائد والمخاطرة.' }, { n: '2', t: 'حدد المبلغ', d: 'اختر المبلغ الذي تريد تخصيصه للنسخ ونسبة كل صفقة من 1% إلى 100%.' }, { n: '3', t: 'نسخ تلقائي', d: 'كل صفقة يفتحها المتداول تُنسخ على حسابك فوراً بنفس النسبة المحددة.' }, { n: '4', t: 'إدارة كاملة', d: 'يمكنك إيقاف النسخ أو تعديل النسبة أو إغلاق الصفقات يدوياً في أي وقت.' }] as step}
        <div class="bg-white/[0.02] rounded-lg p-3 border border-white/5 relative overflow-hidden group hover:border-accent-gold/15 transition-colors">
          <div class="absolute -top-4 -right-4 w-12 h-12 bg-accent-gold/8 blur-2xl rounded-full group-hover:bg-accent-gold/12 transition-all"></div>
          <div class="relative w-8 h-8 rounded-lg bg-gradient-to-br from-accent-gold/20 to-accent-gold/5 border border-accent-gold/25 flex items-center justify-center mb-2 text-accent-gold font-bold text-sm tabular-nums">{step.n}</div>
          <h4 class="relative text-xs font-bold text-white mb-1">{step.t}</h4>
          <p class="relative text-[10px] text-slate-400 leading-relaxed">{step.d}</p>
        </div>
      {/each}
    </div>
  </div>
</div>

<!-- Trader detail modal -->
{#if detailOpen && selectedTrader}
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" dir="rtl">
    <div class="panel-glow w-full max-w-3xl max-h-[90vh] overflow-y-auto">
      <!-- Header -->
      <div class="sticky top-0 z-10 px-5 py-3 flex items-center justify-between border-b border-white/5 bg-ink-900/80 backdrop-blur-xl">
        <div class="absolute top-0 inset-x-0 h-px pointer-events-none" style="background: linear-gradient(90deg, transparent, rgba(245, 181, 68, 0.4), transparent);"></div>
        <div class="relative flex items-center gap-3">
          <div class="w-12 h-12 rounded-full bg-gradient-to-br from-accent-gold/40 to-accent-gold/10 border border-accent-gold/20 flex items-center justify-center text-accent-gold text-xl font-bold shrink-0">
            {selectedTrader.avatar}
          </div>
          <div class="min-w-0">
            <div class="flex items-center gap-1.5">
              <h3 class="text-lg font-bold text-white tracking-tight">{selectedTrader.name}</h3>
              {#if selectedTrader.verified}<Check size={14} class="text-accent-gold shrink-0" />{/if}
            </div>
            <p class="text-[11px] text-slate-400">{selectedTrader.bio}</p>
          </div>
        </div>
        <button onclick={() => (detailOpen = false)} class="relative text-slate-400 hover:text-white hover:bg-white/5 p-2 rounded-lg transition-colors" aria-label="إغلاق">
          <X size={18} />
        </button>
      </div>

      <div class="p-4 space-y-4">
        <!-- Stats grid -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-2">
          <div class="bg-white/[0.03] rounded-lg p-3 border border-white/5 relative overflow-hidden">
            <div class="absolute -top-3 -right-3 w-10 h-10 bg-accent-mint/8 blur-2xl rounded-full"></div>
            <div class="relative text-[10px] text-slate-500 uppercase tracking-wider">عائد 30 يوم</div>
            <div class="relative text-lg font-bold tabular-nums {selectedTrader.roi30d >= 0 ? 'text-accent-mint' : 'text-accent-rose'}">
              {selectedTrader.roi30d >= 0 ? '+' : ''}{selectedTrader.roi30d.toFixed(2)}%
            </div>
          </div>
          <div class="bg-white/[0.03] rounded-lg p-3 border border-white/5 relative overflow-hidden">
            <div class="absolute -top-3 -right-3 w-10 h-10 bg-accent-mint/8 blur-2xl rounded-full"></div>
            <div class="relative text-[10px] text-slate-500 uppercase tracking-wider">عائد كلي</div>
            <div class="relative text-lg font-bold tabular-nums {selectedTrader.roiALL >= 0 ? 'text-accent-mint' : 'text-accent-rose'}">
              {selectedTrader.roiALL >= 0 ? '+' : ''}{selectedTrader.roiALL.toFixed(2)}%
            </div>
          </div>
          <div class="bg-white/[0.03] rounded-lg p-3 border border-white/5">
            <div class="text-[10px] text-slate-500 uppercase tracking-wider">معدل الربح</div>
            <div class="text-lg font-bold text-white tabular-nums">{selectedTrader.winRate.toFixed(1)}%</div>
          </div>
          <div class="bg-white/[0.03] rounded-lg p-3 border border-white/5">
            <div class="text-[10px] text-slate-500 uppercase tracking-wider">معامل شارب</div>
            <div class="text-lg font-bold text-white tabular-nums">{selectedTrader.sharpe.toFixed(2)}</div>
          </div>
          <div class="bg-white/[0.03] rounded-lg p-3 border border-white/5 relative overflow-hidden">
            <div class="absolute -top-3 -right-3 w-10 h-10 bg-accent-rose/8 blur-2xl rounded-full"></div>
            <div class="relative text-[10px] text-slate-500 uppercase tracking-wider">أقصى تراجع</div>
            <div class="relative text-lg font-bold text-accent-rose tabular-nums">-{selectedTrader.maxDrawdown.toFixed(2)}%</div>
          </div>
          <div class="bg-white/[0.03] rounded-lg p-3 border border-white/5">
            <div class="text-[10px] text-slate-500 uppercase tracking-wider">AUM</div>
            <div class="text-lg font-bold text-white tabular-nums">${formatCompact(selectedTrader.aum)}</div>
          </div>
          <div class="bg-white/[0.03] rounded-lg p-3 border border-white/5">
            <div class="text-[10px] text-slate-500 uppercase tracking-wider">المتابعون</div>
            <div class="text-lg font-bold text-white tabular-nums">{formatCompact(selectedTrader.followers)}</div>
          </div>
          <div class="bg-white/[0.03] rounded-lg p-3 border border-white/5">
            <div class="text-[10px] text-slate-500 uppercase tracking-wider">صفقات 30 يوم</div>
            <div class="text-lg font-bold text-white tabular-nums">{selectedTrader.trades30d}</div>
          </div>
        </div>

        <!-- Equity curve -->
        <div>
          <h4 class="text-xs font-bold text-white mb-2 flex items-center gap-1.5 tracking-tight">
            <Activity size={12} class="text-accent-gold" /> منحنى الأداء (30 يوم)
          </h4>
          <div class="bg-white/[0.02] rounded-lg p-3 border border-white/5">
            <svg viewBox="0 0 600 180" class="w-full" style="height: 180px;" preserveAspectRatio="none">
              <defs>
                <linearGradient id="eqGradT" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stop-color={selectedTrader.roi30d >= 0 ? '#22d3a4' : '#f43f7a'} stop-opacity="0.35" />
                  <stop offset="100%" stop-color={selectedTrader.roi30d >= 0 ? '#22d3a4' : '#f43f7a'} stop-opacity="0" />
                </linearGradient>
              </defs>
              <path d={`${equityPathLarge(selectedTrader.equityCurve)} L600,180 L0,180 Z`} fill="url(#eqGradT)" />
              <path d={equityPathLarge(selectedTrader.equityCurve)} fill="none" stroke={selectedTrader.roi30d >= 0 ? '#22d3a4' : '#f43f7a'} stroke-width="2" />
            </svg>
          </div>
        </div>

        <!-- Open positions -->
        <div>
          <h4 class="text-xs font-bold text-white mb-2 flex items-center gap-1.5 tracking-tight">
            <Target size={12} class="text-accent-gold" /> الصفقات المفتوحة ({selectedTrader.openPositions.length})
          </h4>
          <div class="bg-white/[0.02] rounded-lg overflow-hidden border border-white/5">
            {#each selectedTrader.openPositions as pos}
              <div class="flex items-center justify-between px-3 py-2 border-b border-white/5 last:border-0 text-xs hover:bg-white/[0.02] transition-colors">
                <div class="flex items-center gap-2">
                  <span class="pill {pos.side === 'LONG' ? 'pill-mint' : 'pill-rose'}">{pos.side === 'LONG' ? 'شراء' : 'بيع'}</span>
                  <span class="font-bold text-white">{pos.symbol}</span>
                </div>
                <div class="flex items-center gap-3">
                  <span class="text-slate-400 font-mono tabular-nums">${formatCompact(pos.size)}</span>
                  <span class="font-bold tabular-nums {pos.pnlPct >= 0 ? 'text-accent-mint' : 'text-accent-rose'}">
                    {pos.pnlPct >= 0 ? '+' : ''}{pos.pnlPct.toFixed(2)}%
                  </span>
                </div>
              </div>
            {/each}
          </div>
        </div>

        <!-- Action -->
        <button
          onclick={() => { detailOpen = false; openCopyModal(selectedTrader); }}
          class="btn-primary w-full py-2.5 text-sm"
        >
          <Copy size={14} /> ابدأ النسخ الآن
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Copy modal -->
{#if copyModalOpen && selectedTrader}
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" dir="rtl">
    <div class="panel-glow w-full max-w-md overflow-hidden">
      <div class="relative flex items-center justify-between px-4 py-3 border-b border-white/5 bg-accent-gold/5">
        <div class="absolute top-0 inset-x-0 h-px pointer-events-none" style="background: linear-gradient(90deg, transparent, rgba(245, 181, 68, 0.4), transparent);"></div>
        <div class="relative flex items-center gap-2">
          <Copy size={16} class="text-accent-gold" />
          <h3 class="text-sm font-bold text-white tracking-tight">نسخ {selectedTrader.name}</h3>
        </div>
        <button onclick={() => (copyModalOpen = false)} class="relative text-slate-400 hover:text-white hover:bg-white/5 p-1.5 rounded-lg transition-colors" aria-label="إغلاق">
          <X size={16} />
        </button>
      </div>
      <div class="p-4 space-y-3">
        <div>
          <label class="text-[11px] text-slate-400 block mb-1">المبلغ المخصص للنسخ ($)</label>
          <input
            type="number"
            bind:value={copyAmount}
            min="50"
            step="50"
            class="w-full bg-white/[0.03] border border-white/5 rounded-md px-3 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-accent-gold/40"
          />
          <p class="text-[10px] text-slate-500 mt-1 tabular-nums">≈ {formatEGP(usdToEgp(copyAmount, currentRate))} ج.م</p>
        </div>
        <div>
          <label class="text-[11px] text-slate-400 block mb-1">نسبة كل صفقة ({copyPercent}%)</label>
          <input
            type="range"
            bind:value={copyPercent}
            min="1"
            max="100"
            class="w-full accent-accent-gold"
          />
          <div class="flex items-center justify-between text-[10px] text-slate-500 mt-1">
            <span>محافظ (1%)</span>
            <span>متوازن (10%)</span>
            <span>عدواني (100%)</span>
          </div>
        </div>
        <div class="bg-white/[0.02] rounded-md p-3 space-y-1.5 text-xs border border-white/5">
          <div class="flex items-center justify-between">
            <span class="text-slate-400">حجم الصفقة الواحدة</span>
            <span class="font-bold text-white tabular-nums">${(copyAmount * copyPercent / 100).toFixed(2)}</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-slate-400">العمولة</span>
            <span class="text-accent-mint font-bold">10% من الأرباح فقط</span>
          </div>
          <div class="flex items-center justify-between pt-1.5 border-t border-white/5">
            <span class="text-slate-400">إيقاف تلقائي عند خسارة</span>
            <span class="font-bold text-accent-rose tabular-nums">-{selectedTrader.maxDrawdown.toFixed(0)}%</span>
          </div>
        </div>
        <div class="bg-accent-gold/5 border border-accent-gold/20 rounded-md p-2 flex items-start gap-1.5">
          <Shield size={12} class="text-accent-gold flex-shrink-0 mt-0.5" />
          <p class="text-[10px] text-accent-gold/80 leading-relaxed">
            تذكر: الأداء السابق لا يضمن النتائج المستقبلية. النسخ ينطوي على مخاطر — استثمر فقط ما تستطيع خسارته.
          </p>
        </div>
        <button
          onclick={confirmCopy}
          class="btn-primary w-full py-2.5 text-sm"
        >
          <Copy size={14} /> تفعيل النسخ بمبلغ ${copyAmount}
        </button>
      </div>
    </div>
  </div>
{/if}
