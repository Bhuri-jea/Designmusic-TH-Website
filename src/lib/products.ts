// ============================================================
//  PRODUCT REGISTRY — Edit this file to add/remove products.
//  Changes here automatically update:
//    • Navbar dropdown (desktop + mobile)
//    • /product index grid
//    • Woodwind Accessories category gallery
// ============================================================

export interface ProductDefinition {
  slug: string;
  /** Display name shown in navbar & cards */
  name: string;
  /** Optional badge (e.g. "Best Seller", "New Release") */
  badge?: string;
  /** Small image used in navbar dropdown & product index grid */
  thumbnail: string;
  /** Full-size hero image shown on the product detail page */
  heroImage: string;
  /** Additional images shown as clickable thumbnails in the gallery */
  galleryImages: string[];
  /** One-liner shown on the product index card */
  shortDesc: string;
  /**
   * Set to the slug of a category page if this product belongs to
   * a category (e.g. "woodwindaccessories"). Category products still
   * appear on the main /product index AND inside their category page.
   */
  category?: string;
}

export const products: ProductDefinition[] = [
  // ─── Top-level products ────────────────────────────────────
  {
    slug: 'saxophone-end-plug',
    name: 'Saxophone End Plug',
    badge: 'Best Seller',
    thumbnail: '/images/endplug2.jpg',
    heroImage: '/images/endplug2.jpg',
    galleryImages: [
      '/images/endplug2.jpg',
      '/images/endplug3.jpg',
    ],
    shortDesc:
      'Customizable end plugs with over 35 color options, marble patterns, and animal models.',
  },
  {
    slug: 'shakuhachi',
    name: 'Shakuhachi S-1/D',
    badge: 'Innovative approach',
    thumbnail: '/images/ShakuhachiPoster2.jpg',
    heroImage: '/images/ShakuhachiPoster1.jpg',
    galleryImages: [
      '/images/ShakuhachiPoster2.jpg',
    ],
    shortDesc:
      'Resin-crafted Shakuhachi with interchangeable mouthpieces and adjustable pitch control.',
  },

  // ─── Woodwind Accessories category page ────────────────────
  //     (This entry drives the navbar link & index card for the
  //      category landing page itself.)
  {
    slug: 'woodwindaccessories',
    name: 'Woodwind Accessories',
    thumbnail: '/images/woodwind accessory.jpg',
    heroImage: '/images/woodwind accessory.jpg',
    galleryImages: [],
    shortDesc: 'Reed holders, thumb rests, thumb hook, key buttons inlays and more — tools that elevate your playing.',
  },

  // ─── Woodwind Accessories sub-products ─────────────────────
  //     category: 'woodwindaccessories' makes them appear inside
  //     the Woodwind Accessories page gallery automatically.
  {
    slug: 'siliconepads',
    name: 'Silicone Pads',
    badge: 'New Release',
    thumbnail: '/images/SiliconePad1.jpg',
    heroImage: '/images/SiliconePad1.jpg',
    galleryImages: ['/images/SiliconePad2.jpg', '/images/SiliconePad3.jpg'],
    shortDesc:
      'Innovative silicone pads with a pointed cone shape that helps reduce noise on octave keys.',
    category: 'woodwindaccessories',
  },

  // Add more accessories here — they'll appear automatically
  // in the Woodwind Accessories gallery page:
  // {
  //   slug: 'reed-case',
  //   name: 'Reed Case',
  //   thumbnail: '/images/reed-case.jpg',
  //   heroImage: '/images/reed-case.jpg',
  //   galleryImages: [],
  //   shortDesc: 'Premium reed storage that keeps reeds at optimal humidity.',
  //   category: 'woodwindaccessories',
  // },
];
