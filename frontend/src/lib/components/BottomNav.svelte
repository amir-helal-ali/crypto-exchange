<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { LayoutDashboard, TrendingUp, Wallet, Clock, User } from 'lucide-svelte';

  interface NavItem {
    href: string;
    icon: typeof LayoutDashboard;
    label: string;
    /** Match function for active state */
    match?: (path: string) => boolean;
  }

  const items: NavItem[] = [
    {
      href: '/dashboard',
      icon: LayoutDashboard,
      label: 'الرئيسية',
      match: (p) => p === '/dashboard'
    },
    {
      href: '/dashboard/exchange',
      icon: TrendingUp,
      label: 'التداول',
      match: (p) => p.startsWith('/dashboard/exchange')
    },
    {
      href: '/dashboard/wallet',
      icon: Wallet,
      label: 'المحفظة',
      match: (p) => p.startsWith('/dashboard/wallet')
    },
    {
      href: '/dashboard/history',
      icon: Clock,
      label: 'السجل',
      match: (p) => p.startsWith('/dashboard/history')
    },
    {
      href: '/dashboard/profile',
      icon: User,
      label: 'حسابي',
      match: (p) =>
        p.startsWith('/dashboard/profile') ||
        p.startsWith('/dashboard/security') ||
        p.startsWith('/dashboard/kyc') ||
        p.startsWith('/dashboard/fees') ||
        p.startsWith('/dashboard/notifications')
    }
  ];

  const currentPath = $derived($page.url.pathname);

  // Exchange page has its own mobile tab bar — hide the global bottom nav there
  const isHidden = $derived(currentPath.startsWith('/dashboard/exchange'));

  function isActive(item: NavItem): boolean {
    if (item.match) return item.match(currentPath);
    return currentPath === item.href;
  }

  function handleClick(e: MouseEvent, href: string) {
    e.preventDefault();
    goto(href);
  }
</script>

{#if !isHidden}
  <!-- Mobile-only bottom navigation -->
  <nav
    class="lg:hidden fixed bottom-0 inset-x-0 z-40 h-16 bg-ink-900/95 backdrop-blur-xl border-t border-white/5"
    aria-label="تنقل سفلي"
  >
    <!-- Subtle top glow -->
    <div class="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-accent-gold/30 to-transparent"></div>

    <div class="grid grid-cols-5 h-full px-2 pb-[env(safe-area-inset-bottom)]">
      {#each items as item, i}
        {@const active = isActive(item)}
        <a
          href={item.href}
          onclick={(e) => handleClick(e, item.href)}
          class="relative flex flex-col items-center justify-center gap-0.5 transition-colors {active
            ? 'text-accent-gold'
            : 'text-slate-500 hover:text-slate-300'}"
          aria-label={item.label}
          aria-current={active ? 'page' : undefined}
        >
          <!-- Active indicator (top notch) -->
          {#if active}
            <span
              class="absolute -top-px left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-accent-gold shadow-glow"
            ></span>
          {/if}

          <!-- Icon container with subtle scale on active -->
          <div
            class="flex items-center justify-center w-9 h-7 rounded-lg transition-all {active
              ? 'bg-accent-gold/10 scale-105'
              : ''}"
          >
            <item.icon
              size={20}
              strokeWidth={active ? 2.5 : 2}
            />
          </div>

          <span class="text-[10px] font-medium leading-none {active ? 'font-bold' : ''}">
            {item.label}
          </span>
        </a>
      {/each}
    </div>
  </nav>
{/if}

<style>
  /* Prevent layout shift when active indicator appears */
  nav a {
    -webkit-tap-highlight-color: transparent;
  }
</style>
