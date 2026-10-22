<script lang="ts">
 import AddToCartButton from '../ui/AddToCartButton.svelte';import {formatPrice,type Locale} from '../../lib/catalog';
 let {product,lang='en'}=$props<{product:any;lang?:Locale}>();
 let selected=$state<Record<string,string>>({});
 let sku=$derived(product.skus.find((row:any)=>product.optionGroups.every((group:any)=>row.optionCodes.includes(selected[group.code])))??(product.optionGroups.length?null:product.skus[0]));
 const currency=lang==='ja'?'jpy':lang==='th'?'thb':'usd';
 const available=$derived(sku&&sku.onHand-sku.reserved>0);
 const item=$derived(sku?{productId:product.slug,variant:sku.sku,options:Object.keys(selected).length?selected:undefined}:null);
</script>
<div class="space-y-6">{#each product.optionGroups as group}<fieldset><legend class="mb-2 font-medium">{group.label}</legend><div class="flex flex-wrap gap-2">{#each group.values as value}<button type="button" class="min-h-12 border px-4" aria-pressed={selected[group.code]===value.code} onclick={()=>selected={...selected,[group.code]:value.code}}>{value.label}</button>{/each}</div></fieldset>{/each}
 {#if sku}<p class="text-3xl font-serif">{sku.prices[currency]!=null?formatPrice(sku.prices[currency],lang):''}</p>{#if sku.salesMode==='checkout'}<p>{available?(lang==='th'?'พร้อมจำหน่าย':'In stock'):(lang==='th'?'สินค้าหมด':'Out of stock')}</p>{#if item}<AddToCartButton {item} {lang}/>{/if}{:else}<div class="reservation-notice"><p>{lang==='th'?'สินค้านี้รับจองโดยติดต่อร้านโดยตรง':'Contact the shop directly to reserve this item.'}</p><div class="flex flex-wrap gap-2"><a class="btn" href="https://www.facebook.com/DesignmusicInstrumentmusicAccessories" target="_blank" rel="noreferrer">Facebook</a><a class="btn" href="https://www.instagram.com/designmusic_instrument/" target="_blank" rel="noreferrer">Instagram</a><a class="btn" href="mailto:designmusicthailand@gmail.com">Email</a><a class="btn" href="tel:+66850915959">085 091 5959</a></div></div>{/if}{:else}<p>{lang==='th'?'เลือกตัวเลือกเพื่อดูราคาและสถานะ':'Choose each option to see price and availability.'}</p>{/if}</div>
