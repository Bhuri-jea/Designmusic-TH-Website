import test from 'node:test';import assert from 'node:assert/strict';
import { createAdminHandlers, requireAdmin } from '../src/lib/server/admin.ts';
const id='22222222-2222-4222-8222-222222222222';
function fixture(){let subject='seller',paid=true,reserved=2,calls=0,shipmentStatus='ready',tracking='';const handler=createAdminHandlers({getSession:async()=>({googleSubject:subject}),subjects:()=>['seller'],inventory:async()=>[{sku:'endplug-plain',on_hand:3,reserved}],setStock:async()=>{calls++;},shipments:async()=>[],shipment:async()=>({order_id:id,payment_status:paid?'paid':'pending',status:shipmentStatus,recipient:{name:'<img src=x onerror=alert(1)>'},address:{line1:'<script>bad</script>',city:'Bangkok',postal_code:'10110',country:'TH'},items:[{name:'A & B',quantity:1}]}),ship:async(_id,value)=>{calls++;tracking=value;},jobs:async()=>[]});return {handler,set subject(v:string){subject=v;},set paid(v:boolean){paid=v;},set shipmentStatus(v:string){shipmentStatus=v;},get calls(){return calls;},get tracking(){return tracking;}};}
const write=(body:unknown,origin='https://shop.test')=>new Request('https://shop.test/api/admin/inventory',{method:'PATCH',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify(body)});
test('admin Google subject allowlist rejects missing and foreign identity before any inventory read/write',async()=>{for(const subject of ['','buyer']){const f=fixture();f.subject=subject;assert.equal((await f.handler.inventoryGet(new Request('https://shop.test'))).status,subject?403:401);assert.equal((await f.handler.inventoryPatch(write({sku:'endplug-plain',onHand:4}))).status,subject?403:401);assert.equal(f.calls,0);}});
test('admin rejects namespaced Supabase identities even when the allowlist contains them',async()=>{
 const identity='supabase:'+id;
 await assert.rejects(requireAdmin(new Request('https://shop.test'),{getSession:async()=>({googleSubject:identity}),subjects:()=>[identity]}),error=>(error as any).status===401);
 await assert.rejects(requireAdmin(new Request('https://shop.test'),{getSession:async()=>({googleSubject:'seller',supabaseSubject:id}),subjects:()=>['seller']}),error=>(error as any).status===401);
});
test('admin inventory rejects below-reserved stock, injected authority and cross-origin mutations',async()=>{const f=fixture();assert.equal((await f.handler.inventoryPatch(write({sku:'endplug-plain',onHand:1}))).status,409);assert.equal((await f.handler.inventoryPatch(write({sku:'endplug-plain',onHand:4,paid:true}))).status,400);assert.equal((await f.handler.inventoryPatch(write({sku:'endplug-plain',onHand:4},'https://evil.test'))).status,403);assert.equal(f.calls,0);assert.equal((await f.handler.inventoryPatch(write({sku:'endplug-plain',onHand:2}))).status,200);assert.equal(f.calls,1);});
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
