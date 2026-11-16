import test from 'node:test';
import assert from 'node:assert/strict';
import {createCatalogOrderHandlers,orderedPublishedProducts} from '../src/lib/server/catalog-order.ts';
import {HttpError} from '../src/lib/server/http.ts';
import {SupabaseRequestError} from '../src/lib/server/supabase.ts';
const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222';
const request=(body:unknown,origin='https://shop.test')=>new Request('https://shop.test/api/admin/catalog/order',{method:'PUT',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify(body)});
test('admins save complete product order and its expected previous order atomically',async()=>{
 const calls:unknown[]=[];
 const handler=createCatalogOrderHandlers({authorize:async()=>{},load:async()=>[],save:async(ids,expected)=>{calls.push({ids,expected});}});
 const response=await handler.put(request({ids:[b,a],expectedIds:[a,b]}));
 assert.equal(response.status,200);assert.deepEqual(calls,[{ids:[b,a],expected:[a,b]}]);
});
test('unauthorized and cross-origin users cannot read or save product order',async()=>{
 let touched=0;
 const denied=createCatalogOrderHandlers({authorize:async()=>{throw new HttpError(403,'forbidden');},load:async()=>{touched++;return[];},save:async()=>{touched++;}});
 assert.equal((await denied.get(new Request('https://shop.test'))).status,403);
 assert.equal((await denied.put(request({ids:[a],expectedIds:[a]}))).status,403);
 const allowed=createCatalogOrderHandlers({authorize:async()=>{},load:async()=>[],save:async()=>{touched++;}});
 assert.equal((await allowed.put(request({ids:[a],expectedIds:[a]},'https://evil.test'))).status,403);
 assert.equal(touched,0);
});
test('invalid, duplicate, incomplete and excessive lists never reach persistence',async()=>{
 let writes=0;const handler=createCatalogOrderHandlers({authorize:async()=>{},load:async()=>[],save:async()=>{writes++;}});
 for(const body of [{ids:[a,a],expectedIds:[a,b]},{ids:[a],expectedIds:[a,b]},{ids:['bad'],expectedIds:[a]},{ids:[a],expectedIds:[a,a]},{ids:[a],expectedIds:[a],extra:true},{ids:Array(501).fill(a),expectedIds:Array(501).fill(a)}]){
  assert.equal((await handler.put(request(body))).status,400);
 }
 assert.equal(writes,0);
});
test('stale database order returns conflict and keeps the submitted list reviewable',async()=>{
 const handler=createCatalogOrderHandlers({authorize:async()=>{},load:async()=>[],save:async()=>{throw new SupabaseRequestError(409,'40001');}});
 const response=await handler.put(request({ids:[b,a],expectedIds:[a,b]}));
 assert.equal(response.status,409);assert.deepEqual(await response.json(),{error:'catalog_order_changed'});
});
test('admin order listing preserves stored order and uses private non-cacheable responses',async()=>{
 const rows=[{id:b,slug:'second'},{id:a,slug:'first'}];
 const handler=createCatalogOrderHandlers({authorize:async()=>{},load:async()=>rows,save:async()=>{}});
 const response=await handler.get(new Request('https://shop.test'));
 assert.deepEqual(await response.json(),{products:rows});assert.match(response.headers.get('cache-control')!,/no-store/);
});

test('public catalog requests the persisted display order with stable tie breakers',async(t)=>{
 const previous=[process.env.SUPABASE_URL,process.env.SUPABASE_SECRET_KEY];
 process.env.SUPABASE_URL='https://catalog.test';process.env.SUPABASE_SECRET_KEY='sb_secret_fixture';
 t.after(()=>{for(const [index,key] of ['SUPABASE_URL','SUPABASE_SECRET_KEY'].entries()){if(previous[index]===undefined)delete process.env[key];else process.env[key]=previous[index];}});
 t.mock.method(globalThis,'fetch',async(input:string)=>{
  const url=new URL(input);assert.equal(url.pathname,'/rest/v1/catalog_products');
  assert.equal(url.searchParams.get('order'),'display_order.asc,created_at.asc,id.asc');
  assert.equal(url.searchParams.get('lifecycle'),'eq.published');
  return Response.json([{id:b},{id:a}]);
 });
 assert.deepEqual(await orderedPublishedProducts({limit:'200'}),[{id:b},{id:a}]);
});
