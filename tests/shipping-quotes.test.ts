import test from 'node:test';
import assert from 'node:assert/strict';
import {requestShippingQuote,approveShippingQuote,checkoutShippingQuote,publicShippingQuote} from '../src/lib/server/shipping-quotes.ts';

const id='22222222-2222-4222-8222-222222222222';
const address={line1:'1 Test Street',line2:'',city:'Bangkok',state:'',postal_code:'10120',country:'TH'};
function fixture(){
 const calls:any[]=[];
 let row:any={id,customerId:id,requestKey:id,status:'requested',currency:'usd',locale:'en',amountSubtotal:3000,shippingAmount:null,weightGrams:3000,country:'TH',address,recipient:{name:'Test'},items:[{sku:'endplug-plain',productId:'saxophone-end-plug',variant:'plain',options:{},quantity:2,name:'End plug',unitAmount:1500}],createdAt:'2026-10-20T00:00:00Z',expiresAt:'2026-10-27T00:00:00Z',orderId:null};
 const deps:any={
  customer:async()=>({id,googleSubject:'owner',email:'test@example.test',name:'Test',phone:null,shippingAddress:address}),
  admin:async()=> 'seller-subject',now:()=>Date.parse('2026-10-20T00:00:00Z'),
  config:async()=>({allowed_countries:['TH','JP'],usd_thb:35,jpy_thb:0.25,shipping_rates:{'TH:ems_local':[{maxGrams:2000,thbMinor:10000}]}}),
  exchangeRates:async()=>({usdThb:35,jpyThb:.25,date:'2026-10-20',source:'Frankfurter' as const}),
  inventory:async()=>[{sku:'endplug-plain',weight_grams:1500,price_usd_minor:1500,price_jpy:2500,price_thb_minor:20000}],
  rpc:async(name:string,args:any)=>{calls.push({name,args});return row;},
  pay:async(_request:Request,body:any)=>{calls.push({name:'checkout',args:body});return {orderId:id,url:'https://checkout.stripe.com/c/test'};},
 };
 return {deps,calls,get row(){return row;},set row(value:any){row=value;}};
}
const body={requestKey:id,locale:'en',items:[{productId:'saxophone-end-plug',variant:'plain',quantity:2}],country:'TH'};

test('oversize request snapshots server-priced items and saved address without reserving stock',async()=>{
 const f=fixture();await requestShippingQuote(new Request('https://shop.test'),body,f.deps);
 assert.deepEqual(f.calls.map(c=>c.name),['create_shipping_quote']);
 assert.equal(f.calls[0].args.p_subtotal,3000);assert.equal(f.calls[0].args.p_weight_grams,3000);
 assert.deepEqual(f.calls[0].args.p_address,address);
 await assert.rejects(requestShippingQuote(new Request('https://shop.test'),{...body,shippingAmount:1},f.deps),/invalid_shipping_quote/);
});
test('quote requests require matching address and either oversize weight or an unavailable rate',async()=>{
 const f=fixture();await assert.rejects(requestShippingQuote(new Request('https://shop.test'),{...body,country:'JP'},f.deps),/shipping_address_country_mismatch/);
 f.deps.inventory=async()=>[{sku:'endplug-plain',weight_grams:100}];
 await assert.rejects(requestShippingQuote(new Request('https://shop.test'),body,f.deps),/shipping_quote_not_required/);
 assert.equal(f.calls.length,0);
 f.deps.config=async()=>({allowed_countries:['TH','JP'],shipping_rates:{'TH:ems_local':[{maxGrams:200,thbMinor:null},{maxGrams:300,thbMinor:7000}]}});
 await requestShippingQuote(new Request('https://shop.test'),body,f.deps);
 assert.equal(f.calls[0].name,'create_shipping_quote');assert.equal(f.calls[0].args.p_weight_grams,200);
});
test('only an authorized seller can set the fee; THB conversion freezes the five percent buffer',async()=>{
 const f=fixture();await approveShippingQuote(new Request('https://shop.test'),{quoteId:id,shippingThb:1000,note:' EMS '},f.deps);
 const args=f.calls.find(c=>c.name==='admin_approve_shipping_quote_v2').args;
 assert.equal(args.p_shipping_amount,3000);assert.equal(args.p_shipping_thb_minor,100000);assert.equal(args.p_actor,'seller-subject');assert.equal(args.p_note,'EMS');
 f.row={...f.row,orderId:id};
 await assert.rejects(approveShippingQuote(new Request('https://shop.test'),{quoteId:id,shippingThb:1000,note:''},f.deps),/shipping_quote_not_editable/);
 f.deps.admin=async()=>{throw Error('forbidden');};
 await assert.rejects(approveShippingQuote(new Request('https://shop.test'),{quoteId:id,shippingThb:1000,note:''},f.deps),/forbidden/);
});
test('quote checkout rejects foreign, unapproved and expired requests before starting payment',async()=>{
 const f=fixture(),request=new Request('https://shop.test');
 f.row={...f.row,customerId:'other'};
 await assert.rejects(checkoutShippingQuote(request,{quoteId:id},f.deps),/shipping_quote_not_found/);
 f.row={...f.row,customerId:id};
 await assert.rejects(checkoutShippingQuote(request,{quoteId:id},f.deps),/shipping_quote_not_ready/);
 f.row={...f.row,status:'quoted',shippingService:'ems_local'};
 await checkoutShippingQuote(request,{quoteId:id},f.deps);
 const pay=f.calls.find(c=>c.name==='checkout');assert.equal(pay.args.quoteId,id);assert.equal(pay.args.requestKey,id);assert.equal(pay.args.shippingCountry,'TH');
 f.row={...f.row,expiresAt:'2026-10-19T00:00:00Z'};
 await assert.rejects(checkoutShippingQuote(request,{quoteId:id},f.deps),/shipping_quote_not_ready/);
});
test('customer quote responses omit internal identity, fingerprint and approval metadata',()=>{
 const row=publicShippingQuote({id,customerId:'secret',cartFingerprint:'secret',approvedBy:'secret',version:3});
 assert.equal('customerId' in row,false);assert.equal('cartFingerprint' in row,false);assert.equal('approvedBy' in row,false);
});
