<script lang="ts">
        import { onMount } from 'svelte';
        import { authGet, authPost, authPut, authDelete, authUpload } from '$lib/api/client';
        import { toast } from '$lib/stores/toast';
        import PageHeader from '$lib/components/PageHeader.svelte';
        import Modal from '$lib/components/Modal.svelte';
        import ErrorAlert from '$lib/components/ErrorAlert.svelte';
        import type { Ad } from '$lib/api/types';
        import { Megaphone, Plus, Edit3, Trash2, RefreshCw, Image, ToggleLeft, ToggleRight, Grid, List } from 'lucide-svelte';

        let ads = $state<Ad[]>([]);
        let loading = $state(true);
        let error = $state('');
        let viewMode = $state<'grid' | 'list'>('grid');

        // Modal
        let modalOpen = $state(false);
        let editingAd = $state<Ad | null>(null);
        let formTitle = $state('');
        let formLink = $state('');
        let formImageUrl = $state('');
        let formButtonText = $state('');
        let formButtonLink = $state('');
        let formPosition = $state<'hero' | 'section' | 'bottom' | 'floating'>('hero');
        let formActive = $state(true);
        let formSortOrder = $state(0);
        let formLoading = $state(false);
        let uploadLoading = $state(false);

        // Delete confirmation
        let deleteOpen = $state(false);
        let deleteId = $state(0);
        let deleteLoading = $state(false);

        const positionLabels: Record<string, string> = {
                hero: 'رئيسي',
                section: 'قسم',
                bottom: 'أسفل',
                floating: 'عائم'
        };

        async function loadAds() {
                loading = true;
                error = '';
                const res = await authGet<Ad[]>('/api/v1/admin/ads');
                if (res.success && res.data) {
                        ads = Array.isArray(res.data) ? res.data : [];
                } else {
                        error = res.error || 'فشل تحميل الإعلانات';
                }
                loading = false;
        }

        function openCreate() {
                editingAd = null;
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

        function openEdit(ad: Ad) {
                editingAd = ad;
                formTitle = ad.title;
                formLink = ad.link || '';
                formImageUrl = ad.image_url || '';
                formButtonText = ad.button_text || '';
                formButtonLink = ad.button_link || '';
                formPosition = ad.position;
                formActive = ad.active;
                formSortOrder = ad.sort_order;
                modalOpen = true;
        }

        async function handleSave() {
                formLoading = true;
                const body = {
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
                if (editingAd) {
                        res = await authPut(`/api/v1/admin/ads/${editingAd.id}`, body);
                } else {
                        res = await authPost('/api/v1/admin/ads', body);
                }

                if (res.success) {
                        toast.success(editingAd ? 'تم تحديث الإعلان' : 'تم إنشاء الإعلان');
                        modalOpen = false;
                        loadAds();
                } else {
                        toast.error(res.error || 'فشل حفظ الإعلان');
                }
                formLoading = false;
        }

        async function handleDelete() {
                deleteLoading = true;
                const res = await authDelete(`/api/v1/admin/ads/${deleteId}`);
                if (res.success) {
                        toast.success('تم حذف الإعلان');
                        deleteOpen = false;
                        loadAds();
                } else {
                        toast.error(res.error || 'فشل حذف الإعلان');
                }
                deleteLoading = false;
        }

        async function handleImageUpload(e: Event) {
                const input = e.target as HTMLInputElement;
                if (!input.files?.length) return;
                uploadLoading = true;
                const res = await authUpload<{ url: string }>('/api/v1/admin/ads/upload', input.files[0]);
                if (res.success && (res as any).url) {
                        formImageUrl = (res as any).url;
                        toast.success('تم رفع الصورة');
                } else {
                        toast.error('فشل رفع الصورة');
                }
                uploadLoading = false;
        }

        async function toggleActive(ad: Ad) {
                const res = await authPut(`/api/v1/admin/ads/${ad.id}`, { ...ad, active: !ad.active });
                if (res.success) {
                        toast.success(ad.active ? 'تم تعطيل الإعلان' : 'تم تفعيل الإعلان');
                        loadAds();
                }
        }

        onMount(() => { loadAds(); });
</script>

<PageHeader title="إدارة الإعلانات" subtitle="إنشاء وتعديل إعلانات المنصة">
        <div class="flex items-center gap-2">
                <button class="btn-ghost px-2 {viewMode === 'grid' ? 'bg-white/10' : ''}" onclick={() => (viewMode = 'grid')}>
                        <Grid size={16} />
                </button>
                <button class="btn-ghost px-2 {viewMode === 'list' ? 'bg-white/10' : ''}" onclick={() => (viewMode = 'list')}>
                        <List size={16} />
                </button>
        </div>
        <button class="btn-primary" onclick={openCreate}>
                <Plus size={16} /> إعلان جديد
        </button>
        <button class="btn-ghost" onclick={loadAds} disabled={loading}>
                <RefreshCw size={16} class={loading ? 'animate-spin' : ''} />
        </button>
</PageHeader>

{#if error}
        <ErrorAlert message={error} onclose={() => (error = '')} />
{/if}

{#if loading}
        <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {#each Array(6) as _}
                        <div class="panel p-5"><div class="skeleton h-48"></div></div>
                {/each}
        </div>
{:else if ads.length === 0}
        <div class="panel p-8 text-center text-ink-muted">لا توجد إعلانات</div>
{:else if viewMode === 'grid'}
        <!-- Grid View -->
        <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {#each ads as ad}
                        <div class="panel overflow-hidden group">
                                <!-- Image -->
                                <div class="h-40 bg-ink-800 relative overflow-hidden">
                                        {#if ad.image_url}
                                                <img src={ad.image_url} alt={ad.title} class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                        {:else}
                                                <div class="flex items-center justify-center h-full">
                                                        <Image size={32} class="text-ink-muted" />
                                                </div>
                                        {/if}
                                        <div class="absolute top-2 left-2">
                                                <span class={ad.active ? 'pill-active' : 'pill-inactive'}>{ad.active ? 'نشط' : 'غير نشط'}</span>
                                        </div>
                                        <div class="absolute top-2 right-2">
                                                <span class="pill-pending">{positionLabels[ad.position]}</span>
                                        </div>
                                </div>
                                <!-- Info -->
                                <div class="p-4 flex flex-col gap-3">
                                        <h3 class="text-sm font-bold text-ink-primary truncate">{ad.title}</h3>
                                        <div class="flex items-center gap-2">
                                                <button class="btn-ghost text-xs flex-1" onclick={() => openEdit(ad)}>
                                                        <Edit3 size={12} /> تعديل
                                                </button>
                                                <button class="btn-ghost text-xs text-accent-rose" onclick={() => { deleteId = ad.id; deleteOpen = true; }}>
                                                        <Trash2 size={12} />
                                                </button>
                                                <button class="text-ink-muted hover:text-ink-primary transition-colors" onclick={() => toggleActive(ad)}>
                                                        {#if ad.active}<ToggleRight size={20} class="text-accent-mint" />{:else}<ToggleLeft size={20} />{/if}
                                                </button>
                                        </div>
                                </div>
                        </div>
                {/each}
        </div>
{:else}
        <!-- List View -->
        <div class="panel overflow-hidden">
                <table class="data-table">
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
                                {#each ads as ad}
                                        <tr>
                                                <td>
                                                        {#if ad.image_url}
                                                                <img src={ad.image_url} alt="" class="w-16 h-10 rounded object-cover" />
                                                        {:else}
                                                                <div class="w-16 h-10 rounded bg-ink-800 flex items-center justify-center"><Image size={14} class="text-ink-muted" /></div>
                                                        {/if}
                                                </td>
                                                <td><span class="text-sm font-medium text-ink-primary">{ad.title}</span></td>
                                                <td><span class="pill-pending">{positionLabels[ad.position]}</span></td>
                                                <td><span class={ad.active ? 'pill-active' : 'pill-inactive'}>{ad.active ? 'نشط' : 'غير نشط'}</span></td>
                                                <td><span class="text-sm text-ink-muted tabular-nums">{ad.sort_order}</span></td>
                                                <td>
                                                        <div class="flex items-center gap-2">
                                                                <button class="btn-ghost text-xs px-2 py-1" onclick={() => openEdit(ad)}><Edit3 size={12} /> تعديل</button>
                                                                <button class="btn-danger text-xs px-2 py-1" onclick={() => { deleteId = ad.id; deleteOpen = true; }}><Trash2 size={12} /></button>
                                                        </div>
                                                </td>
                                        </tr>
                                {/each}
                        </tbody>
                </table>
        </div>
{/if}

<!-- Create/Edit Modal -->
<Modal bind:open={modalOpen} title={editingAd ? 'تعديل الإعلان' : 'إعلان جديد'} icon={Megaphone} size="lg">
        <form onsubmit={(e) => { e.preventDefault(); handleSave(); }} class="flex flex-col gap-4">
                <div>
                        <label for="adTitle" class="block text-sm font-medium text-ink-secondary mb-2">العنوان</label>
                        <input id="adTitle" type="text" bind:value={formTitle} class="input-field" placeholder="عنوان الإعلان" required />
                </div>
                <div class="grid grid-cols-2 gap-4">
                        <div>
                                <label for="adLink" class="block text-sm font-medium text-ink-secondary mb-2">الرابط</label>
                                <input id="adLink" type="url" bind:value={formLink} class="input-field" placeholder="https://" dir="ltr" />
                        </div>
                        <div>
                                <label for="adPosition" class="block text-sm font-medium text-ink-secondary mb-2">الموقع</label>
                                <select id="adPosition" bind:value={formPosition} class="input-field">
                                        <option value="hero">رئيسي</option>
                                        <option value="section">قسم</option>
                                        <option value="bottom">أسفل</option>
                                        <option value="floating">عائم</option>
                                </select>
                        </div>
                </div>
                <div>
                        <label for="adImageUrl" class="block text-sm font-medium text-ink-secondary mb-2">رابط الصورة</label>
                        <input id="adImageUrl" type="url" bind:value={formImageUrl} class="input-field" placeholder="https://..." dir="ltr" />
                </div>
                <div>
                        <label for="adImageFile" class="block text-sm font-medium text-ink-secondary mb-2">أو رفع صورة</label>
                        <input id="adImageFile" type="file" accept="image/*" onchange={handleImageUpload} class="text-sm text-ink-secondary" disabled={uploadLoading} />
                        {#if uploadLoading}
                                <span class="text-xs text-ink-muted">جاري الرفع...</span>
                        {/if}
                </div>
                <div class="grid grid-cols-2 gap-4">
                        <div>
                                <label for="adBtnText" class="block text-sm font-medium text-ink-secondary mb-2">نص الزر</label>
                                <input id="adBtnText" type="text" bind:value={formButtonText} class="input-field" placeholder="اضغط هنا" />
                        </div>
                        <div>
                                <label for="adBtnLink" class="block text-sm font-medium text-ink-secondary mb-2">رابط الزر</label>
                                <input id="adBtnLink" type="url" bind:value={formButtonLink} class="input-field" placeholder="https://" dir="ltr" />
                        </div>
                </div>
                <div class="grid grid-cols-2 gap-4">
                        <div>
                                <label for="adSort" class="block text-sm font-medium text-ink-secondary mb-2">الترتيب</label>
                                <input id="adSort" type="number" bind:value={formSortOrder} class="input-field" />
                        </div>
                        <div class="flex items-center gap-3 pt-6">
                                <button type="button" onclick={() => (formActive = !formActive)} class="toggle-track {formActive ? 'toggle-track-active' : ''}" aria-label="تفعيل الإعلان">
                                        <div class="toggle-thumb {formActive ? 'toggle-thumb-active right-1' : 'right-[22px]'}"></div>
                                </button>
                                <span class="text-sm text-ink-secondary">{formActive ? 'نشط' : 'غير نشط'}</span>
                        </div>
                </div>
        </form>
        {#snippet footer()}
                <button class="btn-ghost" onclick={() => (modalOpen = false)}>إلغاء</button>
                <button class="btn-primary" onclick={handleSave} disabled={formLoading || !formTitle}>
                        {#if formLoading}<RefreshCw size={14} class="animate-spin" />{/if}
                        {editingAd ? 'حفظ التعديلات' : 'إنشاء'}
                </button>
        {/snippet}
</Modal>

<!-- Delete Confirmation -->
<Modal bind:open={deleteOpen} title="حذف الإعلان" icon={Trash2} iconColor="#fb7185" iconBg="rgba(251,113,133,0.15)" size="sm">
        <p class="text-sm text-ink-secondary">هل أنت متأكد من حذف هذا الإعلان؟ لا يمكن التراجع عن هذا الإجراء.</p>
        {#snippet footer()}
                <button class="btn-ghost" onclick={() => (deleteOpen = false)}>إلغاء</button>
                <button class="btn-danger" onclick={handleDelete} disabled={deleteLoading}>
                        {#if deleteLoading}<RefreshCw size={14} class="animate-spin" />{/if}
                        حذف
                </button>
        {/snippet}
</Modal>
