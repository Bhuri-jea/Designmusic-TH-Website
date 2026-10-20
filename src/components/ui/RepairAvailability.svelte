<script lang="ts">
 import { onMount } from 'svelte';
 import { ui } from '../../i18n/ui';
 import { localizedPath } from '../../utils/navigation';
 import type { Locale } from '../../lib/catalog';
 type SlotStatus = 'available' | 'booked' | 'contact_directly' | 'unavailable';
 type Slot = { startAt:string; endAt:string; status:SlotStatus };
 let { lang = 'en' } = $props<{ lang?: Locale }>();
 let slots = $state<Slot[]>([]), source = $state('database'), loading = $state(true), failed = $state(false);
 let selectedDate = $state(''), month = $state({year:0, month:0});
 const t = (key:string) => ui[lang][key as keyof typeof ui.en] || ui.en[key as keyof typeof ui.en];
 const statusText = (status:SlotStatus) => t(status==='available'?'booking.statusAvailable':status==='booked'?'booking.statusBooked':status==='contact_directly'?'booking.statusContact':'booking.statusUnavailable');
 const dateKey = (value:string) => new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));
 const dateLabel = (value:string) => new Intl.DateTimeFormat(lang,{timeZone:'Asia/Bangkok',weekday:'long',month:'long',day:'numeric'}).format(new Date(`${value}T12:00:00+07:00`));
 const timeLabel = (value:string) => new Intl.DateTimeFormat(lang,{timeZone:'Asia/Bangkok',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(value));
 const statusRank:Record<SlotStatus,number>={available:0,contact_directly:1,booked:2,unavailable:3};
 const byDate = $derived.by(() => {
  const map = new Map<string,Slot[]>();
  for (const slot of slots) { const key=dateKey(slot.startAt); map.set(key,[...(map.get(key)??[]),slot]); }
  for (const list of map.values()) list.sort((a,b)=>Date.parse(a.startAt)-Date.parse(b.startAt));
  return map;
 });
 const monthLabel = $derived(new Intl.DateTimeFormat(lang,{month:'long',year:'numeric',timeZone:'Asia/Bangkok'}).format(new Date(Date.UTC(month.year,month.month,15,12))));
 const monthDays = $derived.by(() => {
  if (!month.year) return [];
  const first=new Date(Date.UTC(month.year,month.month,1,12));
  const count=new Date(Date.UTC(month.year,month.month+1,0,12)).getUTCDate();
  return [...Array(first.getUTCDay()).fill(null),...Array.from({length:count},(_,i)=>`${month.year}-${String(month.month+1).padStart(2,'0')}-${String(i+1).padStart(2,'0')}`)];
 });
 const monthBounds = $derived.by(() => {
  const today=dateKey(new Date().toISOString());
  const horizon=dateKey(new Date(Date.now()+31*86400000).toISOString());
  return {today,horizon,min:today.slice(0,7),max:horizon.slice(0,7)};
 });
 const selectedSlots = $derived(byDate.get(selectedDate)??[]);
 function changeMonth(delta:number){const date=new Date(Date.UTC(month.year,month.month+delta,1,12));month={year:date.getUTCFullYear(),month:date.getUTCMonth()};selectedDate='';}
 function dayStatus(key:string|null):SlotStatus { if (!key||key<=monthBounds.today||key>monthBounds.horizon) return 'unavailable'; const list=byDate.get(key)??[]; return list.length?list.reduce((best,item)=>statusRank[item.status]<statusRank[best]?item.status:best,list[0].status):'unavailable'; }
 function dayCount(key:string|null){return key?(byDate.get(key)??[]).filter(slot=>slot.status==='available').length:0;}
 function bookingLink(slot:string){return `${localizedPath('/booking',lang)}?date=${encodeURIComponent(selectedDate)}&slot=${encodeURIComponent(slot)}`;}
 let refreshing=false;
 async function load(){
  if(refreshing)return;refreshing=true;failed=false;
  try {
   const response=await fetch('/api/booking-availability',{cache:'no-store'}); const data=await response.json();
   if(!response.ok||!Array.isArray(data.calendarSlots)||!['database','google-calendar'].includes(data.source))throw Error();
   slots=data.calendarSlots;source=data.source;
   const earliest=[...new Set(slots.map((slot:Slot)=>dateKey(slot.startAt)))].sort()[0];
   const initial=earliest??dateKey(new Date().toISOString());
   if(!month.year)month={year:Number(initial.slice(0,4)),month:Number(initial.slice(5,7))-1};
   if(!selectedDate)selectedDate=initial;
  } catch {failed=true;}
  finally {loading=false;refreshing=false;}
 }
 onMount(()=>{void load();const refresh=()=>{if(document.visibilityState==='visible')void load();};const timer=setInterval(refresh,60000);window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',refresh);return()=>{clearInterval(timer);window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',refresh);};});
</script>

<section class="max-w-5xl mx-auto px-4 md:px-6 py-10 relative z-10" aria-labelledby="repair-availability-title">
 <div class="rounded-3xl border border-white/10 bg-neutral-950/90 p-5 md:p-8 shadow-xl">
  <div class="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
   <div><h2 id="repair-availability-title" class="font-serif text-3xl mb-2">{t('booking.availabilityTitle')}</h2>
   {#if !failed}<p class="text-sm text-neutral-400">{t(source==='google-calendar'?'booking.calendarLinked':'booking.calendarFallback')} · Asia/Bangkok</p>{/if}</div>
   {#if !loading&&!failed}<p class="text-xs text-neutral-500">{t('booking.calendarBrowseWindow')}</p>{/if}
  </div>
  {#if loading}<p class="py-10 text-center" role="status">{t('flow.loading')}</p>
  {:else if failed}<div class="py-10 text-center"><p role="alert">{t('booking.calendarSourceError')}</p><button class="btn mt-3" onclick={load}>{t('flow.retry')}</button></div>
  {:else}
   <div class="mt-6 grid gap-6 lg:grid-cols-[1.1fr_.9fr]">
    <div class="rounded-2xl border border-white/10 bg-black/30 p-4 md:p-5">
     <div class="mb-4 flex items-center justify-between gap-3"><button class="btn btn-ghost btn-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300" aria-label={t('booking.calendarPrevious')} disabled={`${month.year}-${String(month.month+1).padStart(2,'0')}`<=monthBounds.min} onclick={()=>changeMonth(-1)}>← <span class="hidden sm:inline">{t('booking.calendarPrevious')}</span></button><h3 class="font-serif text-xl capitalize" aria-live="polite">{monthLabel}</h3><button class="btn btn-ghost btn-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300" aria-label={t('booking.calendarNext')} disabled={`${month.year}-${String(month.month+1).padStart(2,'0')}`>=monthBounds.max} onclick={()=>changeMonth(1)}><span class="hidden sm:inline">{t('booking.calendarNext')}</span> →</button></div>
     <div class="grid grid-cols-7 gap-1 text-center text-xs text-neutral-400">{#each Array.from({length:7},(_,day)=>new Intl.DateTimeFormat(lang,{weekday:'short',timeZone:'Asia/Bangkok'}).format(new Date(Date.UTC(2024,0,7+day,12)))) as label}<div class="py-2">{label}</div>{/each}</div>
      <div class="grid grid-cols-7 gap-1">{#each monthDays as key,i}{#if !key}<div aria-hidden="true"></div>{:else}{@const state=dayStatus(key)}<button type="button" class="min-h-[4.25rem] rounded-xl border p-1 text-center transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300" class:border-amber-300={selectedDate===key} class:ring-1={selectedDate===key} class:bg-emerald-950={state==='available'} class:border-emerald-800={state==='available'} class:bg-amber-950={state==='contact_directly'} class:border-amber-900={state==='contact_directly'} class:bg-neutral-900={state==='booked'||state==='unavailable'} class:border-neutral-700={state==='booked'||state==='unavailable'} class:opacity-55={state==='unavailable'} aria-pressed={selectedDate===key} disabled={key<=monthBounds.today||key>monthBounds.horizon} aria-label={`${dateLabel(key)}: ${statusText(state)}`} onclick={()=>selectedDate=key}><span class="block font-medium">{Number(key.slice(-2))}</span><span class="mt-1 hidden text-[10px] leading-tight sm:block">{dayCount(key)>0?`${dayCount(key)} ${t('booking.calendarTimes')}`:t(state==='contact_directly'?'booking.statusContact':state==='booked'?'booking.statusBooked':'booking.statusUnavailable')}</span><span class="mt-1 block text-xs sm:hidden">{dayCount(key)>0?dayCount(key):state==='booked'?'•':state==='contact_directly'?'✉':'—'}</span></button>{/if}{/each}</div>
     <div class="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs text-neutral-300"><span><i class="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-emerald-500"></i>{t('booking.statusAvailable')}</span><span><i class="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-neutral-500"></i>{t('booking.statusBooked')}</span><span><i class="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-amber-500"></i>{t('booking.statusContact')}</span><span><i class="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-neutral-800"></i>{t('booking.statusUnavailable')}</span></div>
    </div>
    <div class="rounded-2xl border border-white/10 bg-black/30 p-4 md:p-5">
     <h3 class="font-serif text-xl">{selectedDate?dateLabel(selectedDate):t('booking.selectCalendarDate')}</h3>
     {#if !selectedSlots.length}<p class="mt-4 text-neutral-400">{t('booking.calendarDayUnavailable')}</p>
     {:else}<ul class="mt-4 space-y-2">{#each selectedSlots as slot (slot.startAt)}<li class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 px-3 py-2"><span>{timeLabel(slot.startAt)}–{timeLabel(slot.endAt)}</span>{#if slot.status==='available'}<a class="btn btn-primary btn-sm min-h-11" href={bookingLink(slot.startAt)}>{t('flow.book')}</a>{:else if slot.status==='contact_directly'}<div class="flex flex-wrap justify-end gap-2"><a class="btn btn-outline btn-sm min-h-11" href={`mailto:designmusicthailand@gmail.com?subject=${encodeURIComponent('Repair appointment '+selectedDate+' '+timeLabel(slot.startAt))}`}>Email</a><a class="btn btn-outline btn-sm min-h-11" href="https://www.facebook.com/DesignmusicInstrumentmusicAccessories" target="_blank" rel="noreferrer">Facebook</a><a class="btn btn-outline btn-sm min-h-11" href="https://www.instagram.com/designmusic_instrument/" target="_blank" rel="noreferrer">Instagram</a></div>{:else}<span class="text-sm text-neutral-400">{t(slot.status==='booked'?'booking.statusBooked':'booking.statusUnavailable')}</span>{/if}</li>{/each}</ul>{/if}
     <p class="mt-4 text-xs text-neutral-500">{t('booking.calendarSlotDuration')}</p>
    </div>
   </div>
  {/if}
 </div>
</section>
