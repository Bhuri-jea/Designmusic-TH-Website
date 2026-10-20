<script lang="ts">
 import { onMount } from 'svelte';
 import { ui } from '../../i18n/ui';
 import { accountText, type AccountCopyKey } from '../../i18n/account-ui';
 import { localizedPath } from '../../utils/navigation';
 import type { Locale } from '../../lib/catalog';
 import AccountNav from './AccountNav.svelte';
 import ShippingQuotes from './ShippingQuotes.svelte';
 type Order = { id: string; status: string; createdAt: string; fulfillmentMethod?: string|null; items?: { quantity?: number }[]; shipment?: { service?: string; trackingNumber?: string|null; trackingUrl?: string|null }|null };
 let { lang } = $props<{ lang: Locale }>();
 let orders = $state<Order[] | null>(null), failed = $state(false), visibleCount = $state(5);
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
 const visibleOrders = $derived((orders ?? []).slice(0, visibleCount));
 async function load() {
  failed = false;
  try { const response = await fetch('/api/orders', { cache: 'no-store' }); const data = await response.json(); if (!response.ok || !Array.isArray(data.orders)) throw Error(); orders = data.orders; }
  catch { failed = true; }
 }
 onMount(() => { void load(); });
</script>

<div class="max-w-4xl mx-auto px-6 py-16 md:py-24 relative z-10">
 <h1 class="font-serif text-4xl mb-8">{accountText(lang, 'orders')}</h1>
 <AccountNav {lang} active="orders" />
 {#if failed}<div role="alert" class="alert">{t('flow.unavailable')} <button class="underline" onclick={load}>{t('flow.retry')}</button></div>
 {:else if orders === null}<p role="status">{t('flow.loading')}</p>
 {:else if orders.length === 0}<p class="text-neutral-300">{accountText(lang, 'emptyOrders')}</p>
 {:else}<div class="space-y-4">{#each visibleOrders as order (order.id)}
  {@const totalQuantity = (order.items ?? []).reduce((sum, item) => sum + (Number.isSafeInteger(item.quantity) && (item.quantity ?? 0) > 0 ? item.quantity! : 0), 0)}
  <article class="bg-white/5 border border-white/10 rounded-2xl p-5 sm:p-6">
   <h2 class="font-medium leading-relaxed"><a class="text-amber-100 underline underline-offset-4" href={localizedPath('/success',lang)+'?order_id='+encodeURIComponent(order.id)}>{accountText(lang,'orderLabel')} · {accountText(lang,'orderDate')} {date(order.createdAt)} · {totalQuantity} {accountText(lang,'quantity')}</a></h2>
   <p class="mt-2 text-sm text-neutral-200">{statusText(order.status)}</p>
   <p class="mt-1 text-xs text-neutral-400">{accountText(lang,'orderId')}: <span class="break-all font-mono">{order.id}</span></p>
   {#if order.shipment?.trackingNumber}<p class="mt-3 text-sm text-neutral-200">{accountText(lang,'trackingNumber')}: <span class="font-mono">{order.shipment.trackingNumber}</span></p>{/if}
   {#if serviceCode(order) === 'pickup'}<p class="mt-2 text-sm">{accountText(lang,'shippingService')}: <a class="text-amber-200 underline underline-offset-4" href="/policies#shipping-returns">{serviceName('pickup')}</a></p>
   {:else if serviceCode(order)}<p class="mt-2 text-sm">{accountText(lang,'shippingService')}: {#if trackingUrl(order)}<a class="text-amber-200 underline underline-offset-4" href={trackingUrl(order)} target="_blank" rel="noopener noreferrer">{serviceName(serviceCode(order)!)}</a>{:else}<span class="text-neutral-300">{serviceName(serviceCode(order)!)}</span>{/if}</p>{/if}
  </article>
 {/each}</div>
 {#if orders.length > visibleCount}<button class="btn btn-ghost mt-6" onclick={() => visibleCount += 5}>{accountText(lang,'seeMore')}</button>{:else if visibleCount > 5}<button class="btn btn-ghost mt-6" onclick={() => visibleCount = 5}>{accountText(lang,'showLess')}</button>{/if}{/if}
 <div class="mt-12"><ShippingQuotes {lang}/></div>
</div>
