<script lang="ts">
  import AddToCartButton from '../ui/AddToCartButton.svelte';
  import { ui } from '../../i18n/ui';
  import { formatPrice, type Locale } from '../../lib/catalog';
  import {displayPriceFor} from '../../store/catalog-pricing.svelte';
  let {lang='en'}=$props<{lang?:Locale}>();
  function getLang():Locale { return lang; }
  function t(key:keyof typeof ui.en) { return ui[getLang()][key] || ui.en[key]; }

  let selectedType=$state('plain');
  let currentPrice=$derived(displayPriceFor('saxophone-end-plug',selectedType,getLang())!);
  function variantPrice(type:string){return formatPrice(displayPriceFor('saxophone-end-plug',type,getLang())!,getLang());}
  let item=$derived({productId:'saxophone-end-plug',variant:selectedType});
</script>

<div class="mt-8 space-y-10">
  <div class="space-y-6">
    <h3 class="font-serif tracking-widest uppercase text-sm text-neutral-400">{t('product.selectCustomization')}</h3>
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <button 
        class={`p-6 flex flex-col items-start gap-3 rounded-2xl border transition-all text-left ${selectedType === 'plain' ? 'bg-white text-black border-white shadow-[0_0_20px_-5px_rgba(255,255,255,0.3)]' : 'bg-transparent text-white border-white/20 hover:border-white/50'}`}
        aria-pressed={selectedType === 'plain'} onclick={() => selectedType = 'plain'}
      >
        <span class="font-medium tracking-widest uppercase text-sm">{t('product.endplug.plain')}</span>
        <span class={`text-xs font-light ${selectedType === 'plain' ? 'text-neutral-700' : 'text-neutral-400'}`}>{variantPrice('plain')}</span>
      </button>
      <button 
        class={`p-6 flex flex-col items-start gap-3 rounded-2xl border transition-all text-left ${selectedType === 'twoColor' ? 'bg-white text-black border-white shadow-[0_0_20px_-5px_rgba(255,255,255,0.3)]' : 'bg-transparent text-white border-white/20 hover:border-white/50'}`}
        aria-pressed={selectedType === 'twoColor'} onclick={() => selectedType = 'twoColor'}
      >
        <span class="font-medium tracking-widest uppercase text-sm">{t('product.endplug.twocolor')}</span>
        <span class={`text-xs font-light ${selectedType === 'twoColor' ? 'text-neutral-700' : 'text-neutral-400'}`}>{variantPrice('twoColor')}</span>
      </button>
      <button 
        class={`p-6 flex flex-col items-start gap-3 rounded-2xl border transition-all text-left ${selectedType === 'custom' ? 'bg-white text-black border-white shadow-[0_0_20px_-5px_rgba(255,255,255,0.3)]' : 'bg-transparent text-white border-white/20 hover:border-white/50'}`}
        aria-pressed={selectedType === 'custom'} onclick={() => selectedType = 'custom'}
      >
        <span class="font-medium tracking-widest uppercase text-sm">{t('product.endplug.custom')}</span>
        <span class={`text-xs font-light ${selectedType === 'custom' ? 'text-neutral-700' : 'text-neutral-400'}`}>{variantPrice('custom')}</span>
      </button>
    </div>
  </div>

  <div class="p-8 bg-neutral-900 border border-white/10 rounded-3xl flex flex-col sm:flex-row justify-between items-center gap-8 shadow-2xl">
    <div>
      <div class="text-xs tracking-widest uppercase text-neutral-500 mb-2">Total Price</div>
      <div class="text-4xl font-serif text-white">{formatPrice(currentPrice,getLang())}</div>
      <div class="text-xs font-light text-neutral-500 mt-3 tracking-widest uppercase">{t('product.endplug.note')}</div>
    </div>
    
    <div class="w-full sm:w-auto">
      <AddToCartButton item={item} {lang} />
    </div>
  </div>
</div>
