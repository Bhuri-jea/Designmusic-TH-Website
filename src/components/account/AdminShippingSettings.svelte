<script lang="ts">
  import { onMount } from 'svelte';
  import { hasValidShippingPricePrecision, reconcileShippingRateDrafts, type ShippingRateRowDraft } from '../../lib/admin-drafts';
  import { adminText, type AdminLocale } from '../../lib/admin-ui-i18n';
  import AdminRateRows from './AdminRateRows.svelte';

  type BandDraft = ShippingRateRowDraft;
  let { lang = 'en' } = $props<{ lang?: AdminLocale }>();
  const t = (key: Parameters<typeof adminText>[1]) => adminText(lang, key);
  let settings = $state<any>({ allowed_countries: [], shipping_rates: {}, pickup_enabled: true });
  let countries = $state<string[]>([]), rates = $state<Record<string, BandDraft[]>>({});
  let settingsBaseline: { allowed_countries: string[]; pickup_enabled: boolean } | null = null;
  let ratesBaseline: Record<string, BandDraft[]> | null = null;
  let fx = $state<{ usdThb: number; jpyThb: number; date: string; source: string } | null>(null);
  let fxFailed = $state(false), saving = $state(false), status = $state(''), bandNo = 0;
  let domesticService = $state('ems_local'), intlCountry = $state('JP'), intlService = $state('epacket');
  let domesticWeight = $state(''), domesticPrice = $state(''), intlWeight = $state(''), intlPrice = $state('');

  const countryName = (code: string) => new Intl.DisplayNames([lang === 'th' ? 'th' : 'en'], { type: 'region' }).of(code) ?? code;
  const domesticServices = ['ems_local', 'flash'];
  const internationalServices = ['epacket', 'ems_world'];
  const serviceLabel = (service: string) => ({ ems_local: 'Thailand Post EMS', flash: 'Flash Express', epacket: 'Thailand Post ePacket', ems_world: 'Thailand Post EMS World' }[service] ?? service);
  const domesticKey = () => `TH:${domesticService}`;
  const internationalKey = () => `${intlCountry}:${intlService}`;
  let dKey = $derived(domesticKey()), iKey = $derived(internationalKey());

  async function load(submittedRates?: Record<string, BandDraft[]>): Promise<boolean> {
    status = '';
    const results = await Promise.allSettled([
      fetch('/api/admin/storefront', { cache: 'no-store' }).then(async response => { if (!response.ok) throw Error(); return response.json(); }),
      fetch('/api/exchange-rates', { cache: 'no-store' }).then(async response => { if (!response.ok) throw Error(); return response.json(); }),
    ]);
    const storeResult = results[0];
    if (storeResult.status === 'rejected') { status = t('unavailable'); return false; }
    const data = storeResult.value;
    countries = data.countries ?? [];
    const serverSettings = { allowed_countries: [...(data.settings?.allowed_countries ?? [])], pickup_enabled: data.settings?.pickup_enabled ?? true };
    const nextSettings = settingsBaseline && JSON.stringify(settings.allowed_countries) !== JSON.stringify(settingsBaseline.allowed_countries)
      ? { ...serverSettings, allowed_countries: settings.allowed_countries }
      : { ...serverSettings };
    if (settingsBaseline && settings.pickup_enabled !== settingsBaseline.pickup_enabled) nextSettings.pickup_enabled = settings.pickup_enabled;
    const serverRates: Record<string, BandDraft[]> = {};
    for (const [key, bands] of Object.entries(data.settings?.shipping_rates ?? {}) as [string, any[]][]) {
      serverRates[key] = bands.map((band, index) => {
        const stableKey = rates[key]?.find(row => row.maxGrams === band.maxGrams)?.key ?? `${key}:server-${++bandNo}`;
        const serverPrice = band.thb === null || band.thbMinor === null ? '' : String(band.thbMinor === undefined ? band.thb : band.thbMinor / 100);
        return { key: stableKey, maxGrams: band.maxGrams, thb: serverPrice };
      });
    }
    const mergedRates = reconcileShippingRateDrafts(ratesBaseline, serverRates, rates, submittedRates);
    settings = nextSettings;
    rates = mergedRates.drafts;
    settingsBaseline = serverSettings;
    ratesBaseline = mergedRates.baseline;
    if (results[1].status === 'fulfilled' && Number.isFinite(results[1].value.usdThb) && Number.isFinite(results[1].value.jpyThb)) {
      fx = results[1].value;
      fxFailed = false;
    } else { fx = null; fxFailed = true; }
    if (!countries.includes(intlCountry) || intlCountry === 'TH') intlCountry = countries.includes('JP') ? 'JP' : countries.find(code => code !== 'TH') ?? '';
    return true;
  }
  onMount(() => { void load(); });
  function addBand(key: string, maxKg: number | string, price: string) {
    const nextGrams = Math.max(0, ...(rates[key] ?? []).map(row => row.maxGrams)) + 100;
    const maxGrams = String(maxKg).trim() ? Math.round(Number(maxKg) * 1000) : nextGrams;
    if (!key || !Number.isInteger(maxGrams) || maxGrams < 100 || maxGrams > 30000) return;
    if ((rates[key] ?? []).some(row => row.maxGrams === maxGrams)) { status = t('duplicateWeight'); return; }
    const row: BandDraft = { key: `${key}:new-${++bandNo}`, maxGrams, thb: price.trim() };
    rates = { ...rates, [key]: [...(rates[key] ?? []), row].sort((a, b) => a.maxGrams - b.maxGrams) };
    status = t('bandAdded');
  }
  function removeBand(key: string, index: number) {
    rates = { ...rates, [key]: rates[key].filter((_, rowIndex) => rowIndex !== index) };
  }
  async function changeWeight(key: string, index: number, value: string) {
    const rows = [...rates[key]];
    const grams = Math.round(Number(value) * 1000);
    if (!value.trim() || !Number.isInteger(grams) || grams <= 0 || grams > 30000 || rows.some((row, at) => at !== index && row.maxGrams === grams)) { status = t('duplicateWeight'); return; }
    rows[index] = { ...rows[index], maxGrams: grams };
    rates = { ...rates, [key]: rows.sort((a, b) => a.maxGrams - b.maxGrams) };
    await save();
  }
  function setEnabled(code: string, enabled: boolean) {
    const next = new Set(settings.allowed_countries);
    enabled ? next.add(code) : next.delete(code);
    settings = { ...settings, allowed_countries: [...next].sort() };
  }
  async function save() {
    if (saving) return;
    const shippingRates: Record<string, { maxGrams: number; thb: number | null }[]> = {};
    for (const [key, rows] of Object.entries(rates)) {
      if (rows.some(row => !Number.isInteger(row.maxGrams) || row.maxGrams <= 0 || row.maxGrams > 30000 || row.thb.trim() !== '' && (!Number.isFinite(Number(row.thb)) || Number(row.thb) <= 0 || !hasValidShippingPricePrecision(Number(row.thb)))) || new Set(rows.map(row => row.maxGrams)).size !== rows.length) {
        status = t('saveError'); return;
      }
      const bands = rows.map(row => {
        if (!row.thb.trim()) return { maxGrams: Math.round(row.maxGrams), thb: null };
        const thb = Number(row.thb);
        return { maxGrams: Math.round(row.maxGrams), thb };
      }).sort((a, b) => a.maxGrams - b.maxGrams);
      if (bands.length) shippingRates[key] = bands;
    }
    const enabled = settings.allowed_countries as string[];
    if (!enabled.length) {
      status = t('saveError'); return;
    }
    const submittedRates = JSON.parse(JSON.stringify(rates)) as Record<string, BandDraft[]>;
    saving = true; status = t('saving');
    try {
      const response = await fetch('/api/admin/storefront', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ allowedCountries: enabled, shippingRates, pickupEnabled: settings.pickup_enabled }) });
      if (!response.ok) { status = response.status === 409 ? t('changed') : t('saveError'); return; }
      status = await load(submittedRates) ? t('saved') : t('refreshFailed');
    } catch { status = t('saveError'); }
    finally { saving = false; }
  }
</script>

<section class="mx-auto max-w-6xl space-y-8 px-4 py-10 md:px-6" aria-labelledby="shipping-title">
  <a class="btn inline-flex items-center gap-2 border border-amber-200/50 bg-white/10 text-amber-100" href={lang === 'th' ? '/th/admin' : '/admin'}><span aria-hidden="true">&larr;</span> {t('sellerTools')}</a>
  <div class="flex flex-wrap items-end justify-between gap-4"><div><h1 id="shipping-title" class="font-serif text-4xl">{t('shippingTitle')}</h1><p role="status" aria-live="polite" class="mt-2">{status}</p></div><button type="button" class="btn" disabled={saving} onclick={() => void load()}>{t('reload')}</button></div>
  <aside class="rounded-2xl border border-white/10 bg-white/5 p-4" aria-labelledby="fx-title">
    <h2 id="fx-title" class="font-medium">{t('rateSource')}</h2>
    {#if fx}<p class="mt-2">1 USD = ฿{Number(fx.usdThb).toFixed(4)} · 1 JPY = ฿{Number(fx.jpyThb).toFixed(5)}</p><p class="mt-1 text-sm text-neutral-400">{t('rateDate')}: {fx.date} · {t('rateProvider')}: {fx.source}</p>{:else if fxFailed}<p class="mt-2 text-amber-200">{t('rateUnavailable')}</p>{/if}
  </aside>
  <label class="flex items-center gap-3"><input type="checkbox" bind:checked={settings.pickup_enabled}/>{t('pickup')}</label>
  <div class="grid gap-8 xl:grid-cols-2">
    <section class="min-w-0 space-y-4" aria-labelledby="domestic-rates">
      <h2 id="domestic-rates" class="font-serif text-2xl">{t('domestic')}</h2>
      <label class="block">{t('service')}<select class="input mt-1 w-full" bind:value={domesticService}>{#each domesticServices as service}<option value={service}>{serviceLabel(service)}</option>{/each}</select></label>
      <label class="flex items-center gap-3"><input type="checkbox" checked={settings.allowed_countries.includes('TH')} onchange={event => setEnabled('TH', event.currentTarget.checked)}/>{t('enableDestination')}</label>
      <h3 class="text-sm font-medium">{countryName('TH')} · {serviceLabel(domesticService)}</h3>
      <AdminRateRows rates={rates[dKey] ?? []} {lang} onRemove={index => removeBand(dKey, index)} onPrice={(index, value) => { rates[dKey][index].thb = value; rates = { ...rates }; }} onWeight={(index, value) => changeWeight(dKey, index, value)}/>
      <div class="grid gap-3 rounded-xl border border-white/10 bg-black/20 p-4 sm:grid-cols-2">
        <label>{t('weightLimit')}<input class="input mt-1 w-full" type="text" inputmode="decimal" bind:value={domesticWeight}/></label>
        <label>{t('priceTHB')}<input class="input mt-1 w-full" type="text" inputmode="decimal" bind:value={domesticPrice}/></label>
        <button class="btn sm:col-span-2" type="button" onclick={() => { addBand(dKey, domesticWeight, domesticPrice); domesticPrice = ''; domesticWeight = ''; }}>{t('addBand')}</button>
      </div>
    </section>
    <section class="min-w-0 space-y-4" aria-labelledby="international-rates">
      <h2 id="international-rates" class="font-serif text-2xl">{t('international')}</h2>
      <label class="block">{t('destination')}<select class="input mt-1 w-full" bind:value={intlCountry}>{#each countries.filter(code => code !== 'TH') as code}<option value={code}>{countryName(code)} ({code})</option>{/each}</select></label>
      <label class="block">{t('service')}<select class="input mt-1 w-full" bind:value={intlService}>{#each internationalServices as service}<option value={service}>{serviceLabel(service)}</option>{/each}</select></label>
      <label class="flex items-center gap-3"><input type="checkbox" checked={settings.allowed_countries.includes(intlCountry)} onchange={event => setEnabled(intlCountry, event.currentTarget.checked)}/>{t('enableDestination')}</label>
      <h3 class="text-sm font-medium">{countryName(intlCountry)} ({intlCountry}) · {serviceLabel(intlService)}</h3>
      <AdminRateRows rates={rates[iKey] ?? []} {lang} onRemove={index => removeBand(iKey, index)} onPrice={(index, value) => { rates[iKey][index].thb = value; rates = { ...rates }; }} onWeight={(index, value) => changeWeight(iKey, index, value)}/>
      <div class="grid gap-3 rounded-xl border border-white/10 bg-black/20 p-4 sm:grid-cols-2">
        <label>{t('weightLimit')}<input class="input mt-1 w-full" type="text" inputmode="decimal" bind:value={intlWeight}/></label>
        <label>{t('priceTHB')}<input class="input mt-1 w-full" type="text" inputmode="decimal" bind:value={intlPrice}/></label>
        <button class="btn sm:col-span-2" type="button" onclick={() => { addBand(iKey, intlWeight, intlPrice); intlPrice = ''; intlWeight = ''; }}>{t('addBand')}</button>
      </div>
    </section>
  </div>
  <button class="btn btn-primary" disabled={saving} onclick={save}>{saving ? t('saving') : t('saveShipping')}</button>
</section>
