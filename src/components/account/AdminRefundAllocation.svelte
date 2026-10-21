<script lang="ts">
 import {onMount} from 'svelte';
 import type {AdminLocale} from '../../lib/admin-ui-i18n';
 let {lang='en',onSaved}=$props<{lang?:AdminLocale;onSaved?:()=>void|Promise<void>}>();
 type Refund={id:string;order_id:string;currency:string;amount:number};
 let refunds=$state<Refund[]>([]),drafts=$state<Record<string,{merchandise:string;shipping:string}>>({}),busy=$state(''),message=$state('');
 const copy={en:{title:'Refunds needing classification',note:'Enter the refunded merchandise and shipping portions. Their sum must match the successful refund. This classifies reporting only; it does not send another refund.',merchandise:'Merchandise',shipping:'Shipping',total:'Refund total',save:'Save classification',error:'Could not load or save classification. Check the amounts and try again.',saved:'Classification saved.',invalid:'Both amounts are required, with the correct currency precision, and must add up to the refund total.',order:'Order',empty:'No refunds need classification.',retry:'Reload'},th:{title:'รายการคืนเงินที่ต้องจำแนก',note:'ระบุส่วนค่าสินค้าและค่าจัดส่งที่คืน ผลรวมต้องเท่ากับยอดคืนเงินสำเร็จ เป็นการจำแนกรายงานเท่านั้น ไม่ได้คืนเงินซ้ำ',merchandise:'ค่าสินค้า',shipping:'ค่าจัดส่ง',total:'ยอดคืนเงิน',save:'บันทึกการจำแนก',error:'โหลดหรือบันทึกไม่ได้ โปรดตรวจสอบจำนวนเงินแล้วลองอีกครั้ง',saved:'บันทึกการจำแนกแล้ว',invalid:'กรอกจำนวนเงินทั้งสองส่วนตามทศนิยมของสกุลเงิน โดยผลรวมต้องเท่ากับยอดคืนเงิน',order:'คำสั่งซื้อ',empty:'ไม่มีรายการคืนเงินที่ต้องจำแนก',retry:'โหลดใหม่'}};
 const t=$derived(copy[lang]);
 const money=(amount:number,currency:string)=>new Intl.NumberFormat(lang==='th'?'th-TH':'en-US',{style:'currency',currency:currency.toUpperCase()}).format(amount/(currency==='jpy'?1:100));
 async function load(){try{const response=await fetch('/api/admin/refund-allocation',{cache:'no-store'});if(!response.ok)throw Error();refunds=(await response.json()).refunds??[];for(const refund of refunds)drafts[refund.id]??={merchandise:'',shipping:''};}catch{message=t.error;}}
 async function save(refund:Refund){
  if(busy)return;
  const draft=drafts[refund.id],merchandise=Number(draft.merchandise),shipping=Number(draft.shipping),scale=refund.currency==='jpy'?1:100;
  if(!draft.merchandise.trim()||!draft.shipping.trim()||![merchandise,shipping].every(value=>Number.isFinite(value)&&value>=0&&Number.isSafeInteger(Math.round(value*scale))&&Math.abs(value*scale-Math.round(value*scale))<1e-8)||Math.round(merchandise*scale)+Math.round(shipping*scale)!==refund.amount){message=t.invalid;return;}
  busy=refund.id;message='';
  try{const response=await fetch('/api/admin/refund-allocation',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({refundId:refund.id,merchandise,shipping})});if(!response.ok)throw Error();refunds=refunds.filter(row=>row.id!==refund.id);message=t.saved;await onSaved?.();}catch{message=t.error;}finally{busy='';}
 }
 onMount(()=>{void load();});
</script>
<details class="mt-5 rounded-xl border border-amber-200/30 p-4">
 <summary class="cursor-pointer font-semibold">{t.title} ({refunds.length})</summary>
 <p class="mt-3 text-sm text-neutral-300">{t.note}</p><button class="btn mt-3" type="button" disabled={!!busy} onclick={()=>void load()}>{t.retry}</button>
 {#each refunds as refund(refund.id)}<form class="mt-4 grid gap-3 rounded-lg border border-white/15 p-3 md:grid-cols-3" onsubmit={event=>{event.preventDefault();void save(refund);}}>
  <div class="break-all text-sm md:col-span-3">{t.order}: {refund.order_id}<br/>{refund.id} · {t.total}: <strong>{money(refund.amount,refund.currency)}</strong></div>
  <label class="text-sm">{t.merchandise} ({refund.currency.toUpperCase()})<input class="input mt-1 block w-full" type="text" inputmode="decimal" required disabled={!!busy} bind:value={drafts[refund.id].merchandise}/></label>
  <label class="text-sm">{t.shipping} ({refund.currency.toUpperCase()})<input class="input mt-1 block w-full" type="text" inputmode="decimal" required disabled={!!busy} bind:value={drafts[refund.id].shipping}/></label>
  <button class="btn self-end" disabled={!!busy}>{t.save}</button>
 </form>{/each}
 {#if !refunds.length}<p class="mt-3 text-sm text-neutral-300">{t.empty}</p>{/if}<p class="mt-3 text-sm text-amber-200" role="status" aria-live="polite">{message}</p>
</details>
