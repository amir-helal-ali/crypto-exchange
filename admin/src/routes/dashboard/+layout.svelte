<script lang="ts">
	import { isAuthenticated, getStoredUser, logout, createAdminStream } from '$lib/api/client';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import type { Snippet } from 'svelte';
	import LiveIndicator from '$lib/components/LiveIndicator.svelte';
	import {
		LayoutDashboard, Users, ShieldCheck, ArrowLeftRight, ScrollText,
		Megaphone, Percent, Settings, Lock, Activity, LogOut, ChevronLeft, ChevronRight
	} from 'lucide-svelte';

	let { children }: { children: Snippet } = $props();

	let user = $state<any>(null);
	let sidebarCollapsed = $state(false);
	let liveConnected = $state(false);
	let currentPage = $state('dashboard');
	let es: EventSource | null = $state(null);

	const navItems = [
		{ path: '/dashboard', label: 'لوحة التحكم', icon: LayoutDashboard, id: 'dashboard' },
		{ path: '/dashboard/users', label: 'المستخدمين', icon: Users, id: 'users' },
		{ path: '/dashboard/kyc', label: 'التحقق KYC', icon: ShieldCheck, id: 'kyc' },
		{ path: '/dashboard/transactions', label: 'المعاملات', icon: ArrowLeftRight, id: 'transactions' },
		{ path: '/dashboard/audit-logs', label: 'سجل العمليات', icon: ScrollText, id: 'audit-logs' },
		{ path: '/dashboard/ads', label: 'الإعلانات', icon: Megaphone, id: 'ads' },
		{ path: '/dashboard/fees', label: 'الرسوم', icon: Percent, id: 'fees' },
		{ path: '/dashboard/ssl', label: 'شهادات SSL', icon: Lock, id: 'ssl' },
		{ path: '/dashboard/metrics', label: 'الأداء', icon: Activity, id: 'metrics' },
		{ path: '/dashboard/settings', label: 'الإعدادات', icon: Settings, id: 'settings' },
	];

	onMount(() => {
		if (!isAuthenticated()) {
			goto('/login');
			return;
		}
		user = getStoredUser();

		// Detect current page
		const path = window.location.pathname;
		const match = navItems.find(n => path === n.path || (n.path !== '/dashboard' && path.startsWith(n.path)));
		currentPage = match?.id || 'dashboard';

		// Connect SSE
		connectSSE();

		return () => {
			es?.close();
		};
	});

	function connectSSE() {
		es = createAdminStream(['stats', 'audit']);
		if (es) {
			es.onopen = () => { liveConnected = true; };
			es.onerror = () => { liveConnected = false; };
			es.addEventListener('heartbeat', () => { liveConnected = true; });
		}
	}

	function navigate(path: string, id: string) {
		currentPage = id;
		goto(path);
	}
</script>

<div class="min-h-screen flex relative" style="z-index:1">
	<!-- Sidebar -->
	<aside
		class="fixed top-0 right-0 h-screen flex flex-col border-l transition-all duration-300"
		class:w-64={!sidebarCollapsed}
		class:w-20={sidebarCollapsed}
		style="background: var(--bg-surface); border-color: var(--glass-border); z-index: 50;"
	>
		<!-- Logo -->
		<div class="p-4 flex items-center gap-3 border-b" style="border-color: var(--glass-border)">
			<div class="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
				style="background: linear-gradient(135deg, rgba(245,181,68,0.2), rgba(168,85,247,0.2)); border: 1px solid rgba(245,181,68,0.15);">
				<span class="text-sm font-black text-aurora">N</span>
			</div>
			{#if !sidebarCollapsed}
				<div>
					<h2 class="text-sm font-black text-aurora">NEXUS</h2>
					<p class="text-[10px] text-[var(--ink-faint)]">لوحة الإدارة</p>
				</div>
			{/if}
		</div>

		<!-- Navigation -->
		<nav class="flex-1 p-3 space-y-1 overflow-y-auto scrollbar-thin">
			{#each navItems as item}
				<button
					class="nav-link {currentPage === item.id ? 'nav-link-active' : ''}"
					onclick={() => navigate(item.path, item.id)}
					title={item.label}
				>
					<item.icon size={18} class="flex-shrink-0" />
					{#if !sidebarCollapsed}
						<span>{item.label}</span>
					{/if}
				</button>
			{/each}
		</nav>

		<!-- User Section -->
		<div class="p-3 border-t" style="border-color: var(--glass-border)">
			{#if !sidebarCollapsed}
				<div class="flex items-center gap-3 px-2 py-2">
					<div class="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold"
						style="background: rgba(245,181,68,0.15); color: var(--gold);">
						{user?.username?.[0]?.toUpperCase() || 'A'}
					</div>
					<div class="flex-1 min-w-0">
						<p class="text-xs font-medium truncate">{user?.username || 'المدير'}</p>
						<p class="text-[10px] text-[var(--ink-muted)] truncate">{user?.email || ''}</p>
					</div>
					<button onclick={logout} class="text-[var(--ink-muted)] hover:text-[var(--rose)] transition-colors" title="تسجيل الخروج">
						<LogOut size={14} />
					</button>
				</div>
			{:else}
				<button onclick={logout} class="nav-link justify-center" title="تسجيل الخروج">
					<LogOut size={18} />
				</button>
			{/if}
		</div>
	</aside>

	<!-- Main Content -->
	<div class="flex-1 transition-all duration-300" class:mr-64={!sidebarCollapsed} class:mr-20={sidebarCollapsed}>
		<!-- Top Bar -->
		<header class="sticky top-0 h-14 flex items-center justify-between px-6 border-b backdrop-blur-xl"
			style="background: rgba(3,5,9,0.8); border-color: var(--glass-border); z-index: 40;">
			<div class="flex items-center gap-4">
				<button
					class="btn-ghost p-1.5"
					onclick={() => sidebarCollapsed = !sidebarCollapsed}
				>
					{#if sidebarCollapsed}<ChevronLeft size={18} />{:else}<ChevronRight size={18} />{/if}
				</button>
				<LiveIndicator label={liveConnected ? 'متصل مباشر' : 'غير متصل'} />
			</div>
			<div class="flex items-center gap-3">
				<span class="text-xs text-[var(--ink-muted)] tabular-nums">
					{new Intl.DateTimeFormat('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }).format(new Date())}
				</span>
			</div>
		</header>

		<!-- Page Content -->
		<main class="p-6">
			{@render children()}
		</main>
	</div>
</div>
