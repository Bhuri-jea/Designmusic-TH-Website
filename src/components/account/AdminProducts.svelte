<script lang="ts">
  import { onMount } from 'svelte';
  import { products } from '../../lib/products';
  import { reconcileProductDrafts, type ProductDraft, type ProductSnapshot } from '../../lib/admin-drafts';
  import { adminText, type AdminLocale } from '../../lib/admin-ui-i18n';

  let { lang = 'en' } = $props<{ lang?: AdminLocale }>();
  const t = (key: Parameters<typeof adminText>[1]) => adminText(lang, key);
  let inventory = $state<any[]>([]), drafts = $state<Record<string, ProductDraft>>({}), baseline: Record<string, ProductDraft> = {};
  let query = $state(''), busy = $state(false), status = $state(''), loadVersion = 0;
  const names: Record<string, { en: string; th: string }> = {
    'endplug-plain': { en: 'Saxophone End Plug · Plain', th: 'จุกอุดแซกโซโฟน · แบบเรียบ' },
    'endplug-twoColor': { en: 'Saxophone End Plug · Two color', th: 'จุกอุดแซกโซโฟน · สองสี' },
    'endplug-custom': { en: 'Saxophone End Plug · Custom', th: 'จุกอุดแซกโซโฟน · สั่งทำ' },
    'shakuhachi-standard-balance': { en: 'Shakuhachi · Standard · Balance', th: 'ชาคุฮาจิ · มาตรฐาน · สมดุล' },
    'shakuhachi-standard-traditional': { en: 'Shakuhachi · Standard · Traditional', th: 'ชาคุฮาจิ · มาตรฐาน · ดั้งเดิม' },
    'shakuhachi-standard-modern': { en: 'Shakuhachi · Standard · Modern', th: 'ชาคุฮาจิ · มาตรฐาน · ทันสมัย' },
    'shakuhachi-large-balance': { en: 'Shakuhachi · Large · Balance', th: 'ชาคุฮาจิ · ใหญ่ · สมดุล' },
    'shakuhachi-large-traditional': { en: 'Shakuhachi · Large · Traditional', th: 'ชาคุฮาจิ · ใหญ่ · ดั้งเดิม' },
    'shakuhachi-large-modern': { en: 'Shakuhachi · Large · Modern', th: 'ชาคุฮาจิ · ใหญ่ · ทันสมัย' },
  };
  const productName = (sku: string) => names[sku]?.[lang] ?? products.find(p => sku.startsWith(p.slug))?.name ?? sku;

  async function load(submitted?: ProductSnapshot) {
    const version = ++loadVersion;
    try {
      const response = await fetch('/api/admin/inventory', { cache: 'no-store' });
      if (!response.ok) throw Error();
      const data = await response.json();
      if (version !== loadVersion) return;
      const merged = reconcileProductDrafts(baseline, data.inventory, drafts, submitted);
      inventory = data.inventory;
      baseline = merged.baseline;
      drafts = merged.drafts;
      status = '';
    } catch {
      if (version === loadVersion) status = t('unavailable');
    }
  }
  onMount(() => { void load(); });
  const matches = (row: any) => `${row.sku} ${productName(row.sku)}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());
  function valid(row: any) {
    const d = drafts[row.sku];
    return !!d && Number.isInteger(d.onHand) && d.onHand >= row.reserved &&
      Number.isFinite(d.weightKg) && d.weightKg >= 0 && d.weightKg <= 30 &&
      Number.isFinite(d.usd) && d.usd > 0 && Number.isFinite(d.jpy) && d.jpy > 0 &&
      Number.isFinite(d.thb) && d.thb > 0;
  }
  async function save(row: any) {
    if (busy || !valid(row)) return;
    busy = true; status = t('saving');
    const snapshot = { sku: row.sku, ...drafts[row.sku] };
    try {
      const response = await fetch('/api/admin/product', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(snapshot) });
      if (!response.ok) { status = response.status === 409 ? t('changed') : t('saveError'); return; }
      await load(snapshot);
      if (!status) status = t('saved');
    } catch { status = t('saveError'); }
    finally { busy = false; }
  }
</script>

<section class="mx-auto max-w-6xl space-y-6 px-4 py-10 md:px-6" aria-labelledby="products-title">
  <a class="text-sm text-amber-200 underline" href={lang === 'th' ? '/th/admin' : '/admin'}>{t('sellerTools')}</a>
  <div class="flex flex-wrap items-end justify-between gap-4">
    <div><h1 id="products-title" class="font-serif text-4xl">{t('productsTitle')}</h1><p class="mt-2 text-neutral-400">{t('stockAndPrices')}</p></div>
    <label class="w-full max-w-sm">{t('searchProducts')}<input class="input mt-1 w-full" type="search" bind:value={query} /></label>
  </div>
  <p role="status" aria-live="polite">{status}</p>
  {#if !inventory.filter(matches).length}<p>{t('noProducts')}</p>{:else}
    <div class="relative overflow-x-auto rounded-2xl border border-white/10">
      <table class="w-full min-w-[1080px] border-collapse text-sm">
        <thead class="bg-white/5 text-left"><tr>
          <th class="p-3">{t('productsTitle')}</th><th class="p-3">{t('onHand')}</th><th class="p-3">{t('reserved')}</th><th class="p-3">{t('available')}</th><th class="p-3">{t('grossWeight')}</th>
          <th class="p-3"><span>{t('price')}</span><div class="mt-1 flex gap-2 text-xs font-normal text-neutral-400"><span>USD</span><span>JPY</span><span>THB</span></div></th><th class="p-3">{t('save')}</th>
        </tr></thead>
        <tbody>{#each inventory.filter(matches) as row (row.sku)}
          <tr class="border-t border-white/10 align-top">
            <th scope="row" class="max-w-52 p-3 text-left font-medium"><span class="block">{productName(row.sku)}</span><span class="mt-1 block break-all text-xs font-normal text-neutral-400">{row.sku}</span></th>
            <td class="p-3"><label class="sr-only" for={'stock-'+row.sku}>{t('onHand')} · {row.sku}</label><input id={'stock-'+row.sku} class="input w-24" type="number" min={row.reserved} step="1" bind:value={drafts[row.sku].onHand}/></td>
            <td class="p-3 pt-5">{row.reserved}</td><td class="p-3 pt-5">{drafts[row.sku].onHand-row.reserved}</td>
            <td class="p-3"><label class="sr-only" for={'weight-'+row.sku}>{t('grossWeight')} · {row.sku}</label><input id={'weight-'+row.sku} class="input w-28" type="number" min="0" max="30" step="0.001" bind:value={drafts[row.sku].weightKg}/></td>
            <td class="p-3"><fieldset><legend class="sr-only">{t('price')} · {row.sku}</legend><div class="flex gap-2">
              <label><span class="sr-only">USD</span><input aria-label={'USD · '+row.sku} class="input w-24" type="number" min="0.01" step="0.01" bind:value={drafts[row.sku].usd}/></label>
              <label><span class="sr-only">JPY</span><input aria-label={'JPY · '+row.sku} class="input w-24" type="number" min="1" step="1" bind:value={drafts[row.sku].jpy}/></label>
              <label><span class="sr-only">THB</span><input aria-label={'THB · '+row.sku} class="input w-24" type="number" min="0.01" step="0.01" bind:value={drafts[row.sku].thb}/></label>
            </div></fieldset></td>
            <td class="p-3"><button class="btn btn-sm" disabled={busy || !valid(row)} onclick={() => void save(row)}>{t('save')}</button></td>
          </tr>
        {/each}</tbody>
      </table>
    </div>
  {/if}
</section>
