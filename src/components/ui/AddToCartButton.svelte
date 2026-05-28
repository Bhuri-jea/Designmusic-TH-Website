<script lang="ts">
  import { ShoppingCart, Check } from 'lucide-svelte';
  import { cart } from '../../store/cart.svelte';
  import { ui, defaultLang } from '../../i18n/ui';
  
  let { item, options = {} } = $props<{
    item: {
      id: string;
      name: string;
      price: number;
      image?: string;
    };
    options?: Record<string, string>;
  }>();
  
  let added = $state(false);

  function getLang() {
    if (typeof document !== 'undefined') return document.documentElement.lang || defaultLang;
    return defaultLang;
  }

  function t(key: keyof typeof ui[typeof defaultLang]) {
    const lang = getLang();
    return ui[lang]?.[key] || ui[defaultLang][key];
  }

  function currencyForLang(lang: string) {
    if (lang === 'th') return 'THB';
    if (lang === 'ja') return 'JPY';
    if (lang === 'zh-CN') return 'RMP';
    return 'USD';
  }

  function handleAdd() {
    cart.add({
      ...item,
      quantity: 1,
      options
    });
    
    added = true;
    setTimeout(() => {
      added = false;
    }, 2000);
    
    // Open the cart drawer using the shared store
    cart.isOpen = true;
  }
</script>

<button class="btn btn-primary w-full text-sm disabled:opacity-50" onclick={handleAdd} disabled={added}>
  {#if added}
    <Check class="w-5 h-5 mr-3" />
    <span class="animate-pulse">{t('addtocart.added')}</span>
  {:else}
    <ShoppingCart class="w-5 h-5 mr-3" />
    {#await Promise.resolve()}
      <span>Loading...</span>
    {:then}
      {@html t('addtocart.add').replace('{price}', item.price.toLocaleString()).replace('{currency}', currencyForLang(getLang()))}
    {/await}
  {/if}
</button>
