import test from 'node:test';
import assert from 'node:assert/strict';
import {shakuhachiPurchaseOptions} from '../src/lib/shakuhachi-options.ts';
import {emptyCart,addCartItem,cartItems,submitCart,restoreCart} from '../src/lib/cart-storage.ts';
import type {TrustedCatalogSku} from '../src/lib/catalog.ts';

const groups=[{code:'toneHoles',label:'Size',values:[{code:'standard',label:'Standard'},{code:'large',label:'Large (legacy)'},{code:'small-kit',label:'Small'},{code:'large-kit',label:'Large'}]},{code:'mouthpiece',label:'Mouthpiece',values:[{code:'balance',label:'Balance'},{code:'modern',label:'Modern'},{code:'traditional',label:'Traditional'}]}];
const kit:TrustedCatalogSku={sku:'shakuhachi-kit-small-balance',productSlug:'shakuhachi',optionCodes:['small-kit','balance'],name:'Small Shakuhachi with Balance',salesMode:'checkout',productLifecycle:'published',skuLifecycle:'active',prices:{usd:23000,jpy:35000,thb:690000}};

test('active Balance kits expose only Small and Large while preserving fixed checkout options',()=>{
 const result=shakuhachiPurchaseOptions({slug:'shakuhachi',optionGroups:groups,skus:[{optionCodes:['small-kit','balance']},{optionCodes:['large-kit','balance']}]});
 assert.deepEqual(result.optionGroups,[{...groups[0],values:[{code:'small-kit',label:'Small'},{code:'large-kit',label:'Large'}]}]);
 assert.deepEqual(result.fixedOptions,{mouthpiece:'balance'});
 assert.equal(result.includesBalance,true);
});

test('other products and existing selectable mouthpieces are not silently converted to Balance kits',()=>{
 for(const slug of ['shakuhachi','another-instrument']){
  const result=shakuhachiPurchaseOptions({slug,optionGroups:groups,skus:[{optionCodes:['standard','balance']},{optionCodes:['large','modern']},{optionCodes:['large','traditional']}]});
  assert.deepEqual(result.optionGroups,groups);
  assert.deepEqual(result.fixedOptions,{});
  assert.equal(result.includesBalance,false);
 }
});

test('new kit SKU identity and an outstanding payment snapshot survive cart reload',async()=>{
 const input={productId:'shakuhachi',variant:kit.sku,options:{toneHoles:'small-kit',mouthpiece:'balance'},quantity:1};
 const state=addCartItem(emptyCart(),input);
 assert.equal(cartItems(state)[0].variant,'shakuhachi-kit-small-balance');
 for(const locale of ['en','th'] as const){
  const submitted=await submitCart(state,locale,[kit]);
  const restored=restoreCart(JSON.stringify(submitted.state));
  assert.equal(restored.attempts.length,1);
  assert.equal(restored.attempts[0].quote.lines[0].sku,'shakuhachi-kit-small-balance');
  assert.equal(restored.attempts[0].quote.totalAmount,locale==='th'?690000:23000);
 }
});

test('separate mouthpieces remain separate cart rows from the included Balance kit',async()=>{
 const mouth:TrustedCatalogSku={...kit,sku:'shakuhachi-mouthpiece-m1',productSlug:'shakuhachi-mouthpiece',optionCodes:['modern'],name:'Modern (M1)',prices:{usd:1500,jpy:2000,thb:40000}};
 const state=addCartItem(addCartItem(emptyCart(),{productId:'shakuhachi',variant:kit.sku,options:{toneHoles:'small-kit',mouthpiece:'balance'},quantity:1}),{productId:'shakuhachi-mouthpiece',variant:mouth.sku,options:{mouthpiece:'modern'},quantity:1});
 const submitted=await submitCart(state,'en',[kit,mouth]);
 assert.equal(submitted.state.attempts[0].quote.totalAmount,24500);
 assert.deepEqual(submitted.state.attempts[0].quote.lines.map(row=>row.sku),['shakuhachi-kit-small-balance','shakuhachi-mouthpiece-m1']);
 assert.equal(cartItems(restoreCart(JSON.stringify(submitted.state))).length,2);
});
