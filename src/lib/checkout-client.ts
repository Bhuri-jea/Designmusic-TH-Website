import type { CartInput, Locale } from './catalog.ts';

type Submission = { requestKey: string; locale: Locale; items: CartInput[] };
type CheckoutCart = { submit: (locale: Locale) => Promise<Submission>; bind: (key: string, id: string) => void };
export class CheckoutError extends Error {
 readonly code: string;
 constructor(code: string) { super(code); this.code = code; }
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function hostedUrl(value: unknown): value is string {
 if (typeof value !== 'string') return false;
 try {
  const url = new URL(value);
  return url.protocol === 'https:' && !url.username && !url.password && (url.hostname === 'checkout.stripe.com' || url.hostname.endsWith('.checkout.stripe.com'));
 } catch { return false; }
}
export async function runCheckout(cart: CheckoutCart, locale: Locale, fetcher: typeof fetch = fetch): Promise<string> {
 const request = await cart.submit(locale);
 const response = await fetcher('/api/checkout', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request),
 });
 let data: any;
 try { data = await response.json(); } catch { throw new CheckoutError('checkout_unavailable'); }
 if (!response.ok) {
  if (response.status === 401 || response.status === 403) throw new CheckoutError('sign_in_required');
  throw new CheckoutError(typeof data?.error === 'string' ? data.error : 'checkout_unavailable');
 }
 if (typeof data?.orderId !== 'string' || !uuid.test(data.orderId) || !hostedUrl(data.url)) throw new CheckoutError('checkout_unavailable');
 cart.bind(request.requestKey, data.orderId);
 return data.url;
}
