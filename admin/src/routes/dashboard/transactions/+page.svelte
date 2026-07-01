<script lang="ts">
        import Pagination from '$lib/components/Pagination.svelte';
        import EmptyState from '$lib/components/EmptyState.svelte';
        import LiveIndicator from '$lib/components/LiveIndicator.svelte';
        import PageHeader from '$lib/components/PageHeader.svelte';
        import ErrorAlert from '$lib/components/ErrorAlert.svelte';
        import { authGet, authPut } from '$lib/api/client';
        import type AdminTransaction from '$lib/api/types';
        import { createAdminStream } from '$lib/api/types';
        import { formatDate, formatNumber, copyToClipboard } from '$lib/utils/helpers';
        import {
                Search,
                ArrowLeftRight,
                CheckCircle2,
                XCircle,
                Clock,
                Copy,
                Check,
                AlertCircle,
                TrendingUp,
                TrendingDown,
                RefreshCw,
                Loader2
        } from 'lucide-svelte';

        // --- State ---
        let transactions = $state<AdminTransaction[]>([]);
        let total = $state(0);
        let totalPages = $state(0);
        let page = $state(1);
        let limit = $state(20);
        let search = $state('');
        let searchInput = $state('');
        let statusFilter = $state<'ALL' | 'PENDING' | 'COMPLETED' | 'REJECTED'>('ALL');
        let loading = $state(true);
        let refreshing = $state(false);
        let error = $state('');
        let actionLoading = $state<Record<string, boolean>>({});
        let copiedField = $state<Record<string, boolean>>({});
        let reviewTxId = $state<Record<string, string>>({});
        let live = $state(true);

        // --- Config ---
        const STATUS_CONFIG = {
                PENDING: { label: 'معلق', pillClass: 'pill-gold', color: '#f5b544' },
                COMPLETED: { label: 'مكتمل', pillClass: 'pill-mint', color: '#22d3a4' },
                REJECTED: { label: 'مرفوض', pillClass: 'pill-rose', color: '#f43f7a' }
        } as const;

        const TYPE_CONFIG = {
                DEPOSIT: { label: 'إيداع', icon: TrendingUp, color: '#22d3a4' },
                WITHDRAWAL: { label: 'سحب', icon: TrendingDown, color: '#f43f7a' }
        } as const;

        const FILTER_OPTIONS: Array<{ value: 'ALL' | 'PENDING' | 'COMPLETED' | 'REJECTED'; label: string }> = [
                { value: 'ALL', label: 'الكل' },
                { value: 'PENDING', label: 'معلق' },
                { value: 'COMPLETED', label: 'مكتمل' },
                { value: 'REJECTED', label: 'مرفوض' }
        ];

        // --- Derived ---
        const pendingCount = $derived(transactions.filter((t) => t.status === 'PENDING').length);

        // --- Fetch ---
        async function fetchTransactions(isRefresh = false) {
                if (isRefresh) {
                        refreshing = true;
                } else {
                        loading = true;
                }
                error = '';

                try {
                        const params = new URLSearchParams({
                                page: String(page),
                                limit: String(limit)
                        });
                        if (search) params.set('search', search);
                        if (statusFilter !== 'ALL') params.set('status', statusFilter);

                        const res = await authGet(`/api/v1/admin/transactions?${params.toString()}`);
                        if (res.success) {
                                transactions = res.data;
                                total = res.meta.total;
                                totalPages = res.meta.totalPages;
                        } else {
                                error = 'فشل في تحميل المعاملات';
                        }
                } catch {
                        error = 'حدث خطأ أثناء تحميل المعاملات';
                } finally {
                        loading = false;
                        refreshing = false;
                }
        }

        // --- Search handler ---
        let searchTimeout: ReturnType<typeof setTimeout>;
        function handleSearchInput() {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                        search = searchInput;
                        page = 1;
                        fetchTransactions();
                }, 400);
        }

        function handleStatusFilter(value: 'ALL' | 'PENDING' | 'COMPLETED' | 'REJECTED') {
                statusFilter = value;
                page = 1;
                fetchTransactions();
        }

        function handlePageChange(newPage: number) {
                page = newPage;
                fetchTransactions();
        }

        // --- Actions ---
        async function reviewTransaction(
                id: string,
                status: 'COMPLETED' | 'REJECTED'
        ) {
                actionLoading[id] = true;
                error = '';

                try {
                        const body: { status: string; tx_id?: string } = { status };
                        const txIdValue = reviewTxId[id]?.trim();
                        if (status === 'COMPLETED' && txIdValue) {
                                body.tx_id = txIdValue;
                        }

                        const res = await authPut(`/api/v1/admin/transactions/${id}/review`, body);
                        if (res.success) {
                                transactions = transactions.map((t) =>
                                        t.id === id ? { ...t, status, tx_id: txIdValue || t.tx_id } : t
                                );
                                delete reviewTxId[id];
                        } else {
                                error = 'فشل في تحديث حالة المعاملة';
                        }
                } catch {
                        error = 'حدث خطأ أثناء تحديث المعاملة';
                } finally {
                        actionLoading[id] = false;
                }
        }

        // --- Copy ---
        async function handleCopy(value: string, field: string, rowId: string) {
                await copyToClipboard(value);
                const key = `${rowId}-${field}`;
                copiedField[key] = true;
                setTimeout(() => {
                        copiedField[key] = false;
                }, 2000);
        }

        // --- SSE ---
        $effect(() => {
                const stream = createAdminStream('/api/v1/admin/transactions/stream');
                stream.onmessage = (event: MessageEvent) => {
                        try {
                                const data = JSON.parse(event.data);
                                if (data.type === 'transaction_update') {
                                        transactions = transactions.map((t) =>
                                                t.id === data.transaction.id ? data.transaction : t
                                        );
                                } else if (data.type === 'transaction_new') {
                                        if (page === 1 && (statusFilter === 'ALL' || statusFilter === 'PENDING')) {
                                                transactions = [data.transaction, ...transactions].slice(0, limit);
                                                total += 1;
                                        }
                                }
                        } catch {
                                // ignore malformed SSE
                        }
                };

                stream.onerror = () => {
                        live = false;
                };

                return () => {
                        stream.close();
                };
        });

        // --- Init ---
        $effect(() => {
                fetchTransactions();
        });
</script>

<svelte:head>
        <title>المعاملات | لوحة الإدارة</title>
</svelte:head>

<div class="transactions-page">
        <!-- Header -->
        <PageHeader title="المعاملات" subtitle="إدارة عمليات الإيداع والسحب">
                <div class="header-actions">
                        <LiveIndicator active={live} label={live ? 'مباشر' : 'غير متصل'} />
                        {#if pendingCount > 0}
                                <div class="pending-badge">
                                        <Clock size={14} />
                                        <span>{pendingCount} معلقة</span>
                                </div>
                        {/if}
                        <button
                                class="btn-secondary"
                                onclick={() => fetchTransactions(true)}
                                disabled={refreshing}
                        >
                                <RefreshCw size={16} class={refreshing ? 'animate-spin' : ''} />
                                <span>تحديث</span>
                        </button>
                </div>
        </PageHeader>

        <!-- Error -->
        {#if error}
                <ErrorAlert message={error} onclose={() => (error = '')} />
        {/if}

        <!-- Filters -->
        <div class="filters-bar glass-divider">
                <div class="search-wrapper">
                        <Search size={18} class="search-icon" />
                        <input
                                type="text"
                                class="input-field search-input"
                                placeholder="بحث بالاسم، البريد، العنوان..."
                                bind:value={searchInput}
                                oninput={handleSearchInput}
                        />
                </div>

                <div class="status-filters">
                        {#each FILTER_OPTIONS as option}
                                <button
                                        class="filter-btn"
                                        class:active={statusFilter === option.value}
                                        onclick={() => handleStatusFilter(option.value)}
                                >
                                        {option.label}
                                        {#if option.value === 'PENDING' && pendingCount > 0}
                                                <span class="filter-count">{pendingCount}</span>
                                        {/if}
                                </button>
                        {/each}
                </div>
        </div>

        <!-- Table -->
        <div class="table-container">
                {#if loading}
                        <div class="loading-state">
                                <Loader2 size={32} class="animate-spin" />
                                <span>جاري التحميل...</span>
                        </div>
                {:else if transactions.length === 0}
                        <EmptyState
                                icon={ArrowLeftRight}
                                title="لا توجد معاملات"
                                description="لم يتم العثور على معاملات مطابقة لمعايير البحث"
                        />
                {:else}
                        <div class="data-table-wrapper">
                                <table class="data-table">
                                        <thead>
                                                <tr>
                                                        <th>المستخدم</th>
                                                        <th>النوع</th>
                                                        <th>المبلغ</th>
                                                        <th>الحالة</th>
                                                        <th>العنوان</th>
                                                        <th>رقم المعاملة</th>
                                                        <th>التاريخ</th>
                                                        <th>إجراءات</th>
                                                </tr>
                                        </thead>
                                        <tbody>
                                                {#each transactions as transaction (transaction.id)}
                                                        {@const typeConf = TYPE_CONFIG[transaction.type as keyof typeof TYPE_CONFIG]}
                                                        {@const statusConf = STATUS_CONFIG[transaction.status as keyof typeof STATUS_CONFIG]}
                                                        {@const isPending = transaction.status === 'PENDING'}
                                                        {@const isActing = actionLoading[transaction.id] === true}
                                                        <tr class:row-pending={isPending}>
                                                                <!-- User -->
                                                                <td>
                                                                        <div class="user-cell">
                                                                                <span class="user-name">{transaction.username}</span>
                                                                                <span class="user-email">{transaction.email}</span>
                                                                        </div>
                                                                </td>

                                                                <!-- Type -->
                                                                <td>
                                                                        <div class="type-cell" style="color: {typeConf.color}">
                                                                                {#if typeConf.icon}
                                                                                  <typeConf.icon size={16} />
                                                                                {/if}
                                                                                <span>{typeConf.label}</span>
                                                                        </div>
                                                                </td>

                                                                <!-- Amount -->
                                                                <td>
                                                                        <div class="amount-cell">
                                                                                <span class="amount-value tabular-nums">
                                                                                        {formatNumber(transaction.amount)}
                                                                                </span>
                                                                                <span class="amount-currency">{transaction.currency}</span>
                                                                        </div>
                                                                </td>

                                                                <!-- Status -->
                                                                <td>
                                                                        <span class="pill {statusConf.pillClass}">
                                                                                {statusConf.label}
                                                                        </span>
                                                                </td>

                                                                <!-- Address -->
                                                                <td>
                                                                        {#if transaction.address}
                                                                                <div class="copy-cell">
                                                                                        <span class="copy-value" title={transaction.address}>
                                                                                                {transaction.address.slice(0, 6)}...{transaction.address.slice(-4)}
                                                                                        </span>
                                                                                        <button
                                                                                                class="btn-ghost copy-btn"
                                                                                                onclick={() => handleCopy(transaction.address, 'address', transaction.id)}
                                                                                                title="نسخ العنوان"
                                                                                        >
                                                                                                {#if copiedField[`${transaction.id}-address`]}
                                                                                                        <Check size={14} style="color: var(--accent-mint)" />
                                                                                                {:else}
                                                                                                        <Copy size={14} />
                                                                                                {/if}
                                                                                        </button>
                                                                                </div>
                                                                        {:else}
                                                                                <span class="text-tertiary">—</span>
                                                                        {/if}
                                                                </td>

                                                                <!-- TX ID -->
                                                                <td>
                                                                        {#if isPending && transaction.type === 'WITHDRAWAL'}
                                                                                <div class="tx-input-cell">
                                                                                        <input
                                                                                                type="text"
                                                                                                class="input-field tx-input"
                                                                                                placeholder="أدخل رقم المعاملة"
                                                                                                bind:value={reviewTxId[transaction.id]}
                                                                                        />
                                                                                </div>
                                                                        {:else if transaction.tx_id}
                                                                                <div class="copy-cell">
                                                                                        <span class="copy-value" title={transaction.tx_id}>
                                                                                                {transaction.tx_id.slice(0, 6)}...{transaction.tx_id.slice(-4)}
                                                                                        </span>
                                                                                        <button
                                                                                                class="btn-ghost copy-btn"
                                                                                                onclick={() => handleCopy(transaction.tx_id, 'txid', transaction.id)}
                                                                                                title="نسخ رقم المعاملة"
                                                                                        >
                                                                                                {#if copiedField[`${transaction.id}-txid`]}
                                                                                                        <Check size={14} style="color: var(--accent-mint)" />
                                                                                                {:else}
                                                                                                        <Copy size={14} />
                                                                                                {/if}
                                                                                        </button>
                                                                                </div>
                                                                        {:else}
                                                                                <span class="text-tertiary">—</span>
                                                                        {/if}
                                                                </td>

                                                                <!-- Date -->
                                                                <td>
                                                                        <span class="date-cell tabular-nums">
                                                                                {formatDate(transaction.createdAt)}
                                                                        </span>
                                                                </td>

                                                                <!-- Actions -->
                                                                <td>
                                                                        {#if isPending}
                                                                                <div class="actions-cell">
                                                                                        <button
                                                                                                class="btn-buy btn-sm"
                                                                                                onclick={() => reviewTransaction(transaction.id, 'COMPLETED')}
                                                                                                disabled={isActing}
                                                                                        >
                                                                                                {#if isActing}
                                                                                                        <Loader2 size={14} class="animate-spin" />
                                                                                                {:else}
                                                                                                        <CheckCircle2 size={14} />
                                                                                                {/if}
                                                                                                <span>قبول</span>
                                                                                        </button>
                                                                                        <button
                                                                                                class="btn-danger btn-sm"
                                                                                                onclick={() => reviewTransaction(transaction.id, 'REJECTED')}
                                                                                                disabled={isActing}
                                                                                        >
                                                                                                {#if isActing}
                                                                                                        <Loader2 size={14} class="animate-spin" />
                                                                                                {:else}
                                                                                                        <XCircle size={14} />
                                                                                                {/if}
                                                                                                <span>رفض</span>
                                                                                        </button>
                                                                                </div>
                                                                        {:else if transaction.status === 'COMPLETED'}
                                                                                <div class="actions-cell">
                                                                                        <CheckCircle2 size={18} style="color: var(--accent-mint)" />
                                                                                </div>
                                                                        {:else if transaction.status === 'REJECTED'}
                                                                                <div class="actions-cell">
                                                                                        <XCircle size={18} style="color: var(--accent-rose)" />
                                                                                </div>
                                                                        {/if}
                                                                </td>
                                                        </tr>
                                                {/each}
                                        </tbody>
                                </table>
                        </div>

                        <!-- Pagination -->
                        {#if totalPages > 1}
                                <div class="pagination-wrapper">
                                        <Pagination
                                                {page}
                                                {totalPages}
                                                onchange={(p: number) => handlePageChange(p)}
                                        />
                                </div>
                        {/if}
                {/if}
        </div>
</div>

<style>
        /* ===== Page Layout ===== */
        .transactions-page {
                display: flex;
                flex-direction: column;
                gap: 1.25rem;
        }

        /* ===== Header Actions ===== */
        .header-actions {
                display: flex;
                align-items: center;
                gap: 0.75rem;
        }

        .pending-badge {
                display: flex;
                align-items: center;
                gap: 0.375rem;
                padding: 0.375rem 0.75rem;
                border-radius: 9999px;
                background: rgba(245, 181, 68, 0.12);
                color: var(--accent-gold);
                font-size: 0.8125rem;
                font-weight: 600;
                border: 1px solid rgba(245, 181, 68, 0.2);
        }

        /* ===== Filters Bar ===== */
        .filters-bar {
                display: flex;
                align-items: center;
                gap: 1rem;
                padding: 1rem 1.25rem;
                background: var(--panel-bg, rgba(15, 15, 30, 0.6));
                border-radius: 0.75rem;
                flex-wrap: wrap;
        }

        .search-wrapper {
                position: relative;
                flex: 1;
                min-width: 240px;
        }

        .search-icon {
                position: absolute;
                right: 0.875rem;
                top: 50%;
                transform: translateY(-50%);
                color: var(--text-tertiary);
                pointer-events: none;
        }

        .search-input {
                width: 100%;
                padding-right: 2.5rem;
                padding-left: 1rem;
        }

        .status-filters {
                display: flex;
                align-items: center;
                gap: 0.375rem;
        }

        .filter-btn {
                display: flex;
                align-items: center;
                gap: 0.375rem;
                padding: 0.5rem 1rem;
                border: 1px solid transparent;
                border-radius: 0.5rem;
                background: transparent;
                color: var(--text-secondary);
                font-size: 0.8125rem;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.2s ease;
                white-space: nowrap;
        }

        .filter-btn:hover {
                background: rgba(255, 255, 255, 0.05);
                color: var(--text-primary);
        }

        .filter-btn.active {
                background: rgba(168, 85, 247, 0.12);
                color: var(--accent-violet);
                border-color: rgba(168, 85, 247, 0.25);
        }

        .filter-count {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                min-width: 1.25rem;
                height: 1.25rem;
                padding: 0 0.375rem;
                border-radius: 9999px;
                background: rgba(245, 181, 68, 0.15);
                color: var(--accent-gold);
                font-size: 0.6875rem;
                font-weight: 700;
        }

        /* ===== Table Container ===== */
        .table-container {
                min-height: 300px;
        }

        .loading-state {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                gap: 1rem;
                padding: 4rem 0;
                color: var(--text-tertiary);
                font-size: 0.875rem;
        }

        .data-table-wrapper {
                overflow-x: auto;
                border-radius: 0.75rem;
                background: var(--panel-bg, rgba(15, 15, 30, 0.6));
                border: 1px solid rgba(255, 255, 255, 0.06);
        }

        /* ===== Data Table ===== */
        .data-table {
                width: 100%;
                border-collapse: collapse;
                font-size: 0.8125rem;
        }

        .data-table thead {
                border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        }

        .data-table th {
                padding: 0.875rem 1rem;
                text-align: right;
                color: var(--text-tertiary);
                font-weight: 600;
                font-size: 0.75rem;
                text-transform: uppercase;
                letter-spacing: 0.05em;
                white-space: nowrap;
        }

        .data-table td {
                padding: 0.875rem 1rem;
                color: var(--text-primary);
                border-bottom: 1px solid rgba(255, 255, 255, 0.04);
                vertical-align: middle;
        }

        .data-table tbody tr {
                transition: background 0.15s ease;
        }

        .data-table tbody tr:hover {
                background: rgba(255, 255, 255, 0.02);
        }

        .data-table tbody tr:last-child td {
                border-bottom: none;
        }

        .row-pending {
                background: rgba(245, 181, 68, 0.03);
        }

        .row-pending:hover {
                background: rgba(245, 181, 68, 0.06) !important;
        }

        /* ===== Cells ===== */
        .user-cell {
                display: flex;
                flex-direction: column;
                gap: 0.125rem;
        }

        .user-name {
                font-weight: 600;
                color: var(--text-primary);
        }

        .user-email {
                font-size: 0.75rem;
                color: var(--text-tertiary);
        }

        .type-cell {
                display: flex;
                align-items: center;
                gap: 0.375rem;
                font-weight: 600;
        }

        .amount-cell {
                display: flex;
                align-items: baseline;
                gap: 0.375rem;
        }

        .amount-value {
                font-weight: 700;
                font-size: 0.875rem;
        }

        .amount-currency {
                font-size: 0.6875rem;
                color: var(--text-tertiary);
                font-weight: 500;
        }

        /* ===== Pills ===== */
        .pill {
                display: inline-flex;
                align-items: center;
                padding: 0.25rem 0.75rem;
                border-radius: 9999px;
                font-size: 0.75rem;
                font-weight: 600;
                white-space: nowrap;
        }

        .pill-gold {
                background: rgba(245, 181, 68, 0.12);
                color: var(--accent-gold);
                border: 1px solid rgba(245, 181, 68, 0.2);
        }

        .pill-mint {
                background: rgba(34, 211, 164, 0.12);
                color: var(--accent-mint);
                border: 1px solid rgba(34, 211, 164, 0.2);
        }

        .pill-rose {
                background: rgba(244, 63, 122, 0.12);
                color: var(--accent-rose);
                border: 1px solid rgba(244, 63, 122, 0.2);
        }

        /* ===== Copy Cell ===== */
        .copy-cell {
                display: flex;
                align-items: center;
                gap: 0.375rem;
        }

        .copy-value {
                font-family: 'JetBrains Mono', 'Fira Code', monospace;
                font-size: 0.75rem;
                color: var(--text-secondary);
                letter-spacing: 0.02em;
        }

        .copy-btn {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                padding: 0.25rem;
                border-radius: 0.375rem;
                color: var(--text-tertiary);
                transition: all 0.15s ease;
        }

        .copy-btn:hover {
                background: rgba(255, 255, 255, 0.08);
                color: var(--text-primary);
        }

        /* ===== TX Input ===== */
        .tx-input-cell {
                min-width: 160px;
        }

        .tx-input {
                padding: 0.375rem 0.625rem;
                font-size: 0.75rem;
                font-family: 'JetBrains Mono', 'Fira Code', monospace;
                min-width: 140px;
        }

        /* ===== Date Cell ===== */
        .date-cell {
                color: var(--text-tertiary);
                font-size: 0.75rem;
                white-space: nowrap;
        }

        /* ===== Actions Cell ===== */
        .actions-cell {
                display: flex;
                align-items: center;
                gap: 0.5rem;
        }

        .btn-sm {
                display: inline-flex;
                align-items: center;
                gap: 0.375rem;
                padding: 0.375rem 0.75rem;
                border-radius: 0.5rem;
                font-size: 0.75rem;
                font-weight: 600;
                cursor: pointer;
                border: none;
                transition: all 0.2s ease;
                white-space: nowrap;
        }

        .btn-sm:disabled {
                opacity: 0.5;
                cursor: not-allowed;
        }

        /* ===== Pagination ===== */
        .pagination-wrapper {
                display: flex;
                justify-content: center;
                padding-top: 1rem;
        }

        /* ===== Utility ===== */
        .text-tertiary {
                color: var(--text-tertiary);
        }

        /* ===== Responsive ===== */
        @media (max-width: 768px) {
                .filters-bar {
                        flex-direction: column;
                        align-items: stretch;
                }

                .search-wrapper {
                        min-width: 100%;
                }

                .status-filters {
                        overflow-x: auto;
                        padding-bottom: 0.25rem;
                }

                .data-table th,
                .data-table td {
                        padding: 0.625rem 0.75rem;
                }
        }
</style>
