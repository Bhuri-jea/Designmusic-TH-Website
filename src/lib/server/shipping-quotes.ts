import { quoteCart } from '../catalog.ts';
import { bookingUuid } from '../booking.ts';
import { requireCustomer, type Customer } from './customer.ts';
import { requireAdmin } from './admin.ts';
import { HttpError } from './http.ts';
import { rpc, select } from './supabase.ts';
import { checkout } from './payments.ts';
import { quoteShipping } from './shipping.ts';
import { convertPostage, loadExchangeRates, type ExchangeRates } from './exchange-rates.ts';

type Dependencies = {
 customer:(request:Request)=>Promise<Customer>;
 admin:(request:Request)=>Promise<string>;
 rpc:typeof rpc;
 inventory:()=>Promise<any[]>;
 config:()=>Promise<any>;
 pay:typeof checkout;
 now:()=>number;
 exchangeRates?:()=>Promise<ExchangeRates>;
};
const defaults:Dependencies={customer:requireCustomer,admin:requireAdmin,rpc,inventory:()=>select<any>('inventory',{}),config:()=>rpc<any>('storefront_config',{}),pay:checkout,now:Date.now,exchangeRates:loadExchangeRates};

export function publicShippingQuote(row:any) {
 const keys=['id','requestKey','status','currency','locale','amountSubtotal','shippingAmount','amountTotal','weightGrams','country','items','address','createdAt','expiresAt','orderId','orderStatus','linkedOrderCancellationStatus','linkedOrderRefundStatus','linkedOrderRefundedAmount','sellerNote','shippingService'];
 return Object.fromEntries(keys.map(key=>[key,row[key]??null]));
}
async function ownedQuote(request:Request,id:unknown,deps:Dependencies) {
 const customer=await deps.customer(request);
 if(!bookingUuid(id))throw new HttpError(400,'invalid_shipping_quote');
 const quote=await deps.rpc<any>('shipping_quote_record',{p_id:id});
 if(!quote||quote.customerId!==customer.id)throw new HttpError(404,'shipping_quote_not_found');
 return quote;
}
export async function customerShippingQuotes(request:Request,deps=defaults){
 const customer=await deps.customer(request);
 const rows=await deps.rpc<any[]>('customer_shipping_quotes',{p_customer_id:customer.id});
 return (rows??[]).map(publicShippingQuote);
}
export async function requestShippingQuote(request:Request,body:Record<string,unknown>,deps=defaults) {
 const customer=await deps.customer(request);
 if(Object.keys(body).some(key=>!['country','items','locale','requestKey','method'].includes(key))||!bookingUuid(body.requestKey)||typeof body.country!=='string'||!/^[A-Z]{2}$/.test(body.country))throw new HttpError(400,'invalid_shipping_quote');
 const method=body.method??(body.country==='TH'?'ems_local':'epacket');
 if(!(body.country==='TH'?['ems_local','flash']:['epacket','ems_world']).includes(String(method)))throw new HttpError(400,'invalid_shipping_quote');
 const address=customer.shippingAddress;
 if(!address||['line1','city','postal_code','country'].some(key=>typeof (address as any)[key]!=='string'||!(address as any)[key].trim())||!customer.name?.trim())throw new HttpError(400,'shipping_address_required');
 if(address.country!==body.country)throw new HttpError(400,'shipping_address_country_mismatch');
 const config=await deps.config();
 if(!config?.allowed_countries?.includes(body.country))throw new HttpError(400,'shipping_destination_unavailable');
 const inventory=await deps.inventory();
 const prices:any=Object.fromEntries(inventory.map(row=>[row.sku,{usd:row.price_usd_minor,jpy:row.price_jpy,thb:row.price_thb_minor}]));
 let cart:Awaited<ReturnType<typeof quoteCart>>;
 try{cart=await quoteCart({items:body.items,locale:body.locale,prices});}catch{throw new HttpError(400,'invalid_cart');}
 let grams=0;
 for(const line of cart.lines){const stock=inventory.find(row=>row.sku===line.sku);if(!stock||!Number.isInteger(stock.on_hand)||!Number.isInteger(stock.reserved)||stock.on_hand-stock.reserved<line.quantity)throw new HttpError(409,'stock_unavailable');const weight=stock.weight_grams;if(!Number.isInteger(weight)||weight<=0)throw new HttpError(400,'product_weight_unconfigured');grams+=weight*line.quantity;}
 if(grams<=2000){
  try{await quoteShipping(body.items,'th',body.country,method,{config:async()=>config,inventory:async()=>inventory,exchangeRates:loadExchangeRates},address);}
  catch(error){if(error instanceof HttpError&&['shipping_rate_unconfigured','shipping_weight_uncovered','shipping_service_unavailable'].includes(error.code)){/* seller quote required */}else throw error;
   return createRequest();}
  throw new HttpError(400,'shipping_quote_not_required');
 }
 return createRequest();
 async function createRequest(){
 const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify([cart.fingerprint,body.country,address,method])));
 const fingerprint=Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('');
 const row=await deps.rpc<any>('create_shipping_quote',{
  p_customer_id:customer.id,p_request_key:body.requestKey,p_fingerprint:fingerprint,p_cart_fingerprint:cart.fingerprint,
  p_currency:cart.currency,p_locale:body.locale,p_items:cart.lines,p_subtotal:cart.totalAmount,
  p_weight_grams:grams,p_country:body.country,p_address:address,p_recipient:{name:customer.name},
 });
 if(row?.customerId!==customer.id)throw new HttpError(409,'shipping_quote_conflict');
 return publicShippingQuote(row);
 }
}
export async function adminShippingQuotes(request:Request,deps=defaults){
 await deps.admin(request);
 const rows=await deps.rpc<any[]>('admin_shipping_quotes',{});
 return (rows??[]).map(row=>({...publicShippingQuote(row),customerName:row.customerName,customerEmail:row.customerEmail}));
}
export async function approveShippingQuote(request:Request,body:Record<string,unknown>,deps=defaults){
 const actor=await deps.admin(request);
 if(Object.keys(body).sort().join(',')!=='note,quoteId,shippingThb'||!bookingUuid(body.quoteId)||typeof body.shippingThb!=='number'||!Number.isFinite(body.shippingThb)||body.shippingThb<=0||body.shippingThb>1000000||Math.abs(body.shippingThb*100-Math.round(body.shippingThb*100))>0.000001||typeof body.note!=='string'||body.note.length>1000)throw new HttpError(400,'invalid_shipping_quote');
 const quote=await deps.rpc<any>('shipping_quote_record',{p_id:body.quoteId});
 if(!quote)throw new HttpError(404,'shipping_quote_not_found');
 if(quote.orderId||quote.status==='cancelled'||Date.parse(quote.expiresAt)<=deps.now())throw new HttpError(409,'shipping_quote_not_editable');
 const thbMinor=Math.round(body.shippingThb*100);
 const rates=quote.currency==='thb'?undefined:await(deps.exchangeRates??loadExchangeRates)();
 const amount=convertPostage(thbMinor,quote.currency,rates);
 if(quote.country!=='TH'&&thbMinor<50000)throw new HttpError(400,'international_shipping_minimum');
 const saved=await deps.rpc<any>('admin_approve_shipping_quote_v2',{p_id:quote.id,p_shipping_amount:amount,p_shipping_thb_minor:thbMinor,p_note:body.note.trim(),p_actor:actor,p_reference_thb_rate:quote.currency==='thb'?1:quote.currency==='usd'?rates!.usdThb:rates!.jpyThb,p_reference_fx_date:rates?.date??null});
 return publicShippingQuote(saved);
}
export async function checkoutShippingQuote(request:Request,body:Record<string,unknown>,deps=defaults){
 if(Object.keys(body).join(',')!=='quoteId')throw new HttpError(400,'invalid_shipping_quote');
 const quote=await ownedQuote(request,body.quoteId,deps);
 if(quote.status!=='quoted'||Date.parse(quote.expiresAt)<=deps.now())throw new HttpError(409,'shipping_quote_not_ready');
 return deps.pay(request,{
  requestKey:quote.id,locale:quote.locale,
  items:quote.items.map((item:any)=>({productId:item.productId,variant:item.variant,options:item.options,quantity:item.quantity})),
  shippingCountry:quote.country,shippingMethod:quote.shippingService,quoteId:quote.id,
 });
}
export async function cancelShippingQuote(request:Request,body:Record<string,unknown>,deps=defaults){
 if(Object.keys(body).join(',')!=='quoteId')throw new HttpError(400,'invalid_shipping_quote');
 const quote=await ownedQuote(request,body.quoteId,deps);
 if(quote.orderId)throw new HttpError(409,'shipping_quote_payment_started');
 const saved=await deps.rpc<any>('cancel_shipping_quote',{p_id:quote.id,p_customer_id:quote.customerId});
 return publicShippingQuote(saved);
}

export async function declineShippingQuote(request:Request,body:Record<string,unknown>,deps=defaults){
 const actor=await deps.admin(request);
 if(Object.keys(body).sort().join(',')!=='quoteId,reason'||!bookingUuid(body.quoteId)||typeof body.reason!=='string'||!body.reason.trim()||body.reason.length>1000)throw new HttpError(400,'invalid_shipping_quote');
 const quote=await deps.rpc<any>('shipping_quote_record',{p_id:body.quoteId});
 if(!quote)throw new HttpError(404,'shipping_quote_not_found');
 if(quote.orderId||quote.status==='cancelled'||Date.parse(quote.expiresAt)<=deps.now())throw new HttpError(409,'shipping_quote_not_editable');
 return publicShippingQuote(await deps.rpc<any>('admin_decline_shipping_quote',{p_id:quote.id,p_reason:body.reason.trim(),p_actor:actor}));
}
