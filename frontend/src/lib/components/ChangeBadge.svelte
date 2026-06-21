<script lang="ts">
  interface Props {
    change: number;
    showIcon?: boolean;
    className?: string;
  }

  let { change, showIcon = true, className = '' }: Props = $props();

  const isPositive = $derived(change >= 0);
</script>

<span
  class="inline-flex items-center gap-1 font-mono font-medium tabular-nums {isPositive
    ? 'text-accent-mint'
    : 'text-accent-rose'} {className}"
>
  {#if showIcon}
    <svg
      class="w-3 h-3"
      viewBox="0 0 12 12"
      fill="none"
      style="transform: {isPositive ? 'none' : 'rotate(180deg)'};"
    >
      <path d="M6 2L10 8H2L6 2Z" fill="currentColor" />
    </svg>
  {/if}
  {isPositive ? '+' : ''}{change.toFixed(2)}%
</span>
