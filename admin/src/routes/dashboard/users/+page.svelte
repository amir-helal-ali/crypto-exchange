<script lang="ts">
	import { onMount } from 'svelte';
	import { authGet, authPut } from '$lib/api/client';
	import { formatDate, debounce, statusConfigs } from '$lib/utils/helpers';
	import { addToast } from '$lib/stores/toast';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import SearchBar from '$lib/components/SearchBar.svelte';
	import Pagination from '$lib/components/Pagination.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import ErrorAlert from '$lib/components/ErrorAlert.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import { UserCheck, Shield, Mail } from 'lucide-svelte';
	import type { AdminUser } from '$lib/api/types';

	let users = $state<AdminUser[]>([]);
	let total = $state(0);
	let page = $state(1);
	let limit = $state(20);
	let search = $state('');
	let loading = $state(true);
	let error = $state('');

	let roleModal = $state(false);
	let selectedUser = $state<AdminUser | null>(null);
	let newRole = $state('');

	const roleLabels: Record<string, string> = { USER: 'مستخدم', ADMIN: 'مدير', VERIFIED_USER: 'مستخدم موثق' };

	onMount(() => loadUsers());

	async function loadUsers() {
		loading = true; error = '';
		const params = new URLSearchParams({ page: String(page), limit: String(limit) });
		if (search) params.set('search', search);
		const res = await authGet<AdminUser[]>(`/api/v1/admin/users?${params}`);
		if (res.success && res.data) {
			users = Array.isArray(res.data) ? res.data : [];
			total = res.total || users.length;
		} else { error = res.error || 'فشل تحميل المستخدمين'; }
		loading = false;
	}

	const debouncedSearch = debounce(() => { page = 1; loadUsers(); }, 300);

	function onSearch(v: string) { search = v; debouncedSearch(); }

	function openRoleModal(user: AdminUser) {
		selectedUser = user; newRole = user.role; roleModal = true;
	}

	async function changeRole() {
		if (!selectedUser || !newRole) return;
		const res = await authPut(`/api/v1/admin/user/${selectedUser.id}/role`, { role: newRole });
		if (res.success) {
			addToast('success', 'تم تحديث الدور بنجاح');
			roleModal = false; loadUsers();
		} else { addToast('error', res.error || 'فشل تحديث الدور'); }
	}

	async function verifyEmail(user: AdminUser) {
		const res = await authPut(`/api/v1/admin/user/${user.id}/verify-email`);
		if (res.success) { addToast('success', 'تم توثيق البريد'); loadUsers(); }
		else { addToast('error', res.error || 'فشل التوثيق'); }
	}
</script>

<PageHeader title="إدارة المستخدمين" subtitle="عرض وإدارة حسابات المستخدمين" />

<div class="flex items-center gap-4 mb-4">
	<div class="flex-1 max-w-sm"><SearchBar placeholder="بحث بالاسم أو البريد..." onchange={onSearch} /></div>
</div>

{#if error}
	<ErrorAlert message={error} onretry={loadUsers} />
{:else if loading}
	<div class="panel p-4"><div class="skeleton h-64"></div></div>
{:else if users.length === 0}
	<EmptyState message="لا يوجد مستخدمين" />
{:else}
	<div class="panel overflow-x-auto">
		<table class="data-table">
			<thead>
				<tr>
					<th>المستخدم</th><th>الدور</th><th>البريد</th><th>2FA</th><th>التسجيل</th><th>إجراءات</th>
				</tr>
			</thead>
			<tbody>
				{#each users as user}
					<tr>
						<td>
							<div class="flex items-center gap-2">
								<div class="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold"
									style="background: rgba(245,181,68,0.1); color: var(--gold);">
									{user.username?.[0]?.toUpperCase() || '?'}
								</div>
								<div><p class="font-medium text-sm">{user.username}</p><p class="text-xs text-[var(--ink-muted)]">{user.email}</p></div>
							</div>
						</td>
						<td><span class="pill pill-{user.role === 'ADMIN' ? 'approved' : user.role === 'VERIFIED_USER' ? 'pending' : 'inactive'}">{roleLabels[user.role] || user.role}</span></td>
						<td>{#if user.email_verified}<span class="text-[var(--mint)] text-xs">موثّق</span>{:else}<span class="text-[var(--ink-muted)] text-xs">غير موثّق</span>{/if}</td>
						<td>{#if user.two_fa_enabled}<span class="text-[var(--mint)] text-xs">مفعّل</span>{:else}<span class="text-[var(--ink-muted)] text-xs">معطّل</span>{/if}</td>
						<td class="text-xs text-[var(--ink-muted)]">{formatDate(user.created_at)}</td>
						<td>
							<div class="flex gap-2">
								<button class="btn-ghost text-xs" onclick={() => openRoleModal(user)}><Shield size={14} /></button>
								{#if !user.email_verified}<button class="btn-ghost text-xs" onclick={() => verifyEmail(user)}><Mail size={14} /></button>{/if}
							</div>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
	<Pagination {page} {total} {limit} onchange={(p) => { page = p; loadUsers(); }} />
{/if}

<Modal open={roleModal} title="تحديث دور المستخدم" onclose={() => roleModal = false}>
	{#snippet children()}
		<p class="text-sm text-[var(--ink-secondary)] mb-4">المستخدم: <strong>{selectedUser?.username}</strong></p>
		<select class="input-field" bind:value={newRole}>
			<option value="USER">مستخدم</option>
			<option value="VERIFIED_USER">مستخدم موثق</option>
			<option value="ADMIN">مدير</option>
		</select>
	{/snippet}
	{#snippet footer()}
		<button class="btn-secondary" onclick={() => roleModal = false}>إلغاء</button>
		<button class="btn-primary" onclick={changeRole}>تحديث</button>
	{/snippet}
</Modal>
