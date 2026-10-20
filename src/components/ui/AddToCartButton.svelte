<script lang="ts">
 import {ShoppingCart,Check} from 'lucide-svelte';
 import {cart} from '../../store/cart.svelte';
 import {ui} from '../../i18n/ui';
 import {formatPrice,type CartInput,type Locale} from '../../lib/catalog';
 import {displayPriceFor} from '../../store/catalog-pricing.svelte';
 let {item,lang='en'}=$props<{item:Omit<CartInput,'quantity'>;lang?:Locale}>();
 let added=$state(false),error=$state('');
 function add(){error='';try{cart.init(lang);cart.add({...item,quantity:1});added=true;cart.isOpen=true;setTimeout(()=>added=false,2000);}catch{error=ui[lang]['cart.limit'];}}
</script>
<button class="btn btn-primary w-full text-sm disabled:opacity-50" onclick={add} disabled={added}>
 {#if added}<Check class="w-5 h-5 mr-3"/>{ui[lang]['addtocart.added']}{:else}<ShoppingCart class="w-5 h-5 mr-3"/>{ui[lang]['addtocart.add'].replace('{price}',formatPrice(displayPriceFor(item.productId,item.variant,lang,item.options)!,lang)).replace('{currency}','')}{/if}
</button>
<p role="status" class="text-sm text-neutral-400">{error}</p>
