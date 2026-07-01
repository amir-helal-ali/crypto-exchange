<script lang="ts">
  let {
    icon = null as any,
    title = '',
    description = ''
  } = $props<{
    icon: any;
    title: string;
    description?: string;
  }>();
</script>

<div class="flex flex-col items-center justify-center py-16 text-center animate-fade-in">
  <div class="flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
    style="background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.06);">
    <icon size={28} style="color: var(--text-quaternary);"></icon>
  </div>
  <h3 class="text-lg font-bold mb-1" style="color: var(--text-secondary);">{title}</h3>
  {#if description}
    <p class="text-sm max-w-sm" style="color: var(--text-quaternary);">{description}</p>
  {/if}
</div>
