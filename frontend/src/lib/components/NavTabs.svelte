<script lang="ts" module>
  export interface NavTabItem {
    /** unique key for the tab */
    key: string;
    /** visible label */
    label: string;
    /** optional lucide icon component */
    icon?: any;
    /** optional small count badge */
    count?: number;
    /** disable the tab */
    disabled?: boolean;
  }
</script>

<script lang="ts">
  interface Props {
    /** list of tab definitions */
    items: NavTabItem[];
    /** active tab key */
    value: string;
    /** visual variant — pill (default) | underline | segmented */
    variant?: 'pill' | 'underline' | 'segmented';
    /** size — sm | md | lg */
    size?: 'sm' | 'md' | 'lg';
    /** stretch tabs to fill width */
    fullWidth?: boolean;
    /** extra classes for the wrapper */
    class?: string;
    /** callback invoked when the active tab changes — receives the new tab key */
    onchange?: (key: string) => void;
  }

  let {
    items,
    value,
    variant = 'pill',
    size = 'md',
    fullWidth = false,
    class: klass = '',
    onchange
  }: Props = $props();

  function select(key: string, disabled?: boolean) {
    if (disabled) return;
    onchange?.(key);
  }
</script>

<div
  class="nav-tabs nav-tabs-{variant} nav-tabs-{size} {fullWidth ? 'nav-tabs-full' : ''} {klass}"
  role="tablist"
>
  {#each items as item (item.key)}
    <button
      type="button"
      role="tab"
      aria-selected={value === item.key}
      aria-disabled={item.disabled}
      disabled={item.disabled}
      class="nav-tab {value === item.key ? 'active' : ''} {item.disabled ? 'disabled' : ''}"
      onclick={() => select(item.key, item.disabled)}
    >
      {#if item.icon}
        <span class="nav-tab-icon"><item.icon size={size === 'sm' ? 13 : 15} /></span>
      {/if}
      <span class="nav-tab-label">{item.label}</span>
      {#if typeof item.count === 'number' && item.count > 0}
        <span class="nav-tab-count">{item.count > 99 ? '99+' : item.count}</span>
      {/if}
    </button>
  {/each}
</div>

<style>
  .nav-tabs {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    width: auto;
  }
  .nav-tabs-full {
    display: flex;
    width: 100%;
  }
  .nav-tabs-full :global(.nav-tab) {
    flex: 1;
  }

  .nav-tab {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    border: none;
    background: transparent;
    cursor: pointer;
    transition: all 0.18s ease;
    white-space: nowrap;
    font-family: inherit;
    color: var(--text-secondary, #a3accd);
    font-weight: 500;
    line-height: 1;
  }
  .nav-tab.disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  .nav-tab-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  .nav-tab-count {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 18px;
    height: 18px;
    padding: 0 5px;
    border-radius: 9px;
    font-size: 10px;
    font-weight: 700;
    background: rgba(255, 255, 255, 0.08);
    color: var(--text-secondary);
  }

  /* ---- Size variants ---- */
  .nav-tabs-sm .nav-tab {
    padding: 0.375rem 0.75rem;
    font-size: 0.7rem;
    border-radius: 0.5rem;
  }
  .nav-tabs-md .nav-tab {
    padding: 0.5rem 1rem;
    font-size: 0.8rem;
    border-radius: 0.625rem;
  }
  .nav-tabs-lg .nav-tab {
    padding: 0.75rem 1.25rem;
    font-size: 0.9rem;
    border-radius: 0.75rem;
  }

  /* ---- Pill variant (default) — contained in a panel ---- */
  .nav-tabs-pill {
    padding: 0.25rem;
    background: rgba(10, 14, 31, 0.6);
    border: 1px solid rgba(255, 255, 255, 0.05);
    border-radius: 0.875rem;
  }
  .nav-tabs-pill .nav-tab:hover:not(.disabled) {
    color: #fff;
    background: rgba(255, 255, 255, 0.04);
  }
  .nav-tabs-pill .nav-tab.active {
    color: #fff;
    background: linear-gradient(135deg, rgba(245, 181, 68, 0.18), rgba(168, 85, 247, 0.12));
    border: 1px solid rgba(245, 181, 68, 0.25);
    box-shadow: 0 0 0 1px rgba(245, 181, 68, 0.08), 0 4px 12px -4px rgba(245, 181, 68, 0.3);
  }
  .nav-tabs-pill .nav-tab.active .nav-tab-count {
    background: rgba(245, 181, 68, 0.25);
    color: #f5b544;
  }

  /* ---- Underline variant — minimalist ---- */
  .nav-tabs-underline {
    gap: 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    padding: 0 0.25rem;
  }
  .nav-tabs-underline .nav-tab {
    position: relative;
    border-radius: 0;
    margin-bottom: -1px;
  }
  .nav-tabs-underline .nav-tab:hover:not(.disabled) {
    color: #fff;
  }
  .nav-tabs-underline .nav-tab.active {
    color: #f5b544;
  }
  .nav-tabs-underline .nav-tab.active::after {
    content: '';
    position: absolute;
    inset-inline: 0.5rem;
    bottom: -1px;
    height: 2px;
    background: linear-gradient(90deg, transparent, #f5b544, transparent);
    border-radius: 2px;
  }

  /* ---- Segmented variant — clean modern look ---- */
  .nav-tabs-segmented {
    padding: 0.25rem;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 0.875rem;
  }
  .nav-tabs-segmented .nav-tab {
    border-radius: 0.625rem;
  }
  .nav-tabs-segmented .nav-tab:hover:not(.disabled) {
    color: #fff;
    background: rgba(255, 255, 255, 0.04);
  }
  .nav-tabs-segmented .nav-tab.active {
    color: #fff;
    background: rgba(255, 255, 255, 0.08);
    box-shadow: 0 1px 0 rgba(255, 255, 255, 0.05) inset, 0 4px 12px -4px rgba(0, 0, 0, 0.5);
  }
</style>
