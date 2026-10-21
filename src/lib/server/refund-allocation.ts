import { requireAdmin } from './admin.ts';
import { rpc, select, SupabaseRequestError } from './supabase.ts';
import { HttpError, readSameOriginJson, jsonResponse, errorResponse } from './http.ts';
type Refund = {id:string;order_id:string;currency:string;amount:number};
type Dependencies = {
 authorize:(request:Request)=>Promise<string>;
 list:()=>Promise<Refund[]>;
 find:(id:string)=>Promise<Refund|undefined>;
 save:(id:string,merchandise:number,shipping:number,actor:string)=>Promise<unknown>;
};
const defaults:Dependencies={
 authorize:requireAdmin,
 list:()=>select<Refund>('order_refunds',{select:'id,order_id,currency,amount',status:'eq.succeeded',merchandise_minor:'is.null',order:'created_at.asc',limit:'100'}),
 find:async id=>(await select<Refund>('order_refunds',{select:'id,order_id,currency,amount',id:`eq.${id}`,status:'eq.succeeded',limit:'1'}))[0],
 save:(id,merchandise,shipping,actor)=>rpc('admin_allocate_refund',{p_id:id,p_merchandise:merchandise,p_shipping:shipping,p_actor:actor}),
};
function minor(value:unknown,currency:string):number|null{
 if(typeof value!=='number'||!Number.isFinite(value)||value<0)return null;
 const scaled=value*(currency==='jpy'?1:100),rounded=Math.round(scaled);
 return Number.isSafeInteger(rounded)&&Math.abs(scaled-rounded)<=1e-8?rounded:null;
}
export function createRefundAllocationHandlers(deps:Dependencies=defaults){return {
 get:async(request:Request)=>{try{await deps.authorize(request);const rows=await deps.list();return jsonResponse({refunds:rows.map(({id,order_id,currency,amount})=>({id,order_id,currency,amount}))});}catch(error){return errorResponse(error);}},
 post:async(request:Request)=>{try{
  const actor=await deps.authorize(request),body=await readSameOriginJson(request);
  if(Object.keys(body).sort().join(',')!=='merchandise,refundId,shipping'||typeof body.refundId!=='string'||!/^re_[A-Za-z0-9_]{1,150}$/.test(body.refundId))throw new HttpError(400,'invalid_refund_allocation');
  const refund=await deps.find(body.refundId);if(!refund)throw new HttpError(404,'refund_not_found');
  const merchandise=minor(body.merchandise,refund.currency),shipping=minor(body.shipping,refund.currency);
  if(merchandise===null||shipping===null||merchandise+shipping!==refund.amount)throw new HttpError(400,'invalid_refund_allocation');
  await deps.save(refund.id,merchandise,shipping,actor);return jsonResponse({ok:true});
 }catch(error){if(error instanceof SupabaseRequestError&&error.databaseCode==='23514')return jsonResponse({error:'refund_allocation_changed'},409);return errorResponse(error);}},
};}
