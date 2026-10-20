<script lang="ts">
  import { ShoppingCart, Menu, X, Globe, User } from 'lucide-svelte';
  import { cart } from '../store/cart.svelte';
  import { ui, defaultLang } from '../i18n/ui';
  import { localizeProduct } from '../i18n/products';
  import { products } from '../lib/products';
  import {onMount} from 'svelte';
  import {formatPrice,type Locale} from '../lib/catalog';
  import {localizedPath,switchLocale} from '../utils/navigation';
  import {runCheckout, CheckoutError} from '../lib/checkout-client';
  import {loadCatalogPricing} from '../store/catalog-pricing.svelte';

  let { lang = 'en', currentPath = '/', session = null } = $props<{ lang?: keyof typeof ui, currentPath?: string, session?: any }>();

  function t(key: keyof typeof ui[typeof defaultLang]) {
    return ui[lang]?.[key] || ui[defaultLang][key];
  }

  function getPath(path:string){return localizedPath(path,lang as Locale);}
  function getLangPath(locale:Locale){return switchLocale(currentPath,locale);}
  let isMenuOpen=$state(false),isLangOpen=$state(false);
  let menuDialog=$state<HTMLDialogElement>(),cartDialog=$state<HTMLDialogElement>(),languageTrigger=$state<HTMLButtonElement>(),cartTrigger=$state<HTMLButtonElement>(),menuTrigger=$state<HTMLButtonElement>();
  let checkoutStatus=$state('');
  type DeliveryService='ems_local'|'ems_world'|'flash'|'pickup';
  let shippingCountry=$state('TH'),shippingMethod=$state<DeliveryService>('ems_local'),shippingCountries=$state<string[]>([]),servicesByCountry=$state<Record<string,DeliveryService[]>>({}),pickupEnabled=$state(false),shippingQuote=$state<any>(null),shippingStatus=$state(''),quoteSequence=0;
  function serviceOptions(){return [...(servicesByCountry[shippingCountry]??[]),...(shippingCountry==='TH'&&pickupEnabled?['pickup' as const]:[])];}
  function serviceLabel(service:DeliveryService){return t(service==='ems_local'?'cart.emsLocal':service==='ems_world'?'cart.emsWorld':service==='flash'?'cart.flash':'cart.pickup');}
  function countryLabel(code:string){return new Intl.DisplayNames([lang as Locale],{type:'region'}).of(code)??code;}
  let signInRequired=$state(false);
  function closeMenu(){isMenuOpen=false;menuDialog?.close();menuTrigger?.focus();}
  function toggleMenu(){if(isMenuOpen)closeMenu();else isMenuOpen=true;}
  function closeCart(){cart.isOpen=false;cartDialog?.close();cartTrigger?.focus();}
  function toggleCart(){if(cart.isOpen)closeCart();else cart.isOpen=true;}
  function optionLabel(key:string,value:string){const token=key==='toneHoles'?`product.tone.${value}`:key==='mouthpiece'?`product.mouth.${value}`:'';return token?ui[lang]?.[token as keyof typeof ui.en]||value:value;}
  function variantLabel(value:string){const token=value==='twoColor'?'product.endplug.twocolor':value==='plain'?'product.endplug.plain':'product.endplug.custom';return ui[lang]?.[token]||ui.en[token];}
  onMount(()=>{
    cart.init(lang as Locale);
    void loadCatalogPricing();
    fetch('/api/shipping-config',{cache:'no-store'}).then(r=>r.ok?r.json():null).then(data=>{shippingCountries=data?.countries??[];servicesByCountry=data?.servicesByCountry??{};pickupEnabled=data?.pickupEnabled===true;if(!shippingCountries.includes(shippingCountry))shippingCountry=shippingCountries[0]??'';const options=[...(servicesByCountry[shippingCountry]??[]),...(shippingCountry==='TH'&&pickupEnabled?['pickup']:[])];if(!options.includes(shippingMethod))shippingMethod=(options[0]??'pickup') as DeliveryService;refreshShippingQuote();}).catch(()=>{shippingStatus='shipping-options-unavailable';});
    const onKeydown=(event:KeyboardEvent)=>{if(event.key==='Escape' && isLangOpen){isLangOpen=false;languageTrigger?.focus();}};
    document.addEventListener('keydown',onKeydown);
    return ()=>document.removeEventListener('keydown',onKeydown);
  });
  $effect(()=>{cart.locale=lang as Locale;});
  $effect(()=>{if(cart.isOpen && cartDialog && !cartDialog.open){cartDialog.showModal();}if(isMenuOpen && menuDialog && !menuDialog.open){menuDialog.showModal();}if(cart.isOpen || isMenuOpen){const old=document.body.style.overflow;document.body.style.overflow='hidden';return ()=>{document.body.style.overflow=old;};}});
  let isCheckingOut = $state(false);

  async function refreshShippingQuote(){
    const sequence=++quoteSequence;shippingQuote=null;shippingStatus='';
    if(!cart.items.length||!shippingCountry)return;
    try{const response=await fetch('/api/shipping-quote',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({items:cart.items.map(({productId,variant,options,quantity})=>({productId,variant,options,quantity})),locale:lang,country:shippingCountry,method:shippingMethod})});const data=await response.json();if(sequence!==quoteSequence)return;if(!response.ok)throw new Error(data?.error??'shipping_unavailable');shippingQuote=data;}
    catch(error){if(sequence===quoteSequence)shippingStatus=error instanceof Error?error.message:'shipping_unavailable';}
  }
  $effect(()=>{cart.count;shippingCountry;shippingMethod;lang;if(cart.isOpen)void refreshShippingQuote();});
  $effect(()=>{const options=serviceOptions();if(options.length&&!options.includes(shippingMethod))shippingMethod=options[0];});

  async function handleCheckout() {
    if (isCheckingOut) return;
    checkoutStatus='';signInRequired=false;
    isCheckingOut = true;
    try {
      if(!shippingQuote||shippingStatus)throw new CheckoutError(shippingStatus||'shipping_unavailable');
      const url=await runCheckout(cart,lang as Locale,{country:shippingCountry,method:shippingMethod});
      window.location.assign(url);
    } catch (err) {
      const code=err instanceof CheckoutError?err.code:err instanceof Error?err.message:'';
      signInRequired=code==='sign_in_required';
      checkoutStatus=signInRequired?t('flow.signInRequired'):
        code==='storage_unavailable'||code==='storage_limit'?t('flow.storage'):
        code==='attempt_limit'?t('flow.attemptLimit'):
        code==='database_conflict'||code==='invalid_cart'?t('flow.stock'):
        code==='checkout_requires_review'||code==='checkout_not_active'||code==='checkout_conflict'?t('flow.review'):
        code==='payment_configuration_unavailable'?t('flow.unavailable'):code==='shipping_rate_unconfigured'||code==='shipping_fx_unconfigured'||code==='product_weight_unconfigured'?t('flow.unavailable'):t('flow.failed');
    } finally {
      isCheckingOut = false;
    }
  }
</script>

<nav class="fixed top-0 w-full z-50 bg-neutral-950 border-b border-white/10">
  <div class="max-w-7xl mx-auto px-4 md:px-6 h-20 flex items-center justify-between">
    <div class="flex items-center gap-4">
      <button class="md:hidden p-2 text-white hover:bg-white/10 rounded-sm transition-colors" bind:this={menuTrigger} aria-label={t('flow.menu')} aria-expanded={isMenuOpen} onpointerenter={(event) => { if (event.pointerType === 'mouse') isMenuOpen = true; }} onclick={() => isMenuOpen = true}>
        <Menu class="h-6 w-6" />
      </button>
      <a href={getPath('/')} class="text-2xl font-serif tracking-widest text-white hover:text-glow transition-all">
        <span class="font-light">Design</span><span class="font-light">Music</span>
      </a>
    </div>

    <div class="hidden md:flex items-center gap-8">
      <a href={getPath('/about')} class="text-sm tracking-widest uppercase text-neutral-300 hover:text-white transition-colors relative after:content-[''] after:absolute after:bottom-[-4px] after:left-0 after:w-0 after:h-[1px] after:bg-white hover:after:w-full after:transition-all">{t('nav.about')}</a>

      <div class="relative group">
        <a href={getPath('/product')} class="text-sm tracking-widest uppercase text-neutral-300 hover:text-white transition-colors relative after:content-[''] after:absolute after:bottom-[-4px] after:left-0 after:w-0 after:h-[1px] after:bg-white hover:after:w-full after:transition-all">{t('nav.products')}</a>
        <div class="absolute left-0 top-full pt-2 hidden group-hover:block group-focus-within:block z-50 min-w-[200px]">
          <div class="bg-neutral-900 border border-white/10 rounded-md shadow-lg overflow-hidden">
            {#each products as p}
              <a href={getPath(`/product/${p.slug}`)} class="flex items-center gap-3 px-4 py-2.5 text-sm text-white hover:bg-white/10 transition-colors">
                <img src={p.thumbnail} alt={localizeProduct(p, lang as Locale).name} class="w-6 h-6 rounded object-cover shrink-0" loading="lazy" />
                <span>{localizeProduct(p, lang as Locale).name}</span>
              </a>
            {/each}
          </div>
        </div>
      </div>

      <div class="relative group">
        <a href={getPath('/repair-services')} class="text-sm tracking-widest uppercase text-neutral-300 hover:text-white transition-colors relative after:content-[''] after:absolute after:bottom-[-4px] after:left-0 after:w-0 after:h-[1px] after:bg-white hover:after:w-full after:transition-all">{t('nav.services')}</a>
        <div class="absolute left-0 top-full pt-2 hidden group-hover:block group-focus-within:block z-50 min-w-[200px]">
          <div class="bg-neutral-900 border border-white/10 rounded-md shadow-lg overflow-hidden">
            <a href={getPath('/repair-services')} class="block px-4 py-3 text-sm text-white hover:bg-white/10 transition-colors">{t('nav.services')}</a>
            <a href={getPath('/booking')} class="block px-4 py-3 text-sm text-white hover:bg-white/10 transition-colors">{t('flow.book')}</a>
          </div>
        </div>
      </div>
    </div>

    <div class="flex items-center gap-2">
      <div class="relative" role="group" aria-label={t('flow.language')} onpointerenter={(event) => { if (event.pointerType === 'mouse') isLangOpen = true; }} onpointerleave={(event) => { if (event.pointerType === 'mouse') isLangOpen = false; }}>
        <button class="p-2 text-white hover:bg-white/10 rounded-sm transition-colors flex items-center gap-2" bind:this={languageTrigger} aria-label={t('flow.language')} aria-expanded={isLangOpen} onclick={() => isLangOpen = true}>
          <Globe class="h-5 w-5" />
        </button>
        {#if isLangOpen}
          <div class="absolute top-full right-0 w-40 pt-2 z-50">
            <div class="bg-neutral-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden py-2">
            <a href={getLangPath('en')} class="block w-full text-left px-4 py-3 hover:bg-white/10 text-sm tracking-widest text-white transition-colors" onclick={() => isLangOpen = false}>English</a>
            <a href={getLangPath('ja')} class="block w-full text-left px-4 py-3 hover:bg-white/10 text-sm tracking-widest text-white transition-colors" onclick={() => isLangOpen = false}>日本語</a>
            <a href={getLangPath('zh-CN')} class="block w-full text-left px-4 py-3 hover:bg-white/10 text-sm tracking-widest text-white transition-colors" onclick={() => isLangOpen = false}>中文</a>
            <a href={getLangPath('th')} class="block w-full text-left px-4 py-3 hover:bg-white/10 text-sm tracking-widest text-white transition-colors" onclick={() => isLangOpen = false}>ภาษาไทย</a>
            </div>
          </div>
        {/if}
      </div>
      <a aria-label={t('flow.account')} href={getPath(session ? '/profile' : '/login')} class="p-2 text-white hover:bg-white/10 rounded-full transition-colors hidden sm:block">
        {#if session?.user?.image}
          <img src={session.user.image} alt="User avatar" class="w-6 h-6 rounded-full" />
        {:else}
          <User class="h-5 w-5" />
        {/if}
      </a>
      <button class="relative p-2 text-white hover:bg-white/10 rounded-sm transition-colors" bind:this={cartTrigger} aria-label={t('flow.cart')} onclick={toggleCart}>
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

{#if isMenuOpen}
  <dialog bind:this={menuDialog} oncancel={(event)=>{event.preventDefault();closeMenu();}} aria-label={t('flow.menu')} class="fixed inset-0 m-0 w-full max-w-none h-[100dvh] z-[60] max-h-[100dvh] overflow-y-auto bg-neutral-950 flex flex-col items-center justify-start py-20">
    <button class="absolute top-6 right-6 p-2 text-white hover:bg-white/10 rounded-sm" aria-label={t('flow.close')} onclick={toggleMenu}>
      <X class="h-8 w-8" />
    </button>
    <div class="flex flex-col items-center gap-8 text-2xl font-serif uppercase">
      <a href={getPath('/about')} class="text-white hover:text-neutral-400" onclick={toggleMenu}>{t('nav.about')}</a>
      <div class="relative text-center">
        <a href={getPath('/product')} class="text-white hover:text-neutral-400" onclick={toggleMenu}>{t('nav.products')}</a>
        <div class="mt-3 flex flex-col space-y-3">
          {#each products as p}
            <a href={getPath(`/product/${p.slug}`)} class="text-lg text-neutral-400 hover:text-white transition-colors" onclick={toggleMenu}>
              {localizeProduct(p, lang as Locale).name}
            </a>
          {/each}
        </div>
      </div>
      <div class="relative text-center">
        <a href={getPath('/repair-services')} class="text-white hover:text-neutral-400" onclick={toggleMenu}>{t('nav.services')}</a>
        <div class="mt-3 flex flex-col space-y-3">
          <a href={getPath('/repair-services')} class="text-lg text-neutral-400 hover:text-white transition-colors" onclick={toggleMenu}>{t('nav.services')}</a>
          <a href={getPath('/booking')} class="text-lg text-neutral-400 hover:text-white transition-colors" onclick={toggleMenu}>{t('flow.book')}</a>
        </div>
      </div>
      <a href={getPath(session ? '/profile' : '/login')} class="text-white hover:text-neutral-400" onclick={toggleMenu}>
        {t('flow.account')}
      </a>
    </div>
    <div class="mt-10 flex flex-wrap justify-center gap-x-5 gap-y-2 border-t border-white/10 pt-6 text-sm">
      <a href={getLangPath('en')} class="text-neutral-300 hover:text-[#c2aa6a]" onclick={toggleMenu}>English</a>
      <a href={getLangPath('ja')} class="text-neutral-300 hover:text-[#c2aa6a]" onclick={toggleMenu}>日本語</a>
      <a href={getLangPath('zh-CN')} class="text-neutral-300 hover:text-[#c2aa6a]" onclick={toggleMenu}>中文</a>
      <a href={getLangPath('th')} class="text-neutral-300 hover:text-[#c2aa6a]" onclick={toggleMenu}>ภาษาไทย</a>
    </div>
  </dialog>
{/if}

{#if cart.isOpen}
  <dialog bind:this={cartDialog} oncancel={(event)=>{event.preventDefault();closeCart();}} aria-labelledby="cart-title" class="fixed top-0 right-0 m-0 ml-auto max-h-none w-full sm:w-[400px] h-full bg-neutral-950 border-l border-white/10 z-[70] flex flex-col shadow-2xl">
    <div class="p-6 border-b border-white/10 flex justify-between items-center bg-black/50">
      <h2 id="cart-title" class="font-serif text-2xl tracking-widest uppercase text-white">{t('cart.title')}</h2>
      <button class="p-2 text-white hover:bg-white/10 rounded-full" aria-label={t('flow.close')} onclick={toggleCart}>
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
            <button class="absolute top-4 right-4 text-neutral-400 hover:text-white" aria-label={t('flow.remove')} onclick={() => cart.remove(item)}>
              <X class="h-4 w-4" />
            </button>
            <h4 class="font-serif text-lg text-white pr-6">{item.name}</h4>
            {#if item.productId==='saxophone-end-plug' && item.variant}<p class="text-sm text-neutral-400">{variantLabel(item.variant)}</p>{/if}
            {#if item.options}
              <p class="text-sm text-neutral-400 font-light">{Object.entries(item.options).map(([key,value])=>optionLabel(key,value)).join(', ')}</p>
            {/if}
            <div class="flex justify-between items-center mt-2">
              <span class="text-white font-medium">{formatPrice(item.price,lang as Locale)}</span>
              <span class="text-xs text-neutral-400 bg-white/10 px-2 py-1 rounded-full">{t('cart.quantity')}: {item.quantity}</span>
            </div>
          </div>
        {/each}
        <div class="mt-3 space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4">
          <label class="block text-sm text-neutral-200">{t('cart.destination')}<select class="select select-bordered mt-1 w-full bg-neutral-900 text-white" bind:value={shippingCountry} aria-label={t('cart.destination')}>
            {#each shippingCountries as country}<option value={country}>{countryLabel(country)} ({country})</option>{/each}
          </select></label>
          <label class="block text-sm text-neutral-200">{t('cart.shippingService')}<select class="select select-bordered mt-1 w-full bg-neutral-900 text-white" bind:value={shippingMethod} aria-label={t('cart.shippingService')}>
            {#each serviceOptions() as service}<option value={service}>{serviceLabel(service)}</option>{/each}
          </select></label>
          {#if shippingQuote}<div class="space-y-1 text-sm text-neutral-300" aria-live="polite"><p>{t('cart.shipping')}: {formatPrice(shippingQuote.amount,lang as Locale)}{#if shippingQuote.fxMarginApplied}<span class="block text-xs text-neutral-400">{t('cart.fxMargin')}</span>{/if}</p></div>
          {:else if shippingStatus}<p class="text-sm text-amber-200" role="alert">{t(shippingStatus==='shipping-options-unavailable'?'cart.shippingUnavailable':'flow.unavailable')}</p>
          {:else}<p class="text-sm text-neutral-400" role="status">{t('flow.loading')}</p>{/if}
        </div>
      {/if}
    </div>

    <p class="px-6 text-sm text-neutral-300" role="status">{checkoutStatus || (!cart.storageAvailable?t('flow.storage'):'')}</p>
    {#if signInRequired}<a class="px-6 underline" href={getPath('/login')}>{t('flow.login')}</a>{/if}
    {#if cart.items.length > 0}
      <div class="p-6 border-t border-white/10 bg-black/50">
        <div class="flex justify-between items-center mb-6 text-xl">
          <span class="font-light tracking-widest uppercase text-neutral-400">{t('cart.total')}</span>
          <span class="font-serif text-white">{formatPrice(shippingQuote?.total??cart.total,lang as Locale)}</span>
        </div>
        <button class="btn btn-primary w-full disabled:opacity-50 tracking-widest uppercase text-sm font-medium py-4" onclick={handleCheckout} disabled={isCheckingOut || !cart.storageAvailable || !shippingQuote || !!shippingStatus || !serviceOptions().length}>
          {#if isCheckingOut}
            {t('cart.processing')}
          {:else}
            {t('cart.checkout')}
          {/if}
        </button>
      </div>
    {/if}
  </dialog>
{/if}
<style>dialog::backdrop{background:rgba(0,0,0,.6);backdrop-filter:blur(4px)}@media(prefers-reduced-motion:reduce){:global(*){transition-duration:0ms!important;animation-duration:0ms!important}}</style>
