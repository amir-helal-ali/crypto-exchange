<script lang="ts">
  let {
    icon = null as any,
    title = '',
    description = '',
    action = null as any
  } = $props<{
    icon: any;
    title: string;
    description?: string;
    action?: any;
  }>();
</script>

<div class="panel p-16 text-center">
  <icon size={48} class="mx-auto mb-4 opacity-20" style="color: var(--text-quaternary);" />
  <p class="text-lg font-bold" style="color: var(--text-secondary);">{title}</p>
  {#if description}
    <p class="text-sm mt-2" style="color: var(--text-quaternary);">{description}</p>
  {/if}
  {#if action}
    <div class="mt-6">
      {@render action()}
    </div>
  {/if}
</div>
