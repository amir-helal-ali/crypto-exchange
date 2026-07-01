<script lang="ts">
	import { onMount } from 'svelte';
	import { authGet, authPut, createAdminStream } from '$lib/api/client';
	import { toast } from '$lib/stores/toast';
	import { formatNumber, formatDate, getInitials, statusConfigs, debounce } from '$lib/utils/helpers';
	import StatCard from '$lib/components/StatCard.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import DataTable from '$lib/components/DataTable.svelte';
	import Pagination from '$lib/components/Pagination.svelte';
	import SearchBar from '$lib/components/SearchBar.svelte';
	import ErrorAlert from '$lib/components/ErrorAlert.svelte';
	import type { AdminUser, UserStats, PaginatedResponse } from '$lib/api/types';
	import { Users, ShieldCheck, Mail, UserCheck, RefreshCw } from 'lucide-svelte';

	let users = $state<AdminUser[]>([]);
	let stats = $state<UserStats | null>(null);
	let loading = $state(true);
	let error = $state('');
	let page = $state(1);
	let totalPages = $state(1);
	let totalItems = $state(0);
	let search = $state('');
	let roleFilter = $state('');
	let kycFilter = $state('');
	let eventSource: EventSource | null = null;

	const filters = [
		{
			key: 'role',
			label: 'الدور',
			options: [
				{ value: 'USER', label: 'مستخدم' },
				{ value: 'ADMIN', label: 'مدير' },
				{ value: 'VERIFIED_USER', label: 'موثّق' }
			]
		},
		{
			key: 'kyc',
			label: 'حالة KYC',
			options: [
				{ value: 'PENDING', label: 'قيد الانتظار' },
				{ value: 'APPROVED', label: 'مقبول' },
				{ value: 'REJECTED', label: 'مرفوض' },
				{ value: 'NONE', label: 'لا يوجد' }
			]
		}
	];
	let filterValues = $state<Record<string, string>>({});

	async function loadUsers() {
		loading = true;
		error = '';
		let path = `/api/v1/admin/users?page=${page}&limit=20`;
		if (search) path += `&search=${encodeURIComponent(search)}`;
		const res = await authGet<AdminUser[]>(path);
		if (res.success && res.data) {
			users = (res as any).data || [];
			totalItems = (res as any).total || 0;
			totalPages = Math.ceil(totalItems / 20);
		} else {
			error = res.error || 'فشل تحميل المستخدمين';
		}
		loading = false;
	}

	async function loadStats() {
		const res = await authGet<UserStats>('/api/v1/admin/users?limit=1');
		if (res.success) {
			stats = (res as any).stats || null;
		}
	}

	async function toggleRole(user: AdminUser) {
		const newRole = user.role === 'ADMIN' ? 'USER' : 'ADMIN';
		const res = await authPut(`/api/v1/admin/user/${user.id}/role`, { role: newRole });
		if (res.success) {
			toast.success(`تم تحديث دور ${user.username}`);
			loadUsers();
		} else {
			toast.error(res.error || 'فشل تحديث الدور');
		}
	}

	async function verifyEmail(user: AdminUser) {
		const res = await authPut(`/api/v1/admin/user/${user.id}/verify-email`);
		if (res.success) {
			toast.success(`تم توثيق بريد ${user.username}`);
			loadUsers();
		} else {
			toast.error(res.error || 'فشل توثيق البريد');
		}
	}

	const debouncedSearch = debounce(() => { page = 1; loadUsers(); }, 350);

	$effect(() => {
		if (search) debouncedSearch();
		else { page = 1; loadUsers(); }
	});

	$effect(() => {
		roleFilter = filterValues.role || '';
		kycFilter = filterValues.kyc || '';
		if (roleFilter || kycFilter) { page = 1; loadUsers(); }
	});

	$effect(() => { if (page > 1) loadUsers(); });

	onMount(() => {
		loadUsers();
		eventSource = createAdminStream(['users', 'user-stats']);
		eventSource?.addEventListener('users', () => { loadUsers(); });
		return () => { eventSource?.close(); };
	});
</script>

<PageHeader title="إدارة المستخدمين" subtitle="عرض وإدارة حسابات المستخدمين">
	<button class="btn-ghost" onclick={loadUsers} disabled={loading}>
		<RefreshCw size={16} class={loading ? 'animate-spin' : ''} />
	</button>
</PageHeader>

<!-- Stats -->
<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
	<StatCard label="إجمالي المستخدمين" value={stats ? formatNumber(stats.total) : '—'} icon={Users} iconColor="#a855f7" iconBg="rgba(168,85,247,0.15)" chartColor="#a855f7" chartSeed={10} loading={loading} />
	<StatCard label="المدراء" value={stats ? formatNumber(stats.admins) : '—'} icon={ShieldCheck} iconColor="#f5b544" iconBg="rgba(245,181,68,0.15)" chartColor="#f5b544" chartSeed={20} loading={loading} />
	<StatCard label="بريد موثّق" value={stats ? formatNumber(stats.emailVerified) : '—'} icon={Mail} iconColor="#3b82f6" iconBg="rgba(59,130,246,0.15)" chartColor="#3b82f6" chartSeed={30} loading={loading} />
	<StatCard label="KYC موثّق" value={stats ? formatNumber(stats.kycVerified) : '—'} icon={UserCheck} iconColor="#22d3a4" iconBg="rgba(34,211,164,0.15)" chartColor="#22d3a4" chartSeed={40} loading={loading} />
</div>

{#if error}
	<ErrorAlert message={error} onclose={() => (error = '')} />
{/if}

<SearchBar bind:value={search} placeholder="بحث بالاسم أو البريد..." {filters} bind:filterValues />

<DataTable headers={['المستخدم', 'الدور', 'البريد', 'الحالة', 'التسجيل', 'إجراءات']} {loading} emptyIcon={Users} emptyTitle="لا يوجد مستخدمين">
	{#each users as user}
		<tr>
			<td>
				<div class="flex items-center gap-3">
					<div class="w-9 h-9 rounded-lg bg-accent-violet/15 border border-accent-violet/20 flex items-center justify-center flex-shrink-0">
						<span class="text-xs font-bold text-accent-violet">{getInitials(user.username)}</span>
					</div>
					<div>
						<p class="text-sm font-medium text-ink-primary">{user.username}</p>
						<p class="text-xs text-ink-muted">#{user.id}</p>
					</div>
				</div>
			</td>
			<td>
				<span class={user.role === 'ADMIN' ? 'pill-approved' : user.role === 'VERIFIED_USER' ? 'pill-pending' : 'pill-inactive'}>
					{user.role === 'ADMIN' ? 'مدير' : user.role === 'VERIFIED_USER' ? 'موثّق' : 'مستخدم'}
				</span>
			</td>
			<td>
				<div class="flex items-center gap-1.5">
					<span class="text-sm text-ink-secondary" dir="ltr">{user.email}</span>
					{#if user.email_verified}
						<Mail size={12} class="text-accent-mint" />
					{/if}
				</div>
			</td>
			<td>
				<span class={(statusConfigs[user.kyc_status || 'NONE']?.pillClass || 'pill-none')}>
					{statusConfigs[user.kyc_status || 'NONE']?.label || 'لا يوجد'}
				</span>
			</td>
			<td>
				<span class="text-sm text-ink-muted">{formatDate(user.created_at)}</span>
			</td>
			<td>
				<div class="flex items-center gap-2">
					<button class="btn-ghost text-xs px-2 py-1" onclick={() => toggleRole(user)}>
						{user.role === 'ADMIN' ? 'إزالة صلاحية' : 'ترقية'}
					</button>
					{#if !user.email_verified}
						<button class="btn-ghost text-xs px-2 py-1 text-accent-mint" onclick={() => verifyEmail(user)}>
							توثيق البريد
						</button>
					{/if}
				</div>
			</td>
		</tr>
	{/each}
</DataTable>

<Pagination bind:page {totalPages} {totalItems} itemLabel="مستخدم" />
