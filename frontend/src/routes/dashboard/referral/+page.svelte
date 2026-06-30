<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { browser } from '$app/environment';
  import { authStore } from '$lib/stores/auth';
  import { toasts } from '$lib/stores/toast';
  import { usdToEgp, egpCompact, usdEgpRate } from '$lib/utils/currency';
  import {
    Copy,
    Check,
    Share2,
    Users,
    Gift,
    TrendingUp,
    Award,
    Star,
    Trophy,
    ChevronLeft,
    Sparkles,
    UserPlus,
    DollarSign,
    Percent,
    Crown,
    Medal,
    Link as LinkIcon,
    Globe,
    MessageCircle,
    Send,
    Mail,
    Clock
  } from 'lucide-svelte';

  let currentRate = $state(48.5);
  const unsubRate = usdEgpRate.subscribe((r) => (currentRate = r));

  let copied = $state(false);
  let referralLink = $state('https://nexus.exchange/r/7HX9K2D');
  let referralCode = $state('7HX9K2D');

  // Mock stats
  let stats = $state({
    totalInvited: 14,
    activeUsers: 9,
    totalEarned: 142.50, // USD
    pendingRewards: 18.30,
    conversionRate: 64, // %
    thisMonthEarned: 32.10
  });

  let invitees = $state([
    { id: '1', username: 'ahmed_2024', joinedAt: '2025-06-15', status: 'active', trades: 12, earned: 24.50, avatar: 'أ' },
    { id: '2', username: 'sara_trader', joinedAt: '2025-06-12', status: 'active', trades: 8, earned: 18.20, avatar: 'س' },
    { id: '3', username: 'mohamed_x', joinedAt: '2025-06-08', status: 'active', trades: 23, earned: 45.80, avatar: 'م' },
    { id: '4', username: 'fatima_e', joinedAt: '2025-06-02', status: 'pending', trades: 0, earned: 0, avatar: 'ف' },
    { id: '5', username: 'khaled_88', joinedAt: '2025-05-28', status: 'active', trades: 5, earned: 9.30, avatar: 'خ' },
    { id: '6', username: 'noor_inv', joinedAt: '2025-05-20', status: 'inactive', trades: 2, earned: 4.10, avatar: 'ن' },
    { id: '7', username: 'yousef_t', joinedAt: '2025-05-15', status: 'active', trades: 15, earned: 28.60, avatar: 'ي' }
  ]);

  // Tier system — accent palette only (no external hex)
  let currentTier = $state({ name: 'Silver', level: 2, commission: 25, nextTier: 'Gold', required: 25 });
  let tiers = [
    { name: 'Bronze', level: 1, commission: 15, accent: 'rose', icon: Medal, minInvites: 0, perks: ['15% عمولة', 'حد أقصى 50 دعوة'] },
    { name: 'Silver', level: 2, commission: 25, accent: 'slate', icon: Award, minInvites: 10, perks: ['25% عمولة', 'حد أقصى 200 دعوة', 'دعم ذو أولوية'] },
    { name: 'Gold', level: 3, commission: 35, accent: 'gold', icon: Crown, minInvites: 25, perks: ['35% عمولة', 'دعوات غير محدودة', 'مكافأة ترحيبية VIP', 'دعم مخصص'] },
    { name: 'Platinum', level: 4, commission: 45, accent: 'azure', icon: Trophy, minInvites: 100, perks: ['45% عمولة', 'دعوات غير محدودة', 'مدير حساب شخصي', 'دعوات لفعاليات حصرية'] }
  ];

  // Static tier classes (Tailwind JIT-safe)
  const tierAccent: Record<string, { text: string; bg: string; border: string; pill: string; glow: string }> = {
    rose: { text: 'text-accent-rose', bg: 'bg-accent-rose/15', border: 'border-accent-rose/30', pill: 'bg-accent-rose/15 text-accent-rose border border-accent-rose/30', glow: 'bg-accent-rose/10' },
    slate: { text: 'text-slate-300', bg: 'bg-slate-300/10', border: 'border-slate-300/20', pill: 'bg-slate-300/10 text-slate-300 border border-slate-300/20', glow: 'bg-slate-300/5' },
    gold: { text: 'text-accent-gold', bg: 'bg-accent-gold/15', border: 'border-accent-gold/30', pill: 'bg-accent-gold/15 text-accent-gold border border-accent-gold/30', glow: 'bg-accent-gold/10' },
    azure: { text: 'text-accent-azure', bg: 'bg-accent-azure/15', border: 'border-accent-azure/30', pill: 'bg-accent-azure/15 text-accent-azure border border-accent-azure/30', glow: 'bg-accent-azure/10' }
  };

  let filterStatus = $state<'all' | 'active' | 'pending' | 'inactive'>('all');
  let canNativeShare = $state(false);

  onMount(() => {
    canNativeShare = typeof navigator !== 'undefined' && !!navigator.share;
  });

  onDestroy(() => unsubRate());

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(referralLink);
      copied = true;
      toasts.success('تم نسخ الرابط');
      setTimeout(() => (copied = false), 2000);
    } catch {
      toasts.error('فشل في النسخ');
    }
  }

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(referralCode);
      toasts.success('تم نسخ الكود');
    } catch {}
  }

  function shareOnPlatform(platform: string) {
    const text = encodeURIComponent('انضم إلى NEXUS Exchange واربح مكافآت حصرية');
    const url = encodeURIComponent(referralLink);
    const links: Record<string, string> = {
      twitter: `https://twitter.com/intent/tweet?text=${text}&url=${url}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${url}`,
      telegram: `https://t.me/share/url?url=${url}&text=${text}`,
      email: `mailto:?subject=دعوة إلى NEXUS Exchange&body=${text}%0A%0A${url}`
    };
    if (links[platform]) {
      window.open(links[platform], '_blank', 'noopener,noreferrer');
      toasts.info(`جاري الفتح على ${platform}`);
    }
  }
  function generateNewCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
    referralCode = code;
    referralLink = `https://nexus.exchange/r/${code}`;
    toasts.success('تم توليد كود جديد');
  }

  const filteredInvitees = $derived(
    filterStatus === 'all' ? invitees : invitees.filter((i) => i.status === filterStatus)
  );

  const progressToNextTier = $derived(
    Math.min(100, (stats.totalInvited / currentTier.required) * 100)
  );
</script>

<div class="relative space-y-6">
  <!-- Ambient aurora background -->
  <div class="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
    <div class="absolute top-[-10%] left-[-5%] w-[480px] h-[480px] rounded-full bg-accent-violet/[0.08] blur-[120px] animate-pulse-glow"></div>
    <div class="absolute bottom-[-10%] right-[-5%] w-[440px] h-[440px] rounded-full bg-accent-rose/[0.06] blur-[120px] animate-pulse-glow" style="animation-delay:1.5s"></div>
    <div class="absolute top-[40%] right-[35%] w-[320px] h-[320px] rounded-full bg-accent-gold/[0.05] blur-[120px] animate-pulse-glow" style="animation-delay:0.8s"></div>
  </div>

  <!-- Header -->
  <div class="flex items-center justify-between">
    <div class="flex items-center gap-3">
      <div class="relative w-11 h-11 rounded-2xl bg-gradient-to-br from-accent-violet to-accent-rose flex items-center justify-center shadow-lg shadow-accent-rose/20">
        <div class="absolute inset-0 rounded-2xl bg-accent-rose/30 blur-md"></div>
        <Gift size={22} class="relative text-white" />
      </div>
      <div>
        <h1 class="text-2xl font-bold text-white tracking-tight">برنامج الإحالة</h1>
        <p class="text-sm text-slate-400">ادعُ أصدقاءك واربح 25% من رسوم تداولاتهم</p>
      </div>
    </div>
    <div class="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent-gold/10 border border-accent-gold/20 text-accent-gold text-xs">
      <Trophy size={14} />
      <span>المستوى: {currentTier.name}</span>
    </div>
  </div>

  <!-- Hero: Referral Link + Stats -->
  <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
    <!-- Referral Link Card -->
    <div class="panel relative p-6 lg:col-span-2 overflow-hidden">
      <div class="absolute top-0 inset-x-0 h-px bg-gradient-to-l from-transparent via-accent-violet/40 to-transparent"></div>
      <!-- Decorative gradient -->
      <div class="absolute -top-20 -left-20 w-64 h-64 bg-accent-violet/20 rounded-full blur-3xl"></div>
      <div class="absolute -bottom-20 -right-20 w-64 h-64 bg-accent-gold/15 rounded-full blur-3xl"></div>

      <div class="relative">
        <div class="flex items-center gap-2 mb-4">
          <LinkIcon size={18} class="text-accent-gold" />
          <h2 class="text-base font-bold text-white">رابط الإحالة الخاص بك</h2>
        </div>

        <!-- Link + Copy -->
        <div class="flex items-stretch gap-2 mb-3">
          <div class="flex-1 flex items-center gap-2 px-4 py-3 bg-ink-950/60 rounded-xl border border-white/5">
            <span class="text-xs text-slate-500 shrink-0">رابطك:</span>
            <input
              readonly
              value={referralLink}
              class="flex-1 bg-transparent text-sm text-white font-mono outline-none"
            />
          </div>
          <button
            onclick={copyLink}
            class="px-5 rounded-xl bg-gradient-to-r from-accent-gold to-accent-violet text-ink-950 font-bold text-sm hover:opacity-90 transition-opacity flex items-center gap-2"
          >
            {#if copied}
              <Check size={16} /> تم
            {:else}
              <Copy size={16} /> نسخ
            {/if}
          </button>
        </div>

        <!-- Referral Code -->
        <div class="flex items-center justify-between bg-ink-950/40 rounded-lg px-4 py-2 mb-4">
          <div class="flex items-center gap-2">
            <span class="text-xs text-slate-500">كود الإحالة:</span>
            <span class="font-mono font-bold text-accent-gold text-base tracking-wider">{referralCode}</span>
          </div>
          <div class="flex items-center gap-2">
            <button onclick={copyCode} class="text-xs text-slate-400 hover:text-white p-1">
              <Copy size={12} />
            </button>
            <button onclick={generateNewCode} class="text-xs text-accent-gold hover:underline">
              توليد جديد
            </button>
          </div>
        </div>

        <!-- Share buttons -->
        <div>
          <p class="text-xs text-slate-400 mb-2">شارك عبر:</p>
          <div class="flex gap-2">
            <button onclick={() => shareOnPlatform('twitter')} class="share-btn" title="X (Twitter)">
              <MessageCircle size={16} />
            </button>
            <button onclick={() => shareOnPlatform('facebook')} class="share-btn" title="Facebook">
              <Globe size={16} />
            </button>
            <button onclick={() => shareOnPlatform('telegram')} class="share-btn" title="Telegram">
              <Send size={16} />
            </button>
            <button onclick={() => shareOnPlatform('email')} class="share-btn" title="Email">
              <Mail size={16} />
            </button>
            {#if canNativeShare}
              <button
                onclick={() => {
                  navigator.share({ title: 'NEXUS Exchange', text: 'انضم واربح!', url: referralLink }).catch(() => {});
                }}
                class="share-btn flex-1"
              >
                <Share2 size={16} />
                <span class="text-xs">مشاركة</span>
              </button>
            {/if}
          </div>
        </div>
      </div>
    </div>

    <!-- Quick Stats -->
    <div class="space-y-4">
      <div class="panel relative p-4">
        <div class="absolute top-0 inset-x-0 h-px bg-gradient-to-l from-transparent via-accent-mint/40 to-transparent"></div>
        <div class="flex items-center gap-2 mb-2">
          <div class="w-8 h-8 rounded-lg bg-accent-mint/15 flex items-center justify-center">
            <DollarSign size={14} class="text-accent-mint" />
          </div>
          <span class="text-xs text-slate-400">إجمالي الأرباح</span>
        </div>
        <p class="text-xl font-bold text-accent-mint font-mono tabular-nums">
          ${stats.totalEarned.toFixed(2)}
        </p>
        <p class="text-[10px] text-slate-500 mt-0.5">≈ {egpCompact(usdToEgp(stats.totalEarned, currentRate))}</p>
      </div>

      <div class="panel relative p-4">
        <div class="absolute top-0 inset-x-0 h-px bg-gradient-to-l from-transparent via-accent-gold/40 to-transparent"></div>
        <div class="flex items-center gap-2 mb-2">
          <div class="w-8 h-8 rounded-lg bg-accent-gold/15 flex items-center justify-center">
            <Clock size={14} class="text-accent-gold" />
          </div>
          <span class="text-xs text-slate-400">مكافآت معلقة</span>
        </div>
        <p class="text-xl font-bold text-accent-gold font-mono tabular-nums">
          ${stats.pendingRewards.toFixed(2)}
        </p>
        <p class="text-[10px] text-slate-500 mt-0.5">سيتم إضافتها خلال 24 ساعة</p>
      </div>

      <div class="panel relative p-4">
        <div class="absolute top-0 inset-x-0 h-px bg-gradient-to-l from-transparent via-accent-violet/40 to-transparent"></div>
        <div class="flex items-center gap-2 mb-2">
          <div class="w-8 h-8 rounded-lg bg-accent-violet/15 flex items-center justify-center">
            <TrendingUp size={14} class="text-accent-violet" />
          </div>
          <span class="text-xs text-slate-400">أرباح هذا الشهر</span>
        </div>
        <p class="text-xl font-bold text-accent-violet font-mono tabular-nums">
          ${stats.thisMonthEarned.toFixed(2)}
        </p>
        <p class="text-[10px] text-accent-mint mt-0.5">+12% عن الشهر الماضي</p>
      </div>
    </div>
  </div>

  <!-- Stats Row -->
  <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
    <div class="panel relative p-5 text-center group">
      <div class="absolute top-0 inset-x-0 h-px bg-gradient-to-l from-transparent via-accent-gold/40 to-transparent"></div>
      <div class="absolute -top-4 -right-4 w-16 h-16 rounded-full bg-accent-gold/10 blur-2xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
      <div class="relative w-10 h-10 mx-auto rounded-xl bg-accent-gold/10 flex items-center justify-center mb-3">
        <UserPlus size={18} class="text-accent-gold" />
      </div>
      <p class="text-2xl font-bold text-white font-mono tabular-nums">{stats.totalInvited}</p>
      <p class="text-xs text-slate-400 mt-1">إجمالي المدعوين</p>
    </div>
    <div class="panel relative p-5 text-center group">
      <div class="absolute top-0 inset-x-0 h-px bg-gradient-to-l from-transparent via-accent-mint/40 to-transparent"></div>
      <div class="absolute -top-4 -right-4 w-16 h-16 rounded-full bg-accent-mint/10 blur-2xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
      <div class="relative w-10 h-10 mx-auto rounded-xl bg-accent-mint/10 flex items-center justify-center mb-3">
        <Users size={18} class="text-accent-mint" />
      </div>
      <p class="text-2xl font-bold text-accent-mint font-mono tabular-nums">{stats.activeUsers}</p>
      <p class="text-xs text-slate-400 mt-1">مستخدمين نشطين</p>
    </div>
    <div class="panel relative p-5 text-center group">
      <div class="absolute top-0 inset-x-0 h-px bg-gradient-to-l from-transparent via-accent-violet/40 to-transparent"></div>
      <div class="absolute -top-4 -right-4 w-16 h-16 rounded-full bg-accent-violet/10 blur-2xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
      <div class="relative w-10 h-10 mx-auto rounded-xl bg-accent-violet/10 flex items-center justify-center mb-3">
        <Percent size={18} class="text-accent-violet" />
      </div>
      <p class="text-2xl font-bold text-white font-mono tabular-nums">{stats.conversionRate}%</p>
      <p class="text-xs text-slate-400 mt-1">معدل التحويل</p>
    </div>
    <div class="panel relative p-5 text-center group">
      <div class="absolute top-0 inset-x-0 h-px bg-gradient-to-l from-transparent via-accent-rose/40 to-transparent"></div>
      <div class="absolute -top-4 -right-4 w-16 h-16 rounded-full bg-accent-rose/10 blur-2xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
      <div class="relative w-10 h-10 mx-auto rounded-xl bg-accent-rose/10 flex items-center justify-center mb-3">
        <TrendingUp size={18} class="text-accent-rose" />
      </div>
      <p class="text-2xl font-bold text-white font-mono tabular-nums">${(stats.totalEarned / stats.activeUsers).toFixed(2)}</p>
      <p class="text-xs text-slate-400 mt-1">متوسط الأرباح / مستخدم</p>
    </div>
  </div>

  <!-- Tier Progress -->
  <div class="panel relative p-6">
    <div class="absolute top-0 inset-x-0 h-px bg-gradient-to-l from-transparent via-accent-gold/40 to-transparent"></div>
    <div class="flex items-center justify-between mb-5">
      <div class="flex items-center gap-2">
        <Sparkles size={18} class="text-accent-gold" />
        <h2 class="text-base font-bold text-white">مستوى الإحالة</h2>
      </div>
      <div class="flex items-center gap-2 text-xs">
        <span class="text-slate-400">المستوى الحالي:</span>
        <span class="px-2 py-1 rounded-md font-bold {tierAccent[tiers.find((t) => t.name === currentTier.name)?.accent || 'slate'].pill}">
          {currentTier.name}
        </span>
      </div>
    </div>

    <!-- Progress to next tier -->
    <div class="bg-ink-900/40 rounded-xl p-4 mb-5">
      <div class="flex items-center justify-between mb-2">
        <span class="text-xs text-slate-400">التقدم نحو {currentTier.nextTier}</span>
        <span class="text-xs text-white font-bold">{stats.totalInvited} / {currentTier.required} دعوة</span>
      </div>
      <div class="h-2 bg-ink-950 rounded-full overflow-hidden">
        <div
          class="h-full bg-gradient-to-r from-accent-gold to-accent-violet rounded-full transition-all duration-500"
          style="width: {progressToNextTier}%"
        ></div>
      </div>
      <p class="text-[10px] text-slate-500 mt-2">
        تحتاج {Math.max(0, currentTier.required - stats.totalInvited)} دعوة إضافية للوصول إلى {currentTier.nextTier}
      </p>
    </div>

    <!-- All Tiers -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {#each tiers as tier}
        {@const isCurrent = tier.name === currentTier.name}
        {@const isPassed = stats.totalInvited >= tier.minInvites}
        {@const ac = tierAccent[tier.accent]}
        <div
          class="relative rounded-xl p-4 border-2 transition-all overflow-hidden {isCurrent
            ? 'border-accent-gold bg-accent-gold/5'
            : isPassed
              ? 'border-white/10 bg-ink-900/40'
              : 'border-white/5 bg-ink-900/20 opacity-60'}"
        >
          {#if isCurrent}
            <div class="absolute -top-12 -right-12 w-32 h-32 {ac.glow} blur-3xl rounded-full"></div>
            <div class="absolute -top-2 right-3 px-2 py-0.5 rounded-full bg-accent-gold text-ink-950 text-[9px] font-bold">
              الحالي
            </div>
          {/if}
          <div class="relative flex items-center gap-2 mb-3">
            <div class="w-9 h-9 rounded-full {ac.bg} {ac.border} border flex items-center justify-center">
              <tier.icon size={18} class={ac.text} />
            </div>
            <div>
              <p class="text-sm font-bold {ac.text}">{tier.name}</p>
              <p class="text-[10px] text-slate-500">من {tier.minInvites} دعوة</p>
            </div>
          </div>
          <div class="text-2xl font-bold text-white mb-2 tabular-nums">
            {tier.commission}<span class="text-sm text-slate-400">%</span>
          </div>
          <ul class="space-y-1">
            {#each tier.perks as perk}
              <li class="text-[10px] text-slate-400 flex items-start gap-1">
                <Check size={10} class="text-accent-mint mt-0.5 shrink-0" />
                <span>{perk}</span>
              </li>
            {/each}
          </ul>
        </div>
      {/each}
    </div>
  </div>

  <!-- Invited Users Table -->
  <div class="panel relative p-6">
    <div class="absolute top-0 inset-x-0 h-px bg-gradient-to-l from-transparent via-accent-violet/40 to-transparent"></div>
    <div class="flex flex-wrap items-center justify-between gap-3 mb-5">
      <div class="flex items-center gap-2">
        <Users size={18} class="text-accent-violet" />
        <h2 class="text-base font-bold text-white">المدعوون</h2>
      </div>
      <div class="flex items-center gap-1 bg-ink-900/50 rounded-lg p-1">
        {#each [['all', 'الكل'], ['active', 'نشط'], ['pending', 'بانتظار'], ['inactive', 'غير نشط']] as [val, label]}
          <button
            onclick={() => (filterStatus = val as any)}
            class="px-3 py-1.5 text-xs rounded-md transition-all {filterStatus === val
              ? 'bg-accent-gold/20 text-accent-gold font-semibold'
              : 'text-slate-400 hover:text-white'}"
          >
            {label}
          </button>
        {/each}
      </div>
    </div>

    <div class="overflow-x-auto">
      <table class="w-full">
        <thead>
          <tr class="text-[10px] text-slate-500 uppercase tracking-wider border-b border-white/5">
            <th class="text-right py-2 px-2 font-medium">المستخدم</th>
            <th class="text-right py-2 px-2 font-medium hidden sm:table-cell">تاريخ الانضمام</th>
            <th class="text-center py-2 px-2 font-medium">الحالة</th>
            <th class="text-center py-2 px-2 font-medium hidden md:table-cell">الصفقات</th>
            <th class="text-left py-2 px-2 font-medium">الأرباح</th>
          </tr>
        </thead>
        <tbody>
          {#each filteredInvitees as inv}
            <tr class="border-b border-white/5 hover:bg-white/3 transition-colors">
              <td class="py-3 px-2">
                <div class="flex items-center gap-2">
                  <div class="w-8 h-8 rounded-full bg-gradient-to-br from-accent-gold to-accent-violet flex items-center justify-center text-xs font-bold text-ink-950">
                    {inv.avatar}
                  </div>
                  <div>
                    <p class="text-sm text-white font-medium">{inv.username}</p>
                    <p class="text-[10px] text-slate-500 sm:hidden">{inv.joinedAt}</p>
                  </div>
                </div>
              </td>
              <td class="py-3 px-2 text-xs text-slate-400 hidden sm:table-cell">{inv.joinedAt}</td>
              <td class="py-3 px-2 text-center">
                {#if inv.status === 'active'}
                  <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent-mint/10 text-accent-mint text-[10px] font-bold">
                    <span class="w-1 h-1 rounded-full bg-accent-mint"></span>
                    نشط
                  </span>
                {:else if inv.status === 'pending'}
                  <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent-gold/10 text-accent-gold text-[10px] font-bold">
                    <span class="w-1 h-1 rounded-full bg-accent-gold"></span>
                    بانتظار
                  </span>
                {:else}
                  <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-500/10 text-slate-400 text-[10px] font-bold">
                    <span class="w-1 h-1 rounded-full bg-slate-400"></span>
                    غير نشط
                  </span>
                {/if}
              </td>
              <td class="py-3 px-2 text-center text-sm text-slate-300 font-mono hidden md:table-cell tabular-nums">{inv.trades}</td>
              <td class="py-3 px-2 text-left">
                <span class="text-sm font-bold text-accent-mint font-mono tabular-nums">
                  ${inv.earned.toFixed(2)}
                </span>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
      {#if filteredInvitees.length === 0}
        <div class="py-14 text-center relative">
          <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div class="w-24 h-24 rounded-2xl bg-accent-violet/5 blur-3xl"></div>
          </div>
          <div class="relative inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-accent-violet/10 to-accent-rose/10 border border-white/5 mb-3">
            <Users size={24} class="text-slate-500" />
          </div>
          <p class="text-sm text-slate-300 mb-1">لا يوجد مدعوون في هذه الفئة</p>
          <p class="text-xs text-slate-500">جرّب فلتراً آخر أو شارك رابطك مع المزيد من الأصدقاء</p>
        </div>
      {/if}
    </div>
  </div>

  <!-- How it works -->
  <div class="panel relative p-6">
    <div class="absolute top-0 inset-x-0 h-px bg-gradient-to-l from-transparent via-accent-mint/40 to-transparent"></div>
    <div class="flex items-center gap-2 mb-5">
      <Sparkles size={18} class="text-accent-gold" />
      <h2 class="text-base font-bold text-white">كيف يعمل برنامج الإحالة؟</h2>
    </div>
    <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
      {#each [
        { num: '01', icon: LinkIcon, title: 'شارك رابطك', desc: 'انسخ رابط الإحالة الخاص بك وشاركه مع أصدقائك' },
        { num: '02', icon: UserPlus, title: 'سجل أصدقاءك', desc: 'عند تسجيلهم من خلال رابطك، يتم ربطهم بحسابك تلقائياً' },
        { num: '03', icon: TrendingUp, title: 'اربح العمولات', desc: 'احصل على 25% من رسوم كل تداول يقومون به — مدى الحياة' },
        { num: '04', icon: Trophy, title: 'ترقَّ المستويات', desc: 'كلما زاد عدد المدعوين النشطين، ارتفع مستواك وزادت عمولتك' }
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

    <div class="mt-5 bg-gradient-to-br from-accent-gold/5 to-accent-violet/5 rounded-xl p-4 border border-accent-gold/10 flex items-start gap-3">
      <Star size={18} class="text-accent-gold shrink-0 mt-0.5" />
      <div>
        <p class="text-sm font-bold text-white mb-1">مكافأة الإحالة مدى الحياة!</p>
        <p class="text-xs text-slate-400 leading-relaxed">
          عمولتك من الإحالة تستمر طالما استمر صديقك في التداول على NEXUS. لا يوجد حد أقصى للأرباح — كلما زادت تداولاتهم، زادت أرباحك.
        </p>
      </div>
    </div>
  </div>
</div>

<style>
  .share-btn {
    @apply w-10 h-10 rounded-lg bg-white/5 border border-white/5 flex items-center justify-center text-slate-300 hover:bg-accent-gold/10 hover:text-accent-gold hover:border-accent-gold/30 transition-all;
  }
  .bg-white\/3 {
    background-color: rgba(255, 255, 255, 0.03);
  }
</style>
