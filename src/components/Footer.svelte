<script lang="ts">
  import { Facebook, Instagram, Mail, Phone } from 'lucide-svelte';
  import {WORKSHOP_MAP_URL,workshopLabels} from '../lib/workshop';
  let { lang = 'en' } = $props<{ lang?: string }>();
  const currentYear = new Date().getFullYear();
</script>

<footer class="site-footer mt-32 pt-16 pb-8 border-t border-white/10 bg-black text-white">
  <div class="max-w-7xl mx-auto px-4 relative z-10">
    <div class="grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
      
      <div class="md:col-span-2">
        <h3 class="font-serif tracking-widest uppercase text-2xl mb-4"><span class="font-light">Design</span> <span class="font-light">Music</span></h3>
        <p class="text-neutral-400 font-light leading-relaxed max-w-sm mb-6">
          {#if lang === 'th'}ใส่ใจทุกรายละเอียดตามแนวคิด<strong>โคดาวาริ</strong>ของญี่ปุ่น เพื่อสร้างเสียงที่สมบูรณ์และความสุขในการเล่นดนตรี{:else}Embracing the Japanese philosophy of <strong>Kodawari</strong>. Uncompromising dedication to crafting perfect sound and joy.{/if}
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
        <h4 class="font-medium tracking-widest uppercase text-sm text-neutral-300 mb-6">{lang === 'th' ? 'ติดต่อเรา' : 'Contact'}</h4>
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
        <h4 class="font-medium tracking-widest uppercase text-sm text-neutral-300 mb-6">{lang === 'th' ? 'ที่ตั้งร้าน' : 'Visit Us'}</h4>
        <a href={WORKSHOP_MAP_URL} target="_blank" rel="noopener noreferrer" class="inline-flex min-h-11 items-center text-sm text-[#d8ba78] underline underline-offset-4 mb-4">{(workshopLabels[lang as keyof typeof workshopLabels]??workshopLabels.en).map} ↗</a>
        <p class="font-light text-neutral-400 leading-relaxed mb-4">
          {#if lang === 'th'}98 ถนนอาคารสงเคราะห์ ซอยนราธิวาส 15 แยก 4-2<br/>แขวงทุ่งมหาเมฆ เขตสาทร กรุงเทพมหานคร ประเทศไทย 10120{:else}98 Thanon Akarn Songkhro, Soi Narathiwas 15 Yak 4-2,<br/>Thung Maha Mek, Sathorn, Bangkok, Thailand 10120{/if}
        </p>
        <p class="font-light text-neutral-400 leading-relaxed">
          {lang === 'th' ? 'จันทร์–ศุกร์ 08.00–18.00 น.' : 'Mon — Fri: 8am — 6pm'}<br/>
          <span class="italic text-sm">{lang === 'th' ? '(กรุณาจองล่วงหน้า)' : '(Reservation based)'}</span>
        </p>
      </div>

    </div>

    <div class="pt-8 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-4 text-sm font-light text-neutral-500">
      <p>© {currentYear} Design Music. {lang === 'th' ? 'สงวนลิขสิทธิ์' : 'All rights reserved.'}</p>
      <div class="flex flex-wrap justify-center gap-6">
        <a href="/policies#privacy" lang="th" class="hover:text-white transition-colors">นโยบายความเป็นส่วนตัว</a>
        <a href="/policies#terms" lang="th" class="hover:text-white transition-colors">ข้อกำหนดและเงื่อนไข</a>
        <a href="/policies#shipping-returns" lang="th" class="hover:text-white transition-colors">การจัดส่ง คืนสินค้า และรับประกัน</a>
      </div>
    </div>
  </div>
</footer>
