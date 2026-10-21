<script lang="ts">
  import { onMount,untrack } from 'svelte';
  import AdminRefundAllocation from './AdminRefundAllocation.svelte';
  import type { AdminLocale } from '../../lib/admin-ui-i18n';
  let { lang = 'en',refreshVersion=0 } = $props<{ lang?: AdminLocale;refreshVersion?:number }>();
  let seenVersion=0;
  $effect(()=>{if(refreshVersion!==seenVersion){seenVersion=refreshVersion;untrack(()=>{void load();});}});
  type Summary = { currency: string; paidOrders: number; estimatedPaidDates: number; unknownPaidDates: number; merchandiseGrossMinor: number; merchandiseNetMinor: number; shippingCollectedMinor: number; shippingRefundedMinor: number; refundMinor: number; refundedOrders: number; unallocatedRefunds: number; missingReferenceRates: number; merchandiseNetReferenceTHB: number|null; shippingCollectedReferenceTHB: number|null; refundReferenceTHB: number|null };
  let month = $state(''), rows = $state<Summary[]>([]), loading = $state(false), error = $state(''), reference = $state(false), requestNo = 0;
  const labels = {
    en: { missingDate: 'paid orders have no payment date and are excluded from monthly totals until repaired (all dates).', title: 'Monthly sales', month: 'Month (Bangkok time)', reload: 'Reload summary', paid: 'Paid orders', net: 'Merchandise sales after refunds', shipping: 'Shipping collected', refunded: 'Refunds', refundedOrders: 'Orders refunded', shippingRefunded: 'Shipping refunded', reference: 'Show frozen THB reference', missing: 'No frozen exchange rate for some transactions. THB reference is unavailable.', provisional: 'refunds need merchandise/shipping allocation. Merchandise net is provisional.', estimated: 'paid dates were estimated for older orders.', note: 'Payments and successful refunds are counted in the month they occurred, in Bangkok time. Shipping is separate. This is a sales summary, not profit, tax totals or bank settlement.', error: 'Could not load the summary. Check the required database migration and try again.', loading: 'Loading…', currency: 'Currency' },
    th: { missingDate: 'คำสั่งซื้อที่ชำระแล้วไม่มีวันที่ชำระ จึงไม่รวมในยอดรายเดือน (นับทุกช่วงเวลา)', title: 'ยอดขายรายเดือน', month: 'เดือน (เวลาประเทศไทย)', reload: 'โหลดสรุปใหม่', paid: 'คำสั่งซื้อที่ชำระแล้ว', net: 'ยอดขายสินค้า หลังหักคืนเงิน', shipping: 'ค่าจัดส่งที่รับ', refunded: 'คืนเงิน', refundedOrders: 'คำสั่งซื้อที่คืนเงิน', shippingRefunded: 'ค่าจัดส่งที่คืน', reference: 'แสดงมูลค่าอ้างอิงเงินบาท ณ วันที่สั่งซื้อ', missing: 'บางรายการไม่มีอัตราแลกเปลี่ยนเดิม จึงไม่แสดงยอดอ้างอิงเงินบาท', provisional: 'รายการคืนเงินยังไม่แยกค่าสินค้าและค่าจัดส่ง ยอดขายสุทธิจึงยังไม่สมบูรณ์', estimated: 'รายการเดิมใช้วันที่ชำระเงินโดยประมาณ', note: 'นับการชำระเงินและคืนเงินสำเร็จตามเดือนที่เกิดรายการในเวลาประเทศไทย แยกค่าจัดส่งออกจากยอดสินค้า เป็นสรุปยอดขาย ไม่ใช่กำไร ภาษี หรือยอดเงินเข้าธนาคาร', error: 'โหลดสรุปไม่ได้ โปรดตรวจสอบ migration ฐานข้อมูลแล้วลองอีกครั้ง', loading: 'กำลังโหลด…', currency: 'สกุลเงิน' },
  };
  const t = $derived(labels[lang]);
  const totalPaidOrders=$derived(rows.reduce((sum,row)=>sum+row.paidOrders,0));
  function amount(minor: number, currency: string) { return new Intl.NumberFormat(lang === 'th' ? 'th-TH' : 'en-US', { style: 'currency', currency: currency.toUpperCase() }).format(minor / (currency === 'jpy' ? 1 : 100)); }
  function thb(value: number|null) { return value === null ? '—' : new Intl.NumberFormat(lang === 'th' ? 'th-TH' : 'en-US', { style: 'currency', currency: 'THB' }).format(value); }
  async function load() {
    const version = ++requestNo;
    loading = true; error = ''; rows = [];
    try {
      const response = await fetch('/api/admin/monthly-dashboard' + (month ? `?month=${encodeURIComponent(month)}` : ''), { cache: 'no-store' });
      if (!response.ok) throw Error();
      const data = await response.json();
      if (version !== requestNo) return;
      month = data.month; rows = data.summary;
    } catch { if (version === requestNo) error = t.error; }
    finally { if (version === requestNo) loading = false; }
  }
  onMount(() => { void load(); });
</script>

<section class="rounded-2xl border border-white/15 bg-white/5 p-4 md:p-6" aria-labelledby="monthly-sales-title">
  <div class="flex flex-wrap items-end justify-between gap-4">
    <h2 id="monthly-sales-title" class="font-serif text-2xl">{t.title}</h2>
    <div class="flex flex-wrap items-end gap-3"><label class="text-sm">{t.month}<input class="input mt-1 block" type="month" min="1900-01" max="2199-12" bind:value={month} onchange={() => void load()} /></label><button class="btn" type="button" disabled={loading} onclick={() => void load()}>{t.reload}</button></div>
  </div>
  <p class="mt-3 text-sm text-neutral-300">{t.note}</p>
  {#if rows.length}<p class="mt-4 text-lg font-medium">{t.paid}: {totalPaidOrders}</p>{/if}
  <label class="mt-4 flex items-center gap-2 text-sm"><input type="checkbox" bind:checked={reference} />{t.reference}</label>
  <p role="status" aria-live="polite" class="mt-3 text-amber-200">{loading ? t.loading : error}</p>
  <div class="mt-3 grid gap-4 lg:grid-cols-3">
    {#each rows as row (row.currency)}
      <article class="rounded-xl border border-white/15 bg-black/20 p-4">
        <h3 class="font-semibold">{row.currency.toUpperCase()}</h3>
        <dl class="mt-3 space-y-3 text-sm">
          <div class="flex justify-between gap-3"><dt>{t.paid}</dt><dd>{row.paidOrders}</dd></div>
          <div><dt class="text-neutral-300">{t.net}</dt><dd class="mt-1 text-xl font-medium">{amount(row.merchandiseNetMinor,row.currency)}{#if reference}<span class="ml-2 text-sm text-neutral-300">({thb(row.merchandiseNetReferenceTHB)})</span>{/if}</dd></div>
          <div class="flex justify-between gap-3"><dt>{t.shipping}</dt><dd>{amount(row.shippingCollectedMinor,row.currency)}{#if reference}<span class="block text-neutral-300">{thb(row.shippingCollectedReferenceTHB)}</span>{/if}</dd></div>
          <div class="flex justify-between gap-3"><dt>{t.refunded}</dt><dd>{amount(row.refundMinor,row.currency)}{#if reference}<span class="block text-neutral-300">{thb(row.refundReferenceTHB)}</span>{/if}</dd></div>
          <div class="flex justify-between gap-3"><dt>{t.refundedOrders}</dt><dd>{row.refundedOrders}</dd></div>
          <div class="flex justify-between gap-3"><dt>{t.shippingRefunded}</dt><dd>{amount(row.shippingRefundedMinor,row.currency)}</dd></div>
        </dl>
        {#if row.unallocatedRefunds}<p class="mt-4 rounded border border-amber-300/40 p-3 text-sm text-amber-200">{row.unallocatedRefunds} {t.provisional}</p>{/if}
        <!-- Unknown dates cannot safely be assigned to the selected month. -->
        {#if row.unknownPaidDates}<p class="mt-3 text-xs text-amber-200">{row.unknownPaidDates} {t.missingDate}</p>{/if}
        {#if row.estimatedPaidDates}<p class="mt-3 text-xs text-amber-200">{row.estimatedPaidDates} {t.estimated}</p>{/if}
        {#if reference && row.missingReferenceRates}<p class="mt-3 text-xs text-neutral-300">{t.missing}</p>{/if}
      </article>
    {/each}
  </div>
  <AdminRefundAllocation {lang} onSaved={load}/>
</section>
