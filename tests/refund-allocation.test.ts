import test from 'node:test';
import assert from 'node:assert/strict';
import {createRefundAllocationHandlers} from '../src/lib/server/refund-allocation.ts';
import {HttpError} from '../src/lib/server/http.ts';
const request=(body:unknown,origin='https://shop.test')=>new Request('https://shop.test/api/admin/refund-allocation',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify(body)});
const refund={id:'re_test',order_id:'order',currency:'usd',amount:1000};
test('allocation validates currency precision and exact total before persisting trusted minor units',async()=>{
 const calls:unknown[]=[];
 const handlers=createRefundAllocationHandlers({authorize:async()=> 'admin-subject',list:async()=>[],find:async()=>refund,save:async(...args)=>{calls.push(args);}});
 for(const body of [{refundId:'re_test',merchandise:9,shipping:2},{refundId:'re_test',merchandise:9.999,shipping:0.001},{refundId:'re_test',merchandise:-1,shipping:11}])assert.equal((await handlers.post(request(body))).status,400);
 assert.equal(calls.length,0);
 assert.equal((await handlers.post(request({refundId:'re_test',merchandise:9.5,shipping:0.5}))).status,200);
 assert.deepEqual(calls,[['re_test',950,50,'admin-subject']]);
 const yen=createRefundAllocationHandlers({authorize:async()=> 'admin',list:async()=>[],find:async()=>({...refund,currency:'jpy'}),save:async()=>{}});
 assert.equal((await yen.post(request({refundId:'re_test',merchandise:999.5,shipping:0.5}))).status,400);
 assert.equal((await yen.post(request({refundId:'re_test',merchandise:1000,shipping:0}))).status,200);
});
test('allocation APIs enforce admin and origin, and list only safe refund fields',async()=>{
 let writes=0;
 const deps={authorize:async()=> 'admin',list:async()=>[{...refund,payment_intent_id:'hidden'}],find:async()=>refund,save:async()=>{writes++;}};
 const handlers=createRefundAllocationHandlers(deps);
 assert.deepEqual(await (await handlers.get(new Request('https://shop.test/api/admin/refund-allocation'))).json(),{refunds:[refund]});
 assert.equal((await handlers.post(request({refundId:'re_test',merchandise:10,shipping:0},'https://evil.test'))).status,403);
 const denied=createRefundAllocationHandlers({...deps,authorize:async()=>{throw new HttpError(403,'forbidden');}});
 assert.equal((await denied.get(new Request('https://shop.test/api/admin/refund-allocation'))).status,403);
 assert.equal(writes,0);
});
