<script lang="ts">
  import { onMount } from 'svelte';
  import {
    Percent, ArrowUpDown, Save, RotateCcw, Loader2,
    AlertCircle, CheckCircle2, TrendingUp, TrendingDown,
    Coins, ShieldCheck, User, BadgeCheck, CircleDot
  } from 'lucide-svelte';
  import { authGet, authPut } from '$lib/api/client';
  import type { FeeSchedule } from '$lib/api/types';
  import PageHeader from '$lib/components/PageHeader.svelte';
  import ErrorAlert from '$lib/components/ErrorAlert.svelte';
  import { toast } from '$lib/stores/toast';
  import { formatPercent } from '$lib/utils/helpers';

  // ─── Label Maps ─────────────────────────────────────────────
  const userTypeLabels: Record<string, string> = {
    USER: 'مستخدم عادي',
    VERIFIED_USER: 'مستخدم موثّق'
  };

  const userTypeConfig: Record<string, { icon: any; color: string; bg: string }> = {
    USER: { icon: User, color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
    VERIFIED_USER: { icon: BadgeCheck, color: '#22d3a4', bg: 'rgba(34,211,164,0.12)' }
  };

  const orderTypeLabels: Record<string, string> = {
    MARKET: 'سوقي',
    LIMIT: 'محدد',
    STOP_LIMIT: 'وقف محدد',
    TAKE_PROFIT: 'جني الأرباح'
  };

  // ─── State ──────────────────────────────────────────────────
  let fees = $state<FeeSchedule[]>([]);
  let loading = $state(true);
  let error = $state('');
  let saving = $state<number | null>(null);
  let refreshing = $state(false);

  // Track edited fields: key = `${feeId}-${field}`, value = true
  let dirtyFields = $state<Record<string, boolean>>({});
  // Track original values for reset
  let originalFees = $state<FeeSchedule[]>([]);
  // Track current edit values: key = feeId, value = partial fields
  let editValues = $state<Record<number, { maker_fee?: number; taker_fee?: number; min_fee?: number }>>({});

  // ─── Computed ───────────────────────────────────────────────
  let groupedFees = $derived(() => {
    const groups: Record<string, FeeSchedule[]> = {};
    for (const fee of fees) {
      if (!groups[fee.user_type]) groups[fee.user_type] = [];
      groups[fee.user_type].push(fee);
    }
    return groups;
  });

  let summaryStats = $derived(() => {
    const result: Record<string, { avgMaker: number; avgTaker: number }> = {};
    for (const [type, group] of Object.entries(groupedFees())) {
      const avgMaker = group.reduce((s, f) => s + f.maker_fee, 0) / (group.length || 1);
      const avgTaker = group.reduce((s, f) => s + f.taker_fee, 0) / (group.length || 1);
      result[type] = { avgMaker, avgTaker };
    }
    return result;
  });

  // ─── Helpers ────────────────────────────────────────────────
  function getFieldValue(fee: FeeSchedule, field: 'maker_fee' | 'taker_fee' | 'min_fee'): number {
    return editValues[fee.id]?.[field] ?? fee[field];
  }

  function setFieldValue(fee: FeeSchedule, field: 'maker_fee' | 'taker_fee' | 'min_fee', value: number) {
    if (!editValues[fee.id]) editValues[fee.id] = {};
    editValues[fee.id][field] = value;
    const key = `${fee.id}-${field}`;
    const original = originalFees.find(f => f.id === fee.id);
    if (original && original[field] !== value) {
      dirtyFields[key] = true;
    } else {
      delete dirtyFields[key];
    }
    // Trigger reactivity
    editValues = { ...editValues };
    dirtyFields = { ...dirtyFields };
  }

  function isFieldDirty(feeId: number, field: string): boolean {
    return !!dirtyFields[`${feeId}-${field}`];
  }

  function isFeeDirty(feeId: number): boolean {
    return Object.keys(dirtyFields).some(k => k.startsWith(`${feeId}-`));
  }

  // ─── API ────────────────────────────────────────────────────
  async function fetchFees() {
    try {
      error = '';
      const res = await authGet('/api/v1/admin/fees');
      if (!res.ok) throw new Error('فشل تحميل جداول الرسوم');
      const json = await res.json();
      if (json.success) {
        fees = json.data;
        originalFees = json.data.map((f: FeeSchedule) => ({ ...f }));
        editValues = {};
        dirtyFields = {};
      }
    } catch (e: any) {
      error = e.message;
    } finally {
      loading = false;
      refreshing = false;
    }
  }

  async function handleSave(feeId: number) {
    const edits = editValues[feeId];
    if (!edits) return;

    saving = feeId;
    try {
      const res = await authPut(`/api/v1/admin/fees/${feeId}`, edits);
      if (!res.ok) throw new Error('فشل حفظ التعديلات');
      const json = await res.json();
      if (json.success) {
        fees = fees.map(f => f.id === feeId ? json.data : f);
        originalFees = originalFees.map(f => f.id === feeId ? { ...json.data } : f);
        // Clear dirty state for this fee
        for (const key of Object.keys(dirtyFields)) {
          if (key.startsWith(`${feeId}-`)) delete dirtyFields[key];
        }
        delete editValues[feeId];
        dirtyFields = { ...dirtyFields };
        editValues = { ...editValues };
        toast.success('تم حفظ الرسوم بنجاح');
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      saving = null;
    }
  }

  function handleReset(feeId: number) {
    const original = originalFees.find(f => f.id === feeId);
    if (!original) return;

    editValues[feeId] = {
      maker_fee: original.maker_fee,
      taker_fee: original.taker_fee,
      min_fee: original.min_fee
    };

    for (const key of Object.keys(dirtyFields)) {
      if (key.startsWith(`${feeId}-`)) delete dirtyFields[key];
    }

    dirtyFields = { ...dirtyFields };
    editValues = { ...editValues };
    toast.info('تم إعادة القيم الأصلية');
  }

  async function handleRefresh() {
    refreshing = true;
    await fetchFees();
    toast.success('تم تحديث البيانات');
  }

  // ─── Lifecycle ──────────────────────────────────────────────
  onMount(() => {
    fetchFees();
  });
</script>

<div class="space-y-6">
  <!-- Header -->
  <PageHeader title="إدارة الرسوم" subtitle="تعديل جداول الرسوم حسب نوع المستخدم ونوع الأمر">
    <button class="btn-ghost text-sm flex items-center gap-2" onclick={handleRefresh} disabled={refreshing}>
      {#if refreshing}
        <Loader2 size={16} class="animate-spin" />
      {:else}
        <RotateCcw size={16} />
      {/if}
      تحديث
    </button>
  </PageHeader>

  <!-- Error -->
  {#if error}
    <ErrorAlert message={error} onclose={() => (error = '')} />
  {/if}

  <!-- Summary Cards -->
  {#if !loading && fees.length > 0}
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
      {#each Object.entries(summaryStats()) as [type, stats] (type)}
        {@const cfg = userTypeConfig[type]}
        {@const Icon = cfg?.icon || User}
        <div class="stat-card group">
          <div class="flex items-start justify-between">
            <div class="flex-1 min-w-0">
              <p class="text-[11px] font-semibold tracking-wider uppercase" style="color: var(--text-quaternary);">{userTypeLabels[type] || type}</p>
              <div class="mt-2 space-y-1">
                <div class="flex items-center gap-2">
                  <TrendingUp size={13} style="color: #22d3a4;" />
                  <span class="text-xs" style="color: var(--text-tertiary);">صانع:</span>
                  <span class="text-sm font-bold tabular-nums" style="color: #22d3a4;">{formatPercent(stats.avgMaker)}</span>
                </div>
                <div class="flex items-center gap-2">
                  <TrendingDown size={13} style="color: #f43f7a;" />
                  <span class="text-xs" style="color: var(--text-tertiary);">آخذ:</span>
                  <span class="text-sm font-bold tabular-nums" style="color: #f43f7a;">{formatPercent(stats.avgTaker)}</span>
                </div>
              </div>
            </div>
            <div class="flex items-center justify-center w-11 h-11 rounded-xl shrink-0" style="background: {cfg?.bg || 'rgba(59,130,246,0.12)'}; box-shadow: 0 0 20px {cfg?.bg || 'rgba(59,130,246,0.12)'};">
              <Icon size={20} style="color: {cfg?.color || '#3b82f6'};" />
            </div>
          </div>
        </div>
      {/each}
    </div>
  {/if}

  <!-- Fee Tables -->
  {#if loading}
    <div class="space-y-8">
      {#each Array(2) as _}
        <div class="panel p-6 space-y-4">
          <div class="animate-shimmer h-6 w-40 rounded" style="background: rgba(255,255,255,0.05);"></div>
          {#each Array(4) as _}
            <div class="flex items-center gap-4">
              <div class="animate-shimmer h-4 w-24 rounded" style="background: rgba(255,255,255,0.04);"></div>
              <div class="animate-shimmer h-10 flex-1 rounded-lg" style="background: rgba(255,255,255,0.03);"></div>
              <div class="animate-shimmer h-10 flex-1 rounded-lg" style="background: rgba(255,255,255,0.03);"></div>
              <div class="animate-shimmer h-10 flex-1 rounded-lg" style="background: rgba(255,255,255,0.03);"></div>
            </div>
          {/each}
        </div>
      {/each}
    </div>
  {:else if fees.length > 0}
    <div class="space-y-8">
      {#each Object.entries(groupedFees()) as [userType, group] (userType)}
        {@const cfg = userTypeConfig[userType]}
        {@const Icon = cfg?.icon || User}

        <div class="panel overflow-hidden">
          <!-- Group Header -->
          <div class="flex items-center gap-3 p-5 border-b" style="border-color: rgba(255,255,255,0.06);">
            <div class="flex items-center justify-center w-10 h-10 rounded-xl" style="background: {cfg?.bg};">
              <Icon size={20} style="color: {cfg?.color};" />
            </div>
            <div>
              <h2 class="font-bold text-lg" style="color: var(--text-primary);">{userTypeLabels[userType] || userType}</h2>
              <p class="text-xs" style="color: var(--text-quaternary);">{group.length} نوع أوامر</p>
            </div>
            <div class="mr-auto flex items-center gap-1.5">
              <Coins size={14} style="color: var(--text-quaternary);" />
              <span class="text-xs" style="color: var(--text-quaternary);">جدول الرسوم</span>
            </div>
          </div>

          <!-- Table -->
          <div class="overflow-x-auto">
            <table class="data-table w-full">
              <thead>
                <tr>
                  <th style="min-width: 140px;">نوع الأمر</th>
                  <th style="min-width: 140px;">رسوم الصانع</th>
                  <th style="min-width: 140px;">رسوم الآخذ</th>
                  <th style="min-width: 140px;">الحد الأدنى</th>
                  <th style="min-width: 160px;">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {#each group as fee (fee.id)}
                  <tr>
                    <!-- Order Type -->
                    <td>
                      <div class="flex items-center gap-2">
                        <ArrowUpDown size={14} style="color: var(--text-quaternary);" />
                        <span class="font-medium text-sm">{orderTypeLabels[fee.order_type] || fee.order_type}</span>
                      </div>
                    </td>

                    <!-- Maker Fee -->
                    <td>
                      <div class="relative">
                        <input
                          type="number"
                          step="0.01"
                          class="input-field w-full tabular-nums text-left"
                          value={getFieldValue(fee, 'maker_fee')}
                          oninput={(e) => setFieldValue(fee, 'maker_fee', parseFloat((e.target as HTMLInputElement).value) || 0)}
                          style={isFieldDirty(fee.id, 'maker_fee') ? 'border-color: rgba(245,181,68,0.5); box-shadow: 0 0 0 1px rgba(245,181,68,0.2);' : ''}
                        />
                        {#if isFieldDirty(fee.id, 'maker_fee')}
                          <CircleDot size={12} class="absolute left-2 top-1/2 -translate-y-1/2" style="color: #f5b544;" />
                        {/if}
                      </div>
                    </td>

                    <!-- Taker Fee -->
                    <td>
                      <div class="relative">
                        <input
                          type="number"
                          step="0.01"
                          class="input-field w-full tabular-nums text-left"
                          value={getFieldValue(fee, 'taker_fee')}
                          oninput={(e) => setFieldValue(fee, 'taker_fee', parseFloat((e.target as HTMLInputElement).value) || 0)}
                          style={isFieldDirty(fee.id, 'taker_fee') ? 'border-color: rgba(245,181,68,0.5); box-shadow: 0 0 0 1px rgba(245,181,68,0.2);' : ''}
                        />
                        {#if isFieldDirty(fee.id, 'taker_fee')}
                          <CircleDot size={12} class="absolute left-2 top-1/2 -translate-y-1/2" style="color: #f5b544;" />
                        {/if}
                      </div>
                    </td>

                    <!-- Min Fee -->
                    <td>
                      <div class="relative">
                        <input
                          type="number"
                          step="0.01"
                          class="input-field w-full tabular-nums text-left"
                          value={getFieldValue(fee, 'min_fee')}
                          oninput={(e) => setFieldValue(fee, 'min_fee', parseFloat((e.target as HTMLInputElement).value) || 0)}
                          style={isFieldDirty(fee.id, 'min_fee') ? 'border-color: rgba(245,181,68,0.5); box-shadow: 0 0 0 1px rgba(245,181,68,0.2);' : ''}
                        />
                        {#if isFieldDirty(fee.id, 'min_fee')}
                          <CircleDot size={12} class="absolute left-2 top-1/2 -translate-y-1/2" style="color: #f5b544;" />
                        {/if}
                      </div>
                    </td>

                    <!-- Actions -->
                    <td>
                      <div class="flex items-center gap-2">
                        <button
                          class="btn-primary text-xs flex items-center gap-1.5"
                          onclick={() => handleSave(fee.id)}
                          disabled={saving === fee.id || !isFeeDirty(fee.id)}
                        >
                          {#if saving === fee.id}
                            <Loader2 size={13} class="animate-spin" />
                          {:else}
                            <Save size={13} />
                          {/if}
                          حفظ
                        </button>
                        <button
                          class="btn-ghost text-xs flex items-center gap-1.5"
                          onclick={() => handleReset(fee.id)}
                          disabled={!isFeeDirty(fee.id)}
                        >
                          <RotateCcw size={13} />
                          إعادة
                        </button>
                      </div>
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        </div>
      {/each}
    </div>
  {:else}
    <div class="panel p-8 flex flex-col items-center text-center">
      <Percent size={32} style="color: var(--text-quaternary);" />
      <p class="text-sm mt-2" style="color: var(--text-quaternary);">لا توجد جداول رسوم</p>
    </div>
  {/if}
</div>
