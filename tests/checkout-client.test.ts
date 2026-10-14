import test from 'node:test';
import assert from 'node:assert/strict';
import { runCheckout } from '../src/lib/checkout-client.ts';
import { addCartItem, bindOrder, emptyCart, submitCart } from '../src/lib/cart-storage.ts';

const orderId='22222222-2222-4222-8222-222222222222';
function fixture() {
 let state=addCartItem(emptyCart(),{productId:'saxophone-end-plug',variant:'plain',quantity:1});
 const bound:string[]=[];
 const cart={
  async submit(locale:'en'|'ja'|'th'|'zh-CN'){const result=await submitCart(state,locale);state=result.state;return result.request;},
  bind(key:string,id:string){state=bindOrder(state,key,id);bound.push(id);},
 };
 return {cart,bound,state:()=>state};
}
test('checkout sends a canonical submission and binds its owned order before navigation',async()=>{
 const f=fixture();let sent:any;
 const result=await runCheckout(f.cart,'ja',async(input,init)=>{assert.equal(input,'/api/checkout');sent=JSON.parse(String(init?.body));return new Response(JSON.stringify({orderId,url:'https://checkout.stripe.com/c/pay/test'}),{status:200});});
 assert.equal(result,'https://checkout.stripe.com/c/pay/test');
 assert.deepEqual(Object.keys(sent).sort(),['items','locale','requestKey']);
 assert.deepEqual(sent.items,[{productId:'saxophone-end-plug',variant:'plain',quantity:1}]);
 assert.equal(sent.locale,'ja');assert.equal(f.bound[0],orderId);assert.equal(f.state().attempts[0].orderId,orderId);
});
test('failed requests preserve a retry key and never bind an order',async()=>{
 const f=fixture();const keys:string[]=[];
 for(let i=0;i<2;i++)await assert.rejects(runCheckout(f.cart,'en',async(_input,init)=>{keys.push(JSON.parse(String(init?.body)).requestKey);return new Response(JSON.stringify({error:'stock_unavailable'}),{status:409});}),{code:'stock_unavailable'});
 assert.equal(keys[0],keys[1]);assert.deepEqual(f.bound,[]);assert.equal(f.state().items.length,1);
});
test('malformed checkout response or failed binding never authorizes navigation',async()=>{
 const f=fixture();
 await assert.rejects(runCheckout(f.cart,'en',async()=>new Response(JSON.stringify({orderId,url:'https://evil.example/pay'}),{status:200})),{code:'checkout_unavailable'});
 assert.deepEqual(f.bound,[]);
 await assert.rejects(runCheckout({...f.cart,bind(){throw Error('storage_unavailable');}},'en',async()=>new Response(JSON.stringify({orderId,url:'https://checkout.stripe.com/pay'}),{status:200})),{message:'storage_unavailable'});
});
