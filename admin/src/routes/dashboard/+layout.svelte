<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { clearTokens, API } from '$lib/api/client';
  import {
    LayoutDashboard,
    Users,
    ShieldCheck,
    ArrowLeftRight,
    ScrollText,
    Megaphone,
    Percent,
    Settings,
    LogOut,
    Menu,
    X,
    Bell
  } from 'lucide-svelte';

  let { children } = $props();

  // ─── State ───
  let sidebarOpen = $state(false);
  let isAuthorized = $state(false);
  let authChecked = $state(false);
  let currentUser = $state<{ name: string; email: string; role: string; avatar?: string } | null>(null);
  let isLoggingOut = $state(false);

  // ─── Navigation items ───
  const navItems = [
    { label: 'لوحة التحكم', icon: LayoutDashboard, href: '/dashboard' },
    { label: 'المستخدمين', icon: Users, href: '/dashboard/users' },
    { label: 'التحقق KYC', icon: ShieldCheck, href: '/dashboard/kyc' },
    { label: 'المعاملات', icon: ArrowLeftRight, href: '/dashboard/transactions' },
    { label: 'سجل المراجعة', icon: ScrollText, href: '/dashboard/audit-logs' },
    { label: 'الإعلانات', icon: Megaphone, href: '/dashboard/ads' },
    { label: 'الرسوم', icon: Percent, href: '/dashboard/fees' },
    { label: 'الإعدادات', icon: Settings, href: '/dashboard/settings' }
  ];

  // ─── Derived ───
  let currentPath = $derived($page.url.pathname);

  let pageTitle = $derived.by(() => {
    const item = navItems.find((n) => n.href === currentPath);
    return item?.label ?? 'لوحة التحكم';
  });

  let userInitials = $derived.by(() => {
    if (!currentUser?.name) return 'م';
    const parts = currentUser.name.trim().split(/\s+/);
    return parts.length >= 2
      ? parts[0][0] + parts[1][0]
      : parts[0].slice(0, 2);
  });

  // ─── Auth guard ───
  $effect(() => {
    if (typeof window === 'undefined') return;

    const token = localStorage.getItem('token');
    const userRaw = localStorage.getItem('user');

    if (!token || !userRaw) {
      goto('/login');
      return;
    }

    try {
      const user = JSON.parse(userRaw);
      if (user.role !== 'ADMIN') {
        clearTokens();
        goto('/login');
        return;
      }
      currentUser = user;
      isAuthorized = true;
    } catch {
      clearTokens();
      goto('/login');
      return;
    }

    authChecked = true;
  });

  // ─── Close sidebar on route change (mobile) ───
  $effect(() => {
    currentPath; // depend on path
    sidebarOpen = false;
  });

  // ─── Logout ───
  async function handleLogout() {
    if (isLoggingOut) return;
    isLoggingOut = true;
    try {
      await fetch(`${API}/api/v1/auth/logout`, { method: 'POST' });
    } catch {
      // best-effort — clear locally regardless
    }
    clearTokens();
    goto('/login');
  }

  function toggleSidebar() {
    sidebarOpen = !sidebarOpen;
  }

  function closeSidebar() {
    sidebarOpen = false;
  }
</script>

{#if authChecked && isAuthorized}
  <div class="flex h-screen overflow-hidden relative" dir="rtl">

    <!-- ─── Mobile overlay ─── -->
    {#if sidebarOpen}
      <div
        class="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
        onclick={closeSidebar}
        role="presentation"
      ></div>
    {/if}

    <!-- ─── Sidebar ─── -->
    <aside
      class="
        fixed top-0 right-0 z-50 h-full w-64 flex flex-col
        bg-ink-900/95 backdrop-blur-2xl
        border-l border-white/[0.06]
        transition-transform duration-300 ease-in-out
        lg:translate-x-0
        {sidebarOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}
      "
    >
      <!-- Logo -->
      <div class="flex items-center gap-3 px-6 h-16 shrink-0">
        <div class="w-9 h-9 rounded-xl bg-gradient-to-br from-[#f5b544] via-[#f43f7a] to-[#a855f7] flex items-center justify-center">
          <span class="text-white font-bold text-sm">N</span>
        </div>
        <span class="text-aurora text-xl font-bold tracking-wide">NEXUS</span>
      </div>

      <div class="glass-divider mx-4"></div>

      <!-- Navigation -->
      <nav class="flex-1 overflow-y-auto scrollbar-none px-3 py-4 space-y-1">
        {#each navItems as item}
          {@const isActive = currentPath === item.href || (item.href !== '/dashboard' && currentPath.startsWith(item.href))}
          <a
            href={item.href}
            class="nav-link {isActive ? 'active' : ''}"
            onclick={closeSidebar}
          >
            <item.icon size={20} />
            <span>{item.label}</span>
          </a>
        {/each}
      </nav>

      <div class="glass-divider mx-4"></div>

      <!-- Logout -->
      <div class="p-3 shrink-0">
        <button
          class="nav-link w-full text-right"
          onclick={handleLogout}
          disabled={isLoggingOut}
        >
          <LogOut size={20} />
          <span>{isLoggingOut ? 'جاري الخروج...' : 'تسجيل الخروج'}</span>
        </button>
      </div>
    </aside>

    <!-- ─── Main area ─── -->
    <div class="flex-1 flex flex-col min-w-0 lg:mr-64">

      <!-- ─── Header ─── -->
      <header class="sticky top-0 z-40 h-16 shrink-0 flex items-center justify-between px-6 bg-ink-950/85 backdrop-blur-2xl border-b border-white/[0.06]">
        <!-- Aurora bottom highlight -->
        <div class="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-l from-transparent via-[#f5b544]/40 to-transparent"></div>

        <!-- Right side: hamburger (mobile) + page title -->
        <div class="flex items-center gap-4">
          <button
            class="lg:hidden p-2 rounded-xl transition-colors hover:bg-white/5"
            onclick={toggleSidebar}
            aria-label="القائمة"
          >
            {#if sidebarOpen}
              <X size={22} class="text-[var(--text-primary)]" />
            {:else}
              <Menu size={22} class="text-[var(--text-primary)]" />
            {/if}
          </button>
          <h1 class="text-lg font-bold text-[var(--text-primary)]">{pageTitle}</h1>
        </div>

        <!-- Left side: notifications + user info -->
        <div class="flex items-center gap-4">
          <button
            class="p-2 rounded-xl transition-colors hover:bg-white/5 relative"
            aria-label="الإشعارات"
          >
            <Bell size={20} class="text-[var(--text-secondary)]" />
            <span class="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#f43f7a]"></span>
          </button>

          <div class="flex items-center gap-3">
            <div class="text-left hidden sm:block">
              <p class="text-sm font-semibold text-[var(--text-primary)] leading-tight">
                {currentUser?.name ?? 'مدير'}
              </p>
              <span class="pill-gold text-[10px] leading-none">مدير</span>
            </div>
            <div class="w-9 h-9 rounded-full bg-gradient-to-br from-[#f5b544] to-[#a855f7] flex items-center justify-center text-white text-xs font-bold shrink-0">
              {#if currentUser?.avatar}
                <img
                  src={currentUser.avatar}
                  alt={currentUser.name}
                  class="w-full h-full rounded-full object-cover"
                />
              {:else}
                {userInitials}
              {/if}
            </div>
          </div>
        </div>
      </header>

      <!-- ─── Main content ─── -->
      <main class="flex-1 p-6 overflow-y-auto scrollbar-none">
        {@render children()}
      </main>
    </div>
  </div>
{/if}
