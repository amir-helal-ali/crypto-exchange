<script lang="ts">
  import { onMount } from 'svelte';
  import {
    Megaphone,
    Plus,
    Search,
    Pencil,
    Trash2,
    ToggleLeft,
    ToggleRight,
    Loader2,
    AlertCircle,
    X,
    ImagePlus,
    Link,
    Sparkles,
    ArrowUpDown,
    Eye,
    EyeOff,
    Upload,
    ExternalLink,
    MousePointerClick,
    LayoutGrid,
    LayoutList,
    Hash
  } from 'lucide-svelte';
  import { authGet, authPost, authPut, authDelete, authUpload, API } from '$lib/api/client';
  import type { Ad } from '$lib/api/types';

  // ─── Types ───
  type Position = 'hero' | 'section' | 'bottom' | 'floating';

  interface AdFormData {
    title: string;
    image_url: string;
    position: Position;
    sort_order: number;
    link: string;
    button_text: string;
    button_link: string;
    active: boolean;
  }

  const emptyForm: AdFormData = {
    title: '',
    image_url: '',
    position: 'hero',
    sort_order: 0,
    link: '',
    button_text: '',
    button_link: '',
    active: true
  };

  // ─── Position labels & colors ───
  const positionConfig: Record<Position, { label: string; pillClass: string; color: string; bg: string }> = {
    hero: { label: 'رئيسي', pillClass: 'pill-gold', color: '#f5b544', bg: 'rgba(245,181,68,0.12)' },
    section: { label: 'قسم', pillClass: 'pill-azure', color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
    bottom: { label: 'سفلي', pillClass: 'pill-mint', color: '#22d3a4', bg: 'rgba(34,211,164,0.12)' },
    floating: { label: 'عائم', pillClass: 'pill-violet', color: '#a855f7', bg: 'rgba(168,85,247,0.12)' }
  };

  const positions: Position[] = ['hero', 'section', 'bottom', 'floating'];

  // ─── State ───
  let ads = $state<Ad[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let searchQuery = $state('');
  let positionFilter = $state<string>('');

  // ─── Modal state ───
  let modalOpen = $state(false);
  let editingAd = $state<Ad | null>(null);
  let form = $state<AdFormData>({ ...emptyForm });
  let formLoading = $state(false);
  let formError = $state<string | null>(null);

  // ─── Image upload state ───
  let imageUploadLoading = $state(false);
  let imageUploadError = $state<string | null>(null);
  let imageSourceTab = $state<'upload' | 'url'>('upload');
  let imageFileInput: HTMLInputElement | undefined = $state();

  // ─── AI suggestion state ───
  let suggestLoading = $state(false);
  let suggestTopic = $state('');
  let suggestError = $state<string | null>(null);

  // ─── Delete confirmation ───
  let deleteDialogOpen = $state(false);
  let deleteTarget = $state<Ad | null>(null);
  let deleteLoading = $state(false);

  // ─── Toggle loading ───
  let togglingIds = $state<Set<number>>(new Set());

  // ─── Stats ───
  let totalCount = $derived(ads.length);
  let activeCount = $derived(ads.filter(a => a.active).length);
  let inactiveCount = $derived(ads.filter(a => !a.active).length);

  // ─── Filtered ads ───
  let filteredAds = $derived(() => {
    let result = ads;
    if (positionFilter) {
      result = result.filter(a => a.position === positionFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(a =>
        a.title.toLowerCase().includes(q) ||
        a.position.toLowerCase().includes(q) ||
        a.link.toLowerCase().includes(q)
      );
    }
    return result.sort((a, b) => a.sort_order - b.sort_order);
  });

  // ─── Stat cards config ───
  const statCards = $derived([
    {
      label: 'إجمالي الإعلانات',
      count: totalCount,
      icon: Megaphone,
      iconBg: 'rgba(245,181,68,0.12)',
      iconColor: '#f5b544'
    },
    {
      label: 'نشط',
      count: activeCount,
      icon: ToggleRight,
      iconBg: 'rgba(34,211,164,0.12)',
      iconColor: '#22d3a4'
    },
    {
      label: 'غير نشط',
      count: inactiveCount,
      icon: ToggleLeft,
      iconBg: 'rgba(244,63,122,0.12)',
      iconColor: '#f43f7a'
    }
  ]);

  // ─── Fetch ads ───
  async function fetchAds() {
    loading = true;
    error = null;
    try {
      const res = await authGet('/api/v1/admin/ads');
      if (!res.ok) throw new Error('فشل تحميل الإعلانات');
      const json = await res.json();
      ads = json.data || json;
    } catch (e: any) {
      error = e.message;
    } finally {
      loading = false;
    }
  }

  // ─── Open create modal ───
  function openCreateModal() {
    editingAd = null;
    form = { ...emptyForm };
    formError = null;
    imageUploadError = null;
    imageSourceTab = 'upload';
    suggestTopic = '';
    suggestError = null;
    modalOpen = true;
  }

  // ─── Open edit modal ───
  function openEditModal(ad: Ad) {
    editingAd = ad;
    form = {
      title: ad.title,
      image_url: ad.image_url,
      position: ad.position as Position,
      sort_order: ad.sort_order,
      link: ad.link,
      button_text: ad.button_text,
      button_link: ad.button_link,
      active: ad.active
    };
    formError = null;
    imageUploadError = null;
    imageSourceTab = ad.image_url ? 'url' : 'upload';
    suggestTopic = '';
    suggestError = null;
    modalOpen = true;
  }

  // ─── Close modal ───
  function closeModal() {
    modalOpen = false;
    editingAd = null;
    form = { ...emptyForm };
    formError = null;
  }

  // ─── Handle image file upload ───
  async function handleImageUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    const file = files[0];

    // Max 5MB
    if (file.size > 5 * 1024 * 1024) {
      imageUploadError = 'حجم الصورة يتجاوز 5 ميجابايت';
      return;
    }

    imageUploadLoading = true;
    imageUploadError = null;
    try {
      const fd = new FormData();
      fd.append('image', file);
      const res = await authUpload('/api/v1/admin/ads/upload', fd);
      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.message || 'فشل رفع الصورة');
      }
      const json = await res.json();
      form.image_url = json.data?.url || json.url || json.data?.image_url || '';
    } catch (e: any) {
      imageUploadError = e.message;
    } finally {
      imageUploadLoading = false;
    }
  }

  // ─── AI suggestion ───
  async function getAISuggestion() {
    if (!suggestTopic.trim()) return;
    suggestLoading = true;
    suggestError = null;
    try {
      const res = await authPost('/api/v1/admin/ads/suggest', {
        topic: suggestTopic.trim(),
        position: form.position
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.message || 'فشل اقتراح المحتوى');
      }
      const json = await res.json();
      const suggestion = json.data || json;
      if (suggestion.title) form.title = suggestion.title;
      if (suggestion.button_text) form.button_text = suggestion.button_text;
      if (suggestion.link) form.link = suggestion.link;
      if (suggestion.button_link) form.button_link = suggestion.button_link;
    } catch (e: any) {
      suggestError = e.message;
    } finally {
      suggestLoading = false;
    }
  }

  // ─── Submit form (create or update) ───
  async function submitForm() {
    if (!form.title.trim()) {
      formError = 'عنوان الإعلان مطلوب';
      return;
    }
    formLoading = true;
    formError = null;
    try {
      const payload = {
        title: form.title.trim(),
        image_url: form.image_url.trim(),
        position: form.position,
        sort_order: form.sort_order,
        link: form.link.trim(),
        button_text: form.button_text.trim(),
        button_link: form.button_link.trim(),
        active: form.active
      };

      let res: Response;
      if (editingAd) {
        res = await authPut(`/api/v1/admin/ads/${editingAd.id}`, payload);
      } else {
        res = await authPost('/api/v1/admin/ads', payload);
      }

      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.message || 'فشل حفظ الإعلان');
      }

      await fetchAds();
      closeModal();
    } catch (e: any) {
      formError = e.message;
    } finally {
      formLoading = false;
    }
  }

  // ─── Toggle active ───
  async function toggleActive(ad: Ad) {
    togglingIds = new Set([...togglingIds, ad.id]);
    try {
      const res = await authPut(`/api/v1/admin/ads/${ad.id}`, { active: !ad.active });
      if (!res.ok) throw new Error('فشل تغيير حالة الإعلان');
      ads = ads.map(a => a.id === ad.id ? { ...a, active: !a.active } : a);
    } catch (e: any) {
      error = e.message;
    } finally {
      togglingIds = new Set([...togglingIds].filter(id => id !== ad.id));
    }
  }

  // ─── Delete ───
  function openDeleteDialog(ad: Ad) {
    deleteTarget = ad;
    deleteDialogOpen = true;
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    deleteLoading = true;
    try {
      const res = await authDelete(`/api/v1/admin/ads/${deleteTarget.id}`);
      if (!res.ok) throw new Error('فشل حذف الإعلان');
      ads = ads.filter(a => a.id !== deleteTarget!.id);
      deleteDialogOpen = false;
      deleteTarget = null;
    } catch (e: any) {
      error = e.message;
    } finally {
      deleteLoading = false;
    }
  }

  // ─── Lifecycle ───
  onMount(() => {
    fetchAds();
  });
</script>

<!-- ─── Create / Edit Modal ─── -->
{#if modalOpen}
  <div
    class="fixed inset-0 z-[100] flex items-center justify-center p-4"
    onkeydown={(e) => e.key === 'Escape' && closeModal()}
  >
    <!-- Backdrop -->
    <div
      class="absolute inset-0 bg-black/80 backdrop-blur-md"
      onclick={closeModal}
      role="presentation"
    ></div>

    <!-- Modal content -->
    <div class="relative z-10 w-full max-w-2xl max-h-[90vh] panel overflow-hidden flex flex-col">
      <!-- Header -->
      <div class="flex items-center justify-between p-5 border-b" style="border-color: var(--border-subtle);">
        <div class="flex items-center gap-3">
          <div class="flex items-center justify-center w-10 h-10 rounded-xl" style="background: rgba(245,181,68,0.12);">
            <Megaphone size={20} style="color: #f5b544;" />
          </div>
          <div>
            <h3 class="font-bold">{editingAd ? 'تعديل الإعلان' : 'إنشاء إعلان جديد'}</h3>
            <p class="text-xs mt-0.5" style="color: var(--text-tertiary);">
              {editingAd ? 'تعديل بيانات الإعلان' : 'إضافة إعلان جديد للمنصة'}
            </p>
          </div>
        </div>
        <button
          class="btn-ghost rounded-lg p-2"
          onclick={closeModal}
          aria-label="إغلاق"
        >
          <X size={20} />
        </button>
      </div>

      <!-- Body -->
      <div class="flex-1 overflow-y-auto p-5 space-y-5 scrollbar-none">
        <!-- Form error -->
        {#if formError}
          <div class="p-3 rounded-xl flex items-center gap-2" style="background: rgba(244,63,122,0.06); border: 1px solid rgba(244,63,122,0.12);">
            <AlertCircle size={16} style="color: #f43f7a;" />
            <p class="text-xs" style="color: #f43f7a;">{formError}</p>
          </div>
        {/if}

        <!-- AI Suggestion Section -->
        <div class="p-4 rounded-xl" style="background: rgba(168,85,247,0.06); border: 1px solid rgba(168,85,247,0.12);">
          <div class="flex items-center gap-2 mb-3">
            <Sparkles size={16} style="color: #a855f7;" />
            <span class="text-sm font-semibold" style="color: #a855f7;">اقتراح ذكي بالذكاء الاصطناعي</span>
          </div>
          <div class="flex gap-2">
            <input
              type="text"
              class="input-field flex-1 text-xs"
              placeholder="أدخل الموضوع للاقتراح (مثلاً: عرض تداول جديد)..."
              bind:value={suggestTopic}
              dir="rtl"
            />
            <button
              class="px-4 py-2.5 rounded-xl font-semibold text-xs flex items-center gap-1.5 transition-all cursor-pointer shrink-0"
              style="background: linear-gradient(135deg, #a855f7, #7c3aed); color: #fff;"
              onclick={getAISuggestion}
              disabled={suggestLoading || !suggestTopic.trim()}
            >
              {#if suggestLoading}
                <Loader2 size={14} class="animate-spin" />
              {:else}
                <Sparkles size={14} />
              {/if}
              اقتراح
            </button>
          </div>
          {#if suggestError}
            <p class="text-xs mt-2" style="color: #f43f7a;">{suggestError}</p>
          {/if}
        </div>

        <!-- Title -->
        <div>
          <label class="block text-xs font-medium mb-2" style="color: var(--text-secondary);">
            عنوان الإعلان <span style="color: #f43f7a;">*</span>
          </label>
          <input
            type="text"
            class="input-field"
            placeholder="أدخل عنوان الإعلان..."
            bind:value={form.title}
            dir="rtl"
          />
        </div>

        <!-- Image -->
        <div>
          <label class="block text-xs font-medium mb-2" style="color: var(--text-secondary);">
            صورة الإعلان
          </label>
          <!-- Tabs -->
          <div class="flex gap-1 p-1 rounded-xl mb-3" style="background: rgba(255,255,255,0.04);">
            <button
              class="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer"
              style={imageSourceTab === 'upload'
                ? 'background: rgba(245,181,68,0.12); color: #f5b544;'
                : 'color: var(--text-tertiary);'}
              onclick={() => (imageSourceTab = 'upload')}
            >
              <Upload size={13} />
              رفع ملف
            </button>
            <button
              class="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer"
              style={imageSourceTab === 'url'
                ? 'background: rgba(245,181,68,0.12); color: #f5b544;'
                : 'color: var(--text-tertiary);'}
              onclick={() => (imageSourceTab = 'url')}
            >
              <Link size={13} />
              رابط URL
            </button>
          </div>

          {#if imageSourceTab === 'upload'}
            <div
              class="relative flex flex-col items-center justify-center p-6 rounded-xl border-2 border-dashed cursor-pointer transition-all"
              style="border-color: var(--border-subtle); background: rgba(255,255,255,0.02);"
              onclick={() => imageFileInput?.click()}
              onkeydown={(e) => e.key === 'Enter' && imageFileInput?.click()}
              role="button"
              tabindex="0"
            >
              {#if imageUploadLoading}
                <Loader2 size={24} class="animate-spin mb-2" style="color: var(--text-quaternary);" />
                <p class="text-xs" style="color: var(--text-tertiary);">جارٍ الرفع...</p>
              {:else if form.image_url}
                <img
                  src={form.image_url}
                  alt="معاينة"
                  class="w-full max-h-40 object-contain rounded-lg mb-2"
                />
                <p class="text-xs" style="color: var(--accent-mint);">تم الرفع بنجاح — انقر لاستبدال</p>
              {:else}
                <ImagePlus size={28} class="mb-2" style="color: var(--text-quaternary);" />
                <p class="text-xs" style="color: var(--text-tertiary);">انقر لرفع صورة</p>
                <p class="text-xs mt-1" style="color: var(--text-quaternary);">الحد الأقصى 5 ميجابايت</p>
              {/if}
              <input
                type="file"
                accept="image/*"
                class="hidden"
                bind:this={imageFileInput}
                onchange={(e) => handleImageUpload((e.target as HTMLInputElement).files)}
              />
            </div>
            {#if imageUploadError}
              <p class="text-xs mt-2" style="color: #f43f7a;">{imageUploadError}</p>
            {/if}
          {:else}
            <input
              type="text"
              class="input-field"
              placeholder="https://example.com/image.jpg"
              bind:value={form.image_url}
              dir="ltr"
            />
            {#if form.image_url && imageSourceTab === 'url'}
              <div class="mt-2 rounded-xl overflow-hidden border" style="border-color: var(--border-subtle);">
                <img
                  src={form.image_url}
                  alt="معاينة"
                  class="w-full max-h-40 object-contain"
                  style="background: rgba(255,255,255,0.02);"
                  onerror={(e) => (e.target as HTMLImageElement).style.display = 'none'}
                />
              </div>
            {/if}
          {/if}
        </div>

        <!-- Position & Sort Order -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-medium mb-2" style="color: var(--text-secondary);">
              الموضع
            </label>
            <div class="grid grid-cols-2 gap-2">
              {#each positions as pos}
                {@const cfg = positionConfig[pos]}
                <button
                  class="flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-medium transition-all cursor-pointer border"
                  style={form.position === pos
                    ? `background: ${cfg.bg}; border-color: ${cfg.color}; color: ${cfg.color};`
                    : 'background: rgba(255,255,255,0.03); border-color: var(--border-subtle); color: var(--text-tertiary);'}
                  onclick={() => (form.position = pos)}
                >
                  {cfg.label}
                </button>
              {/each}
            </div>
          </div>

          <div>
            <label class="block text-xs font-medium mb-2" style="color: var(--text-secondary);">
              ترتيب الفرز
            </label>
            <input
              type="number"
              class="input-field"
              placeholder="0"
              bind:value={form.sort_order}
              min="0"
              dir="ltr"
            />
            <p class="text-xs mt-1" style="color: var(--text-quaternary);">الأرقام الأقل تظهر أولاً</p>
          </div>
        </div>

        <!-- Link -->
        <div>
          <label class="block text-xs font-medium mb-2" style="color: var(--text-secondary);">
            رابط الإعلان
          </label>
          <input
            type="text"
            class="input-field"
            placeholder="https://example.com/promo"
            bind:value={form.link}
            dir="ltr"
          />
        </div>

        <!-- Button text & link -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-medium mb-2" style="color: var(--text-secondary);">
              نص الزر
            </label>
            <input
              type="text"
              class="input-field"
              placeholder="تداول الآن"
              bind:value={form.button_text}
              dir="rtl"
            />
          </div>
          <div>
            <label class="block text-xs font-medium mb-2" style="color: var(--text-secondary);">
              رابط الزر
            </label>
            <input
              type="text"
              class="input-field"
              placeholder="https://example.com/action"
              bind:value={form.button_link}
              dir="ltr"
            />
          </div>
        </div>

        <!-- Active toggle -->
        <div class="flex items-center justify-between p-4 rounded-xl" style="background: rgba(255,255,255,0.03);">
          <div class="flex items-center gap-3">
            {#if form.active}
              <ToggleRight size={22} style="color: #22d3a4;" />
            {:else}
              <ToggleLeft size={22} style="color: var(--text-quaternary);" />
            {/if}
            <div>
              <p class="text-sm font-medium">حالة الإعلان</p>
              <p class="text-xs" style="color: var(--text-tertiary);">
                {form.active ? 'الإعلان نشط ومرئي للمستخدمين' : 'الإعلان غير نشط ومخفي'}
              </p>
            </div>
          </div>
          <button
            class="relative inline-flex h-7 w-12 items-center rounded-full transition-colors cursor-pointer shrink-0"
            style="background: {form.active ? '#22d3a4' : 'rgba(255,255,255,0.12)'};"
            onclick={() => (form.active = !form.active)}
            role="switch"
            aria-checked={form.active}
          >
            <span
              class="inline-block h-5 w-5 rounded-full bg-white transition-transform shadow-md"
              style="transform: translateX({form.active ? '22px' : '3px'});"
            ></span>
          </button>
        </div>
      </div>

      <!-- Footer -->
      <div class="flex items-center justify-end gap-3 p-5 border-t" style="border-color: var(--border-subtle);">
        <button
          class="btn-secondary"
          onclick={closeModal}
          disabled={formLoading}
        >
          إلغاء
        </button>
        <button
          class="btn-primary flex items-center gap-2"
          onclick={submitForm}
          disabled={formLoading}
        >
          {#if formLoading}
            <Loader2 size={16} class="animate-spin" />
          {:else}
            <Megaphone size={16} />
          {/if}
          {editingAd ? 'حفظ التعديلات' : 'إنشاء الإعلان'}
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- ─── Delete Confirmation Dialog ─── -->
{#if deleteDialogOpen}
  <div
    class="fixed inset-0 z-[100] flex items-center justify-center p-4"
    onkeydown={(e) => e.key === 'Escape' && (deleteDialogOpen = false)}
  >
    <!-- Backdrop -->
    <div
      class="absolute inset-0 bg-black/80 backdrop-blur-md"
      onclick={() => (deleteDialogOpen = false)}
      role="presentation"
    ></div>

    <!-- Dialog -->
    <div class="relative z-10 w-full max-w-md panel p-6 space-y-5">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="flex items-center justify-center w-10 h-10 rounded-xl" style="background: rgba(239,68,68,0.12);">
            <Trash2 size={20} style="color: #ef4444;" />
          </div>
          <div>
            <h3 class="font-bold">حذف الإعلان</h3>
            <p class="text-xs mt-0.5" style="color: var(--text-tertiary);">هذا الإجراء لا يمكن التراجع عنه</p>
          </div>
        </div>
        <button
          class="btn-ghost rounded-lg p-1.5"
          onclick={() => (deleteDialogOpen = false)}
          aria-label="إغلاق"
        >
          <X size={18} />
        </button>
      </div>

      {#if deleteTarget}
        <div class="p-4 rounded-xl" style="background: rgba(255,255,255,0.03); border: 1px solid var(--border-subtle);">
          <div class="flex items-center gap-3">
            {#if deleteTarget.image_url}
              <img
                src={deleteTarget.image_url}
                alt={deleteTarget.title}
                class="w-12 h-12 rounded-lg object-cover"
                onerror={(e) => ((e.target as HTMLImageElement).style.display = 'none')}
              />
            {:else}
              <div class="flex items-center justify-center w-12 h-12 rounded-lg" style="background: rgba(255,255,255,0.05);">
                <Megaphone size={20} style="color: var(--text-quaternary);" />
              </div>
            {/if}
            <div class="min-w-0">
              <p class="font-semibold text-sm truncate">{deleteTarget.title}</p>
              <p class="text-xs" style="color: var(--text-tertiary);">
                {positionConfig[deleteTarget.position as Position]?.label || deleteTarget.position} · ترتيب {deleteTarget.sort_order}
              </p>
            </div>
          </div>
        </div>
      {/if}

      <div class="flex items-center gap-3 justify-end">
        <button
          class="btn-secondary"
          onclick={() => (deleteDialogOpen = false)}
          disabled={deleteLoading}
        >
          إلغاء
        </button>
        <button
          class="btn-danger flex items-center gap-2"
          onclick={confirmDelete}
          disabled={deleteLoading}
        >
          {#if deleteLoading}
            <Loader2 size={16} class="animate-spin" />
          {:else}
            <Trash2 size={16} />
          {/if}
          حذف نهائي
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- ─── Main Content ─── -->
<div class="space-y-6">
  <!-- Header -->
  <div class="flex items-center justify-between flex-wrap gap-4">
    <div>
      <h1 class="text-2xl lg:text-3xl font-extrabold text-gold-gradient">إدارة الإعلانات</h1>
      <p class="text-sm mt-1" style="color: var(--text-tertiary);">إنشاء وإدارة الإعلانات المعروضة على المنصة</p>
    </div>
    <button class="btn-primary flex items-center gap-2" onclick={openCreateModal}>
      <Plus size={18} />
      إعلان جديد
    </button>
  </div>

  <!-- Error Banner -->
  {#if error}
    <div class="panel p-4 flex items-center gap-3" style="border-color: rgba(244,63,122,0.3);">
      <AlertCircle size={20} style="color: #f43f7a;" />
      <p class="text-sm" style="color: #f43f7a;">{error}</p>
      <button class="mr-auto btn-ghost text-xs" onclick={() => (error = null)}>إغلاق</button>
    </div>
  {/if}

  <!-- Stats Cards -->
  <div class="grid grid-cols-1 sm:grid-cols-3 gap-5">
    {#each statCards as card}
      <div class="stat-card group">
        <div class="flex items-center justify-between">
          <div class="space-y-1">
            <p class="text-xs font-medium" style="color: var(--text-tertiary);">{card.label}</p>
            <p class="text-3xl font-bold font-mono tabular-nums" style="color: {card.iconColor};">
              {card.count.toLocaleString('ar-EG')}
            </p>
          </div>
          <div
            class="flex items-center justify-center w-12 h-12 rounded-xl transition-transform duration-300 group-hover:scale-110"
            style="background: {card.iconBg};"
          >
            <card.icon size={22} style="color: {card.iconColor};" />
          </div>
        </div>
      </div>
    {/each}
  </div>

  <!-- Search & Filter Bar -->
  <div class="panel p-4">
    <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
      <!-- Search -->
      <div class="relative flex-1">
        <Search
          size={18}
          class="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
          style="color: var(--text-quaternary);"
        />
        <input
          type="text"
          class="input-field pr-10"
          placeholder="بحث بالعنوان أو الرابط..."
          bind:value={searchQuery}
          dir="rtl"
        />
      </div>

      <!-- Position Filter -->
      <div class="flex items-center gap-2 flex-wrap">
        <button
          class="px-3 py-2.5 rounded-xl text-xs font-medium transition-all cursor-pointer border"
          style={!positionFilter
            ? 'background: rgba(245,181,68,0.12); border-color: #f5b544; color: #f5b544;'
            : 'background: rgba(255,255,255,0.03); border-color: var(--border-subtle); color: var(--text-tertiary);'}
          onclick={() => (positionFilter = '')}
        >
          الكل
        </button>
        {#each positions as pos}
          {@const cfg = positionConfig[pos]}
          <button
            class="px-3 py-2.5 rounded-xl text-xs font-medium transition-all cursor-pointer border"
            style={positionFilter === pos
              ? `background: ${cfg.bg}; border-color: ${cfg.color}; color: ${cfg.color};`
              : 'background: rgba(255,255,255,0.03); border-color: var(--border-subtle); color: var(--text-tertiary);'}
            onclick={() => (positionFilter = positionFilter === pos ? '' : pos)}
          >
            {cfg.label}
          </button>
        {/each}
      </div>
    </div>
  </div>

  <!-- Ads Grid -->
  <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
    {#if loading}
      <!-- Skeleton -->
      {#each Array(6) as _}
        <div class="panel overflow-hidden">
          <div class="animate-shimmer h-40 w-full" style="background: rgba(255,255,255,0.04);"></div>
          <div class="p-4 space-y-3">
            <div class="flex items-center justify-between">
              <div class="animate-shimmer h-4 w-32 rounded" style="background: rgba(255,255,255,0.06);"></div>
              <div class="animate-shimmer h-6 w-16 rounded-full" style="background: rgba(255,255,255,0.06);"></div>
            </div>
            <div class="animate-shimmer h-3 w-20 rounded" style="background: rgba(255,255,255,0.04);"></div>
            <div class="flex gap-2 justify-end">
              <div class="animate-shimmer h-8 w-8 rounded-lg" style="background: rgba(255,255,255,0.06);"></div>
              <div class="animate-shimmer h-8 w-8 rounded-lg" style="background: rgba(255,255,255,0.06);"></div>
            </div>
          </div>
        </div>
      {/each}
    {:else if filteredAds().length === 0}
      <!-- Empty state -->
      <div class="col-span-full panel p-16 text-center">
        <Megaphone size={48} class="mx-auto mb-4 opacity-20" style="color: var(--text-quaternary);" />
        <p class="text-lg font-bold" style="color: var(--text-secondary);">لا توجد إعلانات</p>
        <p class="text-sm mt-1" style="color: var(--text-quaternary);">
          {positionFilter || searchQuery ? 'جرّب تغيير عوامل التصفية' : 'أنشئ إعلانك الأول بالنقر على الزر أعلاه'}
        </p>
        <button
          class="btn-primary mt-5 inline-flex items-center gap-2"
          onclick={openCreateModal}
        >
          <Plus size={16} />
          إعلان جديد
        </button>
      </div>
    {:else}
      {#each filteredAds() as ad (ad.id)}
        {@const cfg = positionConfig[ad.position as Position] || positionConfig.hero}
        {@const isToggling = togglingIds.has(ad.id)}

        <div class="panel overflow-hidden transition-all duration-300 hover:border-white/[0.12] group">
          <!-- Image Preview -->
          <div class="relative h-40 overflow-hidden" style="background: rgba(255,255,255,0.03);">
            {#if ad.image_url}
              <img
                src={ad.image_url}
                alt={ad.title}
                class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                onerror={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            {:else}
              <div class="flex items-center justify-center h-full">
                <ImagePlus size={36} style="color: var(--text-quaternary);" />
              </div>
            {/if}

            <!-- Position badge overlay -->
            <div class="absolute top-3 right-3">
              <span class={cfg.pillClass}>
                {cfg.label}
              </span>
            </div>

            <!-- Active/Inactive overlay indicator -->
            {#if !ad.active}
              <div class="absolute inset-0 flex items-center justify-center" style="background: rgba(4,6,15,0.6);">
                <span class="pill-rose">
                  <EyeOff size={12} />
                  غير نشط
                </span>
              </div>
            {/if}
          </div>

          <!-- Card body -->
          <div class="p-4 space-y-3">
            <!-- Title + Sort order -->
            <div class="flex items-start justify-between gap-2">
              <h3 class="font-bold text-sm truncate min-w-0">{ad.title}</h3>
              <div class="flex items-center gap-1 shrink-0" style="color: var(--text-quaternary);">
                <ArrowUpDown size={12} />
                <span class="text-xs font-mono">{ad.sort_order}</span>
              </div>
            </div>

            <!-- Link preview -->
            {#if ad.link}
              <div class="flex items-center gap-1.5 min-w-0">
                <ExternalLink size={12} class="shrink-0" style="color: var(--text-quaternary);" />
                <span class="text-xs truncate" style="color: var(--text-tertiary);" dir="ltr">{ad.link}</span>
              </div>
            {/if}

            <!-- Button text -->
            {#if ad.button_text}
              <div class="flex items-center gap-1.5">
                <MousePointerClick size={12} style="color: var(--text-quaternary);" />
                <span class="text-xs" style="color: var(--text-tertiary);">{ad.button_text}</span>
              </div>
            {/if}

            <!-- Actions row -->
            <div class="flex items-center justify-between pt-2 border-t" style="border-color: var(--border-subtle);">
              <!-- Active toggle -->
              <button
                class="btn-ghost flex items-center gap-1.5 text-xs"
                onclick={() => toggleActive(ad)}
                disabled={isToggling}
              >
                {#if isToggling}
                  <Loader2 size={14} class="animate-spin" />
                {:else if ad.active}
                  <ToggleRight size={16} style="color: #22d3a4;" />
                  <span style="color: #22d3a4;">نشط</span>
                {:else}
                  <ToggleLeft size={16} style="color: var(--text-quaternary);" />
                  <span style="color: var(--text-quaternary);">معطل</span>
                {/if}
              </button>

              <!-- Edit & Delete -->
              <div class="flex items-center gap-1">
                <button
                  class="btn-ghost p-2 rounded-lg"
                  onclick={() => openEditModal(ad)}
                  aria-label="تعديل"
                  title="تعديل"
                >
                  <Pencil size={15} />
                </button>
                <button
                  class="btn-ghost p-2 rounded-lg"
                  style="color: #f43f7a;"
                  onclick={() => openDeleteDialog(ad)}
                  aria-label="حذف"
                  title="حذف"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          </div>
        </div>
      {/each}
    {/if}
  </div>
</div>
