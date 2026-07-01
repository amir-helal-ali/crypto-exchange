<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { clearTokens, API, getUser } from '$lib/api/client';
  import {
    LayoutDashboard, Users, ShieldCheck, ArrowLeftRight, ScrollText,
    Megaphone, Percent, Settings, LogOut, Menu, X, Bell, ChevronDown,
    Activity, Cpu
  } from 'lucide-svelte';

  let { children } = $props();

  // ─── State ───
  let sidebarOpen = $state(false);
  let sidebarCollapsed = $state(false);
  let isAuthorized = $state(false);
  let authChecked = $state(false);
  let currentUser = $state<{ name: string; email: string; role: string; avatar?: string } | null>(null);
  let isLoggingOut = $state(false);
  let userMenuOpen = $state(false);
  let notifMenuOpen = $state(false);

  // ─── Navigation ───
  const navItems = [
    { label: 'لوحة التحكم', icon: LayoutDashboard, href: '/dashboard', color: '#f5b544' },
    { label: 'المستخدمين', icon: Users, href: '/dashboard/users', color: '#3b82f6' },
    { label: 'التحقق KYC', icon: ShieldCheck, href: '/dashboard/kyc', color: '#a855f7' },
    { label: 'المعاملات', icon: ArrowLeftRight, href: '/dashboard/transactions', color: '#22d3a4' },
    { label: 'سجل المراجعة', icon: ScrollText, href: '/dashboard/audit-logs', color: '#3b82f6' },
    { label: 'الإعلانات', icon: Megaphone, href: '/dashboard/ads', color: '#f43f7a' },
    { label: 'الرسوم', icon: Percent, href: '/dashboard/fees', color: '#22d3a4' },
    { label: 'الإعدادات', icon: Settings, href: '/dashboard/settings', color: '#a855f7' },
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
    return parts.length >= 2 ? parts[0][0] + parts[1][0] : parts[0].slice(0, 2);
  });
  let sidebarWidth = $derived(sidebarCollapsed ? '72px' : '272px');

  // ─── Auth Guard ───
  $effect(() => {
    if (typeof window === 'undefined') return;
    const token = localStorage.getItem('admin_token');
    const userRaw = localStorage.getItem('admin_user');
    if (!token || !userRaw) { goto('/login'); return; }
    try {
      const user = JSON.parse(userRaw);
      if (user.role !== 'ADMIN') { clearTokens(); goto('/login'); return; }
      currentUser = user;
      isAuthorized = true;
    } catch {
      clearTokens(); goto('/login'); return;
    }
    authChecked = true;
  });

  // ─── Close menus on route change ───
  $effect(() => {
    currentPath;
    sidebarOpen = false;
    userMenuOpen = false;
    notifMenuOpen = false;
  });

  // ─── Close menus on outside click ───
  function handleClickOutside(e: MouseEvent) {
    const target = e.target as HTMLElement;
    if (!target.closest('.user-menu-container')) userMenuOpen = false;
    if (!target.closest('.notif-menu-container')) notifMenuOpen = false;
  }

  // ─── Logout ───
  async function handleLogout() {
    if (isLoggingOut) return;
    isLoggingOut = true;
    try { await fetch(`${API}/api/v1/auth/logout`, { method: 'POST' }); } catch {}
    clearTokens();
    goto('/login');
  }
</script>

<svelte:window onclick={handleClickOutside} />

{#if authChecked && isAuthorized}
  <div class="flex h-screen overflow-hidden relative" dir="rtl">

    <!-- Mobile Overlay -->
    {#if sidebarOpen}
      <div class="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden animate-fade-in" onclick={() => sidebarOpen = false} role="presentation"></div>
    {/if}

    <!-- Sidebar -->
    <aside class="fixed top-0 right-0 z-50 h-full flex flex-col bg-ink-950/95 backdrop-blur-2xl border-l transition-all duration-500 ease-[var(--ease-out-expo)]"
      style="width: {sidebarWidth}; border-color: var(--border-subtle); {sidebarOpen ? '' : 'transform: translateX(100%);'}"
      class:lg:translate-x-0={!sidebarOpen || true}
    >
      <!-- Logo Area -->
      <div class="flex items-center gap-3 h-16 shrink-0 transition-all duration-500" style="padding: 0 {sidebarCollapsed ? '1rem' : '1.5rem'};">
        <div class="w-9 h-9 rounded-xl bg-gradient-to-br from-[#f5b544] via-[#f43f7a] to-[#a855f7] flex items-center justify-center shadow-lg shrink-0">
          <span class="text-white font-bold text-sm">N</span>
        </div>
        {#if !sidebarCollapsed}
          <span class="text-aurora text-xl font-bold tracking-wide whitespace-nowrap overflow-hidden">NEXUS</span>
        {/if}
      </div>

      <div class="glass-divider mx-3"></div>

      <!-- Navigation -->
      <nav class="flex-1 overflow-y-auto scrollbar-none px-2 py-3 space-y-0.5">
        {#each navItems as item}
          {@const isActive = currentPath === item.href || (item.href !== '/dashboard' && currentPath.startsWith(item.href))}
          <a href={item.href} class="nav-link {isActive ? 'active' : ''}" onclick={() => sidebarOpen = false} title={sidebarCollapsed ? item.label : ''}>
            <item.icon size={20} class="shrink-0" />
            {#if !sidebarCollapsed}
              <span class="whitespace-nowrap overflow-hidden">{item.label}</span>
              {#if isActive}
                <span class="mr-auto w-1.5 h-1.5 rounded-full bg-[#f5b544] animate-pulse-soft shrink-0"></span>
              {/if}
            {/if}
          </a>
        {/each}
      </nav>

      <div class="glass-divider mx-3"></div>

      <!-- Sidebar User -->
      <div class="p-2 shrink-0">
        <div class="flex items-center gap-3 px-3 py-2.5 rounded-xl" style="background: var(--bg-overlay-5);">
          <div class="w-9 h-9 rounded-full bg-gradient-to-br from-[#f5b544] to-[#a855f7] flex items-center justify-center text-white text-xs font-bold shrink-0">
            {#if currentUser?.avatar}
              <img src={currentUser.avatar} alt={currentUser.name} class="w-full h-full rounded-full object-cover" />
            {:else}
              {userInitials}
            {/if}
          </div>
          {#if !sidebarCollapsed}
            <div class="flex-1 min-w-0">
              <p class="text-sm font-semibold text-[var(--text-primary)] truncate">{currentUser?.name ?? 'مدير'}</p>
              <span class="text-[10px] font-medium" style="color: var(--text-quaternary);">{currentUser?.email ?? ''}</span>
            </div>
          {/if}
        </div>
        <button class="nav-link w-full text-right mt-0.5" onclick={handleLogout} disabled={isLoggingOut}>
          <LogOut size={20} />
          {#if !sidebarCollapsed}
            <span>{isLoggingOut ? 'جاري الخروج...' : 'تسجيل الخروج'}</span>
          {/if}
        </button>
      </div>
    </aside>

    <!-- Main Area -->
    <div class="flex-1 flex flex-col min-w-0 transition-all duration-500" style="margin-right: {sidebarWidth};">
      <!-- Header -->
      <header class="sticky top-0 z-40 shrink-0 flex items-center justify-between px-6 bg-ink-950/85 backdrop-blur-2xl border-b" style="height: var(--header-height); border-color: var(--border-subtle);">
        <!-- Aurora highlight -->
        <div class="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-l from-transparent via-[#f5b544]/30 to-transparent"></div>

        <!-- Right side: hamburger + title -->
        <div class="flex items-center gap-4">
          <button class="lg:hidden p-2 rounded-xl transition-colors hover:bg-white/5" onclick={() => sidebarOpen = !sidebarOpen} aria-label="القائمة">
            {#if sidebarOpen}<X size={22} class="text-[var(--text-primary)]" />{:else}<Menu size={22} class="text-[var(--text-primary)]" />{/if}
          </button>
          <button class="hidden lg:flex p-2 rounded-xl transition-colors hover:bg-white/5" onclick={() => sidebarCollapsed = !sidebarCollapsed} aria-label="طي القائمة">
            <Menu size={20} style="color: var(--text-quaternary);" />
          </button>
          <div>
            <h1 class="text-lg font-bold text-[var(--text-primary)]">{pageTitle}</h1>
          </div>
        </div>

        <!-- Left side: notifications + user -->
        <div class="flex items-center gap-2">
          <!-- Notifications -->
          <div class="relative notif-menu-container">
            <button class="p-2 rounded-xl transition-colors hover:bg-white/5 relative" onclick={(e) => { e.stopPropagation(); notifMenuOpen = !notifMenuOpen; }} aria-label="الإشعارات">
              <Bell size={20} class="text-[var(--text-secondary)]" />
              <span class="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#f43f7a]"></span>
            </button>
            {#if notifMenuOpen}
              <div class="absolute left-0 top-full mt-2 w-72 panel p-0 z-50 animate-scale-in overflow-hidden">
                <div class="px-4 py-3 border-b" style="border-color: var(--border-subtle);">
                  <h3 class="font-bold text-sm">الإشعارات</h3>
                </div>
                <div class="p-4 text-center">
                  <p class="text-xs" style="color: var(--text-quaternary);">لا توجد إشعارات جديدة</p>
                </div>
              </div>
            {/if}
          </div>

          <!-- User Menu -->
          <div class="relative user-menu-container">
            <button class="flex items-center gap-3 p-1.5 rounded-xl transition-colors hover:bg-white/5" onclick={(e) => { e.stopPropagation(); userMenuOpen = !userMenuOpen; }}>
              <div class="w-9 h-9 rounded-full bg-gradient-to-br from-[#f5b544] to-[#a855f7] flex items-center justify-center text-white text-xs font-bold">
                {userInitials}
              </div>
              <div class="text-left hidden sm:block">
                <p class="text-sm font-semibold text-[var(--text-primary)] leading-tight">{currentUser?.name ?? 'مدير'}</p>
                <span class="pill-gold text-[10px] leading-none">مدير</span>
              </div>
              <ChevronDown size={14} class="text-[var(--text-quaternary)] hidden sm:block" />
            </button>

            {#if userMenuOpen}
              <div class="absolute left-0 top-full mt-2 w-48 panel p-2 z-50 animate-scale-in">
                <button class="nav-link w-full text-right" onclick={handleLogout} disabled={isLoggingOut}>
                  <LogOut size={18} />
                  <span>{isLoggingOut ? 'جاري الخروج...' : 'تسجيل الخروج'}</span>
                </button>
              </div>
            {/if}
          </div>
        </div>
      </header>

      <!-- Main Content -->
      <main class="flex-1 p-6 overflow-y-auto scrollbar-thin">
        {@render children()}
      </main>
    </div>
  </div>
{/if}
