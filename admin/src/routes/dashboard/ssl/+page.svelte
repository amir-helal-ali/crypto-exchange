<script lang="ts">
	import { onMount } from 'svelte';
	import { authGet, authPost } from '$lib/api/client';
	import { formatDate, formatUptime } from '$lib/utils/helpers';
	import { addToast } from '$lib/stores/toast';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import ErrorAlert from '$lib/components/ErrorAlert.svelte';
	import { Lock, ShieldCheck, AlertTriangle, RefreshCw, Download, Zap } from 'lucide-svelte';
	import type { SSLStatus } from '$lib/api/types';

	let sslStatus = $state<SSLStatus | null>(null);
	let loading = $state(true);
	let error = $state('');
	let generating = $state(false);
	let renewing = $state(false);
	let showGenerate = $state(false);
	let genDomains = $state('');
	let genEmail = $state('');

	onMount(() => loadStatus());

	async function loadStatus() {
		loading = true; error = '';
		const res = await authGet<SSLStatus>('/api/v1/admin/ssl/status');
		if (res.success && res.data) { sslStatus = res.data; }
		else { error = res.error || 'فشل تحميل حالة SSL'; }
		loading = false;
	}

	async function generateSSL() {
		generating = true;
		const res = await authPost('/api/v1/admin/ssl/generate', { domains: genDomains.split(',').map(d => d.trim()), email: genEmail });
		if (res.success) { addToast('success', 'تم توليد شهادة SSL'); showGenerate = false; loadStatus(); }
		else { addToast('error', res.error || 'فشل التوليد'); }
		generating = false;
	}

	async function renewSSL() {
		renewing = true;
		const res = await authPost('/api/v1/admin/ssl/renew', {});
		if (res.success) { addToast('success', 'تم تجديد الشهادة'); loadStatus(); }
		else { addToast('error', res.error || 'فشل التجديد'); }
		renewing = false;
	}

	async function installSSL() {
		const res = await authPost('/api/v1/admin/ssl/install', {});
		if (res.success) { addToast('success', 'تم تثبيت الشهادة'); loadStatus(); }
		else { addToast('error', res.error || 'فشل التثبيت'); }
	}

	const healthColors: Record<string, string> = { healthy: '#22d3a4', warning: '#f5b544', critical: '#fb7185', expired: '#fb7185' };
	const healthLabels: Record<string, string> = { healthy: 'سليم', warning: 'تحذير', critical: 'خطر', expired: 'منتهي' };
</script>

<PageHeader title="شهادات SSL" subtitle="إدارة شهادات الأمان" />

{#if loading}
	<div class="panel p-4"><div class="skeleton h-64"></div></div>
{:else if error}
	<ErrorAlert message={error} onretry={loadStatus} />
{:else if sslStatus}
	<!-- Status Card -->
	<div class="panel p-6 mb-6" class:panel-mint={sslStatus.health === 'healthy'} class:panel-glow={sslStatus.health === 'warning'} class:panel-rose={sslStatus.health === 'critical' || sslStatus.health === 'expired'}>
		<div class="flex items-center gap-4 mb-6">
			<div class="w-14 h-14 rounded-xl flex items-center justify-center" style="background: {healthColors[sslStatus.health]}15;">
				{#if sslStatus.health === 'healthy'}<ShieldCheck size={28} style="color: {healthColors[sslStatus.health]}" />
				{:else}<AlertTriangle size={28} style="color: {healthColors[sslStatus.health]}" />{/if}
			</div>
			<div>
				<h2 class="text-lg font-bold">حالة SSL: <span style="color: {healthColors[sslStatus.health]}">{healthLabels[sslStatus.health] || sslStatus.health}</span></h2>
				<p class="text-sm text-[var(--ink-muted)]">{sslStatus.enabled ? 'SSL مفعّل' : 'SSL معطّل'} {#if sslStatus.issuer_org}— {sslStatus.issuer_org}{/if}</p>
			</div>
		</div>

		<div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
			{#if sslStatus.subject}<div><p class="text-xs text-[var(--ink-muted)]">الموضوع</p><p class="text-sm font-medium">{sslStatus.subject}</p></div>{/if}
			{#if sslStatus.days_remaining != null}<div><p class="text-xs text-[var(--ink-muted)]">الأيام المتبقية</p><p class="text-sm font-bold tabular-nums" style="color: {healthColors[sslStatus.health]}">{sslStatus.days_remaining} يوم</p></div>{/if}
			{#if sslStatus.not_after}<div><p class="text-xs text-[var(--ink-muted)]">تاريخ الانتهاء</p><p class="text-sm">{formatDate(sslStatus.not_after)}</p></div>{/if}
			{#if sslStatus.key_algorithm}<div><p class="text-xs text-[var(--ink-muted)]">خوارزمية المفتاح</p><p class="text-sm">{sslStatus.key_algorithm}</p></div>{/if}
		</div>

		{#if sslStatus.domains?.length}
			<div class="mb-6">
				<p class="text-xs text-[var(--ink-muted)] mb-2">النطاقات المشمولة</p>
				<div class="flex flex-wrap gap-2">
					{#each sslStatus.domains as domain}
						<span class="pill pill-{sslStatus.health === 'healthy' ? 'active' : 'pending'}">{domain}</span>
					{/each}
				</div>
			</div>
		{/if}

		<div class="flex gap-3">
			{#if sslStatus.exists}
				<button class="btn-secondary text-sm" onclick={renewSSL} disabled={renewing}><RefreshCw size={14} />تجديد</button>
				<button class="btn-secondary text-sm" onclick={installSSL}><Download size={14} />تثبيت</button>
			{:else}
				<button class="btn-primary text-sm" onclick={() => showGenerate = true}><Zap size={14} />توليد شهادة</button>
			{/if}
		</div>
	</div>

	{#if showGenerate}
		<div class="panel p-6">
			<h3 class="text-sm font-bold mb-4">توليد شهادة SSL جديدة</h3>
			<div class="space-y-4">
				<div><label class="text-xs font-medium text-[var(--ink-secondary)] block mb-1">النطاقات (مفصولة بفاصلة)</label><input class="input-field" placeholder="example.com, www.example.com" bind:value={genDomains} /></div>
				<div><label class="text-xs font-medium text-[var(--ink-secondary)] block mb-1">البريد الإلكتروني</label><input class="input-field" type="email" placeholder="admin@example.com" bind:value={genEmail} /></div>
				<div class="flex gap-3"><button class="btn-primary" onclick={generateSSL} disabled={generating}>{generating ? 'جاري التوليد...' : 'توليد'}</button><button class="btn-secondary" onclick={() => showGenerate = false}>إلغاء</button></div>
			</div>
		</div>
	{/if}
{/if}
