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
    BookOpen,
    Calendar
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

<div class="space-y-5 relative">
  <!-- Ambient aurora -->
  <div class="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
    <div class="absolute -top-20 right-1/4 w-80 h-80 bg-accent-gold/6 blur-[120px] rounded-full animate-pulse-glow"></div>
    <div class="absolute bottom-0 -left-32 w-80 h-80 bg-accent-violet/5 blur-[120px] rounded-full animate-pulse-glow" style="animation-delay: 2s;"></div>
  </div>

  <!-- Header -->
  <div class="panel p-5 relative overflow-hidden">
    <div class="absolute top-0 inset-x-0 h-px pointer-events-none" style="background: linear-gradient(90deg, transparent, rgba(245, 181, 68, 0.4), transparent);"></div>
    <div class="absolute -top-12 -right-12 w-32 h-32 bg-accent-gold/8 blur-3xl rounded-full"></div>
    <div class="relative flex items-start justify-between gap-4 flex-wrap">
      <div>
        <div class="flex items-center gap-3 mb-1">
          <div class="w-11 h-11 rounded-2xl bg-gradient-to-br from-accent-gold/20 to-accent-violet/10 border border-accent-gold/20 flex items-center justify-center">
            <Key size={22} class="text-accent-gold" />
          </div>
          <div>
            <h1 class="text-xl font-bold text-white tracking-tight">مفاتيح API</h1>
            <p class="text-xs text-slate-400 mt-0.5">وصول برمجي آمن إلى حسابك عبر REST API و WebSocket</p>
          </div>
        </div>
      </div>
      <button onclick={() => (showCreateModal = true)} class="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent-gold text-white text-sm font-semibold hover:bg-accent-gold/90 transition-colors">
        <Plus size={15} /> مفتاح جديد
      </button>
    </div>

    <!-- Quick stats — premium -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
      <div class="bg-ink-900/40 rounded-xl p-3 border border-white/5 relative overflow-hidden group hover:border-white/10 transition-colors">
        <div class="absolute -top-4 -right-4 w-12 h-12 bg-accent-gold/10 blur-2xl rounded-full group-hover:bg-accent-gold/15 transition-all"></div>
        <div class="relative">
          <div class="flex items-center gap-1.5 text-[10px] text-slate-500 mb-1.5">
            <Key size={10} /> إجمالي المفاتيح
          </div>
          <div class="text-lg font-bold text-white font-mono tabular-nums">{keys.length}</div>
        </div>
      </div>
      <div class="bg-ink-900/40 rounded-xl p-3 border border-white/5 relative overflow-hidden group hover:border-white/10 transition-colors">
        <div class="absolute -top-4 -right-4 w-12 h-12 bg-accent-mint/10 blur-2xl rounded-full group-hover:bg-accent-mint/15 transition-all"></div>
        <div class="relative">
          <div class="flex items-center gap-1.5 text-[10px] text-slate-500 mb-1.5">
            <CheckCircle2 size={10} /> نشطة
          </div>
          <div class="text-lg font-bold text-accent-mint font-mono tabular-nums">{keys.filter((k) => k.status === 'active').length}</div>
        </div>
      </div>
      <div class="bg-ink-900/40 rounded-xl p-3 border border-white/5 relative overflow-hidden group hover:border-white/10 transition-colors">
        <div class="absolute -top-4 -right-4 w-12 h-12 bg-accent-azure/10 blur-2xl rounded-full group-hover:bg-accent-azure/15 transition-all"></div>
        <div class="relative">
          <div class="flex items-center gap-1.5 text-[10px] text-slate-500 mb-1.5">
            <Activity size={10} /> طلبات اليوم
          </div>
          <div class="text-lg font-bold text-accent-azure font-mono tabular-nums">{keys.reduce((s, k) => s + k.requestsToday, 0).toLocaleString()}</div>
        </div>
      </div>
      <div class="bg-ink-900/40 rounded-xl p-3 border border-white/5 relative overflow-hidden group hover:border-white/10 transition-colors">
        <div class="absolute -top-4 -right-4 w-12 h-12 bg-accent-rose/10 blur-2xl rounded-full group-hover:bg-accent-rose/15 transition-all"></div>
        <div class="relative">
          <div class="flex items-center gap-1.5 text-[10px] text-slate-500 mb-1.5">
            <AlertTriangle size={10} /> صلاحية سحب
          </div>
          <div class="text-lg font-bold text-accent-rose font-mono tabular-nums">{keys.filter((k) => k.permissions.includes('withdraw') && k.status === 'active').length}</div>
        </div>
      </div>
    </div>
  </div>

  <!-- API keys list -->
  <div class="panel overflow-hidden relative">
    <div class="absolute top-0 inset-x-0 h-px pointer-events-none" style="background: linear-gradient(90deg, transparent, rgba(245, 181, 68, 0.3), transparent);"></div>
    <div class="px-4 py-3 border-b border-white/5 flex items-center gap-2">
      <div class="w-7 h-7 rounded-lg bg-accent-gold/10 border border-accent-gold/20 flex items-center justify-center">
        <Key size={14} class="text-accent-gold" />
      </div>
      <h2 class="text-sm font-semibold text-white">مفاتيحك</h2>
      <span class="text-xs text-slate-500 mr-auto">{keys.length} مفتاح</span>
    </div>
    <div class="divide-y divide-white/5">
      {#each keys as k}
        <div class="p-4 hover:bg-white/[0.02] transition-colors group">
          <div class="flex items-start justify-between gap-4 flex-wrap mb-3">
            <div class="flex-1 min-w-[200px]">
              <div class="flex items-center gap-2 mb-1.5 flex-wrap">
                <h3 class="font-semibold text-white">{k.name}</h3>
                <span class="pill {k.status === 'active' ? 'pill-mint' : 'pill-rose'} text-[10px]">
                  {#if k.status === 'active'}
                    <span class="w-1.5 h-1.5 rounded-full bg-accent-mint animate-pulse"></span>
                  {/if}
                  {k.status === 'active' ? 'نشط' : 'معطّل'}
                </span>
                {#each k.permissions as p}
                  <span class="pill {p === 'withdraw' ? 'pill-rose' : p === 'trade' ? 'pill-gold' : 'pill-mint'} text-[10px]">{permLabel(p)}</span>
                {/each}
              </div>
              <div class="flex items-center gap-2 text-xs font-mono text-slate-400 bg-ink-900/40 rounded-lg px-3 py-2 border border-white/5">
                <span class="text-slate-500 font-sans text-[10px]">KEY:</span>
                <span class="text-accent-gold">{k.key}</span>
                <button onclick={() => copyToClipboard(k.key)} class="p-1 text-slate-500 hover:text-white hover:bg-white/5 rounded transition-colors" aria-label="نسخ">
                  <Copy size={11} />
                </button>
              </div>
              {#if showSecrets[k.id]}
                <div class="flex items-center gap-2 text-xs font-mono text-slate-400 bg-accent-rose/5 border border-accent-rose/15 rounded-lg px-3 py-2 mt-1.5">
                  <span class="text-slate-500 font-sans text-[10px]">SECRET:</span>
                  <span class="text-accent-rose">{k.secret}</span>
                  <button onclick={() => copyToClipboard(k.secret)} class="p-1 text-slate-500 hover:text-white hover:bg-white/5 rounded transition-colors" aria-label="نسخ">
                    <Copy size={11} />
                  </button>
                  <span class="text-[10px] text-accent-rose mr-auto font-sans flex items-center gap-1">
                    <AlertTriangle size={10} /> احفظه الآن — لن يظهر مرة أخرى
                  </span>
                </div>
              {/if}
              <div class="text-[10px] text-slate-500 mt-2 flex items-center gap-3 flex-wrap">
                <span class="flex items-center gap-1"><Calendar size={9} /> أُنشئ: {timeAgoStr(k.createdAt)}</span>
                <span class="flex items-center gap-1"><Activity size={9} /> آخر استخدام: {timeAgoStr(k.lastUsed)}</span>
                {#if k.ipWhitelist.length > 0}
                  <span class="flex items-center gap-1 text-accent-mint"><Lock size={9} /> IP: {k.ipWhitelist.join(', ')}</span>
                {:else}
                  <span class="flex items-center gap-1 text-accent-rose"><AlertTriangle size={9} /> IP: أي عنوان</span>
                {/if}
              </div>
            </div>

            <!-- Usage bar — premium -->
            <div class="shrink-0 text-right">
              <div class="text-[10px] text-slate-500 mb-1 flex items-center justify-end gap-1">
                <Activity size={9} /> استخدام اليوم
              </div>
              <div class="text-sm font-mono font-bold text-white tabular-nums">
                {k.requestsToday.toLocaleString()} <span class="text-slate-500">/ {k.rateLimit.toLocaleString()}</span>
              </div>
              <div class="w-32 h-1.5 bg-ink-900 rounded-full overflow-hidden mt-1 border border-white/5">
                <div
                  class="h-full transition-all duration-500 {k.requestsToday / k.rateLimit > 0.8 ? 'bg-gradient-to-r from-accent-rose to-accent-rose' : 'bg-gradient-to-r from-accent-gold to-accent-mint'}"
                  style="width: {Math.min(100, (k.requestsToday / k.rateLimit) * 100)}%"
                ></div>
              </div>
              <p class="text-[9px] text-slate-600 mt-0.5 tabular-nums">{((k.requestsToday / k.rateLimit) * 100).toFixed(1)}%</p>
            </div>

            <!-- Actions -->
            <div class="flex items-center gap-1 shrink-0">
              <button onclick={() => toggleSecret(k.id)} class="p-2 rounded-lg text-slate-400 hover:bg-white/5 hover:text-white transition-colors" title="إظهار/إخفاء السر">
                {#if showSecrets[k.id]}<EyeOff size={14} />{:else}<Eye size={14} />{/if}
              </button>
              <button onclick={() => toggleStatus(k.id)} class="p-2 rounded-lg text-slate-400 hover:bg-white/5 hover:text-white transition-colors" title="تفعيل/تعطيل">
                <Power size={14} />
              </button>
              <button onclick={() => revokeKey(k.id)} class="p-2 rounded-lg text-slate-400 hover:bg-accent-rose/10 hover:text-accent-rose transition-colors" title="حذف">
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        </div>
      {/each}
      {#if keys.length === 0}
        <div class="py-16 text-center">
          <div class="relative inline-block mb-4">
            <div class="absolute inset-0 bg-accent-gold/10 blur-3xl rounded-full"></div>
            <Key size={48} class="relative text-slate-600 mx-auto" />
          </div>
          <p class="text-sm font-medium text-slate-300">لا توجد مفاتيح API</p>
          <p class="text-xs text-slate-500 mt-1">أنشئ مفتاحك الأول للوصول البرمجي</p>
          <button onclick={() => (showCreateModal = true)} class="btn-primary text-xs mt-4">
            <Plus size={14} /> إنشاء مفتاح
          </button>
        </div>
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
