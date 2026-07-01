<script lang="ts">
  let {
    title = '',
    subtitle = '',
    children
  } = $props<{
    title: string;
    subtitle?: string;
    children?: import('svelte').Snippet;
  }>();
</script>

<div class="flex items-center justify-between flex-wrap gap-4 animate-fade-in">
  <div>
    <h1 class="text-2xl lg:text-3xl font-extrabold text-gold-gradient">{title}</h1>
    {#if subtitle}
      <p class="text-sm mt-1" style="color: var(--text-tertiary);">{subtitle}</p>
    {/if}
  </div>
  {#if children}
    <div class="flex items-center gap-3 flex-wrap">
      {@render children()}
    </div>
  {/if}
</div>
