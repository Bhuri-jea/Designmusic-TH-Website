<script lang="ts">
  import { onMount } from 'svelte';
  import AdminBookingCalendar from './AdminBookingCalendar.svelte';
  import AdminShippingQuotes from './AdminShippingQuotes.svelte';
  import AdminMonthlyDashboard from './AdminMonthlyDashboard.svelte';
  import AdminOrderCancellation from './AdminOrderCancellation.svelte';
  import AdminCancellationQueue from './AdminCancellationQueue.svelte';
  import { adminText, type AdminLocale } from '../../lib/admin-ui-i18n';

  let { lang = 'en' } = $props<{ lang?: AdminLocale }>();
  const t = (key: Parameters<typeof adminText>[1]) => adminText(lang, key);
  let shipments = $state<any[]>([]), jobs = $state<any[]>([]), status = $state(''), busy = $state(false);
  let tracking = $state<Record<string, string>>({}), shippingServices = $state<Record<string, string>>({}), holdReasons = $state<Record<string, string>>({}), confirmed = $state<Record<string, boolean>>({});
  let loadVersion = 0;
  let financialRefresh=$state(0);
  async function cancellationSaved(){financialRefresh++;await load();}
  let shipmentTotal=$state(0),shipmentPage=$state(1),expandedShipments=$state(false),loadingShipments=$state(false);
  const shipmentPageSize=$derived(expandedShipments?50:5);
  const shipmentPages=$derived(Math.max(1,Math.ceil(shipmentTotal/shipmentPageSize)));
  const pageChoices=$derived(Array.from(new Set([1,shipmentPages,shipmentPage-2,shipmentPage-1,shipmentPage,shipmentPage+1,shipmentPage+2])).filter(page=>page>=1&&page<=shipmentPages).sort((a,b)=>a-b));

  function shippingServiceChoices(shipment: any) { return shipment.address?.country === 'TH' ? ['ems_local', 'flash'] : ['epacket', 'ems_world']; }
  function shippingServiceLabel(service: string) {
    const labels: Record<string, { en: string; th: string }> = {
      pickup: { en: 'Local pickup', th: 'นัดรับสินค้าเอง' }, ems_local: { en: 'Thailand Post EMS', th: 'ไปรษณีย์ไทย EMS' },
      flash: { en: 'Flash Express', th: 'Flash Express' }, epacket: { en: 'Thailand Post ePacket', th: 'ไปรษณีย์ไทย ePacket' },
      ems_world: { en: 'Thailand Post EMS World', th: 'ไปรษณีย์ไทย EMS World' },
    };
    return labels[service]?.[lang] ?? service;
  }
  async function get(path: string) { const response = await fetch('/api/admin/' + path, { cache: 'no-store' }); if (!response.ok) throw Error(); return response.json(); }
  async function load(): Promise<boolean> {
    const version = ++loadVersion;
    loadingShipments=true;
    try {
      const [shipmentData, jobData] = await Promise.all([get(`shipments?page=${shipmentPage}&pageSize=${shipmentPageSize}`), get('jobs')]);
      if (version !== loadVersion) return false;
      shipments = shipmentData.shipments; shipmentTotal=shipmentData.total??shipments.length; jobs = jobData.jobs;
      shippingServices = { ...shippingServices, ...Object.fromEntries(shipments.map((s: any) => [s.order_id, shippingServices[s.order_id] ?? s.shipping_service ?? s.fulfillment_method])) };
      status = '';
      return true;
    } catch { if (version === loadVersion) status = t('unavailable'); return false; }
    finally {if(version===loadVersion)loadingShipments=false;}
  }
  async function goToShipmentPage(page:number,expanded=expandedShipments){if(loadingShipments)return;shipmentPage=page;expandedShipments=expanded;await load();}
  function orderedDate(value:string){const date=new Date(value);return Number.isFinite(date.valueOf())?new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Bangkok',day:'2-digit',month:'2-digit',year:'numeric'}).format(date):'—';}
  onMount(() => { void load(); });
  const money = (minor: number | null | undefined, currency: string) => {
    if (!Number.isFinite(minor)) return '—';
    const code = String(currency || '').toUpperCase();
    return new Intl.NumberFormat(lang, { style: 'currency', currency: code || 'THB', maximumFractionDigits: code === 'JPY' ? 0 : 2 }).format(Number(minor) / (code === 'JPY' ? 1 : 100));
  };
  function thbReference(minor: number | null | undefined, shipment: any) {
    if (!Number.isFinite(minor)) return null;
    const currency = String(shipment.currency ?? '').toLowerCase();
    const amount = Number(minor) / (currency === 'jpy' ? 1 : 100);
    if (currency === 'thb') return amount;
    if (!Number.isFinite(shipment.reference_thb_rate) || shipment.reference_thb_rate <= 0) return null;
    return amount * shipment.reference_thb_rate;
  }
  const referenceMoney = (minor: number | null | undefined, shipment: any) => {
    const amount = thbReference(minor, shipment);
    return amount === null ? null : new Intl.NumberFormat(lang, { style: 'currency', currency: 'THB', maximumFractionDigits: 2 }).format(amount);
  };
  async function mutate(path: string, method: string, body: unknown) {
    if (busy) return;
    busy = true; status = t('saving');
    try {
      const response = await fetch('/api/admin/' + path, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!response.ok) { status = response.status === 409 ? t('changed') : t('saveError'); return; }
      if (path === 'shipment-hold' && body && typeof body === 'object' && 'orderId' in body) {
        const id = (body as any).orderId;
        delete holdReasons[id]; holdReasons = { ...holdReasons };
        confirmed = { ...confirmed, [id]: false };
      }
      status = await load() ? t('saved') : t('refreshFailed');
    } catch { status = t('saveError'); }
    finally { busy = false; }
  }
  function purpose(job: any) {
    const topic = String(job.purpose ?? job.topic ?? '');
    if (topic.startsWith('order_paid')) return t('orderNotice');
    if (topic === 'checkout_review') return lang==='th'?'ตรวจสอบการชำระเงินและสต๊อกที่จอง':'Checkout and reserved-stock review';
    if (topic.startsWith('order_refund')) return lang==='th'?'แจ้งการคืนเงิน':'Refund notification';
    if (topic.startsWith('booking_')) return topic === 'booking_google' ? t('calendarSync') : t('bookingNotice');
    if (topic.startsWith('shipping_quote')) return t('shippingQuote');
    return t('jobGeneric');
  }
  function jobDate(value: string | null) {
    if (!value) return '—';
    const date = new Date(value);
    return Number.isNaN(date.valueOf()) ? '—' : new Intl.DateTimeFormat(lang === 'th' ? 'th-TH' : 'en', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
  }
  function readableProblem(value: string) {
    if (value === 'retry_limit') return lang === 'th' ? 'ส่งไม่สำเร็จหลังลองใหม่ครบจำนวน' : 'Delivery failed after the retry limit';
    const http = /^http[_-]?(\d{3})$/i.exec(value);
    if (http) return `HTTP ${http[1]}`;
    return value.replace(/[_-]+/g, ' ').replace(/^./, character => character.toUpperCase());
  }
</script>

<div class="mx-auto max-w-6xl space-y-8 px-4 py-24 md:px-6">
  <div class="flex flex-wrap items-center justify-between gap-4"><h1 class="font-serif text-4xl">{t('sellerTools')}</h1><button class="btn" disabled={busy} onclick={load}>{t('reload')}</button></div>
  <p role="status" aria-live="polite">{status}</p>
  <nav class="flex flex-wrap gap-3" aria-label={t('sellerTools')}><a class="btn" href={lang === 'th' ? '/th/admin/products' : '/admin/products'}>{t('products')}</a><a class="btn" href={lang === 'th' ? '/th/admin/shipping' : '/admin/shipping'}>{t('shippingSettings')}</a></nav>
  <AdminMonthlyDashboard {lang} refreshVersion={financialRefresh}/>
  <AdminBookingCalendar {lang}/><AdminShippingQuotes {lang}/>
  <AdminCancellationQueue {lang} refreshVersion={financialRefresh} onSaved={cancellationSaved}/>
  <section class="space-y-4" aria-labelledby="jobs-title">
    <h2 id="jobs-title" class="font-serif text-2xl">{t('jobsTitle')}</h2>
    {#if !jobs.length}<p>{t('noJobs')}</p>{:else}<div class="grid gap-4 md:grid-cols-2">{#each jobs as job (job.id)}
      {@const referenceType = String(job.referenceType ?? '').toLowerCase()}
      <article class="rounded-2xl border border-white/10 bg-white/5 p-4"><div class="flex items-start justify-between gap-4"><h3 class="font-medium">{purpose(job)}</h3><span class="badge">{job.status === 'review' ? t('review') : t('failed')}</span></div>
        {#if job.referenceId}<p class="mt-2 text-sm">{referenceType === 'order' ? t('jobOrder') : referenceType === 'quote' ? t('jobQuote') : t('jobBooking')}: <span class="break-all">{job.referenceId}</span></p>{/if}
        {#if job.lastError}<p class="mt-2"><span class="text-neutral-400">{t('jobProblem')}:</span> {readableProblem(job.lastError)}</p>{/if}
        <p class="mt-2 text-sm text-neutral-400">{t('jobAttempts')}: {job.attempts} · {t('jobDate')}: {job.lastAttemptAt ? jobDate(job.lastAttemptAt) : jobDate(job.createdAt)}</p><p class="mt-1 text-xs text-neutral-500">Job {job.id}</p>
      </article>
    {/each}</div>{/if}
  </section>
  <section class="space-y-6" aria-labelledby="paid-orders-title">
    <div class="flex flex-wrap items-center justify-between gap-3"><h2 id="paid-orders-title" class="font-serif text-2xl">{t('paidOrders')}</h2><button class="btn btn-secondary" disabled={loadingShipments} onclick={()=>goToShipmentPage(1,!expandedShipments)}>{expandedShipments?(lang==='th'?'แสดง 5 รายการล่าสุด':'Show latest 5'):(lang==='th'?'ดูทั้งหมด · หน้าละ 50 รายการ':'View all · 50 per page')}</button></div>
    <p class="text-sm text-neutral-300" role="status">{loadingShipments?(lang==='th'?'กำลังโหลดคำสั่งซื้อ…':'Loading orders…'):`${shipmentTotal} ${lang==='th'?'คำสั่งซื้อ':'orders'}`}</p>
    {#if !shipments.length}<p>{t('noShipments')}</p>{/if}
    {#each shipments as shipment (shipment.order_id)}
      {@const currency = String(shipment.currency ?? '').toUpperCase()}
      {@const subtotal = shipment.subtotal_minor ?? (Number.isFinite(shipment.amount_total) ? shipment.amount_total - (shipment.shipping_minor ?? 0) : null)}
      {@const rateAvailable = currency === 'THB' || Number.isFinite(shipment.reference_thb_rate) && shipment.reference_thb_rate > 0}
      <article class="space-y-4 rounded-3xl border border-white/10 bg-white/5 p-6">
        <p class="text-sm text-neutral-400">{t('jobOrder')}: <span class="break-all">{shipment.order_id}</span></p>
        <p class="text-sm text-neutral-200">{lang==='th'?'วันที่สั่งซื้อ':'Ordered'}: {orderedDate(shipment.created_at)}</p>
        <p class="break-words">{shipment.recipient?.name} · {shipment.address?.line1} · {shipment.address?.city} · {shipment.address?.postal_code} · {shipment.address?.country}</p>
        <p>{t('status')}: {shipment.status} · {t('fulfillment')}: {shippingServiceLabel(shipment.shipping_service ?? shipment.fulfillment_method)}</p>
        <dl class="grid gap-2 border-y border-white/10 py-3 sm:grid-cols-3">
          <div><dt class="text-sm text-neutral-400">{t('subtotal')}</dt><dd>{#if rateAvailable && currency !== 'THB'}{referenceMoney(subtotal, shipment)}<span class="ml-2 text-sm text-neutral-300">({money(subtotal, currency)})</span>{:else}{money(subtotal, currency)}{/if}</dd></div>
          <div><dt class="text-sm text-neutral-400">{t('shippingCharge')}</dt><dd>{#if rateAvailable && currency !== 'THB'}{referenceMoney(shipment.shipping_minor, shipment)}<span class="ml-2 text-sm text-neutral-300">({money(shipment.shipping_minor, currency)})</span>{:else}{money(shipment.shipping_minor, currency)}{/if}</dd></div>
          <div><dt class="text-sm text-neutral-400">{t('totalPaid')}</dt><dd class="font-semibold">{#if rateAvailable && currency !== 'THB'}{referenceMoney(shipment.amount_total, shipment)}<span class="ml-2 text-sm text-neutral-300">({money(shipment.amount_total, currency)})</span>{:else}{money(shipment.amount_total, currency)}{/if}</dd></div>
        </dl>
        {#if rateAvailable && shipment.reference_fx_date}<p class="text-sm text-neutral-400">{t('referenceDate')}: {shipment.reference_fx_date} · {shipment.reference_fx_current?(lang==='th'?'ประมาณจากอัตราปัจจุบัน':'Current reference estimate'):(lang==='th'?'อัตราที่บันทึกเมื่อสั่งซื้อ':'Reference saved at checkout')}. {lang==='th'?'ไม่ใช่ยอดสุทธิที่ Stripe โอนเข้าธนาคาร':'This is not Stripe’s net bank settlement.'}</p>{:else if currency !== 'THB'}<p class="text-sm text-neutral-400">{t('referenceUnknown')}</p>{/if}
        {#each shipment.items as item}
          <p class="min-w-0 break-words">{item.quantity} × {item.name}<span class="ml-2 text-sm text-neutral-300">SKU: <span class="font-mono break-all">{item.sku}</span></span></p>
        {/each}
        {#if shipment.status!=='shipped'}<AdminOrderCancellation order={shipment} {lang} onSaved={cancellationSaved}/>{/if}
        {#if shipment.hold}<div class="alert alert-warning"><strong>{t('hold')}</strong> {shipment.hold_reason}</div>{/if}
        {#if shipment.payment_status === 'paid' && ['ready', 'needs_address'].includes(shipment.status) && typeof shipment.hold === 'boolean' && (!shipment.cancellation_status || shipment.cancellation_status==='none')}
          <div class="space-y-3 rounded-xl border border-white/15 bg-black/20 p-4"><label class="block" for={'hold-reason-'+shipment.order_id}>{shipment.hold ? t('reasonRelease') : t('reasonHold')}</label>
            <textarea class="input min-h-24 w-full" id={'hold-reason-'+shipment.order_id} maxlength="500" bind:value={holdReasons[shipment.order_id]} placeholder={t('holdPlaceholder')} required></textarea>
            <button type="button" class="btn" disabled={busy || !(holdReasons[shipment.order_id] ?? '').trim()} onclick={() => mutate('shipment-hold', 'POST', { orderId: shipment.order_id, hold: !shipment.hold, reason: holdReasons[shipment.order_id].trim() })}>{shipment.hold ? t('release') : t('holdAction')}</button>
          </div>
        {/if}
        {#if shipment.hold === false && shipment.status === 'ready' && shipment.fulfillment_method !== 'pickup'}
          <label class="flex gap-3"><input type="checkbox" bind:checked={confirmed[shipment.order_id]}/><span>{t('confirmDispatch')}</span></label>
          <label class="block">{t('shippingService')}<select class="input mt-1 w-full" value={shippingServices[shipment.order_id]} onchange={event => shippingServices = { ...shippingServices, [shipment.order_id]: event.currentTarget.value }}>{#each shippingServiceChoices(shipment) as service}<option value={service}>{shippingServiceLabel(service)}</option>{/each}</select></label>
          <label for={'tracking-'+shipment.order_id}>{t('trackingNumber')}</label><input class="input w-full" id={'tracking-'+shipment.order_id} bind:value={tracking[shipment.order_id]}/>
          <button class="btn btn-primary" disabled={busy || !confirmed[shipment.order_id] || !shippingServiceChoices(shipment).includes(shippingServices[shipment.order_id]) || !/^[A-Za-z0-9][A-Za-z0-9 -]{2,119}$/.test(tracking[shipment.order_id] ?? '')} onclick={() => mutate('shipments', 'POST', { orderId: shipment.order_id, shippingService: shippingServices[shipment.order_id], tracking: tracking[shipment.order_id] })}>{t('markShipped')}</button>
        {:else if shipment.fulfillment_method === 'pickup' && shipment.status === 'ready' && shipment.hold === false}
          <button class="btn btn-primary" disabled={busy} onclick={() => mutate('shipments', 'POST', { orderId: shipment.order_id, tracking: 'PICKUP' })}>{t('markCollected')}</button>
        {:else if shipment.status === 'shipped'}<p>{t('trackingCollection')}: {shipment.tracking_number}</p>{#if shipment.tracking_url}<a class="underline text-amber-200" href={shipment.tracking_url} target="_blank" rel="noreferrer">{t('openTracking')}</a>{/if}{/if}
        {#if shipment.hold_history?.length}<div class="border-t border-white/10 pt-4"><h3>{t('holdHistory')}</h3>{#each shipment.hold_history as event}<p class="mt-2 text-sm">{jobDate(event.created_at)} · {event.hold ? t('held') : t('released')} · {event.actor} · {event.reason}</p>{/each}</div>{/if}
      </article>
    {/each}
    {#if expandedShipments && shipmentPages>1}<nav class="flex flex-wrap items-center gap-2" aria-label={lang==='th'?'หน้าคำสั่งซื้อ':'Order pages'}>
      <button class="btn btn-secondary btn-sm" disabled={loadingShipments||shipmentPage===1} onclick={()=>goToShipmentPage(shipmentPage-1)}>{lang==='th'?'ก่อนหน้า':'Previous'}</button>
      {#each pageChoices as page,index}{#if index>0&&page-pageChoices[index-1]>1}<span aria-hidden="true">…</span>{/if}<button class={page===shipmentPage?'btn btn-primary btn-sm':'btn btn-secondary btn-sm'} aria-current={page===shipmentPage?'page':undefined} disabled={loadingShipments} onclick={()=>goToShipmentPage(page)}>{page}</button>{/each}
      <button class="btn btn-secondary btn-sm" disabled={loadingShipments||shipmentPage>=shipmentPages} onclick={()=>goToShipmentPage(shipmentPage+1)}>{lang==='th'?'ถัดไป':'Next'}</button><span class="text-sm">{lang==='th'?'หน้า':'Page'} {shipmentPage} / {shipmentPages}</span>
    </nav>{/if}
  </section>
</div>
