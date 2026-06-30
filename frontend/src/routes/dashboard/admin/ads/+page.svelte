<script lang="ts">
  import { onMount } from 'svelte';
  import { authGet, parseApiResponse } from '$lib/api/client';
  import { toasts } from '$lib/stores/toast';
  import { formatDate } from '$lib/utils/format';
  import {
    Megaphone, Plus, Edit, Trash2, Eye, EyeOff, RefreshCw,
    LayoutPanelTop, SidebarOpen, Bell, MessageSquare, X, Check,
    Loader2, Sparkles, Calendar, Save
  } from 'lucide-svelte';

  let ads = $state<any[]>([]);
  let loading = $state(true);
  let refreshing = $state(false);
  let showForm = $state(false);
  let editing = $state<any>(null);
  let saving = $state(false);

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
    refreshing = true;
    try {
      const res = await authGet('/api/v1/admin/ads');
      const data = await parseApiResponse<any>(res);
      ads = data?.ads || data || [];
    } catch {
      ads = [];
    } finally {
      refreshing = false;
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
    saving = true;
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
    } finally {
      saving = false;
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

  const stats = $derived({
    total: ads.length,
    active: ads.filter((a) => a.active).length,
    inactive: ads.filter((a) => !a.active).length,
    banners: ads.filter((a) => a.position === 'top_banner').length
  });

  const positionConfig: Record<string, { label: string; icon: any; pillClass: string; iconColor: string }> = {
    top_banner: { label: 'بانر علوي', icon: LayoutPanelTop, pillClass: 'pill-gold', iconColor: 'text-accent-gold' },
    sidebar: { label: 'الشريط الجانبي', icon: SidebarOpen, pillClass: 'pill-violet', iconColor: 'text-accent-violet' },
    popup: { label: 'نافذة منبثقة', icon: Sparkles, pillClass: 'pill-rose', iconColor: 'text-accent-rose' },
    notification: { label: 'إشعار', icon: Bell, pillClass: 'pill-mint', iconColor: 'text-accent-mint' }
  };

  function getPositionMeta(pos: string) {
    return positionConfig[pos] || { label: pos, icon: MessageSquare, pillClass: 'pill-azure', iconColor: 'text-accent-azure' };
  }
</script>

<svelte:head><title>إدارة الإعلانات — NEXUS Admin</title></svelte:head>

<div class="space-y-6 relative">
  <!-- Ambient aurora -->
  <div class="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
    <div class="absolute -top-20 right-1/4 w-96 h-96 bg-accent-rose/8 blur-[120px] rounded-full animate-pulse-glow"></div>
    <div class="absolute bottom-0 -left-32 w-96 h-96 bg-accent-violet/5 blur-[120px] rounded-full animate-pulse-glow" style="animation-delay: 2s;"></div>
  </div>

  <!-- Header -->
  <div class="relative flex items-center justify-between flex-wrap gap-4">
    <div class="flex items-center gap-3">
      <div class="w-11 h-11 rounded-2xl bg-gradient-to-br from-accent-rose/20 to-accent-gold/10 border border-accent-rose/20 flex items-center justify-center">
        <Megaphone size={22} class="text-accent-rose" />
      </div>
      <div>
        <div class="flex items-center gap-2.5 mb-0.5">
          <h1 class="text-2xl sm:text-3xl font-bold text-white tracking-tight">إدارة الإعلانات</h1>
          {#if stats.active > 0}
            <span class="pill-mint text-[10px] flex items-center gap-1">
              <span class="relative flex h-1.5 w-1.5">
                <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-mint opacity-60"></span>
                <span class="relative inline-flex rounded-full h-1.5 w-1.5 bg-accent-mint"></span>
              </span>
              {stats.active} نشط
            </span>
          {/if}
        </div>
        <p class="text-sm text-slate-400">إدارة الإعلانات والبانرات في المنصة</p>
      </div>
    </div>
    <div class="flex gap-2">
      <button onclick={loadAds} disabled={refreshing} class="btn-ghost" aria-label="تحديث">
        <RefreshCw size={16} class={refreshing ? 'animate-spin' : ''} />
      </button>
      <button onclick={() => { resetForm(); showForm = true; }} class="btn-primary">
        <Plus size={16} /> إعلان جديد
      </button>
    </div>
  </div>

  <!-- Quick stats grid -->
  <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
    <div class="stat-card group relative overflow-hidden">
      <div class="absolute -top-6 -right-6 w-20 h-20 bg-accent-gold/10 blur-2xl rounded-full group-hover:bg-accent-gold/15 transition-all"></div>
      <div class="relative">
        <div class="flex items-center gap-1.5 mb-2">
          <Megaphone size={12} class="text-accent-gold" />
          <span class="text-[10px] uppercase tracking-wider text-slate-500 font-bold">الإجمالي</span>
        </div>
        <p class="text-xl font-bold text-white tabular-nums">{stats.total}</p>
        <p class="text-[10px] text-slate-500 mt-0.5">إعلان منشور</p>
      </div>
    </div>
    <div class="stat-card group relative overflow-hidden">
      <div class="absolute -top-6 -right-6 w-20 h-20 bg-accent-mint/10 blur-2xl rounded-full group-hover:bg-accent-mint/15 transition-all"></div>
      <div class="relative">
        <div class="flex items-center gap-1.5 mb-2">
          <Eye size={12} class="text-accent-mint" />
          <span class="text-[10px] uppercase tracking-wider text-slate-500 font-bold">نشطة</span>
        </div>
        <p class="text-xl font-bold text-white tabular-nums">{stats.active}</p>
        <p class="text-[10px] text-slate-500 mt-0.5">إعلان معروض</p>
      </div>
    </div>
    <div class="stat-card group relative overflow-hidden">
      <div class="absolute -top-6 -right-6 w-20 h-20 bg-accent-rose/10 blur-2xl rounded-full group-hover:bg-accent-rose/15 transition-all"></div>
      <div class="relative">
        <div class="flex items-center gap-1.5 mb-2">
          <EyeOff size={12} class="text-accent-rose" />
          <span class="text-[10px] uppercase tracking-wider text-slate-500 font-bold">موقوفة</span>
        </div>
        <p class="text-xl font-bold text-white tabular-nums">{stats.inactive}</p>
        <p class="text-[10px] text-slate-500 mt-0.5">إعلان موقوف</p>
      </div>
    </div>
    <div class="stat-card group relative overflow-hidden">
      <div class="absolute -top-6 -right-6 w-20 h-20 bg-accent-violet/10 blur-2xl rounded-full group-hover:bg-accent-violet/15 transition-all"></div>
      <div class="relative">
        <div class="flex items-center gap-1.5 mb-2">
          <LayoutPanelTop size={12} class="text-accent-violet" />
          <span class="text-[10px] uppercase tracking-wider text-slate-500 font-bold">بانرات</span>
        </div>
        <p class="text-xl font-bold text-white tabular-nums">{stats.banners}</p>
        <p class="text-[10px] text-slate-500 mt-0.5">إعلان في الأعلى</p>
      </div>
    </div>
  </div>

  <!-- Form panel -->
  {#if showForm}
    <div class="panel p-6 relative overflow-hidden">
      <div class="absolute top-0 inset-x-0 h-px pointer-events-none" style="background: linear-gradient(90deg, transparent, rgba(245, 181, 68, 0.4), transparent);"></div>
      <div class="absolute -top-12 -right-12 w-32 h-32 bg-accent-gold/10 blur-3xl rounded-full pointer-events-none"></div>

      <div class="relative">
        <div class="flex items-center justify-between mb-5">
          <h3 class="text-base font-bold text-white flex items-center gap-2">
            <div class="w-8 h-8 rounded-xl bg-accent-gold/10 border border-accent-gold/20 flex items-center justify-center">
              {#if editing}
                <Edit size={15} class="text-accent-gold" />
              {:else}
                <Plus size={15} class="text-accent-gold" />
              {/if}
            </div>
            {editing ? 'تعديل إعلان' : 'إنشاء إعلان جديد'}
          </h3>
          <button onclick={() => { resetForm(); showForm = false; }} class="p-1.5 rounded-lg text-slate-400 hover:bg-white/5 hover:text-white transition-colors">
            <X size={16} />
          </button>
        </div>

        <form onsubmit={(e) => { e.preventDefault(); saveAd(); }} class="space-y-4">
          <div>
            <label class="input-label" for="title">العنوان</label>
            <input id="title" bind:value={title} type="text" class="input" placeholder="عنوان جذّاب للإعلان" />
          </div>
          <div>
            <label class="input-label" for="content">المحتوى</label>
            <textarea id="content" bind:value={content} rows="3" class="input resize-none" placeholder="نص الإعلان التفصيلي..."></textarea>
          </div>
          <div class="grid sm:grid-cols-2 gap-4">
            <div>
              <span class="input-label">الموضع</span>
              <div class="grid grid-cols-2 gap-2">
                {#each Object.entries(positionConfig) as [key, meta]}
                  <button
                    type="button"
                    onclick={() => (position = key)}
                    class="relative p-3 rounded-xl border text-right transition-all overflow-hidden {position === key ? 'border-accent-gold/40 bg-accent-gold/10' : 'border-white/10 bg-white/[0.02] hover:bg-white/5'}"
                  >
                    {#if position === key}
                      <div class="absolute -top-4 -right-4 w-16 h-16 bg-accent-gold/15 blur-2xl rounded-full"></div>
                    {/if}
                    <div class="relative flex items-center gap-2">
                      <meta.icon size={14} class={position === key ? 'text-accent-gold' : 'text-slate-400'} />
                      <span class="text-xs font-medium {position === key ? 'text-white' : 'text-slate-300'}">{meta.label}</span>
                    </div>
                  </button>
                {/each}
              </div>
            </div>
            <div>
              <span class="input-label">الحالة</span>
              <button
                type="button"
                onclick={() => (active = !active)}
                class="w-full p-4 rounded-xl border transition-all flex items-center justify-between {active ? 'border-accent-mint/40 bg-accent-mint/10' : 'border-white/10 bg-white/[0.02]'}"
              >
                <div class="flex items-center gap-3">
                  <div class="w-9 h-9 rounded-xl {active ? 'bg-accent-mint/15' : 'bg-white/5'} flex items-center justify-center">
                    {#if active}
                      <Eye size={16} class="text-accent-mint" />
                    {:else}
                      <EyeOff size={16} class="text-slate-500" />
                    {/if}
                  </div>
                  <div class="text-right">
                    <p class="text-sm font-medium text-white">{active ? 'نشط' : 'موقوف'}</p>
                    <p class="text-[10px] text-slate-500">{active ? 'معروض للمستخدمين' : 'مخفي عن المستخدمين'}</p>
                  </div>
                </div>
                <span class="relative w-11 h-6 rounded-full transition-colors {active ? 'bg-accent-mint' : 'bg-white/10'}">
                  <span class="absolute top-0.5 {active ? 'left-0.5' : 'right-0.5'} w-5 h-5 rounded-full bg-white shadow transition-all"></span>
                </span>
              </button>
            </div>
          </div>
          <div class="flex gap-2 pt-2">
            <button type="submit" disabled={saving} class="btn-primary flex-1 py-2.5">
              {#if saving}
                <Loader2 size={15} class="animate-spin" /> جارٍ الحفظ...
              {:else}
                <Save size={15} /> {editing ? 'تحديث الإعلان' : 'نشر الإعلان'}
              {/if}
            </button>
            <button type="button" onclick={() => { resetForm(); showForm = false; }} class="btn-secondary px-6">
              إلغاء
            </button>
          </div>
        </form>
      </div>
    </div>
  {/if}

  <!-- Ads list -->
  <div class="panel overflow-hidden relative">
    <div class="absolute top-0 inset-x-0 h-px pointer-events-none" style="background: linear-gradient(90deg, transparent, rgba(251, 113, 133, 0.3), transparent);"></div>
    <div class="px-5 py-4 border-b border-white/5 flex items-center justify-between">
      <h3 class="text-sm font-bold text-white flex items-center gap-2">
        <div class="w-7 h-7 rounded-lg bg-accent-rose/10 border border-accent-rose/20 flex items-center justify-center">
          <Megaphone size={14} class="text-accent-rose" />
        </div>
        الإعلانات المنشورة
      </h3>
      <span class="text-xs text-slate-500 tabular-nums">{ads.length} إعلان</span>
    </div>

    {#if loading}
      <div class="p-6 space-y-3">
        {#each Array(3) as _}<div class="h-20 rounded-xl bg-white/5 animate-shimmer"></div>{/each}
      </div>
    {:else if ads.length === 0}
      <div class="py-20 text-center">
        <div class="relative inline-block mb-4">
          <div class="absolute inset-0 bg-accent-rose/10 blur-3xl rounded-full"></div>
          <Megaphone size={48} class="relative text-slate-600 mx-auto" />
        </div>
        <p class="text-sm font-medium text-slate-300">لا توجد إعلانات</p>
        <p class="text-xs text-slate-500 mt-1">أنشئ إعلانك الأول ليظهر للمستخدمين</p>
        <button onclick={() => { resetForm(); showForm = true; }} class="inline-flex items-center gap-1.5 mt-4 px-4 py-2 rounded-xl bg-accent-gold/10 border border-accent-gold/30 text-accent-gold text-xs font-medium hover:bg-accent-gold/20 transition-colors">
          <Plus size={14} /> إنشاء إعلان
        </button>
      </div>
    {:else}
      <div class="divide-y divide-white/5">
        {#each ads as ad}
          {@const meta = getPositionMeta(ad.position)}
          <div class="px-5 py-4 hover:bg-white/[0.02] transition-colors group">
            <div class="flex items-start justify-between gap-4">
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 mb-1.5 flex-wrap">
                  <h3 class="text-sm font-bold text-white">{ad.title}</h3>
                  <span class="pill {ad.active ? 'pill-mint' : 'pill-rose'} flex items-center gap-1 text-[10px]">
                    {#if ad.active}<Check size={9} /> نشط{:else}<EyeOff size={9} /> موقوف{/if}
                  </span>
                  <span class="{meta.pillClass} flex items-center gap-1 text-[10px]">
                    <meta.icon size={9} /> {meta.label}
                  </span>
                </div>
                <p class="text-xs text-slate-400 line-clamp-2 leading-relaxed">{ad.content}</p>
                <p class="text-[10px] text-slate-500 mt-1.5 flex items-center gap-1">
                  <Calendar size={9} /> {formatDate(ad.created_at)}
                </p>
              </div>
              <div class="flex gap-1 shrink-0">
                <button onclick={() => editAd(ad)} class="p-2 rounded-lg text-slate-400 hover:bg-accent-gold/10 hover:text-accent-gold transition-colors" aria-label="تعديل">
                  <Edit size={14} />
                </button>
                <button onclick={() => deleteAd(ad.id)} class="p-2 rounded-lg text-accent-rose hover:bg-accent-rose/10 transition-colors" aria-label="حذف">
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
