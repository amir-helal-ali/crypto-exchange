<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    label?: string;
    type?: string;
    value?: string | number;
    placeholder?: string;
    error?: string;
    required?: boolean;
    disabled?: boolean;
    icon?: Snippet;
    suffix?: Snippet;
    id?: string;
    autocomplete?: any;
    oninput?: (e: Event) => void;
    onfocus?: (e: Event) => void;
    onblur?: (e: Event) => void;
    onkeydown?: (e: KeyboardEvent) => void;
    [key: string]: any;
  }

  let {
    label,
    type = 'text',
    value = $bindable(''),
    placeholder,
    error,
    required = false,
    disabled = false,
    icon,
    suffix,
    id,
    autocomplete,
    oninput,
    onfocus,
    onblur,
    onkeydown,
    ...rest
  }: Props = $props();
</script>

{#if label}
  <label class="input-label" for={id}>
    {label}
    {#if required}<span class="text-accent-rose">*</span>{/if}
  </label>
{/if}

<div class="relative">
  {#if icon}
    <div class="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 pointer-events-none">
      {@render icon()}
    </div>
  {/if}

  <input
    {id}
    {type}
    {value}
    {placeholder}
    {required}
    {disabled}
    {autocomplete}
    {oninput}
    {onfocus}
    {onblur}
    {onkeydown}
    class="input {icon ? 'pr-10' : ''} {suffix ? 'pl-20' : ''} {error ? 'border-accent-rose/60 focus:border-accent-rose' : ''}"
    {...rest}
  />

  {#if suffix}
    <div class="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-300 text-sm font-medium">
      {@render suffix()}
    </div>
  {/if}
</div>

{#if error}
  <p class="mt-1.5 text-xs text-accent-rose">{error}</p>
{/if}
