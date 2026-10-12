import test from 'node:test';
import assert from 'node:assert/strict';
import { quoteCart } from '../src/lib/catalog.ts';

test('quotes canonical independently priced products by locale', async () => {
  const expected = [['en', 1500], ['ja', 2500], ['th', 20000], ['zh-CN', 1500]] as const;
  for (const [locale, amount] of expected) {
    const quote = await quoteCart({ items: [{ productId: 'saxophone-end-plug', variant: 'plain', quantity: 1 }], locale });
    assert.equal(quote.totalAmount, amount);
  }
  for (const [locale, amount] of [['en', 23000], ['ja', 35000], ['th', 690000]] as const) {
    const quote = await quoteCart({ items: [{ productId: 'shakuhachi', variant: 'standard', options: { toneHoles: 'large', mouthpiece: 'modern' }, quantity: 1 }], locale });
    assert.equal(quote.totalAmount, amount);
  }
});

test('rejects untrusted prices, unsupported products/options, and invalid quantities', async () => {
  const invalid = [
    { items: [{ productId: 'saxophone-end-plug', variant: 'plain', quantity: 1, price: 1 }], locale: 'en' },
    { items: [{ productId: 'saxophone-end-plug', variant: 'plain', quantity: 1, extra: true }], locale: 'en' },
    { items: [{ productId: 'saxophone-end-plug', variant: 'plain', quantity: 1, options: { color: 'red' } }], locale: 'en' },
    { items: [{ productId: 'siliconepads', quantity: 1 }], locale: 'en' },
    ...[0, -1, 1.5, 11].map(quantity => ({ items: [{ productId: 'saxophone-end-plug', variant: 'plain', quantity }], locale: 'en' })),
    { items: Array.from({ length: 21 }, () => ({ productId: 'saxophone-end-plug', variant: 'plain', quantity: 1 })), locale: 'en' },
    { items: [{ productId: 'saxophone-end-plug', variant: 'plain', quantity: 6 }, { productId: 'saxophone-end-plug', variant: 'plain', quantity: 5 }], locale: 'en' },
    { items: [{ productId: 'shakuhachi', variant: 'custom', quantity: 1 }], locale: 'en' },
    { items: [{ productId: 'shakuhachi', options: { toneHoles: ['standard'], mouthpiece: 'balance' }, quantity: 1 }], locale: 'en' },
    { items: [{ productId: 'saxophone-end-plug', variant: 'custom', quantity: 1 }], locale: 'xx' },
  ];
  for (const input of invalid) await assert.rejects(quoteCart(input));
});

test('aggregates and canonically orders lines and options for stable fingerprints', async () => {
  const a = await quoteCart({ locale: 'en', items: [
    { productId: 'shakuhachi', variant: 'standard', options: { mouthpiece: 'balance', toneHoles: 'standard' }, quantity: 1 },
    { productId: 'saxophone-end-plug', variant: 'plain', quantity: 1 },
    { productId: 'saxophone-end-plug', variant: 'plain', quantity: 2 },
  ] });
  const b = await quoteCart({ locale: 'en', items: [
    { productId: 'saxophone-end-plug', variant: 'plain', quantity: 3 },
    { productId: 'shakuhachi', variant: 'standard', options: { toneHoles: 'standard', mouthpiece: 'balance' }, quantity: 1 },
  ] });
  assert.deepEqual(a.lines, b.lines);
  assert.equal(a.fingerprint, b.fingerprint);
});
