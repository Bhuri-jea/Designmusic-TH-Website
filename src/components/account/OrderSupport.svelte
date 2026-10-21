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

<section aria-label={copy.title} class="order-support mx-auto max-w-3xl px-6 pb-12">
 <details class="border-t border-white/20 text-neutral-200">
  <summary class="cursor-pointer py-4 font-medium">{copy.title}</summary>
  <div class="space-y-3 pb-4">
  <p class="text-neutral-200">{copy.description}</p>
  <p class="text-sm break-all">{copy.reference}: {orderId}</p>
  <a class="inline-flex min-h-11 items-center underline underline-offset-4 hover:text-white" {href}>{copy.action}</a>
  <p class="text-sm text-neutral-300">{copy.draft}</p>
  <div class="flex flex-wrap items-center gap-3">
   <span class="break-all select-all">{SUPPORT_EMAIL}</span>
   <button type="button" class="btn btn-secondary btn-sm min-h-11 whitespace-normal text-left" onclick={copyEmail}>{copy.copy}</button>
  </div>
  <p role="status" class="text-sm text-neutral-200">{message}</p>
  </div>
 </details>
</section>

<style>
 .order-support{font-size:1rem;overflow-wrap:anywhere}
 summary{line-height:1.6}
 summary::marker{color:#c7bec5}
 .order-support :global(a),.order-support button{max-width:100%}
</style>
