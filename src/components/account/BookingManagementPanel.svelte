<script lang="ts">
 import { onMount } from 'svelte';
 import { ui } from '../../i18n/ui';
 import { accountText } from '../../i18n/account-ui';
 import { localizedPath } from '../../utils/navigation';
 import type { Locale } from '../../lib/catalog';
 import AccountNav from './AccountNav.svelte';

 type Booking = { id: string; startAt: string; endAt: string; createdAt?: string; instrument: string; service: string; status: string };
 type Slot = { startAt: string; endAt: string };
 let { lang } = $props<{ lang: Locale }>();
 let bookings = $state<Booking[] | null>(null), slots = $state<Slot[]>([]), visibleCount = $state(5);
 let selected = $state<Record<string, string>>({}), pending = $state<string | null>(null);
 let status = $state(''), bookingError = $state(false), availabilityError = $state(false);
 const t = (key: string) => ui[lang][key as keyof typeof ui.en] || ui.en[key as keyof typeof ui.en];
 const at = (value: string) => new Intl.DateTimeFormat(lang, { timeZone: 'Asia/Bangkok', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
 const visibleBookings = $derived((bookings ?? []).slice().sort((a, b) => Date.parse(b.createdAt ?? b.startAt) - Date.parse(a.createdAt ?? a.startAt)).slice(0, visibleCount));
 const manageable = (booking: Booking) => booking.status === 'confirmed' && Date.parse(booking.startAt) > Date.now();
 async function loadBookings() {
  bookingError = false;
  try {
   const response = await fetch('/api/bookings', { cache: 'no-store' }); const data = await response.json();
   if (!response.ok || !Array.isArray(data.bookings)) throw Error(); bookings = data.bookings;
  } catch { bookingError = true; }
 }
 async function loadAvailability() {
  availabilityError = false;
  try {
   const response = await fetch('/api/booking-availability', { cache: 'no-store' }); const data = await response.json();
   if (!response.ok || !Array.isArray(data.slots)) throw Error(); slots = data.slots;
   for (const id of Object.keys(selected)) if (!slots.some(slot => slot.startAt === selected[id])) selected[id] = '';
  } catch { slots = []; availabilityError = true; }
 }
 async function load() { await Promise.all([loadBookings(), loadAvailability()]); }
 onMount(() => { void load(); });
 async function reschedule(booking: Booking) {
  if (pending) return;
  const slot = selected[booking.id];
  if (!slots.some(candidate => candidate.startAt === slot) || slot === booking.startAt) { status = t('booking.chooseTime'); return; }
  pending = booking.id; status = '';
  try {
   const response = await fetch(`/api/bookings/${encodeURIComponent(booking.id)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ changeKey: crypto.randomUUID(), slot }) });
   const data = await response.json();
   if (response.status === 409) { selected[booking.id] = ''; await load(); status = t(data.error === 'booking_not_modifiable' ? 'booking.notModifiable' : 'booking.collision'); return; }
   if (!response.ok) throw Error();
   bookings = (bookings ?? []).map(item => item.id === booking.id ? data.booking : item); selected[booking.id] = ''; status = t('booking.timeUpdated'); await load();
  } catch { status = t('flow.failed'); } finally { pending = null; }
 }
 async function cancel(booking: Booking) {
  if (pending || !window.confirm(t('booking.cancelConfirm'))) return;
  pending = booking.id; status = '';
  try {
   const response = await fetch(`/api/bookings/${encodeURIComponent(booking.id)}`, { method: 'DELETE' }); const data = await response.json();
   if (!response.ok) throw Error(); bookings = (bookings ?? []).map(item => item.id === booking.id ? data.booking : item); status = t('booking.cancelledStatus'); await loadAvailability();
  } catch { status = t('flow.failed'); } finally { pending = null; }
 }
 async function archive(booking: Booking) {
  if (pending || booking.status !== 'cancelled') return;
  if (!window.confirm(accountText(lang, 'archiveConfirm'))) return;
  pending = booking.id; status = '';
  try {
   const response = await fetch(`/api/bookings/${encodeURIComponent(booking.id)}/archive`, { method: 'POST' }); const data = await response.json();
   if (response.status === 409) { status = accountText(lang, 'archiveOnlyCancelled'); return; }
   if (!response.ok) throw Error(); bookings = (bookings ?? []).filter(item => item.id !== booking.id); status = accountText(lang, 'archived');
  } catch { status = accountText(lang, 'archiveUnavailable'); } finally { pending = null; }
 }
 const instrumentLabel = (booking: Booking) => t(`booking.${booking.instrument}`);
 const serviceLabel = (booking: Booking) => t(booking.service === 'assessment' ? 'booking.assessmentLabel' : `booking.${booking.service}`);
</script>

<div class="max-w-4xl mx-auto px-6 py-16 md:py-24 relative z-10">
 <div class="flex flex-wrap items-start justify-between gap-4 mb-8"><div><h1 class="font-serif text-4xl">{accountText(lang, 'bookings')}</h1><p class="text-neutral-300 mt-3">{t('booking.availabilityHelp')}</p></div><a class="btn btn-primary" href={localizedPath('/booking', lang)}>{t('flow.book')}</a></div>
 <AccountNav {lang} active="bookings" />
 {#if availabilityError}<div role="alert" class="alert mb-6">{t('booking.calendarSourceError')} <button class="underline" onclick={loadAvailability}>{t('flow.retry')}</button></div>{/if}
 {#if bookingError}<div role="alert" class="alert">{t('flow.unavailable')} <button class="underline" onclick={loadBookings}>{t('flow.retry')}</button></div>
 {:else if bookings === null}<p role="status">{t('flow.loading')}</p>
 {:else if !bookings.length}<p>{accountText(lang, 'emptyBookings')}</p>
 {:else}<div class="space-y-5">{#each visibleBookings as booking (booking.id)}
  <section class="bg-white/5 border border-white/10 rounded-2xl p-5 sm:p-6">
   <div class="flex flex-wrap items-start justify-between gap-4"><div><h2 class="font-serif text-xl">{instrumentLabel(booking)} · {serviceLabel(booking)}</h2><p class="text-neutral-300 mt-2">{at(booking.startAt)} · Asia/Bangkok (UTC+7)</p><p class="text-sm text-neutral-400 mt-2">{t(booking.status === 'cancelled' ? 'booking.statusCancelled' : Date.parse(booking.startAt) <= Date.now() ? 'booking.statusPast' : 'booking.statusUpcoming')}</p></div>
   {#if booking.status === 'cancelled'}<button class="btn btn-ghost" disabled={pending !== null} onclick={() => archive(booking)}>{pending === booking.id ? t('flow.saving') : accountText(lang, 'archive')}</button>{/if}</div>
   {#if manageable(booking)}<label class="block mt-5 mb-2" for={`slot-${booking.id}`}>{t('booking.newTime')}</label><div class="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto_auto]"><select id={`slot-${booking.id}`} class="select w-full" bind:value={selected[booking.id]} disabled={pending !== null || availabilityError}><option value="">{t('booking.chooseTime')}</option>{#each slots.filter(slot => slot.startAt !== booking.startAt) as slot (slot.startAt)}<option value={slot.startAt}>{at(slot.startAt)} – {new Intl.DateTimeFormat(lang, { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(slot.endAt))}</option>{/each}</select><button class="btn btn-primary" disabled={pending !== null || !slots.some(slot => slot.startAt === selected[booking.id] && slot.startAt !== booking.startAt)} onclick={() => reschedule(booking)}>{pending === booking.id ? t('flow.saving') : t('booking.reschedule')}</button><button class="btn btn-ghost" disabled={pending !== null} onclick={() => cancel(booking)}>{t('booking.cancel')}</button></div>{/if}
  </section>
 {/each}</div>
 {#if bookings.length > visibleCount}<button class="btn btn-ghost mt-6" onclick={() => visibleCount += 5}>{accountText(lang, 'seeMore')}</button>{:else if visibleCount > 5}<button class="btn btn-ghost mt-6" onclick={() => visibleCount = 5}>{accountText(lang, 'showLess')}</button>{/if}{/if}
 <p role="status" class="mt-6">{status}</p>
</div>
