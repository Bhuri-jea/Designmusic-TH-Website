<script lang="ts">
  import { onMount,untrack } from 'svelte';
  import AdminRefundAllocation from './AdminRefundAllocation.svelte';
  import type { AdminLocale } from '../../lib/admin-ui-i18n';
  import type { MonthlySummary as Summary, BahtSummary } from '../../lib/monthly-report';
  let { lang = 'en',refreshVersion=0 } = $props<{ lang?: AdminLocale;refreshVersion?:number }>();
  let seenVersion=0;
  $effect(()=>{if(refreshVersion!==seenVersion){seenVersion=refreshVersion;untrack(()=>{void load();});}});
  let bahtSummary = $state<BahtSummary|null>(null);
  let month = $state(''), rows = $state<Summary[]>([]), loading = $state(false), error = $state(''), requestNo = 0;
  const labels = {
    en: { missingDate: 'paid orders have no payment date and are excluded from monthly totals until repaired (all dates).', title: 'Monthly sales', month: 'Month (Bangkok time)', reload: 'Reload summary', paid: 'Paid orders', net: 'Merchandise sales after refunds', shipping: 'Shipping collected', refunded: 'Refunds', refundedOrders: 'Orders refunded', shippingRefunded: 'Shipping refunded', provisional: 'refunds need merchandise/shipping allocation. Merchandise net is provisional.', estimated: 'paid dates were estimated for older orders.', note: 'Payments and successful refunds are counted in the month they occurred, in Bangkok time. Shipping is separate. This is a sales summary, not profit, tax totals or bank settlement.', error: 'Could not load the summary. Check the required database migration and try again.', loading: 'Loading…', currency: 'Currency' },
    th: { missingDate: 'คำสั่งซื้อที่ชำระแล้วไม่มีวันที่ชำระ จึงไม่รวมในยอดรายเดือน (นับทุกช่วงเวลา)', title: 'ยอดขายรายเดือน', month: 'เดือน (เวลาประเทศไทย)', reload: 'โหลดสรุปใหม่', paid: 'คำสั่งซื้อที่ชำระแล้ว', net: 'ยอดขายสินค้า หลังหักคืนเงิน', shipping: 'ค่าจัดส่งที่รับ', refunded: 'คืนเงิน', refundedOrders: 'คำสั่งซื้อที่คืนเงิน', shippingRefunded: 'ค่าจัดส่งที่คืน', provisional: 'รายการคืนเงินยังไม่แยกค่าสินค้าและค่าจัดส่ง ยอดขายสุทธิจึงยังไม่สมบูรณ์', estimated: 'รายการเดิมใช้วันที่ชำระเงินโดยประมาณ', note: 'นับการชำระเงินและคืนเงินสำเร็จตามเดือนที่เกิดรายการในเวลาประเทศไทย แยกค่าจัดส่งออกจากยอดสินค้า เป็นสรุปยอดขาย ไม่ใช่กำไร ภาษี หรือยอดเงินเข้าธนาคาร', error: 'โหลดสรุปไม่ได้ โปรดตรวจสอบ migration ฐานข้อมูลแล้วลองอีกครั้ง', loading: 'กำลังโหลด…', currency: 'สกุลเงิน' },
  };
  const t = $derived(labels[lang]);
  const totalPaidOrders=$derived(rows.reduce((sum,row)=>sum+row.paidOrders,0));
  const bahtLabels = {
    en: { title:'Summary in baht', estimate:'Combined USD, JPY and THB estimate using current reference rates, without markup. Actual payments stay in their original currencies; this is not bank settlement.', rates:'Frankfurter rate date', identity:'Only THB amounts in this period; no exchange rate is needed.', unavailable:'Current exchange rates are unavailable. The combined total cannot be calculated. Reload the summary to try again.', stale:'The available exchange rates are over four days old. Reload for current rates; the combined total is withheld.', perUsd:'THB per USD', perJpy:'THB per JPY' },
    th: { title:'สรุปเป็นเงินบาท', estimate:'ประมาณการรวม USD, JPY และ THB ด้วยอัตราอ้างอิงปัจจุบัน ไม่บวกส่วนเพิ่ม ยอดชำระจริงคงเป็นสกุลเงินเดิม ไม่ใช่ยอดเงินเข้าธนาคาร', rates:'วันที่อัตรา Frankfurter', identity:'ช่วงนี้มีเฉพาะยอดเงินบาท จึงไม่ต้องใช้อัตราแลกเปลี่ยน', unavailable:'ไม่สามารถโหลดอัตราแลกเปลี่ยนปัจจุบัน จึงยังรวมยอดไม่ได้ โปรดโหลดสรุปใหม่อีกครั้ง', stale:'อัตราแลกเปลี่ยนที่มีเก่ากว่าสี่วัน จึงยังไม่แสดงยอดรวม โปรดโหลดอัตราปัจจุบันใหม่', perUsd:'บาทต่อ USD', perJpy:'บาทต่อ JPY' },
  };
  const bt = $derived(bahtLabels[lang]);
  const warningTotals = $derived(rows.reduce((sum,row)=>({unallocatedRefunds:sum.unallocatedRefunds+row.unallocatedRefunds,unknownPaidDates:sum.unknownPaidDates+row.unknownPaidDates,estimatedPaidDates:sum.estimatedPaidDates+row.estimatedPaidDates}),{unallocatedRefunds:0,unknownPaidDates:0,estimatedPaidDates:0}));
  function thb(value: number) { return new Intl.NumberFormat(lang === 'th' ? 'th-TH' : 'en-US', { style: 'currency', currency: 'THB' }).format(value); }
  async function load() {
    const version = ++requestNo;
    loading = true; error = ''; rows = []; bahtSummary = null;
    try {
      const response = await fetch('/api/admin/monthly-dashboard' + (month ? `?month=${encodeURIComponent(month)}` : ''), { cache: 'no-store' });
      if (!response.ok) throw Error();
      const data = await response.json();
      if (version !== requestNo) return;
      month = data.month; rows = data.summary; bahtSummary = data.bahtSummary;
    } catch { if (version === requestNo) error = t.error; }
    finally { if (version === requestNo) loading = false; }
  }
  onMount(() => { void load(); });
</script>

<section class="rounded-2xl border border-white/15 bg-white/5 p-4 md:p-6" aria-labelledby="monthly-sales-title">
  <div class="flex flex-wrap items-end justify-between gap-4">
    <h2 id="monthly-sales-title" class="font-serif text-2xl">{bt.title}</h2>
    <div class="flex flex-wrap items-end gap-3"><label class="text-sm">{t.month}<input class="input mt-1 block" type="month" min="1900-01" max="2199-12" bind:value={month} onchange={() => void load()} /></label><button class="btn" type="button" disabled={loading} onclick={() => void load()}>{t.reload}</button></div>
  </div>
  <p class="mt-3 text-sm text-neutral-300">{t.note}</p>
  {#if rows.length}<p class="mt-4 text-lg font-medium">{t.paid}: {totalPaidOrders}</p>{/if}
  <p role="status" aria-live="polite" class="mt-3 text-amber-200">{loading ? t.loading : error}</p>
  {#if bahtSummary}
    <article class="mt-3 rounded-xl border border-white/15 bg-black/20 p-4 md:p-6">
      <p class="mt-2 text-sm text-neutral-300">{bt.estimate}</p>
      {#if bahtSummary.rates}<p class="mt-2 text-sm text-neutral-300">{bt.rates}: {bahtSummary.rates.date} · {bahtSummary.rates.usdThb.toFixed(4)} {bt.perUsd} · {bahtSummary.rates.jpyThb.toFixed(4)} {bt.perJpy}</p>{/if}
      {#if bahtSummary.status === 'available' && bahtSummary.totals}
        {#if !bahtSummary.rates}<p class="mt-2 text-sm text-neutral-300">{bt.identity}</p>{/if}
        <dl class="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <div><dt class="text-neutral-300">{t.net}</dt><dd class="mt-1 text-2xl font-medium">{thb(bahtSummary.totals.merchandiseNetTHB)}</dd></div>
          <div><dt class="text-neutral-300">{t.shipping}</dt><dd class="mt-1 text-lg">{thb(bahtSummary.totals.shippingCollectedTHB)}</dd></div>
          <div><dt class="text-neutral-300">{t.refunded}</dt><dd class="mt-1 text-lg">{thb(bahtSummary.totals.refundTHB)}</dd></div>
          <div><dt class="text-neutral-300">{t.shippingRefunded}</dt><dd class="mt-1 text-lg">{thb(bahtSummary.totals.shippingRefundedTHB)}</dd></div>
          <div><dt class="text-neutral-300">{t.refundedOrders}</dt><dd class="mt-1 text-lg">{rows.reduce((sum,row)=>sum+row.refundedOrders,0)}</dd></div>
        </dl>
      {:else}<p class="mt-4 text-amber-200" role="status">{bahtSummary.status === 'stale' ? bt.stale : bt.unavailable}</p>{/if}
      {#if warningTotals.unallocatedRefunds}<p class="mt-4 text-sm text-amber-200">{warningTotals.unallocatedRefunds} {t.provisional}</p>{/if}
      {#if warningTotals.unknownPaidDates}<p class="mt-3 text-sm text-amber-200">{warningTotals.unknownPaidDates} {t.missingDate}</p>{/if}
      {#if warningTotals.estimatedPaidDates}<p class="mt-3 text-sm text-amber-200">{warningTotals.estimatedPaidDates} {t.estimated}</p>{/if}
    </article>
  {/if}
  <AdminRefundAllocation {lang} onSaved={load}/>
</section>
