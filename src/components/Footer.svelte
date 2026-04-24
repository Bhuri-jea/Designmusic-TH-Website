<script lang="ts">
  import { Facebook, Instagram, Mail, Phone } from 'lucide-svelte';
  const currentYear = new Date().getFullYear();
</script>

<footer class="mt-32 pt-16 pb-8 border-t border-white/10 bg-black text-white relative overflow-hidden">
  <div class="absolute inset-0 z-0 aurora-bg opacity-20 pointer-events-none"></div>
  <div class="max-w-7xl mx-auto px-4 relative z-10">
    <div class="grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
      
      <div class="md:col-span-2">
        <h3 class="font-serif tracking-widest uppercase text-2xl mb-4"><span class="font-light">Design</span><span class="font-bold">Music</span></h3>
        <p class="text-neutral-400 font-light leading-relaxed max-w-sm mb-6">
          Embracing the Japanese philosophy of Kodawari. Uncompromising dedication to crafting perfect sound and joy.
        </p>
        <div class="flex gap-4">
          <a href="https://www.facebook.com/DesignmusicInstrumentmusicAccessories" target="_blank" rel="noreferrer" class="p-2 border border-white/20 rounded-full hover:bg-white hover:text-black transition-colors">
            <Facebook class="h-5 w-5" />
          </a>
          <a href="https://www.instagram.com/designmusic_instrument/" target="_blank" rel="noreferrer" class="p-2 border border-white/20 rounded-full hover:bg-white hover:text-black transition-colors">
            <Instagram class="h-5 w-5" />
          </a>
        </div>
      </div>

      <div>
        <h4 class="font-medium tracking-widest uppercase text-sm text-neutral-300 mb-6">Contact</h4>
        <ul class="space-y-4 font-light text-neutral-400">
          <li>
            <a href="mailto:designmusicthailand@gmail.com" class="flex items-center gap-3 hover:text-white transition-colors">
              <Mail class="h-4 w-4" /> designmusicthailand@gmail.com
            </a>
          </li>
          <li>
            <a href="tel:+66850915959" class="flex items-center gap-3 hover:text-white transition-colors">
              <Phone class="h-4 w-4" /> +66 85 091 5959
            </a>
          </li>
        </ul>
      </div>

      <div>
        <h4 class="font-medium tracking-widest uppercase text-sm text-neutral-300 mb-6">Visit Us</h4>
        <p class="font-light text-neutral-400 leading-relaxed mb-4">
          98 Thung Maha Mek Housing Estate Road,<br/>
          Sathon District, Bangkok 10120
        </p>
        <p class="font-light text-neutral-400 leading-relaxed">
          Mon — Fri: 8am — 6pm<br/>
          <span class="italic text-sm">(Reservation based)</span>
        </p>
      </div>

    </div>

    <div class="pt-8 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-4 text-sm font-light text-neutral-500">
      <p>Copyright © {currentYear} Design Music. All rights reserved.</p>
      <div class="flex gap-6">
        <a href="#" class="hover:text-white transition-colors">Privacy Policy</a>
        <a href="#" class="hover:text-white transition-colors">Terms of Service</a>
      </div>
    </div>
  </div>
</footer>
