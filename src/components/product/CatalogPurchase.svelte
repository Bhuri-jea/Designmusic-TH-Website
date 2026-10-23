<script lang="ts">
 import {Facebook,Instagram,Mail,Phone} from 'lucide-svelte';
 import AddToCartButton from '../ui/AddToCartButton.svelte';import {formatPrice,type Locale} from '../../lib/catalog';
 let {product,lang='en'}=$props<{product:any;lang?:Locale}>();
 let selected=$state<Record<string,string>>({});
 let sku=$derived(product.skus.find((row:any)=>product.optionGroups.every((group:any)=>row.optionCodes.includes(selected[group.code])))??(product.optionGroups.length?null:product.skus[0]));
 let currency=$derived(lang==='ja'?'jpy':lang==='th'?'thb':'usd');
 const available=$derived(sku&&sku.onHand-sku.reserved>0);
 const item=$derived(sku?{productId:product.slug,variant:sku.sku,options:Object.keys(selected).length?selected:undefined}:null);
 let copy=$derived({
  en:{invitation:'Please visit our shop or contact us directly.',book:'Book reservation',contact:'Contact the shop',inStock:'In stock',soldOut:'Out of stock',choose:'Choose each option to see price and availability.',email:'Email',phone:'Tel'},
  th:{invitation:'กรุณามาที่ร้านหรือติดต่อเราโดยตรง',book:'จองนัดหมาย',contact:'ติดต่อร้าน',inStock:'พร้อมจำหน่าย',soldOut:'สินค้าหมด',choose:'เลือกตัวเลือกเพื่อดูราคาและสถานะ',email:'อีเมล',phone:'โทร'},
  ja:{invitation:'ご来店いただくか、店舗へ直接お問い合わせください。',book:'来店を予約する',contact:'店舗へのお問い合わせ',inStock:'在庫あり',soldOut:'在庫切れ',choose:'各オプションを選択すると価格と在庫が表示されます。',email:'メール',phone:'電話'},
  'zh-CN':{invitation:'请到店或直接联系我们。',book:'预约到店',contact:'联系店铺',inStock:'有货',soldOut:'缺货',choose:'请选择各项选项以查看价格和库存。',email:'电子邮件',phone:'电话'}
 }[lang]);
</script>
<div class="catalog-purchase space-y-6">{#each product.optionGroups as group}<fieldset><legend class="mb-2 font-medium">{group.label}</legend><div class="option-grid">{#each group.values as value}<button type="button" class="option-choice" aria-pressed={selected[group.code]===value.code} onclick={()=>selected={...selected,[group.code]:value.code}}><span class="option-label">{value.label}{#if selected[group.code]===value.code}<span aria-hidden="true">✓</span>{/if}</span>{#if value.description}<span class="option-explanation">{value.description}</span>{/if}</button>{/each}</div></fieldset>{/each}
 {#if sku}{#if sku.salesMode==='checkout'}<p class="product-price text-3xl font-serif">{sku.prices[currency]!=null?formatPrice(sku.prices[currency],lang):''}</p><p class="availability" class:unavailable={!available}>{available?copy.inStock:copy.soldOut}</p>{#if item}<AddToCartButton {item} {lang} disabled={!available} label={{en:'Add to cart',th:'เพิ่มในตะกร้า',ja:'カートに追加','zh-CN':'加入购物车'}[lang]}/>{/if}{:else}
  <section class="reservation-invitation" aria-label={copy.contact}>
   <div class="reservation-card"><p>{copy.invitation}</p><a class="reservation-action" href={`${lang==='en'?'':'/'+lang}/booking`}>{copy.book} <span aria-hidden="true">↗</span></a></div>
   <ul class="shop-contact-list">
    <li><a href="https://www.facebook.com/DesignmusicInstrumentmusicAccessories" target="_blank" rel="noopener noreferrer"><Facebook size={21} aria-hidden="true"/><span>Facebook</span></a></li>
    <li><a href="https://www.instagram.com/designmusic_instrument/" target="_blank" rel="noopener noreferrer"><Instagram size={21} aria-hidden="true"/><span>Instagram</span></a></li>
    <li><a href="mailto:designmusicthailand@gmail.com"><Mail size={21} aria-hidden="true"/><span>{copy.email}: designmusicthailand@gmail.com</span></a></li>
    <li><a href="tel:+66850915959"><Phone size={21} aria-hidden="true"/><span>{copy.phone}: 085 091 5959</span></a></li>
   </ul>
  </section>
 {/if}{:else}<p>{copy.choose}</p>{/if}</div>

<style>
 .catalog-purchase,fieldset{min-width:0}.product-price{padding-top:.75rem;font-size:2rem;line-height:1.2}.availability{font-weight:600;color:#31533e}.availability.unavailable{color:#8d3434}
 .option-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,13rem),1fr));gap:.75rem}
 .option-choice{display:flex;flex-direction:column;align-items:flex-start;justify-content:center;width:100%;min-width:0;text-align:left;overflow-wrap:anywhere}
 .option-label{display:flex;justify-content:space-between;gap:.6rem;width:100%;font-weight:600;font-size:1rem;line-height:1.4}
 .option-explanation{display:block;font-size:.95rem;line-height:1.55;color:inherit}
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
