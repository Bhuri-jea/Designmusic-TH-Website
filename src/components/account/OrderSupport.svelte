<script lang="ts">
 import type { Locale } from '../../lib/catalog';
 import { SUPPORT_EMAIL, supportCopy, orderSupportMailto } from '../../lib/order-support';
 let { orderId, lang } = $props<{ orderId: string; lang: Locale }>();
 let message = $state('');
 const copy = $derived(supportCopy[lang]);
 const href = $derived(orderSupportMailto(orderId, lang));
 async function copyEmail() {
  try { await navigator.clipboard.writeText(SUPPORT_EMAIL); message = copy.copied; }
  catch { message = copy.failed; }
 }
</script>

<section aria-label={copy.title} class="mx-auto max-w-3xl px-6 pb-16">
 <div class="rounded-2xl border border-white/25 bg-[#1a1f20] p-6 sm:p-8 text-white space-y-4">
  <h2 class="font-serif text-2xl">{copy.title}</h2>
  <p class="text-neutral-200">{copy.description}</p>
  <p class="text-sm break-all">{copy.reference}: {orderId}</p>
  <a class="btn btn-primary min-h-12 h-auto py-3 whitespace-normal text-center" {href}>{copy.action}</a>
  <p class="text-sm text-neutral-300">{copy.draft}</p>
  <div class="flex flex-wrap items-center gap-3">
   <span class="break-all select-all">{SUPPORT_EMAIL}</span>
   <button type="button" class="btn min-h-12" onclick={copyEmail}>{copy.copy}</button>
  </div>
  <p role="status" class="text-sm text-neutral-200">{message}</p>
 </div>
</section>
