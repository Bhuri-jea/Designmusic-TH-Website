import test from 'node:test';
import assert from 'node:assert/strict';
import {reconcilePayments} from '../src/lib/server/reconciliation.ts';

test('reconciliation rotates past open and unreadable sessions to recover a later paid order',async()=>{
 const rows=Array.from({length:7},(_,i)=>({id:String(i),checked:null as number|null}));
 const orders=rows.map(row=>({id:row.id,customerId:'buyer',status:'pending',checkoutSessionId:'cs_'+row.id,currency:'usd',amountTotal:1500,checkoutParameters:{}}));
 let tick=0;const applied:string[]=[];
 const deps:any={env:(key:string)=>({STRIPE_SECRET_KEY:'sk_test_example',STRIPE_WEBHOOK_SECRET:'whsec_example'}[key]),now:Date.now,
  select:async(_table:string,query:any)=>query.checkout_session_id==='is.null'?[]:[...rows].sort((a,b)=>query.order.startsWith('reconciliation_checked_at')?(a.checked??-1)-(b.checked??-1):Number(a.id)-Number(b.id)).slice(0,5),
  rpc:async(name:string,args:any)=>{if(name==='order_record')return orders[Number(args.p_id)];if(name==='mark_order_reconciliation_attempt'){rows[Number(args.p_order_id)].checked=++tick;return true;}if(name==='apply_stripe_event'){applied.push(args.p_order_id);orders[Number(args.p_order_id)].status='paid';}return true;},
  stripe:()=>({retrieve:async(id:string)=>{const index=Number(id.slice(3));if(index===0)throw Error('provider_unavailable');return {id,object:'checkout.session',mode:'payment',livemode:false,metadata:{order_id:String(index),customer_id:'buyer'},client_reference_id:String(index),currency:'usd',amount_total:1500,status:index===6?'complete':'open',payment_status:index===6?'paid':'unpaid'};}})};
 await reconcilePayments(deps);await reconcilePayments(deps);
 assert.deepEqual(applied,['6']);
});
