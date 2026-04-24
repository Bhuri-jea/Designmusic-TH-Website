<script lang="ts">
  import type { ComponentProps } from 'svelte';
  export interface Item {
    label: string;
    href: string;
    img?: string; // optional thumbnail path
  }
  export let items: Item[] = [];
  export let label: string = '';
  export let baseHref: string = '#';
</script>

<div class="relative group">
  <a href={baseHref} class="text-sm tracking-widest uppercase text-neutral-300 hover:text-white transition-colors relative after:content-[''] after:absolute after:bottom-[-4px] after:left-0 after:w-0 after:h-[1px] after:bg-white hover:after:w-full after:transition-all">
    {label}
  </a>
  <div class="absolute left-0 top-full pt-2 hidden group-hover:block z-50 min-w-[180px]">
    <div class="bg-neutral-900 border border-white/10 rounded-md shadow-lg overflow-hidden">
      {#each items as item}
        <a href={item.href} class="flex items-center gap-2 px-4 py-2 text-sm text-white hover:bg-white/10 transition-colors">
          {#if item.img}
            <img src={item.img} alt={item.label} class="w-5 h-5 rounded object-cover" loading="lazy" />
          {/if}
          {item.label}
        </a>
      {/each}
    </div>
  </div>
</div>
