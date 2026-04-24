<script lang="ts">
  import AddToCartButton from '../ui/AddToCartButton.svelte';
  
  let selectedHole = $state('standard');
  let selectedMouthpiece = $state('balance');
  
  const currentPrice = 15000;

  let item = $derived({
    id: `shakuhachi`,
    name: 'Shakuhachi S-1/D',
    price: currentPrice,
    image: '/images/ShakuhachiPoster1.jpg'
  });

  let options = $derived({
    'Tone Holes': selectedHole === 'standard' ? 'Standard' : 'Large',
    'Mouthpiece': selectedMouthpiece === 'balance' ? 'Balance' : selectedMouthpiece === 'traditional' ? 'Traditional' : 'Modern'
  });
</script>

<div class="space-y-10 mt-8">
  <div class="space-y-6">
    <h3 class="font-serif tracking-widest uppercase text-sm text-neutral-400">Select Tone Hole Size</h3>
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <button 
        class={`p-6 flex flex-col items-start gap-3 rounded-2xl border transition-all text-left ${selectedHole === 'standard' ? 'bg-white text-black border-white shadow-[0_0_20px_-5px_rgba(255,255,255,0.3)]' : 'bg-transparent text-white border-white/20 hover:border-white/50'}`}
        onclick={() => selectedHole = 'standard'}
      >
        <span class="font-medium tracking-widest uppercase text-sm">Standard Tone Holes</span>
        <span class={`text-sm font-light leading-relaxed ${selectedHole === 'standard' ? 'text-neutral-700' : 'text-neutral-400'}`}>Compact, clear tone. Easy pitch control.</span>
      </button>
      <button 
        class={`p-6 flex flex-col items-start gap-3 rounded-2xl border transition-all text-left ${selectedHole === 'large' ? 'bg-white text-black border-white shadow-[0_0_20px_-5px_rgba(255,255,255,0.3)]' : 'bg-transparent text-white border-white/20 hover:border-white/50'}`}
        onclick={() => selectedHole = 'large'}
      >
        <span class="font-medium tracking-widest uppercase text-sm">Large Tone Holes</span>
        <span class={`text-sm font-light leading-relaxed ${selectedHole === 'large' ? 'text-neutral-700' : 'text-neutral-400'}`}>Rich, expressive tone. *Not recommended for small hands.</span>
      </button>
    </div>
  </div>

  <div class="space-y-6">
    <h3 class="font-serif tracking-widest uppercase text-sm text-neutral-400">Select Mouthpiece Type</h3>
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <button 
        class={`p-6 flex flex-col items-start gap-3 rounded-2xl border transition-all text-left ${selectedMouthpiece === 'balance' ? 'bg-white text-black border-white shadow-[0_0_20px_-5px_rgba(255,255,255,0.3)]' : 'bg-transparent text-white border-white/20 hover:border-white/50'}`}
        onclick={() => selectedMouthpiece = 'balance'}
      >
        <span class="font-medium tracking-widest uppercase text-sm">Balance</span>
        <span class={`text-xs font-light leading-relaxed ${selectedMouthpiece === 'balance' ? 'text-neutral-700' : 'text-neutral-400'}`}>Standard, clear tone. Beginner friendly.</span>
      </button>
      <button 
        class={`p-6 flex flex-col items-start gap-3 rounded-2xl border transition-all text-left ${selectedMouthpiece === 'traditional' ? 'bg-white text-black border-white shadow-[0_0_20px_-5px_rgba(255,255,255,0.3)]' : 'bg-transparent text-white border-white/20 hover:border-white/50'}`}
        onclick={() => selectedMouthpiece = 'traditional'}
      >
        <span class="font-medium tracking-widest uppercase text-sm">Traditional</span>
        <span class={`text-xs font-light leading-relaxed ${selectedMouthpiece === 'traditional' ? 'text-neutral-700' : 'text-neutral-400'}`}>Dark, warm and complex tone.</span>
      </button>
      <button 
        class={`p-6 flex flex-col items-start gap-3 rounded-2xl border transition-all text-left ${selectedMouthpiece === 'modern' ? 'bg-white text-black border-white shadow-[0_0_20px_-5px_rgba(255,255,255,0.3)]' : 'bg-transparent text-white border-white/20 hover:border-white/50'}`}
        onclick={() => selectedMouthpiece = 'modern'}
      >
        <span class="font-medium tracking-widest uppercase text-sm">Modern</span>
        <span class={`text-xs font-light leading-relaxed ${selectedMouthpiece === 'modern' ? 'text-neutral-700' : 'text-neutral-400'}`}>Bright tone, enhanced harmonics.</span>
      </button>
    </div>
  </div>

  <div class="p-8 bg-neutral-900 border border-white/10 rounded-3xl flex flex-col sm:flex-row justify-between items-center gap-8 shadow-2xl">
    <div>
      <div class="text-xs tracking-widest uppercase text-neutral-500 mb-2">Total Price</div>
      <div class="text-4xl font-serif text-white">{currentPrice.toLocaleString()} <span class="text-xl font-light">THB</span></div>
    </div>
    <div class="w-full sm:w-auto">
      <AddToCartButton item={item} options={options} />
    </div>
  </div>
</div>
