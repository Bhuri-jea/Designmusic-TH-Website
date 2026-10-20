import type { CatalogLine, Currency, Locale } from '../catalog.ts';

export type OrderStatus = 'pending' | 'paid' | 'expired' | 'failed' | 'review';
export type CheckoutParameters = { customerEmail: string; successUrl: string; cancelUrl: string; allowedCountries: string[]; expiresAt: number; shippingCountry?: string; fulfillmentMethod?: 'ems_local'|'ems_world'|'epacket'|'flash'|'pickup'; shippingAmount?: number; estimatedWeightGrams?: number; referenceThbRate?:number|null; referenceFxDate?:string|null; shippingAddressSnapshot?: Record<string,string>|null; shippingRecipientSnapshot?: {name:string}; shippingQuoteId?: string; shippingQuoteVersion?: number; shippingQuoteAddress?: Record<string,string>; shippingQuoteRecipient?: {name:string} };
export type OrderShipment = { service: 'ems_local'|'ems_world'|'epacket'|'flash'|'pickup'; trackingNumber: string|null; trackingUrl: string|null };
export type OrderRecord = {
  id: string;
  customerId: string;
  requestKey: string;
  fingerprint: string;
  currency: Currency;
  locale: Locale;
  amountTotal: number;
  items: CatalogLine[];
  status: OrderStatus;
  createdAt: string;
  expiresAt: string;
  checkoutSessionId: string | null;
  checkoutUrl: string | null;
  checkoutParameters: CheckoutParameters;
  shipment?: OrderShipment | null;
  shippingAmount?: number;
  fulfillmentMethod?: OrderShipment['service'];
};
export type OrderState = OrderRecord & { stockReleased?: boolean; eventIds?: string[] };
export type PaymentEvent = { eventId: string; eventType: string; sessionId: string | null; currency: string; amountTotal: number; paymentStatus: string };
export function createOrderState(input: OrderRecord): OrderState { return { ...input, eventIds: [] }; }
export function applyPaymentEvent(order: OrderState, event: PaymentEvent): OrderState {
  if (order.eventIds?.includes(event.eventId)) return order;
  if (order.checkoutSessionId === null) throw new Error('checkout_attachment_pending');
  if (!event.eventId || !event.eventType || !event.sessionId) throw new Error('invalid_payment_event');
  const matches = event.sessionId === order.checkoutSessionId && event.currency === order.currency && event.amountTotal === order.amountTotal;
  if (!matches) throw new Error('payment_metadata_mismatch');
  const eventIds = [...(order.eventIds ?? []), event.eventId];
  if (order.status === 'paid') return { ...order, eventIds };
  if (order.stockReleased && event.paymentStatus === 'paid' && matches) return { ...order, status: 'review', eventIds };
  const successful = ['checkout.session.completed', 'checkout.session.async_payment_succeeded'].includes(event.eventType);
  if (successful && matches && event.paymentStatus === 'paid' && ['pending', 'failed'].includes(order.status)) return { ...order, status: 'paid', checkoutUrl: null, eventIds };
  if (event.eventType === 'checkout.session.expired' && matches && ['pending', 'failed'].includes(order.status)) return { ...order, status: 'expired', stockReleased: true, checkoutUrl: null, eventIds };
  if (event.eventType === 'checkout.session.async_payment_failed' && matches && order.status === 'pending') return { ...order, status: 'failed', checkoutUrl: null, eventIds };
  return { ...order, eventIds };
}
