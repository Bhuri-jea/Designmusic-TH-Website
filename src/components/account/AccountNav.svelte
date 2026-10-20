<script lang="ts">
 import { ui } from '../../i18n/ui';
 import { accountText } from '../../i18n/account-ui';
 import { localizedPath } from '../../utils/navigation';
 import type { Locale } from '../../lib/catalog';
 let { lang, active } = $props<{ lang: Locale; active: 'profile' | 'bookings' | 'orders' }>();
 const links = $derived([
  { id: 'profile', href: '/profile', label: accountText(lang, 'contact') },
  { id: 'bookings', href: '/profile/bookings', label: accountText(lang, 'bookings') },
  { id: 'orders', href: '/profile/orders', label: accountText(lang, 'orders') },
 ] as const);
</script>
<nav aria-label={accountText(lang, 'accountNav')} class="flex flex-wrap gap-2 mb-8">
 {#each links as link}
  <a href={localizedPath(link.href, lang)} aria-current={active === link.id ? 'page' : undefined}
   class={`rounded-full border px-4 py-2 text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200 ${active === link.id ? 'border-amber-200 bg-amber-100 text-neutral-950' : 'border-white/20 text-neutral-200 hover:border-white/50'}`}>
   {link.label}
  </a>
 {/each}
</nav>
