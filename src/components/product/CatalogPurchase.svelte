<script lang="ts">
 import {onMount} from 'svelte';
 import {Facebook,Instagram,Mail,Phone} from 'lucide-svelte';
 import AddToCartButton from '../ui/AddToCartButton.svelte';import {formatPrice,type Locale} from '../../lib/catalog';
 import {cart} from '../../store/cart.svelte';
 import CustomerReviews from './CustomerReviews.svelte';
 import {DEFAULT_PRODUCT_LAYOUT,remainingPurchaseQuantity,quantityForSku} from '../../lib/catalog-presentation';
 let {product,lang='en',fullContent=false,preview=false}=$props<{product:any;lang?:Locale;fullContent?:boolean;preview?:boolean}>();
 const layout=$derived(product.presentation?.layout??DEFAULT_PRODUCT_LAYOUT);
 const controlId=$props.id();
 let selected=$state<Record<string,string>>({});
 let quantity=$state<number|undefined>(1),checkingStock=$state(false),stockError=$state('');
 let liveStock=$state<Record<string,{onHand:number;reserved:number}>>({});
 let sku=$derived(product.skus.find((row:any)=>product.optionGroups.every((group:any)=>row.optionCodes.includes(selected[group.code])))??(product.optionGroups.length?null:product.skus[0]));
 const visibleLayout=$derived.by(()=>{const current=sku;return layout.map((row:string[])=>row.filter(section=>{if(['badge','name','description'].includes(section))return fullContent&&(section!=='badge'||!!product.badge);if(section==='options')return product.optionGroups.length>0;if(['price','availability','quantity'].includes(section))return current?.salesMode==='checkout';if(section==='reviews')return (product.presentation?.reviews?.length??0)>0;return true;})).filter((row:string[])=>row.length);});
 let currency=$derived(lang==='ja'?'jpy':lang==='th'?'thb':'usd');
 const counts=$derived(sku?(liveStock[sku.sku]??sku):null);
 const available=$derived(counts&&counts.onHand-counts.reserved>0);
 const inCart=$derived(sku&&!preview?quantityForSku(cart.items,product.slug,sku.sku,sku.optionCodes??[]):0);
 const maxAdd=$derived(counts?remainingPurchaseQuantity(counts.onHand,counts.reserved,inCart):0);
 const validQuantity=$derived(Number.isSafeInteger(quantity)&&quantity!>0&&quantity!<=maxAdd);
 const item=$derived(sku?{productId:product.slug,variant:sku.sku,options:Object.keys(selected).length?selected:undefined}:null);
 let copy=$derived({
  en:{invitation:'Please visit our shop or contact us directly.',book:'Book reservation',contact:'Contact the shop',inStock:'In stock',soldOut:'Out of stock',choose:'Choose each option to see price and availability.',email:'Email',phone:'Tel'},
  th:{invitation:'กรุณามาที่ร้านหรือติดต่อเราโดยตรง',book:'จองนัดหมาย',contact:'ติดต่อร้าน',inStock:'พร้อมจำหน่าย',soldOut:'สินค้าหมด',choose:'เลือกตัวเลือกเพื่อดูราคาและสถานะ',email:'อีเมล',phone:'โทร'},
  ja:{invitation:'ご来店いただくか、店舗へ直接お問い合わせください。',book:'来店を予約する',contact:'店舗へのお問い合わせ',inStock:'在庫あり',soldOut:'在庫切れ',choose:'各オプションを選択すると価格と在庫が表示されます。',email:'メール',phone:'電話'},
  'zh-CN':{invitation:'请到店或直接联系我们。',book:'预约到店',contact:'联系店铺',inStock:'有货',soldOut:'缺货',choose:'请选择各项选项以查看价格和库存。',email:'电子邮件',phone:'电话'}
 }[lang]);
 const purchaseWords={en:{quantity:'Quantity',decrease:'Decrease quantity',increase:'Increase quantity',piece:'piece',add:'Add to cart',limit:'Up to {max} more; {count} already in your cart.',stock:'{name}: only {max} more can be added; {count} already in your cart. Stock has been refreshed.',failed:'Could not check current stock. Please try again.',choose:'Choose…'},th:{quantity:'จำนวน',decrease:'ลดจำนวน',increase:'เพิ่มจำนวน',piece:'ชิ้น',add:'เพิ่มในตะกร้า',limit:'เพิ่มได้อีก {max} ชิ้น มีในตะกร้าแล้ว {count} ชิ้น',stock:'{name}: เพิ่มได้อีกเพียง {max} ชิ้น มีในตะกร้าแล้ว {count} ชิ้น อัปเดตสต๊อกแล้ว',failed:'ตรวจสอบสต๊อกปัจจุบันไม่สำเร็จ โปรดลองอีกครั้ง',choose:'เลือก…'},ja:{quantity:'数量',decrease:'数量を減らす',increase:'数量を増やす',piece:'個',add:'カートに追加',limit:'追加可能：{max}個。カート内：{count}個。',stock:'{name}：あと{max}個追加できます。カート内は{count}個です。在庫を更新しました。',failed:'現在の在庫を確認できませんでした。もう一度お試しください。',choose:'選択…'},'zh-CN':{quantity:'数量',decrease:'减少数量',increase:'增加数量',piece:'件',add:'加入购物车',limit:'还可添加{max}件；购物车中已有{count}件。',stock:'{name}：最多还可添加{max}件；购物车中已有{count}件。库存已更新。',failed:'无法检查当前库存，请重试。',choose:'请选择…'}};
 let words=$derived(purchaseWords[lang]);
 const limitText=(text:string,max:number,count:number,name=product.name)=>text.replace('{max}',String(max)).replace('{count}',String(count)).replace('{name}',name);
 $effect(()=>{const key=sku?.sku;quantity=1;stockError='';});
 onMount(()=>{if(!preview)cart.init(lang);});
 async function checkStock(amount:number){
  if(!sku||checkingStock)return false;
  const target=sku.sku;checkingStock=true;stockError='';
  try{
   const response=await fetch(`/api/catalog?locale=${encodeURIComponent(lang)}`,{cache:'no-store',signal:AbortSignal.timeout(10000)});
   if(!response.ok)throw Error();
   const data=await response.json(),current=data.products?.find((row:any)=>row.slug===product.slug)?.skus?.find((row:any)=>row.sku===target&&row.salesMode==='checkout');
   const counts=current??{onHand:0,reserved:0};liveStock={...liveStock,[target]:{onHand:counts.onHand,reserved:counts.reserved}};
   const already=quantityForSku(cart.items,product.slug,target,sku.optionCodes??[]),remaining=remainingPurchaseQuantity(counts.onHand,counts.reserved,already);
   if(!Number.isSafeInteger(amount)||amount<1||amount>remaining){stockError=limitText(words.stock,remaining,already);return false;}
   return true;
  }catch{stockError=words.failed;return false;}finally{checkingStock=false;}
 }
</script>
<div class="catalog-purchase" class:full-content={fullContent}>
 {#each visibleLayout as row}<div class="product-content-row" class:paired={row.length===2}>
 {#each row as section}<div class="product-content-block" data-section={section}>
 {#if section==='badge'}<div class="product-badge">{product.badge}</div>
 {:else if section==='name'}<h1>{product.name}</h1>
 {:else if section==='description'}<div class="product-description"><p>{product.description||product.shortDescription}</p></div>
 {:else if section==='options'}{#each product.optionGroups as group}{@const style=product.presentation?.optionStyles?.[group.code]??'buttons'}<fieldset disabled={checkingStock}><legend class="mb-2 font-medium">{group.label}</legend>
 {#if style==='dropdown'}<select class="option-select" aria-label={group.label} value={selected[group.code]??''} onchange={event=>selected={...selected,[group.code]:event.currentTarget.value}}><option value="">{words.choose}</option>{#each group.values as value}<option value={value.code}>{value.label}</option>{/each}</select>{#if group.values.find((value:any)=>value.code===selected[group.code])?.description}<p class="option-explanation">{group.values.find((value:any)=>value.code===selected[group.code]).description}</p>{/if}
 {:else if style==='radio'}<div class="radio-list">{#each group.values as value}<label class="radio-choice"><input type="radio" name={`option-${controlId}-${group.code}`} value={value.code} checked={selected[group.code]===value.code} onchange={()=>selected={...selected,[group.code]:value.code}}/><span><span class="option-label">{value.label}</span>{#if value.description}<span class="option-explanation">{value.description}</span>{/if}</span></label>{/each}</div>
 {:else}<div class="option-grid">{#each group.values as value}<button type="button" class="option-choice" aria-pressed={selected[group.code]===value.code} onclick={()=>selected={...selected,[group.code]:value.code}}><span class="option-label">{value.label}{#if selected[group.code]===value.code}<span aria-hidden="true">✓</span>{/if}</span>{#if value.description}<span class="option-explanation">{value.description}</span>{/if}</button>{/each}</div>{/if}
 </fieldset>{/each}
 {:else if section==='price'}<p class="product-price text-3xl font-serif">{sku.prices[currency]!=null?formatPrice(sku.prices[currency],lang):''}</p>
 {:else if section==='availability'}<p class="availability" class:unavailable={!available}>{available?copy.inStock:copy.soldOut}</p>
 {:else if section==='quantity'}<div class="quantity-section"><label for={`quantity-${controlId}`}>{words.quantity}</label><div class="quantity-control"><button type="button" aria-label={words.decrease} disabled={checkingStock||!quantity||quantity<=1} onclick={()=>quantity=Math.max(1,(quantity??1)-1)}>−</button><input id={`quantity-${controlId}`} type="text" inputmode="numeric" pattern="[0-9]*" value={quantity??''} disabled={checkingStock||!available} aria-describedby={`quantity-hint-${controlId}`} aria-invalid={!validQuantity} oninput={event=>{const value=event.currentTarget.value;quantity=/^\d+$/.test(value)?Number(value):undefined;}}/><button type="button" aria-label={words.increase} disabled={checkingStock||(quantity??0)>=maxAdd} onclick={()=>quantity=Math.min(maxAdd,(quantity??0)+1)}>+</button></div><p id={`quantity-hint-${controlId}`} class="quantity-hint">{limitText(words.limit,maxAdd,inCart)}</p></div>
 {:else if section==='purchase'}{#if sku}{#if sku.salesMode==='checkout'}{#if item}<div class="purchase-action"><AddToCartButton {item} {lang} quantity={quantity??0} disabled={preview||!available||!validQuantity} beforeAdd={checkStock} label={words.add}/><p class="unit-price">{sku.prices[currency]!=null?formatPrice(sku.prices[currency],lang):''} {currency.toUpperCase()} / {words.piece}</p></div>{/if}<p class="stock-error" role="status">{stockError}</p>{:else}<section class="reservation-invitation" aria-label={copy.contact}>
   <div class="reservation-card"><p>{copy.invitation}</p><a class="reservation-action" href={`${lang==='en'?'':'/'+lang}/booking`}>{copy.book} <span aria-hidden="true">↗</span></a></div>
   <ul class="shop-contact-list">
    <li><a href="https://www.facebook.com/DesignmusicInstrumentmusicAccessories" target="_blank" rel="noopener noreferrer"><Facebook size={21} aria-hidden="true"/><span>Facebook</span></a></li>
    <li><a href="https://www.instagram.com/designmusic_instrument/" target="_blank" rel="noopener noreferrer"><Instagram size={21} aria-hidden="true"/><span>Instagram</span></a></li>
    <li><a href="mailto:designmusicthailand@gmail.com"><Mail size={21} aria-hidden="true"/><span>{copy.email}: designmusicthailand@gmail.com</span></a></li>
    <li><a href="tel:+66850915959"><Phone size={21} aria-hidden="true"/><span>{copy.phone}: 085 091 5959</span></a></li>
   </ul>
  </section>{/if}{:else}<p>{copy.choose}</p>{/if}
 {:else if section==='reviews'}<CustomerReviews reviews={product.presentation?.reviews??[]} {lang}/>
 {/if}</div>{/each}</div>{/each}
</div>

<style>
 .catalog-purchase{display:grid;gap:1rem;container-type:inline-size}.product-content-row{display:grid;gap:1rem;min-width:0}.product-content-row:empty{display:none}.product-content-row.paired{grid-template-columns:repeat(2,minmax(0,1fr))}.product-content-block{min-width:0}.full-content h1{font-family:'Bodoni MT',Didot,Georgia,serif;font-size:clamp(2.5rem,4.3vw,4.3rem);line-height:1.07;letter-spacing:-.035em;font-weight:400;overflow-wrap:anywhere}.product-badge{width:fit-content;border:1px solid #b39a68;background:#eee0c5;color:#57401f;border-radius:99px;padding:.35rem .85rem;font-size:.95rem;font-weight:600}.product-description{white-space:pre-wrap;line-height:1.8;overflow-wrap:anywhere}.product-content-block fieldset+fieldset{margin-top:1rem}@container(max-width:500px){.product-content-row.paired{grid-template-columns:1fr}}
 .catalog-purchase,fieldset{min-width:0}.product-price{padding-top:.75rem;font-size:2rem;line-height:1.2}.availability{font-weight:600;color:#31533e}.availability.unavailable{color:#8d3434}
 .option-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,13rem),1fr));gap:.75rem}
 .option-choice{display:flex;flex-direction:column;align-items:flex-start;justify-content:center;width:100%;min-width:0;text-align:left;overflow-wrap:anywhere}
 .option-label{display:flex;justify-content:space-between;gap:.6rem;width:100%;font-weight:600;font-size:1rem;line-height:1.4}
 .option-explanation{display:block;font-size:.95rem;line-height:1.55;color:inherit}
 .option-select{width:100%;min-height:48px;border:1px solid #92877f;border-radius:.5rem;padding:.7rem;background:#faf7f0;color:#2b252a;font:inherit}
 .radio-list{display:grid;gap:.65rem}.radio-choice{display:flex;align-items:center;gap:.8rem;min-height:48px;padding:.8rem 1rem;border:1px solid #92877f;border-radius:.6rem;cursor:pointer}.radio-choice:has(input:checked){background:#e9dfcc;border-color:#56424f}.radio-choice input{width:1.15rem;height:1.15rem;accent-color:#56424f;flex-shrink:0}.radio-choice>span{min-width:0;overflow-wrap:anywhere}
 .quantity-section{display:grid;gap:.5rem}.quantity-control{display:flex;width:fit-content;border:1px solid #92877f;border-radius:.6rem;overflow:hidden}.quantity-control button{width:48px;min-height:48px;background:#e9dfcc;color:#2b252a;font-size:1.3rem}.quantity-control button:disabled{opacity:.45}.quantity-control input{width:4rem;min-width:0;text-align:center;background:#faf7f0;color:#2b252a;font:inherit;border:0;border-inline:1px solid #92877f}.quantity-hint{font-size:.95rem;color:#574b54}.purchase-action{display:grid;align-items:start;gap:.5rem}.unit-price{margin:0;text-align:center;font-weight:600;font-size:1rem}.stock-error{color:#8d3434;font-weight:500;line-height:1.6}fieldset:disabled{opacity:.7}
 .reservation-invitation{color:var(--product-ink,#2b252a)}
 .reservation-card{display:flex;flex-direction:column;align-items:flex-start;gap:1.5rem;border:1px solid #92877f;border-radius:1rem;padding:clamp(1.25rem,3vw,2rem);background:#e9dfcc}
 .reservation-card p{margin:0;font-size:clamp(1.1rem,1.7vw,1.35rem);font-weight:600;line-height:1.6}
 .reservation-action{display:inline-flex;align-items:center;justify-content:center;gap:.75rem;align-self:flex-end;min-height:48px;padding:.7rem 1.25rem;border:1px solid #30242d;border-radius:.5rem;background:#30242d;color:#f5f1e8;font-weight:600;text-decoration:none}
 .reservation-action:hover{background:#44333f}
 .shop-contact-list{display:grid;gap:.35rem;list-style:none;padding:0;margin:1.25rem 0 0}
 .shop-contact-list a{display:flex;align-items:center;gap:.8rem;min-height:44px;color:inherit;text-decoration:none;font-size:1rem;line-height:1.5}
 .shop-contact-list a:hover span{text-decoration:underline;text-underline-offset:3px}
 .shop-contact-list a span{min-width:0;overflow-wrap:anywhere}
 .shop-contact-list :global(svg){flex-shrink:0}
 @media(max-width:420px){.reservation-action{align-self:stretch}.option-grid{grid-template-columns:1fr}}
</style>

