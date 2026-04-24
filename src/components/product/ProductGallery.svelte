<script lang="ts">
  let {
    heroImage,
    galleryImages = [] as string[],
    alt = '',
  } = $props<{
    heroImage: string;
    galleryImages?: string[];
    alt?: string;
  }>();

  let currentImage = $state(heroImage);
</script>

<div class="space-y-6">
  <!-- Main image -->
  <div class="aspect-square bg-neutral-900 rounded-3xl overflow-hidden shadow-[0_0_40px_-10px_rgba(255,255,255,0.1)] border border-white/10">
    <img
      src={currentImage}
      {alt}
      class="w-full h-full object-cover transition-all duration-700"
      loading="eager"
    />
  </div>

  <!-- Thumbnails -->
  {#if galleryImages.length > 0}
    <div class="grid grid-cols-3 gap-6">
      {#each galleryImages as img}
        <button
          onclick={() => (currentImage = img)}
          class="aspect-square w-full overflow-hidden rounded-2xl border transition-all duration-500 cursor-pointer {currentImage === img ? 'border-white/60 ring-1 ring-white/30' : 'border-white/10 hover:border-white/40'}"
          aria-label="View image"
        >
          <img src={img} alt="" class="w-full h-full object-cover" loading="lazy" />
        </button>
      {/each}
    </div>
  {/if}
</div>
