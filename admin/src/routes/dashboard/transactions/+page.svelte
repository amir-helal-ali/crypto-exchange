<script lang="ts">
        import { onMount } from 'svelte';
        import { authGet, authPut, createAdminStream } from '$lib/api/client';
        import { toast } from '$lib/stores/toast';
        import { formatNumber, formatCurrency, formatDate, statusConfigs, copyToClipboard, debounce } from '$lib/utils/helpers';
        import PageHeader from '$lib/components/PageHeader.svelte';
        import DataTable from '$lib/components/DataTable.svelte';
        import Pagination from '$lib/components/Pagination.svelte';
        import SearchBar from '$lib/components/SearchBar.svelte';
        import Modal from '$lib/components/Modal.svelte';
        import ErrorAlert from '$lib/components/ErrorAlert.svelte';
        import type { AdminTransaction } from '$lib/api/types';
        import { ArrowLeftRight, ArrowDownToLine, ArrowUpFromLine, Copy, Check, RefreshCw, XCircle } from 'lucide-svelte';

        let transactions = $state<AdminTransaction[]>([]);
        let loading = $state(true);
        let error = $state('');
        let page = $state(1);
        let totalPages = $state(1);
        let totalItems = $state(0);
        let search = $state('');
        let copiedId = $state('');
        let eventSource: EventSource | null = null;

        // Review Modal
        let reviewOpen = $state(false);
        let reviewTx = $state<AdminTransaction | null>(null);
        let reviewAction = $state<'approve' | 'reject'>('approve');
        let reviewTxId = $state('');
        let reviewLoading = $state(false);

        const filters = [
                {
                        key: 'status',
                        label: 'الحالة',
                        options: [
                                { value: 'PENDING', label: 'قيد الانتظار' },
                                { value: 'COMPLETED', label: 'مكتمل' },
                                { value: 'REJECTED', label: 'مرفوض' }
                        ]
                },
                {
                        key: 'type',
                        label: 'النوع',
                        options: [
                                { value: 'DEPOSIT', label: 'إيداع' },
                                { value: 'WITHDRAWAL', label: 'سحب' }
                        ]
                }
        ];
        let filterValues = $state<Record<string, string>>({});

        async function loadTransactions() {
                loading = true;
                error = '';
                let path = `/api/v1/admin/transactions?page=${page}&limit=20`;
                if (search) path += `&search=${encodeURIComponent(search)}`;
                const res = await authGet<AdminTransaction[]>(path);
                if (res.success && res.data) {
                        transactions = (res as any).data || [];
                        totalItems = (res as any).total || 0;
                        totalPages = Math.ceil(totalItems / 20);
                } else {
                        error = res.error || 'فشل تحميل المعاملات';
                }
                loading = false;
        }

        async function handleReview() {
                if (!reviewTx) return;
                reviewLoading = true;
                const body: any = { action: reviewAction };
                if (reviewAction === 'approve' && reviewTxId) body.tx_id = reviewTxId;
                const res = await authPut(`/api/v1/admin/transactions/${reviewTx.id}/review`, body);
                if (res.success) {
                        toast.success(reviewAction === 'approve' ? 'تم قبول المعاملة' : 'تم رفض المعاملة');
                        reviewOpen = false;
                        reviewTx = null;
                        reviewTxId = '';
                        loadTransactions();
                } else {
                        toast.error(res.error || 'فشل مراجعة المعاملة');
                }
                reviewLoading = false;
        }

        function openReview(tx: AdminTransaction, action: 'approve' | 'reject') {
                reviewTx = tx;
                reviewAction = action;
                reviewTxId = '';
                reviewOpen = true;
        }

        async function copyTxId(txId: string | undefined) {
                if (!txId) return;
                await copyToClipboard(txId);
                copiedId = txId;
                setTimeout(() => { copiedId = ''; }, 2000);
        }

        onMount(() => {
                loadTransactions();
                eventSource = createAdminStream(['tx']);
                eventSource?.addEventListener('tx', () => { loadTransactions(); });
                return () => { eventSource?.close(); };
        });
</script>

<PageHeader title="إدارة المعاملات" subtitle="مراجعة الودائع والسحوبات">
        <button class="btn-ghost" onclick={loadTransactions} disabled={loading}>
                <RefreshCw size={16} class={loading ? 'animate-spin' : ''} />
        </button>
</PageHeader>

{#if error}
        <ErrorAlert message={error} onclose={() => (error = '')} />
{/if}

<SearchBar bind:value={search} placeholder="بحث بالاسم أو المعرف..." {filters} bind:filterValues />

<DataTable headers={['المستخدم', 'النوع', 'المبلغ', 'الحالة', 'TxID', 'التاريخ', 'إجراءات']} {loading} emptyIcon={ArrowLeftRight} emptyTitle="لا توجد معاملات">
        {#each transactions as tx}
                <tr>
                        <td>
                                <div>
                                        <p class="text-sm font-medium text-ink-primary">{tx.username}</p>
                                        <p class="text-xs text-ink-muted" dir="ltr">{tx.email}</p>
                                </div>
                        </td>
                        <td>
                                <div class="flex items-center gap-2">
                                        {#if tx.type === 'DEPOSIT'}
                                                <ArrowDownToLine size={14} class="text-accent-mint" />
                                                <span class="text-sm text-accent-mint">إيداع</span>
                                        {:else}
                                                <ArrowUpFromLine size={14} class="text-accent-rose" />
                                                <span class="text-sm text-accent-rose">سحب</span>
                                        {/if}
                                </div>
                        </td>
                        <td>
                                <span class="text-sm font-bold text-ink-primary tabular-nums">{formatCurrency(tx.amount, tx.currency)}</span>
                        </td>
                        <td>
                                <span class={statusConfigs[tx.status]?.pillClass || 'pill-none'}>
                                        {statusConfigs[tx.status]?.label || tx.status}
                                </span>
                        </td>
                        <td>
                                {#if tx.tx_id}
                                        <div class="flex items-center gap-1.5">
                                                <span class="text-xs text-ink-muted font-mono truncate max-w-[120px]" dir="ltr">{tx.tx_id}</span>
                                                <button class="text-ink-faint hover:text-ink-primary transition-colors" onclick={() => copyTxId(tx.tx_id)}>
                                                        {#if copiedId === tx.tx_id}<Check size={12} class="text-accent-mint" />{:else}<Copy size={12} />{/if}
                                                </button>
                                        </div>
                                {:else}
                                        <span class="text-xs text-ink-faint">—</span>
                                {/if}
                        </td>
                        <td>
                                <span class="text-sm text-ink-muted">{formatDate(tx.createdAt)}</span>
                        </td>
                        <td>
                                {#if tx.status === 'PENDING'}
                                        <div class="flex items-center gap-2">
                                                <button class="btn-buy text-xs px-2 py-1" onclick={() => openReview(tx, 'approve')}>قبول</button>
                                                <button class="btn-danger text-xs px-2 py-1" onclick={() => openReview(tx, 'reject')}>رفض</button>
                                        </div>
                                {:else}
                                        <span class="text-xs text-ink-faint">—</span>
                                {/if}
                        </td>
                </tr>
        {/each}
</DataTable>

<Pagination bind:page {totalPages} {totalItems} itemLabel="معاملة" />

<!-- Review Modal -->
<Modal bind:open={reviewOpen} title={reviewAction === 'approve' ? 'قبول المعاملة' : 'رفض المعاملة'} icon={reviewAction === 'approve' ? Check : XCircle} iconColor={reviewAction === 'approve' ? '#22d3a4' : '#fb7185'} iconBg={reviewAction === 'approve' ? 'rgba(34,211,164,0.15)' : 'rgba(251,113,133,0.15)'} size="md">
        {#if reviewTx}
                <div class="flex flex-col gap-4">
                        <div class="grid grid-cols-2 gap-3 text-sm">
                                <div><span class="text-ink-muted">المستخدم:</span> <span class="text-ink-primary">{reviewTx.username}</span></div>
                                <div><span class="text-ink-muted">النوع:</span> <span class={reviewTx.type === 'DEPOSIT' ? 'text-accent-mint' : 'text-accent-rose'}>{reviewTx.type === 'DEPOSIT' ? 'إيداع' : 'سحب'}</span></div>
                                <div><span class="text-ink-muted">المبلغ:</span> <span class="text-ink-primary tabular-nums">{formatCurrency(reviewTx.amount, reviewTx.currency)}</span></div>
                                <div><span class="text-ink-muted">العملة:</span> <span class="text-ink-primary">{reviewTx.currency}</span></div>
                        </div>
                        {#if reviewAction === 'approve'}
                                <div>
                                        <label for="txId" class="block text-sm text-ink-secondary mb-2">معرف المعاملة (TxID)</label>
                                        <input id="txId" type="text" bind:value={reviewTxId} class="input-field font-mono" placeholder="أدخل معرف المعاملة على البلوكتشين..." dir="ltr" />
                                </div>
                        {/if}
                </div>
        {/if}
        {#snippet footer()}
                <button class="btn-ghost" onclick={() => (reviewOpen = false)}>إلغاء</button>
                <button class={reviewAction === 'approve' ? 'btn-buy' : 'btn-danger'} onclick={handleReview} disabled={reviewLoading}>
                        {#if reviewLoading}<RefreshCw size={14} class="animate-spin" />{/if}
                        {reviewAction === 'approve' ? 'قبول' : 'رفض'}
                </button>
        {/snippet}
</Modal>
