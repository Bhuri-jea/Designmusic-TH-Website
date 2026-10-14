<script lang="ts">
  import AddToCartButton from '../ui/AddToCartButton.svelte';
  import { ui } from '../../i18n/ui';
  import { priceFor, formatPrice, type Locale } from '../../lib/catalog';
  let {lang='en'}=$props<{lang?:Locale}>();
  function getLang():Locale { return lang; }
  function t(key:keyof typeof ui.en) { return ui[getLang()][key] || ui.en[key]; }

  let selectedHole=$state('standard');
  let selectedMouthpiece=$state('balance');
  let currentPrice=$derived(priceFor('shakuhachi',undefined,getLang())!);
  let item=$derived({productId:'shakuhachi',options:{toneHoles:selectedHole,mouthpiece:selectedMouthpiece}});
</script>

<div class="space-y-10 mt-8">
  <div class="space-y-6">
    <h3 class="font-serif tracking-widest uppercase text-sm text-neutral-400">{t('product.selectToneHole')}</h3>
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <button 
        class={`p-6 flex flex-col items-start gap-3 rounded-2xl border transition-all text-left ${selectedHole === 'standard' ? 'bg-white text-black border-white shadow-[0_0_20px_-5px_rgba(255,255,255,0.3)]' : 'bg-transparent text-white border-white/20 hover:border-white/50'}`}
        aria-pressed={selectedHole === 'standard'} onclick={() => selectedHole = 'standard'}
      >
        <span class="font-medium tracking-widest uppercase text-sm">{t('product.tone.standard')}</span>
        <span class={`text-sm font-light leading-relaxed ${selectedHole === 'standard' ? 'text-neutral-700' : 'text-neutral-400'}`}>{t('product.tone.standard.desc')}</span>
      </button>
      <button 
        class={`p-6 flex flex-col items-start gap-3 rounded-2xl border transition-all text-left ${selectedHole === 'large' ? 'bg-white text-black border-white shadow-[0_0_20px_-5px_rgba(255,255,255,0.3)]' : 'bg-transparent text-white border-white/20 hover:border-white/50'}`}
        aria-pressed={selectedHole === 'large'} onclick={() => selectedHole = 'large'}
      >
        <span class="font-medium tracking-widest uppercase text-sm">{t('product.tone.large')}</span>
        <span class={`text-sm font-light leading-relaxed ${selectedHole === 'large' ? 'text-neutral-700' : 'text-neutral-400'}`}>{t('product.tone.large.desc')}</span>
      </button>
    </div>
  </div>

  <div class="space-y-6">
    <h3 class="font-serif tracking-widest uppercase text-sm text-neutral-400">{t('product.selectMouthpiece')}</h3>
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <button 
        class={`p-6 flex flex-col items-start gap-3 rounded-2xl border transition-all text-left ${selectedMouthpiece === 'balance' ? 'bg-white text-black border-white shadow-[0_0_20px_-5px_rgba(255,255,255,0.3)]' : 'bg-transparent text-white border-white/20 hover:border-white/50'}`}
        aria-pressed={selectedMouthpiece === 'balance'} onclick={() => selectedMouthpiece = 'balance'}
      >
        <span class="font-medium tracking-widest uppercase text-sm">{t('product.mouth.balance')}</span>
        <span class={`text-xs font-light leading-relaxed ${selectedMouthpiece === 'balance' ? 'text-neutral-700' : 'text-neutral-400'}`}>{t('product.mouth.balance.desc')}</span>
      </button>
      <button 
        class={`p-6 flex flex-col items-start gap-3 rounded-2xl border transition-all text-left ${selectedMouthpiece === 'traditional' ? 'bg-white text-black border-white shadow-[0_0_20px_-5px_rgba(255,255,255,0.3)]' : 'bg-transparent text-white border-white/20 hover:border-white/50'}`}
        aria-pressed={selectedMouthpiece === 'traditional'} onclick={() => selectedMouthpiece = 'traditional'}
      >
        <span class="font-medium tracking-widest uppercase text-sm">{t('product.mouth.traditional')}</span>
        <span class={`text-xs font-light leading-relaxed ${selectedMouthpiece === 'traditional' ? 'text-neutral-700' : 'text-neutral-400'}`}>{t('product.mouth.traditional.desc')}</span>
      </button>
      <button 
        class={`p-6 flex flex-col items-start gap-3 rounded-2xl border transition-all text-left ${selectedMouthpiece === 'modern' ? 'bg-white text-black border-white shadow-[0_0_20px_-5px_rgba(255,255,255,0.3)]' : 'bg-transparent text-white border-white/20 hover:border-white/50'}`}
        aria-pressed={selectedMouthpiece === 'modern'} onclick={() => selectedMouthpiece = 'modern'}
      >
        <span class="font-medium tracking-widest uppercase text-sm">{t('product.mouth.modern')}</span>
        <span class={`text-xs font-light leading-relaxed ${selectedMouthpiece === 'modern' ? 'text-neutral-700' : 'text-neutral-400'}`}>{t('product.mouth.modern.desc')}</span>
      </button>
    </div>
  </div>

  <div class="p-8 bg-neutral-900 border border-white/10 rounded-3xl flex flex-col sm:flex-row justify-between items-center gap-8 shadow-2xl">
    <div>
      <div class="text-xs tracking-widest uppercase text-neutral-500 mb-2">{t('product.totalPrice')}</div>
      <div class="text-4xl font-serif text-white">{formatPrice(currentPrice,getLang())}</div>
    </div>
    <div class="w-full sm:w-auto">
      <AddToCartButton item={item} {lang} />
    </div>
  </div>
</div>
