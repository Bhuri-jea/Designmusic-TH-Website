<script lang="ts">
 import { onMount } from 'svelte';
 import { ui } from '../../i18n/ui';
 import { localizedPath } from '../../utils/navigation';
 import type { Locale } from '../../lib/catalog';

 type Slot = { startAt: string; endAt: string };
 let { lang = 'en' } = $props<{ lang?: Locale }>();
 let slots = $state<Slot[]>([]), source = $state('database'), loading = $state(true), failed = $state(false);
 const t = (key: string) => ui[lang][key as keyof typeof ui.en] || ui.en[key as keyof typeof ui.en];
 const formatDateTime = (value: string) => new Intl.DateTimeFormat(lang, { timeZone: 'Asia/Bangkok', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
 async function load() {
  loading = true; failed = false;
  try {
   const response = await fetch('/api/booking-availability', { cache: 'no-store' });
   const data = await response.json();
   if (!response.ok || !Array.isArray(data.slots) || !['database', 'google-calendar'].includes(data.source)) throw Error();
   slots = data.slots;
   source = data.source;
  } catch { failed = true; }
  finally { loading = false; }
 }
 onMount(() => { void load(); });
</script>

<section class="max-w-4xl mx-auto px-6 py-10 relative z-10" aria-labelledby="repair-availability-title">
 <div class="rounded-3xl border border-white/10 bg-white/5 p-6 md:p-8">
  <h2 id="repair-availability-title" class="font-serif text-3xl mb-3">{t('booking.availabilityTitle')}</h2>
  {#if !failed}<p class="text-sm text-neutral-400 mb-6">{t(source === 'google-calendar' ? 'booking.calendarLinked' : 'booking.calendarFallback')} {t('booking.availabilityHelp')}</p>{/if}
  {#if loading}
   <p role="status">{t('flow.loading')}</p>
  {:else if failed}
   <p role="alert">{t('booking.calendarSourceError')}</p><button class="underline mt-2" onclick={load}>{t('flow.retry')}</button>
  {:else if !slots.length}
   <p>{t('booking.none')}</p>
  {:else}
   <ul class="grid sm:grid-cols-2 gap-3">
    {#each slots.slice(0, 6) as slot (slot.startAt)}
     <li class="rounded-xl border border-white/10 px-4 py-3">{formatDateTime(slot.startAt)} · Asia/Bangkok</li>
    {/each}
   </ul>
  {/if}
  <a class="btn btn-primary mt-6" href={localizedPath('/booking', lang)}>{t('flow.book')}</a>
 </div>
</section>
