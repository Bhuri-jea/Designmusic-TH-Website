<script lang="ts">
 import {ShoppingCart,Check} from 'lucide-svelte';
 import {cart} from '../../store/cart.svelte';
 import {ui} from '../../i18n/ui';
 import {formatPrice,type CartInput,type Locale} from '../../lib/catalog';
 import {displayPriceFor} from '../../store/catalog-pricing.svelte';
 let {item,lang='en',label,disabled=false,quantity=1,beforeAdd}=$props<{item:Omit<CartInput,'quantity'>;lang?:Locale;label?:string;disabled?:boolean;quantity?:number;beforeAdd?:(quantity:number)=>Promise<boolean>}>();
 let added=$state(false),checking=$state(false),error=$state('');
 async function add(){if(disabled||added||checking||!Number.isSafeInteger(quantity)||quantity<1||quantity>10)return;error='';const input={...item,options:item.options?{...item.options}:undefined,quantity};checking=true;try{cart.init(lang);if(beforeAdd&&!await beforeAdd(input.quantity))return;cart.add(input);added=true;cart.isOpen=true;setTimeout(()=>added=false,2000);}catch{error=ui[lang]['cart.limit'];}finally{checking=false;}}
</script>
<button class="btn btn-primary w-full text-sm disabled:opacity-50" onclick={add} disabled={added||disabled||checking} aria-busy={checking}>
 {#if checking}{{en:'Checking stock…',th:'กำลังตรวจสอบสต๊อก…',ja:'在庫を確認中…','zh-CN':'正在检查库存…'}[lang]}{:else if added}<Check class="w-5 h-5 mr-3"/>{ui[lang]['addtocart.added']}{:else}<ShoppingCart class="w-5 h-5 mr-3"/>{label??ui[lang]['addtocart.add'].replace('{price}',formatPrice(displayPriceFor(item.productId,item.variant,lang,item.options)!,lang)).replace('{currency}','')}{/if}
</button>
<p role="status" class="text-sm text-neutral-400">{error}</p>
