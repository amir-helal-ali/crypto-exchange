<script lang="ts">
        import { onMount } from 'svelte';
        import { authGet, createAdminStream } from '$lib/api/client';
        import { formatNumber, formatCompact, timeAgo, actionLabels, statusConfigs } from '$lib/utils/helpers';
        import StatCard from '$lib/components/StatCard.svelte';
        import PageHeader from '$lib/components/PageHeader.svelte';
        import LiveIndicator from '$lib/components/LiveIndicator.svelte';
        import type { AdminStats, AuditLog } from '$lib/api/types';
        import {
                Users, ArrowLeftRight, ShieldCheck, TrendingUp, ArrowDownToLine, ArrowUpFromLine,
                RefreshCw, Settings
        } from 'lucide-svelte';

        let stats = $state<AdminStats | null>(null);
        let recentAudits = $state<AuditLog[]>([]);
        let loading = $state(true);
        let liveConnected = $state(false);
        let eventSource: EventSource | null = null;

        async function loadStats() {
                loading = true;
                const res = await authGet<AdminStats>('/api/v1/admin/stats');
                if (res.success && res.data) stats = res.data;
                const auditRes = await authGet<AuditLog[]>('/api/v1/admin/audit-logs?limit=8');
                if (auditRes.success && auditRes.data) recentAudits = (auditRes as any).data || [];
                loading = false;
        }

        onMount(() => {
                loadStats();

                eventSource = createAdminStream(['stats', 'audit']);
                if (eventSource) {
                        eventSource.onopen = () => { liveConnected = true; };
                        eventSource.onerror = () => { liveConnected = false; };
                        eventSource.addEventListener('stats', (e) => {
                                try { stats = JSON.parse(e.data); } catch {}
                        });
                        eventSource.addEventListener('audit', (e) => {
                                try {
                                        const audit = JSON.parse(e.data);
                                        recentAudits = [audit, ...recentAudits].slice(0, 8);
                                } catch {}
                        });
                }

                return () => { eventSource?.close(); };
        });
</script>

<PageHeader title="لوحة التحكم" subtitle="نظرة عامة على النظام">
        <button class="btn-ghost" onclick={loadStats} disabled={loading}>
                <RefreshCw size={16} class={loading ? 'animate-spin' : ''} />
                تحديث
        </button>
        <LiveIndicator connected={liveConnected} />
</PageHeader>

<!-- Stat Cards -->
<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
        <StatCard label="إجمالي المستخدمين" value={stats ? formatCompact(stats.totalUsers) : '—'} icon={Users} iconColor="#a855f7" iconBg="rgba(168,85,247,0.15)" chartColor="#a855f7" chartSeed={10} loading={loading} />
        <StatCard label="إجمالي الأوامر" value={stats ? formatCompact(stats.totalOrders) : '—'} icon={TrendingUp} iconColor="#3b82f6" iconBg="rgba(59,130,246,0.15)" chartColor="#3b82f6" chartSeed={20} loading={loading} />
        <StatCard label="إجمالي المعاملات" value={stats ? formatCompact(stats.totalTransactions) : '—'} icon={ArrowLeftRight} iconColor="#06b6d4" iconBg="rgba(6,182,212,0.15)" chartColor="#06b6d4" chartSeed={30} loading={loading} />
        <StatCard label="ودائع معلقة" value={stats ? formatNumber(stats.pendingDeposits) : '—'} icon={ArrowDownToLine} iconColor="#f5b544" iconBg="rgba(245,181,68,0.15)" chartColor="#f5b544" chartSeed={40} loading={loading} />
        <StatCard label="سحوبات معلقة" value={stats ? formatNumber(stats.pendingWithdrawals) : '—'} icon={ArrowUpFromLine} iconColor="#fb7185" iconBg="rgba(251,113,133,0.15)" chartColor="#fb7185" chartSeed={50} loading={loading} />
        <StatCard label="KYC معلقة" value={stats ? formatNumber(stats.pendingKYC) : '—'} icon={ShieldCheck} iconColor="#22d3a4" iconBg="rgba(34,211,164,0.15)" chartColor="#22d3a4" chartSeed={60} loading={loading} />
</div>

<!-- Recent Activity -->
<div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Recent Audit Logs -->
        <div class="lg:col-span-2 panel p-0 overflow-hidden">
                <div class="flex items-center justify-between px-5 py-4 border-b border-white/6">
                        <h2 class="text-base font-bold text-ink-primary">آخر النشاطات</h2>
                        <a href="/dashboard/audit-logs" class="text-xs text-accent-gold hover:text-accent-gold/80 transition-colors">عرض الكل</a>
                </div>
                <div class="divide-y divide-white/4">
                        {#if loading}
                                {#each Array(5) as _}
                                        <div class="px-5 py-3 flex items-center gap-3">
                                                <div class="skeleton h-4 w-24"></div>
                                                <div class="skeleton h-4 flex-1"></div>
                                                <div class="skeleton h-4 w-16"></div>
                                        </div>
                                {/each}
                        {:else if recentAudits.length === 0}
                                <div class="px-5 py-8 text-center text-sm text-ink-muted">لا توجد نشاطات حديثة</div>
                        {:else}
                                {#each recentAudits as log}
                                        <div class="px-5 py-3 flex items-center gap-3 hover:bg-white/[0.02] transition-colors">
                                                <span class="pill-pending text-[10px]">{actionLabels[log.action] || log.action}</span>
                                                <span class="text-sm text-ink-secondary flex-1 truncate">{log.details || '—'}</span>
                                                <span class="text-xs text-ink-muted whitespace-nowrap">{log.username}</span>
                                                <span class="text-xs text-ink-faint whitespace-nowrap">{timeAgo(log.createdAt)}</span>
                                        </div>
                                {/each}
                        {/if}
                </div>
        </div>

        <!-- Quick Actions -->
        <div class="panel p-5">
                <h2 class="text-base font-bold text-ink-primary mb-4">إجراءات سريعة</h2>
                <div class="flex flex-col gap-2">
                        <a href="/dashboard/users" class="btn-secondary w-full justify-start">
                                <Users size={16} /> إدارة المستخدمين
                        </a>
                        <a href="/dashboard/kyc" class="btn-secondary w-full justify-start">
                                <ShieldCheck size={16} /> مراجعة KYC
                        </a>
                        <a href="/dashboard/transactions" class="btn-secondary w-full justify-start">
                                <ArrowLeftRight size={16} /> مراجعة المعاملات
                        </a>
                        <a href="/dashboard/settings" class="btn-secondary w-full justify-start">
                                <Settings size={16} /> إعدادات النظام
                        </a>
                </div>
        </div>
</div>

