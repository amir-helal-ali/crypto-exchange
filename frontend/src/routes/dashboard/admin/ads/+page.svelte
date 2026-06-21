<script lang="ts">
  import { onMount } from 'svelte';
  import { authGet, parseApiResponse } from '$lib/api/client';
  import { toasts } from '$lib/stores/toast';
  import { formatDate } from '$lib/utils/format';
  import { Megaphone, Plus, Edit, Trash2, Eye, EyeOff } from 'lucide-svelte';

  let ads = $state<any[]>([]);
  let loading = $state(true);
  let showForm = $state(false);
  let editing = $state<any>(null);

  let title = $state('');
  let content = $state('');
  let position = $state('top_banner');
  let active = $state(true);

  onMount(() => {
(async () => {
    await loadAds();
    loading = false;
  
  })();
});

  async function loadAds() {
    try {
      const res = await authGet('/api/v1/admin/ads');
      const data = await parseApiResponse<any>(res);
      ads = data?.ads || data || [];
    } catch {
      ads = [];
    }
  }

  function resetForm() {
    title = '';
    content = '';
    position = 'top_banner';
    active = true;
    editing = null;
  }

  async function saveAd() {
    if (!title.trim() || !content.trim()) {
      toasts.error('العنوان والمحتوى مطلوبان');
      return;
    }
    try {
      const { authPost, authPut } = await import('$lib/api/client');
      const body = { title, content, position, active };
      if (editing) {
        await authPut(`/api/v1/admin/ads/${editing.id}`, body);
        toasts.success('تم تحديث الإعلان');
      } else {
        await authPost('/api/v1/admin/ads', body);
        toasts.success('تم إنشاء الإعلان');
      }
      resetForm();
      showForm = false;
      loadAds();
    } catch {
      toasts.error('فشل الحفظ');
    }
  }

  async function deleteAd(id: number) {
    if (!confirm('هل أنت متأكد من الحذف؟')) return;
    try {
      const { authDelete } = await import('$lib/api/client');
      await authDelete(`/api/v1/admin/ads/${id}`);
      toasts.success('تم الحذف');
      loadAds();
    } catch {
      toasts.error('فشل الحذف');
    }
  }

  function editAd(ad: any) {
    editing = ad;
    title = ad.title;
    content = ad.content;
    position = ad.position;
    active = ad.active;
    showForm = true;
  }
</script>

<svelte:head><title>الإعلانات — لوحة الإدارة</title></svelte:head>

<div class="space-y-5">
  <div class="flex items-center justify-between">
    <div>
      <h1 class="text-2xl sm:text-3xl font-bold text-white">الإعلانات</h1>
      <p class="text-sm text-slate-400 mt-1">إدارة الإعلانات والبانرات</p>
    </div>
    <button onclick={() => { resetForm(); showForm = true; }} class="btn-primary">
      <Plus size={16} /> إعلان جديد
    </button>
  </div>

  {#if showForm}
    <div class="panel p-6">
      <h3 class="text-base font-bold text-white mb-4">{editing ? 'تعديل إعلان' : 'إعلان جديد'}</h3>
      <form onsubmit={(e) => { e.preventDefault(); saveAd(); }} class="space-y-4">
        <div>
          <label class="input-label" for="title">العنوان</label>
          <input id="title" bind:value={title} type="text" class="input" placeholder="عنوان الإعلان" />
        </div>
        <div>
          <label class="input-label" for="content">المحتوى</label>
          <textarea id="content" bind:value={content} rows="3" class="input resize-none" placeholder="نص الإعلان"></textarea>
        </div>
        <div class="grid sm:grid-cols-2 gap-4">
          <div>
            <label class="input-label" for="position">الموضع</label>
            <select id="position" bind:value={position} class="input">
              <option value="top_banner">بانر علوي</option>
              <option value="sidebar">الشريط الجانبي</option>
              <option value="popup">نافذة منبثقة</option>
              <option value="notification">إشعار</option>
            </select>
          </div>
          <div>
            <span class="input-label">الحالة</span>
            <label class="flex items-center gap-2 input cursor-pointer">
              <input type="checkbox" bind:checked={active} class="w-4 h-4" />
              <span class="text-sm">نشط</span>
            </label>
          </div>
        </div>
        <div class="flex gap-2">
          <button type="submit" class="btn-primary">{editing ? 'تحديث' : 'إنشاء'}</button>
          <button type="button" onclick={() => { resetForm(); showForm = false; }} class="btn-secondary">إلغاء</button>
        </div>
      </form>
    </div>
  {/if}

  <div class="panel overflow-hidden">
    {#if loading}
      <div class="p-6 space-y-3">
        {#each Array(3) as _}<div class="h-20 rounded-xl bg-white/5 animate-shimmer"></div>{/each}
      </div>
    {:else if ads.length === 0}
      <div class="py-16 text-center text-slate-500">
        <Megaphone size={40} class="mx-auto mb-3 opacity-30" />
        <p class="text-sm">لا توجد إعلانات</p>
      </div>
    {:else}
      <div class="divide-y divide-white/5">
        {#each ads as ad}
          <div class="px-5 py-4 hover:bg-white/[0.02]">
            <div class="flex items-start justify-between gap-4">
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 mb-1">
                  <h3 class="text-sm font-bold text-white">{ad.title}</h3>
                  <span class="pill {ad.active ? 'pill-mint' : 'pill-rose'} text-[10px]">
                    {ad.active ? 'نشط' : 'موقوف'}
                  </span>
                  <span class="pill-gold text-[10px]">{ad.position}</span>
                </div>
                <p class="text-xs text-slate-400 line-clamp-2">{ad.content}</p>
                <p class="text-[10px] text-slate-500 mt-1">{formatDate(ad.created_at)}</p>
              </div>
              <div class="flex gap-1">
                <button onclick={() => editAd(ad)} class="p-1.5 rounded-lg text-slate-400 hover:bg-white/5 hover:text-white" aria-label="تعديل">
                  <Edit size={14} />
                </button>
                <button onclick={() => deleteAd(ad.id)} class="p-1.5 rounded-lg text-accent-rose hover:bg-accent-rose/10" aria-label="حذف">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>
