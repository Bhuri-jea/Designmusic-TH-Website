import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyCart, restoreCart, addCartItem, submitCart, bindOrder, reconcilePaid, cartItems } from '../src/lib/cart-storage.ts';
const plug = {productId:'saxophone-end-plug',variant:'plain',quantity:1};
test('outstanding snapshots remain restorable at the largest admitted cart shape',async()=>{
 let state=emptyCart();for(const variant of ['plain','twoColor','custom'])for(let i=0;i<9;i++)state=addCartItem(state,{...plug,variant});
 for(const toneHoles of ['standard','large'])for(const mouthpiece of ['balance','traditional','modern'])for(let i=0;i<9;i++)state=addCartItem(state,{productId:'shakuhachi',options:{toneHoles,mouthpiece},quantity:1});
 for(let attempt=0;attempt<11;attempt++){state=(await submitCart(state,'en')).state;state.items=state.items.filter(item=>item.variant!=='plain');for(let i=0;i<9;i++)state=addCartItem(state,plug);}
 assert.ok(JSON.stringify(state).length>150000);assert.equal(restoreCart(JSON.stringify(state)).attempts.length,state.attempts.length);
});
test('malformed persisted attempt quotes and array options are rejected',async()=>{
 const submitted=await submitCart(addCartItem(emptyCart(),plug),'en');
 for(const patch of [{lines:[null]},{totalAmount:-1},{fingerprint:'broken'},{currency:'jpy'}]){const state=structuredClone(submitted.state);Object.assign(state.attempts[0].quote,patch);assert.deepEqual(restoreCart(JSON.stringify(state)),emptyCart());}
 assert.throws(()=>addCartItem(emptyCart(),{...plug,options:[] as any}));
});
test('shakuhachi canonical variant identity aggregates quantities and options are independently owned',async()=>{
 const input={productId:'shakuhachi',options:{toneHoles:'standard',mouthpiece:'balance'},quantity:10};
 let state=addCartItem(emptyCart(),input);assert.throws(()=>addCartItem(state,{...input,variant:'standard',quantity:1}));
 input.options.mouthpiece='modern';assert.equal(state.items[0].options?.mouthpiece,'balance');
 const submitted=await submitCart(state,'en');state=bindOrder(submitted.state,submitted.request.requestKey,'22222222-2222-4222-8222-222222222222');
 state.items[0].options!.mouthpiece='modern';state=reconcilePaid(state,{id:'22222222-2222-4222-8222-222222222222',status:'paid',currency:'usd',amountTotal:230000,items:submitted.state.attempts[0].quote.lines});assert.equal(cartItems(state)[0].quantity,10);
});
test('adding a selection clones its options rather than retaining caller authority',()=>{const input={productId:'shakuhachi',options:{toneHoles:'standard',mouthpiece:'balance'},quantity:1};const state=addCartItem(emptyCart(),input);input.options.mouthpiece='modern';assert.equal(state.items[0].options?.mouthpiece,'balance');});
test('paid reconciliation preserves a lot whose selection changed after submission',async()=>{const input={productId:'shakuhachi',options:{toneHoles:'standard',mouthpiece:'balance'},quantity:1};const submitted=await submitCart(addCartItem(emptyCart(),input),'en');let state=bindOrder(submitted.state,submitted.request.requestKey,'22222222-2222-4222-8222-222222222222');state.items[0].options!.mouthpiece='modern';state=reconcilePaid(state,{id:'22222222-2222-4222-8222-222222222222',status:'paid',currency:'usd',amountTotal:23000,items:submitted.state.attempts[0].quote.lines});assert.equal(cartItems(state)[0]?.quantity,1);});
test('completed checkout history does not permanently exhaust the submission limit', async () => {
 let state=addCartItem(emptyCart(),plug); const first=await submitCart(state,'en');
 state={...first.state,attempts:Array.from({length:30},()=>({...first.state.attempts[0],requestKey:crypto.randomUUID(),reconciled:true}))};
 const next=await submitCart(state,'en'); assert.equal(next.state.attempts.length,1); assert.equal(next.state.attempts[0].reconciled,false);
});
test('an unknown submission key cannot silently bind an order',async()=>{
 const submitted=await submitCart(addCartItem(emptyCart(),plug),'en');
 assert.throws(()=>bindOrder(submitted.state,crypto.randomUUID(),'22222222-2222-4222-8222-222222222222'),/unknown_submission/);
});
test('cart restores only bounded canonical storage and rejects mixed/injected data', () => {
 for (const raw of ['bad','null','{}',JSON.stringify({...emptyCart(),items:[{...plug,price:1}]})]) assert.deepEqual(restoreCart(raw),emptyCart());
 const state=addCartItem(emptyCart(),plug); assert.deepEqual(restoreCart(JSON.stringify(state)),state);
});
test('submitted snapshot reuses retry key, reprices locale atomically and preserves later additions on paid reconciliation', async () => {
 let state=addCartItem(emptyCart(),plug); const first=await submitCart(state,'en'); state=first.state;
 assert.equal((await submitCart(restoreCart(JSON.stringify(state)),'en')).request.requestKey,first.request.requestKey);
 assert.notEqual((await submitCart(state,'ja')).request.requestKey,first.request.requestKey);
 state=bindOrder(state,first.request.requestKey,'22222222-2222-4222-8222-222222222222');
 state=addCartItem(state,plug);
 const order={id:'22222222-2222-4222-8222-222222222222',status:'paid',currency:'usd',amountTotal:1500,items:first.state.attempts[0].quote.lines};
 assert.equal(cartItems(reconcilePaid(state,{...order,status:'pending'})).length,1);
 assert.equal(cartItems(reconcilePaid(state,{...order,id:'foreign'}))[0].quantity,2);
 assert.equal(cartItems(reconcilePaid(state,{...order,amountTotal:1}))[0].quantity,2);
 state=reconcilePaid(state,order); assert.equal(cartItems(state)[0].quantity,1);
 assert.deepEqual(reconcilePaid(state,order),state);
});
test('paid snapshot never clears a new addition after its original lot was removed', async () => {
 let state=addCartItem(emptyCart(),plug); const submitted=await submitCart(state,'th');
 state=bindOrder(submitted.state,submitted.request.requestKey,'22222222-2222-4222-8222-222222222222'); state.items=[]; state=addCartItem(state,plug);
 state=reconcilePaid(state,{id:'22222222-2222-4222-8222-222222222222',status:'paid',currency:'thb',amountTotal:20000,items:submitted.state.attempts[0].quote.lines});
 assert.equal(cartItems(state)[0].quantity,1);
});
