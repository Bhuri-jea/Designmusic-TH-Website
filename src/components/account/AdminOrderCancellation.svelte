<script lang="ts">
  import type { AdminLocale } from '../../lib/admin-ui-i18n';
  let { order, lang = 'en', onSaved } = $props<{ order: any; lang?: AdminLocale; onSaved?: () => void | Promise<void> }>();
  let open = $state(false), busy = $state(false), confirmed = $state(false), reason = $state(''), restock = $state<Record<string,string>>({}), message = $state(''), locked = $state(false), completed = $state(false);
  let existingRestock = $state<Record<string,number>|null>(null);
  const id = $derived(order.order_id ?? order.id);
  const paid = $derived((order.payment_status ?? order.status) === 'paid');
  const items = $derived(order.items ?? []);
  const amount = $derived(order.amount_total ?? order.amountTotal ?? 0);
  const state = $derived(order.cancellation_status ?? order.cancellationStatus ?? 'none');
  const paidStockReview = $derived(state === 'review' && order.status === 'review' && Boolean(order.paidAt ?? order.paid_at));
  const customerEmail = $derived(order.customerEmail ?? order.customer_email ?? order.checkoutParameters?.customerEmail ?? '');
  const text = {
    en: { open:'Cancel order / refund', title:'Cancel before dispatch', reason:'Reason (required)', restock:'Quantity to return to stock', note:'Default is zero. Return only units actually available to sell. Paid orders receive the remaining refundable payment, including shipping. This also holds dispatch.', confirm:'I checked the order, refund and restock quantities.', submit:'Confirm cancellation / refund', retry:'Retry the same cancellation', busy:'Checking payment and cancellation…', invalid:'Enter a reason and whole restock quantities between zero and the ordered quantity.', pending:'Refund is pending. Dispatch remains on hold. Reload to check the result.', success:'Cancellation completed. Any successful refund is recorded.', review:'Cancellation needs review. Dispatch is held; the payment outcome is not yet confirmed. Do not start another refund. Use the existing cancellation to reconcile.', failed:'Could not start the cancellation. Your entered details are preserved.', existing:'This cancellation already exists. Its reason and restock selection are locked to prevent duplicate refunds or stock changes.', missing:'Load the cancellation queue to review this existing operation before retrying.', close:'Close', total:'Order total', refund:'Refund recorded', cancelled:'Order cancelled. Dispatch is blocked.' },
    th: { open:'ยกเลิกคำสั่งซื้อ / คืนเงิน', title:'ยกเลิกก่อนจัดส่ง', reason:'เหตุผล (จำเป็น)', restock:'จำนวนที่นำกลับเข้าสต๊อก', note:'ค่าเริ่มต้นเป็นศูนย์ เลือกเฉพาะสินค้าที่พร้อมขายจริง คำสั่งซื้อที่ชำระแล้วจะคืนยอดที่ยังคืนได้ รวมค่าจัดส่ง พร้อมระงับการจัดส่ง', confirm:'ตรวจสอบคำสั่งซื้อ ยอดคืนเงิน และจำนวนคืนสต๊อกแล้ว', submit:'ยืนยันยกเลิก / คืนเงิน', retry:'ลองดำเนินการยกเลิกเดิมอีกครั้ง', busy:'กำลังตรวจสอบการชำระเงินและยกเลิก…', invalid:'กรอกเหตุผลและจำนวนเต็มตั้งแต่ศูนย์ถึงจำนวนที่สั่ง', pending:'กำลังคืนเงิน ยังคงระงับการจัดส่ง โปรดโหลดใหม่เพื่อตรวจสอบ', success:'ยกเลิกสำเร็จ บันทึกการคืนเงินที่สำเร็จแล้ว', review:'ต้องตรวจสอบการยกเลิก ระงับการจัดส่งแล้ว แต่ยังยืนยันผลการชำระเงินไม่ได้ อย่าสร้างรายการคืนเงินใหม่ โปรดตรวจสอบรายการเดิม', failed:'เริ่มยกเลิกไม่ได้ ข้อมูลที่กรอกยังคงอยู่', existing:'มีรายการยกเลิกแล้ว ล็อกเหตุผลและจำนวนคืนสต๊อกเพื่อป้องกันการคืนเงินหรือเพิ่มสต๊อกซ้ำ', missing:'โหลดรายการยกเลิกเพื่อตรวจสอบการดำเนินการเดิมก่อนลองใหม่', close:'ปิด', total:'ยอดคำสั่งซื้อ', refund:'คืนเงินแล้ว', cancelled:'ยกเลิกคำสั่งซื้อแล้ว ระงับการจัดส่ง' },
  };
  const t = $derived(text[lang]);
  const money = (minor: number) => new Intl.NumberFormat(lang === 'th' ? 'th-TH' : 'en-US', { style:'currency',currency:String(order.currency).toUpperCase() }).format(minor/(order.currency==='jpy'?1:100));
  async function show() {
    open = true; message = ''; confirmed = false;
    let operation = order.cancellation;
    if (state !== 'none' && !operation) {
      busy = true;
      try {
        const response = await fetch('/api/admin/order-cancellations', {cache:'no-store'});
        if (!response.ok) throw Error();
        const data = await response.json();
        operation = data.orders?.find((row:any)=>(row.id??row.order_id)===id)?.cancellation;
      } catch { message=t.missing; locked=true; return; }
      finally { busy=false; }
    }
    if (operation) {
      reason=operation.reason??''; existingRestock={...(operation.restock??{})}; restock=Object.fromEntries(Object.entries(operation.restock??{}).map(([sku,qty])=>[sku,String(qty)])); locked=true;
    } else if (state !== 'none' && !paidStockReview) { locked=true; message=t.missing; return; }
    else if (paidStockReview) { reason=lang==='th'?'สินค้าไม่พร้อมจัดส่งหลังได้รับชำระเงิน':'Stock unavailable after payment'; locked=false; }
    for (const item of items) restock[item.sku]??='0';
  }
  async function submit() {
    if (busy || !confirmed || completed) return;
    const quantities = existingRestock ?? Object.fromEntries(items.map((item:any)=>[item.sku,Number(restock[item.sku]??'0')]));
    if (!reason.trim() || reason.length>1000 || items.some((item:any)=>!String(restock[item.sku]??'').trim() || !Number.isInteger(quantities[item.sku]??0) || (quantities[item.sku]??0)<0 || (quantities[item.sku]??0)>(paidStockReview?0:item.quantity))) {message=t.invalid;return;}
    busy=true; message=t.busy;
    try {
      const response=await fetch('/api/admin/order-cancellations',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({orderId:id,reason:reason.trim(),restock:quantities})});
      const data=await response.json();
      if (!response.ok) {
        if(data.error==='cancellation_needs_review'){locked=true;existingRestock=quantities;message=t.review;await Promise.resolve(onSaved?.()).catch(()=>{});return;}
        message=t.failed;return;
      }
      locked=true; existingRestock=quantities;
      const result=data.order;
      completed=result?.cancellationStatus==='cancelled';
      message=data.needsReview || result?.cancellationStatus==='review' ? t.review : result?.refundStatus==='pending' ? t.pending : completed ? t.success : t.review;
      await Promise.resolve(onSaved?.()).catch(()=>{});
    } catch { locked=true;existingRestock=quantities;message=lang==='th'?'ยังยืนยันผลไม่ได้ โปรดโหลดรายการเพื่อตรวจสอบก่อนดำเนินการต่อ':'The result could not be confirmed. Your original request is preserved. Reload the cancellation queue before continuing.'; }
    finally {busy=false;}
  }
</script>

<div class="mt-4 border-t border-white/15 pt-4">
  <p class="mb-3 break-all text-sm text-neutral-300">{lang === 'th' ? 'อีเมลลูกค้า' : 'Customer email'}: {#if customerEmail}<a class="underline underline-offset-4 hover:text-white" href={'mailto:'+customerEmail}>{customerEmail}</a>{:else}{lang === 'th' ? 'ไม่มีอีเมล โปรดโหลดใหม่หลังอัปเดตฐานข้อมูล' : 'Email unavailable. Reload after updating the database.'}{/if}</p>
  {#if state==='cancelled'}<p class="text-sm text-emerald-200" role="status">{t.cancelled}</p>
  {:else if !open}<button class="btn border border-red-200/50 bg-red-950/30 text-red-100" type="button" onclick={() => void show()}>{t.open}</button>
  {:else}<form class="space-y-3 rounded-xl border border-red-200/30 bg-red-950/15 p-4" onsubmit={event=>{event.preventDefault();void submit();}}>
    <h3 class="font-semibold">{t.title}</h3><p class="text-sm text-neutral-300">{t.note}</p>
    <p>{t.total}: <strong>{money(amount)}</strong>{#if (order.refunded_amount??order.refundedAmount)>0} · {t.refund}: {money(order.refunded_amount??order.refundedAmount)}{/if}</p>
    {#if locked}<p class="text-sm text-amber-200">{t.existing}</p>{/if}
    <label class="block">{t.reason}<textarea class="input mt-1 block min-h-24 w-full" maxlength="1000" required disabled={busy||locked} bind:value={reason}></textarea></label>
    <fieldset disabled={busy||locked||paidStockReview} class="space-y-2"><legend class="mb-2 text-sm">{t.restock}</legend>{#each items as item(item.sku)}<label class="flex flex-wrap items-center justify-between gap-3 text-sm"><span>{item.name} (0–{paidStockReview?0:item.quantity})</span><input class="input w-24" type="text" inputmode="numeric" pattern="[0-9]+" required bind:value={restock[item.sku]} /></label>{/each}</fieldset>
    {#if !completed && state!=='cancelled'}<label class="flex items-start gap-2 text-sm"><input class="mt-1" type="checkbox" disabled={busy} bind:checked={confirmed}/>{t.confirm}</label><button class="btn border border-red-200/50 bg-red-900 text-white" disabled={busy||!confirmed||!reason.trim()}>{busy?t.busy:locked?t.retry:t.submit}</button>{/if}
    <button class="btn" type="button" disabled={busy} onclick={()=>open=false}>{t.close}</button><p role="status" aria-live="polite" class="text-sm text-amber-200">{message}</p>
  </form>{/if}
</div>
