<script lang="ts">
 import { onMount } from 'svelte';
 import { ui } from '../../i18n/ui';
 import { localizedPath } from '../../utils/navigation';
 import type { Locale } from '../../lib/catalog';

 type Booking = { id: string; startAt: string; endAt: string; instrument: string; service: string; status: string };
 type Slot = { startAt: string; endAt: string };
 let { lang } = $props<{ lang: Locale }>();
 let bookings = $state<Booking[] | null>(null), slots = $state<Slot[]>([]);
 let selected = $state<Record<string, string>>({}), pending = $state<string | null>(null);
 let status = $state(''), error = $state(false), calendarSource = $state('database');
 const t = (key: string) => ui[lang][key as keyof typeof ui.en] || ui.en[key as keyof typeof ui.en];
 const dateTime = (value: string) => new Intl.DateTimeFormat(lang, { timeZone: 'Asia/Bangkok', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
 const slotLabel = (slot: Slot) => `${dateTime(slot.startAt)} – ${new Intl.DateTimeFormat(lang, { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(slot.endAt))}`;
 async function load() {
  error = false;
  try {
   const [bookingResponse, availabilityResponse] = await Promise.all([
    fetch('/api/bookings', { cache: 'no-store' }),
    fetch('/api/booking-availability', { cache: 'no-store' }),
   ]);
   const bookingData = await bookingResponse.json(), availabilityData = await availabilityResponse.json();
   if (!bookingResponse.ok || !availabilityResponse.ok || !Array.isArray(bookingData.bookings) || !Array.isArray(availabilityData.slots)) throw Error();
   bookings = bookingData.bookings;
   slots = availabilityData.slots;
   calendarSource = availabilityData.source;
  } catch { error = true; }
 }
 onMount(() => { void load(); });
 async function reschedule(booking: Booking) {
  if (pending) return;
  const slot = selected[booking.id];
  if (!slot) { status = t('booking.select'); return; }
  pending = booking.id; status = '';
  try {
   const response = await fetch(`/api/bookings/${encodeURIComponent(booking.id)}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ changeKey: crypto.randomUUID(), slot }),
   });
   const data = await response.json();
   if (!response.ok) throw Error(response.status === 409 ? 'conflict' : 'failed');
   bookings = (bookings ?? []).map(item => item.id === booking.id ? data.booking : item);
   selected[booking.id] = '';
   status = t('booking.timeUpdated');
   await load();
  } catch (cause) { status = cause instanceof Error && cause.message === 'conflict' ? t('booking.collision') : t('flow.failed'); }
  finally { pending = null; }
 }
 async function cancel(booking: Booking) {
  if (pending || !window.confirm(t('booking.cancelConfirm'))) return;
  pending = booking.id; status = '';
  try {
   const response = await fetch(`/api/bookings/${encodeURIComponent(booking.id)}`, { method: 'DELETE' });
   const data = await response.json();
   if (!response.ok) throw Error();
   bookings = (bookings ?? []).map(item => item.id === booking.id ? data.booking : item);
   status = t('booking.cancelledStatus');
  } catch { status = t('flow.failed'); }
  finally { pending = null; }
 }
 const instrumentLabel = (booking: Booking) => t(`booking.${booking.instrument}`);
 const serviceLabel = (booking: Booking) => t(booking.service === 'assessment' ? 'booking.assessmentLabel' : `booking.${booking.service}`);
</script>

<div class="max-w-4xl mx-auto px-6 py-24 relative z-10">
 <div class="flex flex-wrap items-center justify-between gap-4 mb-8">
  <h1 class="font-serif text-4xl">{t('booking.manageTitle')}</h1>
  <a class="btn btn-ghost" href={localizedPath('/profile', lang)}>{t('flow.account')}</a>
 </div>
 <p class="text-sm text-neutral-400 mb-8">{t('booking.availabilityHelp')}</p>
 {#if error}
  <div role="alert" class="alert">{t('flow.unavailable')} <button class="underline" onclick={load}>{t('flow.retry')}</button></div>
 {:else if bookings === null}
  <p role="status">{t('flow.loading')}</p>
 {:else if !bookings.some(booking => booking.status === 'confirmed' && Date.parse(booking.startAt) > Date.now())}
  <p>{t('booking.noManageable')}</p>
 {:else}
  <div class="space-y-6">
   {#each bookings.filter(booking => booking.status === 'confirmed' && Date.parse(booking.startAt) > Date.now()) as booking (booking.id)}
    <section class="bg-white/5 border border-white/10 rounded-3xl p-6">
     <h2 class="font-serif text-2xl">{instrumentLabel(booking)} · {serviceLabel(booking)}</h2>
     <p class="text-neutral-300 mt-2">{dateTime(booking.startAt)} · Asia/Bangkok (UTC+7)</p>
     <p class="text-xs text-neutral-500 break-all mt-2">{booking.id}</p>
     <div class="mt-6 grid gap-4 sm:grid-cols-[1fr_auto_auto]">
      <label class="sr-only" for={`slot-${booking.id}`}>{t('booking.time')}</label>
      <select id={`slot-${booking.id}`} class="select w-full" bind:value={selected[booking.id]} disabled={pending === booking.id}>
       <option value="">—</option>
       {#each slots as slot (slot.startAt)}<option value={slot.startAt}>{slotLabel(slot)}</option>{/each}
      </select>
      <button class="btn btn-primary" disabled={pending !== null || !slots.length} onclick={() => reschedule(booking)}>{pending === booking.id ? t('flow.saving') : t('booking.reschedule')}</button>
      <button class="btn btn-ghost" disabled={pending !== null} onclick={() => cancel(booking)}>{t('booking.cancel')}</button>
     </div>
    </section>
   {/each}
  </div>
 {/if}
 <p role="status" class="mt-6">{status}</p>
</div>
