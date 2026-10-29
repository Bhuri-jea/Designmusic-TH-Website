<script lang="ts">
  import {onMount,untrack} from 'svelte';
  import type {AdminLocale} from '../../lib/admin-ui-i18n';
  import AdminOrderCancellation from './AdminOrderCancellation.svelte';
  let {lang='en',onSaved,refreshVersion=0}=$props<{lang?:AdminLocale;onSaved?:()=>void|Promise<void>;refreshVersion?:number}>();
  let seenVersion=0;
  $effect(()=>{if(refreshVersion!==seenVersion){seenVersion=refreshVersion;untrack(()=>{void load();});}});
  let orders=$state<any[]>([]),loading=$state(false),error=$state('');
  const done=(order:any)=>(order.cancellationStatus??order.cancellation_status)==='cancelled';
  const copy={en:{title:'Cancellations and payment review',empty:'No orders need cancellation review.',done:'Cancelled',reload:'Reload',error:'Could not load orders. Check the database migrations and try again.',date:'Ordered',items:'Products',sku:'SKU',loading:'Loading…'},th:{title:'การยกเลิกและตรวจสอบการชำระเงิน',empty:'ไม่มีรายการที่ต้องตรวจสอบการยกเลิก',done:'ยกเลิกแล้ว',reload:'โหลดใหม่',error:'โหลดรายการไม่ได้ โปรดตรวจสอบ migration ฐานข้อมูลแล้วลองอีกครั้ง',date:'สั่งซื้อ',items:'สินค้า',sku:'รหัสสินค้า',loading:'กำลังโหลด…'}};
  const t=$derived(copy[lang]);
  const date=(value:string)=>new Intl.DateTimeFormat(lang==='th'?'th-TH':'en-GB',{dateStyle:'medium',timeZone:'Asia/Bangkok'}).format(new Date(value));
  function statusText(order:any){
    const cancellation=order.cancellationStatus??order.cancellation_status;
    if(cancellation==='cancelled')return lang==='th'?(order.refundStatus==='succeeded'?'ยกเลิกแล้ว · ยืนยันคืนเงินสำเร็จ':'ยกเลิกแล้ว · ไม่มีเงินที่ต้องคืน'):(order.refundStatus==='succeeded'?'Cancelled · Full refund confirmed':'Cancelled · No payment to refund');
    if(cancellation==='review')return lang==='th'?'ต้องตรวจสอบการยกเลิกหรือคืนเงิน · ระงับการจัดส่ง':'Cancellation or refund needs review · Dispatch held';
    if(cancellation==='requested')return lang==='th'?'กำลังดำเนินการยกเลิก · ระงับการจัดส่ง':'Cancellation in progress · Dispatch held';
    if(order.status==='paid')return lang==='th'?'รับชำระแล้ว · ยังไม่มีคำขอยกเลิก':'Payment received · No cancellation requested';
    return lang==='th'?'กำลังตรวจสอบการชำระเงิน':'Payment requires review';
  }
  async function load(){loading=true;error='';try{const response=await fetch('/api/admin/order-cancellations',{cache:'no-store'});if(!response.ok)throw Error();orders=(await response.json()).orders??[];}catch{error=t.error;}finally{loading=false;}}
  async function saved(){if(onSaved)await onSaved();else await load();}
  onMount(()=>{void load();});
</script>

<section class="rounded-2xl border border-white/15 bg-white/5 p-4 md:p-6" aria-labelledby="cancellation-queue-title">
  <div class="flex flex-wrap items-center justify-between gap-3"><h2 id="cancellation-queue-title" class="font-serif text-2xl">{t.title}</h2><button class="btn" disabled={loading} type="button" onclick={()=>void load()}>{t.reload}</button></div>
  <p role="status" class="mt-3 text-amber-200">{loading?t.loading:error}</p>
  {#snippet card(order:any)}<article class="mt-4 rounded-xl border border-white/15 p-4"><p class="break-all text-sm">{order.id??order.order_id}</p>{#if order.createdAt}<p class="mt-1 text-sm text-neutral-300">{t.date}: {date(order.createdAt)}</p>{/if}<p class="mt-2">{statusText(order)}</p>{#if order.items?.length}<div class="mt-3"><p class="text-sm font-semibold">{t.items}</p><ul class="mt-1 space-y-1">{#each order.items as item(item.sku)}<li class="flex flex-wrap gap-x-2 text-sm"><span>{item.quantity} × {item.name}</span><span class="text-neutral-300">{t.sku}: {item.sku}</span></li>{/each}</ul></div>{/if}{#if done(order) && order.cancellationReason}<p class="mt-2 text-sm text-neutral-300">{lang==='th'?'เหตุผล':'Reason'}: {order.cancellationReason}</p>{/if}<AdminOrderCancellation {order} {lang} onSaved={saved}/></article>{/snippet}
  {#each orders.filter(order=>!done(order)) as order(order.id??order.order_id)}{@render card(order)}{/each}
  {#if !loading&&!error&&!orders.filter(order=>!done(order)).length}<p class="mt-4 text-neutral-300">{t.empty}</p>{/if}
  <details class="mt-5"><summary class="cursor-pointer rounded-lg border border-white/20 p-3 font-medium">{t.done} ({orders.filter(done).length})</summary>{#each orders.filter(done) as order(order.id??order.order_id)}{@render card(order)}{/each}</details>
</section>
