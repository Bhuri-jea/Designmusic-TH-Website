<script lang="ts">
  import { Motion } from 'svelte-motion';
  import { spring } from 'svelte/motion';
  import { ui, defaultLang } from '../../i18n/ui';

  let { lang = 'en' } = $props<{ lang?: keyof typeof ui }>();
  let scrollY = $state(0);
  
  const smoothY = spring(0, {
    stiffness: 0.05,
    damping: 0.8
  });

  $effect(() => {
    smoothY.set(scrollY);
  });

  function t(key: keyof typeof ui[typeof defaultLang]) {
    return ui[lang]?.[key] || ui[defaultLang][key];
  }

  function getPath(path: string) {
    if (lang === defaultLang) return path;
    return `/${lang}${path === '/' ? '' : path}`;
  }
  
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.2, delayChildren: 0.3 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] } }
  };
</script>

<svelte:window bind:scrollY={scrollY} />

<div class="relative w-full min-h-screen flex flex-col items-center justify-center overflow-hidden text-white selection:bg-white/20 pt-24 pb-32">

  <!-- Parallax Instrument Background -->
  <div class="absolute inset-0 z-0 opacity-20 mix-blend-screen overflow-hidden">
    <div class="w-full h-full bg-[url('/images/about3.jpg')] bg-cover bg-center bg-fixed"></div>
  </div>
  
  <div class="absolute inset-0 z-0 bg-gradient-to-b from-transparent via-neutral-950/50 to-neutral-950"></div>

  <div class="relative z-10 w-full max-w-6xl px-6 pl-1 flex flex-col items-center text-center">
    <Motion initial="hidden" animate="visible" variants={containerVariants} let:motion>
      <div use:motion class="flex flex-col items-center">
        
        <Motion variants={itemVariants} let:motion>
          <div use:motion class="mb-8">
            <span class="font-serif tracking-[0.2em] text-xs uppercase text-neutral-400 border border-white/10 px-4 py-2 rounded-full ikigai-glass">
              {t('hero.ikigai')}
            </span>
          </div>
        </Motion>

        <Motion variants={itemVariants} let:motion>
          <h1 use:motion class="font-serif text-5xl md:text-7xl lg:text-8xl font-light tracking-tight mb-8 leading-[1.1] text-glow">
            {t('hero.title.crafting')} <span class="italic font-light text-neutral-300">{t('hero.title.joy')}</span><br/>
            {t('hero.title.through')} <span class="italic font-light text-neutral-300">{t('hero.title.perfection')}</span>
          </h1>
        </Motion>

        <Motion variants={itemVariants} let:motion>
          <p use:motion class="text-neutral-400 text-lg md:text-xl font-light max-w-2xl leading-relaxed mb-12">
            {t('hero.desc')}
          </p>
        </Motion>

        <Motion variants={itemVariants} let:motion>
          <div use:motion class="flex flex-col sm:flex-row gap-6 w-full sm:w-auto">
            <a href={getPath('/product')} class="group relative px-8 py-4 bg-white text-black rounded-full font-medium tracking-wide overflow-hidden transition-all hover:scale-105 active:scale-95">
              <span class="relative z-10">{t('hero.cta1')}</span>
              <div class="absolute inset-0 bg-neutral-200 translate-y-full group-hover:translate-y-0 transition-transform duration-500 ease-out"></div>
            </a>
            
            <a href={getPath('/repair-services')} class="group px-8 py-4 bg-transparent border border-white/20 text-white rounded-full font-medium tracking-wide transition-all hover:bg-white/5 hover:border-white/40">
              {t('hero.cta2')}
            </a>
          </div>
        </Motion>

      </div>
    </Motion>
  </div>

  <!-- Vertical Scroll Line Indicator -->
  <div class="absolute bottom-0 left-1/2 -translate-x-1/2 flex-col items-center h-24 pointer-events-none opacity-50 hidden sm:flex">
    <span class="text-[10px] tracking-widest uppercase mb-2 [writing-mode:vertical-lr]">{t('hero.scroll')}</span>
    <div class="w-[1px] h-full bg-gradient-to-b from-white to-transparent"></div>
  </div>
</div>
