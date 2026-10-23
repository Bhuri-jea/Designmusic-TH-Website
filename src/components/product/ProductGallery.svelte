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

<div class="product-gallery space-y-6">
  <!-- Main image -->
  <div class="product-gallery-main aspect-[4/5] bg-neutral-950 rounded-md overflow-hidden border border-white/10">
    <img
      src={currentImage}
      {alt}
      class="w-full h-full object-contain"
      loading="eager"
    />
  </div>

  <!-- Thumbnails -->
  {#if galleryImages.length > 0}
    <div class="product-gallery-thumbnails grid grid-cols-3 gap-6">
      {#each galleryImages as img}
        <button
          onclick={() => (currentImage = img)}
          class="aspect-square w-full overflow-hidden rounded-sm border bg-neutral-950 transition-colors duration-150 cursor-pointer {currentImage === img ? 'border-[#c2aa6a]' : 'border-white/10 hover:border-white/40'}"
          aria-label="View image"
          aria-pressed={currentImage === img}
        >
          <img src={img} alt="" class="w-full h-full object-contain" loading="lazy" />
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .product-gallery{min-width:0}
  .product-gallery-main{background:#e6dfd4;border-color:#b9b0a4;border-radius:2px;aspect-ratio:1/1.12;max-height:650px}
  .product-gallery-thumbnails{gap:12px;grid-template-columns:repeat(3,minmax(0,1fr))}
  .product-gallery-thumbnails button{background:#fcfaf5;border-color:#b9b0a4;border-radius:2px;min-height:48px}
  .product-gallery-thumbnails button[aria-pressed="true"]{border:2px solid #78551f}
  .product-gallery-thumbnails button:hover{border-color:#78551f}
  .product-gallery button:focus-visible{outline:2px solid #78551f;outline-offset:4px}
  @media(max-width:900px){.product-gallery-main{aspect-ratio:1/1;max-height:520px}.product-gallery-thumbnails{max-width:440px}}
  @media(max-width:480px){.product-gallery-main{max-height:none;aspect-ratio:1/1.08}.product-gallery-thumbnails{gap:8px}}
</style>
