<script lang="ts">
 import type {Locale} from '../../lib/catalog';
 let {order,lang}=$props<{order:{currency?:string;cancellationStatus?:string;cancellationReason?:string|null;refundStatus?:string|null;refundedAmount?:number};lang:Locale}>();
 const words={en:{cancelled:'Order cancelled',pending:'Cancellation / refund in progress',review:'Cancellation / refund needs review. Please contact us.',refunded:'Refund completed',amount:'Amount refunded',reason:'Reason'},th:{cancelled:'ยกเลิกคำสั่งซื้อแล้ว',pending:'กำลังดำเนินการยกเลิก / คืนเงิน',review:'การยกเลิก / คืนเงินอยู่ระหว่างตรวจสอบ โปรดติดต่อร้าน',refunded:'คืนเงินสำเร็จแล้ว',amount:'ยอดคืนเงิน',reason:'เหตุผล'},ja:{cancelled:'注文キャンセル済み',pending:'キャンセル・返金手続き中',review:'キャンセル・返金を確認中です。店舗へお問い合わせください。',refunded:'返金完了',amount:'返金額',reason:'理由'},'zh-CN':{cancelled:'订单已取消',pending:'正在取消／退款',review:'取消／退款需要核实，请联系商店。',refunded:'退款已完成',amount:'已退款金额',reason:'原因'}};
 const text=$derived(words[lang]);
 const amount=$derived(Number.isSafeInteger(order.refundedAmount)?order.refundedAmount??0:0);
 const money=(value:number)=>new Intl.NumberFormat(lang,{style:'currency',currency:(order.currency??'thb').toUpperCase()}).format(value/(order.currency==='jpy'?1:100));
</script>
{#if order.cancellationStatus&&order.cancellationStatus!=='none'||order.refundStatus}
 <div class="mt-3 rounded-lg border border-amber-200/30 bg-amber-100/5 p-3 text-sm text-amber-100" role="status">
  <p>{order.cancellationStatus==='review'||order.refundStatus==='failed'?text.review:order.refundStatus==='pending'?text.pending:order.cancellationStatus==='cancelled'?text.cancelled:text.pending}</p>
  {#if amount>0}<p class="mt-1">{order.refundStatus==='succeeded'?text.refunded:text.amount}: {money(amount)}</p>{/if}
  {#if order.cancellationReason}<p class="mt-1">{text.reason}: {order.cancellationReason}</p>{/if}
 </div>
{/if}
