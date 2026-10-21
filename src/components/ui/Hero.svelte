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

<section class="editorial-hero text-white">
  <img src="/images/repair1.jpg" alt="Instrument repair and craftsmanship at the workshop" class="editorial-hero-image" fetchpriority="high" decoding="async" />
  <div class="editorial-hero-content">
    <div class="editorial-hero-copy">

      <p class="text-sm !text-[17px] uppercase text-[#c2aa6a] mb-6">{t('hero.mission')}</p>
      <h1 class="font-serif text-4xl sm:text-5xl md:text-6xl font-light mb-6 leading-tight">
        <span class="text-[0.8em]">{t('hero.title.crafting')}</span>{' '}
        <span class="italic text-neutral-300">{t('hero.title.joy')}</span>
        <br />
        <span class="text-[0.8em]">{t('hero.title.through')}</span>{' '}
        <span class="italic text-neutral-300">{t('hero.title.perfection')}</span>
      </h1>

      <p class="text-neutral-300 text-lg font-light max-w-xl leading-relaxed mb-8">
        {t('hero.desc')}
      </p>
      <div class="hero-actions flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
        <a href={getPath('/product')} class="btn btn-primary">{t('hero.cta1')}<span aria-hidden="true">↗</span></a>
        <a href={getPath('/repair-services')} class="btn btn-secondary">{t('hero.cta2')}</a>
      </div>
    </div>

  </div>
</section>
