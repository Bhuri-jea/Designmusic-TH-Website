import test from 'node:test';import assert from 'node:assert/strict';
import { createAdminHandlers, requireAdmin } from '../src/lib/server/admin.ts';
import { SupabaseRequestError } from '../src/lib/server/supabase.ts';
const id='22222222-2222-4222-8222-222222222222';
function fixture(){let subject='seller',paid=true,reserved=2,calls=0,shipmentStatus='ready',tracking='',held=false,holdFailure=false,jobRows:any[]=[];const holdCalls:any[]=[];const handler=createAdminHandlers({getSession:async()=>({googleSubject:subject}),subjects:()=>['seller'],inventory:async()=>[{sku:'endplug-plain',on_hand:3,reserved}],setStock:async()=>{calls++;},shipments:async()=>[],shipment:async()=>({order_id:id,payment_status:paid?'paid':'pending',status:shipmentStatus,fulfillment_method:'ems_local',shipping_service:'ems_local',hold:held,hold_reason:held?'Customer requested review':null,recipient:{name:'<img src=x onerror=alert(1)>'},address:{line1:'<script>bad</script>',city:'Bangkok',postal_code:'10110',country:'TH'},items:[{name:'A & B',quantity:1}]}),ship:async(_id,value)=>{calls++;tracking=value;},shipmentHold:async(...args)=>{holdCalls.push(args);if(holdFailure)throw new SupabaseRequestError(409,'23514');held=args[1];calls++;},jobs:async()=>jobRows});return {handler,set subject(v:string){subject=v;},set paid(v:boolean){paid=v;},set shipmentStatus(v:string){shipmentStatus=v;},set held(v:boolean){held=v;},set holdFailure(v:boolean){holdFailure=v;},set jobs(v:any[]){jobRows=v;},get calls(){return calls;},get tracking(){return tracking;},get holdCalls(){return holdCalls;}};}
const write=(body:unknown,origin='https://shop.test')=>new Request('https://shop.test/api/admin/inventory',{method:'PATCH',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify(body)});

test('paid shipment pagination validates input and reports totals beyond the old hundred-row limit',async()=>{
 const calls:unknown[]=[];
 const handler=createAdminHandlers({getSession:async()=>({googleSubject:'seller'}),subjects:()=>['seller'],inventory:async()=>[],setStock:async()=>{},shipments:async(page?:number,pageSize?:number)=>{calls.push([page,pageSize]);return {shipments:[{order_id:id,currency:'thb',created_at:'2026-10-21T00:00:00Z'}],total:151};},shipment:async()=>null,ship:async()=>{},shipmentHold:async()=>{},jobs:async()=>[]});
 const first=await handler.shipmentsGet(new Request('https://shop.test/api/admin/shipments'));
 assert.equal(first.status,200);assert.equal((await first.json()).total,151);assert.deepEqual(calls[0],[1,5]);
 const page=await handler.shipmentsGet(new Request('https://shop.test/api/admin/shipments?page=3&pageSize=50'));
 assert.equal((await page.json()).page,3);assert.deepEqual(calls[1],[3,50]);
 for(const query of ['page=0','page=-1','page=1.5','pageSize=100000','page=abc'])assert.equal((await handler.shipmentsGet(new Request('https://shop.test/api/admin/shipments?'+query))).status,400);
});
test('admin Google subject allowlist rejects missing and foreign identity before any inventory read/write',async()=>{for(const subject of ['','buyer']){const f=fixture();f.subject=subject;assert.equal((await f.handler.inventoryGet(new Request('https://shop.test'))).status,subject?403:401);assert.equal((await f.handler.inventoryPatch(write({sku:'endplug-plain',onHand:4}))).status,subject?403:401);assert.equal(f.calls,0);}});
test('admin rejects namespaced Supabase identities even when the allowlist contains them',async()=>{
 const identity='supabase:'+id;
 await assert.rejects(requireAdmin(new Request('https://shop.test'),{getSession:async()=>({googleSubject:identity}),subjects:()=>[identity]}),error=>(error as any).status===401);
 await assert.rejects(requireAdmin(new Request('https://shop.test'),{getSession:async()=>({googleSubject:'seller',supabaseSubject:id}),subjects:()=>['seller']}),error=>(error as any).status===401);
});
test('admin inventory rejects below-reserved stock, injected authority and cross-origin mutations',async()=>{const f=fixture();assert.equal((await f.handler.inventoryPatch(write({sku:'endplug-plain',onHand:1}))).status,409);assert.equal((await f.handler.inventoryPatch(write({sku:'endplug-plain',onHand:4,paid:true}))).status,400);assert.equal((await f.handler.inventoryPatch(write({sku:'endplug-plain',onHand:4},'https://evil.test'))).status,403);assert.equal(f.calls,0);assert.equal((await f.handler.inventoryPatch(write({sku:'endplug-plain',onHand:2}))).status,200);assert.equal(f.calls,1);});
test('jobs endpoint projects readable failure details and validated order references',async()=>{
 const f=fixture();f.jobs=[{id:44,topic:'order_paid_buyer',status:'review',attempts:5,last_error:'http_503',created_at:'2026-10-21T00:00:00Z',first_attempt_at:'2026-10-21T01:00:00Z',payload:{orderId:id,customerEmail:'private@example.test'}}];
 const response=await f.handler.jobsGet(new Request('https://shop.test/api/admin/jobs'));
 assert.equal(response.status,200);
 assert.deepEqual(await response.json(),{jobs:[{id:44,purpose:'order_paid_buyer',status:'review',attempts:5,lastError:'http_503',referenceId:id,referenceType:'order',createdAt:'2026-10-21T00:00:00Z',lastAttemptAt:'2026-10-21T01:00:00Z'}]});
});
test('shipping print denies unpaid or non-admin orders and escapes actual paid recipient/items',async()=>{const f=fixture();const request=new Request('https://shop.test/api/admin/shipping-label?order_id='+id);f.paid=false;assert.equal((await f.handler.label(request)).status,409);f.paid=true;f.subject='buyer';assert.equal((await f.handler.label(request)).status,403);f.subject='seller';const res=await f.handler.label(request);const html=await res.text();assert.equal(res.status,200);assert.ok(html.includes('&lt;img'));assert.ok(html.includes('&lt;script&gt;'));assert.ok(html.includes('A &amp; B'));assert.ok(!html.includes('<script>'));});
test('shipment mutation requires seller, ready paid record, valid tracking and same origin',async()=>{
 const f=fixture();const request=(tracking:string,origin='https://shop.test')=>new Request('https://shop.test/api/admin/shipments',{method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify({orderId:id,tracking})});
 f.subject='buyer';assert.equal((await f.handler.ship(request('TRACK123'))).status,403);f.subject='seller';
 f.paid=false;assert.equal((await f.handler.ship(request('TRACK123'))).status,409);f.paid=true;
 f.shipmentStatus='needs_address';assert.equal((await f.handler.ship(request('TRACK123'))).status,409);f.shipmentStatus='ready';
 assert.equal((await f.handler.ship(request('<script>'))).status,400);
 assert.equal((await f.handler.ship(request('TRACK123','https://evil.test'))).status,403);
 assert.equal(f.calls,0);
 assert.equal((await f.handler.ship(request('TRACK123 '))).status,200);assert.equal(f.tracking,'TRACK123');assert.equal(f.calls,1);
});
test('hold and release are same-origin admin actions with server-derived actor and required reason',async()=>{
 const f=fixture();const request=(body:unknown,origin='https://shop.test')=>new Request('https://shop.test/api/admin/shipment-hold',{method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify(body)});
 const body={orderId:id,hold:true,reason:'Customer requested a refund review'};
 f.subject='buyer';assert.equal((await f.handler.shipmentHold(request(body))).status,403);f.subject='seller';
 assert.equal((await f.handler.shipmentHold(request(body,'https://evil.test'))).status,403);
 assert.equal((await f.handler.shipmentHold(request({...body,actor:'client'}))).status,400);
 assert.equal((await f.handler.shipmentHold(request({...body,reason:'  '}))).status,400);
 f.paid=false;assert.equal((await f.handler.shipmentHold(request(body))).status,409);f.paid=true;
 assert.equal((await f.handler.shipmentHold(request(body))).status,200);assert.deepEqual(f.holdCalls[0],[id,true,body.reason,'seller']);
 assert.equal((await f.handler.shipmentHold(request({...body,hold:false,reason:'Review complete'}))).status,200);
 assert.deepEqual(f.holdCalls[1],[id,false,'Review complete','seller']);
});
test('held shipment cannot print or dispatch; missing hold field fails closed',async()=>{
 const f=fixture();f.held=true;const print=new Request('https://shop.test/api/admin/shipping-label?order_id='+id);
 assert.equal((await f.handler.label(print)).status,409);
 const ship=new Request('https://shop.test/api/admin/shipments',{method:'POST',headers:{origin:'https://shop.test','Content-Type':'application/json'},body:JSON.stringify({orderId:id,tracking:'TRACK123'})});
 assert.equal((await f.handler.ship(ship)).status,409);assert.equal(f.calls,0);
});
test('serialized shipment race reported by redacted Supabase conflict maps to 409',async()=>{
 const f=fixture();f.holdFailure=true;
 const response=await f.handler.shipmentHold(new Request('https://shop.test/api/admin/shipment-hold',{method:'POST',headers:{origin:'https://shop.test','Content-Type':'application/json'},body:JSON.stringify({orderId:id,hold:true,reason:'Customer refund review'})}));
 assert.equal(response.status,409);assert.deepEqual(await response.json(),{error:'shipment_changed'});
});
