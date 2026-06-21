<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { marketStore, type MarketTicker } from '$lib/stores/market';
  import {
    Search,
    Home,
    TrendingUp,
    Wallet,
    Clock,
    Bell,
    Gift,
    Sparkles,
    Settings,
    Shield,
    FileText,
    Coins,
    User,
    ArrowRightLeft,
    LayoutDashboard,
    CornerDownLeft,
    ArrowUp,
    ArrowDown,
    Star,
    Plus,
    Zap,
    type Icon as IconType
  } from 'lucide-svelte';

  interface Command {
    id: string;
    label: string;
    description?: string;
    icon: typeof Search;
    action: () => void;
    section: string;
    keywords?: string[];
    hotkey?: string;
  }

  interface Props {
    open?: boolean;
  }

  let { open = $bindable(false) }: Props = $props();

  let query = $state('');
  let selectedIndex = $state(0);
  let inputEl = $state<HTMLInputElement | null>(null);

  // Static navigation commands
  const navCommands: Command[] = [
    { id: 'nav-home', label: 'لوحة التحكم', icon: LayoutDashboard, section: 'التنقل', hotkey: 'G H', action: () => goto('/dashboard'), keywords: ['dashboard', 'home', 'main', 'لوحة'] },
    { id: 'nav-exchange', label: 'التداول', icon: TrendingUp, section: 'التنقل', hotkey: 'G E', action: () => goto('/dashboard/exchange'), keywords: ['trade', 'exchange', 'تداول'] },
    { id: 'nav-wallet', label: 'المحفظة', icon: Wallet, section: 'التنقل', hotkey: 'G W', action: () => goto('/dashboard/wallet'), keywords: ['wallet', 'balance', 'محفظة', 'رصيد'] },
    { id: 'nav-history', label: 'سجل الصفقات', icon: Clock, section: 'التنقل', action: () => goto('/dashboard/history'), keywords: ['history', 'orders', 'سجل', 'صفقات'] },
    { id: 'nav-alerts', label: 'التنبيهات', icon: Bell, section: 'التنقل', action: () => goto('/dashboard/alerts'), keywords: ['alerts', 'notifications', 'تنبيهات'] },
    { id: 'nav-earn', label: 'Earn & Staking', icon: Sparkles, section: 'التنقل', action: () => goto('/dashboard/earn'), keywords: ['earn', 'staking', 'rewards', 'مكافآت', 'staking'] },
    { id: 'nav-referral', label: 'برنامج الإحالة', icon: Gift, section: 'التنقل', action: () => goto('/dashboard/referral'), keywords: ['referral', 'invite', 'friends', 'إحالة', 'دعوة'] },
    { id: 'nav-notifications', label: 'الإشعارات', icon: Bell, section: 'التنقل', action: () => goto('/dashboard/notifications'), keywords: ['notifications', 'إشعارات'] },
    { id: 'nav-kyc', label: 'التحقق', icon: FileText, section: 'الحساب', action: () => goto('/dashboard/kyc'), keywords: ['kyc', 'verify', 'تحقق'] },
    { id: 'nav-fees', label: 'الرسوم', icon: Coins, section: 'الحساب', action: () => goto('/dashboard/fees'), keywords: ['fees', 'commission', 'رسوم'] },
    { id: 'nav-security', label: 'الأمان', icon: Shield, section: 'الحساب', action: () => goto('/dashboard/security'), keywords: ['security', '2fa', 'أمان'] },
    { id: 'nav-profile', label: 'الملف الشخصي', icon: User, section: 'الحساب', action: () => goto('/dashboard/profile'), keywords: ['profile', 'account', 'ملف'] },
    { id: 'nav-settings', label: 'الإعدادات', icon: Settings, section: 'الحساب', action: () => goto('/dashboard/settings'), keywords: ['settings', 'preferences', 'إعدادات'] }
  ];

  // Actions
  const actionCommands: Command[] = [
    { id: 'act-deposit', label: 'إيداع جديد', icon: ArrowDown, section: 'إجراءات', action: () => goto('/dashboard/wallet/deposit/USDT'), keywords: ['deposit', 'إيداع', 'add money'] },
    { id: 'act-withdraw', label: 'سحب', icon: ArrowUp, section: 'إجراءات', action: () => goto('/dashboard/wallet/withdraw/USDT'), keywords: ['withdraw', 'سحب'] },
    { id: 'act-trade-btc', label: 'تداول BTC/USDT', icon: TrendingUp, section: 'إجراءات', action: () => goto('/dashboard/exchange?pair=BTCUSDT'), keywords: ['btc', 'bitcoin', 'بيتكوين'] },
    { id: 'act-trade-eth', label: 'تداول ETH/USDT', icon: TrendingUp, section: 'إجراءات', action: () => goto('/dashboard/exchange?pair=ETHUSDT'), keywords: ['eth', 'ethereum', 'إيثيريوم'] },
    { id: 'act-stake', label: 'Stake عملاتك', icon: Zap, section: 'إجراءات', action: () => goto('/dashboard/earn'), keywords: ['stake', 'staking'] },
    { id: 'act-invite', label: 'ادعُ صديقاً', icon: Plus, section: 'إجراءات', action: () => goto('/dashboard/referral'), keywords: ['invite', 'friend', 'دعوة'] }
  ];

  let recentCommands = $state<string[]>([]);

  const allCommands = $derived([...navCommands, ...actionCommands]);

  // Filter logic
  const filtered = $derived.by(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      // Show recent first, then default order
      const recent = recentCommands
        .map((id) => allCommands.find((c) => c.id === id))
        .filter((c): c is Command => !!c);
      const rest = allCommands.filter((c) => !recentCommands.includes(c.id));
      return [...recent, ...rest];
    }
    return allCommands.filter((c) => {
      const text = (c.label + ' ' + (c.description || '') + ' ' + (c.keywords || []).join(' ')).toLowerCase();
      return text.includes(q);
    });
  });

  // Group by section for display
  const grouped = $derived.by(() => {
    const groups: Record<string, Command[]> = {};
    for (const cmd of filtered) {
      if (!groups[cmd.section]) groups[cmd.section] = [];
      groups[cmd.section].push(cmd);
    }
    return groups;
  });

  const flatFiltered = $derived(filtered);

  // Keyboard shortcuts
  function handleKeydown(e: KeyboardEvent) {
    // Open/close
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      open = !open;
      query = '';
      selectedIndex = 0;
      return;
    }
    if (!open) return;

    if (e.key === 'Escape') {
      open = false;
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      selectedIndex = Math.min(flatFiltered.length - 1, selectedIndex + 1);
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      selectedIndex = Math.max(0, selectedIndex - 1);
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const cmd = flatFiltered[selectedIndex];
      if (cmd) executeCommand(cmd);
    }
  }

  function executeCommand(cmd: Command) {
    open = false;
    // Add to recent (dedupe, max 5)
    recentCommands = [cmd.id, ...recentCommands.filter((id) => id !== cmd.id)].slice(0, 5);
    if (browser) {
      try {
        localStorage.setItem('nexus-recent-cmds', JSON.stringify(recentCommands));
      } catch {}
    }
    cmd.action();
  }

  // Market tickers (subscribed only in browser)
  let tickers = $state<Record<string, MarketTicker>>({});
  let unsubMarket: (() => void) | null = null;

  onMount(() => {
    window.addEventListener('keydown', handleKeydown);
    unsubMarket = marketStore.subscribe((t) => (tickers = t));
    try {
      const r = localStorage.getItem('nexus-recent-cmds');
      if (r) recentCommands = JSON.parse(r);
    } catch {}
    return () => {
      window.removeEventListener('keydown', handleKeydown);
      unsubMarket?.();
    };
  });

  // Reset selection when query changes
  let lastQuery = '';
  $effect(() => {
    if (query !== lastQuery) {
      selectedIndex = 0;
      lastQuery = query;
    }
  });

  // Focus input when opened
  $effect(() => {
    if (open) {
      setTimeout(() => inputEl?.focus(), 50);
    }
  });

  // Scroll selected into view
  let itemEls = $state<HTMLElement[]>([]);
  $effect(() => {
    if (open && itemEls[selectedIndex]) {
      itemEls[selectedIndex].scrollIntoView({ block: 'nearest' });
    }
  });

  const cryptoResults = $derived.by(() => {
    const q = query.trim().toUpperCase();
    if (!q || q.length < 1) return [];
    return Object.values(tickers)
      .filter((t) => t.symbol.includes(q))
      .slice(0, 4)
      .map((t) => ({
        symbol: t.symbol,
        price: t.price,
        change: t.change24h
      }));
  });

  function gotoPair(symbol: string) {
    open = false;
    goto(`/dashboard/exchange?pair=${symbol}`);
  }
</script>

{#if open}
  <div
    class="fixed inset-0 z-[100] flex items-start justify-center pt-[10vh] px-4"
    role="presentation"
    onclick={() => (open = false)}
    onkeydown={(e) => e.key === 'Escape' && (open = false)}
  >
    <!-- Backdrop -->
    <div class="absolute inset-0 bg-ink-950/70 backdrop-blur-md" style="animation: fadeIn 0.15s ease-out;"></div>

    <!-- Modal -->
    <div
      class="relative w-full max-w-2xl panel-glow overflow-hidden"
      style="animation: scaleIn 0.15s ease-out;"
      role="dialog"
      aria-modal="true"
      tabindex="-1"
      onclick={(e) => e.stopPropagation()}
      onkeydown={(e) => e.stopPropagation()}
    >
      <!-- Search input -->
      <div class="flex items-center gap-3 px-4 py-3 border-b border-white/5">
        <Search size={18} class="text-slate-400 shrink-0" />
        <input
          bind:this={inputEl}
          bind:value={query}
          type="text"
          placeholder="ابحث عن صفحة، إجراء، أو عملة..."
          class="flex-1 bg-transparent text-white placeholder-slate-500 outline-none text-sm"
        />
        <kbd class="text-[10px] text-slate-500 bg-white/5 px-2 py-1 rounded font-mono">ESC</kbd>
      </div>

      <!-- Results -->
      <div class="max-h-[60vh] overflow-y-auto p-2">
        {#if cryptoResults.length > 0}
          <!-- Crypto results -->
          <div class="mb-2">
            <p class="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">العملات</p>
            {#each cryptoResults as c}
              <button
                onclick={() => gotoPair(c.symbol)}
                class="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-white/5 transition-colors text-right"
              >
                <div class="flex items-center gap-3">
                  <div class="w-8 h-8 rounded-full bg-gradient-to-br from-accent-gold/20 to-accent-violet/20 flex items-center justify-center text-xs font-bold text-accent-gold">
                    {c.symbol.replace('USDT', '').slice(0, 3)}
                  </div>
                  <div>
                    <p class="text-sm text-white font-medium">{c.symbol.replace('USDT', '')}/USDT</p>
                    <p class="text-[10px] text-slate-500">اضغط للتداول</p>
                  </div>
                </div>
                <div class="text-left">
                  <p class="text-sm font-mono text-white">${c.price.toLocaleString('en-US', { maximumFractionDigits: 2 })}</p>
                  <p class="text-[10px] font-mono {c.change >= 0 ? 'text-emerald-400' : 'text-accent-rose'}">
                    {c.change >= 0 ? '+' : ''}{c.change.toFixed(2)}%
                  </p>
                </div>
              </button>
            {/each}
          </div>
        {/if}

        {#if flatFiltered.length === 0 && cryptoResults.length === 0}
          <div class="py-12 text-center">
            <Search size={32} class="mx-auto mb-2 text-slate-600" />
            <p class="text-sm text-slate-400">لا توجد نتائج لـ "{query}"</p>
          </div>
        {:else}
          {#each Object.entries(grouped) as [section, cmds]}
            <div class="mb-2">
              <p class="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">{section}</p>
              {#each cmds as cmd, i}
                {@const flatIdx = flatFiltered.findIndex((c) => c.id === cmd.id)}
                <button
                  bind:this={itemEls[flatIdx]}
                  onclick={() => executeCommand(cmd)}
                  onmouseenter={() => (selectedIndex = flatIdx)}
                  class="w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-colors text-right {selectedIndex === flatIdx
                    ? 'bg-accent-gold/10 text-accent-gold'
                    : 'hover:bg-white/5 text-slate-300'}"
                >
                  <div class="flex items-center gap-3 flex-1 min-w-0">
                    <cmd.icon size={16} class="shrink-0 {selectedIndex === flatIdx ? 'text-accent-gold' : 'text-slate-400'}" />
                    <div class="min-w-0">
                      <p class="text-sm font-medium truncate">{cmd.label}</p>
                      {#if cmd.description}
                        <p class="text-[10px] text-slate-500 truncate">{cmd.description}</p>
                      {/if}
                    </div>
                  </div>
                  <div class="flex items-center gap-2 shrink-0">
                    {#if recentCommands.includes(cmd.id)}
                      <span class="text-[9px] text-slate-600 uppercase">حديث</span>
                    {/if}
                    {#if cmd.hotkey}
                      <kbd class="text-[10px] text-slate-500 bg-white/5 px-1.5 py-0.5 rounded font-mono">{cmd.hotkey}</kbd>
                    {/if}
                    {#if selectedIndex === flatIdx}
                      <CornerDownLeft size={12} class="text-accent-gold" />
                    {/if}
                  </div>
                </button>
              {/each}
            </div>
          {/each}
        {/if}
      </div>

      <!-- Footer -->
      <div class="px-4 py-2.5 border-t border-white/5 flex items-center justify-between text-[10px] text-slate-500">
        <div class="flex items-center gap-3">
          <span class="flex items-center gap-1">
            <kbd class="bg-white/5 px-1.5 py-0.5 rounded font-mono">↑↓</kbd> تنقل
          </span>
          <span class="flex items-center gap-1">
            <kbd class="bg-white/5 px-1.5 py-0.5 rounded font-mono">↵</kbd> اختيار
          </span>
          <span class="flex items-center gap-1">
            <kbd class="bg-white/5 px-1.5 py-0.5 rounded font-mono">ESC</kbd> إغلاق
          </span>
        </div>
        <div class="flex items-center gap-1">
          <span>NEXUS</span>
          <Sparkles size={10} class="text-accent-gold" />
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  @keyframes scaleIn {
    from { opacity: 0; transform: scale(0.96) translateY(-8px); }
    to { opacity: 1; transform: scale(1) translateY(0); }
  }
</style>
