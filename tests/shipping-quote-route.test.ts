import test from 'node:test';
import assert from 'node:assert/strict';
import {POST} from '../src/pages/api/shipping-quote.ts';

test('automatic shipping route accepts a valid cart larger than two kilobytes',async(t)=>{
 const previous={url:process.env.SUPABASE_URL,key:process.env.SUPABASE_SECRET_KEY};
 process.env.SUPABASE_URL='https://shipping.example.test';process.env.SUPABASE_SECRET_KEY='sb_secret_fixture';
 t.after(()=>{for(const [key,value] of [['SUPABASE_URL',previous.url],['SUPABASE_SECRET_KEY',previous.key]]){if(value===undefined)delete process.env[key!];else process.env[key!]=value;}});
 const rows=Array.from({length:9},(_,i)=>({sku:`sku-${i}-${'x'.repeat(110)}`,product_id:`product-${i}`,product_slug:`product-${i}-${'x'.repeat(100)}`,product_name:`Product ${i}`,option_codes:[],sales_mode:'checkout',product_lifecycle:'published',lifecycle:'active',price_thb_minor:10000,on_hand:10,reserved:0,weight_grams:10}));
 t.mock.method(globalThis,'fetch',async(input:RequestInfo|URL)=>{const path=new URL(String(input)).pathname;if(path==='/rest/v1/rpc/storefront_config')return Response.json({allowed_countries:['TH'],pickup_enabled:true});if(path==='/rest/v1/inventory')return Response.json(rows);throw Error(`Unexpected external request ${path}`);});
 const payload=JSON.stringify({locale:'th',country:'TH',method:'pickup',items:rows.map(row=>({productId:row.product_slug,variant:row.sku,quantity:1}))});
 assert.ok(new TextEncoder().encode(payload).length>2048);
 const response=await POST({request:new Request('https://shop.example.test/api/shipping-quote',{method:'POST',headers:{origin:'https://shop.example.test','content-type':'application/json'},body:payload})} as any);
 assert.equal(response.status,200);const quote=await response.json();assert.equal(quote.subtotal,90000);assert.equal(quote.method,'pickup');
});
