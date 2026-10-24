import test from 'node:test';
import assert from 'node:assert/strict';
import {validatePresentation,remainingPurchaseQuantity,quantityForSku,DEFAULT_PRODUCT_LAYOUT,productLifecycleActions} from '../src/lib/catalog-presentation.ts';
import {addCartItem,emptyCart,cartItems,restoreCart} from '../src/lib/cart-storage.ts';
import type {CartInput} from '../src/lib/catalog.ts';

test('legacy presentation defaults to buttons and no reviews',()=>{
 assert.deepEqual(validatePresentation(undefined,['style']),{optionStyles:{},reviews:[]});
});
test('all three option styles and original customer review text survive validation',()=>{
 for(const style of ['buttons','dropdown','radio']){
  assert.deepEqual(validatePresentation({optionStyles:{style},reviews:[{name:' Customer ',rating:5,impression:' Great <sound>! '}]},['style']),{optionStyles:{style},reviews:[{name:'Customer',rating:5,impression:'Great <sound>!'}]});
 }
});
test('invalid option styles, unknown groups and invalid reviews reject a save',()=>{
 for(const value of [{optionStyles:{style:'slider'}},{optionStyles:{unknown:'radio'}},{reviews:{}},{reviews:[{name:'',rating:5,impression:'Good'}]},{reviews:[{name:'A',rating:0,impression:'Good'}]},{reviews:[{name:'A',rating:5.5,impression:'Good'}]},{reviews:[{name:'A',rating:6,impression:'Good'}]},{reviews:[{name:'A',rating:5,impression:'x'.repeat(2001)}]},{reviews:Array(51).fill({name:'A',rating:5,impression:'Good'})}])assert.throws(()=>validatePresentation(value,['style']),/invalid_catalog_presentation/);
});
test('quantity respects stock, reservations, existing cart and checkout cap',()=>{
 assert.equal(remainingPurchaseQuantity(20,0,0),10);
 assert.equal(remainingPurchaseQuantity(5,1,2),2);
 assert.equal(remainingPurchaseQuantity(20,0,9),1);
 assert.equal(remainingPurchaseQuantity(2,1,3),0);
 assert.equal(remainingPurchaseQuantity(0,0,0),0);
 assert.equal(remainingPurchaseQuantity(NaN,0,0),0);
});
test('migrated products accept multiple units using explicit catalog SKU and options',()=>{
 const inputs:CartInput[]=[{productId:'saxophone-end-plug',variant:'endplug-plain',options:{style:'plain'},quantity:3},{productId:'shakuhachi',variant:'shakuhachi-standard-balance',options:{toneHoles:'standard',mouthpiece:'balance'},quantity:2}];
 for(const item of inputs){
  const state=addCartItem(emptyCart(),item);
  assert.equal(cartItems(state)[0].quantity,item.quantity);
  assert.equal(cartItems(restoreCart(JSON.stringify(state)))[0].quantity,item.quantity);
 }
});
test('stock check combines legacy and explicit SKU cart entries but not other variants',()=>{
 const items=[{productId:'saxophone-end-plug',variant:'plain',quantity:2},{productId:'saxophone-end-plug',variant:'endplug-plain',options:{style:'plain'},quantity:3},{productId:'saxophone-end-plug',variant:'custom',quantity:1}];
 assert.equal(quantityForSku(items,'saxophone-end-plug','endplug-plain',['plain']),5);
 assert.equal(quantityForSku([{productId:'shakuhachi',variant:'standard',options:{toneHoles:'standard',mouthpiece:'balance'},quantity:2}],'shakuhachi','shakuhachi-standard-balance',['standard','balance']),2);
 assert.equal(remainingPurchaseQuantity(6,2,quantityForSku(items,'saxophone-end-plug','endplug-plain',['plain'])),0);
});
test('per-product section ordering allows paired rows but never duplicates or drops a section',()=>{
 const layout=[['name','badge'],...DEFAULT_PRODUCT_LAYOUT.filter(row=>!row.includes('name')&&!row.includes('badge'))];
 assert.deepEqual(validatePresentation({layout},[]).layout,layout);
 for(const invalid of [[['name']], [...DEFAULT_PRODUCT_LAYOUT,['name']], [['badge','name','description'],...DEFAULT_PRODUCT_LAYOUT.slice(3)]])assert.throws(()=>validatePresentation({layout:invalid},[]),/invalid_catalog_presentation/);
});
test('product lifecycle actions exclude redundant archive and unsafe direct restore publication',()=>{
 assert.deepEqual(productLifecycleActions('draft'),['publish','archive']);
 assert.deepEqual(productLifecycleActions('published'),['unpublish','archive']);
 assert.deepEqual(productLifecycleActions('archived'),['restore']);
});
