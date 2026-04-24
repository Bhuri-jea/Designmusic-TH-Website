<script lang="ts">
  import AddToCartButton from '../ui/AddToCartButton.svelte';
  
  let selectedType = $state('plain');
  
  const pricing = {
    plain: 200,
    twoColor: 250,
    custom: 350
  } as Record<string, number>;

  let currentPrice = $derived(pricing[selectedType]);

  let item = $derived({
    id: `endplug-${selectedType}`,
    name: 'Saxophone End Plug',
    price: currentPrice,
    image: '/images/endplug1.jpg'
  });

  let options = $derived({
    Type: selectedType === 'plain' ? '1 Plain Color' : selectedType === 'twoColor' ? '2 Colors / Marble' : 'Custom / Animal Model'
  });
</script>

<div class="mt-8 space-y-10">
  <div class="space-y-6">
    <h3 class="font-serif tracking-widest uppercase text-sm text-neutral-400">Select Customization Option</h3>
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <button 
        class={`p-6 flex flex-col items-start gap-3 rounded-2xl border transition-all text-left ${selectedType === 'plain' ? 'bg-white text-black border-white shadow-[0_0_20px_-5px_rgba(255,255,255,0.3)]' : 'bg-transparent text-white border-white/20 hover:border-white/50'}`}
        onclick={() => selectedType = 'plain'}
      >
        <span class="font-medium tracking-widest uppercase text-sm">1 Plain Color</span>
        <span class={`text-xs font-light ${selectedType === 'plain' ? 'text-neutral-700' : 'text-neutral-400'}`}>200 THB</span>
      </button>
      <button 
        class={`p-6 flex flex-col items-start gap-3 rounded-2xl border transition-all text-left ${selectedType === 'twoColor' ? 'bg-white text-black border-white shadow-[0_0_20px_-5px_rgba(255,255,255,0.3)]' : 'bg-transparent text-white border-white/20 hover:border-white/50'}`}
        onclick={() => selectedType = 'twoColor'}
      >
        <span class="font-medium tracking-widest uppercase text-sm">2 Colors / Marble</span>
        <span class={`text-xs font-light ${selectedType === 'twoColor' ? 'text-neutral-700' : 'text-neutral-400'}`}>250 THB</span>
      </button>
      <button 
        class={`p-6 flex flex-col items-start gap-3 rounded-2xl border transition-all text-left ${selectedType === 'custom' ? 'bg-white text-black border-white shadow-[0_0_20px_-5px_rgba(255,255,255,0.3)]' : 'bg-transparent text-white border-white/20 hover:border-white/50'}`}
        onclick={() => selectedType = 'custom'}
      >
        <span class="font-medium tracking-widest uppercase text-sm">Custom Model</span>
        <span class={`text-xs font-light ${selectedType === 'custom' ? 'text-neutral-700' : 'text-neutral-400'}`}>350 THB</span>
      </button>
    </div>
  </div>

  <div class="p-8 bg-neutral-900 border border-white/10 rounded-3xl flex flex-col sm:flex-row justify-between items-center gap-8 shadow-2xl">
    <div>
      <div class="text-xs tracking-widest uppercase text-neutral-500 mb-2">Total Price</div>
      <div class="text-4xl font-serif text-white">{currentPrice} <span class="text-xl font-light">THB</span></div>
      <div class="text-xs font-light text-neutral-500 mt-3 tracking-widest uppercase">***Same price for Soprano, Alto, Tenor, Baritone***</div>
    </div>
    
    <div class="w-full sm:w-auto">
      <AddToCartButton item={item} options={options} />
    </div>
  </div>
</div>
