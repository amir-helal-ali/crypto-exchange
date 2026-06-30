<script lang="ts">
  import { onMount } from 'svelte';
  import {
    Megaphone, Plus, Search, Pencil, Trash2, ToggleLeft, ToggleRight,
    Loader2, AlertCircle, X, ImagePlus, Link, ArrowUpDown, Eye, EyeOff, Upload
  } from 'lucide-svelte';
  import { authGet, authPost, authPut, authDelete, authUpload, API } from '$lib/api/client';
  import type { Ad } from '$lib/api/types';
  import Modal from '$lib/components/Modal.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';

  type Position = 'hero' | 'section' | 'bottom' | 'floating';

  let ads = $state<Ad[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let searchQuery = $state('');
  let viewMode = $state<'grid' | 'list'>('grid');
  let formOpen = $state(false);
  let editingId = $state<number | null>(null);
  let saving = $state(false);
  let deleting = $state<number | null>(null);
  let toggling = $state<number | null>(null);

  let formTitle = $state('');
  let formImage = $state('');
  let formPosition = $state<Position>('hero');
  let formSortOrder = $state(0);
  let formLink = $state('');
  let formButtonText = $state('');
  let formButtonLink = $state('');
  let formActive = $state(true);

  const positionConfig: Record<Position, { label: string; pillClass: string; color: string; bg: string }> = {
    hero: { label: 'رئيسي', pillClass: 'pill-gold', color: '#f5b544', bg: 'rgba(245,181,68,0.12)' },
    section: { label: 'قسم', pillClass: 'pill-azure', color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
    bottom: { label: 'سفلي', pillClass: 'pill-mint', color: '#22d3a4', bg: 'rgba(34,211,164,0.12)' },
    floating: { label: 'عائم', pillClass: 'pill-violet', color: '#a855f7', bg: 'rgba(168,85,247,0.12)' }
  };

  async function fetchAds() {
    loading = true; error = null;
    try {
      const res = await authGet('/api/v1/admin/ads');
      if (!res.ok) throw new Error('فشل تحميل الإعلانات');
      const json = await res.json();
      if (json.success) ads = json.data;
    } catch (e: any) { error = e.message; }
    finally { loading = false; }
  }

  function openCreateForm() {
    editingId = null; formTitle = ''; formImage = ''; formPosition = 'hero';
    formSortOrder = 0; formLink = ''; formButtonText = ''; formButtonLink = ''; formActive = true;
    formOpen = true;
  }

  function openEditForm(ad: Ad) {
    editingId = ad.id; formTitle = ad.title; formImage = ad.image_url; formPosition = ad.position as Position;
    formSortOrder = ad.sort_order; formLink = ad.link; formButtonText = ad.button_text;
    formButtonLink = ad.button_link; formActive = ad.active;
    formOpen = true;
  }

  async function saveAd() {
    saving = true;
    try {
      const payload = { title: formTitle, image_url: formImage, position: formPosition, sort_order: formSortOrder, link: formLink, button_text: formButtonText, button_link: formButtonLink, active: formActive };
      const res = editingId
        ? await authPut(`/api/v1/admin/ads/${editingId}`, payload)
        : await authPost('/api/v1/admin/ads', payload);
      if (!res.ok) throw new Error('فشل حفظ الإعلان');
      formOpen = false;
      await fetchAds();
    } catch (e: any) { error = e.message; }
    finally { saving = false; }
  }

  async function deleteAd(id: number) {
    deleting = id;
    try {
      const res = await authDelete(`/api/v1/admin/ads/${id}`);
      if (!res.ok) throw new Error('فشل حذف الإعلان');
      ads = ads.filter(a => a.id !== id);
    } catch (e: any) { error = e.message; }
    finally { deleting = null; }
  }

  async function toggleActive(ad: Ad) {
    toggling = ad.id;
    try {
      const res = await authPut(`/api/v1/admin/ads/${ad.id}`, { active: !ad.active });
      if (!res.ok) throw new Error('فشل تبديل الحالة');
      ads = ads.map(a => a.id === ad.id ? { ...a, active: !a.active } : a);
    } catch (e: any) { error = e.message; }
    finally { toggling = null; }
  }

  async function handleImageUpload(e: Event) {
    const input = e.target as HTMLInputElement;
    if (!input.files?.[0]) return;
    const fd = new FormData();
    fd.append('image', input.files[0]);
    try {
      const res = await authUpload('/api/v1/admin/ads/upload', fd);
      if (!res.ok) throw new Error('فشل رفع الصورة');
      const json = await res.json();
      if (json.success) formImage = json.data.url || json.data.image_url;
    } catch (e: any) { error = e.message; }
  }

  let filteredAds = $derived(
    searchQuery.trim()
      ? ads.filter(a => a.title.toLowerCase().includes(searchQuery.toLowerCase()))
      : ads
  );

  onMount(() => { fetchAds(); });
</script>

<!-- Ad Form Modal -->
<Modal bind:open={formOpen} title={editingId ? 'تعديل الإعلان' : 'إضافة إعلان'} icon={Megaphone} iconColor="#f5b544" size="lg">
  <form onsubmit={(e) => { e.preventDefault(); saveAd(); }} class="space-y-4">
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div>
        <label class="field-label text-xs mb-1.5 block">العنوان *</label>
        <input type="text" class="input-field" bind:value={formTitle} placeholder="عنوان الإعلان" required />
      </div>
      <div>
        <label class="field-label text-xs mb-1.5 block">الموقع</label>
        <select class="input-field appearance-none cursor-pointer" bind:value={formPosition}>
          {#each Object.entries(positionConfig) as [key, cfg]}
            <option value={key}>{cfg.label}</option>
          {/each}
        </select>
      </div>
    </div>
    <div>
      <label class="field-label text-xs mb-1.5 block">رابط الصورة</label>
      <div class="flex gap-2">
        <input type="text" class="input-field flex-1" bind:value={formImage} placeholder="رابط الصورة أو ارفع ملف" dir="ltr" />
        <label class="btn-secondary cursor-pointer flex items-center gap-2">
          <Upload size={16} />رفع
          <input type="file" accept="image/*" class="hidden" onchange={handleImageUpload} />
        </label>
      </div>
      {#if formImage}
        <img src={formImage} alt="Preview" class="mt-2 h-24 rounded-lg object-cover" style="border: 1px solid var(--border-subtle);" />
      {/if}
    </div>
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div>
        <label class="field-label text-xs mb-1.5 block">رابط الإعلان</label>
        <input type="url" class="input-field" bind:value={formLink} placeholder="https://..." dir="ltr" />
      </div>
      <div>
        <label class="field-label text-xs mb-1.5 block">ترتيب العرض</label>
        <input type="number" class="input-field" bind:value={formSortOrder} min="0" />
      </div>
    </div>
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div>
        <label class="field-label text-xs mb-1.5 block">نص الزر</label>
        <input type="text" class="input-field" bind:value={formButtonText} placeholder="مثال: اقرأ المزيد" />
      </div>
      <div>
        <label class="field-label text-xs mb-1.5 block">رابط الزر</label>
        <input type="url" class="input-field" bind:value={formButtonLink} placeholder="https://..." dir="ltr" />
      </div>
    </div>
    <div class="flex items-center gap-3">
      <label class="field-label text-xs">نشط</label>
      <button type="button" class="btn-ghost p-1" onclick={() => formActive = !formActive}>
        {#if formActive}<ToggleRight size={28} style="color: #22d3a4;" />{:else}<ToggleLeft size={28} style="color: var(--text-quaternary);" />{/if}
      </button>
    </div>
    <div class="flex items-center gap-3 justify-end pt-2">
      <button type="button" class="btn-secondary" onclick={() => formOpen = false}>إلغاء</button>
      <button type="submit" class="btn-primary" disabled={saving || !formTitle.trim()}>
        {#if saving}<Loader2 size={16} class="animate-spin" />{:else}<Plus size={16} />{/if}
        {editingId ? 'حفظ التعديلات' : 'إضافة'}
      </button>
    </div>
  </form>
</Modal>

<!-- Main Content -->
<div class="space-y-6">
  <div class="flex items-center justify-between flex-wrap gap-4">
    <div>
      <h1 class="text-2xl lg:text-3xl font-extrabold text-gold-gradient">الإعلانات</h1>
      <p class="text-sm mt-1" style="color: var(--text-tertiary);">إدارة الإعلانات والبانرات</p>
    </div>
    <button class="btn-primary flex items-center gap-2" onclick={openCreateForm}><Plus size={18} /><span>إضافة إعلان</span></button>
  </div>

  {#if error}
    <div class="panel p-4 flex items-center gap-3" style="border-color: rgba(244,63,122,0.3);">
      <AlertCircle size={20} style="color: #f43f7a;" /><p class="text-sm" style="color: #f43f7a;">{error}</p>
      <button class="mr-auto btn-ghost text-xs" onclick={() => error = null}>إغلاق</button>
    </div>
  {/if}

  <div class="panel p-4">
    <div class="flex items-center gap-3">
      <div class="relative flex-1">
        <Search size={18} class="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style="color: var(--text-quaternary);" />
        <input type="text" class="input-field pr-10" placeholder="بحث في الإعلانات..." bind:value={searchQuery} dir="rtl" />
      </div>
      <div class="flex items-center gap-1 border rounded-xl p-1" style="border-color: var(--border-subtle);">
        <button class="btn-ghost p-2 rounded-lg {!viewMode || viewMode === 'grid' ? 'bg-white/10' : ''}" onclick={() => viewMode = 'grid'}><Eye size={16} /></button>
        <button class="btn-ghost p-2 rounded-lg {viewMode === 'list' ? 'bg-white/10' : ''}" onclick={() => viewMode = 'list'}><ArrowUpDown size={16} /></button>
      </div>
    </div>
  </div>

  {#if loading}
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
      {#each Array(6) as _}
        <div class="panel p-4"><div class="animate-shimmer h-40 rounded-xl" style="background: rgba(255,255,255,0.06);"></div><div class="mt-3 space-y-2"><div class="animate-shimmer h-4 w-3/4 rounded" style="background: rgba(255,255,255,0.06);"></div><div class="animate-shimmer h-3 w-1/2 rounded" style="background: rgba(255,255,255,0.04);"></div></div></div>
      {/each}
    </div>
  {:else if filteredAds.length === 0}
    <EmptyState icon={Megaphone} title="لا توجد إعلانات" description="أضف إعلان جديد للبدء" />
  {:else if viewMode === 'grid'}
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
      {#each filteredAds as ad (ad.id)}
        {@const pc = positionConfig[ad.position as Position] || positionConfig.hero}
        <div class="panel overflow-hidden group">
          <div class="h-40 relative overflow-hidden" style="background: var(--bg-overlay-10);">
            {#if ad.image_url}
              <img src={ad.image_url} alt={ad.title} class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
            {:else}
              <div class="flex items-center justify-center h-full"><ImagePlus size={32} style="color: var(--text-quaternary);" /></div>
            {/if}
            <span class="absolute top-3 right-3 {pc.pillClass}">{pc.label}</span>
          </div>
          <div class="p-4">
            <div class="flex items-center justify-between mb-2">
              <h3 class="font-bold text-sm truncate">{ad.title}</h3>
              <button class="btn-ghost p-1.5 rounded-lg" onclick={() => toggleActive(ad)} disabled={toggling === ad.id}>
                {#if ad.active}<ToggleRight size={20} style="color: #22d3a4;" />{:else}<ToggleLeft size={20} style="color: var(--text-quaternary);" />{/if}
              </button>
            </div>
            <div class="flex items-center gap-2 text-xs" style="color: var(--text-tertiary);">
              <span>ترتيب: {ad.sort_order}</span>
            </div>
            <div class="flex items-center gap-2 mt-3">
              <button class="btn-ghost flex-1 flex items-center justify-center gap-1.5 text-xs" onclick={() => openEditForm(ad)}><Pencil size={13} />تعديل</button>
              <button class="btn-ghost flex items-center justify-center gap-1.5 text-xs" style="color: #f43f7a;" onclick={() => deleteAd(ad.id)} disabled={deleting === ad.id}>
                {#if deleting === ad.id}<Loader2 size={13} class="animate-spin" />{:else}<Trash2 size={13} />{/if}
              </button>
            </div>
          </div>
        </div>
      {/each}
    </div>
  {:else}
    <div class="panel overflow-hidden">
      <div class="overflow-x-auto scrollbar-none">
        <table class="data-table">
          <thead><tr><th>العنوان</th><th>الموقع</th><th>الحالة</th><th>الترتيب</th><th>إجراءات</th></tr></thead>
          <tbody>
            {#each filteredAds as ad (ad.id)}
              {@const pc = positionConfig[ad.position as Position] || positionConfig.hero}
              <tr>
                <td><div class="flex items-center gap-3">{#if ad.image_url}<img src={ad.image_url} alt="" class="w-10 h-10 rounded-lg object-cover" />{:else}<div class="w-10 h-10 rounded-lg flex items-center justify-center" style="background: var(--bg-overlay-10);"><ImagePlus size={16} style="color: var(--text-quaternary);" /></div>{/if}<span class="font-medium truncate max-w-[200px]">{ad.title}</span></div></td>
                <td><span class={pc.pillClass}>{pc.label}</span></td>
                <td>{#if ad.active}<span class="pill-mint">نشط</span>{:else}<span class="pill-rose">متوقف</span>{/if}</td>
                <td class="font-mono tabular-nums">{ad.sort_order}</td>
                <td>
                  <div class="flex items-center gap-1">
                    <button class="btn-ghost p-2 rounded-lg" onclick={() => toggleActive(ad)} disabled={toggling === ad.id}>{#if ad.active}<ToggleRight size={16} style="color: #22d3a4;" />{:else}<ToggleLeft size={16} />{/if}</button>
                    <button class="btn-ghost p-2 rounded-lg" onclick={() => openEditForm(ad)}><Pencil size={14} /></button>
                    <button class="btn-ghost p-2 rounded-lg" style="color: #f43f7a;" onclick={() => deleteAd(ad.id)} disabled={deleting === ad.id}>{#if deleting === ad.id}<Loader2 size={14} class="animate-spin" />{:else}<Trash2 size={14} />{/if}</button>
                  </div>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
  {/if}
</div>
