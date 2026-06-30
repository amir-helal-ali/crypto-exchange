<script lang="ts">
  import { onMount } from 'svelte';
  import { kyc } from '$lib/api/endpoints';
  import { parseApiResponse, ApiError } from '$lib/api/client';
  import { toasts } from '$lib/stores/toast';
  import {
    FileText, Upload, Check, Clock, X, AlertCircle, ShieldCheck, Loader2,
    IdCard, BookUser, CreditCard, Camera, Sparkles, Lock
  } from 'lucide-svelte';

  let status = $state<'none' | 'pending' | 'approved' | 'rejected'>('none');
  let fullName = $state('');
  let docType = $state('national_id');
  let docNumber = $state('');
  let docFile = $state<File | null>(null);
  let docPreview = $state('');
  let loading = $state(false);
  let rejectionReason = $state('');
  let submittedAt = $state('');

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
        submittedAt = data.submitted_at || data.created_at || '';
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
      const formData = new FormData();
      formData.append('document', docFile);
      const upRes = await kyc.uploadDocument(formData);
      const upData = await parseApiResponse<any>(upRes);
      const docUrl = upData.url || upData.path || '';

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

  // Step indicator logic
  const currentStep = $derived.by(() => {
    if (status === 'approved') return 4;
    if (status === 'pending') return 3;
    if (status === 'rejected') return 2;
    return docFile ? 2 : 1;
  });

  const docTypes = [
    { value: 'national_id', label: 'بطاقة الهوية الوطنية', icon: IdCard },
    { value: 'passport', label: 'جواز السفر', icon: BookUser },
    { value: 'driving_license', label: 'رخصة القيادة', icon: CreditCard }
  ];

  const steps = [
    { num: 1, label: 'البيانات', icon: FileText },
    { num: 2, label: 'المستند', icon: Upload },
    { num: 3, label: 'المراجعة', icon: Clock },
    { num: 4, label: 'موثّق', icon: ShieldCheck }
  ];
</script>

<svelte:head><title>التحقق — NEXUS</title></svelte:head>

<div class="max-w-2xl mx-auto space-y-6 relative">
  <!-- Ambient aurora -->
  <div class="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
    <div class="absolute -top-20 right-1/4 w-80 h-80 bg-accent-violet/8 blur-[120px] rounded-full animate-pulse-glow"></div>
    <div class="absolute bottom-0 -left-32 w-80 h-80 bg-accent-gold/6 blur-[120px] rounded-full animate-pulse-glow" style="animation-delay: 2s;"></div>
  </div>

  <!-- Header -->
  <div class="relative">
    <div class="flex items-center gap-3 mb-2">
      <div class="w-11 h-11 rounded-2xl bg-gradient-to-br from-accent-violet/20 to-accent-gold/10 border border-accent-violet/20 flex items-center justify-center">
        <ShieldCheck size={22} class="text-accent-violet" />
      </div>
      <div>
        <h1 class="text-2xl sm:text-3xl font-bold text-white tracking-tight">التحقق من الهوية (KYC)</h1>
        <p class="text-sm text-slate-400 mt-0.5">تحقق من هويتك لرفع حدود التداول والسحب</p>
      </div>
    </div>
  </div>

  <!-- Step progress indicator -->
  <div class="panel p-5 relative overflow-hidden">
    <div class="absolute top-0 inset-x-0 h-px pointer-events-none" style="background: linear-gradient(90deg, transparent, rgba(168, 85, 247, 0.3), rgba(245, 181, 68, 0.3), transparent);"></div>
    <div class="relative flex items-center justify-between">
      {#each steps as step, i}
        <div class="flex flex-col items-center gap-2 flex-1 relative">
          {#if i < steps.length - 1}
            <div class="absolute top-5 right-1/2 left-1/2 h-0.5 -z-0" style="background: {currentStep > step.num ? 'linear-gradient(90deg, #22d3a4, #22d3a4)' : 'rgba(255,255,255,0.06)'};"></div>
          {/if}
          <div class="relative z-10 w-10 h-10 rounded-xl flex items-center justify-center transition-all {
            currentStep > step.num
              ? 'bg-accent-mint/20 border border-accent-mint/40 text-accent-mint'
              : currentStep === step.num
                ? 'bg-accent-gold/20 border border-accent-gold/40 text-accent-gold'
                : 'bg-white/[0.03] border border-white/5 text-slate-500'
          }">
            {#if currentStep > step.num}
              <Check size={18} />
            {:else}
              <step.icon size={16} />
            {/if}
            {#if currentStep === step.num}
              <span class="absolute inset-0 rounded-xl border-2 border-accent-gold/40 animate-ping"></span>
            {/if}
          </div>
          <span class="text-[10px] font-bold {currentStep >= step.num ? 'text-white' : 'text-slate-500'} tracking-wide">{step.label}</span>
        </div>
      {/each}
    </div>
  </div>

  <!-- Status banners -->
  {#if status === 'approved'}
    <div class="panel p-6 bg-gradient-to-br from-accent-mint/8 to-transparent border-accent-mint/25 relative overflow-hidden">
      <div class="absolute -top-12 -right-12 w-40 h-40 bg-accent-mint/15 blur-3xl rounded-full animate-pulse-glow"></div>
      <div class="relative flex items-center gap-4">
        <div class="relative w-14 h-14 rounded-2xl bg-accent-mint/20 border border-accent-mint/30 flex items-center justify-center">
          <ShieldCheck size={28} class="text-accent-mint" />
          <span class="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-accent-mint flex items-center justify-center">
            <Check size={12} class="text-ink-950" />
          </span>
        </div>
        <div class="flex-1">
          <h3 class="text-base font-bold text-white">تم التحقق بنجاح!</h3>
          <p class="text-xs text-slate-400 mt-0.5">حسابك مُوثّق بالكامل — جميع الميزات متاحة</p>
        </div>
        <div class="hidden sm:flex flex-col items-end gap-1">
          <span class="pill-mint flex items-center gap-1"><Sparkles size={10} /> VIP</span>
          <span class="text-[10px] text-slate-500">حدوث أعلى للسحب</span>
        </div>
      </div>
    </div>
  {:else if status === 'pending'}
    <div class="panel p-6 bg-gradient-to-br from-accent-gold/8 to-transparent border-accent-gold/25 relative overflow-hidden">
      <div class="absolute -top-12 -left-12 w-40 h-40 bg-accent-gold/15 blur-3xl rounded-full animate-pulse-glow"></div>
      <div class="relative flex items-center gap-4">
        <div class="relative w-14 h-14 rounded-2xl bg-accent-gold/20 border border-accent-gold/30 flex items-center justify-center">
          <Clock size={28} class="text-accent-gold animate-pulse" />
        </div>
        <div class="flex-1">
          <h3 class="text-base font-bold text-white">طلبك قيد المراجعة</h3>
          <p class="text-xs text-slate-400 mt-0.5">يتم مراجعة طلبك خلال 24 ساعة كحد أقصى</p>
          {#if submittedAt}
            <p class="text-[10px] text-slate-500 mt-1">أُرسل في: {submittedAt}</p>
          {/if}
        </div>
        <div class="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-accent-gold/10 border border-accent-gold/20">
          <span class="relative flex h-2 w-2">
            <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-gold opacity-60"></span>
            <span class="relative inline-flex rounded-full h-2 w-2 bg-accent-gold"></span>
          </span>
          <span class="text-[10px] font-bold text-accent-gold">قيد المعالجة</span>
        </div>
      </div>
    </div>
  {:else if status === 'rejected'}
    <div class="panel p-6 bg-gradient-to-br from-accent-rose/8 to-transparent border-accent-rose/25 relative overflow-hidden">
      <div class="absolute -top-12 -right-12 w-40 h-40 bg-accent-rose/15 blur-3xl rounded-full"></div>
      <div class="relative">
        <div class="flex items-center gap-4 mb-3">
          <div class="w-14 h-14 rounded-2xl bg-accent-rose/20 border border-accent-rose/30 flex items-center justify-center">
            <X size={28} class="text-accent-rose" />
          </div>
          <div>
            <h3 class="text-base font-bold text-white">تم رفض الطلب</h3>
            <p class="text-xs text-slate-400 mt-0.5">يرجى تعديل البيانات وإعادة الإرسال</p>
          </div>
        </div>
        {#if rejectionReason}
          <div class="panel p-3 bg-ink-950/60 border-accent-rose/15 flex items-start gap-2">
            <AlertCircle size={14} class="text-accent-rose shrink-0 mt-0.5" />
            <div class="flex-1">
              <p class="text-[10px] font-bold text-accent-rose mb-0.5">سبب الرفض:</p>
              <p class="text-xs text-slate-300 leading-relaxed">{rejectionReason}</p>
            </div>
          </div>
        {/if}
      </div>
    </div>
  {/if}

  {#if status === 'none' || status === 'rejected'}
    <div class="panel p-6 relative overflow-hidden">
      <div class="absolute top-0 inset-x-0 h-px pointer-events-none" style="background: linear-gradient(90deg, transparent, rgba(245, 181, 68, 0.3), transparent);"></div>
      <form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }} class="space-y-5 relative">
        <!-- Full name -->
        <div>
          <label class="input-label flex items-center gap-1.5" for="fullName">
            <FileText size={12} class="text-accent-gold" />
            الاسم الكامل (كما في المستند)
          </label>
          <input id="fullName" bind:value={fullName} type="text" class="input" placeholder="مثال: أحمد محمد علي" />
        </div>

        <!-- Document type — visual selector -->
        <div>
          <span class="input-label flex items-center gap-1.5 mb-2">
            <IdCard size={12} class="text-accent-gold" />
            نوع المستند
          </span>
          <div class="grid grid-cols-3 gap-2">
            {#each docTypes as dt}
              <button
                type="button"
                onclick={() => (docType = dt.value)}
                class="relative p-3 rounded-xl border text-center transition-all {
                  docType === dt.value
                    ? 'bg-accent-gold/10 border-accent-gold/40 text-white'
                    : 'bg-white/[0.02] border-white/5 text-slate-400 hover:border-white/10 hover:bg-white/5'
                }"
              >
                {#if docType === dt.value}
                  <div class="absolute top-1.5 left-1.5 w-4 h-4 rounded-full bg-accent-gold flex items-center justify-center">
                    <Check size={10} class="text-ink-950" />
                  </div>
                {/if}
                <dt.icon size={18} class="mx-auto mb-1 {docType === dt.value ? 'text-accent-gold' : ''}" />
                <span class="text-[10px] font-medium leading-tight block">{dt.label}</span>
              </button>
            {/each}
          </div>
        </div>

        <!-- Document number -->
        <div>
          <label class="input-label flex items-center gap-1.5" for="docNumber">
            <CreditCard size={12} class="text-accent-gold" />
            رقم المستند
          </label>
          <input id="docNumber" bind:value={docNumber} type="text" class="input font-mono" placeholder="0000000000" />
        </div>

        <!-- File upload — premium dropzone -->
        <div>
          <span class="input-label flex items-center gap-1.5 mb-2">
            <Upload size={12} class="text-accent-gold" />
            رفع المستند
          </span>
          <label class="block relative overflow-hidden rounded-xl p-6 text-center cursor-pointer transition-all group {
            docPreview
              ? 'border-2 border-accent-mint/30 bg-accent-mint/5'
              : 'border-2 border-dashed border-white/10 hover:border-accent-gold/40 bg-white/[0.01] hover:bg-accent-gold/[0.02]'
          }">
            <input type="file" accept="image/*,.pdf" class="hidden" onchange={handleFile} />
            {#if docPreview}
              <div class="relative inline-block">
                <img src={docPreview} alt="معاينة" class="max-h-32 mx-auto rounded-lg shadow-lg" />
                <div class="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-accent-mint flex items-center justify-center shadow-lg">
                  <Check size={14} class="text-ink-950" />
                </div>
              </div>
              <p class="text-xs text-white font-medium mt-3">{docFile?.name}</p>
              <p class="text-[10px] text-slate-500 mt-1 tabular-nums">{(docFile && (docFile.size / 1024).toFixed(0))} KB</p>
              <p class="text-[10px] text-accent-gold mt-2 flex items-center justify-center gap-1">
                <Camera size={10} /> اضغط لتغيير المستند
              </p>
            {:else}
              <div class="w-14 h-14 rounded-2xl bg-gradient-to-br from-accent-gold/15 to-accent-violet/10 border border-accent-gold/20 flex items-center justify-center mx-auto mb-3 group-hover:scale-105 transition-transform">
                <Upload size={24} class="text-accent-gold" />
              </div>
              <p class="text-sm font-medium text-white">اضغط لرفع المستند</p>
              <p class="text-[10px] text-slate-500 mt-1">PNG, JPG, PDF — حد أقصى 5MB</p>
              <div class="flex items-center justify-center gap-3 mt-3 text-[10px] text-slate-500">
                <span class="flex items-center gap-1"><Lock size={9} /> مشفّر</span>
                <span>•</span>
                <span class="flex items-center gap-1"><ShieldCheck size={9} /> آمن</span>
              </div>
            {/if}
          </label>
        </div>

        <!-- Security notice -->
        <div class="panel p-3 bg-accent-gold/5 border-accent-gold/20 flex items-start gap-2.5">
          <div class="w-7 h-7 rounded-lg bg-accent-gold/15 flex items-center justify-center shrink-0">
            <AlertCircle size={14} class="text-accent-gold" />
          </div>
          <div class="flex-1">
            <p class="text-[11px] text-slate-300 leading-relaxed">
              يجب أن يكون المستند <span class="font-bold text-white">واضحاً وغير منتهي الصلاحية</span>.
              سيتم رفض المستندات غير الواضحة. جميع البيانات تُخزّن مشفّرة.
            </p>
          </div>
        </div>

        <!-- Submit button -->
        <button type="submit" disabled={loading} class="btn-primary w-full py-3.5 relative overflow-hidden group">
          {#if loading}
            <Loader2 size={18} class="animate-spin" />
            <span>جارٍ الإرسال...</span>
          {:else}
            <ShieldCheck size={18} />
            <span>إرسال طلب التحقق</span>
          {/if}
        </button>
      </form>
    </div>
  {/if}
</div>
