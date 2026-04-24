<script lang="ts">
  import { ShoppingCart, Menu, X, Globe, User } from 'lucide-svelte';
  import { cart } from '../store/cart.svelte';
  import { fade, fly } from 'svelte/transition';
  import { ui, defaultLang } from '../i18n/ui';
  import { products } from '../lib/products';

  let { lang = 'en', currentPath = '/', session = null } = $props<{ lang?: keyof typeof ui, currentPath?: string, session?: any }>();

  function t(key: keyof typeof ui[typeof defaultLang]) {
    return ui[lang]?.[key] || ui[defaultLang][key];
  }

  function getPath(path: string) {
    if (lang === defaultLang) return path;
    return `/${lang}${path === '/' ? '' : path}`;
  }

  let isMenuOpen = $state(false);
  let isLangOpen = $state(false);

  function toggleMenu() { isMenuOpen = !isMenuOpen; }
  function toggleCart() { cart.isOpen = !cart.isOpen; }

  function getLangPath(newLang: string) {
    let pathWithoutLang = currentPath;
    const langs = ['ja', 'zh-CN', 'th'];
    for (const l of langs) {
      if (currentPath === `/${l}` || currentPath.startsWith(`/${l}/`)) {
        pathWithoutLang = currentPath.substring(l.length + 1) || '/';
        break;
      }
    }
    if (!pathWithoutLang.startsWith('/')) pathWithoutLang = '/' + pathWithoutLang;
    if (newLang === defaultLang) return pathWithoutLang;
    return `/${newLang}${pathWithoutLang === '/' ? '' : pathWithoutLang}`;
  }

  let isCheckingOut = $state(false);

  async function handleCheckout() {
    isCheckingOut = true;
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: cart.items })
      });
      const data = await res.json();
      if (data.url) { window.location.href = data.url; }
      else { alert(data.error || 'Failed to checkout'); }
    } catch (err) {
      console.error(err);
      alert('Checkout error');
    } finally {
      isCheckingOut = false;
    }
  }
</script>

<nav class="fixed top-0 w-full z-50 bg-black/60 backdrop-blur-xl border-b border-white/10 transition-all">
  <div class="max-w-7xl mx-auto px-4 md:px-6 h-20 flex items-center justify-between">
    <!-- Left: Mobile Menu & Logo -->
    <div class="flex items-center gap-4">
      <button class="md:hidden p-2 text-white hover:bg-white/10 rounded-full transition-colors" onclick={toggleMenu}>
        <Menu class="h-6 w-6" />
      </button>
      <a href={getPath('/')} class="text-2xl font-serif tracking-widest text-white hover:text-glow transition-all">
        <span class="font-light">Design</span><span class="font-bold">Music</span>
      </a>
    </div>

    <!-- Center: Desktop Links -->
    <div class="hidden md:flex items-center gap-8">
      <a href={getPath('/about')} class="text-sm tracking-widest uppercase text-neutral-300 hover:text-white transition-colors relative after:content-[''] after:absolute after:bottom-[-4px] after:left-0 after:w-0 after:h-[1px] after:bg-white hover:after:w-full after:transition-all">{t('nav.about')}</a>

      <!-- Product Dropdown — auto-driven from products.ts -->
      <div class="relative group">
        <a href={getPath('/product')} class="text-sm tracking-widest uppercase text-neutral-300 hover:text-white transition-colors relative after:content-[''] after:absolute after:bottom-[-4px] after:left-0 after:w-0 after:h-[1px] after:bg-white hover:after:w-full after:transition-all">{t('nav.products')}</a>
        <div class="absolute left-0 top-full pt-2 hidden group-hover:block z-50 min-w-[200px]">
          <div class="bg-neutral-900 border border-white/10 rounded-md shadow-lg overflow-hidden">
            {#each products as p}
              <a href={getPath(`/product/${p.slug}`)} class="flex items-center gap-3 px-4 py-2.5 text-sm text-white hover:bg-white/10 transition-colors">
                <img src={p.thumbnail} alt={p.name} class="w-6 h-6 rounded object-cover shrink-0" loading="lazy" />
                <span>{p.name}</span>
              </a>
            {/each}
          </div>
        </div>
      </div>

      <!-- Repair Services Dropdown -->
      <div class="relative group">
        <a href={getPath('/repair-services')} class="text-sm tracking-widest uppercase text-neutral-300 hover:text-white transition-colors relative after:content-[''] after:absolute after:bottom-[-4px] after:left-0 after:w-0 after:h-[1px] after:bg-white hover:after:w-full after:transition-all">{t('nav.services')}</a>
        <div class="absolute left-0 top-full pt-2 hidden group-hover:block z-50 min-w-[200px]">
          <div class="bg-neutral-900 border border-white/10 rounded-md shadow-lg overflow-hidden">
            <a href={getPath('/repair-services')} class="block px-4 py-3 text-sm text-white hover:bg-white/10 transition-colors">Overview</a>
            <a href={getPath('/booking')} class="block px-4 py-3 text-sm text-white hover:bg-white/10 transition-colors">Book Appointment</a>
          </div>
        </div>
      </div>
    </div>

    <!-- Right: Lang & Cart -->
    <div class="flex items-center gap-2">
      <div class="relative hidden sm:block">
        <button class="p-2 text-white hover:bg-white/10 rounded-full transition-colors flex items-center gap-2" onclick={() => isLangOpen = !isLangOpen}>
          <Globe class="h-5 w-5" />
        </button>
        {#if isLangOpen}
          <div class="fixed inset-0 z-40" onclick={() => isLangOpen = false} role="button" tabindex="0" onkeydown={(e) => e.key === 'Escape' && (isLangOpen = false)}></div>
          <div class="absolute top-full right-0 mt-2 w-40 bg-neutral-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-50 py-2" transition:fade={{duration: 200}}>
            <a href={getLangPath('en')} class="block w-full text-left px-4 py-3 hover:bg-white/10 text-sm tracking-widest text-white transition-colors" onclick={() => isLangOpen = false}>English</a>
            <a href={getLangPath('ja')} class="block w-full text-left px-4 py-3 hover:bg-white/10 text-sm tracking-widest text-white transition-colors" onclick={() => isLangOpen = false}>日本語</a>
            <a href={getLangPath('zh-CN')} class="block w-full text-left px-4 py-3 hover:bg-white/10 text-sm tracking-widest text-white transition-colors" onclick={() => isLangOpen = false}>中文</a>
            <a href={getLangPath('th')} class="block w-full text-left px-4 py-3 hover:bg-white/10 text-sm tracking-widest text-white transition-colors" onclick={() => isLangOpen = false}>ภาษาไทย</a>
          </div>
        {/if}
      </div>
      <a href={getPath(session ? '/profile' : '/login')} class="p-2 text-white hover:bg-white/10 rounded-full transition-colors hidden sm:block">
        {#if session?.user?.image}
          <img src={session.user.image} alt="User avatar" class="w-6 h-6 rounded-full" />
        {:else}
          <User class="h-5 w-5" />
        {/if}
      </a>
      <button class="relative p-2 text-white hover:bg-white/10 rounded-full transition-colors" onclick={toggleCart}>
        <ShoppingCart class="h-6 w-6" />
        {#if cart.count > 0}
          <span class="absolute top-0 right-0 w-4 h-4 badge-primary text-[10px] font-bold rounded-full flex items-center justify-center">
            {cart.count}
          </span>
        {/if}
      </button>
    </div>
  </div>
</nav>

<!-- Mobile Menu Overlay -->
{#if isMenuOpen}
  <div class="fixed inset-0 z-[60] bg-black/90 backdrop-blur-md flex flex-col items-center justify-center" transition:fade={{duration: 200}}>
    <button class="absolute top-6 right-6 p-2 text-white hover:bg-white/10 rounded-full" onclick={toggleMenu}>
      <X class="h-8 w-8" />
    </button>
    <div class="flex flex-col items-center gap-8 text-2xl font-serif tracking-widest uppercase">
      <a href={getPath('/about')} class="text-white hover:text-neutral-400" onclick={toggleMenu}>{t('nav.about')}</a>
      <div class="relative text-center">
        <a href={getPath('/product')} class="text-white hover:text-neutral-400" onclick={toggleMenu}>{t('nav.products')}</a>
        <!-- Mobile sub-links — auto-driven from products.ts -->
        <div class="mt-3 flex flex-col space-y-3">
          {#each products as p}
            <a href={getPath(`/product/${p.slug}`)} class="text-lg text-neutral-400 hover:text-white transition-colors" onclick={toggleMenu}>
              {p.name}
            </a>
          {/each}
        </div>
      </div>
      <div class="relative text-center">
        <a href={getPath('/repair-services')} class="text-white hover:text-neutral-400" onclick={toggleMenu}>{t('nav.services')}</a>
        <div class="mt-3 flex flex-col space-y-3">
          <a href={getPath('/booking')} class="text-lg text-neutral-400 hover:text-white transition-colors" onclick={toggleMenu}>Book Appointment</a>
        </div>
      </div>
      <a href={getPath(session ? '/profile' : '/login')} class="text-white hover:text-neutral-400" onclick={toggleMenu}>
        {session ? 'Profile' : 'Account'}
      </a>
    </div>
  </div>
{/if}

<!-- Cart Drawer -->
{#if cart.isOpen}
  <div class="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm" transition:fade={{duration: 300}} onclick={toggleCart}></div>
  <div class="fixed top-0 right-0 w-full sm:w-[400px] h-full bg-neutral-950 border-l border-white/10 z-[70] flex flex-col shadow-2xl" transition:fly={{x: 400, duration: 400, opacity: 1}}>
    <div class="p-6 border-b border-white/10 flex justify-between items-center bg-black/50">
      <h2 class="font-serif text-2xl tracking-widest uppercase text-white">{t('cart.title')}</h2>
      <button class="p-2 text-white hover:bg-white/10 rounded-full" onclick={toggleCart}>
        <X class="h-6 w-6" />
      </button>
    </div>

    <div class="flex-1 overflow-y-auto p-6 flex flex-col gap-4">
      {#if cart.items.length === 0}
        <div class="flex flex-col items-center justify-center h-full text-neutral-500 gap-4">
          <ShoppingCart class="h-16 w-16 opacity-50" />
          <p class="font-light tracking-widest uppercase">{t('cart.empty')}</p>
        </div>
      {:else}
        {#each cart.items as item}
          <div class="bg-white/5 border border-white/10 p-4 rounded-2xl flex flex-col gap-2 relative">
            <button class="absolute top-4 right-4 text-neutral-400 hover:text-white" onclick={() => cart.remove(item.id, item.options)}>
              <X class="h-4 w-4" />
            </button>
            <h4 class="font-serif text-lg text-white pr-6">{item.name}</h4>
            {#if item.options}
              <p class="text-sm text-neutral-400 font-light">{Object.values(item.options).join(', ')}</p>
            {/if}
            <div class="flex justify-between items-center mt-2">
              <span class="text-white font-medium">{item.price} THB</span>
              <span class="text-xs text-neutral-400 bg-white/10 px-2 py-1 rounded-full">Qty: {item.quantity}</span>
            </div>
          </div>
        {/each}
      {/if}
    </div>

    {#if cart.items.length > 0}
      <div class="p-6 border-t border-white/10 bg-black/50">
        <div class="flex justify-between items-center mb-6 text-xl">
          <span class="font-light tracking-widest uppercase text-neutral-400">{t('cart.total')}</span>
          <span class="font-serif text-white">{cart.total} THB</span>
        </div>
        <button class="btn btn-primary w-full disabled:opacity-50 tracking-widest uppercase text-sm font-medium py-4" onclick={handleCheckout} disabled={isCheckingOut}>
          {#if isCheckingOut}
            {t('cart.processing')}
          {:else}
            {t('cart.checkout')}
          {/if}
        </button>
      </div>
    {/if}
  </div>
{/if}
