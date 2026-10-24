import test from 'node:test';import assert from 'node:assert/strict';
import {createImageUploadHandler,storeProductImage} from '../src/lib/server/catalog-images.ts';
import {HttpError} from '../src/lib/server/http.ts';
const origin='https://shop.test';
const png=new Uint8Array([137,80,78,71,13,10,26,10,0,0,0,0]);
const request=(body:Uint8Array=png,headers:Record<string,string>={})=>new Request(origin+'/api/admin/catalog/images',{method:'POST',headers:{origin,'content-type':'image/png',...headers},body:new Uint8Array(body).buffer});
test('only authorized same-origin image uploads reach cloud storage',async()=>{
 const seen:any[]=[];const handler=createImageUploadHandler({authorize:async()=>{},upload:async(bytes,type)=>{seen.push({bytes,type});return 'https://storage.test/image.png';}});
 const response=await handler(request());assert.equal(response.status,201);assert.deepEqual(await response.json(),{url:'https://storage.test/image.png'});assert.equal(seen[0].type,'image/png');
 assert.equal((await handler(request(png,{origin:'https://other.test'}))).status,403);
 const denied=createImageUploadHandler({authorize:async()=>{throw new HttpError(401,'sign_in_required');},upload:async()=>{throw Error('must not upload');}});assert.equal((await denied(request())).status,401);
});
test('invalid, disguised, oversized and empty uploads do not reach storage',async()=>{
 let uploads=0;const handler=createImageUploadHandler({authorize:async()=>{},upload:async()=>{uploads++;return 'https://storage.test/x';}});
 for(const req of [request(new TextEncoder().encode('<svg></svg>')),request(png,{'content-type':'image/jpeg'}),request(png,{'content-type':'image/svg+xml'}),request(new Uint8Array()),request(png,{'content-length':'5000000'}),request(new Uint8Array(4194305))])assert.ok((await handler(req)).status>=400);
 assert.equal(uploads,0);
});
test('storage uses a unique public image URL and keeps the service key on the server',async()=>{
 const originalFetch=globalThis.fetch,url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SECRET_KEY;
 process.env.SUPABASE_URL='https://storage.test';process.env.SUPABASE_SECRET_KEY='sb_secret_local_test';
 let path='',headers:Record<string,string>={};
 globalThis.fetch=async(input,init)=>{path=String(input);headers=init?.headers as Record<string,string>;return new Response('{}',{status:200});};
 try{const result=await storeProductImage(png,'image/png');assert.match(path,/^https:\/\/storage.test\/storage\/v1\/object\/product-images\/[\da-f-]+\.png$/);assert.equal(headers.apikey,'sb_secret_local_test');assert.equal(headers.authorization,undefined);assert.match(result,/\/storage\/v1\/object\/public\/product-images\/[\da-f-]+\.png$/);assert.ok(!result.includes('sb_secret'));}
 finally{globalThis.fetch=originalFetch;if(url===undefined)delete process.env.SUPABASE_URL;else process.env.SUPABASE_URL=url;if(key===undefined)delete process.env.SUPABASE_SECRET_KEY;else process.env.SUPABASE_SECRET_KEY=key;}
});

