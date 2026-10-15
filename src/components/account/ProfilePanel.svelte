<script lang="ts">
 import { onMount } from 'svelte';
 import { signOut } from 'auth-astro/client';
 import { ui } from '../../i18n/ui';
 import { ISO_COUNTRY_CODES } from '../../lib/iso-countries';
 import { localizedPath } from '../../utils/navigation';
 import type { Locale } from '../../lib/catalog';

 type ShippingAddress = { line1: string; line2: string; city: string; state: string; postal_code: string; country: string };
 let { lang } = $props<{ lang: Locale }>();
 let customer = $state<any>(null), name = $state(''), phone = $state(''), status = $state(''), pending = $state(false);
 let address = $state<ShippingAddress>({ line1: '', line2: '', city: '', state: '', postal_code: '', country: '' });
 let hasAddressInput = $derived(Object.values(address).some(value => value.trim() !== ''));
 let countryOptions = $derived.by(() => {
  const names = new Intl.DisplayNames(lang, { type: 'region' });
  const collator = new Intl.Collator(lang);
  return ISO_COUNTRY_CODES.map(code => ({ code, name: names.of(code) ?? code }))
   .sort((a, b) => collator.compare(a.name, b.name));
 });
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
<div class="max-w-4xl mx-auto px-6 py-16 md:py-24 relative z-10">
 <div class="flex flex-wrap justify-between items-start gap-4 mb-8"><div><h1 class="font-serif text-4xl break-words">{t('flow.account')}</h1><p class="mt-3 text-neutral-300 max-w-2xl">{t('flow.profileIntro')}</p></div><button class="btn btn-ghost" onclick={logout}>{t('flow.signOut')}</button></div>
 <div class="bg-[#111415] border border-white/15 rounded-2xl p-5 sm:p-8 mb-10">
 {#if customer}
  <form class="space-y-6" onsubmit={save}>
   <fieldset class="space-y-5">
    <legend class="font-serif text-2xl mb-5">{t('flow.contactDetails')}</legend>
    <div class="grid sm:grid-cols-2 gap-5">
     <div><label class="profile-label" for="profile-name">{t('flow.name')}</label><input id="profile-name" class="profile-input" autocomplete="name" maxlength="120" required bind:value={name}/></div>
     <div><label class="profile-label" for="profile-phone">{t('flow.phone')}</label><input id="profile-phone" class="profile-input" type="tel" autocomplete="tel" maxlength="40" bind:value={phone}/></div>
    </div>
    <div><label class="profile-label" for="profile-email">{t('flow.email')}</label><input id="profile-email" class="profile-input" type="email" readonly value={customer.email} aria-describedby="profile-email-help"/><p id="profile-email-help" class="mt-2 text-sm text-neutral-400">{t('flow.emailHelp')}</p></div>
   </fieldset>
   <fieldset class="rounded-xl border border-white/15 bg-[#1a1f20] p-4 sm:p-6 space-y-5">
    <legend class="font-serif text-2xl px-2">{t('flow.shippingAddress')}</legend>
    <p class="text-sm text-neutral-300">{t('flow.shippingAddressHelp')}</p>
    <div><label class="profile-label" for="address-line1">{t('flow.addressLine1')}</label><input id="address-line1" class="profile-input" autocomplete="address-line1" maxlength="200" required={hasAddressInput} bind:value={address.line1}/></div>
    <div><label class="profile-label" for="address-line2">{t('flow.addressLine2')}</label><input id="address-line2" class="profile-input" autocomplete="address-line2" maxlength="200" bind:value={address.line2}/></div>
    <div class="grid sm:grid-cols-2 gap-5">
     <div><label class="profile-label" for="address-city">{t('flow.addressCity')}</label><input id="address-city" class="profile-input" autocomplete="address-level2" maxlength="120" required={hasAddressInput} bind:value={address.city}/></div>
     <div><label class="profile-label" for="address-state">{t('flow.addressState')}</label><input id="address-state" class="profile-input" autocomplete="address-level1" maxlength="120" bind:value={address.state}/></div>
     <div><label class="profile-label" for="address-postal-code">{t('flow.addressPostalCode')}</label><input id="address-postal-code" class="profile-input" autocomplete="postal-code" maxlength="32" required={hasAddressInput} bind:value={address.postal_code}/></div>
     <div><label class="profile-label" for="address-country">{t('flow.addressCountry')}</label><select id="address-country" class="profile-input" autocomplete="country" required={hasAddressInput} bind:value={address.country} aria-describedby="address-country-help"><option value="">{t('flow.addressCountryPlaceholder')}</option>{#each countryOptions as country}<option value={country.code}>{country.name}</option>{/each}</select></div>
    </div>
    <p id="address-country-help" class="text-sm text-neutral-400">{t('flow.addressCountryHelp')}</p>
   </fieldset>
   <div class="flex flex-wrap items-center gap-4"><button class="btn btn-primary w-full sm:w-auto min-w-40" disabled={pending}>{pending ? t('flow.saving') : t('flow.save')}</button><p role="status" class="text-sm text-neutral-200">{status}</p></div>
  </form>
 {:else if !status}<p role="status">{t('flow.loading')}</p>{:else}<p role="alert">{status}</p>{/if}
 </div>
 <div class="grid md:grid-cols-2 gap-8"><section class="bg-white/5 border border-white/10 rounded-3xl p-6"><h2 class="font-serif text-2xl mb-6">{t('flow.bookings')}</h2>{#if bookingError}<p>{t('flow.unavailable')}</p>{:else if bookings===null}<p>{t('flow.loading')}</p>{:else if !bookings.length}<p>{t('flow.empty')}</p>{:else}{#each bookings as booking}<div class="p-4 border-b border-white/10"><p>{t('booking.'+booking.instrument)} · {t(booking.service==='assessment'?'booking.assessmentLabel':'booking.'+booking.service)}</p><p>{time(booking.startAt)} · Asia/Bangkok</p><p class="text-xs break-all">{booking.id}</p></div>{/each}{/if}<a class="btn mt-6" href={localizedPath('/booking',lang)}>{t('flow.book')}</a><a class="btn btn-ghost mt-3" href={localizedPath('/profile/bookings',lang)}>{t('flow.manageBookings')}</a></section>
 <section class="bg-white/5 border border-white/10 rounded-3xl p-6"><h2 class="font-serif text-2xl mb-6">{t('flow.orders')}</h2>{#if orderError}<p>{t('flow.unavailable')}</p>{:else if orders===null}<p>{t('flow.loading')}</p>{:else if !orders.length}<p>{t('flow.empty')}</p>{:else}{#each orders as order}<a class="block p-4 border-b border-white/10 break-all underline" href={localizedPath('/success',lang)+'?order_id='+order.id}>{order.id}<span class="block text-sm">{t('flow.'+order.status)}</span></a>{/each}{/if}</section></div>
</div>

<style>
 .profile-label { display: block; margin-bottom: 0.5rem; color: #f1eee4; font-weight: 500; }
 .profile-input { width: 100%; min-height: 3rem; padding: 0.7rem 0.85rem; border: 1px solid #728084; border-radius: 0.5rem; background: #282e30; color: #f1eee4; color-scheme: dark; }
 .profile-input:focus-visible { outline: 2px solid #c2aa6a; outline-offset: 2px; border-color: #c2aa6a; }
 input.profile-input:read-only { background: #1e2325; color: #cbd0cf; }
 .profile-input option { background: #282e30; color: #f1eee4; }
</style>
