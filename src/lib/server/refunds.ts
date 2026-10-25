import Stripe from 'stripe';
import { requireAdmin } from './admin.ts';
import { getEnv } from './env.ts';
import { rpc, select } from './supabase.ts';
import { HttpError, assertSameOrigin } from './http.ts';
import { paymentCredentials, sessionMatches, applySessionEvent, uuid, type PaymentDependencies } from './payments.ts';
import type { OrderRecord } from './order-state.ts';

export type RefundDependencies = {
 admin: typeof requireAdmin; env:typeof getEnv; rpc:typeof rpc; select:typeof select;
 stripe:(key:string)=>Stripe; now:()=>number;
};
export const refundDependencies:RefundDependencies={admin:requireAdmin,env:getEnv,rpc,select,stripe:key=>new Stripe(key,{maxNetworkRetries:1,timeout:15000}),now:Date.now};
const operationId=(refund:Stripe.Refund)=>uuid(refund.metadata?.cancellation_id)?refund.metadata.cancellation_id:null;
const intentId=(value:string|Stripe.PaymentIntent|null)=>typeof value==='string'?value:value?.id;

async function recordRefund(refund:Stripe.Refund,order:OrderRecord,pi:string,deps:RefundDependencies){
 if(intentId(refund.payment_intent)!==pi||refund.currency!==order.currency||!Number.isSafeInteger(refund.amount)||refund.amount<=0||refund.amount>order.amountTotal)throw new HttpError(409,'refund_mismatch');
 return deps.rpc<OrderRecord>('record_order_refund',{p_id:refund.id,p_order_id:order.id,p_payment_intent:pi,p_amount:refund.amount,p_currency:refund.currency,p_status:refund.status,p_created_at:new Date(refund.created*1000).toISOString(),p_operation:operationId(refund)});
}

export async function cancelOrder(request:Request,body:Record<string,unknown>,deps=refundDependencies):Promise<{order:OrderRecord;needsReview?:boolean}>{
 const actor=await deps.admin(request);assertSameOrigin(request);
 if(Object.keys(body).sort().join(',')!=='orderId,reason,restock'||!uuid(body.orderId)||typeof body.reason!=='string'||!body.reason.trim()||body.reason.trim().length>1000||!body.restock||typeof body.restock!=='object'||Array.isArray(body.restock)
  ||Object.entries(body.restock).some(([sku,quantity])=>!sku||sku.length>120||/[\u0000-\u001f\u007f]/.test(sku)||!Number.isInteger(quantity)||(quantity as number)<0||(quantity as number)>10))throw new HttpError(400,'invalid_cancellation');
 const config=paymentCredentials(deps.env),stripe=deps.stripe(config.key);
 const operation=await deps.rpc<any>('begin_order_cancellation',{p_order_id:body.orderId,p_reason:body.reason.trim(),p_restock:body.restock,p_actor:actor});
 let order=operation.order as OrderRecord;
 if((order as any).cancellationStatus==='cancelled')return {order};
 const review=async(code:string)=>{await deps.rpc('review_order_cancellation',{p_order_id:order.id,p_error:code});return {order:await deps.rpc<OrderRecord>('order_record',{p_id:order.id}),needsReview:true};};
 if(!order.checkoutSessionId)return review('checkout_session_unknown');
 try{
  let session=await stripe.checkout.sessions.retrieve(order.checkoutSessionId,{expand:['payment_intent.latest_charge']});
  sessionMatches(session,order,config.live);
  if(session.payment_status!=='paid'){
   if(session.status==='open')session=await stripe.checkout.sessions.expire(session.id);
   sessionMatches(session,order,config.live);
   if(session.status==='expired'&&session.payment_status!=='paid'){
    await applySessionEvent(order,session,`cancel:expired:${session.id}`,'checkout.session.expired',Math.floor(deps.now()/1000),{rpc:deps.rpc} as PaymentDependencies);
    return {order:await deps.rpc<OrderRecord>('finish_unpaid_cancellation',{p_order_id:order.id})};
   }
   return review('payment_not_final');
  }
  if(session.status!=='complete')return review('payment_not_final');
  const intent=session.payment_intent;
  const charge=typeof intent==='object'&&intent?intent.latest_charge:null;
  if(!intent||typeof intent==='string'||intent.status!=='succeeded'||!charge||typeof charge==='string'||!charge.paid||charge.status!=='succeeded'||charge.amount!==order.amountTotal||charge.currency!==order.currency||charge.disputed)return review('payment_requires_review');
  if(order.status!=='paid'){
   const paidAt=Number.isSafeInteger(charge.created)&&charge.created>0?charge.created:Math.floor(deps.now()/1000);
   await applySessionEvent(order,session,`reconcile:paid:${session.id}`,'checkout.session.completed',paidAt,{rpc:deps.rpc} as PaymentDependencies);
   await deps.rpc('record_order_payment_time',{p_order_id:order.id,p_paid_at:new Date(paidAt*1000).toISOString(),p_estimated:!Number.isSafeInteger(charge.created)});
   order=await deps.rpc<OrderRecord>('order_record',{p_id:order.id});
   if(order.status!=='paid')return review('payment_requires_review');
  }
  await deps.rpc('link_order_payment',{p_order_id:order.id,p_payment_intent:intent.id});
  const refunds=await stripe.refunds.list({charge:charge.id,limit:100});
  if(refunds.has_more)return review('refund_history_requires_review');
  let previous:Stripe.Refund|undefined;
  for(const refund of refunds.data){await recordRefund(refund,order,intent.id,deps);if(operationId(refund)===operation.id)previous=refund;}
  if(previous)return {order:await deps.rpc<OrderRecord>('order_record',{p_id:order.id})};
  if(refunds.data.some(refund=>['pending','requires_action'].includes(refund.status??'')))return review('another_refund_pending');
  const remaining=charge.amount-charge.amount_refunded;
  if(remaining===0)return {order:await deps.rpc<OrderRecord>('order_record',{p_id:order.id})};
  if(!Number.isSafeInteger(remaining)||remaining<0)return review('refund_amount_requires_review');
  // An old uncertain operation needs a human check instead of a new provider request.
  if(deps.now()-Date.parse(operation.created_at)>23*3600000)return review('refund_request_expired');
  const full=remaining===order.amountTotal;
  const prepared=await deps.rpc<any>('prepare_order_refund',{p_order_id:order.id,p_amount:remaining,p_merchandise:full?order.amountTotal-(order.shippingAmount??order.checkoutParameters.shippingAmount??0):null,p_shipping:full?(order.shippingAmount??order.checkoutParameters.shippingAmount??0):null});
  const refund=await stripe.refunds.create({payment_intent:intent.id,amount:prepared.refund_amount,metadata:{order_id:order.id,cancellation_id:operation.id}}, {idempotencyKey:`cancel-refund:${operation.id}`});
  return {order:await recordRefund(refund,order,intent.id,deps)};
 }catch(error){
  await deps.rpc('review_order_cancellation',{p_order_id:order.id,p_error:error instanceof HttpError?error.code:'provider_or_recording_failed'});
  throw new HttpError(503,'cancellation_needs_review');
 }
}

export async function syncRefundEvent(event:Stripe.Event,deps=refundDependencies){
 const config=paymentCredentials(deps.env),stripe=deps.stripe(config.key);
 let refundIds:string[]=[];let pi:string|undefined;
 if(event.type==='charge.refunded'){
  const charge=event.data.object as Stripe.Charge;pi=intentId(charge.payment_intent);
  const listed=await stripe.refunds.list({charge:charge.id,limit:100});
  if(listed.has_more)throw new HttpError(503,'refund_history_requires_review');
  refundIds=listed.data.map(refund=>refund.id);
 }else{const refund=event.data.object as Stripe.Refund;pi=intentId(refund.payment_intent);refundIds=[refund.id];}
 if(!pi)throw new HttpError(400,'refund_mismatch');
 let rows=await deps.select<{id:string}>('orders',{payment_intent_id:`eq.${pi}`,limit:'1'});
 if(!rows.length){
  const sessions=await stripe.checkout.sessions.list({payment_intent:pi,limit:2});
  const candidates=sessions.data.filter(session=>uuid(session.metadata?.order_id));
  if(candidates.length!==1)return; // A payment outside this storefront is not an order.
  const order=await deps.rpc<OrderRecord>('order_record',{p_id:candidates[0].metadata!.order_id});
  if(!order)return;
  sessionMatches(candidates[0],order,config.live);
  await deps.rpc('link_order_payment',{p_order_id:order.id,p_payment_intent:pi});rows=[{id:order.id}];
 }
 const order=await deps.rpc<OrderRecord>('order_record',{p_id:rows[0].id});
 for(const id of refundIds){const refund=await stripe.refunds.retrieve(id);await recordRefund(refund,order,pi,deps);}
}

export async function reconcileRefunds(deps=refundDependencies){
 const config=paymentCredentials(deps.env),stripe=deps.stripe(config.key);
 const refunds=await deps.select<{id:string;order_id:string;payment_intent_id:string}>('order_refunds',{status:'in.(pending,requires_action)',order:'updated_at.asc',limit:'2'});
 for(const row of refunds){const order=await deps.rpc<OrderRecord>('order_record',{p_id:row.order_id});await recordRefund(await stripe.refunds.retrieve(row.id),order,row.payment_intent_id,deps);}
 const operations=await deps.rpc<{order_id:string;reason:string;restock:Record<string,number>;actor:string}[]>('recoverable_order_cancellations',{});
 let recovered=0;
 for(const operation of operations){
  const order=await deps.rpc<OrderRecord>('order_record',{p_id:operation.order_id});
  if(!order||!['requested','review'].includes(order.cancellationStatus??'')||!order.checkoutSessionId)continue;
  const origin=deps.env('APP_ORIGIN');if(!origin)throw new HttpError(503,'payment_configuration_unavailable');
  const request=new Request(new URL('/api/admin/order-cancellations',origin),{method:'POST',headers:{origin}});
  await cancelOrder(request,{orderId:operation.order_id,reason:operation.reason,restock:operation.restock},{...deps,admin:async()=>operation.actor});recovered++;
 }
 return {checked:refunds.length,recovered};
}
