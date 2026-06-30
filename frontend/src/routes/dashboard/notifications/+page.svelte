<script lang="ts">
  import { onMount } from 'svelte';
  import { notifications as notifApi } from '$lib/api/endpoints';
  import { parseApiResponse } from '$lib/api/client';
  import { toasts } from '$lib/stores/toast';
  import { timeAgo } from '$lib/utils/format';
  import NavTabs from '$lib/components/NavTabs.svelte';
  import {
    Bell, Check, CheckCheck, Zap, Ban, Banknote, SendHorizonal,
    ShieldCheck, AlertTriangle, X, Filter, BellOff, Trash2, Clock
  } from 'lucide-svelte';

  let notifications = $state<any[]>([]);
  let loading = $state(true);
  let tab = $state<'all' | 'unread' | 'trading' | 'wallet' | 'security'>('all');

  onMount(() => {
    (async () => {
      await loadNotifications();
      loading = false;
    })();
  });

  async function loadNotifications() {
    try {
      const params: any = { limit: 50 };
      if (tab === 'unread') params.unread_only = true;
      const res = await notifApi.getList(params);
      notifications = (await parseApiResponse<any[]>(res)) || [];
    } catch {}
  }

  const filtered = $derived.by(() => {
    if (tab === 'all' || tab === 'unread') return notifications;
    if (tab === 'trading') return notifications.filter((n) => n.type?.startsWith('ORDER'));
    if (tab === 'wallet') return notifications.filter((n) => n.type?.startsWith('DEPOSIT') || n.type?.startsWith('WITHDRAWAL'));
    if (tab === 'security') return notifications.filter((n) => n.type?.startsWith('KYC'));
    return notifications;
  });

  const unreadCount = $derived(notifications.filter((n) => !n.read).length);
  const tradingCount = $derived(notifications.filter((n) => n.type?.startsWith('ORDER')).length);
  const walletCount = $derived(notifications.filter((n) => n.type?.startsWith('DEPOSIT') || n.type?.startsWith('WITHDRAWAL')).length);
  const securityCount = $derived(notifications.filter((n) => n.type?.startsWith('KYC')).length);

  async function markRead(id: number) {
    try {
      await notifApi.markRead(id);
      notifications = notifications.map((n) => (n.id === id ? { ...n, read: true } : n));
    } catch {}
  }

  async function markAllRead() {
    try {
      await notifApi.markAllRead();
      notifications = notifications.map((n) => ({ ...n, read: true }));
      toasts.success('تم تعليم الكل كمقروء');
    } catch {}
  }

  function getNotifIcon(type: string) {
    const map: Record<string, { icon: typeof Bell; bg: string; fg: string; border: string }> = {
      ORDER_FILLED: { icon: Check, bg: 'bg-accent-mint/15', fg: 'text-accent-mint', border: 'border-accent-mint/20' },
      ORDER_CANCELLED: { icon: Ban, bg: 'bg-accent-rose/15', fg: 'text-accent-rose', border: 'border-accent-rose/20' },
      ORDER_TRIGGERED: { icon: Zap, bg: 'bg-accent-gold/15', fg: 'text-accent-gold', border: 'border-accent-gold/20' },
      DEPOSIT_APPROVED: { icon: Banknote, bg: 'bg-accent-mint/15', fg: 'text-accent-mint', border: 'border-accent-mint/20' },
      WITHDRAWAL_APPROVED: { icon: SendHorizonal, bg: 'bg-accent-azure/15', fg: 'text-accent-azure', border: 'border-accent-azure/20' },
      WITHDRAWAL_REJECTED: { icon: AlertTriangle, bg: 'bg-accent-rose/15', fg: 'text-accent-rose', border: 'border-accent-rose/20' },
      KYC_APPROVED: { icon: ShieldCheck, bg: 'bg-accent-mint/15', fg: 'text-accent-mint', border: 'border-accent-mint/20' },
      KYC_REJECTED: { icon: AlertTriangle, bg: 'bg-accent-rose/15', fg: 'text-accent-rose', border: 'border-accent-rose/20' }
    };
    return map[type] || { icon: Bell, bg: 'bg-white/5', fg: 'text-slate-300', border: 'border-white/10' };
  }

  $effect(() => {
    loadNotifications();
  });
</script>

<svelte:head><title>الإشعارات — NEXUS</title></svelte:head>

<div class="max-w-3xl mx-auto space-y-5 relative">
  <!-- Ambient aurora -->
  <div class="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
    <div class="absolute -top-20 right-1/4 w-80 h-80 bg-accent-gold/6 blur-[120px] rounded-full animate-pulse-glow"></div>
    <div class="absolute bottom-0 -left-32 w-80 h-80 bg-accent-violet/5 blur-[120px] rounded-full animate-pulse-glow" style="animation-delay: 2s;"></div>
  </div>

  <!-- Header -->
  <div class="relative flex items-center justify-between">
    <div>
      <div class="flex items-center gap-2.5 mb-1">
        <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-accent-gold/15 to-accent-violet/10 border border-accent-gold/20 flex items-center justify-center">
          <Bell size={18} class="text-accent-gold" />
        </div>
        <div>
          <h1 class="text-2xl sm:text-3xl font-bold text-white tracking-tight">الإشعارات</h1>
          <p class="text-xs text-slate-400 mt-0.5">كل تنبيهات حسابك في مكان واحد</p>
        </div>
      </div>
    </div>
    {#if unreadCount > 0}
      <button onclick={markAllRead} class="btn-ghost text-xs flex items-center gap-1.5">
        <CheckCheck size={14} /> تعليم الكل كمقروء
        <span class="pill-gold text-[9px] px-1.5 py-0 ml-1">{unreadCount}</span>
      </button>
    {/if}
  </div>

  <!-- Nav tabs with counts -->
  <NavTabs
    value={tab}
    onchange={(key) => (tab = key as any)}
    items={[
      { key: 'all', label: 'الكل', icon: Bell, count: notifications.length },
      { key: 'unread', label: 'غير مقروءة', icon: Filter, count: unreadCount },
      { key: 'trading', label: 'التداول', icon: Zap, count: tradingCount },
      { key: 'wallet', label: 'المحفظة', icon: Banknote, count: walletCount },
      { key: 'security', label: 'الأمان', icon: ShieldCheck, count: securityCount }
    ]}
  />

  <!-- Notifications list -->
  <div class="panel overflow-hidden relative">
    <div class="absolute top-0 inset-x-0 h-px pointer-events-none" style="background: linear-gradient(90deg, transparent, rgba(245, 181, 68, 0.3), transparent);"></div>
    {#if loading}
      <div class="p-4 space-y-3">
        {#each Array(5) as _}<div class="h-16 rounded-xl bg-white/5 animate-shimmer"></div>{/each}
      </div>
    {:else if filtered.length === 0}
      <!-- Premium empty state -->
      <div class="py-20 text-center relative">
        <div class="relative inline-block mb-5">
          <div class="absolute inset-0 bg-accent-gold/10 blur-3xl rounded-full animate-pulse-glow"></div>
          <div class="relative w-20 h-20 rounded-3xl bg-gradient-to-br from-accent-gold/10 to-accent-violet/5 border border-accent-gold/15 flex items-center justify-center">
            {#if tab === 'unread'}
              <CheckCheck size={36} class="text-accent-mint" />
            {:else if tab === 'trading'}
              <Zap size={36} class="text-accent-gold opacity-50" />
            {:else if tab === 'wallet'}
              <Banknote size={36} class="text-accent-azure opacity-50" />
            {:else if tab === 'security'}
              <ShieldCheck size={36} class="text-accent-mint opacity-50" />
            {:else}
              <BellOff size={36} class="text-slate-600" />
            {/if}
          </div>
        </div>
        <p class="text-sm font-semibold text-white">
          {#if tab === 'unread'}
            كل الإشعارات مقروءة
          {:else if tab === 'trading'}
            لا توجد إشعارات تداول
          {:else if tab === 'wallet'}
            لا توجد إشعارات محفظة
          {:else if tab === 'security'}
            لا توجد إشعارات أمان
          {:else}
            لا توجد إشعارات بعد
          {/if}
        </p>
        <p class="text-xs text-slate-500 mt-1.5 max-w-xs mx-auto">
          {#if tab === 'unread'}
            أحسنت! لقد قرأت كل تنبيهاتك. ستظهر الإشعارات الجديدة هنا فور وصولها.
          {:else}
            ستظهر هنا التنبيهات المتعلقة بهذا القسم فور حدوثها. تأكد من تفعيل الإشعارات في إعدادات المتصفح.
          {/if}
        </p>
      </div>
    {:else}
      <div class="divide-y divide-white/5">
        {#each filtered as n}
          {@const ic = getNotifIcon(n.type)}
          <div class="group flex items-start gap-3 px-5 py-4 hover:bg-white/[0.02] transition-colors relative {!n.read ? 'bg-accent-gold/[0.03]' : ''}">
            {#if !n.read}
              <div class="absolute right-0 top-0 bottom-0 w-0.5 bg-gradient-to-b from-accent-gold to-accent-rose"></div>
            {/if}
            <div class="relative w-10 h-10 rounded-xl {ic.bg} {ic.border} border flex items-center justify-center shrink-0">
              <ic.icon size={16} class={ic.fg} />
              {#if !n.read}
                <span class="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-accent-gold border-2 border-ink-900"></span>
              {/if}
            </div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 flex-wrap">
                <p class="text-sm font-semibold text-white">{n.title}</p>
                {#if !n.read}
                  <span class="text-[9px] px-1.5 py-0.5 rounded-full bg-accent-gold/15 text-accent-gold font-bold uppercase tracking-wider">جديد</span>
                {/if}
              </div>
              <p class="text-xs text-slate-400 mt-1 leading-relaxed">{n.body}</p>
              <div class="flex items-center gap-2 mt-1.5">
                <p class="text-[10px] text-slate-500 flex items-center gap-1">
                  <Clock size={9} />
                  {timeAgo(n.created_at)}
                </p>
              </div>
            </div>
            {#if !n.read}
              <button
                onclick={() => markRead(n.id)}
                class="p-1.5 rounded-lg text-slate-400 hover:bg-accent-mint/10 hover:text-accent-mint shrink-0 transition-colors opacity-0 group-hover:opacity-100"
                aria-label="تعليم كمقروء"
                title="تعليم كمقروء"
              >
                <Check size={14} />
              </button>
            {/if}
          </div>
        {/each}
      </div>

      <!-- Footer -->
      {#if filtered.length > 0}
        <div class="px-5 py-3 border-t border-white/5 flex items-center justify-between text-xs">
          <span class="text-slate-500">{filtered.length} إشعار</span>
          {#if unreadCount > 0}
            <button onclick={markAllRead} class="text-accent-gold hover:underline flex items-center gap-1">
              <CheckCheck size={11} /> تعليم الكل كمقروء
            </button>
          {/if}
        </div>
      {/if}
    {/if}
  </div>
</div>
