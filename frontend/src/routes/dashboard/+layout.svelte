<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { browser } from '$app/environment';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { authStore } from '$lib/stores/auth';
  import { toasts } from '$lib/stores/toast';
  import { favorites, marketStore, type MarketTicker } from '$lib/stores/market';
  import { nexusMarket } from '$lib/stores/nexus-market';
  import { auth } from '$lib/api/endpoints';
  import { API_BASE, forceLogout } from '$lib/api/client';
  import { wallet as walletApi } from '$lib/api/endpoints';
  import { parseApiResponse } from '$lib/api/client';
  import { usdToEgp, egpCompact, usdEgpRate } from '$lib/utils/currency';
  import Avatar from '$lib/components/Avatar.svelte';
  import Toaster from '$lib/components/Toaster.svelte';
  import ChangeBadge from '$lib/components/ChangeBadge.svelte';
  import BottomNav from '$lib/components/BottomNav.svelte';
  import CommandPalette from '$lib/components/CommandPalette.svelte';
  import {
    LayoutDashboard,
    TrendingUp,
    Wallet,
    Clock,
    User,
    LogOut,
    Menu,
    X,
    ChevronDown,
    Shield,
    FileText,
    Bell,
    CheckCheck,
    Settings,
    Users,
    ArrowRightLeft,
    Megaphone,
    Coins,
    Star,
    Search,
    Home,
    AlertCircle,
    BellRing,
    Sparkles,
    Gift,
    Command,
    Zap,
    Trophy,
    Key,
    Grid2x2,
    FlaskConical,
    Copy,
    Bot,
    ArrowLeft
  } from 'lucide-svelte';
  import type { Snippet } from 'svelte';

  interface Props {
    children: Snippet;
  }

  let { children }: Props = $props();

  // Sidebar state
  let sidebarOpen = $state(false);

  // Command Palette
  let paletteOpen = $state(false);

  // Notification dropdown
  let notifOpen = $state(false);
  let userMenuOpen = $state(false);
  let notifications = $state<any[]>([]);
  let unreadCount = $state(0);

  // Live ticker tape data
  let tickerSymbols = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT', 'ADAUSDT', 'DOGEUSDT', 'AVAXUSDT'];
  let tickerData = $state<Record<string, MarketTicker>>({});
  let unsubNexusGlobal: (() => void) | null = null;
  let unsubMarketLocal: (() => void) | null = null;

  // Portfolio total (USD) — derived from balances + market prices
  let balances = $state<any[]>([]);
  let portfolioUsd = $state(0);
  let portfolioEgp = $state(0);
  let currentRate = $state(48.5);

  // Subscribe to EGP rate
  const unsubRate = usdEgpRate.subscribe((r) => (currentRate = r));

  // Market data WebSocket for sidebar ticker
  onMount(() => {
    if (!authStore.isAuthenticated()) {
      goto('/login');
      return;
    }
    loadNotifications();
    loadPortfolio();
    connectTickerWebSocket();
    connectUserWebSocket();
    // No setInterval polling — notifications arrive live via /ws/user,
    // portfolio recomputes automatically when marketStore updates.
    return () => {
      unsubNexusGlobal?.();
      unsubMarketLocal?.();
      unsubRate();
      unsubMarket?.();
      unsubUserWS?.();
    };
  });

  // Subscribe to market store to recompute EGP portfolio value
  let unsubMarket: (() => void) | null = null;
  function attachMarket() {
    unsubMarket = marketStore.subscribe((tickers) => {
      recomputePortfolio(tickers);
    });
  }

  function recomputePortfolio(tickers: Record<string, MarketTicker>) {
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
    portfolioUsd = sum;
    portfolioEgp = usdToEgp(sum, currentRate);
  }

  async function loadPortfolio() {
    try {
      const res = await walletApi.getBalances();
      const data = (await parseApiResponse<any[]>(res)) || [];
      balances = data.filter((b) => parseFloat(b.balance) > 0);
      if (!unsubMarket) attachMarket();
      recomputePortfolio({});
    } catch {
      // silent
    }
  }

  async function loadNotifications() {
    try {
      const { authGet, parseApiResponse } = await import('$lib/api/client');
      const r = await authGet('/api/v1/notifications?limit=10');
      const data = await parseApiResponse<any[]>(r);
      notifications = data || [];
      unreadCount = notifications.filter((n) => !n.read).length;
    } catch {
      // silent
    }
  }

  // Live notifications & portfolio updates via the user WebSocket.
  let unsubUserWS: (() => void) | null = null;
  function connectUserWebSocket() {
    if (!browser) return;
    const token = localStorage.getItem('access_token') || localStorage.getItem('token');
    if (!token) return;
    const wsBase = API_BASE.replace(/^http/, 'ws');
    let ws: WebSocket | null = null;
    let reconnectTimer: any = null;
    let closed = false;
    const connect = () => {
      if (closed) return;
      try {
        ws = new WebSocket(`${wsBase}/ws/user?token=${encodeURIComponent(token)}`);
        ws.onmessage = (ev) => {
          try {
            const evt = JSON.parse(ev.data);
            // Any event type → refresh notifications + portfolio (cheap)
            if (evt && evt.type) {
              loadNotifications();
              if (evt.type === 'order_fill' || evt.type === 'deposit_approved' || evt.type === 'withdrawal_approved') {
                loadPortfolio();
              }
            }
          } catch {}
        };
        ws.onclose = () => {
          if (closed) return;
          reconnectTimer = setTimeout(connect, 2000);
        };
        ws.onerror = () => {};
      } catch {
        reconnectTimer = setTimeout(connect, 2000);
      }
    };
    connect();
    unsubUserWS = () => {
      closed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      try { ws?.close(); } catch {}
    };
  }

  function connectTickerWebSocket() {
    // Bootstrap with REST snapshot of all tickers
    (async () => {
      const all = await nexusMarket.getAllTickers();
      for (const t of all) {
        tickerData[t.symbol] = {
          symbol: t.symbol,
          price: t.price,
          prevPrice: t.price,
          change24h: t.change24h,
          high24h: t.high24h,
          low24h: t.low24h,
          volume24h: t.volume24h
        };
        marketStore.updateTicker(t.symbol, tickerData[t.symbol]);
      }
    })();

    // Single live subscription — all ticker symbols at once, no cycling.
    unsubNexusGlobal = nexusMarket.subscribeAll((tick) => {
      const ticker: MarketTicker = {
        symbol: tick.symbol,
        price: tick.price,
        prevPrice: tickerData[tick.symbol]?.price ?? tick.price,
        change24h: tick.change24h,
        high24h: tick.high24h,
        low24h: tick.low24h,
        volume24h: tick.volume24h
      };
      tickerData[tick.symbol] = ticker;
      marketStore.updateTicker(tick.symbol, ticker);
    });
  }

  const navSections = [
    {
      items: [
        { href: '/dashboard', icon: LayoutDashboard, label: 'لوحة التحكم' },
        { href: '/dashboard/exchange', icon: TrendingUp, label: 'التداول سبوت' },
        { href: '/dashboard/futures', icon: Zap, label: 'العقود', badge: 'جديد' },
        { href: '/dashboard/heatmap', icon: Grid2x2, label: 'خريطة السوق', badge: 'جديد' },
        { href: '/dashboard/backtest', icon: FlaskConical, label: 'اختبار الاستراتيجيات', badge: 'جديد' },
        { href: '/dashboard/p2p', icon: Users, label: 'سوق P2P', badge: 'جديد' },
        { href: '/dashboard/copy-trading', icon: Copy, label: 'نسخ المتداولين', badge: 'جديد' },
        { href: '/dashboard/bots', icon: Bot, label: 'بوتات التداول', badge: 'جديد' },
        { href: '/dashboard/wallet', icon: Wallet, label: 'المحفظة' },
        { href: '/dashboard/earn', icon: Sparkles, label: 'Earn & Staking', badge: 'جديد' },
        { href: '/dashboard/history', icon: Clock, label: 'سجل الصفقات' },
        { href: '/dashboard/alerts', icon: BellRing, label: 'التنبيهات' }
      ]
    },
    {
      title: 'النمو',
      items: [
        { href: '/dashboard/competitions', icon: Trophy, label: 'المسابقات', badge: 'جديد' },
        { href: '/dashboard/referral', icon: Gift, label: 'برنامج الإحالة', badge: 'جديد' }
      ]
    },
    {
      title: 'الحساب',
      items: [
        { href: '/dashboard/notifications', icon: Bell, label: 'الإشعارات' },
        { href: '/dashboard/kyc', icon: FileText, label: 'التحقق' },
        { href: '/dashboard/fees', icon: Coins, label: 'الرسوم' },
        { href: '/dashboard/api-keys', icon: Key, label: 'مفاتيح API', badge: 'جديد' },
        { href: '/dashboard/security', icon: Shield, label: 'الأمان' },
        { href: '/dashboard/settings', icon: Settings, label: 'الإعدادات', badge: 'جديد' },
        { href: '/dashboard/profile', icon: User, label: 'الملف الشخصي' }
      ]
    }
  ];

  const adminNavSection = {
    title: 'الإدارة',
    items: [
      { href: '/dashboard/admin', icon: Settings, label: 'لوحة الإدارة' },
      { href: '/dashboard/admin/users', icon: Users, label: 'المستخدمين' },
      { href: '/dashboard/admin/kyc', icon: FileText, label: 'طلبات التحقق' },
      { href: '/dashboard/admin/transactions', icon: ArrowRightLeft, label: 'المعاملات' },
      { href: '/dashboard/admin/ads', icon: Megaphone, label: 'الإعلانات' },
      { href: '/dashboard/admin/fees', icon: Coins, label: 'الرسوم' }
    ]
  };

  const currentPath = $derived($page.url.pathname);
  const user = $derived($authStore);
  const isAdmin = $derived(user?.role === 'admin' || user?.role === 'ADMIN');

  function isActive(href: string): boolean {
    if (href === '/dashboard') return currentPath === '/dashboard';
    return currentPath.startsWith(href);
  }

  async function handleLogout() {
    try {
      const refreshToken = localStorage.getItem('refresh_token');
      if (refreshToken) await auth.logout(refreshToken);
    } catch {}
    forceLogout();
    toasts.info('تم تسجيل الخروج');
  }

  async function markAllRead() {
    try {
      const { authPut } = await import('$lib/api/client');
      await authPut('/api/v1/notifications/read-all');
      notifications = notifications.map((n) => ({ ...n, read: true }));
      unreadCount = 0;
    } catch {}
  }

  function closeAllDropdowns() {
    notifOpen = false;
    userMenuOpen = false;
  }
</script>

<svelte:window onclick={closeAllDropdowns} onkeydown={(e) => e.key === 'Escape' && (sidebarOpen = false)} />

<Toaster />

<div class="min-h-screen flex flex-col bg-ink-950">
  <!-- Top Ticker Tape -->
  <div class="h-9 bg-ink-950/90 border-b border-white/5 overflow-hidden flex items-center relative">
    <div class="absolute inset-0 pointer-events-none" style="background: linear-gradient(90deg, var(--bg-ink-950-95) 0%, transparent 5%, transparent 95%, var(--bg-ink-950-95) 100%);"></div>
    <div class="relative flex items-center gap-1 shrink-0 px-3 ml-1 border-l border-accent-gold/15 h-full">
      <span class="relative flex h-1.5 w-1.5">
        <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-gold opacity-60"></span>
        <span class="relative inline-flex rounded-full h-1.5 w-1.5 bg-accent-gold"></span>
      </span>
      <span class="text-[10px] uppercase tracking-wider text-accent-gold font-bold">ج.م</span>
    </div>
    <div class="relative flex items-center gap-6 px-4 whitespace-nowrap" style="animation: tickerScroll 60s linear infinite;">
      {#each [...tickerSymbols, ...tickerSymbols] as sym}
        {@const t = tickerData[sym]}
        <div class="flex items-center gap-2 text-xs">
          <span class="font-semibold text-slate-300">{sym.replace('USDT', '')}</span>
          {#if t}
            <span class="font-mono text-slate-400 text-[11px]">
              {egpCompact(usdToEgp(t.price, currentRate))}
            </span>
            <ChangeBadge change={t.change24h} showIcon={false} className="text-[10px]" />
          {:else}
            <span class="font-mono text-slate-500">--</span>
          {/if}
        </div>
        <span class="text-slate-700">•</span>
      {/each}
    </div>
  </div>

  <!-- Topbar -->
  <header class="sticky top-0 z-40 h-16 border-b border-white/5 bg-ink-950/85 backdrop-blur-2xl relative">
    <!-- Subtle bottom highlight line -->
    <div class="absolute bottom-0 inset-x-0 h-px pointer-events-none" style="background: linear-gradient(90deg, transparent, rgba(245, 181, 68, 0.25), rgba(168, 85, 247, 0.2), transparent);"></div>
    <div class="h-full flex items-center justify-between px-4 sm:px-6">
      <!-- Right: logo + mobile menu -->
      <div class="flex items-center gap-3">
        <button
          class="lg:hidden p-2 rounded-lg hover:bg-white/5 text-slate-300"
          onclick={(e) => {
            e.stopPropagation();
            sidebarOpen = !sidebarOpen;
          }}
          aria-label="القائمة"
        >
          {#if sidebarOpen}<X size={20} />{:else}<Menu size={20} />{/if}
        </button>
        <a href="/dashboard" class="flex items-center gap-2 group">
          <div class="relative w-9 h-9 rounded-xl bg-gradient-to-br from-accent-gold via-accent-rose to-accent-violet flex items-center justify-center font-black text-ink-950 transition-transform group-hover:scale-105">
            <span class="absolute inset-0 rounded-xl opacity-50 blur-md bg-gradient-to-br from-accent-gold to-accent-violet"></span>
            <span class="relative">N</span>
          </div>
          <span class="text-lg font-bold text-white hidden sm:block tracking-tight">
            NEXUS
          </span>
        </a>
      </div>

      <!-- Center: portfolio value (EGP) + search -->
      <div class="hidden md:flex items-center gap-4 flex-1 max-w-xl mx-6">
        <!-- Portfolio pill — EGP main currency -->
        <a
          href="/dashboard/wallet"
          class="group flex items-center gap-3 px-4 py-2 rounded-xl bg-gradient-to-br from-accent-gold/10 to-accent-violet/5 border border-accent-gold/20 hover:border-accent-gold/40 transition-all"
          title="إجمالي قيمة المحفظة بالجنيه المصري"
        >
          <div class="w-8 h-8 rounded-lg bg-accent-gold/15 flex items-center justify-center shrink-0">
            <Wallet size={15} class="text-accent-gold" />
          </div>
          <div class="leading-tight">
            <div class="flex items-center gap-1 text-[10px] text-slate-400 uppercase tracking-wider">
              <span>المحفظة</span>
              <span class="text-accent-gold font-bold">EGP</span>
            </div>
            <div class="text-sm font-bold text-white font-mono tabular-nums">
              {egpCompact(portfolioEgp)}
            </div>
          </div>
        </a>

        <!-- Search / Command Palette trigger -->
        <button
          onclick={() => (paletteOpen = true)}
          class="relative flex-1 flex items-center gap-2 bg-ink-900/60 border border-white/5 rounded-xl pr-10 pl-4 py-2 text-sm text-slate-500 hover:border-accent-gold/30 transition-colors text-right"
        >
          <Search size={16} class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <span>بحث عن عملة، صفقة...</span>
          <kbd class="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-500 bg-white/5 px-1.5 py-0.5 rounded font-mono flex items-center gap-1">
            <Command size={10} />K
          </kbd>
        </button>
      </div>

      <!-- Left: actions -->
      <div class="flex items-center gap-2">
        <!-- Live status pill -->
        <div class="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-accent-mint/8 border border-accent-mint/20" title="اتصال مباشر بالأسواق">
          <span class="relative flex h-2 w-2">
            <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-mint opacity-60"></span>
            <span class="relative inline-flex rounded-full h-2 w-2 bg-accent-mint"></span>
          </span>
          <span class="text-[11px] font-bold text-accent-mint tracking-wide">LIVE</span>
        </div>

        <!-- Notifications -->
        <div class="relative" role="presentation" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.stopPropagation()}>
          <button
            class="relative p-2 rounded-lg hover:bg-white/5 text-slate-300 transition-colors"
            onclick={() => (notifOpen = !notifOpen)}
            aria-label="الإشعارات"
          >
            <Bell size={20} />
            {#if unreadCount > 0}
              <span class="absolute top-1 right-1 min-w-4 h-4 px-1 rounded-full bg-accent-rose text-white text-[10px] font-bold flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            {/if}
          </button>

          {#if notifOpen}
            <div class="absolute left-0 mt-2 w-80 panel-glow overflow-hidden" style="animation: dropdownIn 0.15s ease-out;">
              <div class="flex items-center justify-between px-4 py-3 border-b border-white/5">
                <h3 class="text-sm font-bold text-white">الإشعارات</h3>
                {#if unreadCount > 0}
                  <button onclick={markAllRead} class="text-xs text-accent-gold hover:underline flex items-center gap-1">
                    <CheckCheck size={12} /> تعليم الكل كمقروء
                  </button>
                {/if}
              </div>
              <div class="max-h-80 overflow-y-auto">
                {#if notifications.length === 0}
                  <div class="py-10 text-center text-slate-500 text-sm">
                    <Bell size={32} class="mx-auto mb-2 opacity-30" />
                    لا توجد إشعارات
                  </div>
                {:else}
                  {#each notifications.slice(0, 8) as n}
                    <a
                      href="/dashboard/notifications"
                      class="block px-4 py-3 hover:bg-white/5 transition-colors border-b border-white/5 last:border-0 {!n.read ? 'bg-accent-gold/5' : ''}"
                    >
                      <div class="flex items-start gap-2">
                        {#if !n.read}<span class="w-2 h-2 rounded-full bg-accent-gold mt-1.5 shrink-0"></span>{/if}
                        <div class="flex-1 min-w-0">
                          <p class="text-sm font-medium text-white truncate">{n.title}</p>
                          <p class="text-xs text-slate-400 line-clamp-2 mt-0.5">{n.body}</p>
                        </div>
                      </div>
                    </a>
                  {/each}
                {/if}
              </div>
              <a href="/dashboard/notifications" class="block px-4 py-2.5 text-center text-xs text-accent-gold hover:bg-white/5 border-t border-white/5">
                عرض كل الإشعارات
              </a>
            </div>
          {/if}
        </div>

        <!-- User menu -->
        <div class="relative" role="presentation" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.stopPropagation()}>
          <button
            class="flex items-center gap-2 p-1 rounded-xl hover:bg-white/5 transition-colors"
            onclick={() => (userMenuOpen = !userMenuOpen)}
          >
            <Avatar size={32} />
            <ChevronDown size={14} class="text-slate-400 hidden sm:block" />
          </button>

          {#if userMenuOpen}
            <div class="absolute left-0 mt-2 w-56 panel-glow overflow-hidden" style="animation: dropdownIn 0.15s ease-out;">
              <div class="px-4 py-3 border-b border-white/5">
                <p class="text-sm font-semibold text-white truncate">{user?.username || 'مستخدم'}</p>
                <p class="text-xs text-slate-400 truncate">{user?.email}</p>
              </div>
              <div class="py-1">
                <a href="/dashboard/profile" class="flex items-center gap-2 px-4 py-2 text-sm text-slate-300 hover:bg-white/5 hover:text-white transition-colors">
                  <User size={14} /> الملف الشخصي
                </a>
                <a href="/dashboard/security" class="flex items-center gap-2 px-4 py-2 text-sm text-slate-300 hover:bg-white/5 hover:text-white transition-colors">
                  <Shield size={14} /> الأمان
                </a>
                <a href="/dashboard/kyc" class="flex items-center gap-2 px-4 py-2 text-sm text-slate-300 hover:bg-white/5 hover:text-white transition-colors">
                  <FileText size={14} /> التحقق
                </a>
              </div>
              <div class="border-t border-white/5 py-1">
                <button
                  onclick={handleLogout}
                  class="w-full flex items-center gap-2 px-4 py-2 text-sm text-accent-rose hover:bg-accent-rose/5 transition-colors"
                >
                  <LogOut size={14} /> تسجيل الخروج
                </button>
              </div>
            </div>
          {/if}
        </div>
      </div>
    </div>
  </header>

  <!-- Body: sidebar + content -->
  <div class="flex-1 flex">
    <!-- Sidebar -->
    <aside
      class="fixed lg:sticky top-0 lg:top-[6.25rem] right-0 z-30 h-screen lg:h-[calc(100vh-6.25rem)] w-64 bg-ink-900/95 backdrop-blur-2xl border-l border-white/5 transition-transform duration-300 lg:translate-x-0 {sidebarOpen
        ? 'translate-x-0'
        : 'translate-x-full lg:translate-x-0'}"
    >
      <!-- Subtle top fade for sidebar nav -->
      <div class="absolute top-0 inset-x-0 h-24 pointer-events-none" style="background: linear-gradient(180deg, rgba(245, 181, 68, 0.04), transparent);"></div>
      <div class="h-full flex flex-col relative">
        <!-- Mobile close -->
        <div class="lg:hidden flex items-center justify-between p-4 border-b border-white/5">
          <span class="text-sm font-bold text-white">القائمة</span>
          <button onclick={() => (sidebarOpen = false)} class="p-1.5 rounded-lg hover:bg-white/5">
            <X size={18} class="text-slate-400" />
          </button>
        </div>

        <nav class="flex-1 overflow-y-auto py-4 px-3 space-y-6 scrollbar-none relative">
          {#each navSections as section, i}
            <div>
              {#if section.title}
                <p class="px-3 mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  {section.title}
                </p>
              {/if}
              <div class="space-y-0.5">
                {#each section.items as item}
                  <a
                    href={item.href}
                    class="nav-link {isActive(item.href) ? 'active' : ''}"
                    onclick={() => (sidebarOpen = false)}
                  >
                    <item.icon size={18} />
                    <span>{item.label}</span>
                    {#if item.badge}
                      <span class="mr-auto text-[9px] px-1.5 py-0.5 rounded-full bg-accent-gold/20 text-accent-gold font-bold">
                        {item.badge}
                      </span>
                    {/if}
                  </a>
                {/each}
              </div>
            </div>
          {/each}

          {#if isAdmin}
            <div>
              <p class="px-3 mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                {adminNavSection.title}
              </p>
              <div class="space-y-0.5">
                {#each adminNavSection.items as item}
                  <a
                    href={item.href}
                    class="nav-link {isActive(item.href) ? 'active' : ''}"
                    onclick={() => (sidebarOpen = false)}
                  >
                    <item.icon size={18} />
                    <span>{item.label}</span>
                  </a>
                {/each}
              </div>
            </div>
          {/if}
        </nav>

        <!-- Footer: upgrade card -->
        <div class="p-3">
          <div class="panel-glow p-4 text-center relative overflow-hidden">
            <div class="absolute -top-8 left-1/2 -translate-x-1/2 w-32 h-32 rounded-full bg-accent-gold/15 blur-2xl pointer-events-none"></div>
            <div class="relative">
              <div class="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-accent-gold/20 to-accent-rose/10 border border-accent-gold/30 mb-2">
                <Star size={18} class="text-accent-gold" />
              </div>
              <p class="text-xs font-bold text-white mb-1">حساب VIP</p>
              <p class="text-[10px] text-slate-400 mb-2 leading-relaxed">رسوم أقل وامتيازات حصرية</p>
              <a href="/dashboard/fees" class="inline-flex items-center gap-1 text-[11px] text-accent-gold hover:gap-1.5 transition-all font-medium">
                ترقية الآن
                <ArrowLeft size={10} />
              </a>
            </div>
          </div>
        </div>
      </div>
    </aside>

    <!-- Backdrop for mobile -->
    {#if sidebarOpen}
      <div
        role="presentation"
        class="fixed inset-0 bg-ink-950/70 backdrop-blur-sm z-20 lg:hidden"
        onclick={() => (sidebarOpen = false)}
        onkeydown={(e) => { if (e.key === 'Escape') sidebarOpen = false; }}
      ></div>
    {/if}

    <!-- Main content -->
    <main class="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 pb-24 lg:pb-8">
      {@render children()}
    </main>
  </div>
</div>

<!-- Mobile bottom navigation -->
<BottomNav />

<!-- Command Palette (Cmd+K) -->
<CommandPalette bind:open={paletteOpen} />

<style>
  @keyframes tickerScroll {
    from {
      transform: translateX(0);
    }
    to {
      transform: translateX(50%);
    }
  }
  @keyframes dropdownIn {
    from {
      opacity: 0;
      transform: translateY(-8px) scale(0.96);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }
</style>
