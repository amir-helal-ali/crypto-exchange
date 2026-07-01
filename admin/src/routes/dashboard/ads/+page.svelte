<script lang="ts">
  import { onMount } from 'svelte';
  import {
    Megaphone, Plus, Search, Pencil, Trash2,
    ToggleLeft, ToggleRight, Loader2, AlertCircle,
    ImagePlus, Upload, Eye, ArrowUpDown
  } from 'lucide-svelte';
  import { authGet, authPost, authPut, authDelete, authUpload } from '$lib/api/client';
  import type { Ad } from '$lib/api/types';
  import PageHeader from '$lib/components/PageHeader.svelte';
  import ErrorAlert from '$lib/components/ErrorAlert.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import Modal from '$lib/components/Modal.svelte';
  import { toast } from '$lib/stores/toast';

  // ─── Position Config ────────────────────────────────────────
  const positionConfig: Record<string, { label: string; pillClass: string; color: string; bg: string }> = {
    hero: { label: 'رئيسي', pillClass: 'pill-gold', color: '#f5b544', bg: 'rgba(245,181,68,0.12)' },
    section: { label: 'قسم', pillClass: 'pill-azure', color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
    bottom: { label: 'سفلي', pillClass: 'pill-mint', color: '#22d3a4', bg: 'rgba(34,211,164,0.12)' },
    floating: { label: 'عائم', pillClass: 'pill-violet', color: '#a855f7', bg: 'rgba(168,85,247,0.12)' }
  };

  const positionOptions = [
    { value: 'hero', label: 'رئيسي' },
    { value: 'section', label: 'قسم' },
    { value: 'bottom', label: 'سفلي' },
    { value: 'floating', label: 'عائم' }
  ];

  // ─── State ──────────────────────────────────────────────────
  let ads = $state<Ad[]>([]);
  let loading = $state(true);
  let error = $state('');
  let search = $state('');
  let viewMode = $state<'grid' | 'list'>('grid');

  // Modal state
  let modalOpen = $state(false);
  let modalMode = $state<'create' | 'edit'>('create');
  let saving = $state(false);
  let deleting = $state<number | null>(null);
  let toggling = $state<number | null>(null);

  // Form state
  let formId = $state<number | null>(null);
  let formTitle = $state('');
  let formLink = $state('');
  let formImageUrl = $state('');
  let formButtonText = $state('');
  let formButtonLink = $state('');
  let formPosition = $state('hero');
  let formActive = $state(true);
  let formSortOrder = $state(0);
  let uploading = $state(false);

  // ─── Computed ───────────────────────────────────────────────
  let filteredAds = $derived(() => {
    if (!search.trim()) return ads;
    const q = search.toLowerCase();
    return ads.filter(ad =>
      ad.title.toLowerCase().includes(q) ||
      ad.position.toLowerCase().includes(q)
    );
  });

  // ─── API Calls ──────────────────────────────────────────────
  async function fetchAds() {
    try {
      error = '';
      const res = await authGet('/api/v1/admin/ads');
      if (!res.ok) throw new Error('فشل تحميل الإعلانات');
      const json = await res.json();
      if (json.success) ads = json.data;
    } catch (e: any) {
      error = e.message;
    } finally {
      loading = false;
    }
  }

  async function handleToggleActive(ad: Ad) {
    toggling = ad.id;
    try {
      const res = await authPut(`/api/v1/admin/ads/${ad.id}`, { active: !ad.active });
      if (!res.ok) throw new Error('فشل تحديث حالة الإعلان');
      const json = await res.json();
      if (json.success) {
        ads = ads.map(a => a.id === ad.id ? { ...a, active: !a.active } : a);
        toast.success(ad.active ? 'تم تعطيل الإعلان' : 'تم تفعيل الإعلان');
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      toggling = null;
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('هل أنت متأكد من حذف هذا الإعلان؟')) return;
    deleting = id;
    try {
      const res = await authDelete(`/api/v1/admin/ads/${id}`);
      if (!res.ok) throw new Error('فشل حذف الإعلان');
      ads = ads.filter(a => a.id !== id);
      toast.success('تم حذف الإعلان');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      deleting = null;
    }
  }

  // ─── Modal ──────────────────────────────────────────────────
  function openCreateModal() {
    modalMode = 'create';
    formId = null;
    formTitle = '';
    formLink = '';
    formImageUrl = '';
    formButtonText = '';
    formButtonLink = '';
    formPosition = 'hero';
    formActive = true;
    formSortOrder = 0;
    modalOpen = true;
  }

  function openEditModal(ad: Ad) {
    modalMode = 'edit';
    formId = ad.id;
    formTitle = ad.title;
    formLink = ad.link;
    formImageUrl = ad.image_url;
    formButtonText = ad.button_text;
    formButtonLink = ad.button_link;
    formPosition = ad.position;
    formActive = ad.active;
    formSortOrder = ad.sort_order;
    modalOpen = true;
  }

  async function handleSave() {
    if (!formTitle.trim()) {
      toast.error('يرجى إدخال عنوان الإعلان');
      return;
    }
    saving = true;
    try {
      const payload = {
        title: formTitle,
        link: formLink,
        image_url: formImageUrl,
        button_text: formButtonText,
        button_link: formButtonLink,
        position: formPosition,
        active: formActive,
        sort_order: formSortOrder
      };

      let res;
      if (modalMode === 'create') {
        res = await authPost('/api/v1/admin/ads', payload);
      } else {
        res = await authPut(`/api/v1/admin/ads/${formId}`, payload);
      }

      if (!res.ok) throw new Error(modalMode === 'create' ? 'فشل إنشاء الإعلان' : 'فشل تحديث الإعلان');
      const json = await res.json();
      if (json.success) {
        if (modalMode === 'create') {
          ads = [...ads, json.data];
          toast.success('تم إنشاء الإعلان بنجاح');
        } else {
          ads = ads.map(a => a.id === formId ? json.data : a);
          toast.success('تم تحديث الإعلان بنجاح');
        }
        modalOpen = false;
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      saving = false;
    }
  }

  async function handleImageUpload(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    uploading = true;
    try {
      const formData = new FormData();
      formData.append('image', file);
      const res = await authUpload('/api/v1/admin/ads/upload', formData);
      if (!res.ok) throw new Error('فشل رفع الصورة');
      const json = await res.json();
      if (json.success && json.data?.url) {
        formImageUrl = json.data.url;
        toast.success('تم رفع الصورة بنجاح');
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      uploading = false;
    }
  }

  // ─── Lifecycle ──────────────────────────────────────────────
  onMount(() => {
    fetchAds();
  });
</script>

<div class="space-y-6">
  <!-- Header -->
  <PageHeader title="الإعلانات" subtitle="إدارة الإعلانات والبانرات">
    <button class="btn-primary text-sm flex items-center gap-2" onclick={openCreateModal}>
      <Plus size={16} />
      إضافة إعلان
    </button>
  </PageHeader>

  <!-- Error -->
  {#if error}
    <ErrorAlert message={error} onclose={() => (error = '')} />
  {/if}

  <!-- Search & View Toggle -->
  <div class="panel p-4">
    <div class="flex items-center gap-3 flex-wrap">
      <div class="relative flex-1 min-w-[200px]">
        <Search size={16} class="absolute right-3 top-1/2 -translate-y-1/2" style="color: var(--text-quaternary);" />
        <input
          type="text"
          class="input-field pr-10 w-full"
          placeholder="بحث في الإعلانات..."
          bind:value={search}
        />
      </div>
      <div class="flex items-center gap-1 p-1 rounded-lg" style="background: rgba(255,255,255,0.04);">
        <button
          class="p-2 rounded-md transition-colors"
          style={viewMode === 'grid'
            ? 'background: rgba(245,181,68,0.12); color: #f5b544;'
            : 'color: var(--text-quaternary); background: transparent;'}
          onclick={() => (viewMode = 'grid')}
        >
          <Eye size={16} />
        </button>
        <button
          class="p-2 rounded-md transition-colors"
          style={viewMode === 'list'
            ? 'background: rgba(245,181,68,0.12); color: #f5b544;'
            : 'color: var(--text-quaternary); background: transparent;'}
          onclick={() => (viewMode = 'list')}
        >
          <ArrowUpDown size={16} />
        </button>
      </div>
    </div>
  </div>

  <!-- Content -->
  {#if loading}
    <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
      {#each Array(6) as _}
        <div class="stat-card">
          <div class="animate-shimmer h-40 w-full rounded-xl mb-4" style="background: rgba(255,255,255,0.04);"></div>
          <div class="space-y-3">
            <div class="animate-shimmer h-4 w-2/3 rounded" style="background: rgba(255,255,255,0.05);"></div>
            <div class="animate-shimmer h-3 w-1/3 rounded" style="background: rgba(255,255,255,0.04);"></div>
          </div>
        </div>
      {/each}
    </div>
  {:else if filteredAds().length > 0}
    <!-- Grid View -->
    {#if viewMode === 'grid'}
      <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {#each filteredAds() as ad (ad.id)}
          <div class="stat-card group">
            <!-- Image -->
            <div class="relative rounded-xl overflow-hidden mb-4 aspect-video" style="background: rgba(255,255,255,0.03);">
              {#if ad.image_url}
                <img src={ad.image_url} alt={ad.title} class="w-full h-full object-cover" loading="lazy" />
              {:else}
                <div class="flex items-center justify-center w-full h-full">
                  <ImagePlus size={32} style="color: var(--text-quaternary);" />
                </div>
              {/if}
              <!-- Position Pill Overlay -->
              <div class="absolute top-2 right-2">
                <span class={(positionConfig[ad.position] || positionConfig.hero).pillClass}>{(positionConfig[ad.position] || positionConfig.hero).label}</span>
              </div>
            </div>

            <!-- Info -->
            <h3 class="font-bold text-sm mb-2 truncate" style="color: var(--text-primary);">{ad.title}</h3>

            <!-- Active Toggle -->
            <div class="flex items-center justify-between mb-3">
              <span class="text-xs" style="color: var(--text-quaternary);">الحالة</span>
              <button
                class="transition-colors"
                onclick={() => handleToggleActive(ad)}
                disabled={toggling === ad.id}
              >
                {#if toggling === ad.id}
                  <Loader2 size={20} class="animate-spin" style="color: var(--text-quaternary);" />
                {:else if ad.active}
                  <ToggleRight size={20} style="color: #22d3a4;" />
                {:else}
                  <ToggleLeft size={20} style="color: var(--text-quaternary);" />
                {/if}
              </button>
            </div>

            <!-- Actions -->
            <div class="glass-divider mb-3"></div>
            <div class="flex items-center gap-2">
              <button class="btn-ghost text-xs flex items-center gap-1.5 flex-1 justify-center" onclick={() => openEditModal(ad)}>
                <Pencil size={13} />
                تعديل
              </button>
              <button
                class="btn-danger text-xs flex items-center gap-1.5 flex-1 justify-center"
                onclick={() => handleDelete(ad.id)}
                disabled={deleting === ad.id}
              >
                {#if deleting === ad.id}
                  <Loader2 size={13} class="animate-spin" />
                {:else}
                  <Trash2 size={13} />
                {/if}
                حذف
              </button>
            </div>
          </div>
        {/each}
      </div>
    <!-- List View -->
    {:else}
      <div class="panel overflow-hidden">
        <div class="overflow-x-auto">
          <table class="data-table w-full">
            <thead>
              <tr>
                <th>الصورة</th>
                <th>العنوان</th>
                <th>الموقع</th>
                <th>الحالة</th>
                <th>الترتيب</th>
                <th>إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {#each filteredAds() as ad (ad.id)}
                <tr>
                  <td>
                    <div class="w-16 h-10 rounded-lg overflow-hidden" style="background: rgba(255,255,255,0.03);">
                      {#if ad.image_url}
                        <img src={ad.image_url} alt={ad.title} class="w-full h-full object-cover" loading="lazy" />
                      {:else}
                        <div class="flex items-center justify-center w-full h-full">
                          <ImagePlus size={14} style="color: var(--text-quaternary);" />
                        </div>
                      {/if}
                    </div>
                  </td>
                  <td>
                    <span class="font-medium text-sm">{ad.title}</span>
                  </td>
                  <td>
                    <span class={(positionConfig[ad.position] || positionConfig.hero).pillClass}>{(positionConfig[ad.position] || positionConfig.hero).label}</span>
                  </td>
                  <td>
                    <button onclick={() => handleToggleActive(ad)} disabled={toggling === ad.id}>
                      {#if toggling === ad.id}
                        <Loader2 size={18} class="animate-spin" style="color: var(--text-quaternary);" />
                      {:else if ad.active}
                        <ToggleRight size={18} style="color: #22d3a4;" />
                      {:else}
                        <ToggleLeft size={18} style="color: var(--text-quaternary);" />
                      {/if}
                    </button>
                  </td>
                  <td>
                    <span class="text-xs font-mono tabular-nums" style="color: var(--text-tertiary);">{ad.sort_order}</span>
                  </td>
                  <td>
                    <div class="flex items-center gap-1">
                      <button class="btn-ghost p-1.5 rounded" onclick={() => openEditModal(ad)}>
                        <Pencil size={14} />
                      </button>
                      <button
                        class="btn-ghost p-1.5 rounded"
                        style="color: #f43f7a;"
                        onclick={() => handleDelete(ad.id)}
                        disabled={deleting === ad.id}
                      >
                        {#if deleting === ad.id}
                          <Loader2 size={14} class="animate-spin" />
                        {:else}
                          <Trash2 size={14} />
                        {/if}
                      </button>
                    </div>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </div>
    {/if}
  {:else}
    <EmptyState icon={Megaphone} title="لا توجد إعلانات" description="قم بإضافة إعلان جديد لعرضه في المنصة" />
  {/if}
</div>

<!-- Create / Edit Modal -->
<Modal bind:open={modalOpen} title={modalMode === 'create' ? 'إضافة إعلان' : 'تعديل الإعلان'} icon={Megaphone} iconColor="#f5b544" iconBg="rgba(245,181,68,0.12)" size="lg">
  <div class="space-y-5">
    <!-- Title -->
    <div>
      <label class="block text-xs font-semibold mb-2" style="color: var(--text-secondary);">عنوان الإعلان *</label>
      <input type="text" class="input-field w-full" placeholder="أدخل عنوان الإعلان" bind:value={formTitle} />
    </div>

    <!-- Link -->
    <div>
      <label class="block text-xs font-semibold mb-2" style="color: var(--text-secondary);">رابط الإعلان</label>
      <input type="url" class="input-field w-full" placeholder="https://example.com" bind:value={formLink} dir="ltr" />
    </div>

    <!-- Image Upload -->
    <div>
      <label class="block text-xs font-semibold mb-2" style="color: var(--text-secondary);">صورة الإعلان</label>
      <div class="flex items-center gap-3">
        <div class="relative flex-1">
          <input type="text" class="input-field w-full" placeholder="رابط الصورة أو ارفع من الجهاز" bind:value={formImageUrl} dir="ltr" />
        </div>
        <label class="btn-secondary text-xs flex items-center gap-2 cursor-pointer shrink-0">
          {#if uploading}
            <Loader2 size={14} class="animate-spin" />
            جاري الرفع
          {:else}
            <Upload size={14} />
            رفع
          {/if}
          <input type="file" accept="image/*" class="hidden" onchange={handleImageUpload} disabled={uploading} />
        </label>
      </div>
      {#if formImageUrl}
        <div class="mt-3 rounded-xl overflow-hidden aspect-video max-w-sm" style="background: rgba(255,255,255,0.03);">
          <img src={formImageUrl} alt="معاينة" class="w-full h-full object-cover" />
        </div>
      {/if}
    </div>

    <!-- Button Text & Link -->
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div>
        <label class="block text-xs font-semibold mb-2" style="color: var(--text-secondary);">نص الزر</label>
        <input type="text" class="input-field w-full" placeholder="مثال: اعرف المزيد" bind:value={formButtonText} />
      </div>
      <div>
        <label class="block text-xs font-semibold mb-2" style="color: var(--text-secondary);">رابط الزر</label>
        <input type="url" class="input-field w-full" placeholder="https://example.com/action" bind:value={formButtonLink} dir="ltr" />
      </div>
    </div>

    <!-- Position & Sort Order -->
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div>
        <label class="block text-xs font-semibold mb-2" style="color: var(--text-secondary);">الموقع</label>
        <select class="input-field w-full" bind:value={formPosition}>
          {#each positionOptions as opt}
            <option value={opt.value}>{opt.label}</option>
          {/each}
        </select>
      </div>
      <div>
        <label class="block text-xs font-semibold mb-2" style="color: var(--text-secondary);">ترتيب العرض</label>
        <input type="number" class="input-field w-full" bind:value={formSortOrder} min="0" />
      </div>
    </div>

    <!-- Active Toggle -->
    <div class="flex items-center justify-between py-2">
      <span class="text-sm font-medium" style="color: var(--text-secondary);">الإعلان نشط</span>
      <button
        class="toggle-track"
        onclick={() => (formActive = !formActive)}
        role="switch"
        aria-checked={formActive}
      >
        <span class="toggle-thumb" style={formActive ? 'transform: translateX(-20px); background: #22d3a4;' : 'transform: translateX(0); background: var(--text-quaternary);'}></span>
      </button>
    </div>
  </div>

  {#snippet footer()}
    <div class="flex items-center gap-3 justify-end">
      <button class="btn-ghost text-sm" onclick={() => (modalOpen = false)}>إلغاء</button>
      <button class="btn-primary text-sm flex items-center gap-2" onclick={handleSave} disabled={saving}>
        {#if saving}
          <Loader2 size={14} class="animate-spin" />
        {/if}
        {modalMode === 'create' ? 'إنشاء' : 'حفظ التعديلات'}
      </button>
    </div>
  {/snippet}
</Modal>
