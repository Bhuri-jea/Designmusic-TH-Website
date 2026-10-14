<script lang="ts">
 import { onMount } from 'svelte';
 import { signOut } from 'auth-astro/client';
 import { ui } from '../../i18n/ui';
 import { localizedPath } from '../../utils/navigation';
 import type { Locale } from '../../lib/catalog';

 type ShippingAddress = { line1: string; line2: string; city: string; state: string; postal_code: string; country: string };
 let { lang } = $props<{ lang: Locale }>();
 let customer = $state<any>(null), name = $state(''), phone = $state(''), status = $state(''), pending = $state(false);
 let address = $state<ShippingAddress>({ line1: '', line2: '', city: '', state: '', postal_code: '', country: '' });
 let orders = $state<any[] | null>(null), bookings = $state<any[] | null>(null), orderError = $state(false), bookingError = $state(false);
 const t = (key: string) => ui[lang][key as keyof typeof ui.en];
 async function load(endpoint: string) {
  const res = await fetch(endpoint, { cache: 'no-store' });
  if (!res.ok) throw Error();
  return await res.json();
 }
 function applyCustomer(data: any) {
  customer = data;
  name = data.name;
  phone = data.phone ?? '';
  address = data.shippingAddress ?? { line1: '', line2: '', city: '', state: '', postal_code: '', country: '' };
 }
 onMount(() => {
  load('/api/profile').then(data => applyCustomer(data.customer)).catch(() => status = t('flow.unavailable'));
  load('/api/orders').then(data => orders = data.orders).catch(() => orderError = true);
  load('/api/bookings').then(data => bookings = data.bookings).catch(() => bookingError = true);
 });
 async function save(event: SubmitEvent) {
  event.preventDefault();
  if (pending) return;
  pending = true;
  status = t('flow.saving');
  try {
   const res = await fetch('/api/profile', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, phone: phone.trim() || null, shippingAddress: { ...address, country: address.country.toUpperCase() } }),
   });
   const data = await res.json();
   if (!res.ok) throw Error();
   applyCustomer(data.customer);
   status = t('flow.saved');
  } catch { status = t('flow.failed'); }
  finally { pending = false; }
 }
 async function logout() { await (signOut as any)({ callbackUrl: localizedPath('/', lang) }); }
 const time = (value: string) => new Intl.DateTimeFormat(lang, { timeZone: 'Asia/Bangkok', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
</script>
<div class="max-w-4xl mx-auto px-6 py-24 relative z-10">
 <div class="flex flex-wrap justify-between items-center gap-4 mb-12"><h1 class="font-serif text-4xl break-words">{t('flow.account')}</h1><button class="btn btn-ghost" onclick={logout}>{t('flow.signOut')}</button></div>
 <div class="bg-neutral-900/60 border border-white/10 rounded-3xl p-8 mb-10">
 {#if customer}
  <form class="space-y-5" onsubmit={save}>
   <label class="block" for="profile-name">{t('flow.name')}</label>
   <input id="profile-name" class="input w-full" autocomplete="name" maxlength="120" required bind:value={name}/>
   <label class="block" for="profile-email">{t('flow.email')}</label>
   <input id="profile-email" class="input w-full" type="email" readonly value={customer.email}/>
   <p class="text-sm text-neutral-400">{t('flow.emailHelp')}</p>
   <label class="block" for="profile-phone">{t('flow.phone')}</label>
   <input id="profile-phone" class="input w-full" type="tel" autocomplete="tel" maxlength="40" bind:value={phone}/>
   <fieldset class="space-y-4 border-t border-white/10 pt-5">
    <legend class="font-serif text-2xl">{t('flow.shippingAddress')}</legend>
    <p class="text-sm text-neutral-400">{t('flow.shippingAddressHelp')}</p>
    <label class="block" for="address-line1">{t('flow.addressLine1')}</label>
    <input id="address-line1" class="input w-full" autocomplete="address-line1" maxlength="200" bind:value={address.line1}/>
    <label class="block" for="address-line2">{t('flow.addressLine2')}</label>
    <input id="address-line2" class="input w-full" autocomplete="address-line2" maxlength="200" bind:value={address.line2}/>
    <div class="grid sm:grid-cols-2 gap-4">
     <div><label class="block mb-2" for="address-city">{t('flow.addressCity')}</label><input id="address-city" class="input w-full" autocomplete="address-level2" maxlength="120" bind:value={address.city}/></div>
     <div><label class="block mb-2" for="address-state">{t('flow.addressState')}</label><input id="address-state" class="input w-full" autocomplete="address-level1" maxlength="120" bind:value={address.state}/></div>
     <div><label class="block mb-2" for="address-postal-code">{t('flow.addressPostalCode')}</label><input id="address-postal-code" class="input w-full" autocomplete="postal-code" maxlength="32" bind:value={address.postal_code}/></div>
     <div><label class="block mb-2" for="address-country">{t('flow.addressCountry')}</label><input id="address-country" class="input w-full uppercase" autocomplete="country" maxlength="2" minlength="2" pattern="[A-Za-z]{2}" bind:value={address.country}/></div>
    </div>
   </fieldset>
   <button class="btn btn-primary" disabled={pending}>{pending ? t('flow.saving') : t('flow.save')}</button>
  </form>
 {:else if !status}<p>{t('flow.loading')}</p>{/if}
 <p role="status" class="mt-4">{status}</p>
 </div>
 <div class="grid md:grid-cols-2 gap-8"><section class="bg-white/5 border border-white/10 rounded-3xl p-6"><h2 class="font-serif text-2xl mb-6">{t('flow.bookings')}</h2>{#if bookingError}<p>{t('flow.unavailable')}</p>{:else if bookings===null}<p>{t('flow.loading')}</p>{:else if !bookings.length}<p>{t('flow.empty')}</p>{:else}{#each bookings as booking}<div class="p-4 border-b border-white/10"><p>{t('booking.'+booking.instrument)} · {t(booking.service==='assessment'?'booking.assessmentLabel':'booking.'+booking.service)}</p><p>{time(booking.startAt)} · Asia/Bangkok</p><p class="text-xs break-all">{booking.id}</p></div>{/each}{/if}<a class="btn mt-6" href={localizedPath('/booking',lang)}>{t('flow.book')}</a><a class="btn btn-ghost mt-3" href={localizedPath('/profile/bookings',lang)}>{t('flow.manageBookings')}</a></section>
 <section class="bg-white/5 border border-white/10 rounded-3xl p-6"><h2 class="font-serif text-2xl mb-6">{t('flow.orders')}</h2>{#if orderError}<p>{t('flow.unavailable')}</p>{:else if orders===null}<p>{t('flow.loading')}</p>{:else if !orders.length}<p>{t('flow.empty')}</p>{:else}{#each orders as order}<a class="block p-4 border-b border-white/10 break-all underline" href={localizedPath('/success',lang)+'?order_id='+order.id}>{order.id}<span class="block text-sm">{t('flow.'+order.status)}</span></a>{/each}{/if}</section></div>
</div>