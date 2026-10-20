<script lang="ts">
  import { adminText, type AdminLocale } from '../../lib/admin-ui-i18n';
  export type BandDraft = { maxGrams: number; thb: string; key: string };
  let { rates, lang, onRemove, onPrice, onWeight } = $props<{
    rates: BandDraft[]; lang: AdminLocale; onRemove: (index: number) => void;
    onPrice: (index: number, value: string) => void; onWeight: (index: number, value: string) => void;
  }>();
  const t = (key: Parameters<typeof adminText>[1]) => adminText(lang, key);
</script>

<div class="relative mt-3 overflow-x-auto">
  {#if !rates.length}<p class="mb-2 text-sm text-neutral-400">{t('noBands')}</p>{/if}
  <p class="mb-2 text-xs text-neutral-400">{t('blankPrice')}</p>
  <table class="w-full min-w-[430px] text-left text-sm"><thead><tr class="text-neutral-400"><th class="pb-2">{t('weightLimit')}</th><th class="pb-2">{t('priceTHB')}</th><th class="pb-2"></th></tr></thead><tbody>
    {#each rates as band, index (band.key)}<tr class="border-t border-white/10"><td class="py-2 pr-3"><label class="sr-only" for={'weight-'+band.key}>{t('weightLimit')}</label><input id={'weight-'+band.key} class="input w-28" type="number" min="0.02" max="30" step={band.maxGrams === 20 ? 'any' : '0.1'} value={band.maxGrams / 1000} oninput={event => onWeight(index, event.currentTarget.value)}/></td><td class="py-2 pr-3"><label class="sr-only" for={'price-'+band.key}>{t('priceTHB')}</label><input id={'price-'+band.key} class="input w-32" type="number" min="0.01" step="0.01" value={band.thb} oninput={event => onPrice(index, event.currentTarget.value)} placeholder="—"/></td><td class="py-2"><button class="rounded px-2 py-1 text-neutral-300 hover:bg-white/10" type="button" aria-label={t('removeBand')} onclick={() => onRemove(index)}>×</button></td></tr>{/each}
  </tbody></table>
</div>
