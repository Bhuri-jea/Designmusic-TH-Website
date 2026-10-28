<script lang="ts">
 import {onMount,tick} from 'svelte';
 import {ui} from '../../i18n/ui';
 import {localizedPath} from '../../utils/navigation';
 import type {Locale} from '../../lib/catalog';
 import {bookingDayKey,groupBookingSlotsByDay} from '../../lib/booking';
 import { BOOKING_DRAFT_KEY, readBookingDraft } from '../../lib/booking-draft';
 let {lang='en'}=$props<{lang?:Locale}>();
 const t=(key:string)=>ui[lang][key as keyof typeof ui.en] || ui.en[key as keyof typeof ui.en];
 let step=$state(1),instrument=$state(''),service=$state(''),selectedDate=$state(''),slot=$state(''),contactName=$state(''),contactInformation=$state(''),notes=$state(''),status=$state(''),loading=$state(true),availabilityFailed=$state(false),pending=$state(false),saved=$state<any>(null);
 let slots=$state<{startAt:string,endAt:string}[]>([]),calendarSlots=$state<{startAt:string;endAt:string;status:'available'|'booked'|'contact_directly'|'unavailable'}[]>([]),availabilitySource=$state('database'),heading=$state<HTMLHeadingElement>(),month=$state({year:0,month:0}),windowFrom=$state(''),windowTo=$state('');
 let lastFingerprint='',requestKey='';
 const instruments=['soprano','alto','tenor','baritone','bassoon','other'];
 const services=['basic','standard','overhaul','assessment'];
 const dateKey=bookingDayKey;
 const dateLabel=(value:string)=>new Intl.DateTimeFormat(lang,{timeZone:'Asia/Bangkok',weekday:'short',month:'short',day:'numeric'}).format(new Date(value));
 const timeLabel=(value:string)=>new Intl.DateTimeFormat(lang,{timeZone:'Asia/Bangkok',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(value));

 let monthDays=$derived.by(()=>{if(!month.year)return[];const first=new Date(Date.UTC(month.year,month.month,1,12)),count=new Date(Date.UTC(month.year,month.month+1,0,12)).getUTCDate();return [...Array(first.getUTCDay()).fill(null),...Array.from({length:count},(_,i)=>`${month.year}-${String(month.month+1).padStart(2,'0')}-${String(i+1).padStart(2,'0')}`)];});
 let monthLabel=$derived(new Intl.DateTimeFormat(lang,{month:'long',year:'numeric',timeZone:'Asia/Bangkok'}).format(new Date(Date.UTC(month.year,month.month,15,12))));
 let calendarByDate=$derived(groupBookingSlotsByDay(calendarSlots));
 let availableByDate=$derived(groupBookingSlotsByDay(slots));
 let selectedDaySlots=$derived(calendarByDate.get(selectedDate)??[]);
 function changeMonth(delta:number){const d=new Date(Date.UTC(month.year,month.month+delta,1,12));month={year:d.getUTCFullYear(),month:d.getUTCMonth()};selectedDate='';slot='';}
 function dayStatus(key:string|null){if(!key)return 'unavailable';const day=calendarByDate.get(key)??[];return day.some(s=>s.status==='available')?'available':day.some(s=>s.status==='contact_directly')?'contact_directly':day.some(s=>s.status==='booked')?'booked':'unavailable';}
 let estimate=$derived((service==='basic'?1000:service==='standard'?3500:service==='overhaul'?5000:0)*(instrument==='tenor'?1.2:instrument==='baritone'?1.5:1));
 async function availability(){loading=true;availabilityFailed=false;try{const res=await fetch('/api/booking-availability',{cache:'no-store'});const data=await res.json();if(!res.ok || data.timeZone!=='Asia/Bangkok' || !Array.isArray(data.slots) || !Array.isArray(data.calendarSlots) || typeof data.from!=='string'||typeof data.to!=='string'||!['database','google-calendar'].includes(data.source))throw Error();slots=data.slots;calendarSlots=data.calendarSlots;windowFrom=data.from;windowTo=data.to;availabilitySource=data.source;if(slot && !slots.some(s=>s.startAt===slot))slot='';if(!month.year)month={year:Number(data.from.slice(0,4)),month:Number(data.from.slice(5,7))-1};if(selectedDate<data.from||selectedDate>data.to)selectedDate=data.from;if(!selectedDate)selectedDate=data.from;}catch{slots=[];calendarSlots=[];slot='';availabilityFailed=true;}finally{loading=false;}}
 onMount(() => {
  try {
   const requestedDate = new URL(window.location.href).searchParams.get('date');
   if (requestedDate && /^\d{4}-\d{2}-\d{2}$/.test(requestedDate)) selectedDate=requestedDate;
   const requestedSlot = new URL(window.location.href).searchParams.get('slot');
   if (requestedSlot && /^\d{4}-\d{2}-\d{2}T\d\d:\d\d:\d\d(?:\.\d{3})?Z$/.test(requestedSlot)) slot=requestedSlot;
   const draft = readBookingDraft(sessionStorage.getItem(BOOKING_DRAFT_KEY));
   sessionStorage.removeItem(BOOKING_DRAFT_KEY);
   if (draft) { instrument=draft.instrument;service=draft.service;slot=draft.slot;contactName=draft.contactName;contactInformation=draft.contactInformation;notes=draft.notes;selectedDate=dateKey(slot);step=2; }
  } catch { /* Storage may be disabled; booking remains usable. */ }
  void availability();
 });
 function saveSignInDraft() {
  try { sessionStorage.setItem(BOOKING_DRAFT_KEY, JSON.stringify({instrument,service,slot,contactName,contactInformation,notes,savedAt:Date.now()})); }
  catch { /* Do not block sign-in when browser storage is unavailable. */ }
 }
 async function move(next:number){if(next>step && (step===1 && (!instrument || !service) || step===2 && !slot)){status=t('booking.select');return;}status='';step=next;await tick();heading?.focus();}
 async function submit(){if(pending)return;if(!contactName.trim()||!contactInformation.trim()){status=t('booking.contactRequired');return;}pending=true;status='';try{const input={slot,instrument,service,contactName,contactInformation,notes,locale:lang};const fingerprint=JSON.stringify(input);if(fingerprint!==lastFingerprint){requestKey=crypto.randomUUID();lastFingerprint=fingerprint;}const res=await fetch('/api/bookings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({requestKey,...input})});const data=await res.json();if(res.status===409){await availability();slot='';step=2;status=t('booking.collision');return;}if(res.status===401){status=t('flow.signInRequired');return;}if(!res.ok || !data.booking?.id || data.booking.status!=='confirmed')throw Error();saved=data.booking;step=4;await tick();heading?.focus();}catch{status=t('flow.failed');}finally{pending=false;}}
</script>
<div class="max-w-3xl mx-auto bg-neutral-950 border border-white/10 rounded-md overflow-hidden">
 <div class="flex border-b border-white/10">{#each ['booking.service','booking.time','booking.details'] as key,index}<div class="min-w-0 flex-1 break-words px-1 py-4 text-center text-xs leading-snug uppercase sm:text-sm sm:tracking-widest" class:text-neutral-500={step<index+1}>{index+1}. {t(key)}</div>{/each}</div>
 <div class="p-6 md:p-10 space-y-6">
 <h2 bind:this={heading} tabindex="-1" class="font-serif text-2xl">{t(step===1?'booking.service':step===2?'booking.time':step===3?'booking.details':'booking.confirmed')}</h2>
 {#if step===1}
 <fieldset><legend class="sr-only">{t('booking.select')}</legend><div class="grid grid-cols-2 sm:grid-cols-3 gap-3">{#each instruments as id}<button class="p-4 border rounded-xl" class:bg-white={instrument===id} class:text-black={instrument===id} aria-pressed={instrument===id} onclick={()=>{instrument=id;service='';}}>{t('booking.'+id)}</button>{/each}</div></fieldset>
 <fieldset><legend class="mb-3 text-neutral-400">{t('booking.service')}</legend><div class="grid sm:grid-cols-2 gap-3">{#each services.filter(s=>!(instrument==='bassoon' && s==='basic')) as id}<button class="p-4 border rounded-xl text-left" class:bg-white={service===id} class:text-black={service===id} aria-pressed={service===id} onclick={()=>service=id}>{t(id==='assessment'?'booking.assessmentLabel':'booking.'+id)}</button>{/each}</div></fieldset>
 {#if instrument && service}<p>{t('booking.estimated')}: {estimate?'~ '+estimate.toLocaleString(lang)+' THB':t('booking.assessment')}</p><p class="text-sm text-neutral-400">{t('booking.estimateHelp')}</p>{/if}
 {:else if step===2}
 <p class="text-neutral-400">{t(availabilitySource==='google-calendar'?'booking.calendarLinked':'booking.calendarFallback')} · Asia/Bangkok · UTC+7</p>
 {#if loading}<p role="status">{t('flow.loading')}</p>{:else if availabilityFailed}<p role="alert">{t('booking.calendarSourceError')}</p><button class="btn" onclick={availability}>{t('flow.retry')}</button>{:else if !calendarSlots.length}<p>{t('booking.none')}</p><button class="btn" onclick={availability}>{t('flow.retry')}</button>{:else}
 <div class="booking-calendar grid gap-6 lg:grid-cols-[1.1fr_.9fr]">
  <div class="rounded-2xl border border-white/10 bg-black/30 p-4 md:p-5">
   <div class="mb-4 flex items-center justify-between gap-1 sm:gap-3"><button type="button" class="btn btn-ghost btn-sm shrink-0 px-0 sm:px-4" aria-label={t('booking.calendarPrevious')} onclick={()=>changeMonth(-1)} disabled={`${month.year}-${String(month.month+1).padStart(2,'0')}`<=windowFrom.slice(0,7)}>← <span class="hidden sm:inline">{t('booking.calendarPrevious')}</span></button><h3 class="min-w-0 flex-1 break-words text-center font-serif text-base capitalize sm:text-xl" aria-live="polite">{monthLabel}</h3><button type="button" class="btn btn-ghost btn-sm shrink-0 px-0 sm:px-4" aria-label={t('booking.calendarNext')} onclick={()=>changeMonth(1)} disabled={`${month.year}-${String(month.month+1).padStart(2,'0')}`>=windowTo.slice(0,7)}><span class="hidden sm:inline">{t('booking.calendarNext')}</span> →</button></div>
   <div class="grid grid-cols-7 gap-1 text-center text-xs text-neutral-400">{#each Array.from({length:7},(_,day)=>new Intl.DateTimeFormat(lang,{weekday:'short',timeZone:'Asia/Bangkok'}).format(new Date(Date.UTC(2024,0,7+day,12)))) as label}<div class="py-2">{label}</div>{/each}</div>
   <div class="grid grid-cols-7 gap-1">{#each monthDays as key}{#if !key}<div aria-hidden="true"></div>{:else}{@const state=dayStatus(key)}<button type="button" class="min-h-[4.25rem] rounded-xl border p-1 text-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300" class:border-amber-300={selectedDate===key} class:ring-1={selectedDate===key} class:bg-emerald-950={state==='available'} class:border-emerald-800={state==='available'} class:bg-amber-950={state==='contact_directly'} class:border-amber-900={state==='contact_directly'} class:bg-red-950={state==='unavailable'} class:border-red-800={state==='unavailable'} class:bg-neutral-900={state==='booked'} class:border-neutral-700={state==='booked'} class:opacity-55={state==='unavailable'} aria-pressed={selectedDate===key} disabled={key<windowFrom||key>windowTo} aria-label={`${dateLabel(key)}: ${t(state==='available'?'booking.statusAvailable':state==='contact_directly'?'booking.statusContact':state==='booked'?'booking.statusBooked':'booking.statusUnavailable')}`} onclick={()=>{selectedDate=key;slot=''}}><span class="block font-medium">{Number(key.slice(-2))}</span><span class="mt-1 hidden text-xs leading-tight sm:block">{(availableByDate.get(key)?.length??0)?`${(availableByDate.get(key)?.length??0)} ${t('booking.calendarTimes')}`:t(state==='contact_directly'?'booking.statusContact':state==='booked'?'booking.statusBooked':'booking.statusUnavailable')}</span></button>{/if}{/each}</div>
   <div class="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs text-neutral-300"><span><i class="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-emerald-500"></i>{t('booking.statusAvailable')}</span><span><i class="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-neutral-500"></i>{t('booking.statusBooked')}</span><span><i class="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-amber-500"></i>{t('booking.statusContact')}</span><span><i class="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-red-600"></i>{t('booking.statusUnavailable')}</span></div>
  </div>
  <div class="rounded-2xl border border-white/10 bg-black/30 p-4 md:p-5"><h3 class="font-serif text-xl">{selectedDate?dateLabel(selectedDate):t('booking.selectCalendarDate')}</h3>{#if !selectedDaySlots.length}<p class="mt-4 text-neutral-400">{t('booking.calendarDayUnavailable')}</p>{:else}<div class="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">{#each selectedDaySlots as available}<div><button type="button" class="min-h-12 w-full rounded-xl border border-white/20 p-3" class:bg-white={slot===available.startAt} class:text-black={slot===available.startAt} disabled={available.status!=='available'} aria-pressed={slot===available.startAt} onclick={()=>slot=available.startAt}>{timeLabel(available.startAt)} – {timeLabel(available.endAt)}<span class="mt-1 block text-sm" class:text-red-300={available.status==='unavailable'}>{t(available.status==='available'?'booking.statusAvailable':available.status==='booked'?'booking.statusBooked':available.status==='contact_directly'?'booking.statusContact':'booking.statusUnavailable')}</span></button>{#if available.status==='contact_directly'}<div class="mt-2 flex flex-wrap gap-2 text-sm"><a class="underline" href="mailto:designmusicthailand@gmail.com">{t('cart.contactEmail')}</a><a class="underline" href="https://www.facebook.com/DesignmusicInstrumentmusicAccessories" target="_blank" rel="noopener noreferrer">Facebook</a><a class="underline" href="https://www.instagram.com/designmusic_instrument/" target="_blank" rel="noopener noreferrer">Instagram</a></div>{/if}</div>{/each}</div>{/if}<p class="mt-4 text-xs text-neutral-500">{t('booking.calendarSlotDuration')}</p></div>
 </div>{/if}
 {:else if step===3}
 <p>{t('booking.'+instrument)} · {t(service==='assessment'?'booking.assessmentLabel':'booking.'+service)}</p><p>{dateLabel(slot)} · {timeLabel(slot)} · Asia/Bangkok (UTC+7)</p>
 <label for="booking-contact-name" class="block">{t('booking.contactName')}</label><input id="booking-contact-name" class="booking-input w-full" required maxlength="120" autocomplete="name" bind:value={contactName} />
 <label for="booking-contact-information" class="block">{t('booking.contactInformation')}</label><input id="booking-contact-information" class="booking-input w-full" required maxlength="500" aria-describedby="booking-contact-example" bind:value={contactInformation} /><p id="booking-contact-example" class="text-sm text-neutral-400">{t('booking.contactExample')}</p>
 <label for="booking-notes" class="block">{t('booking.notes')}</label><textarea id="booking-notes" class="booking-notes w-full min-h-32" maxlength="2000" bind:value={notes}></textarea><p class="text-sm text-neutral-400">{t('booking.photoHelp')}</p>
 {:else if saved}
 <p>{t('booking.confirmed')}</p><p>{dateLabel(saved.startAt)} · {timeLabel(saved.startAt)} – {timeLabel(saved.endAt)} · Asia/Bangkok</p><a class="btn" href={localizedPath('/profile/bookings',lang)}>{t('flow.manageBookings')}</a>
 {/if}
 <p id="booking-status" role="status" class="text-neutral-300">{status}</p>{#if status===t('flow.signInRequired')}<a class="underline" onclick={saveSignInDraft} href={localizedPath('/login',lang)+'?returnTo='+encodeURIComponent(localizedPath('/booking',lang))}>{t('flow.login')}</a>{/if}
 {#if step<4}<div class="flex justify-between gap-4">{#if step>1}<button class="btn btn-ghost" disabled={pending} onclick={()=>move(step-1)}>{t('booking.back')}</button>{/if}<button class="btn btn-primary ml-auto" disabled={pending || (step===2 && loading)} aria-describedby="booking-status" onclick={()=>step===3?submit():move(step+1)}>{pending?t('flow.saving'):t(step===3?'booking.confirm':'booking.next')}</button></div>{/if}
 </div>
</div>

<style>
 .booking-date-select {
  width: 100%;
  min-height: 2.75rem;
  padding: 0.65rem 0.8rem;
  border: 1px solid rgb(255 255 255 / 0.3);
  border-radius: 0.25rem;
  background-color: #171a1b;
  color: #f1eee4;
  color-scheme: dark;
 }

 .booking-date-select option {
  background-color: #171a1b;
  color: #f1eee4;
 }

 .booking-date-select:focus-visible {
  outline: 2px solid #c2aa6a;
  outline-offset: 2px;
 }

 .booking-input,.booking-notes {
  padding: 0.7rem 0.85rem;
  border: 1px solid #728084;
  border-radius: 0.5rem;
  background: #282e30;
  color: #f1eee4;
  color-scheme: dark;
  resize: vertical;
 }

 .booking-notes:focus-visible {
  outline: 2px solid #c2aa6a;
  outline-offset: 2px;
  border-color: #c2aa6a;
 }
</style>
