import test from 'node:test';
import assert from 'node:assert/strict';
import { createExchangeRateLoader, convertPostage, shipmentReferenceRates } from '../src/lib/server/exchange-rates.ts';
const now = Date.parse('2026-10-21T12:00:00Z');
const data = [{base:'USD',quote:'THB',date:'2026-10-20',rate:35},{base:'USD',quote:'JPY',date:'2026-10-20',rate:140}];
test('Frankfurter pairs share one cached request and produce THB per USD/JPY', async () => {
 let calls=0; const load=createExchangeRateLoader({now:()=>now,fetch:async()=>{calls++;return Response.json(data);}});
 const [a,b]=await Promise.all([load(),load()]);
 assert.deepEqual(a,{usdThb:35,jpyThb:.25,date:'2026-10-20',source:'Frankfurter'});assert.deepEqual(b,a);
 a.usdThb=1;assert.equal((await load()).usdThb,35);assert.equal(calls,1);
});
test('FX outages, invalid values, mismatched/stale dates fail closed without a made-up fallback',async()=>{
 for(const value of [[],data.map(r=>({...r,rate:0})),[data[0],{...data[1],date:'2026-10-19'}],data.map(r=>({...r,date:'2020-01-01'}))]){
  const load=createExchangeRateLoader({now:()=>now,fetch:async()=>Response.json(value)});await assert.rejects(load(),/shipping_fx_unavailable/);
 }
 const load=createExchangeRateLoader({now:()=>now,fetch:async()=>new Response('',{status:503})});await assert.rejects(load(),/shipping_fx_unavailable/);
});
test('only converted postage receives five percent; JPY rounds to whole yen',()=>{
 const fx={usdThb:35,jpyThb:.25,date:'2026-10-20',source:'Frankfurter' as const};
 assert.equal(convertPostage(50000,'thb'),50000);assert.equal(convertPostage(50000,'usd',fx),1500);assert.equal(convertPostage(50000,'jpy',fx),2100);
 assert.throws(()=>convertPostage(50000,'usd'),/shipping_fx_unavailable/);
});
test('old shipments get labelled current reference rates without changing frozen totals or stored rates',async()=>{
 const rows=[{currency:'usd',amount_total:3000,reference_thb_rate:null},{currency:'jpy',amount_total:1000,reference_thb_rate:.23}];
 const result=await shipmentReferenceRates(rows,async()=>({usdThb:35,jpyThb:.25,date:'2026-10-20',source:'Frankfurter'}));
 assert.equal(result[0].amount_total,3000);assert.equal(result[0].reference_thb_rate,35);assert.equal(result[0].reference_fx_current,true);assert.equal(rows[0].reference_thb_rate,null);assert.equal(result[1].reference_thb_rate,.23);
 assert.equal(await shipmentReferenceRates(rows,async()=>{throw Error();}),rows);
});
