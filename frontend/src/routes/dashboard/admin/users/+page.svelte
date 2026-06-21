<script lang="ts">
  import { onMount } from 'svelte';
  import { authGet, parseApiResponse } from '$lib/api/client';
  import { formatPrice, formatDate, timeAgo } from '$lib/utils/format';
  import { Search, Ban, Check, UserPlus, Users as UsersIcon, RefreshCw } from 'lucide-svelte';

  let users = $state<any[]>([]);
  let loading = $state(true);
  let search = $state('');
  let filter = $state<'all' | 'verified' | 'unverified' | 'admin'>('all');

  onMount(() => {
(async () => {
    await loadUsers();
    loading = false;
  
  })();
});

  async function loadUsers() {
    try {
      const res = await authGet('/api/v1/admin/users?limit=100');
      const data = await parseApiResponse<any>(res);
      users = data?.users || data || [];
    } catch {
      users = [];
    }
  }

  const filteredUsers = $derived.by(() => {
    let list = users;
    if (filter === 'verified') list = list.filter((u) => u.email_verified);
    else if (filter === 'unverified') list = list.filter((u) => !u.email_verified);
    else if (filter === 'admin') list = list.filter((u) => u.role === 'admin' || u.role === 'ADMIN');
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((u) =>
        u.username?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q)
      );
    }
    return list;
  });

  async function toggleAdmin(u: any) {
    try {
      await authGet(`/api/v1/admin/users/${u.id}/role`).catch(() => {});
      await loadUsers();
    } catch {}
  }
</script>

<svelte:head><title>المستخدمين — لوحة الإدارة</title></svelte:head>

<div class="space-y-5">
  <div class="flex items-center justify-between">
    <div>
      <h1 class="text-2xl sm:text-3xl font-bold text-white">المستخدمين</h1>
      <p class="text-sm text-slate-400 mt-1">{users.length} مستخدم مسجّل</p>
    </div>
    <button onclick={loadUsers} class="btn-ghost" aria-label="تحديث">
      <RefreshCw size={16} class={loading ? 'animate-spin' : ''} />
    </button>
  </div>

  <!-- Filters + search -->
  <div class="flex flex-wrap gap-3 items-center">
    <div class="relative flex-1 min-w-64">
      <Search size={14} class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" />
      <input
        bind:value={search}
        type="text"
        placeholder="بحث بالاسم أو البريد..."
        class="input pr-10 py-2 text-sm"
      />
    </div>
    <div class="flex gap-1">
      {#each [{ k: 'all', l: 'الكل' }, { k: 'verified', l: 'مُوثّق' }, { k: 'unverified', l: 'غير مُوثّق' }, { k: 'admin', l: 'إداري' }] as f}
        <button
          onclick={() => (filter = f.k as any)}
          class="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors {filter === f.k ? 'bg-accent-gold/15 text-accent-gold' : 'bg-white/[0.03] text-slate-400 hover:bg-white/5'}"
        >
          {f.l}
        </button>
      {/each}
    </div>
  </div>

  <div class="panel overflow-hidden">
    {#if loading}
      <div class="p-6 space-y-3">
        {#each Array(8) as _}<div class="h-12 rounded-xl bg-white/5 animate-shimmer"></div>{/each}
      </div>
    {:else if filteredUsers.length === 0}
      <div class="py-16 text-center text-slate-500">
        <UsersIcon size={40} class="mx-auto mb-3 opacity-30" />
        <p class="text-sm">لا يوجد مستخدمون</p>
      </div>
    {:else}
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="text-[10px] uppercase tracking-wider text-slate-500 border-b border-white/5">
              <th class="text-right font-medium px-5 py-3">المستخدم</th>
              <th class="text-right font-medium px-5 py-3">البريد</th>
              <th class="text-right font-medium px-5 py-3">الدور</th>
              <th class="text-right font-medium px-5 py-3">الحالة</th>
              <th class="text-right font-medium px-5 py-3">التسجيل</th>
              <th class="text-left font-medium px-5 py-3">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {#each filteredUsers as u}
              <tr class="border-b border-white/5 last:border-0 hover:bg-white/[0.02]">
                <td class="px-5 py-3">
                  <div class="flex items-center gap-2.5">
                    <div class="w-8 h-8 rounded-full bg-gradient-to-br from-accent-gold/30 to-accent-violet/30 border border-white/10 flex items-center justify-center text-[10px] font-bold text-white">
                      {(u.username || '??').slice(0, 2).toUpperCase()}
                    </div>
                    <span class="font-semibold text-white">{u.username}</span>
                  </div>
                </td>
                <td class="px-5 py-3 text-slate-400">{u.email}</td>
                <td class="px-5 py-3">
                  <span class="pill {u.role === 'admin' || u.role === 'ADMIN' ? 'pill-gold' : 'pill-mint'}">{u.role}</span>
                </td>
                <td class="px-5 py-3">
                  {#if u.email_verified}
                    <span class="pill-mint text-[10px]"><Check size={10} /> مُوثّق</span>
                  {:else}
                    <span class="pill-rose text-[10px]">غير مُوثّق</span>
                  {/if}
                </td>
                <td class="px-5 py-3 text-xs text-slate-400">{timeAgo(u.created_at)}</td>
                <td class="px-5 py-3 text-left">
                  <button
                    onclick={() => toggleAdmin(u)}
                    class="text-accent-gold hover:underline text-xs"
                  >
                    تبديل الدور
                  </button>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </div>
</div>
