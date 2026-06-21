<script lang="ts">
  interface Props {
    value: number | string;
    prevValue?: number | string;
    decimals?: number;
    showSign?: boolean;
    className?: string;
  }

  let {
    value,
    prevValue,
    decimals = 2,
    showSign = false,
    className = ''
  }: Props = $props();

  let flashClass = $state('');

  const formatted = $derived.by(() => {
    const n = typeof value === 'string' ? parseFloat(value) : value;
    if (!isFinite(n)) return '0.00';
    const sign = showSign && n > 0 ? '+' : '';
    return sign + n.toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
  });

  // Flash on change
  $effect(() => {
    const currentVal = typeof value === 'string' ? parseFloat(value) : value;
    const prev = typeof prevValue === 'string' ? parseFloat(prevValue) : prevValue;
    if (prev === undefined || prev === null) return;
    if (currentVal > prev) {
      flashClass = 'flash-up';
      setTimeout(() => (flashClass = ''), 600);
    } else if (currentVal < prev) {
      flashClass = 'flash-down';
      setTimeout(() => (flashClass = ''), 600);
    }
  });
</script>

<span class="tabular-nums {flashClass} {className}">{formatted}</span>
