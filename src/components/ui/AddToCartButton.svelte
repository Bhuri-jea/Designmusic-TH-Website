<script lang="ts">
  import { ShoppingCart, Check } from 'lucide-svelte';
  import { cart } from '../../store/cart.svelte';
  
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
    <span class="animate-pulse">Added!</span>
  {:else}
    <ShoppingCart class="w-5 h-5 mr-3" />
    Add to Cart - {item.price.toLocaleString()} THB
  {/if}
</button>
