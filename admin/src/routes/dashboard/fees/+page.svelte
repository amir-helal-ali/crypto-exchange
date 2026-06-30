<script lang="ts">
  import { onMount } from 'svelte';
  import {
    Percent,
    ArrowUpDown,
    Save,
    RotateCcw,
    Loader2,
    AlertCircle,
    CheckCircle2,
    TrendingUp,
    TrendingDown,
    Coins,
    ShieldCheck,
    User,
    BadgeCheck,
    CircleDot
  } from 'lucide-svelte';
  import { authGet, authPut } from '$lib/api/client';

  // ─── Types ───
  type UserType = 'USER' | 'VERIFIED_USER';
  type OrderType = 'MARKET' | 'LIMIT' | 'STOP_LIMIT' | 'TAKE_PROFIT';

  interface FeeSchedule {
    id: number;
    user_type: UserType;
    order_type: OrderType;
    maker_fee: number;
    taker_fee: number;
    min_fee: number;
    created_at?: string;
    updated_at?: string;
  }

  interface EditState {
    maker_fee: string;
    taker_fee: string;
    min_fee: string;
  }

  interface ValidationError {
    maker_fee?: string;
    taker_fee?: string;
    min_fee?: string;
  }

  // ─── Arabic Labels ───
  const userTypeLabels: Record<UserType, string> = {
    USER: 'مستخدم عادي',
    VERIFIED_USER: 'مستخدم موثّق'
  };

  const orderTypeLabels: Record<OrderType, string> = {
    MARKET: 'سوقي',
    LIMIT: 'محدد',
    STOP_LIMIT: 'وقف محدد',
    TAKE_PROFIT: 'جني الأرباح'
  };

  const userTypeIcons: Record<UserType, typeof User> = {
    USER: User,
    VERIFIED_USER: BadgeCheck
  };

  const orderTypes: OrderType[] = ['MARKET', 'LIMIT', 'STOP_LIMIT', 'TAKE_PROFIT'];

  // ─── State ───
  let fees = $state<FeeSchedule[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let saving = $state<Set<number>>(new Set());
  let saveSuccess = $state<Set<number>>(new Set());
  let edits = $state<Map<number, EditState>>(new Map());
  let validationErrors = $state<Map<number, ValidationError>>(new Map());

  // ─── Derived ───
  let userTypes = $derived.by(() => {
    const groups: UserType[] = ['USER', 'VERIFIED_USER'];
    return groups.map(ut => fees.filter(f => f.user_type === ut));
  });

  let summaryByUserType = $derived.by(() => {
    const result: Record<UserType, { avgMaker: number; avgTaker: number; count: number }> = {
      USER: { avgMaker: 0, avgTaker: 0, count: 0 },
      VERIFIED_USER: { avgMaker: 0, avgTaker: 0, count: 0 }
    };
    for (const fee of fees) {
      result[fee.user_type].avgMaker += fee.maker_fee;
      result[fee.user_type].avgTaker += fee.taker_fee;
      result[fee.user_type].count += 1;
    }
    for (const ut of Object.keys(result) as UserType[]) {
      if (result[ut].count > 0) {
        result[ut].avgMaker /= result[ut].count;
        result[ut].avgTaker /= result[ut].count;
      }
    }
    return result;
  });

  // ─── Helpers ───
  function getEdit(id: number): EditState | undefined {
    return edits.get(id);
  }

  function hasChanges(fee: FeeSchedule): boolean {
    const edit = edits.get(fee.id);
    if (!edit) return false;
    return (
      edit.maker_fee !== String(fee.maker_fee) ||
      edit.taker_fee !== String(fee.taker_fee) ||
      edit.min_fee !== String(fee.min_fee)
    );
  }

  function changedFields(fee: FeeSchedule): Set<string> {
    const edit = edits.get(fee.id);
    if (!edit) return new Set();
    const changed = new Set<string>();
    if (edit.maker_fee !== String(fee.maker_fee)) changed.add('maker_fee');
    if (edit.taker_fee !== String(fee.taker_fee)) changed.add('taker_fee');
    if (edit.min_fee !== String(fee.min_fee)) changed.add('min_fee');
    return changed;
  }

  function isFieldChanged(fee: FeeSchedule, field: string): boolean {
    return changedFields(fee).has(field);
  }

  function getFieldError(id: number, field: string): string | undefined {
    return validationErrors.get(id)?.[field as keyof ValidationError];
  }

  function hasValidationErrors(id: number): boolean {
    const errs = validationErrors.get(id);
    if (!errs) return false;
    return Object.values(errs).some(v => v !== undefined);
  }

  // ─── Validation ───
  function validate(id: number): boolean {
    const edit = edits.get(id);
    if (!edit) return false;
    const errors: ValidationError = {};

    const maker = parseFloat(edit.maker_fee);
    const taker = parseFloat(edit.taker_fee);
    const min = parseFloat(edit.min_fee);

    if (edit.maker_fee.trim() === '' || isNaN(maker)) {
      errors.maker_fee = 'قيمة غير صالحة';
    } else if (maker < 0) {
      errors.maker_fee = 'لا يمكن أن تكون سالبة';
    } else if (maker > 100) {
      errors.maker_fee = 'الحد الأقصى ١٠٠٪';
    }

    if (edit.taker_fee.trim() === '' || isNaN(taker)) {
      errors.taker_fee = 'قيمة غير صالحة';
    } else if (taker < 0) {
      errors.taker_fee = 'لا يمكن أن تكون سالبة';
    } else if (taker > 100) {
      errors.taker_fee = 'الحد الأقصى ١٠٠٪';
    }

    if (edit.min_fee.trim() === '' || isNaN(min)) {
      errors.min_fee = 'قيمة غير صالحة';
    } else if (min < 0) {
      errors.min_fee = 'لا يمكن أن تكون سالبة';
    }

    const nextErrors = new Map(validationErrors);
    nextErrors.set(id, errors);
    validationErrors = nextErrors;
    return Object.values(errors).every(v => v === undefined);
  }

  // ─── Event Handlers ───
  function onFieldInput(feeId: number, field: 'maker_fee' | 'taker_fee' | 'min_fee', value: string) {
    const existing = edits.get(feeId);
    if (existing) {
      const next = new Map(edits);
      next.set(feeId, { ...existing, [field]: value });
      edits = next;
    }
    // Clear error for this field on input
    const errs = validationErrors.get(feeId);
    if (errs?.[field]) {
      const nextErrors = new Map(validationErrors);
      nextErrors.set(feeId, { ...errs, [field]: undefined });
      validationErrors = nextErrors;
    }
  }

  function onFieldFocus(fee: FeeSchedule, field: 'maker_fee' | 'taker_fee' | 'min_fee') {
    if (!edits.has(fee.id)) {
      const next = new Map(edits);
      next.set(fee.id, {
        maker_fee: String(fee.maker_fee),
        taker_fee: String(fee.taker_fee),
        min_fee: String(fee.min_fee)
      });
      edits = next;
    }
  }

  function onResetRow(fee: FeeSchedule) {
    const nextEdits = new Map(edits);
    nextEdits.delete(fee.id);
    edits = nextEdits;
    const nextErrors = new Map(validationErrors);
    nextErrors.delete(fee.id);
    validationErrors = nextErrors;
  }

  async function onSaveRow(fee: FeeSchedule) {
    const edit = edits.get(fee.id);
    if (!edit) return;

    if (!validate(fee.id)) return;

    const changed = changedFields(fee);
    if (changed.size === 0) return;

    const payload: Record<string, number> = {};
    if (changed.has('maker_fee')) payload.maker_fee = parseFloat(edit.maker_fee);
    if (changed.has('taker_fee')) payload.taker_fee = parseFloat(edit.taker_fee);
    if (changed.has('min_fee')) payload.min_fee = parseFloat(edit.min_fee);

    saving = new Set([...saving, fee.id]);

    try {
      const res = await authPut(`/api/v1/admin/fees/${fee.id}`, payload);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        error = body.message || `فشل حفظ الرسوم (HTTP ${res.status})`;
        return;
      }

      // Update local state with saved values
      const idx = fees.findIndex(f => f.id === fee.id);
      if (idx !== -1) {
        fees[idx] = {
          ...fees[idx],
          ...Object.fromEntries(Object.entries(payload))
        };
        fees = [...fees];
      }

      // Clear edit state
      const newEdits = new Map(edits);
      newEdits.delete(fee.id);
      edits = newEdits;
      const newErrors = new Map(validationErrors);
      newErrors.delete(fee.id);
      validationErrors = newErrors;

      // Flash success
      saveSuccess = new Set([...saveSuccess, fee.id]);
      setTimeout(() => {
        saveSuccess = new Set([...saveSuccess].filter(id => id !== fee.id));
      }, 2000);
    } catch (err: any) {
      error = err.message || 'فشل الاتصال بالخادم';
    } finally {
      saving = new Set([...saving].filter(id => id !== fee.id));
    }
  }

  // ─── Data Loading ───
  async function loadFees() {
    loading = true;
    error = null;
    try {
      const res = await authGet('/api/v1/admin/fees');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.json();
      if (body.success && Array.isArray(body.data)) {
        fees = body.data;
      } else {
        throw new Error(body.message || 'استجابة غير صالحة');
      }
    } catch (err: any) {
      error = err.message || 'فشل تحميل الرسوم';
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    loadFees();
  });
</script>

<!-- ─── Page ─── -->
<div class="relative z-10 space-y-8">
  <!-- Header -->
  <div class="flex items-center justify-between">
    <div class="flex items-center gap-4">
      <div class="p-3 rounded-xl" style="background: rgba(245,181,68,0.12); border: 1px solid rgba(245,181,68,0.2);">
        <Percent size={24} class="text-[var(--accent-gold)]" />
      </div>
      <div>
        <h1 class="text-2xl font-bold text-[var(--text-primary)]">إدارة الرسوم</h1>
        <p class="text-sm text-[var(--text-secondary)] mt-0.5">تعديل جداول الرسوم حسب نوع المستخدم ونوع الأمر</p>
      </div>
    </div>
    <button class="btn-secondary flex items-center gap-2" onclick={loadFees}>
      <RotateCcw size={16} />
      <span>تحديث</span>
    </button>
  </div>

  <!-- Error Banner -->
  {#if error}
    <div class="panel flex items-center gap-3 px-5 py-4" style="border-color: rgba(244,63,122,0.3);">
      <AlertCircle size={20} class="text-[var(--accent-rose)] shrink-0" />
      <p class="text-sm text-[var(--accent-rose)]">{error}</p>
      <button class="mr-auto btn-ghost text-xs" onclick={() => error = null}>إغلاق</button>
    </div>
  {/if}

  <!-- Summary Cards -->
  {#if fees.length > 0}
    <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
      {#each ['USER', 'VERIFIED_USER'] as ut (ut)}
        {@const summary = summaryByUserType[ut as UserType]}
        {@const Icon = userTypeIcons[ut as UserType]}
        {@const isVerified = ut === 'VERIFIED_USER'}
        <div class="stat-card {isVerified ? 'panel-glow' : ''}">
          <div class="flex items-center gap-3 mb-4">
            <div class="p-2.5 rounded-lg" style="background: {isVerified ? 'rgba(245,181,68,0.12)' : 'rgba(59,130,246,0.12)'}; border: 1px solid {isVerified ? 'rgba(245,181,68,0.2)' : 'rgba(59,130,246,0.2)'};">
              <Icon size={20} class={isVerified ? 'text-[var(--accent-gold)]' : 'text-[var(--accent-azure)]'} />
            </div>
            <div>
              <h3 class="font-bold text-[var(--text-primary)]">{userTypeLabels[ut as UserType]}</h3>
              <p class="text-xs text-[var(--text-tertiary)]">{summary.count} نوع أوامر</p>
            </div>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div class="rounded-xl p-3" style="background: rgba(34,211,164,0.06); border: 1px solid rgba(34,211,164,0.1);">
              <div class="flex items-center gap-1.5 mb-1.5">
                <TrendingDown size={14} class="text-[var(--accent-mint)]" />
                <span class="text-xs text-[var(--text-tertiary)]">متوسط صانع</span>
              </div>
              <p class="text-lg font-bold text-[var(--accent-mint)]">{summary.avgMaker.toFixed(3)}%</p>
            </div>
            <div class="rounded-xl p-3" style="background: rgba(244,63,122,0.06); border: 1px solid rgba(244,63,122,0.1);">
              <div class="flex items-center gap-1.5 mb-1.5">
                <TrendingUp size={14} class="text-[var(--accent-rose)]" />
                <span class="text-xs text-[var(--text-tertiary)]">متوسط آخذ</span>
              </div>
              <p class="text-lg font-bold text-[var(--accent-rose)]">{summary.avgTaker.toFixed(3)}%</p>
            </div>
          </div>
        </div>
      {/each}
    </div>
  {/if}

  <!-- Fee Tables -->
  {#if loading}
    <div class="panel p-12 flex flex-col items-center justify-center gap-4">
      <Loader2 size={32} class="text-[var(--accent-gold)] animate-spin" />
      <p class="text-sm text-[var(--text-secondary)]">جارٍ تحميل الرسوم...</p>
    </div>
  {:else if fees.length === 0 && !error}
    <div class="panel p-12 flex flex-col items-center justify-center gap-3">
      <Coins size={40} class="text-[var(--text-quaternary)]" />
      <p class="text-[var(--text-secondary)]">لا توجد رسوم مسجّلة</p>
    </div>
  {:else}
    {#each ['USER', 'VERIFIED_USER'] as ut (ut)}
      {@const groupFees = fees.filter(f => f.user_type === ut)}
      {@const isVerified = ut === 'VERIFIED_USER'}
      {@const GroupIcon = userTypeIcons[ut as UserType]}

      {#if groupFees.length > 0}
        <div class="panel overflow-hidden">
          <!-- Section Header -->
          <div class="px-6 py-4 flex items-center gap-3" style="background: {isVerified ? 'rgba(245,181,68,0.04)' : 'rgba(59,130,246,0.04)'}; border-bottom: 1px solid var(--border-subtle);">
            <GroupIcon size={20} class={isVerified ? 'text-[var(--accent-gold)]' : 'text-[var(--accent-azure)]'} />
            <h2 class="font-bold text-[var(--text-primary)]">{userTypeLabels[ut as UserType]}</h2>
            <span class="text-xs text-[var(--text-tertiary)]">({groupFees.length} أوامر)</span>
          </div>

          <!-- Table -->
          <div class="overflow-x-auto scrollbar-none">
            <table class="w-full text-sm">
              <thead>
                <tr style="background: var(--bg-overlay-5);">
                  <th class="px-5 py-3 text-right font-semibold text-[var(--text-secondary)]">نوع الأمر</th>
                  <th class="px-5 py-3 text-right font-semibold text-[var(--text-secondary)]">
                    <div class="flex items-center gap-1.5">
                      <Percent size={13} />
                      <span>رسوم الصانع</span>
                    </div>
                  </th>
                  <th class="px-5 py-3 text-right font-semibold text-[var(--text-secondary)]">
                    <div class="flex items-center gap-1.5">
                      <Percent size={13} />
                      <span>رسوم الآخذ</span>
                    </div>
                  </th>
                  <th class="px-5 py-3 text-right font-semibold text-[var(--text-secondary)]">
                    <div class="flex items-center gap-1.5">
                      <Coins size={13} />
                      <span>الحد الأدنى</span>
                    </div>
                  </th>
                  <th class="px-5 py-3 text-center font-semibold text-[var(--text-secondary)]">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {#each groupFees as fee (fee.id)}
                  {@const edit = getEdit(fee.id)}
                  {@const changed = changedFields(fee)}
                  {@const isSaving = saving.has(fee.id)}
                  {@const isSuccess = saveSuccess.has(fee.id)}
                  {@const rowHasChanges = hasChanges(fee)}
                  {@const rowHasErrors = hasValidationErrors(fee.id)}

                  <tr class="transition-colors duration-200" class:animate-shimmer={isSaving}>
                    <!-- Order Type -->
                    <td class="px-5 py-3.5">
                      <div class="flex items-center gap-2.5">
                        <ArrowUpDown size={15} class="text-[var(--text-tertiary)]" />
                        <span class="font-medium text-[var(--text-primary)]">{orderTypeLabels[fee.order_type]}</span>
                      </div>
                    </td>

                    <!-- Maker Fee -->
                    <td class="px-5 py-3.5">
                      <div class="relative">
                        {#if isFieldChanged(fee, 'maker_fee')}
                          <div class="absolute -top-1 -right-1 z-10">
                            <CircleDot size={8} class="text-[var(--accent-gold)]" />
                          </div>
                        {/if}
                        <input
                          type="text"
                          inputmode="decimal"
                          class="input-field text-left !pr-3 !pl-7 font-mono"
                          style="width: 120px; {isFieldChanged(fee, 'maker_fee') ? 'border-color: var(--accent-gold); box-shadow: 0 0 0 2px rgba(245,181,68,0.15);' : ''} {getFieldError(fee.id, 'maker_fee') ? 'border-color: var(--accent-rose) !important; box-shadow: 0 0 0 2px rgba(244,63,122,0.15) !important;' : ''}"
                          value={edit ? edit.maker_fee : fee.maker_fee}
                          onfocus={() => onFieldFocus(fee, 'maker_fee')}
                          oninput={(e) => onFieldInput(fee.id, 'maker_fee', (e.target as HTMLInputElement).value)}
                          disabled={isSaving}
                        />
                        <span class="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] text-xs font-bold">%</span>
                        {#if getFieldError(fee.id, 'maker_fee')}
                          <p class="text-xs text-[var(--accent-rose)] mt-1">{getFieldError(fee.id, 'maker_fee')}</p>
                        {/if}
                      </div>
                    </td>

                    <!-- Taker Fee -->
                    <td class="px-5 py-3.5">
                      <div class="relative">
                        {#if isFieldChanged(fee, 'taker_fee')}
                          <div class="absolute -top-1 -right-1 z-10">
                            <CircleDot size={8} class="text-[var(--accent-gold)]" />
                          </div>
                        {/if}
                        <input
                          type="text"
                          inputmode="decimal"
                          class="input-field text-left !pr-3 !pl-7 font-mono"
                          style="width: 120px; {isFieldChanged(fee, 'taker_fee') ? 'border-color: var(--accent-gold); box-shadow: 0 0 0 2px rgba(245,181,68,0.15);' : ''} {getFieldError(fee.id, 'taker_fee') ? 'border-color: var(--accent-rose) !important; box-shadow: 0 0 0 2px rgba(244,63,122,0.15) !important;' : ''}"
                          value={edit ? edit.taker_fee : fee.taker_fee}
                          onfocus={() => onFieldFocus(fee, 'taker_fee')}
                          oninput={(e) => onFieldInput(fee.id, 'taker_fee', (e.target as HTMLInputElement).value)}
                          disabled={isSaving}
                        />
                        <span class="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] text-xs font-bold">%</span>
                        {#if getFieldError(fee.id, 'taker_fee')}
                          <p class="text-xs text-[var(--accent-rose)] mt-1">{getFieldError(fee.id, 'taker_fee')}</p>
                        {/if}
                      </div>
                    </td>

                    <!-- Min Fee -->
                    <td class="px-5 py-3.5">
                      <div class="relative">
                        {#if isFieldChanged(fee, 'min_fee')}
                          <div class="absolute -top-1 -right-1 z-10">
                            <CircleDot size={8} class="text-[var(--accent-gold)]" />
                          </div>
                        {/if}
                        <input
                          type="text"
                          inputmode="decimal"
                          class="input-field text-left !pr-3 font-mono"
                          style="width: 120px; {isFieldChanged(fee, 'min_fee') ? 'border-color: var(--accent-gold); box-shadow: 0 0 0 2px rgba(245,181,68,0.15);' : ''} {getFieldError(fee.id, 'min_fee') ? 'border-color: var(--accent-rose) !important; box-shadow: 0 0 0 2px rgba(244,63,122,0.15) !important;' : ''}"
                          value={edit ? edit.min_fee : fee.min_fee}
                          onfocus={() => onFieldFocus(fee, 'min_fee')}
                          oninput={(e) => onFieldInput(fee.id, 'min_fee', (e.target as HTMLInputElement).value)}
                          disabled={isSaving}
                        />
                        {#if getFieldError(fee.id, 'min_fee')}
                          <p class="text-xs text-[var(--accent-rose)] mt-1">{getFieldError(fee.id, 'min_fee')}</p>
                        {/if}
                      </div>
                    </td>

                    <!-- Actions -->
                    <td class="px-5 py-3.5 text-center">
                      <div class="flex items-center justify-center gap-2">
                        {#if isSuccess}
                          <div class="flex items-center gap-1.5 text-[var(--accent-mint)]">
                            <CheckCircle2 size={16} />
                            <span class="text-xs font-medium">تم الحفظ</span>
                          </div>
                        {:else}
                          <button
                            class="btn-primary flex items-center gap-1.5 !px-3.5 !py-2 !text-xs"
                            onclick={() => onSaveRow(fee)}
                            disabled={!rowHasChanges || isSaving || rowHasErrors}
                            style={(!rowHasChanges || isSaving || rowHasErrors) ? 'opacity: 0.4; cursor: not-allowed; box-shadow: none;' : ''}
                          >
                            {#if isSaving}
                              <Loader2 size={13} class="animate-spin" />
                            {:else}
                              <Save size={13} />
                            {/if}
                            <span>حفظ</span>
                          </button>
                          {#if rowHasChanges}
                            <button
                              class="btn-ghost flex items-center gap-1 !px-2.5 !py-1.5 !text-xs"
                              onclick={() => onResetRow(fee)}
                              disabled={isSaving}
                            >
                              <RotateCcw size={12} />
                              <span>تراجع</span>
                            </button>
                          {/if}
                        {/if}
                      </div>
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        </div>
      {/if}
    {/each}
  {/if}

  <!-- Legend -->
  {#if fees.length > 0}
    <div class="panel px-5 py-3.5 flex items-center gap-6 flex-wrap">
      <span class="text-xs text-[var(--text-tertiary)] font-semibold">دليل:</span>
      <div class="flex items-center gap-2">
        <div class="w-4 h-4 rounded border-2" style="border-color: var(--accent-gold);"></div>
        <span class="text-xs text-[var(--text-secondary)]">حقل معدّل</span>
      </div>
      <div class="flex items-center gap-2">
        <CircleDot size={10} class="text-[var(--accent-gold)]" />
        <span class="text-xs text-[var(--text-secondary)]">مؤشر التغيير</span>
      </div>
      <div class="flex items-center gap-2">
        <div class="w-4 h-4 rounded border-2" style="border-color: var(--accent-rose);"></div>
        <span class="text-xs text-[var(--text-secondary)]">خطأ تحقق</span>
      </div>
    </div>
  {/if}
</div>
