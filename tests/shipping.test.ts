import test from 'node:test';
import assert from 'node:assert/strict';
import { quoteShipping } from '../src/lib/server/shipping.ts';
import { shopEmsRates } from '../src/lib/shipping-rates.ts';

const item = { productId: 'saxophone-end-plug', variant: 'plain', quantity: 1 };
const address={line1:'1 Example Road',line2:'',city:'Tokyo',state:'',postal_code:'100-0001',country:'JP'};
function fixture(grams: number) {
  return {
    config: async () => ({
      allowed_countries: ['TH', 'JP'], pickup_enabled: true, usd_thb: 35, jpy_thb: 0.25,
      shipping_rates: { 'TH:ems_local': shopEmsRates('TH'), 'JP:epacket': shopEmsRates('JP') },
    }),
    inventory: async () => [{ sku: 'endplug-plain', weight_grams: grams,
      price_usd_minor: 1500, price_jpy: 2500, price_thb_minor: 20000 }],
    exchangeRates:async()=>({usdThb:35,jpyThb:.25,date:'2026-10-20',source:'Frankfurter' as const}),
  };
}

test('domestic EMS charges the owner rates at every weight boundary', async () => {
  for (const [grams, thb] of [[1,35],[20,35],[21,50],[100,50],[101,70],[500,70],[501,80],[1000,80],[1001,100],[2000,100]]) {
    const quote = await quoteShipping([item], 'th', 'TH', 'ems_local', fixture(grams));
    assert.equal(quote.amount, thb * 100);
    assert.equal(quote.total, 20000 + thb * 100);
  }
  await assert.rejects(quoteShipping([item], 'th', 'TH', 'ems_local', fixture(2001)), /shipping_contact_required/);
});

test('shipping uses total packaged cart weight and keeps Thailand pickup free', async () => {
  const quote = await quoteShipping([{ ...item, quantity: 2 }], 'th', 'TH', 'ems_local', fixture(300));
  assert.equal(quote.weightGrams, 600);
  assert.equal(quote.amount, 8000);
  const pickup = await quoteShipping([item], 'th', 'TH', 'pickup', fixture(0));
  assert.equal(pickup.amount, 0);
  assert.equal(pickup.total, 20000);
});

test('international ePacket table converts with the agreed five-percent buffer', async () => {
  const thb = await quoteShipping([item], 'th', 'JP', 'epacket', fixture(1000),address);
  assert.equal(thb.amount, 53000);
  const usd = await quoteShipping([item], 'en', 'JP', 'epacket', fixture(1000),address);
  assert.equal(usd.amount, 1590);
  assert.equal(usd.fxMarginApplied, true);
  const jpy = await quoteShipping([item], 'ja', 'JP', 'epacket', fixture(1000),address);
  assert.equal(jpy.amount, 2226);
  await assert.rejects(quoteShipping([item], 'th', 'JP', 'epacket', fixture(2001),address), /shipping_contact_required/);
});
test('international fee calculation requires a complete address for the selected destination',async()=>{
 await assert.rejects(quoteShipping([item],'en','JP','epacket',fixture(1000)),/shipping_address_required/);
 await assert.rejects(quoteShipping([item],'en','JP','epacket',fixture(1000),{...address,country:'TH'}),/shipping_address_country_mismatch/);
});
test('maximum weight selects the smallest covering band and international minimum is 500 THB',async()=>{
 const deps=fixture(150);deps.config=async()=>({allowed_countries:['TH','JP'],pickup_enabled:true,usd_thb:999,jpy_thb:999,shipping_rates:{'TH:ems_local':[{maxGrams:100,thbMinor:3500},{maxGrams:200,thbMinor:5000}],'JP:epacket':[{maxGrams:100,thbMinor:10000},{maxGrams:200,thbMinor:20000}]}});
 assert.equal((await quoteShipping([item],'th','TH','ems_local',deps)).amount,5000);
 assert.equal((await quoteShipping([item],'th','JP','epacket',deps,address)).amount,50000);
 assert.equal((await quoteShipping([item],'en','JP','epacket',deps,address)).amount,1500);
 await assert.rejects(quoteShipping([item],'th','TH','flash',deps),/shipping_rate_unconfigured/);
 await assert.rejects(quoteShipping([item],'th','JP','epacket',fixture(2001),address),/shipping_contact_required/);
});
test('a blank covering price means unsupported even if a heavier priced band exists',async()=>{
 const deps={...fixture(150),config:async()=>({allowed_countries:['TH'],shipping_rates:{'TH:ems_local':[{maxGrams:100,thbMinor:3500},{maxGrams:200,thbMinor:null},{maxGrams:300,thbMinor:7000}]}})};
 await assert.rejects(quoteShipping([item],'th','TH','ems_local',deps),/shipping_service_unavailable/);
});
