<script lang="ts">
  import { onMount } from 'svelte';
  import { kyc } from '$lib/api/endpoints';
  import { parseApiResponse, ApiError } from '$lib/api/client';
  import { toasts } from '$lib/stores/toast';
  import {
    FileText, Upload, Check, Clock, X, AlertCircle, ShieldCheck, Loader2
  } from 'lucide-svelte';

  let status = $state<'none' | 'pending' | 'approved' | 'rejected'>('none');
  let fullName = $state('');
  let docType = $state('national_id');
  let docNumber = $state('');
  let docFile = $state<File | null>(null);
  let docPreview = $state('');
  let loading = $state(false);
  let rejectionReason = $state('');

  onMount(() => {
(async () => {
    await loadStatus();
  
  })();
});

  async function loadStatus() {
    try {
      const res = await kyc.getStatus();
      const data = await parseApiResponse<any>(res);
      if (data) {
        status = data.status || 'none';
        fullName = data.full_name || '';
        rejectionReason = data.rejection_reason || '';
      }
    } catch {
      status = 'none';
    }
  }

  function handleFile(e: Event) {
    const input = e.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const f = input.files[0];
      if (f.size > 5 * 1024 * 1024) {
        toasts.error('حجم الملف يجب أن يكون أقل من 5MB');
        return;
      }
      docFile = f;
      docPreview = URL.createObjectURL(f);
    }
  }

  async function handleSubmit() {
    if (!fullName.trim()) {
      toasts.error('الاسم الكامل مطلوب');
      return;
    }
    if (!docNumber.trim()) {
      toasts.error('رقم المستند مطلوب');
      return;
    }
    if (!docFile) {
      toasts.error('يجب رفع المستند');
      return;
    }

    loading = true;
    try {
      // 1. Upload file
      const formData = new FormData();
      formData.append('document', docFile);
      const upRes = await kyc.uploadDocument(formData);
      const upData = await parseApiResponse<any>(upRes);
      const docUrl = upData.url || upData.path || '';

      // 2. Submit KYC
      await kyc.submit({
        full_name: fullName.trim(),
        document_type: docType,
        document_number: docNumber.trim(),
        document_url: docUrl
      });
      toasts.success('تم إرسال طلب التحقق');
      await loadStatus();
    } catch (err: any) {
      if (err instanceof ApiError) toasts.error(err.message);
      else toasts.error('فشل إرسال الطلب');
    } finally {
      loading = false;
    }
  }
</script>

<svelte:head><title>التحقق — NEXUS</title></svelte:head>

<div class="max-w-2xl mx-auto space-y-5">
  <div>
    <h1 class="text-2xl sm:text-3xl font-bold text-white">التحقق (KYC)</h1>
    <p class="text-sm text-slate-400 mt-1">تحقق من هويتك لرفع حدود التداول</p>
  </div>

  <!-- Status banner -->
  {#if status === 'approved'}
    <div class="panel p-5 bg-accent-mint/5 border-accent-mint/20 flex items-center gap-4">
      <div class="w-12 h-12 rounded-xl bg-accent-mint/15 flex items-center justify-center">
        <ShieldCheck size={24} class="text-accent-mint" />
      </div>
      <div>
        <h3 class="text-base font-bold text-white">تم التحقق بنجاح!</h3>
        <p class="text-xs text-slate-400 mt-0.5">حسابك مُوثّق بالكامل</p>
      </div>
    </div>
  {:else if status === 'pending'}
    <div class="panel p-5 bg-accent-gold/5 border-accent-gold/20 flex items-center gap-4">
      <div class="w-12 h-12 rounded-xl bg-accent-gold/15 flex items-center justify-center">
        <Clock size={24} class="text-accent-gold animate-pulse" />
      </div>
      <div>
        <h3 class="text-base font-bold text-white">طلبك قيد المراجعة</h3>
        <p class="text-xs text-slate-400 mt-0.5">يتم مراجعة طلبك خلال 24 ساعة</p>
      </div>
    </div>
  {:else if status === 'rejected'}
    <div class="panel p-5 bg-accent-rose/5 border-accent-rose/20">
      <div class="flex items-center gap-4 mb-3">
        <div class="w-12 h-12 rounded-xl bg-accent-rose/15 flex items-center justify-center">
          <X size={24} class="text-accent-rose" />
        </div>
        <div>
          <h3 class="text-base font-bold text-white">تم رفض الطلب</h3>
          <p class="text-xs text-slate-400 mt-0.5">يرجى تعديل البيانات وإعادة الإرسال</p>
        </div>
      </div>
      {#if rejectionReason}
        <div class="panel p-3 bg-ink-950/60 text-xs text-slate-300">
          <span class="font-bold text-accent-rose">سبب الرفض:</span> {rejectionReason}
        </div>
      {/if}
    </div>
  {/if}

  {#if status === 'none' || status === 'rejected'}
    <div class="panel p-6">
      <form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }} class="space-y-4">
        <div>
          <label class="input-label" for="fullName">الاسم الكامل (كما في المستند)</label>
          <input id="fullName" bind:value={fullName} type="text" class="input" placeholder="الاسم الكامل" />
        </div>

        <div>
          <label class="input-label" for="docType">نوع المستند</label>
          <select id="docType" bind:value={docType} class="input">
            <option value="national_id">بطاقة الهوية الوطنية</option>
            <option value="passport">جواز السفر</option>
            <option value="driving_license">رخصة القيادة</option>
          </select>
        </div>

        <div>
          <label class="input-label" for="docNumber">رقم المستند</label>
          <input id="docNumber" bind:value={docNumber} type="text" class="input font-mono" placeholder="0000000000" />
        </div>

        <div>
          <span class="input-label">رفع المستند</span>
          <label class="block border-2 border-dashed border-white/10 rounded-xl p-6 text-center cursor-pointer hover:border-accent-gold/40 transition-colors">
            <input type="file" accept="image/*,.pdf" class="hidden" onchange={handleFile} />
            {#if docPreview}
              <img src={docPreview} alt="معاينة" class="max-h-32 mx-auto rounded-lg" />
              <p class="text-xs text-slate-400 mt-2">{docFile?.name}</p>
            {:else}
              <Upload size={28} class="mx-auto mb-2 text-slate-500" />
              <p class="text-sm text-slate-300">اضغط لرفع المستند</p>
              <p class="text-[10px] text-slate-500 mt-1">PNG, JPG, PDF (حد أقصى 5MB)</p>
            {/if}
          </label>
        </div>

        <div class="panel p-3 bg-accent-gold/5 border-accent-gold/20 flex items-start gap-2">
          <AlertCircle size={14} class="text-accent-gold shrink-0 mt-0.5" />
          <p class="text-[11px] text-slate-300 leading-relaxed">
            يجب أن يكون المستند واضحاً وغير منتهي الصلاحية. سيتم رفض المستندات غير الواضحة.
          </p>
        </div>

        <button type="submit" disabled={loading} class="btn-primary w-full py-3">
          {#if loading}
            <Loader2 size={16} class="animate-spin" />
          {:else}
            إرسال طلب التحقق
          {/if}
        </button>
      </form>
    </div>
  {/if}
</div>
