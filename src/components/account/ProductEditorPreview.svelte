<script lang="ts">
 import {tick} from 'svelte';
 import CatalogPurchase from '../product/CatalogPurchase.svelte';
 import {productOptionDescription} from '../../lib/product-option-copy';
 import type {Locale} from '../../lib/catalog';
 let {product,lang='en'}=$props<{product:any;lang?:'en'|'th'}>();
 let locale=$state<Locale>('en'),dialog=$state<HTMLDialogElement>(),modalOpen=$state(false);
 let translated=$derived(product.translations.find((row:any)=>row.locale===locale));
 let previewProduct=$derived({...product,...translated,name:translated?.name||'…',optionGroups:product.optionGroups.map((group:any)=>({...group,label:group.labels[locale]||group.code,values:group.values.map((value:any)=>({...value,label:value.labels[locale]||value.code,description:productOptionDescription(product.slug,group.code,value.code,value.labels,locale)}))})),skus:product.skus.filter((row:any)=>row.lifecycle==='active').map((row:any)=>({...row,optionCodes:row.optionValueCodes,prices:{usd:row.usd==null?null:Math.round(row.usd*100),thb:row.thb==null?null:Math.round(row.thb*100),jpy:row.jpy}}))});
 export async function open(){modalOpen=true;await tick();dialog?.showModal();}
 function close(){dialog?.close();modalOpen=false;}
 $effect(()=>{if(!modalOpen)return;const previous=document.body.style.overflow;document.body.style.overflow='hidden';return()=>{document.body.style.overflow=previous;};});
</script>
{#snippet content(modal=false)}
 <div class="preview-toolbar"><div><h2>{lang==='th'?'ตัวอย่างทันที':'Live preview'}</h2><p class="catalog-help">{lang==='th'?'ตัวอย่างเท่านั้น ไม่เพิ่มสินค้าในตะกร้า':'Preview only. Purchasing is disabled.'}</p></div><label><span class="sr-only">{lang==='th'?'ภาษาตัวอย่าง':'Preview language'}</span><select class="input" bind:value={locale}><option value="en">English</option><option value="th">ภาษาไทย</option><option value="ja">日本語</option><option value="zh-CN">中文</option></select></label>{#if modal}<button type="button" class="btn" aria-label={lang==='th'?'ปิดตัวอย่าง':'Close preview'} onclick={close}>×</button>{/if}</div>
 <div class="preview-product-surface">{#if product.images.length}<img class="preview-main-image" src={(product.images.find((image:any)=>image.primary)??product.images[0]).url} alt={(product.images.find((image:any)=>image.primary)??product.images[0]).alt}/>{/if}<CatalogPurchase product={previewProduct} lang={locale} fullContent preview/></div>
{/snippet}
<aside class="live-preview" aria-label={lang==='th'?'ตัวอย่างสินค้าทันที':'Live product preview'}>{@render content()}</aside>
<dialog class="preview-dialog" bind:this={dialog} aria-label={lang==='th'?'ตัวอย่างสินค้า':'Product preview'} onclose={()=>modalOpen=false}>{#if modalOpen}{@render content(true)}{/if}</dialog>
<style>.preview-main-image{width:100%;max-height:18rem;object-fit:contain;margin-bottom:1rem}.preview-product-surface :global(.full-content h1){font-size:2.1rem}.preview-toolbar h2{margin-bottom:0}.preview-toolbar label{min-width:7rem}.preview-dialog{z-index:200}.preview-product-surface{container-type:inline-size}.preview-product-surface :global(.catalog-purchase){color:#2b252a}.preview-product-surface :global(.btn-primary){background:#30242d!important;color:#f5f1e8!important}</style>
