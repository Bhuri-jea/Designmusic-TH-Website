<script lang="ts">
 import {WORKSHOP_MAP_URL} from '../../lib/workshop';
 import { onMount } from 'svelte';
 import { ui } from '../../i18n/ui';
 import { accountText, type AccountCopyKey } from '../../i18n/account-ui';
 import { localizedPath } from '../../utils/navigation';
 import type { Locale } from '../../lib/catalog';
 import AccountNav from './AccountNav.svelte';
 import ShippingQuotes from './ShippingQuotes.svelte';
 import OrderFinancialStatus from './OrderFinancialStatus.svelte';
 type Order = { id: string; status: string; createdAt: string; currency?:string;cancellationStatus?:string;cancellationReason?:string|null;refundStatus?:string|null;refundedAmount?:number;fulfillmentMethod?: string|null; items?: { quantity?: number }[]; shipment?: { service?: string; trackingNumber?: string|null; trackingUrl?: string|null }|null };
 let { lang } = $props<{ lang: Locale }>();
 let orders = $state<Order[] | null>(null), failed = $state(false), page=$state(1),pageSize=$state(5),total=$state(0),totalPages=$state(1),loading=$state(false);
 const t = (key: string) => ui[lang][key as keyof typeof ui.en] || ui.en[key as keyof typeof ui.en];
 const statusText = (status: string) => {
  if(status==='expired')return accountText(lang,'paymentFailed')+' · '+accountText(lang,'paymentExpired');
  const keys: Record<string,string> = { pending:'paymentPending',paid:'paymentPaid',failed:'paymentFailed',expired:'paymentExpired',review:'paymentReview' };
  return accountText(lang, (keys[status] ?? 'paymentUnknown') as AccountCopyKey);
 };
 const date = (value: string) => {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Bangkok',day:'2-digit',month:'2-digit',year:'numeric'}).formatToParts(new Date(value)).map(part=>[part.type,part.value]));
  return `${parts.day}/${parts.month}/${parts.year}`;
 };
 const serviceCode = (order:Order) => order.shipment?.service ?? order.fulfillmentMethod ?? undefined;
 const serviceName = (service: string) => service === 'pickup' ? accountText(lang,'pickup') : ({ ems_local:'EMS (Thailand)', ems_world:'EMS (international)', epacket:'Thailand Post ePacket', flash:'Flash Express' }[service] ?? service);
 const trackingUrl=(order:Order)=>order.shipment?.trackingUrl??({ems_local:'https://track.thailandpost.com',ems_world:'https://track.thailandpost.co.th/?lang=en',epacket:'https://track.thailandpost.co.th/?lang=en',flash:'https://www.flashexpress.com/fle/tracking'} as Record<string,string>)[serviceCode(order)??''];
 const visibleOrders = $derived(orders??[]);
 const paging={en:{previous:'Previous',next:'Next',page:'Page'},th:{previous:'ก่อนหน้า',next:'ถัดไป',page:'หน้า'},ja:{previous:'前へ',next:'次へ',page:'ページ'},'zh-CN':{previous:'上一页',next:'下一页',page:'页'}};
 const pageNumbers=$derived([...new Set([1,...Array.from({length:5},(_,i)=>page-2+i).filter(n=>n>1&&n<totalPages),totalPages])].sort((a,b)=>a-b));
 async function load(requestedPage=page,requestedSize=pageSize) {
  if(loading)return;loading=true;failed = false;
  try { const response = await fetch('/api/orders?page='+requestedPage+'&page_size='+requestedSize, { cache: 'no-store' }); const data = await response.json(); if (!response.ok || !Array.isArray(data.orders)) throw Error(); orders = data.orders;page=requestedPage;pageSize=requestedSize;total=data.pagination?.total??orders!.length;totalPages=data.pagination?.totalPages??1; }
  catch { failed = true; }finally{loading=false;}
 }
 onMount(() => { void load(); });
</script>

<div class="max-w-4xl mx-auto px-6 py-16 md:py-24 relative z-10">
 <h1 class="font-serif text-4xl mb-8">{accountText(lang, 'orders')}</h1>
 <AccountNav {lang} active="orders" />
 {#if failed}<div role="alert" class="alert">{t('flow.unavailable')} <button class="underline" onclick={()=>load()}>{t('flow.retry')}</button></div>
 {:else if orders === null}<p role="status">{t('flow.loading')}</p>
 {:else if orders.length === 0}<p class="text-neutral-300">{accountText(lang, 'emptyOrders')}</p>
 {:else}<div class="space-y-4">{#each visibleOrders as order (order.id)}
  {@const totalQuantity = (order.items ?? []).reduce((sum, item) => sum + (Number.isSafeInteger(item.quantity) && (item.quantity ?? 0) > 0 ? item.quantity! : 0), 0)}
  <article class="bg-white/5 border border-white/10 rounded-2xl p-5 sm:p-6">
   <h2 class="font-medium leading-relaxed"><a class="text-amber-100 underline underline-offset-4" href={localizedPath('/success',lang)+'?order_id='+encodeURIComponent(order.id)}>{accountText(lang,'orderLabel')} {date(order.createdAt)} · {totalQuantity} {accountText(lang,'quantity')}</a></h2>
   {#if !order.cancellationStatus||order.cancellationStatus==='none'}<p class="mt-2 text-sm text-neutral-200">{statusText(order.status)}</p>{/if}
   <OrderFinancialStatus {order} {lang}/>
   <p class="mt-1 text-xs text-neutral-400">{accountText(lang,'orderId')}: <span class="break-all font-mono">{order.id}</span></p>
   {#if order.status === 'paid'&&(!order.cancellationStatus||order.cancellationStatus==='none')}
   {#if order.shipment?.trackingNumber}<p class="mt-3 text-sm text-neutral-200">{accountText(lang,'trackingNumber')}: <span class="font-mono">{order.shipment.trackingNumber}</span></p>{/if}
   {#if serviceCode(order) === 'pickup'}<p class="mt-2 text-sm">{accountText(lang,'shippingService')}: <a class="text-amber-200 underline underline-offset-4" href={WORKSHOP_MAP_URL} target="_blank" rel="noopener noreferrer">{serviceName('pickup')}</a></p>
   {:else if serviceCode(order)}<p class="mt-2 text-sm">{accountText(lang,'shippingService')}: {#if trackingUrl(order)}<a class="text-amber-200 underline underline-offset-4" href={trackingUrl(order)} target="_blank" rel="noopener noreferrer">{serviceName(serviceCode(order)!)}</a>{:else}<span class="text-neutral-300">{serviceName(serviceCode(order)!)}</span>{/if}</p>{/if}
   {/if}
  </article>
 {/each}</div>
 {#if pageSize===5&&total>5}<button class="btn btn-ghost mt-6" disabled={loading} onclick={()=>load(1,50)}>{accountText(lang,'seeMore')}</button>{:else if pageSize===50}<nav class="flex flex-wrap items-center gap-2 mt-6" aria-label={accountText(lang,'orders')+' '+paging[lang].page}><button class="btn btn-ghost" disabled={loading||page===1} onclick={()=>load(page-1)}>{paging[lang].previous}</button>{#each pageNumbers as n,i}{#if i&&n>pageNumbers[i-1]+1}<span aria-hidden="true">…</span>{/if}<button class="btn btn-ghost" disabled={loading} aria-current={n===page?'page':undefined} class:ring-1={n===page} onclick={()=>load(n)}>{n}</button>{/each}<button class="btn btn-ghost" disabled={loading||page===totalPages} onclick={()=>load(page+1)}>{paging[lang].next}</button><span class="text-sm text-neutral-300">{paging[lang].page} {page} / {totalPages}</span><button class="btn btn-ghost" disabled={loading} onclick={()=>load(1,5)}>{accountText(lang,'showLess')}</button></nav>{/if}{/if}
 <div class="mt-12"><ShippingQuotes {lang}/></div>
</div>
