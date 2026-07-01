<script lang="ts">
        import { onMount } from 'svelte';
        import { authGet, authPut, createAdminStream } from '$lib/api/client';
        import { toast } from '$lib/stores/toast';
        import { formatNumber, formatDate, maskString, docTypeLabels, statusConfigs, debounce } from '$lib/utils/helpers';
        import StatCard from '$lib/components/StatCard.svelte';
        import PageHeader from '$lib/components/PageHeader.svelte';
        import SearchBar from '$lib/components/SearchBar.svelte';
        import Modal from '$lib/components/Modal.svelte';
        import ErrorAlert from '$lib/components/ErrorAlert.svelte';
        import type { KYCRequest, KYCStats } from '$lib/api/types';
        import { ShieldCheck, Clock, CheckCircle, XCircle, Eye, RefreshCw } from 'lucide-svelte';

        let requests = $state<KYCRequest[]>([]);
        let stats = $state<KYCStats | null>(null);
        let loading = $state(true);
        let error = $state('');
        let page = $state(1);
        let totalPages = $state(1);
        let search = $state('');
        let statusFilter = $state('');
        let eventSource: EventSource | null = null;

        // Modal state
        let previewOpen = $state(false);
        let previewUrl = $state('');
        let rejectOpen = $state(false);
        let rejectId = $state(0);
        let rejectReason = $state('');
        let rejectLoading = $state(false);

        const filters = [
                {
                        key: 'status',
                        label: 'الحالة',
                        options: [
                                { value: 'PENDING', label: 'قيد الانتظار' },
                                { value: 'APPROVED', label: 'مقبول' },
                                { value: 'REJECTED', label: 'مرفوض' }
                        ]
                }
        ];
        let filterValues = $state<Record<string, string>>({});

        async function loadKYC() {
                loading = true;
                error = '';
                let path = `/api/v1/admin/kyc?page=${page}&limit=12`;
                if (search) path += `&search=${encodeURIComponent(search)}`;
                const res = await authGet<KYCRequest[]>(path);
                if (res.success && res.data) {
                        requests = (res as any).data || [];
                        totalPages = Math.ceil(((res as any).total || 0) / 12);
                } else {
                        error = res.error || 'فشل تحميل طلبات KYC';
                }
                loading = false;
        }

        async function approveKYC(id: number) {
                const res = await authPut(`/api/v1/admin/kyc/${id}/review`, { status: 'APPROVED' });
                if (res.success) {
                        toast.success('تم قبول طلب التحقق');
                        loadKYC();
                } else {
                        toast.error(res.error || 'فشل مراجعة الطلب');
                }
        }

        async function rejectKYC() {
                rejectLoading = true;
                const res = await authPut(`/api/v1/admin/kyc/${rejectId}/review`, {
                        status: 'REJECTED',
                        rejection_reason: rejectReason
                });
                if (res.success) {
                        toast.success('تم رفض طلب التحقق');
                        rejectOpen = false;
                        rejectReason = '';
                        loadKYC();
                } else {
                        toast.error(res.error || 'فشل مراجعة الطلب');
                }
                rejectLoading = false;
        }

        function openPreview(url: string) {
                previewUrl = url;
                previewOpen = true;
        }

        function openReject(id: number) {
                rejectId = id;
                rejectReason = '';
                rejectOpen = true;
        }

        onMount(() => {
                loadKYC();
                eventSource = createAdminStream(['kyc']);
                eventSource?.addEventListener('kyc', () => { loadKYC(); });
                return () => { eventSource?.close(); };
        });
</script>

<PageHeader title="التحقق KYC" subtitle="مراجعة طلبات التحقق من الهوية">
        <button class="btn-ghost" onclick={loadKYC} disabled={loading}>
                <RefreshCw size={16} class={loading ? 'animate-spin' : ''} />
        </button>
</PageHeader>

<!-- Stats -->
<div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard label="قيد الانتظار" value={stats ? formatNumber(stats.pending) : '—'} icon={Clock} iconColor="#f5b544" iconBg="rgba(245,181,68,0.15)" chartColor="#f5b544" chartSeed={10} loading={loading} />
        <StatCard label="مقبول" value={stats ? formatNumber(stats.approved) : '—'} icon={CheckCircle} iconColor="#22d3a4" iconBg="rgba(34,211,164,0.15)" chartColor="#22d3a4" chartSeed={20} loading={loading} />
        <StatCard label="مرفوض" value={stats ? formatNumber(stats.rejected) : '—'} icon={XCircle} iconColor="#fb7185" iconBg="rgba(251,113,133,0.15)" chartColor="#fb7185" chartSeed={30} loading={loading} />
</div>

{#if error}
        <ErrorAlert message={error} onclose={() => (error = '')} />
{/if}

<SearchBar bind:value={search} placeholder="بحث بالاسم..." {filters} bind:filterValues />

<!-- KYC Cards Grid -->
{#if loading && requests.length === 0}
        <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {#each Array(6) as _}
                        <div class="panel p-5"><div class="skeleton h-40"></div></div>
                {/each}
        </div>
{:else if requests.length === 0}
        <div class="panel p-8 text-center text-ink-muted">لا توجد طلبات تحقق</div>
{:else}
        <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {#each requests as req}
                        <div class="panel p-5 flex flex-col gap-4">
                                <!-- User Info -->
                                <div class="flex items-center gap-3">
                                        <div class="w-10 h-10 rounded-lg bg-accent-violet/15 border border-accent-violet/20 flex items-center justify-center">
                                                <span class="text-sm font-bold text-accent-violet">{req.user?.username?.[0]?.toUpperCase() || '?'}</span>
                                        </div>
                                        <div class="flex-1 min-w-0">
                                                <p class="text-sm font-bold text-ink-primary truncate">{req.user?.username}</p>
                                                <p class="text-xs text-ink-muted truncate" dir="ltr">{req.user?.email}</p>
                                        </div>
                                        <span class={statusConfigs[req.status]?.pillClass || 'pill-none'}>
                                                {statusConfigs[req.status]?.label || req.status}
                                        </span>
                                </div>

                                <!-- Document Info -->
                                <div class="grid grid-cols-2 gap-3 text-sm">
                                        <div>
                                                <span class="text-ink-muted block text-xs mb-1">نوع المستند</span>
                                                <span class="text-ink-primary">{docTypeLabels[req.document_type] || req.document_type}</span>
                                        </div>
                                        <div>
                                                <span class="text-ink-muted block text-xs mb-1">رقم المستند</span>
                                                <span class="text-ink-primary font-mono text-xs" dir="ltr">{maskString(req.document_number)}</span>
                                        </div>
                                        <div>
                                                <span class="text-ink-muted block text-xs mb-1">تاريخ التقديم</span>
                                                <span class="text-ink-secondary">{formatDate(req.created_at)}</span>
                                        </div>
                                </div>

                                {#if req.status === 'REJECTED' && req.rejection_reason}
                                        <div class="text-xs text-accent-rose bg-accent-rose/10 border border-accent-rose/15 rounded-lg px-3 py-2">
                                                سبب الرفض: {req.rejection_reason}
                                        </div>
                                {/if}

                                <!-- Document Preview Buttons -->
                                <div class="flex items-center gap-2">
                                        <button class="btn-ghost text-xs flex-1" onclick={() => openPreview(req.document_front)}>
                                                <Eye size={14} /> المستند الأمامي
                                        </button>
                                        {#if req.document_back}
                                                <button class="btn-ghost text-xs flex-1" onclick={() => openPreview(req.document_back)}>
                                                        <Eye size={14} /> المستند الخلفي
                                                </button>
                                        {/if}
                                </div>

                                <!-- Actions (only for PENDING) -->
                                {#if req.status === 'PENDING'}
                                        <div class="flex items-center gap-2 pt-2 border-t border-white/6">
                                                <button class="btn-buy flex-1 text-xs" onclick={() => approveKYC(req.id)}>
                                                        <CheckCircle size={14} /> قبول
                                                </button>
                                                <button class="btn-danger flex-1 text-xs" onclick={() => openReject(req.id)}>
                                                        <XCircle size={14} /> رفض
                                                </button>
                                        </div>
                                {/if}
                        </div>
                {/each}
        </div>
{/if}

<!-- Preview Modal -->
<Modal bind:open={previewOpen} title="معاينة المستند" icon={Eye} size="lg">
        <div class="flex items-center justify-center min-h-[300px]">
                {#if previewUrl}
                        <img src={previewUrl} alt="Document" class="max-w-full max-h-[60vh] rounded-lg border border-white/10" />
                {/if}
        </div>
</Modal>

<!-- Reject Modal -->
<Modal bind:open={rejectOpen} title="رفض طلب التحقق" icon={XCircle} iconColor="#fb7185" iconBg="rgba(251,113,133,0.15)" size="md">
        <div class="flex flex-col gap-4">
                <label for="rejectReason" class="text-sm text-ink-secondary">سبب الرفض</label>
                <textarea id="rejectReason" bind:value={rejectReason} class="input-field min-h-[100px]" placeholder="أدخل سبب الرفض..."></textarea>
        </div>
        {#snippet footer()}
                <button class="btn-ghost" onclick={() => (rejectOpen = false)}>إلغاء</button>
                <button class="btn-danger" onclick={rejectKYC} disabled={rejectLoading || !rejectReason}>
                        {#if rejectLoading}<RefreshCw size={14} class="animate-spin" />{/if}
                        رفض الطلب
                </button>
        {/snippet}
</Modal>
