<script lang="ts">
  import { onMount } from 'svelte';
  import {
    Percent, ArrowUpDown, Save, RotateCcw, Loader2, AlertCircle,
    CheckCircle2, TrendingUp, TrendingDown, Coins, ShieldCheck, User, BadgeCheck, CircleDot
  } from 'lucide-svelte';
  import { authGet, authPut } from '$lib/api/client';

  type UserType = 'USER' | 'VERIFIED_USER';
  type OrderType = 'MARKET' | 'LIMIT' | 'STOP_LIMIT' | 'TAKE_PROFIT';

  interface FeeSchedule { id: number; user_type: UserType; order_type: OrderType; maker_fee: number; taker_fee: number; min_fee: number; }
  interface EditState { maker_fee: string; taker_fee: string; min_fee: string; }

  const userTypeLabels: Record<UserType, string> = { USER: 'مستخدم عادي', VERIFIED_USER: 'مستخدم موثّق' };
  const orderTypeLabels: Record<OrderType, string> = { MARKET: 'سوقي', LIMIT: 'محدد', STOP_LIMIT: 'وقف محدد', TAKE_PROFIT: 'جني الأرباح' };
  const userTypeIcons: Record<UserType, typeof User> = { USER: User, VERIFIED_USER: BadgeCheck };

  let fees = $state<FeeSchedule[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let saving = $state<Set<number>>(new Set());
  let saveSuccess = $state<Set<number>>(new Set());
  let edits = $state<Map<number, EditState>>(new Map());

  let summaryByUserType = $derived.by(() => {
    const result: Record<UserType, { avgMaker: number; avgTaker: number; count: number }> = { USER: { avgMaker: 0, avgTaker: 0, count: 0 }, VERIFIED_USER: { avgMaker: 0, avgTaker: 0, count: 0 } };
    for (const fee of fees) { result[fee.user_type].avgMaker += fee.maker_fee; result[fee.user_type].avgTaker += fee.taker_fee; result[fee.user_type].count += 1; }
    for (const ut of Object.keys(result) as UserType[]) { if (result[ut].count > 0) { result[ut].avgMaker /= result[ut].count; result[ut].avgTaker /= result[ut].count; } }
    return result;
  });

  function hasChanges(fee: FeeSchedule): boolean {
    const edit = edits.get(fee.id); if (!edit) return false;
    return edit.maker_fee !== String(fee.maker_fee) || edit.taker_fee !== String(fee.taker_fee) || edit.min_fee !== String(fee.min_fee);
  }

  function isFieldChanged(fee: FeeSchedule, field: string): boolean {
    const edit = edits.get(fee.id); if (!edit) return false;
    return edit[field as keyof EditState] !== String(fee[field as keyof FeeSchedule]);
  }

  function onFieldFocus(fee: FeeSchedule, field: 'maker_fee' | 'taker_fee' | 'min_fee') {
    if (!edits.has(fee.id)) { edits = new Map(edits).set(fee.id, { maker_fee: String(fee.maker_fee), taker_fee: String(fee.taker_fee), min_fee: String(fee.min_fee) }); }
  }

  function onFieldInput(feeId: number, field: 'maker_fee' | 'taker_fee' | 'min_fee', value: string) {
    const existing = edits.get(feeId); if (!existing) return;
    edits = new Map(edits).set(feeId, { ...existing, [field]: value });
  }

  function onResetRow(fee: FeeSchedule) { edits = new Map(edits); edits.delete(fee.id); edits = new Map(edits); }

  async function onSaveRow(fee: FeeSchedule) {
    const edit = edits.get(fee.id); if (!edit) return;
    const payload: Record<string, number> = {};
    if (isFieldChanged(fee, 'maker_fee')) payload.maker_fee = parseFloat(edit.maker_fee);
    if (isFieldChanged(fee, 'taker_fee')) payload.taker_fee = parseFloat(edit.taker_fee);
    if (isFieldChanged(fee, 'min_fee')) payload.min_fee = parseFloat(edit.min_fee);
    if (Object.keys(payload).length === 0) return;
    saving = new Set([...saving, fee.id]);
    try {
      const res = await authPut(`/api/v1/admin/fees/${fee.id}`, payload);
      if (!res.ok) throw new Error('فشل حفظ الرسوم');
      const idx = fees.findIndex(f => f.id === fee.id);
      if (idx !== -1) fees[idx] = { ...fees[idx], ...payload }; fees = [...fees];
      const newEdits = new Map(edits); newEdits.delete(fee.id); edits = newEdits;
      saveSuccess = new Set([...saveSuccess, fee.id]);
      setTimeout(() => { saveSuccess = new Set([...saveSuccess].filter(id => id !== fee.id)); }, 2000);
    } catch (e: any) { error = e.message; }
    finally { saving = new Set([...saving].filter(id => id !== fee.id)); }
  }

  async function loadFees() {
    loading = true; error = null;
    try {
      const res = await authGet('/api/v1/admin/fees');
      if (!res.ok) throw new Error('فشل تحميل الرسوم');
      const body = await res.json();
      if (body.success && Array.isArray(body.data)) fees = body.data;
    } catch (e: any) { error = e.message; }
    finally { loading = false; }
  }

  onMount(() => { loadFees(); });
</script>

<div class="space-y-8">
  <div class="flex items-center justify-between">
    <div class="flex items-center gap-4">
      <div class="p-3 rounded-xl" style="background: rgba(245,181,68,0.12); border: 1px solid rgba(245,181,68,0.2);"><Percent size={24} style="color: var(--accent-gold);" /></div>
      <div><h1 class="text-2xl font-bold text-[var(--text-primary)]">إدارة الرسوم</h1><p class="text-sm text-[var(--text-secondary)] mt-0.5">تعديل جداول الرسوم حسب نوع المستخدم ونوع الأمر</p></div>
    </div>
    <button class="btn-secondary flex items-center gap-2" onclick={loadFees}><RotateCcw size={16} /><span>تحديث</span></button>
  </div>

  {#if error}
    <div class="panel flex items-center gap-3 px-5 py-4" style="border-color: rgba(244,63,122,0.3);"><AlertCircle size={20} style="color: #f43f7a;" /><p class="text-sm" style="color: #f43f7a;">{error}</p><button class="mr-auto btn-ghost text-xs" onclick={() => error = null}>إغلاق</button></div>
  {/if}

  {#if fees.length > 0}
    <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
      {#each ['USER', 'VERIFIED_USER'] as ut (ut)}
        {@const summary = summaryByUserType[ut as UserType]}
        {@const Icon = userTypeIcons[ut as UserType]}
        {@const isVerified = ut === 'VERIFIED_USER'}
        <div class="stat-card {isVerified ? 'panel-glow' : ''}">
          <div class="flex items-center gap-3 mb-4">
            <div class="p-2.5 rounded-lg" style="background: {isVerified ? 'rgba(245,181,68,0.12)' : 'rgba(59,130,246,0.12)'};"><Icon size={20} style="color: {isVerified ? '#f5b544' : '#3b82f6'};" /></div>
            <div><h3 class="font-bold text-[var(--text-primary)]">{userTypeLabels[ut as UserType]}</h3><p class="text-xs text-[var(--text-tertiary)]">{summary.count} نوع أوامر</p></div>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div class="rounded-xl p-3" style="background: rgba(34,211,164,0.06); border: 1px solid rgba(34,211,164,0.1);"><div class="flex items-center gap-1.5 mb-1.5"><TrendingDown size={14} style="color: #22d3a4;" /><span class="text-xs text-[var(--text-tertiary)]">متوسط صانع</span></div><p class="text-lg font-bold" style="color: #22d3a4;">{summary.avgMaker.toFixed(3)}%</p></div>
            <div class="rounded-xl p-3" style="background: rgba(244,63,122,0.06); border: 1px solid rgba(244,63,122,0.1);"><div class="flex items-center gap-1.5 mb-1.5"><TrendingUp size={14} style="color: #f43f7a;" /><span class="text-xs text-[var(--text-tertiary)]">متوسط آخذ</span></div><p class="text-lg font-bold" style="color: #f43f7a;">{summary.avgTaker.toFixed(3)}%</p></div>
          </div>
        </div>
      {/each}
    </div>
  {/if}

  {#if loading}
    <div class="panel p-12 flex flex-col items-center gap-4"><Loader2 size={32} class="animate-spin" style="color: var(--accent-gold);" /><p class="text-sm" style="color: var(--text-secondary);">جارٍ التحميل...</p></div>
  {:else if fees.length === 0}
    <div class="panel p-12 flex flex-col items-center gap-3"><Coins size={40} style="color: var(--text-quaternary);" /><p style="color: var(--text-secondary);">لا توجد رسوم مسجّلة</p></div>
  {:else}
    {#each ['USER', 'VERIFIED_USER'] as ut (ut)}
      {@const groupFees = fees.filter(f => f.user_type === ut)}
      {@const isVerified = ut === 'VERIFIED_USER'}
      {@const GroupIcon = userTypeIcons[ut as UserType]}
      {#if groupFees.length > 0}
        <div class="panel overflow-hidden">
          <div class="px-6 py-4 flex items-center gap-3" style="background: {isVerified ? 'rgba(245,181,68,0.04)' : 'rgba(59,130,246,0.04)'}; border-bottom: 1px solid var(--border-subtle);">
            <GroupIcon size={20} style="color: {isVerified ? '#f5b544' : '#3b82f6'};" />
            <h2 class="font-bold text-[var(--text-primary)]">{userTypeLabels[ut as UserType]}</h2>
            <span class="text-xs text-[var(--text-tertiary)]">({groupFees.length} أوامر)</span>
          </div>
          <div class="overflow-x-auto scrollbar-none">
            <table class="data-table">
              <thead><tr><th>نوع الأمر</th><th>رسوم الصانع</th><th>رسوم الآخذ</th><th>الحد الأدنى</th><th>إجراءات</th></tr></thead>
              <tbody>
                {#each groupFees as fee (fee.id)}
                  {@const edit = edits.get(fee.id)}
                  {@const isSaving = saving.has(fee.id)}
                  {@const isSuccess = saveSuccess.has(fee.id)}
                  {@const rowHasChanges = hasChanges(fee)}
                  <tr class:animate-shimmer={isSaving}>
                    <td><div class="flex items-center gap-2.5"><ArrowUpDown size={15} style="color: var(--text-tertiary);" /><span class="font-medium">{orderTypeLabels[fee.order_type]}</span></div></td>
                    <td>
                      <div class="relative">
                        {#if isFieldChanged(fee, 'maker_fee')}<div class="absolute -top-1 -right-1 z-10"><CircleDot size={8} style="color: var(--accent-gold);" /></div>{/if}
                        <input type="text" inputmode="decimal" class="input-field text-left !pr-3 !pl-7 font-mono" style="width: 120px; {isFieldChanged(fee, 'maker_fee') ? 'border-color: var(--accent-gold); box-shadow: 0 0 0 2px rgba(245,181,68,0.15);' : ''}" value={edit ? edit.maker_fee : fee.maker_fee} onfocus={() => onFieldFocus(fee, 'maker_fee')} oninput={(e) => onFieldInput(fee.id, 'maker_fee', (e.target as HTMLInputElement).value)} disabled={isSaving} />
                        <span class="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold" style="color: var(--text-tertiary);">%</span>
                      </div>
                    </td>
                    <td>
                      <div class="relative">
                        {#if isFieldChanged(fee, 'taker_fee')}<div class="absolute -top-1 -right-1 z-10"><CircleDot size={8} style="color: var(--accent-gold);" /></div>{/if}
                        <input type="text" inputmode="decimal" class="input-field text-left !pr-3 !pl-7 font-mono" style="width: 120px; {isFieldChanged(fee, 'taker_fee') ? 'border-color: var(--accent-gold); box-shadow: 0 0 0 2px rgba(245,181,68,0.15);' : ''}" value={edit ? edit.taker_fee : fee.taker_fee} onfocus={() => onFieldFocus(fee, 'taker_fee')} oninput={(e) => onFieldInput(fee.id, 'taker_fee', (e.target as HTMLInputElement).value)} disabled={isSaving} />
                        <span class="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold" style="color: var(--text-tertiary);">%</span>
                      </div>
                    </td>
                    <td>
                      <div class="relative">
                        {#if isFieldChanged(fee, 'min_fee')}<div class="absolute -top-1 -right-1 z-10"><CircleDot size={8} style="color: var(--accent-gold);" /></div>{/if}
                        <input type="text" inputmode="decimal" class="input-field text-left !pr-3 font-mono" style="width: 120px; {isFieldChanged(fee, 'min_fee') ? 'border-color: var(--accent-gold); box-shadow: 0 0 0 2px rgba(245,181,68,0.15);' : ''}" value={edit ? edit.min_fee : fee.min_fee} onfocus={() => onFieldFocus(fee, 'min_fee')} oninput={(e) => onFieldInput(fee.id, 'min_fee', (e.target as HTMLInputElement).value)} disabled={isSaving} />
                      </div>
                    </td>
                    <td>
                      <div class="flex items-center justify-center gap-2">
                        {#if isSuccess}
                          <div class="flex items-center gap-1.5" style="color: #22d3a4;"><CheckCircle2 size={16} /><span class="text-xs font-medium">تم الحفظ</span></div>
                        {:else}
                          <button class="btn-primary !px-3.5 !py-2 !text-xs flex items-center gap-1.5" onclick={() => onSaveRow(fee)} disabled={!rowHasChanges || isSaving} style={!rowHasChanges || isSaving ? 'opacity: 0.4; cursor: not-allowed; box-shadow: none;' : ''}>
                            {#if isSaving}<Loader2 size={13} class="animate-spin" />{:else}<Save size={13} />{/if}حفظ
                          </button>
                          {#if rowHasChanges}
                            <button class="btn-ghost !px-2.5 !py-1.5 !text-xs flex items-center gap-1" onclick={() => onResetRow(fee)} disabled={isSaving}><RotateCcw size={12} />تراجع</button>
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

  {#if fees.length > 0}
    <div class="panel px-5 py-3.5 flex items-center gap-6 flex-wrap">
      <span class="text-xs font-semibold" style="color: var(--text-tertiary);">دليل:</span>
      <div class="flex items-center gap-2"><div class="w-4 h-4 rounded border-2" style="border-color: var(--accent-gold);"></div><span class="text-xs" style="color: var(--text-secondary);">حقل معدّل</span></div>
      <div class="flex items-center gap-2"><CircleDot size={10} style="color: var(--accent-gold);" /><span class="text-xs" style="color: var(--text-secondary);">مؤشر التغيير</span></div>
    </div>
  {/if}
</div>
