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
  <div class="aspect-[4/5] bg-neutral-950 rounded-md overflow-hidden border border-white/10">
    <img
      src={currentImage}
      {alt}
      class="w-full h-full object-contain"
      loading="eager"
    />
  </div>

  <!-- Thumbnails -->
  {#if galleryImages.length > 0}
    <div class="grid grid-cols-3 gap-6">
      {#each galleryImages as img}
        <button
          onclick={() => (currentImage = img)}
          class="aspect-square w-full overflow-hidden rounded-sm border bg-neutral-950 transition-colors duration-150 cursor-pointer {currentImage === img ? 'border-[#c2aa6a]' : 'border-white/10 hover:border-white/40'}"
          aria-label="View image"
        >
          <img src={img} alt="" class="w-full h-full object-contain" loading="lazy" />
        </button>
      {/each}
    </div>
  {/if}
</div>
