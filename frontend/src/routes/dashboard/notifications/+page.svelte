<script lang="ts">
  import { onMount } from 'svelte';
  import { notifications as notifApi } from '$lib/api/endpoints';
  import { parseApiResponse } from '$lib/api/client';
  import { toasts } from '$lib/stores/toast';
  import { timeAgo } from '$lib/utils/format';
  import NavTabs from '$lib/components/NavTabs.svelte';
  import {
    Bell, Check, CheckCheck, Zap, Ban, Banknote, SendHorizonal,
    ShieldCheck, AlertTriangle, X, Filter
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

  // Filter by category when on a category tab
  const filtered = $derived.by(() => {
    if (tab === 'all' || tab === 'unread') return notifications;
    if (tab === 'trading') return notifications.filter((n) => n.type?.startsWith('ORDER'));
    if (tab === 'wallet') return notifications.filter((n) => n.type?.startsWith('DEPOSIT') || n.type?.startsWith('WITHDRAWAL'));
    if (tab === 'security') return notifications.filter((n) => n.type?.startsWith('KYC'));
    return notifications;
  });

  const unreadCount = $derived(notifications.filter((n) => !n.read).length);

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
    const map: Record<string, { icon: typeof Bell; bg: string; fg: string }> = {
      ORDER_FILLED: { icon: Check, bg: 'bg-accent-mint/15', fg: 'text-accent-mint' },
      ORDER_CANCELLED: { icon: Ban, bg: 'bg-accent-rose/15', fg: 'text-accent-rose' },
      ORDER_TRIGGERED: { icon: Zap, bg: 'bg-accent-gold/15', fg: 'text-accent-gold' },
      DEPOSIT_APPROVED: { icon: Banknote, bg: 'bg-accent-mint/15', fg: 'text-accent-mint' },
      WITHDRAWAL_APPROVED: { icon: SendHorizonal, bg: 'bg-accent-azure/15', fg: 'text-accent-azure' },
      WITHDRAWAL_REJECTED: { icon: AlertTriangle, bg: 'bg-accent-rose/15', fg: 'text-accent-rose' },
      KYC_APPROVED: { icon: ShieldCheck, bg: 'bg-accent-mint/15', fg: 'text-accent-mint' },
      KYC_REJECTED: { icon: AlertTriangle, bg: 'bg-accent-rose/15', fg: 'text-accent-rose' }
    };
    return map[type] || { icon: Bell, bg: 'bg-white/5', fg: 'text-slate-300' };
  }

  $effect(() => {
    loadNotifications();
  });
</script>

<svelte:head><title>الإشعارات — NEXUS</title></svelte:head>

<div class="max-w-3xl mx-auto space-y-5">
  <div class="flex items-center justify-between">
    <div>
      <h1 class="text-2xl sm:text-3xl font-bold text-white">الإشعارات</h1>
      <p class="text-sm text-slate-400 mt-1">كل تنبيهات حسابك في مكان واحد</p>
    </div>
    <button onclick={markAllRead} class="btn-ghost text-xs">
      <CheckCheck size={14} /> تعليم الكل كمقروء
    </button>
  </div>

  <!-- Nav tabs -->
  <NavTabs
    value={tab}
    onchange={(key) => (tab = key as any)}
    items={[
      { key: 'all', label: 'الكل', icon: Bell, count: notifications.length },
      { key: 'unread', label: 'غير المقروءة', icon: Filter, count: unreadCount },
      { key: 'trading', label: 'التداول', icon: Zap },
      { key: 'wallet', label: 'المحفظة', icon: Banknote },
      { key: 'security', label: 'الأمان', icon: ShieldCheck }
    ]}
  />

  <div class="panel overflow-hidden">
    {#if loading}
      <div class="p-4 space-y-3">
        {#each Array(5) as _}<div class="h-16 rounded-xl bg-white/5 animate-shimmer"></div>{/each}
      </div>
    {:else if filtered.length === 0}
      <div class="py-16 text-center text-slate-500">
        <Bell size={40} class="mx-auto mb-3 opacity-30" />
        <p class="text-sm">لا توجد إشعارات</p>
      </div>
    {:else}
      <div class="divide-y divide-white/5">
        {#each filtered as n}
          {@const ic = getNotifIcon(n.type)}
          <div class="flex items-start gap-3 px-5 py-4 hover:bg-white/[0.02] transition-colors {!n.read ? 'bg-accent-gold/[0.03]' : ''}">
            <div class="w-10 h-10 rounded-xl {ic.bg} flex items-center justify-center shrink-0">
              <ic.icon size={16} class={ic.fg} />
            </div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2">
                <p class="text-sm font-semibold text-white">{n.title}</p>
                {#if !n.read}<span class="w-1.5 h-1.5 rounded-full bg-accent-gold shrink-0"></span>{/if}
              </div>
              <p class="text-xs text-slate-400 mt-1 leading-relaxed">{n.body}</p>
              <p class="text-[10px] text-slate-500 mt-1.5">{timeAgo(n.created_at)}</p>
            </div>
            {#if !n.read}
              <button
                onclick={() => markRead(n.id)}
                class="p-1.5 rounded-lg text-slate-400 hover:bg-white/5 hover:text-white shrink-0"
                aria-label="تعليم كمقروء"
              >
                <Check size={14} />
              </button>
            {/if}
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>
