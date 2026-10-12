<script lang="ts">
  import { ui, defaultLang } from '../../i18n/ui';

  let { lang = 'en' } = $props<{ lang?: keyof typeof ui }>();

  function t(key: keyof typeof ui[typeof defaultLang]) {
    return ui[lang]?.[key] || ui[defaultLang][key];
  }

  function getPath(path: string) {
    if (lang === defaultLang) return path;
    return `/${lang}${path === '/' ? '' : path}`;
  }
</script>

<section class="w-full py-10 md:py-16 text-white">
  <div class="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">
    <div class="max-w-2xl">
      <p class="text-xs uppercase text-[#c2aa6a] mb-6">{t('hero.mission')}</p>
      <h1 class="font-serif text-4xl sm:text-5xl md:text-6xl font-light mb-6 leading-tight">
        {t('hero.title.crafting')} <span class="italic text-neutral-300">{t('hero.title.joy')}</span><br />
        {t('hero.title.through')} <span class="italic text-neutral-300">{t('hero.title.perfection')}</span>
      </h1>
      <p class="text-neutral-300 text-lg font-light max-w-xl leading-relaxed mb-8">
        {t('hero.desc')}
      </p>
      <div class="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
        <a href={getPath('/product')} class="btn btn-primary">{t('hero.cta1')}</a>
        <a href={getPath('/repair-services')} class="btn btn-secondary">{t('hero.cta2')}</a>
      </div>
    </div>

    <div class="aspect-[4/3] flex items-center justify-center bg-neutral-950 border border-white/10 rounded-md overflow-hidden">
      <img src="/images/about3.jpg" alt="Instrument repair and craftsmanship at the workshop" class="w-full h-full object-contain" fetchpriority="high" />
    </div>
  </div>
</section>
