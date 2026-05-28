<script lang="ts">
  import AddToCartButton from '../ui/AddToCartButton.svelte';
  import { ui, defaultLang } from '../../i18n/ui';
  import { products } from '../../lib/products';
  
  let selectedType = $state('plain');
  
  const pricing = {
    plain: 200,
    twoColor: 250,
    custom: 350
  } as Record<string, number>;

  let currentPrice = $derived.by(() => {
    const prod = products.find((p) => p.slug === 'saxophone-end-plug');
    const lang = getLang();
    const curr = currencyForLang(lang);
    const prodPrices = prod?.prices?.[curr];
    // Support variant pricing objects per currency: { THB: { plain: 200, twoColor: 250, custom: 350 } }
    if (prodPrices && typeof prodPrices === 'object') {
      return prodPrices[selectedType] ?? pricing[selectedType];
    }
    // Support single numeric price per currency (falls back to variant defaults)
    if (typeof prodPrices === 'number') return prodPrices;
    return pricing[selectedType];
  });

  function variantPrice(type: string) {
    const prod = products.find((p) => p.slug === 'saxophone-end-plug');
    const lang = getLang();
    const curr = currencyForLang(lang);
    const prodPrices = prod?.prices?.[curr];
    if (prodPrices && typeof prodPrices === 'object') {
      return prodPrices[type] ?? pricing[type];
    }
    if (typeof prodPrices === 'number') return prodPrices;
    return pricing[type];
  }

  let item = $derived({
    id: `endplug-${selectedType}`,
    name: 'Saxophone End Plug',
    price: currentPrice,
    image: '/images/endplug1.jpg'
  });

  function getLang() {
    if (typeof document !== 'undefined') return document.documentElement.lang || defaultLang;
    return defaultLang;
  }

  function t(key: keyof typeof ui[typeof defaultLang]) {
    const lang = getLang();
    return ui[lang]?.[key] || ui[defaultLang][key];
  }

  function currencyForLang(lang: string) {
    if (lang === 'th') return 'THB';
    if (lang === 'ja') return 'JPY';
    if (lang === 'zh-CN') return 'RMP';
    return 'USD';
  }

  let options = $derived({
    Type: selectedType === 'plain' ? t('product.endplug.plain') : selectedType === 'twoColor' ? t('product.endplug.twocolor') : t('product.endplug.custom')
  });
</script>

<div class="mt-8 space-y-10">
  <div class="space-y-6">
    <h3 class="font-serif tracking-widest uppercase text-sm text-neutral-400">{t('product.selectCustomization')}</h3>
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <button 
        class={`p-6 flex flex-col items-start gap-3 rounded-2xl border transition-all text-left ${selectedType === 'plain' ? 'bg-white text-black border-white shadow-[0_0_20px_-5px_rgba(255,255,255,0.3)]' : 'bg-transparent text-white border-white/20 hover:border-white/50'}`}
        onclick={() => selectedType = 'plain'}
      >
        <span class="font-medium tracking-widest uppercase text-sm">{t('product.endplug.plain')}</span>
        <span class={`text-xs font-light ${selectedType === 'plain' ? 'text-neutral-700' : 'text-neutral-400'}`}>{variantPrice('plain').toLocaleString()} {currencyForLang(getLang())}</span>
      </button>
      <button 
        class={`p-6 flex flex-col items-start gap-3 rounded-2xl border transition-all text-left ${selectedType === 'twoColor' ? 'bg-white text-black border-white shadow-[0_0_20px_-5px_rgba(255,255,255,0.3)]' : 'bg-transparent text-white border-white/20 hover:border-white/50'}`}
        onclick={() => selectedType = 'twoColor'}
      >
        <span class="font-medium tracking-widest uppercase text-sm">{t('product.endplug.twocolor')}</span>
        <span class={`text-xs font-light ${selectedType === 'twoColor' ? 'text-neutral-700' : 'text-neutral-400'}`}>{variantPrice('twoColor').toLocaleString()} {currencyForLang(getLang())}</span>
      </button>
      <button 
        class={`p-6 flex flex-col items-start gap-3 rounded-2xl border transition-all text-left ${selectedType === 'custom' ? 'bg-white text-black border-white shadow-[0_0_20px_-5px_rgba(255,255,255,0.3)]' : 'bg-transparent text-white border-white/20 hover:border-white/50'}`}
        onclick={() => selectedType = 'custom'}
      >
        <span class="font-medium tracking-widest uppercase text-sm">{t('product.endplug.custom')}</span>
        <span class={`text-xs font-light ${selectedType === 'custom' ? 'text-neutral-700' : 'text-neutral-400'}`}>{variantPrice('custom').toLocaleString()} {currencyForLang(getLang())}</span>
      </button>
    </div>
  </div>

  <div class="p-8 bg-neutral-900 border border-white/10 rounded-3xl flex flex-col sm:flex-row justify-between items-center gap-8 shadow-2xl">
    <div>
      <div class="text-xs tracking-widest uppercase text-neutral-500 mb-2">Total Price</div>
      <div class="text-4xl font-serif text-white">{currentPrice} <span class="text-xl font-light">{currencyForLang(getLang())}</span></div>
      <div class="text-xs font-light text-neutral-500 mt-3 tracking-widest uppercase">{t('product.endplug.note')}</div>
    </div>
    
    <div class="w-full sm:w-auto">
      <AddToCartButton item={item} options={options} />
    </div>
  </div>
</div>
