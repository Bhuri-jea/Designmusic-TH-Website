<script lang="ts">
  import { ShoppingCart, Menu, X, Globe, User } from 'lucide-svelte';
  import { cart } from '../store/cart.svelte';
  import { ui, defaultLang } from '../i18n/ui';
  import { localizeProduct } from '../i18n/products';
  import { products } from '../lib/products';
  import WorkshopLocation from './ui/WorkshopLocation.svelte';
  import {onMount} from 'svelte';
  import {formatPrice,type Locale} from '../lib/catalog';
  import {localizedPath,switchLocale} from '../utils/navigation';
  import {runCheckout, CheckoutError} from '../lib/checkout-client';
  import {loadCatalogPricing} from '../store/catalog-pricing.svelte';
  import { shippingText, serviceLabel } from '../i18n/shipping';

  let { lang = 'en', currentPath = '/', session = null } = $props<{ lang?: keyof typeof ui, currentPath?: string, session?: any }>();

  function t(key: keyof typeof ui[typeof defaultLang]) {
    return ui[lang]?.[key] || ui[defaultLang][key];
  }

  function getPath(path:string){return localizedPath(path,lang as Locale);}
  function getLangPath(locale:Locale){return switchLocale(currentPath,locale);}
  let isMenuOpen=$state(false),isLangOpen=$state(false);
  let menuDialog=$state<HTMLDialogElement>(),cartDialog=$state<HTMLDialogElement>(),languageTrigger=$state<HTMLButtonElement>(),cartTrigger=$state<HTMLButtonElement>(),menuTrigger=$state<HTMLButtonElement>();
  let checkoutStatus=$state('');
  let quoteRequestState=$state(''),isRequestingQuote=$state(false);
  type DeliveryService='ems_local'|'ems_world'|'epacket'|'flash'|'pickup';
  type ShippingAddress={line1:string;line2:string;city:string;state:string;postal_code:string;country:string};
  const emptyAddress=():ShippingAddress=>({line1:'',line2:'',city:'',state:'',postal_code:'',country:''});
  let shippingCountry=$state(''),pickupSelected=$state(false),shippingCountries=$state<string[]>([]),pickupEnabled=$state(false),shippingQuote=$state<any>(null),shippingStatus=$state(''),quoteSequence=0;
  let selectedService=$state<DeliveryService>('ems_local'),quoting=$state(false),configError=$state(false);
  let profileCustomer=$state<any>(null),profileLoaded=$state(false),profileLoginRequired=$state(false),profileError=$state(false),configLoaded=$state(false),countryInitialized=false;
  let recipientName=$state(''),address=$state<ShippingAddress>(emptyAddress()),addressDirty=$state(false),savingAddress=$state(false),addressSaveError=$state(false);
  let shippingMethod=$derived<DeliveryService>(shippingCountry==='TH'&&pickupSelected?'pickup':selectedService);
  let international=$derived(!!shippingCountry&&shippingCountry!=='TH');
  let savedAddressMatches=$derived(!!profileCustomer?.name?.trim()&&!!profileCustomer?.shippingAddress&&profileCustomer.shippingAddress.country===shippingCountry&&!!profileCustomer.shippingAddress.line1?.trim()&&!!profileCustomer.shippingAddress.city?.trim()&&!!profileCustomer.shippingAddress.postal_code?.trim());
  let canSaveRecipient=$derived(!!recipientName.trim()&&!!address.line1.trim()&&!!address.city.trim()&&!!address.postal_code.trim()&&!profileLoginRequired&&!profileError);
  function countryLabel(code:string){return new Intl.DisplayNames([lang as Locale],{type:'region'}).of(code)??code;}
  let signInRequired=$state(false);
  function closeMenu(){isMenuOpen=false;menuDialog?.close();menuTrigger?.focus();}
  function toggleMenu(){if(isMenuOpen)closeMenu();else isMenuOpen=true;}
  function closeCart(){cart.isOpen=false;cartDialog?.close();cartTrigger?.focus();}
  function toggleCart(){if(cart.isOpen)closeCart();else{cart.isOpen=true;void loadProfile();}}
  function optionLabel(key:string,value:string){const token=key==='toneHoles'?`product.tone.${value}`:key==='mouthpiece'?`product.mouth.${value}`:'';return token?ui[lang]?.[token as keyof typeof ui.en]||value:value;}
  function variantLabel(value:string){const token=value==='twoColor'?'product.endplug.twocolor':value==='plain'?'product.endplug.plain':'product.endplug.custom';return ui[lang]?.[token]||ui.en[token];}
  onMount(()=>{
    cart.init(lang as Locale);
    void loadCatalogPricing();
    void initializeShipping();
    const onKeydown=(event:KeyboardEvent)=>{if(event.key==='Escape' && isLangOpen){isLangOpen=false;languageTrigger?.focus();}};
    document.addEventListener('keydown',onKeydown);
    return ()=>document.removeEventListener('keydown',onKeydown);
  });
  async function initializeShipping(){
    configError=false;
    const [configResult,profileResult]=await Promise.allSettled([fetch('/api/shipping-config',{cache:'no-store',signal:AbortSignal.timeout(15000)}),fetch('/api/profile',{cache:'no-store',signal:AbortSignal.timeout(15000)})]);
    try{if(configResult.status!=='fulfilled'||!configResult.value.ok)throw Error();const config=await configResult.value.json();shippingCountries=Array.isArray(config.countries)?config.countries:[];pickupEnabled=config.pickupEnabled===true;configLoaded=true;}catch{configError=true;shippingStatus='shipping-options-unavailable';configLoaded=true;}
    if(profileResult.status==='fulfilled')await applyProfileResponse(profileResult.value);else{profileError=true;profileLoaded=true;}
    resolveInitialCountry();
  }
  async function applyProfileResponse(response:Response){
    profileError=false;profileLoginRequired=response.status===401;
    if(response.status===401){profileCustomer=null;profileLoaded=true;resolveInitialCountry();return;}
    if(!response.ok){profileError=true;profileLoaded=true;resolveInitialCountry();return;}
    try{const result=await response.json();profileCustomer=result.customer??null;if(!addressDirty){recipientName=profileCustomer?.name??'';address={...emptyAddress(),...(profileCustomer?.shippingAddress??{})};}profileLoaded=true;resolveInitialCountry();}catch{profileError=true;profileLoaded=true;resolveInitialCountry();}
  }
  async function loadProfile(){try{const response=await fetch('/api/profile',{cache:'no-store',signal:AbortSignal.timeout(15000)});await applyProfileResponse(response);}catch{profileError=true;profileLoaded=true;}}
  function resolveInitialCountry(){if(!configLoaded||!profileLoaded||countryInitialized&&shippingCountries.includes(shippingCountry))return;const saved=profileCustomer?.shippingAddress?.country;shippingCountry=shippingCountries.includes(saved)?saved:shippingCountries.includes('TH')?'TH':shippingCountries[0]??'';selectedService=shippingCountry==='TH'?'ems_local':'epacket';countryInitialized=true;}
  function setShippingCountry(value:string){shippingCountry=value;selectedService=value==='TH'?'ems_local':'epacket';pickupSelected=false;quoteRequestState='';shippingQuote=null;shippingStatus='';++quoteSequence;}
  function markAddressDirty(){addressDirty=true;shippingQuote=null;shippingStatus='';quoteRequestState='';++quoteSequence;}
  function addressRequiredForCountry(country=shippingCountry){const saved=profileCustomer?.shippingAddress;return !profileCustomer?.name?.trim()||!saved||saved.country!==country||!saved.line1?.trim()||!saved.city?.trim()||!saved.postal_code?.trim();}
  function profileLink(){return getPath('/login')+'?returnTo='+encodeURIComponent(getPath('/profile'));}
  $effect(()=>{cart.locale=lang as Locale;});
  $effect(()=>{if(cart.isOpen && cartDialog && !cartDialog.open){cartDialog.showModal();}if(isMenuOpen && menuDialog && !menuDialog.open){menuDialog.showModal();}if(cart.isOpen || isMenuOpen){const old=document.body.style.overflow;document.body.style.overflow='hidden';return ()=>{document.body.style.overflow=old;};}});
  let isCheckingOut = $state(false);

  async function refreshShippingQuote(){
    const sequence=++quoteSequence;shippingQuote=null;shippingStatus='';quoteRequestState='';
    if(configError){shippingStatus='shipping-options-unavailable';quoting=false;return;}
    if(!cart.items.length||!shippingCountry||!configLoaded||!profileLoaded)return;
    if(international&&(!savedAddressMatches||addressDirty||profileLoginRequired||profileError)){quoting=false;return;}
    quoting=true;
    try{const response=await fetch('/api/shipping-quote',{method:'POST',headers:{'Content-Type':'application/json'},signal:AbortSignal.timeout(15000),body:JSON.stringify({items:cart.items.map(({productId,variant,options,quantity})=>({productId,variant,options,quantity})),locale:lang,country:shippingCountry,method:shippingMethod})});const data=await response.json();if(sequence!==quoteSequence)return;if(!response.ok)throw new Error(data?.error??'shipping_unavailable');shippingQuote=data;}
    catch(error){if(sequence===quoteSequence){const code=error instanceof Error?error.message:'shipping_unavailable';shippingStatus=['shipping_rate_unconfigured','shipping_weight_uncovered','shipping_service_unavailable'].includes(code)?'shipping_contact_required':code;}}
    finally{if(sequence===quoteSequence)quoting=false;}
  }
  $effect(()=>{cart.count;cart.items.map(item=>`${item.productId}:${item.variant??''}:${JSON.stringify(item.options??{})}:${item.quantity}`).join('|');shippingCountry;shippingMethod;lang;configLoaded;profileLoaded;savedAddressMatches;addressDirty;const isOpen=cart.isOpen;if(isOpen)void refreshShippingQuote();});

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
        code==='shipping_address_required'?t('cart.shippingAddressNeeded'):code==='shipping_address_country_mismatch'?t('cart.shippingAddressMismatch'):
        code==='storage_unavailable'||code==='storage_limit'?t('flow.storage'):
        code==='attempt_limit'?t('flow.attemptLimit'):
        code==='database_conflict'||code==='invalid_cart'?t('flow.stock'):
        code==='checkout_requires_review'||code==='checkout_not_active'||code==='checkout_conflict'?t('flow.review'):
        code==='payment_configuration_unavailable'?t('flow.unavailable'):code==='shipping_rate_unconfigured'||code==='shipping_fx_unconfigured'||code==='product_weight_unconfigured'?t('flow.unavailable'):t('flow.failed');
    } finally {
      isCheckingOut = false;
    }
  }

  async function requestShippingQuote(){
    if(isRequestingQuote)return;
    isRequestingQuote=true;quoteRequestState='';
    try{
      if(profileLoginRequired){quoteRequestState='login';return;}
      if(addressRequiredForCountry()){quoteRequestState=profileCustomer?.shippingAddress?.country&&profileCustomer.shippingAddress.country!==shippingCountry?'address_mismatch':'address_required';return;}
      const request=await cart.submit(lang as Locale);
      const response=await fetch('/api/shipping-quotes',{method:'POST',headers:{'Content-Type':'application/json'},signal:AbortSignal.timeout(15000),body:JSON.stringify({requestKey:request.requestKey,locale:request.locale,items:request.items,country:shippingCountry,method:shippingMethod})});
      const data=await response.json().catch(()=>({}));
      if(response.status===401){quoteRequestState='login';return;}
      if(!response.ok){
        quoteRequestState=data?.error==='shipping_address_required'?'address_required':data?.error==='shipping_address_country_mismatch'?'address_mismatch':['insufficient_stock','stock_unavailable','database_conflict'].includes(data?.error)?'stock':'error';
        return;
      }
      quoteRequestState=data?.quote?'sent':'error';
    }catch{quoteRequestState='error';}
    finally{isRequestingQuote=false;}
  }
  async function calculateInternationalShipping(){
    if(savingAddress||!canSaveRecipient)return;savingAddress=true;addressSaveError=false;shippingQuote=null;shippingStatus='';quoteRequestState='';
    try{const savedAddress={...address,country:shippingCountry.toUpperCase()};const response=await fetch('/api/profile',{method:'PATCH',headers:{'Content-Type':'application/json'},signal:AbortSignal.timeout(15000),body:JSON.stringify({name:recipientName.trim(),phone:profileCustomer?.phone??null,shippingAddress:savedAddress})});const result=await response.json().catch(()=>({}));if(response.status===401){profileLoginRequired=true;quoteRequestState='login';return;}if(!response.ok)throw Error();profileCustomer=result.customer??{...profileCustomer,name:recipientName.trim(),shippingAddress:savedAddress};if(shippingCountry!==savedAddress.country)return;address={...savedAddress};recipientName=profileCustomer.name??recipientName.trim();addressDirty=false;profileLoginRequired=false;await refreshShippingQuote();}catch{addressSaveError=true;}finally{savingAddress=false;}
  }
</script>

<nav class="site-header fixed top-0 w-full z-50 bg-neutral-950 border-b border-white/10">
  <div class="header-inner max-w-7xl mx-auto px-4 md:px-6 h-20 flex items-center justify-between">
    <div class="flex items-center gap-4">
      <button class="mobile-menu-trigger md:hidden p-2 text-white hover:bg-white/10 rounded-sm transition-colors" bind:this={menuTrigger} aria-label={t('flow.menu')} aria-expanded={isMenuOpen} onpointerenter={(event) => { if (event.pointerType === 'mouse') isMenuOpen = true; }} onclick={() => isMenuOpen = true}>
        <Menu class="h-6 w-6" />
      </button>
      <a href={getPath('/')} class="brand-wordmark text-2xl font-serif tracking-widest text-white hover:text-glow transition-all">
        <span class="font-light">Design</span> <span class="font-light">Music</span>
      </a>
    </div>

    <div class="header-links hidden md:flex items-center gap-8">
      <a href={getPath('/about')} class="text-sm tracking-widest uppercase text-neutral-300 hover:text-white transition-colors relative after:content-[''] after:absolute after:bottom-[-4px] after:left-0 after:w-0 after:h-[1px] after:bg-white hover:after:w-full after:transition-all">{t('nav.about')}</a>

      <div class="relative group">
        <a href={getPath('/product')} class="text-sm tracking-widest uppercase text-neutral-300 hover:text-white transition-colors relative after:content-[''] after:absolute after:bottom-[-4px] after:left-0 after:w-0 after:h-[1px] after:bg-white hover:after:w-full after:transition-all">{t('nav.products')}</a>
        <div class="absolute left-0 top-full pt-2 hidden group-hover:block group-focus-within:block z-50 min-w-[200px]">
          <div class="product-menu bg-neutral-900 border border-white/10 rounded-md shadow-lg overflow-hidden">
            <a href={getPath('/product')} class="product-menu-heading">{t('nav.products')}</a>
            {#each products as p}
              <a href={getPath(`/product/${p.slug}`)} class="product-menu-item flex items-center px-4 py-2.5 text-sm text-white hover:bg-white/10 transition-colors">
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
  <dialog bind:this={menuDialog} oncancel={(event)=>{event.preventDefault();closeMenu();}} aria-label={t('flow.menu')} class="mobile-navigation-panel fixed inset-0 m-0 w-full max-w-none h-[100dvh] z-[60] max-h-[100dvh] overflow-y-auto bg-neutral-950 flex flex-col items-center justify-start py-20">
    <button class="absolute top-6 right-6 p-2 text-white hover:bg-white/10 rounded-sm" aria-label={t('flow.close')} onclick={toggleMenu}>
      <X class="h-8 w-8" />
    </button>
    <a href={getPath('/')} class="mobile-navigation-brand font-serif text-white" style="font-size:36px;font-weight:400;line-height:1.2;margin-bottom:28px;letter-spacing:-.055em" onclick={toggleMenu}>Design Music</a>
    <div class="flex flex-col items-center gap-8 text-2xl font-serif uppercase">
      <a href={getPath('/about')} class="text-white hover:text-neutral-400" onclick={toggleMenu}>{t('nav.about')}</a>
      <div class="mobile-product-menu relative text-left">
        <a href={getPath('/product')} class="text-white hover:text-neutral-400" onclick={toggleMenu}>{t('nav.products')}</a>
        <div class="mobile-product-items mt-3 flex flex-col space-y-3">
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
              <div class="flex items-center gap-2" role="group" aria-label={t('cart.quantity')+' — '+item.name}>
                <button type="button" class="btn btn-secondary min-h-11 min-w-11 px-3" aria-label={t('cart.decreaseQuantity')} disabled={item.quantity<=1||isCheckingOut||isRequestingQuote} onclick={()=>cart.setQuantity(item,item.quantity-1)}>−</button>
                <span class="min-w-6 text-center text-sm" aria-live="polite">{item.quantity}</span>
                <button type="button" class="btn btn-secondary min-h-11 min-w-11 px-3" aria-label={t('cart.increaseQuantity')} disabled={item.quantity>=10||isCheckingOut||isRequestingQuote} onclick={()=>cart.setQuantity(item,item.quantity+1)}>+</button>
              </div>
            </div>
          </div>
        {/each}
        <div class="mt-3 space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4">
          <label class="block text-sm text-neutral-200">{t('cart.destination')}<select class="select select-bordered mt-1 w-full bg-neutral-900 text-white" value={shippingCountry} onchange={(event)=>setShippingCountry(event.currentTarget.value)} aria-label={t('cart.destination')} disabled={!shippingCountries.length||savingAddress}>
            {#each shippingCountries as country}<option value={country}>{countryLabel(country)} ({country})</option>{/each}
          </select></label>
          {#if !pickupSelected}<label class="block text-sm text-neutral-200">{shippingText(lang as Locale,'method')}<select class="select mt-1" bind:value={selectedService} disabled={savingAddress}>
            {#each (shippingCountry==='TH'?['ems_local','flash']:['epacket','ems_world']) as method}<option value={method}>{serviceLabel(lang as Locale,method)}</option>{/each}
          </select></label>{/if}
          {#if shippingCountry==='TH'&&pickupEnabled}<label class="flex items-center gap-3 text-sm text-neutral-200"><input type="checkbox" class="checkbox checkbox-sm" bind:checked={pickupSelected}/>{t('cart.pickup')}</label>{/if}
          {#if shippingCountry==='TH'&&pickupSelected}<WorkshopLocation lang={lang as Locale}/>{/if}
          {#if international}
            {#if !profileLoaded}<p class="text-sm text-neutral-300" role="status">{t('cart.profileLoading')}</p>
            {:else if profileLoginRequired}<p class="text-sm text-amber-200" role="alert">{t('cart.shippingQuoteLogin')} <a class="underline" href={profileLink()}>{t('flow.login')}</a></p>
            {:else if profileError}<p class="text-sm text-amber-200" role="alert">{t('cart.profileUnavailable')} <button class="underline" onclick={loadProfile}>{t('flow.retry')}</button></p>
            {:else}<fieldset disabled={savingAddress} class="address-form min-w-0 space-y-3 border-t border-white/10 pt-4">
              <p class="text-sm text-neutral-300">{t('cart.internationalAddressIntro')}</p>
              <label class="block text-sm text-neutral-200">{t('flow.name')}<input class="input input-bordered mt-1 w-full bg-neutral-900 text-white" autocomplete="name" maxlength="120" bind:value={recipientName} oninput={markAddressDirty}/></label>
              <label class="block text-sm text-neutral-200">{t('flow.addressLine1')}<input class="input input-bordered mt-1 w-full bg-neutral-900 text-white" autocomplete="address-line1" maxlength="200" bind:value={address.line1} oninput={markAddressDirty}/></label>
              <label class="block text-sm text-neutral-200">{t('flow.addressLine2')}<input class="input input-bordered mt-1 w-full bg-neutral-900 text-white" autocomplete="address-line2" maxlength="200" bind:value={address.line2} oninput={markAddressDirty}/></label>
              <div class="grid sm:grid-cols-2 gap-3"><label class="block text-sm text-neutral-200">{t('flow.addressCity')}<input class="input input-bordered mt-1 w-full bg-neutral-900 text-white" autocomplete="address-level2" maxlength="120" bind:value={address.city} oninput={markAddressDirty}/></label><label class="block text-sm text-neutral-200">{t('flow.addressState')}<input class="input input-bordered mt-1 w-full bg-neutral-900 text-white" autocomplete="address-level1" maxlength="120" bind:value={address.state} oninput={markAddressDirty}/></label><label class="block text-sm text-neutral-200">{t('flow.addressPostalCode')}<input class="input input-bordered mt-1 w-full bg-neutral-900 text-white" autocomplete="postal-code" maxlength="32" bind:value={address.postal_code} oninput={markAddressDirty}/></label><div class="text-sm text-neutral-200"><span class="block mb-1">{t('flow.addressCountry')}</span><span class="flex min-h-12 items-center rounded-lg border border-white/15 bg-neutral-900 px-3">{countryLabel(shippingCountry)} ({shippingCountry})</span></div></div>
              {#if addressDirty}<p class="text-xs text-amber-200">{t('cart.addressUnsaved')}</p>{/if}{#if addressSaveError}<p class="text-sm text-amber-200" role="alert">{t('cart.addressSaveFailed')}</p>{/if}
              <button class="btn btn-primary w-full address-save" disabled={savingAddress||!canSaveRecipient} onclick={calculateInternationalShipping}>{savingAddress?t('cart.calculatingShipping'):t('cart.calculateShipping')}</button>
            </fieldset>{/if}
          {/if}
          {#if shippingQuote}<div class="space-y-1 text-sm text-neutral-300" aria-live="polite"><p>{t('cart.postage')}: {formatPrice(shippingQuote.amount,lang as Locale)}{#if shippingQuote.fxMarginApplied}<span class="block text-xs text-neutral-400">{t('cart.fxMargin')}</span>{/if}</p></div>
          {:else if shippingStatus==='shipping_contact_required'}<div class="space-y-3 text-sm text-amber-100" role="status"><p>{t('cart.shippingQuoteIntro')}</p><div class="flex flex-wrap gap-2"><a class="btn btn-secondary btn-sm" href="mailto:designmusicthailand@gmail.com">{t('cart.contactEmail')}</a><a class="btn btn-secondary btn-sm" href="https://www.facebook.com/DesignmusicInstrumentmusicAccessories" target="_blank" rel="noreferrer">Facebook</a><a class="btn btn-secondary btn-sm" href="https://www.instagram.com/designmusic_instrument/" target="_blank" rel="noreferrer">Instagram</a></div></div>
          {:else if shippingStatus==='shipping_address_required'||shippingStatus==='shipping_address_country_mismatch'}<p class="text-sm text-amber-200" role="alert">{t(shippingStatus==='shipping_address_required'?'cart.shippingAddressNeeded':'cart.shippingAddressMismatch')} <a class="underline" href={getPath('/profile')}>{t('cart.viewProfile')}</a></p>
          {:else if ['shipping_rate_unconfigured','shipping_weight_uncovered','shipping_service_unavailable','shipping_destination_unavailable'].includes(shippingStatus)}<div class="text-sm text-amber-100" role="status"><p>{shippingText(lang as Locale,'contact')}</p><div class="flex flex-wrap gap-3 mt-3"><a class="underline" href="mailto:designmusicthailand@gmail.com">{t('cart.contactEmail')}</a><a class="underline" href="https://www.facebook.com/DesignmusicInstrumentmusicAccessories" target="_blank" rel="noreferrer">Facebook</a><a class="underline" href="https://www.instagram.com/designmusic_instrument/" target="_blank" rel="noreferrer">Instagram</a></div></div>
          {:else if shippingStatus}<p class="text-sm text-amber-200" role="alert">{shippingStatus==='shipping_fx_unavailable'?shippingText(lang as Locale,'fxError'):t(shippingStatus==='shipping-options-unavailable'?'cart.shippingUnavailable':'flow.unavailable')} <button class="underline" disabled={quoting} onclick={()=>configError?initializeShipping():refreshShippingQuote()}>{t('flow.retry')}</button></p>
          {:else if quoting}<p class="text-sm text-neutral-300" role="status">{t('cart.calculatingShipping')}</p>
          {:else if international}<p class="text-sm text-neutral-300" role="status">{t('cart.shippingAddressNeeded')}</p>{/if}
        </div>
      {/if}
    </div>

    <p class="px-6 text-sm text-neutral-300" role="status">{checkoutStatus || (!cart.storageAvailable?t('flow.storage'):'')}</p>
    {#if signInRequired}<a class="px-6 underline" href={getPath('/login')}>{t('flow.login')}</a>{/if}
    {#if shippingStatus==='shipping_contact_required' && cart.items.length>0}
      <div class="px-6 pb-5 space-y-3">
        {#if quoteRequestState==='sent'}<p class="text-emerald-200" role="status">{t('cart.shippingQuoteSent')}</p><a class="underline" href={getPath('/profile/orders')}>{t('flow.orders')}</a>
        {:else if quoteRequestState==='login'}<p class="text-amber-200" role="alert">{t('cart.shippingQuoteLogin')}</p><a class="underline" href={getPath('/login')}>{t('flow.login')}</a>
        {:else if quoteRequestState==='address_required'||quoteRequestState==='address_mismatch'}<p class="text-amber-200" role="alert">{t(quoteRequestState==='address_required'?'cart.shippingAddressNeeded':'cart.shippingAddressMismatch')}</p><a class="underline" href={getPath('/profile')}>{t('cart.viewProfile')}</a>
        {:else if quoteRequestState==='stock'}<p class="text-amber-200" role="alert">{t('flow.stock')}</p>
        {:else if quoteRequestState==='error'}<p class="text-amber-200" role="alert">{t('cart.shippingQuoteError')}</p>{/if}
        {#if quoteRequestState!=='sent'}{#if profileLoginRequired}<a class="btn btn-outline w-full" href={profileLink()}>{t('flow.login')}</a>{:else if addressRequiredForCountry()}<p class="text-amber-200" role="alert">{t('cart.shippingAddressNeeded')} <a class="underline" href={getPath('/profile')}>{t('cart.viewProfile')}</a></p>{:else}<button class="btn btn-primary w-full" onclick={requestShippingQuote} disabled={isRequestingQuote || !cart.storageAvailable}>{isRequestingQuote?t('cart.shippingQuoteSubmitting'):t('cart.requestShippingQuote')}</button>{/if}{/if}
      </div>
    {/if}
    {#if cart.items.length > 0}
      <div class="p-6 border-t border-white/10 bg-black/50">
        <div class="flex justify-between items-center mb-6 text-xl">
          <span class="font-light tracking-widest uppercase text-neutral-400">{t('cart.total')}</span>
          <span class="font-serif text-white">{formatPrice(shippingQuote?.total??cart.total,lang as Locale)}</span>
        </div>
        {#if shippingStatus!=='shipping_contact_required'}<button class="btn btn-primary w-full disabled:opacity-50 tracking-widest uppercase text-sm font-medium py-4" onclick={handleCheckout} disabled={isCheckingOut || !cart.storageAvailable || !shippingQuote || !!shippingStatus || (international&&(!savedAddressMatches||addressDirty))}>
          {#if isCheckingOut}
            {t('cart.processing')}
          {:else}
            {t('cart.checkout')}
          {/if}
        </button>{/if}
      </div>
    {/if}
  </dialog>
{/if}
<style>.address-save{background:#c2aa6a;color:#171a1b;border:1px solid #c2aa6a}.address-save:disabled{opacity:1;background:#66604e;color:#fff;border-color:#8b8269}dialog::backdrop{background:rgba(0,0,0,.6);backdrop-filter:blur(4px)}@media(prefers-reduced-motion:reduce){:global(*){transition-duration:0ms!important;animation-duration:0ms!important}}</style>
