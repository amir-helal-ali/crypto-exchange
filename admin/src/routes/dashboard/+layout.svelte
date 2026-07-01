<script lang="ts">
        import { onMount } from 'svelte';
        import { goto } from '$app/navigation';
        import { isAuthenticated, getStoredUser, logout, createAdminStream } from '$lib/api/client';
        import { toast } from '$lib/stores/toast';
        import {
                LayoutDashboard, Users, ShieldCheck, ArrowLeftRight, ScrollText,
                Megaphone, Coins, Settings, ChevronRight, ChevronLeft,
                Bell, Menu, LogOut, X
        } from 'lucide-svelte';
        import LiveIndicator from '$lib/components/LiveIndicator.svelte';

        let { children } = $props<{ children: import('svelte').Snippet }>();

        let user = $state<any>(null);
        let sidebarOpen = $state(true);
        let mobileSidebarOpen = $state(false);
        let liveConnected = $state(false);
        let eventSource: EventSource | null = null;
        let showUserMenu = $state(false);
        let showNotifs = $state(false);

        const navItems = [
                { href: '/dashboard', icon: LayoutDashboard, label: 'لوحة التحكم' },
                { href: '/dashboard/users', icon: Users, label: 'المستخدمين' },
                { href: '/dashboard/kyc', icon: ShieldCheck, label: 'التحقق KYC' },
                { href: '/dashboard/transactions', icon: ArrowLeftRight, label: 'المعاملات' },
                { href: '/dashboard/audit-logs', icon: ScrollText, label: 'سجل المراجعة' },
                { href: '/dashboard/ads', icon: Megaphone, label: 'الإعلانات' },
                { href: '/dashboard/fees', icon: Coins, label: 'الرسوم' },
                { href: '/dashboard/settings', icon: Settings, label: 'الإعدادات' }
        ];

        onMount(() => {
                if (!isAuthenticated()) {
                        goto('/login');
                        return;
                }
                user = getStoredUser();
                if (user?.role !== 'ADMIN') {
                        logout();
                        return;
                }

                // Connect SSE
                eventSource = createAdminStream(['stats']);
                if (eventSource) {
                        eventSource.onopen = () => { liveConnected = true; };
                        eventSource.onerror = () => { liveConnected = false; };
                }

                return () => {
                        eventSource?.close();
                };
        });

        function handleLogout() {
                eventSource?.close();
                logout();
        }
</script>

<div class="flex h-screen overflow-hidden relative">
        <!-- Mobile Overlay -->
        {#if mobileSidebarOpen}
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div
                        class="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
                        onclick={() => (mobileSidebarOpen = false)}
                        role="presentation"
                ></div>
        {/if}

        <!-- Sidebar -->
        <aside
                class="fixed lg:static inset-y-0 right-0 z-50 flex flex-col h-full
                        bg-ink-900/80 backdrop-blur-xl border-l border-white/6
                        transition-all duration-300 ease-[var(--ease-out)]
                        {sidebarOpen ? 'w-[272px]' : 'w-[72px]'}
                        {mobileSidebarOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}"
        >
                <!-- Sidebar Header -->
                <div class="flex items-center gap-3 px-5 h-16 border-b border-white/6 flex-shrink-0">
                        <div class="w-9 h-9 rounded-xl bg-gradient-to-br from-accent-gold/30 to-accent-violet/20 border border-accent-gold/20 flex items-center justify-center flex-shrink-0">
                                <span class="text-sm font-extrabold text-aurora">N</span>
                        </div>
                        {#if sidebarOpen}
                                <span class="text-lg font-extrabold text-aurora whitespace-nowrap">NEXUS</span>
                        {/if}
                        <!-- Collapse Toggle (Desktop) -->
                        <button
                                class="hidden lg:flex items-center justify-center w-6 h-6 rounded-md bg-white/5 hover:bg-white/10 text-ink-muted hover:text-ink-primary transition-all mr-auto"
                                onclick={() => (sidebarOpen = !sidebarOpen)}
                        >
                                {#if sidebarOpen}<ChevronRight size={14} />{:else}<ChevronLeft size={14} />{/if}
                        </button>
                        <!-- Close (Mobile) -->
                        <button
                                class="lg:hidden text-ink-muted hover:text-ink-primary transition-colors mr-auto"
                                onclick={() => (mobileSidebarOpen = false)}
                        >
                                <X size={18} />
                        </button>
                </div>

                <!-- Nav Items -->
                <nav class="flex-1 overflow-y-auto scrollbar-none py-3 px-3">
                        <div class="flex flex-col gap-1">
                                {#each navItems as item}
                                        {@const isActive = typeof window !== 'undefined' && window.location.pathname === item.href}
                                        <a
                                                href={item.href}
                                                class="nav-link {isActive ? 'nav-link-active' : ''}"
                                                onclick={() => (mobileSidebarOpen = false)}
                                        >
                                                <item.icon size={20} class="flex-shrink-0" />
                                                {#if sidebarOpen}
                                                        <span class="whitespace-nowrap">{item.label}</span>
                                                {/if}
                                        </a>
                                {/each}
                        </div>
                </nav>

                <!-- User Section -->
                <div class="border-t border-white/6 p-3 flex-shrink-0">
                        {#if user}
                                <div class="flex items-center gap-3 px-2">
                                        <div class="w-9 h-9 rounded-xl bg-accent-gold/15 border border-accent-gold/20 flex items-center justify-center flex-shrink-0">
                                                <span class="text-xs font-bold text-accent-gold">{user.username?.[0]?.toUpperCase() || 'A'}</span>
                                        </div>
                                        {#if sidebarOpen}
                                                <div class="flex-1 min-w-0">
                                                        <p class="text-sm font-bold text-ink-primary truncate">{user.username}</p>
                                                        <p class="text-xs text-ink-muted truncate">{user.email}</p>
                                                </div>
                                                <button
                                                        class="text-ink-muted hover:text-accent-rose transition-colors"
                                                        onclick={handleLogout}
                                                        title="تسجيل الخروج"
                                                >
                                                        <LogOut size={16} />
                                                </button>
                                        {/if}
                                </div>
                        {/if}
                </div>
        </aside>

        <!-- Main Area -->
        <div class="flex-1 flex flex-col min-w-0">
                <!-- Header -->
                <header class="sticky top-0 z-30 h-16 flex items-center gap-4 px-6 border-b border-white/6 bg-ink-950/80 backdrop-blur-xl flex-shrink-0">
                        <!-- Topbar Highlight Gradient -->
                        <div class="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-l from-accent-gold/30 via-accent-violet/20 to-transparent"></div>

                        <!-- Mobile Menu Toggle -->
                        <button
                                class="lg:hidden text-ink-secondary hover:text-ink-primary transition-colors"
                                onclick={() => (mobileSidebarOpen = true)}
                        >
                                <Menu size={20} />
                        </button>

                        <div class="flex-1"></div>

                        <!-- Live Indicator -->
                        <LiveIndicator connected={liveConnected} />

                        <!-- Notifications -->
                        <div class="relative">
                                <button
                                        class="nav-link px-2 py-1.5 relative"
                                        onclick={() => { showNotifs = !showNotifs; showUserMenu = false; }}
                                >
                                        <Bell size={18} />
                                </button>
                        </div>

                        <!-- User Menu -->
                        <div class="relative">
                                <button
                                        class="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/5 transition-colors"
                                        onclick={() => { showUserMenu = !showUserMenu; showNotifs = false; }}
                                >
                                        <div class="w-7 h-7 rounded-lg bg-accent-gold/15 flex items-center justify-center">
                                                <span class="text-xs font-bold text-accent-gold">{user?.username?.[0]?.toUpperCase() || 'A'}</span>
                                        </div>
                                </button>
                                {#if showUserMenu}
                                        <div class="absolute left-0 top-full mt-2 w-48 panel p-2 animate-scale-in">
                                                <button
                                                        class="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-ink-secondary hover:bg-white/5 hover:text-ink-primary transition-colors"
                                                        onclick={handleLogout}
                                                >
                                                        <LogOut size={16} />
                                                        تسجيل الخروج
                                                </button>
                                        </div>
                                {/if}
                        </div>
                </header>

                <!-- Page Content -->
                <main class="flex-1 overflow-y-auto p-6 relative">
                        {@render children()}
                </main>
        </div>
</div>
