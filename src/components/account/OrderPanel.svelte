<script lang="ts">
 import OrderSupport from './OrderSupport.svelte';
 import OrderFinancialStatus from './OrderFinancialStatus.svelte';
 import WorkshopLocation from '../ui/WorkshopLocation.svelte';
 import { onMount } from 'svelte';
 import { ui } from '../../i18n/ui';
 import { accountText } from '../../i18n/account-ui';
 import { cart } from '../../store/cart.svelte';
 import { localizedPath } from '../../utils/navigation';
 import type { Locale } from '../../lib/catalog';
 import {orderDelivery} from '../../lib/order-delivery';
 import {serviceLabel} from '../../i18n/shipping';
 import {CheckoutError, resumeHostedCheckout} from '../../lib/checkout-client';
 type Line = { name:string; sku?:string; variant?:string; options?:Record<string,string>; quantity:number; unitAmount:number };
 type Order = { id:string; status:string; currency:'usd'|'jpy'|'thb'; locale?:Locale; items:Line[]; createdAt:string; amountSubtotal?:number; shippingAmount?:number; amountTotal:number; paymentSummary?:{method?:string|null;brand?:string|null;last4?:string|null}; fulfillmentMethod?:string; shipment?:{service?:string;trackingNumber?:string|null;trackingUrl?:string|null}|null; shippingCountry?:string;cancellationStatus?:string;cancellationReason?:string|null;refundStatus?:string|null;refundedAmount?:number };
 let {lang,orderId,cancelled=false}=$props<{lang:Locale;orderId?:string|null;cancelled?:boolean}>();
 let state=$state('unknown'),order=$state<Order|null>(null),pending=$state(false),resuming=$state(false),resumeMessage=$state('');let active=true;
 const t=(key:string)=>ui[lang][key as keyof typeof ui.en] || ui.en[key as keyof typeof ui.en];
 const money = (value:number) => new Intl.NumberFormat(lang,{style:'currency',currency:(order?.currency??'usd').toUpperCase(),maximumFractionDigits:order?.currency==='jpy'?0:2}).format(value/(order?.currency==='jpy'?1:100));
 const subtotal = $derived(order?.amountSubtotal ?? (order?.items ?? []).reduce((sum,line)=>sum+line.unitAmount*line.quantity,0));
 const shipping = $derived(order?.shippingAmount ?? Math.max(0,(order?.amountTotal ?? 0)-subtotal));
 const delivery=$derived(order?orderDelivery(order):null);
 const optionText = (line:Line) => Object.entries(line.options??{}).map(([key,value])=>key==='toneHoles'?t(`product.tone.${value}`)||value:key==='mouthpiece'?t(`product.mouth.${value}`)||value:value).concat(line.variant && line.variant !== 'standard' ? [t(line.variant==='plain'?'product.endplug.plain':line.variant==='twoColor'?'product.endplug.twocolor':'product.endplug.custom')||line.variant] : []).join(' · ');
 async function refresh(){if(pending || !orderId || !/^[0-9a-f-]{36}$/i.test(orderId))return;pending=true;try{const res=await fetch('/api/orders?order_id='+encodeURIComponent(orderId),{cache:'no-store'});const data=await res.json();if(!active)return;if(res.status===401){state='signInRequired';return;}if(!res.ok){state='unavailable';return;}order=data.orders?.find((value:Order)=>value.id===orderId)??null;state=order&&['pending','paid','failed','expired','review'].includes(order.status)?order.status:'unknown';if(state==='paid'){cart.init(lang);cart.reconcile(order);}}catch{state='unavailable';}finally{pending=false;}}
 async function resumePayment(){
  if(resuming||pending||state!=='pending'||!orderId)return;
  resuming=true;resumeMessage='';
  try{window.location.assign(await resumeHostedCheckout(orderId));}
  catch(error){
   const code=error instanceof CheckoutError?error.code:'checkout_unavailable';
   if(code==='sign_in_required')state='signInRequired';
   else if(code==='payment_confirmation_pending'){resumeMessage=t('flow.paymentSubmitted');await refresh();}
   else if(code==='checkout_expired'||code==='checkout_not_active'){resumeMessage=t('flow.resumeExpired');await refresh();}
   else if(code==='checkout_requires_review'||code==='payment_metadata_mismatch')state='review';
   else resumeMessage=t('flow.resumeUnavailable');
  }finally{resuming=false;}
 }
 onMount(()=>{cart.init(lang);if(cancelled)return;let timer:ReturnType<typeof setTimeout>;let attempts=0;const poll=async()=>{await refresh();if(active&&state==='pending'&&++attempts<5)timer=setTimeout(poll,3000);};void poll();return()=>{active=false;clearTimeout(timer);};});
</script>

{#snippet support()}
 {#if order && !['signInRequired','unavailable','unknown'].includes(state)}<OrderSupport orderId={order.id} {lang}/>{/if}
{/snippet}
<div class="max-w-3xl mx-auto px-6 py-10 md:py-16 relative z-10">
 <section class="text-center"><div class="flex justify-center mb-4"><div class="p-3 rounded-full bg-white/5 border border-white/10"><svg viewBox="0 0 24 24" aria-hidden="true" class="w-8 h-8"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.7"/>{#if state==='paid'}<path d="M8 12.5l2.5 2.5 5.5-6" fill="none" stroke="currentColor" stroke-width="1.7"/>{:else}<path d="M12 6v7m0 4v1" stroke="currentColor" stroke-width="1.7"/>{/if}</svg></div></div>
  <h1 class="font-serif text-3xl md:text-4xl mb-3">{t('flow.payment')}</h1><p class="text-lg text-neutral-300 mb-4" role="status">{pending?t('flow.loading'):order?.cancellationStatus==='cancelled'?t(order.refundStatus==='succeeded'?'flow.refunded':'flow.cancelledOrder'):t(cancelled?'flow.cancelled':'flow.'+state)}</p>
  {#if order}<p class="break-all text-sm text-neutral-400 mb-5">{accountText(lang,'orderId')}: {order.id}</p><OrderFinancialStatus {order} {lang}/>{/if}
  {#if state==='signInRequired'}<a class="btn mb-5" href={localizedPath('/login',lang)+'?returnTo='+encodeURIComponent(localizedPath('/success',lang)+(orderId?'?order_id='+orderId:''))}>{t('flow.login')}</a>{/if}
  {#if !cancelled && ['pending','unavailable'].includes(state)}<div class="mb-5 flex flex-wrap justify-center gap-3">{#if state==='pending'&&order}<button class="btn btn-primary" disabled={pending||resuming} onclick={resumePayment}>{resuming?t('flow.resumingCheckout'):t('flow.continueCheckout')}</button>{/if}<button class="btn" disabled={pending||resuming} onclick={refresh}>{t('flow.retry')}</button></div>{/if}
  {#if resumeMessage}<p class="mx-auto mb-5 max-w-xl text-sm text-amber-100" role="status" aria-live="polite">{resumeMessage}</p>{/if}
  <div class="flex flex-wrap justify-center gap-3"><a class="btn btn-primary" href={localizedPath('/product',lang)}>{t('flow.shop')}</a><a class="btn" href={localizedPath('/profile/orders',lang)}>{accountText(lang,'orders')}</a><a class="btn btn-ghost" href={localizedPath('/profile',lang)}>{t('flow.account')}</a></div>
 </section>
 {#if order && order.items?.length}
  <section aria-labelledby="order-summary-title" class="mt-12 bg-[#111415] border border-white/15 rounded-2xl p-5 sm:p-7 text-left">
   <h2 id="order-summary-title" class="font-serif text-2xl mb-5">{accountText(lang,'details')}</h2>
   <div class="space-y-4">{#each order.items as line (line.sku ?? line.name)}<article class="border-b border-white/10 pb-4"><div class="flex justify-between gap-4"><div class="min-w-0 break-words"><h3 class="font-medium">{line.name}</h3>{#if optionText(line)}<p class="text-sm text-neutral-400 mt-1">{accountText(lang,'option')}: {optionText(line)}</p>{/if}{#if line.sku}<p class="mt-1 break-all text-xs text-neutral-500">SKU: {line.sku}</p>{/if}</div><p class="shrink-0 font-medium">{money(line.unitAmount * line.quantity)}</p></div><dl class="mt-3 grid grid-cols-2 gap-y-1 text-sm text-neutral-300"><dt>{accountText(lang,'quantity')}</dt><dd class="text-right">{line.quantity}</dd><dt>{accountText(lang,'unitPrice')}</dt><dd class="text-right">{money(line.unitAmount)}</dd><dt>{accountText(lang,'lineTotal')}</dt><dd class="text-right">{money(line.unitAmount * line.quantity)}</dd></dl></article>{/each}</div>
   <dl class="mt-5 space-y-2 text-sm"><div class="flex justify-between gap-4"><dt>{accountText(lang,'subtotal')}</dt><dd>{money(subtotal)}</dd></div><div class="flex justify-between gap-4"><dt>{accountText(lang,'shipping')}</dt><dd>{money(shipping)}</dd></div><div class="flex justify-between gap-4 border-t border-white/15 pt-3 text-base font-semibold"><dt>{state==='paid'?accountText(lang,'paidTotal'):accountText(lang,'total')}</dt><dd>{money(order.amountTotal)}</dd></div></dl>
   <div class="mt-5 border-t border-white/10 pt-4"><p class="text-sm"><span class="text-neutral-400">{accountText(lang,'paymentMethod')}:</span> {#if order.paymentSummary?.method}{order.paymentSummary.method}{#if order.paymentSummary.brand} · {order.paymentSummary.brand}{/if}{#if order.paymentSummary.last4} •••• {order.paymentSummary.last4}{/if}{:else}<span class="text-neutral-400">{accountText(lang,'paymentUnavailable')}</span>{/if}</p></div>
  </section>
 {/if}
 {#if delivery}<section class="mt-8 rounded-xl border border-white/15 p-5 text-left" aria-label={accountText(lang,'shippingService')}>
  {#if delivery.service!=='pickup'}<p>{accountText(lang,'trackingNumber')}: <span class="break-all font-mono">{delivery.trackingNumber??'—'}</span></p>{/if}
  <p class="mt-2">{accountText(lang,'shippingService')}: {#if delivery.url}<a class="underline underline-offset-4" href={delivery.url} target="_blank" rel="noopener noreferrer">{serviceLabel(lang,delivery.service)}</a>{:else}{serviceLabel(lang,delivery.service)}{/if}</p>
 </section>{/if}
 {#if delivery?.service==='pickup'}<div class="mt-8"><WorkshopLocation {lang}/></div>{/if}
</div>
{@render support()}
