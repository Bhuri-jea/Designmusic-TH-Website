import test from 'node:test';
import assert from 'node:assert/strict';
import { notification } from '../src/lib/server/notifications.ts';

const id = '22222222-2222-4222-8222-222222222222';
const config: Record<string, string> = { EMAIL_FROM: 'sender@example.test', SELLER_EMAIL: 'seller@example.test', APP_ORIGIN: 'https://shop.example.test' };
const env = (name: string) => config[name];
const buyer = { quoteId: id, customer: { name: 'A Customer', email: 'buyer@example.test' }, currency: 'thb', amountTotal: 12500, shippingAmount: 2500, expiresAt: '2026-10-22T00:00:00Z' };
const locales = ['en', 'ja', 'zh-CN', 'th'];
test('refund notices describe verified states, escape reasons, and link to owned orders in every locale',()=>{
 for(const locale of locales){
  const payload={orderId:id,recipient:'buyer@example.test',locale,currency:'usd',amount:1500,refundStatus:'pending',reason:'<script>unsafe</script>'};
  const buyerMail=notification('order_refund_buyer',payload,env),sellerMail=notification('order_refund_seller',payload,env);
  assert.equal(buyerMail.to,'buyer@example.test');assert.equal(sellerMail.to,'seller@example.test');
  assert.ok(buyerMail.html.includes('/profile/orders'));assert.ok(!buyerMail.html.includes('<script>'));assert.ok(buyerMail.html.includes('&lt;script&gt;'));
  assert.notEqual(buyerMail.html,notification('order_refund_buyer',{...payload,refundStatus:'succeeded'},env).html);
 }
});

test('shipping quote approval is localized and links customers to the quote controls', () => {
 const prefixes: Record<string, string> = { en: '', ja: '/ja', 'zh-CN': '/zh-CN', th: '/th' };
 for (const locale of locales) {
  const mail = notification('shipping_quote_buyer', { ...buyer, locale }, env);
  assert.equal(mail.to, buyer.customer.email);
  assert.ok(mail.subject.length > 0);
  assert.match(mail.html, new RegExp(`${prefixes[locale]}/profile/orders#shipping-quotes-title`));
  assert.match(mail.html, /25\.00|25,00/);
  assert.match(mail.html, /125\.00|125,00/);
  assert.match(mail.html, /2026|2569/);
 }
});

test('seller request and shipped notices use the seller inbox and trusted links', () => {
 const request = notification('shipping_quote_request_seller', { quoteId: id, locale: 'th', customer: { name: '<img onerror=x>', email: 'buyer@example.test' }, country: 'JP', weightGrams: 2500 }, env);
 assert.equal(request.to, 'seller@example.test');
 assert.match(request.html, /https:\/\/shop\.example\.test\/th\/admin/);
 assert.match(request.html, /&lt;img onerror=x&gt;/);
 const shipped = notification('order_shipped_buyer', { orderId: id, customer: { name: 'Customer', email: 'buyer@example.test' }, locale: 'en', shippingService: 'flash', trackingNumber: 'FX12345', trackingUrl: 'https://www.flashexpress.com/fle/tracking' }, env);
 assert.match(shipped.html, /flash/);
 assert.match(shipped.html, /FX12345/);
 assert.match(shipped.html, /https:\/\/www\.flashexpress\.com\/fle\/tracking/);
});

test('untrusted fields are escaped and hostile tracking links are omitted', () => {
 const mail = notification('order_shipped_buyer', { orderId: '<script>x</script>', recipient: 'buyer@example.test', locale: 'en', shippingService: '<img>', trackingNumber: '" onmouseover="x', trackingUrl: 'https://track.thailandpost.com.evil.test/' }, env);
 assert.match(mail.html, /&lt;script&gt;x&lt;\/script&gt;/);
 assert.match(mail.html, /&lt;img&gt;/);
 assert.match(mail.html, /&quot; onmouseover=&quot;x/);
 assert.doesNotMatch(mail.html, /href=/);
 const pickup = notification('order_shipped_buyer', { orderId: id, recipient: 'buyer@example.test', locale: 'en', shippingService: 'pickup', trackingNumber: 'PICKUP', trackingUrl: null }, env);
 assert.match(pickup.html, /collected for pickup/);
 assert.doesNotMatch(pickup.html, /Tracking number/);
});

test('invalid topics, recipients, origins and shipment payloads are rejected', () => {
 assert.throws(() => notification('unknown_topic', { recipient: 'buyer@example.test' }, env), /invalid_notification_topic/);
 assert.throws(() => notification('shipping_quote_buyer', { ...buyer, customer: { name: 'No email' } }, env), /transport_configuration_unavailable/);
 assert.throws(() => notification('shipping_quote_buyer', { ...buyer, locale: 'en' }, n => n === 'APP_ORIGIN' ? 'https://shop.example.test/path' : config[n]), /transport_configuration_unavailable/);
 assert.throws(() => notification('order_shipped_buyer', { orderId: id, recipient: 'buyer@example.test', locale: 'en', shippingService: 'flash' }, env), /invalid_notification_payload/);
});

test('order and quote notifications retain seller inbox and link buyer orders',()=>{
 const mail=notification('shipping_quote_request_seller',{quoteId:id,country:'JP',weightGrams:2500,customer:{email:'buyer@example.test'}},env);
 assert.equal(mail.to,'seller@example.test');
 const paid=notification('order_paid_buyer',{orderId:id,recipient:'buyer@example.test',currency:'usd',amountTotal:1500,items:[{name:'End plug',quantity:1}]},env);
 assert.ok(paid.html.includes('https://shop.example.test/profile/orders'));
});
