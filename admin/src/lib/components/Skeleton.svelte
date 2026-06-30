<script lang="ts">
  let {
    width = '100%',
    height = '16px',
    radius = '8px',
    class: className = ''
  } = $props<{
    width?: string;
    height?: string;
    radius?: string;
    class?: string;
  }>();
</script>

<div
  class="animate-shimmer {className}"
  style="width: {width}; height: {height}; border-radius: {radius}; background: rgba(255,255,255,0.06);"
></div>
