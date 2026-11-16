import test from 'node:test';import assert from 'node:assert/strict';
import {cancelOrder,syncRefundEvent,type RefundDependencies} from '../src/lib/server/refunds.ts';
const id='22222222-2222-4222-8222-222222222222',operation='33333333-3333-4333-8333-333333333333';
function fixture(){
 const order:any={id,customerId:'buyer',requestKey:id,fingerprint:'hash',status:'paid',currency:'usd',amountTotal:2000,items:[{sku:'endplug-plain',quantity:1}],checkoutSessionId:'cs_test_order',checkoutParameters:{shippingAmount:500},shippingAmount:500};
 const calls:any[]=[];let creates=0,refunds:any[]=[],providerError=false,admin=true;
 const charge:any={id:'ch_order',paid:true,status:'succeeded',amount:2000,amount_refunded:0,currency:'usd',disputed:false};
 const session:any={id:'cs_test_order',object:'checkout.session',mode:'payment',payment_status:'paid',livemode:false,status:'complete',currency:'usd',amount_total:2000,metadata:{order_id:id,customer_id:'buyer'},client_reference_id:id,payment_intent:{id:'pi_order',status:'succeeded',latest_charge:charge},created:Math.floor(Date.now()/1000)};
 const deps:RefundDependencies={admin:async()=>{if(!admin)throw Error('forbidden');return 'seller';},env:key=>({STRIPE_SECRET_KEY:'sk_test_example',STRIPE_WEBHOOK_SECRET:'whsec_example'}[key]),now:Date.now,select:async()=>[{id}] as any,rpc:async(name,args)=>{calls.push([name,args]);if(name==='begin_order_cancellation')return {id:operation,created_at:new Date().toISOString(),order} as any;if(name==='prepare_order_refund')return {refund_amount:2000} as any;if(name==='record_order_refund'){order.refundStatus=args.p_status;order.cancellationStatus=args.p_status==='succeeded'?'cancelled':'requested';return {...order} as any;}if(name==='order_record')return {...order} as any;return true as any;},stripe:()=>({checkout:{sessions:{retrieve:async()=>session,expire:async()=>({...session,status:'expired'}),list:async()=>({data:[session]})}},refunds:{list:async()=>({data:refunds,has_more:false}),create:async(params:any,options:any)=>{creates++;calls.push(['stripe.refund',params,options]);if(providerError)throw Error('provider-secret-message');const refund={id:'re_order',payment_intent:'pi_order',amount:2000,currency:'usd',status:'succeeded',created:Math.floor(Date.now()/1000),metadata:{cancellation_id:operation}};refunds=[refund];return refund;},retrieve:async()=>refunds[0]}} as any)};
 return {deps,order,session,charge,calls,get creates(){return creates;},set providerError(value:boolean){providerError=value;},set admin(value:boolean){admin=value;},set refunds(value:any[]){refunds=value;}};
}
const request=(origin='https://shop.test')=>new Request('https://shop.test/api/admin/order-cancellations',{method:'POST',headers:{origin}});
const body={orderId:id,reason:'Stock shortage',restock:{'endplug-plain':0}};
test('full cancellation freezes total, uses stable Stripe key, and retry does not refund again',async()=>{
 const f=fixture();assert.equal((await cancelOrder(request(),body,f.deps)).order.cancellationStatus,'cancelled');
 assert.equal(f.creates,1);const call=f.calls.find(call=>call[0]==='stripe.refund');assert.equal(call[1].amount,2000);assert.equal(call[2].idempotencyKey,'cancel-refund:'+operation);
 await cancelOrder(request(),body,f.deps);assert.equal(f.creates,1);
 assert.deepEqual(f.calls.find(call=>call[0]==='prepare_order_refund')[1],{p_order_id:id,p_amount:2000,p_merchandise:1500,p_shipping:500});
});
test('verified payment held for stock review can be refunded without restocking',async()=>{
 const f=fixture();f.order.status='review';f.order.cancellationStatus='requested';
 const result=await cancelOrder(request(),body,f.deps);
 assert.equal(result.order.refundStatus,'succeeded');
 assert.equal(f.creates,1);
 assert.equal(f.calls.filter(call=>call[0]==='apply_stripe_event').length,0);
});
test('auth, same-origin and reason validation run before money movement',async()=>{
 const f=fixture();f.admin=false;await assert.rejects(cancelOrder(request(),body,f.deps));f.admin=true;
 await assert.rejects(cancelOrder(request('https://evil.test'),body,f.deps));
 await assert.rejects(cancelOrder(request(),{...body,reason:''},f.deps));
 await assert.rejects(cancelOrder(request(),{...body,restock:{'endplug-plain':-1}},f.deps));assert.equal(f.creates,0);
});
test('uncertain provider failure keeps cancellation held and returns a redacted review error',async()=>{
 const f=fixture();f.providerError=true;await assert.rejects(cancelOrder(request(),body,f.deps),error=>(error as any).code==='cancellation_needs_review');
 assert.ok(f.calls.some(call=>call[0]==='review_order_cancellation'));assert.ok(!JSON.stringify(f.calls).includes('provider-secret-message'));
});
test('unattached payment cannot release stock or issue a refund',async()=>{
 const f=fixture();f.order.checkoutSessionId=null;const result=await cancelOrder(request(),body,f.deps);assert.equal(result.needsReview,true);assert.equal(f.creates,0);assert.ok(!f.calls.some(call=>call[0]==='finish_unpaid_cancellation'));
});
test('refund event verifies latest provider state before recording it',async()=>{
 const f=fixture();f.refunds=[{id:'re_external',payment_intent:'pi_order',amount:500,currency:'usd',status:'succeeded',created:Math.floor(Date.now()/1000),metadata:{}}];
 await syncRefundEvent({type:'refund.updated',data:{object:{id:'re_external',payment_intent:'pi_order',status:'pending'}}} as any,f.deps);
 assert.equal(f.calls.find(call=>call[0]==='record_order_refund')[1].p_status,'succeeded');
});
test('unpaid session is verified expired before reservations are released',async()=>{
 const f=fixture();f.order.status='pending';f.session.payment_status='unpaid';f.session.status='open';
 await cancelOrder(request(),body,f.deps);assert.equal(f.creates,0);assert.ok(f.calls.some(call=>call[0]==='apply_stripe_event'));assert.ok(f.calls.some(call=>call[0]==='finish_unpaid_cancellation'));
});

test('a seller-created SKU can be cancelled without another refund or restock',async()=>{
 const f=fixture();const dynamic={...body,restock:{'custom-sku-2026':0}};
 await cancelOrder(request(),dynamic,f.deps);
 assert.equal(f.creates,1);
 await cancelOrder(request(),dynamic,f.deps);
 assert.equal(f.creates,1);
});
