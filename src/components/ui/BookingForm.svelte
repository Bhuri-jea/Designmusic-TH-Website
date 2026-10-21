<script lang="ts">
 import {onMount,tick} from 'svelte';
 import {ui} from '../../i18n/ui';
 import {localizedPath} from '../../utils/navigation';
 import type {Locale} from '../../lib/catalog';
 import { BOOKING_DRAFT_KEY, readBookingDraft } from '../../lib/booking-draft';
 let {lang='en'}=$props<{lang?:Locale}>();
 const t=(key:string)=>ui[lang][key as keyof typeof ui.en] || ui.en[key as keyof typeof ui.en];
 let step=$state(1),instrument=$state(''),service=$state(''),selectedDate=$state(''),slot=$state(''),notes=$state(''),status=$state(''),loading=$state(true),availabilityFailed=$state(false),pending=$state(false),saved=$state<any>(null);
 let slots=$state<{startAt:string,endAt:string}[]>([]),availabilitySource=$state('database'),heading=$state<HTMLHeadingElement>();
 let lastFingerprint='',requestKey='';
 const instruments=['soprano','alto','tenor','baritone','bassoon','other'];
 const services=['basic','standard','overhaul','assessment'];
 const dateKey=(value:string)=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));
 const dateLabel=(value:string)=>new Intl.DateTimeFormat(lang,{timeZone:'Asia/Bangkok',weekday:'short',month:'short',day:'numeric'}).format(new Date(value));
 const timeLabel=(value:string)=>new Intl.DateTimeFormat(lang,{timeZone:'Asia/Bangkok',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(value));
 let dates=$derived([...new Map(slots.map(s=>[dateKey(s.startAt),s.startAt])).entries()]);
 let estimate=$derived((service==='basic'?1000:service==='standard'?3500:service==='overhaul'?5000:0)*(instrument==='tenor'?1.2:instrument==='baritone'?1.5:1));
 async function availability(){loading=true;availabilityFailed=false;try{const res=await fetch('/api/booking-availability',{cache:'no-store'});const data=await res.json();if(!res.ok || data.timeZone!=='Asia/Bangkok' || !Array.isArray(data.slots) || !['database','google-calendar'].includes(data.source))throw Error();slots=data.slots;availabilitySource=data.source;if(slot && !slots.some(s=>s.startAt===slot))slot='';}catch{slots=[];slot='';availabilityFailed=true;}finally{loading=false;}}
 onMount(() => {
  try {
   const requestedDate = new URL(window.location.href).searchParams.get('date');
   if (requestedDate && /^\d{4}-\d{2}-\d{2}$/.test(requestedDate)) selectedDate=requestedDate;
   const requestedSlot = new URL(window.location.href).searchParams.get('slot');
   if (requestedSlot && /^\d{4}-\d{2}-\d{2}T\d\d:\d\d:\d\d(?:\.\d{3})?Z$/.test(requestedSlot)) slot=requestedSlot;
   const draft = readBookingDraft(sessionStorage.getItem(BOOKING_DRAFT_KEY));
   sessionStorage.removeItem(BOOKING_DRAFT_KEY);
   if (draft) { instrument=draft.instrument;service=draft.service;slot=draft.slot;notes=draft.notes;selectedDate=dateKey(slot);step=2; }
  } catch { /* Storage may be disabled; booking remains usable. */ }
  void availability();
 });
 function saveSignInDraft() {
  try { sessionStorage.setItem(BOOKING_DRAFT_KEY, JSON.stringify({instrument,service,slot,notes,savedAt:Date.now()})); }
  catch { /* Do not block sign-in when browser storage is unavailable. */ }
 }
 async function move(next:number){if(next>step && (step===1 && (!instrument || !service) || step===2 && !slot)){status=t('booking.select');return;}status='';step=next;await tick();heading?.focus();}
 async function submit(){if(pending)return;pending=true;status='';try{const input={slot,instrument,service,notes,locale:lang};const fingerprint=JSON.stringify(input);if(fingerprint!==lastFingerprint){requestKey=crypto.randomUUID();lastFingerprint=fingerprint;}const res=await fetch('/api/bookings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({requestKey,...input})});const data=await res.json();if(res.status===409){await availability();slot='';step=2;status=t('booking.collision');return;}if(res.status===401){status=t('flow.signInRequired');return;}if(!res.ok || !data.booking?.id || data.booking.status!=='confirmed')throw Error();saved=data.booking;step=4;await tick();heading?.focus();}catch{status=t('flow.failed');}finally{pending=false;}}
</script>
<div class="max-w-3xl mx-auto bg-neutral-950 border border-white/10 rounded-md overflow-hidden">
 <div class="flex border-b border-white/10">{#each ['booking.service','booking.time','booking.details'] as key,index}<div class="flex-1 text-center py-4 text-sm tracking-widest uppercase" class:text-neutral-500={step<index+1}>{index+1}. {t(key)}</div>{/each}</div>
 <div class="p-6 md:p-10 space-y-6">
 <h2 bind:this={heading} tabindex="-1" class="font-serif text-2xl">{t(step===1?'booking.service':step===2?'booking.time':step===3?'booking.details':'booking.confirmed')}</h2>
 {#if step===1}
 <fieldset><legend class="sr-only">{t('booking.select')}</legend><div class="grid grid-cols-2 sm:grid-cols-3 gap-3">{#each instruments as id}<button class="p-4 border rounded-xl" class:bg-white={instrument===id} class:text-black={instrument===id} aria-pressed={instrument===id} onclick={()=>{instrument=id;service='';}}>{t('booking.'+id)}</button>{/each}</div></fieldset>
 <fieldset><legend class="mb-3 text-neutral-400">{t('booking.service')}</legend><div class="grid sm:grid-cols-2 gap-3">{#each services.filter(s=>!(instrument==='bassoon' && s==='basic')) as id}<button class="p-4 border rounded-xl text-left" class:bg-white={service===id} class:text-black={service===id} aria-pressed={service===id} onclick={()=>service=id}>{t(id==='assessment'?'booking.assessmentLabel':'booking.'+id)}</button>{/each}</div></fieldset>
 {#if instrument && service}<p>{t('booking.estimated')}: {estimate?'~ '+estimate.toLocaleString(lang)+' THB':t('booking.assessment')}</p><p class="text-sm text-neutral-400">{t('booking.estimateHelp')}</p>{/if}
 {:else if step===2}
 <p class="text-neutral-400">{t(availabilitySource==='google-calendar'?'booking.calendarLinked':'booking.calendarFallback')} · Asia/Bangkok · UTC+7</p>
 {#if loading}<p role="status">{t('flow.loading')}</p>{:else if availabilityFailed}<p role="alert">{t('booking.calendarSourceError')}</p><button class="btn" onclick={availability}>{t('flow.retry')}</button>{:else if !slots.length}<p>{t('booking.none')}</p><button class="btn" onclick={availability}>{t('flow.retry')}</button>{:else}
 <label for="booking-date" class="block">{t('booking.date')}</label><select id="booking-date" class="booking-date-select" bind:value={selectedDate} onchange={()=>slot=''}><option value="">{t('booking.chooseDate')}</option>{#each dates as [key,start]}<option value={key}>{dateLabel(start)}</option>{/each}</select>
 <div class="grid grid-cols-2 gap-3">{#each slots.filter(s=>dateKey(s.startAt)===selectedDate) as available}<button class="p-4 border rounded-xl" class:bg-white={slot===available.startAt} class:text-black={slot===available.startAt} aria-pressed={slot===available.startAt} onclick={()=>slot=available.startAt}>{timeLabel(available.startAt)} – {timeLabel(available.endAt)}</button>{/each}</div>{/if}
 {:else if step===3}
 <p>{t('booking.'+instrument)} · {t(service==='assessment'?'booking.assessmentLabel':'booking.'+service)}</p><p>{dateLabel(slot)} · {timeLabel(slot)} · Asia/Bangkok (UTC+7)</p>
 <label for="booking-notes" class="block">{t('booking.notes')}</label><textarea id="booking-notes" class="booking-notes w-full min-h-32" maxlength="2000" bind:value={notes}></textarea><p class="text-sm text-neutral-400">{t('booking.photoHelp')}</p>
 {:else if saved}
 <p>{t('booking.confirmed')}</p><p>{dateLabel(saved.startAt)} · {timeLabel(saved.startAt)} – {timeLabel(saved.endAt)} · Asia/Bangkok</p><a class="btn" href={localizedPath('/profile/bookings',lang)}>{t('flow.manageBookings')}</a>
 {/if}
 <p id="booking-status" role="status" class="text-neutral-300">{status}</p>{#if status===t('flow.signInRequired')}<a class="underline" onclick={saveSignInDraft} href={localizedPath('/login',lang)+'?returnTo='+encodeURIComponent(localizedPath('/booking',lang))}>{t('flow.login')}</a>{/if}
 {#if step<4}<div class="flex justify-between gap-4">{#if step>1}<button class="btn btn-ghost" disabled={pending} onclick={()=>move(step-1)}>{t('booking.back')}</button>{/if}<button class="btn btn-primary ml-auto" disabled={pending || loading} aria-describedby="booking-status" onclick={()=>step===3?submit():move(step+1)}>{pending?t('flow.saving'):t(step===3?'booking.confirm':'booking.next')}</button></div>{/if}
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

 .booking-notes {
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
