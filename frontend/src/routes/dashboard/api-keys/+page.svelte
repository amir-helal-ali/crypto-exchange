<script lang="ts">
  /**
   * NEXUS API Keys — manage API keys for programmatic trading.
   * List existing keys, create new ones with permissions, revoke, view usage.
   */
  import { onMount } from 'svelte';
  import { toasts } from '$lib/stores/toast';
  import {
    Key,
    Plus,
    Copy,
    Trash2,
    Eye,
    EyeOff,
    Shield,
    Activity,
    CheckCircle2,
    AlertTriangle,
    Code,
    Power,
    Lock,
    Webhook,
    BookOpen
  } from 'lucide-svelte';

  interface ApiKey {
    id: number;
    name: string;
    key: string;
    secret: string;
    permissions: string[];
    ipWhitelist: string[];
    createdAt: string;
    lastUsed: string | null;
    status: 'active' | 'disabled';
    rateLimit: number;
    requestsToday: number;
  }

  let keys = $state<ApiKey[]>([]);
  let showCreateModal = $state(false);
  let showSecrets: Record<number, boolean> = $state({});
  let newName = $state('');
  let newPerms = $state<string[]>(['read']);
  let newIp = $state('');

  const availablePerms = [
    { k: 'read', l: 'قراءة (Read)', desc: 'عرض الأرصدة، الأسعار، السجل' },
    { k: 'trade', l: 'تداول (Trade)', desc: 'إنشاء وإلغاء الأوامر' },
    { k: 'withdraw', l: 'سحب (Withdraw)', desc: 'سحب الأصول — يتطلب IP محدد' }
  ];

  onMount(() => {
    // Seed with mock keys
    keys = [
      {
        id: 1,
        name: 'Trading Bot — Production',
        key: 'nexus_prod_4f8a9b2c3d1e7f6a',
        secret: '••••••••••••••••••••••••••••••••',
        permissions: ['read', 'trade'],
        ipWhitelist: ['156.218.45.10'],
        createdAt: new Date(Date.now() - 86400000 * 30).toISOString(),
        lastUsed: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
        status: 'active',
        rateLimit: 1200,
        requestsToday: 4350
      },
      {
        id: 2,
        name: 'Analytics Dashboard',
        key: 'nexus_read_8h3k2j9l1m4n5p7q',
        secret: '••••••••••••••••••••••••••••••••',
        permissions: ['read'],
        ipWhitelist: [],
        createdAt: new Date(Date.now() - 86400000 * 90).toISOString(),
        lastUsed: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
        status: 'active',
        rateLimit: 600,
        requestsToday: 890
      },
      {
        id: 3,
        name: 'Legacy Bot — Deprecated',
        key: 'nexus_legacy_2b3c4d5e6f7g8h9i',
        secret: '••••••••••••••••••••••••••••••••',
        permissions: ['read', 'trade', 'withdraw'],
        ipWhitelist: ['192.168.1.1'],
        createdAt: new Date(Date.now() - 86400000 * 180).toISOString(),
        lastUsed: new Date(Date.now() - 86400000 * 45).toISOString(),
        status: 'disabled',
        rateLimit: 1200,
        requestsToday: 0
      }
    ];
  });

  function generateKey(prefix: string): string {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let out = `nexus_${prefix}_`;
    for (let i = 0; i < 16; i++) out += chars[Math.floor(Math.random() * chars.length)];
    return out;
  }

  function togglePerm(k: string) {
    if (newPerms.includes(k)) {
      newPerms = newPerms.filter((p) => p !== k);
    } else {
      newPerms = [...newPerms, k];
    }
  }

  function createKey() {
    if (!newName.trim()) {
      toasts.error('أدخل اسم المفتاح');
      return;
    }
    if (newPerms.length === 0) {
      toasts.error('اختر صلاحية واحدة على الأقل');
      return;
    }
    const prefix = newPerms.includes('withdraw') ? 'full' : newPerms.includes('trade') ? 'trade' : 'read';
    const newKey: ApiKey = {
      id: Date.now(),
      name: newName,
      key: generateKey(prefix),
      secret: generateKey('sec'),
      permissions: newPerms,
      ipWhitelist: newIp ? [newIp] : [],
      createdAt: new Date().toISOString(),
      lastUsed: null,
      status: 'active',
      rateLimit: newPerms.includes('withdraw') ? 600 : 1200,
      requestsToday: 0
    };
    keys = [newKey, ...keys];
    showSecrets[newKey.id] = true;
    toasts.success('تم إنشاء المفتاح. احفظ السر الآن — لن يظهر مرة أخرى.');
    newName = '';
    newPerms = ['read'];
    newIp = '';
    showCreateModal = false;
  }

  function toggleStatus(id: number) {
    keys = keys.map((k) =>
      k.id === id ? { ...k, status: k.status === 'active' ? 'disabled' : 'active' } : k
    );
    toasts.info('تم تحديث حالة المفتاح');
  }

  function revokeKey(id: number) {
    if (!confirm('هل أنت متأكد؟ سيتم حذف المفتاح نهائياً.')) return;
    keys = keys.filter((k) => k.id !== id);
    toasts.success('تم حذف المفتاح');
  }

  function copyToClipboard(text: string) {
    navigator.clipboard?.writeText(text);
    toasts.success('تم النسخ');
  }

  function toggleSecret(id: number) {
    showSecrets = { ...showSecrets, [id]: !showSecrets[id] };
  }

  function permLabel(p: string): string {
    return availablePerms.find((x) => x.k === p)?.l || p;
  }

  function timeAgoStr(iso: string | null): string {
    if (!iso) return 'لم يُستخدم';
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'الآن';
    if (m < 60) return `منذ ${m} دقيقة`;
    const h = Math.floor(m / 60);
    if (h < 24) return `منذ ${h} ساعة`;
    const d = Math.floor(h / 24);
    return `منذ ${d} يوم`;
  }
</script>

<svelte:head><title>مفاتيح API — NEXUS</title></svelte:head>

<div class="space-y-4">
  <!-- Header -->
  <div class="panel p-5">
    <div class="flex items-start justify-between gap-4 flex-wrap">
      <div>
        <div class="flex items-center gap-2 mb-1">
          <Key size={22} class="text-accent-gold" />
          <h1 class="text-xl font-bold text-white">مفاتيح API</h1>
        </div>
        <p class="text-sm text-slate-400">أنشئ مفاتيح API للوصول البرمجي إلى حسابك عبر REST API و WebSocket. استخدم المفاتيح بحذر وأبقِ السر آمناً.</p>
      </div>
      <button onclick={() => (showCreateModal = true)} class="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent-gold text-white text-sm font-semibold hover:bg-accent-gold/90 transition-colors">
        <Plus size={15} /> مفتاح جديد
      </button>
    </div>

    <!-- Quick stats -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
      <div class="bg-ink-900/50 rounded-lg p-3 border border-white/5">
        <div class="flex items-center gap-1.5 text-[10px] text-slate-500 mb-1"><Key size={10} /> إجمالي المفاتيح</div>
        <div class="text-lg font-bold text-white font-mono">{keys.length}</div>
      </div>
      <div class="bg-ink-900/50 rounded-lg p-3 border border-white/5">
        <div class="flex items-center gap-1.5 text-[10px] text-slate-500 mb-1"><CheckCircle2 size={10} /> نشطة</div>
        <div class="text-lg font-bold text-accent-mint font-mono">{keys.filter((k) => k.status === 'active').length}</div>
      </div>
      <div class="bg-ink-900/50 rounded-lg p-3 border border-white/5">
        <div class="flex items-center gap-1.5 text-[10px] text-slate-500 mb-1"><Activity size={10} /> طلبات اليوم</div>
        <div class="text-lg font-bold text-accent-gold font-mono">{keys.reduce((s, k) => s + k.requestsToday, 0).toLocaleString()}</div>
      </div>
      <div class="bg-ink-900/50 rounded-lg p-3 border border-white/5">
        <div class="flex items-center gap-1.5 text-[10px] text-slate-500 mb-1"><AlertTriangle size={10} /> صلاحية سحب</div>
        <div class="text-lg font-bold text-accent-rose font-mono">{keys.filter((k) => k.permissions.includes('withdraw') && k.status === 'active').length}</div>
      </div>
    </div>
  </div>

  <!-- API keys list -->
  <div class="panel overflow-hidden">
    <div class="px-4 py-3 border-b border-white/5">
      <h2 class="text-sm font-semibold text-white">مفاتيحك</h2>
    </div>
    <div class="divide-y divide-white/5">
      {#each keys as k}
        <div class="p-4 hover:bg-white/[0.02] transition-colors">
          <div class="flex items-start justify-between gap-4 flex-wrap mb-3">
            <div class="flex-1 min-w-[200px]">
              <div class="flex items-center gap-2 mb-1">
                <h3 class="font-semibold text-white">{k.name}</h3>
                <span class="pill {k.status === 'active' ? 'pill-mint' : 'pill-rose'}">
                  {k.status === 'active' ? 'نشط' : 'معطّل'}
                </span>
                {#each k.permissions as p}
                  <span class="pill {p === 'withdraw' ? 'pill-rose' : p === 'trade' ? 'pill-gold' : 'pill-mint'}">{permLabel(p)}</span>
                {/each}
              </div>
              <div class="flex items-center gap-2 text-xs font-mono text-slate-400 bg-ink-900/40 rounded px-2 py-1">
                <span class="text-slate-500">KEY:</span>
                <span class="text-accent-gold">{k.key}</span>
                <button onclick={() => copyToClipboard(k.key)} class="p-0.5 text-slate-500 hover:text-white" aria-label="نسخ">
                  <Copy size={11} />
                </button>
              </div>
              {#if showSecrets[k.id]}
                <div class="flex items-center gap-2 text-xs font-mono text-slate-400 bg-accent-rose/5 rounded px-2 py-1 mt-1">
                  <span class="text-slate-500">SECRET:</span>
                  <span class="text-accent-rose">{k.secret}</span>
                  <button onclick={() => copyToClipboard(k.secret)} class="p-0.5 text-slate-500 hover:text-white" aria-label="نسخ">
                    <Copy size={11} />
                  </button>
                  <span class="text-[10px] text-accent-rose mr-auto">احفظه الآن — لن يظهر مرة أخرى</span>
                </div>
              {/if}
              <div class="text-[10px] text-slate-500 mt-2 flex items-center gap-3 flex-wrap">
                <span>أُنشئ: {timeAgoStr(k.createdAt)}</span>
                <span>آخر استخدام: {timeAgoStr(k.lastUsed)}</span>
                {#if k.ipWhitelist.length > 0}
                  <span>IP: {k.ipWhitelist.join(', ')}</span>
                {:else}
                  <span class="text-accent-rose">IP: أي عنوان ⚠</span>
                {/if}
              </div>
            </div>

            <!-- Usage bar -->
            <div class="shrink-0 text-right">
              <div class="text-[10px] text-slate-500 mb-1">استخدام اليوم</div>
              <div class="text-sm font-mono font-semibold text-white">{k.requestsToday.toLocaleString()} / {k.rateLimit.toLocaleString()}</div>
              <div class="w-32 h-1.5 bg-ink-900 rounded-full overflow-hidden mt-1">
                <div class="h-full {k.requestsToday / k.rateLimit > 0.8 ? 'bg-accent-rose' : 'bg-accent-gold'}" style="width: {Math.min(100, (k.requestsToday / k.rateLimit) * 100)}%"></div>
              </div>
            </div>

            <!-- Actions -->
            <div class="flex items-center gap-1 shrink-0">
              <button onclick={() => toggleSecret(k.id)} class="p-1.5 rounded-md text-slate-400 hover:bg-white/5 hover:text-white" title="إظهار/إخفاء السر">
                {#if showSecrets[k.id]}<EyeOff size={14} />{:else}<Eye size={14} />{/if}
              </button>
              <button onclick={() => toggleStatus(k.id)} class="p-1.5 rounded-md text-slate-400 hover:bg-white/5 hover:text-white" title="تفعيل/تعطيل">
                <Power size={14} />
              </button>
              <button onclick={() => revokeKey(k.id)} class="p-1.5 rounded-md text-slate-400 hover:bg-accent-rose/10 hover:text-accent-rose" title="حذف">
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        </div>
      {/each}
      {#if keys.length === 0}
        <div class="py-10 text-center text-slate-500 text-sm">لا توجد مفاتيح API. أنشئ مفتاحك الأول.</div>
      {/if}
    </div>
  </div>

  <!-- Documentation section -->
  <div class="panel p-5">
    <div class="flex items-center gap-2 mb-3">
      <BookOpen size={16} class="text-accent-gold" />
      <h2 class="text-sm font-semibold text-white">التوثيق السريع</h2>
    </div>
    <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
      <div class="bg-ink-900/40 rounded-lg p-3 border border-white/5">
        <div class="flex items-center gap-1.5 text-xs text-slate-300 mb-2 font-semibold">
          <Code size={12} class="text-accent-mint" /> REST API
        </div>
        <pre class="text-[10px] font-mono text-slate-400 overflow-x-auto">curl -X GET https://api.nexus.exchange/v1/account \
  -H "X-NEXUS-KEY: nexus_xxx" \
  -H "X-NEXUS-SIGN: &lt;hmac-sha256&gt;" \
  -H "X-NEXUS-TIMESTAMP: &lt;ms&gt;"</pre>
      </div>
      <div class="bg-ink-900/40 rounded-lg p-3 border border-white/5">
        <div class="flex items-center gap-1.5 text-xs text-slate-300 mb-2 font-semibold">
          <Webhook size={12} class="text-accent-mint" /> WebSocket
        </div>
        <pre class="text-[10px] font-mono text-slate-400 overflow-x-auto">wss://stream.nexus.exchange/ws/user
  → account.update
  → order.update
  → trade.execution
  → position.update</pre>
      </div>
    </div>

    <!-- Security tips -->
    <div class="mt-4 bg-accent-rose/5 border border-accent-rose/20 rounded-lg p-3">
      <div class="flex items-center gap-1.5 text-xs text-accent-rose font-semibold mb-2">
        <Shield size={12} /> نصائح أمنية هامة
      </div>
      <ul class="text-[11px] text-slate-300 space-y-1">
        <li class="flex items-start gap-1.5"><Lock size={10} class="text-accent-rose mt-0.5 shrink-0" /> لا تشارك سر المفتاح (Secret) مع أي شخص أو مخزن عام.</li>
        <li class="flex items-start gap-1.5"><Lock size={10} class="text-accent-rose mt-0.5 shrink-0" /> استخدم قائمة IP المحددة دائماً لمفاتيح السحب.</li>
        <li class="flex items-start gap-1.5"><Lock size={10} class="text-accent-rose mt-0.5 shrink-0" /> فعّل 2FA على حسابك قبل إنشاء أي مفتاح.</li>
        <li class="flex items-start gap-1.5"><Lock size={10} class="text-accent-rose mt-0.5 shrink-0" /> راجع المفاتيح دورياً واحذف غير المستخدمة.</li>
      </ul>
    </div>
  </div>
</div>

<!-- Create modal -->
{#if showCreateModal}
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onclick={() => (showCreateModal = false)}>
    <div class="panel-glow w-full max-w-md p-5" onclick={(e) => e.stopPropagation()}>
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-base font-semibold text-white flex items-center gap-2">
          <Key size={16} class="text-accent-gold" /> مفتاح API جديد
        </h3>
        <button onclick={() => (showCreateModal = false)} class="text-slate-400 hover:text-white">×</button>
      </div>

      <div class="space-y-3">
        <div>
          <label class="text-xs text-slate-400 block mb-1">اسم المفتاح</label>
          <input bind:value={newName} placeholder="مثال: Trading Bot" class="w-full bg-ink-900/50 border border-white/5 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent-gold/40" />
        </div>

        <div>
          <label class="text-xs text-slate-400 block mb-1.5">الصلاحيات</label>
          <div class="space-y-1.5">
            {#each availablePerms as p}
              <button
                onclick={() => togglePerm(p.k)}
                class="w-full flex items-start gap-2 p-2 rounded-md text-right transition-colors {newPerms.includes(p.k) ? 'bg-accent-gold/10 border border-accent-gold/30' : 'bg-ink-900/30 border border-white/5 hover:bg-white/5'}"
              >
                <div class="w-4 h-4 rounded border-2 {newPerms.includes(p.k) ? 'border-accent-gold bg-accent-gold' : 'border-slate-500'} flex items-center justify-center shrink-0 mt-0.5">
                  {#if newPerms.includes(p.k)}
                    <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-6" stroke="#050813" stroke-width="2" fill="none" /></svg>
                  {/if}
                </div>
                <div class="flex-1">
                  <div class="text-xs font-semibold text-white">{p.l}</div>
                  <div class="text-[10px] text-slate-500">{p.desc}</div>
                </div>
              </button>
            {/each}
          </div>
        </div>

        <div>
          <label class="text-xs text-slate-400 block mb-1">قائمة IP (اختياري، موصى به للسحب)</label>
          <input bind:value={newIp} placeholder="0.0.0.0" class="w-full bg-ink-900/50 border border-white/5 rounded-lg px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-accent-gold/40" />
        </div>

        {#if newPerms.includes('withdraw') && !newIp}
          <div class="bg-accent-rose/10 border border-accent-rose/30 rounded-md p-2 text-[11px] text-accent-rose flex items-start gap-1.5">
            <AlertTriangle size={11} class="mt-0.5 shrink-0" />
            <span>صلاحية السحب بدون قيود IP خطيرة. نوصي بإضافة IP محدد.</span>
          </div>
        {/if}

        <div class="flex gap-2 pt-2">
          <button onclick={() => (showCreateModal = false)} class="flex-1 py-2 rounded-lg bg-white/5 text-slate-300 text-sm hover:bg-white/10">إلغاء</button>
          <button onclick={createKey} class="flex-1 py-2 rounded-lg bg-accent-gold text-white text-sm font-semibold hover:bg-accent-gold/90">إنشاء المفتاح</button>
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  :global([data-theme='light']) .text-slate-500 {
    color: #94a3b8 !important;
  }
  :global([data-theme='light']) .text-slate-400 {
    color: #64748b !important;
  }
  :global([data-theme='light']) .text-slate-300 {
    color: #475569 !important;
  }
  :global([data-theme='light']) .text-white {
    color: #0f172a !important;
  }
  :global([data-theme='light']) .bg-white\/5,
  :global([data-theme='light']) .bg-white\/10 {
    background-color: rgba(15, 23, 42, 0.05) !important;
  }
  :global([data-theme='light']) .bg-ink-900\/40,
  :global([data-theme='light']) .bg-ink-900\/50,
  :global([data-theme='light']) .bg-ink-900\/30 {
    background-color: rgba(15, 23, 42, 0.03) !important;
  }
  :global([data-theme='light']) .border-white\/5 {
    border-color: rgba(15, 23, 42, 0.08) !important;
  }
  :global([data-theme='light']) .divide-white\/5 > * {
    border-color: rgba(15, 23, 42, 0.08) !important;
  }
</style>
