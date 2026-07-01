<script lang="ts">
	import { onMount } from 'svelte';
	import { authGet, authPost, authPut, authDelete, authUpload } from '$lib/api/client';
	import { formatDate } from '$lib/utils/helpers';
	import { addToast } from '$lib/stores/toast';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import ErrorAlert from '$lib/components/ErrorAlert.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import { Megaphone, Plus, Trash2, Edit3, Upload } from 'lucide-svelte';
	import type { Ad } from '$lib/api/types';

	let ads = $state<Ad[]>([]);
	let loading = $state(true);
	let error = $state('');
	let adModal = $state(false);
	let editingAd = $state<Ad | null>(null);
	let form = $state({ title: '', link: '', button_text: '', button_link: '', position: 'hero', active: true, sort_order: 0 });
	let imageFile = $state<File | null>(null);
	let imageUrl = $state('');
	let uploading = $state(false);

	const positionLabels: Record<string, string> = { hero: 'رئيسي', section: 'قسم', bottom: 'أسفل', floating: 'عائم' };

	onMount(() => loadAds());

	async function loadAds() {
		loading = true; error = '';
		const res = await authGet<Ad[]>('/api/v1/admin/ads');
		if (res.success && res.data) { ads = Array.isArray(res.data) ? res.data : []; }
		else { error = res.error || 'فشل تحميل الإعلانات'; }
		loading = false;
	}

	function openCreate() {
		editingAd = null; form = { title: '', link: '', button_text: '', button_link: '', position: 'hero', active: true, sort_order: 0 }; imageUrl = ''; imageFile = null;
		adModal = true;
	}

	function openEdit(ad: Ad) {
		editingAd = ad;
		form = { title: ad.title, link: ad.link, button_text: ad.button_text, button_link: ad.button_link, position: ad.position, active: ad.active, sort_order: ad.sort_order };
		imageUrl = ad.image_url; imageFile = null;
		adModal = true;
	}

	async function handleImageUpload(e: Event) {
		const input = e.target as HTMLInputElement;
		if (input.files?.[0]) {
			imageFile = input.files[0];
			uploading = true;
			const res = await authUpload<{ url: string }>('/api/v1/admin/ads/upload', imageFile);
			if (res.success && res.data) { imageUrl = res.data.url || (res.data as any).image_url || ''; addToast('success', 'تم رفع الصورة'); }
			else { addToast('error', 'فشل رفع الصورة'); }
			uploading = false;
		}
	}

	async function saveAd() {
		const body = { ...form, image_url: imageUrl };
		let res;
		if (editingAd) {
			res = await authPut(`/api/v1/admin/ads/${editingAd.id}`, body);
		} else {
			res = await authPost('/api/v1/admin/ads', body);
		}
		if (res.success) { addToast('success', editingAd ? 'تم تحديث الإعلان' : 'تم إنشاء الإعلان'); adModal = false; loadAds(); }
		else { addToast('error', res.error || 'فشل الحفظ'); }
	}

	async function deleteAd(ad: Ad) {
		if (!confirm('هل تريد حذف هذا الإعلان؟')) return;
		const res = await authDelete(`/api/v1/admin/ads/${ad.id}`);
		if (res.success) { addToast('success', 'تم حذف الإعلان'); loadAds(); }
		else { addToast('error', res.error || 'فشل الحذف'); }
	}
</script>

<PageHeader title="الإعلانات" subtitle="إدارة الإعلانات على المنصة" />

<div class="flex justify-end mb-4">
	<button class="btn-primary text-sm" onclick={openCreate}><Plus size={16} />إعلان جديد</button>
</div>

{#if error}
	<ErrorAlert message={error} onretry={loadAds} />
{:else if loading}
	<div class="panel p-4"><div class="skeleton h-64"></div></div>
{:else if ads.length === 0}
	<EmptyState message="لا توجد إعلانات" />
{:else}
	<div class="grid gap-4">
		{#each ads as ad}
			<div class="panel p-4 flex items-center gap-4">
				{#if ad.image_url}
					<img src={ad.image_url} alt={ad.title} class="w-16 h-16 rounded-lg object-cover flex-shrink-0" />
				{:else}
					<div class="w-16 h-16 rounded-lg flex items-center justify-center flex-shrink-0" style="background: rgba(245,181,68,0.1);"><Megaphone size={20} style="color: var(--gold)" /></div>
				{/if}
				<div class="flex-1 min-w-0">
					<div class="flex items-center gap-2 mb-1">
						<span class="font-medium text-sm">{ad.title}</span>
						<span class="pill pill-{ad.active ? 'active' : 'inactive'}">{ad.active ? 'نشط' : 'غير نشط'}</span>
					</div>
					<p class="text-xs text-[var(--ink-muted)]">{positionLabels[ad.position] || ad.position} — ترتيب: {ad.sort_order}</p>
				</div>
				<div class="flex gap-2">
					<button class="btn-ghost text-xs" onclick={() => openEdit(ad)}><Edit3 size={14} /></button>
					<button class="btn-ghost text-xs text-[var(--rose)]" onclick={() => deleteAd(ad)}><Trash2 size={14} /></button>
				</div>
			</div>
		{/each}
	</div>
{/if}

<Modal open={adModal} title={editingAd ? 'تعديل الإعلان' : 'إعلان جديد'} onclose={() => adModal = false}>
	{#snippet children()}
		<div class="space-y-4">
			<div><label class="text-xs font-medium text-[var(--ink-secondary)] block mb-1">العنوان</label><input class="input-field" bind:value={form.title} /></div>
			<div><label class="text-xs font-medium text-[var(--ink-secondary)] block mb-1">الرابط</label><input class="input-field" bind:value={form.link} placeholder="https://" /></div>
			<div class="grid grid-cols-2 gap-3">
				<div><label class="text-xs font-medium text-[var(--ink-secondary)] block mb-1">نص الزر</label><input class="input-field" bind:value={form.button_text} /></div>
				<div><label class="text-xs font-medium text-[var(--ink-secondary)] block mb-1">رابط الزر</label><input class="input-field" bind:value={form.button_link} placeholder="https://" /></div>
			</div>
			<div class="grid grid-cols-2 gap-3">
				<div><label class="text-xs font-medium text-[var(--ink-secondary)] block mb-1">الموضع</label>
					<select class="input-field" bind:value={form.position}>
						<option value="hero">رئيسي</option><option value="section">قسم</option><option value="bottom">أسفل</option><option value="floating">عائم</option>
					</select>
				</div>
				<div><label class="text-xs font-medium text-[var(--ink-secondary)] block mb-1">الترتيب</label><input type="number" class="input-field" bind:value={form.sort_order} /></div>
			</div>
			<div>
				<label class="text-xs font-medium text-[var(--ink-secondary)] block mb-1">الصورة</label>
				<input type="file" accept="image/*" class="input-field text-xs" onchange={handleImageUpload} disabled={uploading} />
				{#if imageUrl}<img src={imageUrl} alt="preview" class="mt-2 w-32 h-20 rounded-lg object-cover" />{/if}
			</div>
			<label class="flex items-center gap-2 cursor-pointer"><input type="checkbox" bind:checked={form.active} /><span class="text-sm">نشط</span></label>
		</div>
	{/snippet}
	{#snippet footer()}
		<button class="btn-secondary" onclick={() => adModal = false}>إلغاء</button>
		<button class="btn-primary" onclick={saveAd}>{editingAd ? 'تحديث' : 'إنشاء'}</button>
	{/snippet}
</Modal>
