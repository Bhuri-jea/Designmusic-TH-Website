import { SHIPPING_MAX_GRAMS } from '../shipping-rates.ts';
import { quoteCart, type Currency } from '../catalog.ts';
import { HttpError } from './http.ts';
import { select, rpc } from './supabase.ts';
import { loadExchangeRates, convertPostage, type ExchangeRates } from './exchange-rates.ts';
import {trustedSkusFromInventory} from './catalog-trust.ts';

export type ShippingMethod = 'ems_local'|'ems_world'|'epacket'|'flash'|'pickup';
export type ShippingQuote = { currency:Currency;amount:number;weightGrams:number;method:ShippingMethod;country:string;subtotal:number;total:number;fxMarginApplied:boolean;referenceThbRate?:number|null;referenceFxDate?:string|null };
type ShippingDependencies = { config:()=>Promise<any>; inventory:()=>Promise<any[]>; exchangeRates:()=>Promise<ExchangeRates> };
const dependencies:ShippingDependencies={config:()=>rpc<any>('storefront_config',{}),inventory:()=>select<any>('inventory',{}),exchangeRates:loadExchangeRates};
export function requireShippingAddress(address:unknown,country:string){
 if(!address||typeof address!=='object'||Array.isArray(address))throw new HttpError(400,'shipping_address_required');
 const value=address as Record<string,unknown>;
 if(['line1','city','postal_code','country'].some(key=>typeof value[key]!=='string'||!(value[key] as string).trim()))throw new HttpError(400,'shipping_address_required');
 if(value.country!==country)throw new HttpError(400,'shipping_address_country_mismatch');
 return address as Record<string,string>;
}
export async function quoteShipping(items:unknown,locale:unknown,country:unknown,method:unknown,deps:ShippingDependencies=dependencies,address?:unknown):Promise<ShippingQuote>{
 if(typeof locale!=='string'||!['en','ja','zh-CN','th'].includes(locale)||typeof country!=='string'||!/^[A-Z]{2}$/.test(country)||!['ems_local','ems_world','epacket','flash','pickup'].includes(String(method)))throw new HttpError(400,'invalid_shipping');
 const cfg=await deps.config();
 const allowed:string[]=Array.isArray(cfg?.allowed_countries)?cfg.allowed_countries:[];
 if(!allowed.includes(country))throw new HttpError(400,'shipping_destination_unavailable');
 if(country!=='TH')requireShippingAddress(address,country);
 if(method==='pickup'&&(country!=='TH'||cfg.pickup_enabled!==true)||method==='ems_local'&&country!=='TH'||method==='flash'&&country!=='TH'||(method==='ems_world'||method==='epacket')&&country==='TH')throw new HttpError(400,'shipping_service_unavailable');
 const inventory=await deps.inventory();
 const prices:any={};for(const row of inventory){const price:any={};if(Number.isInteger(row.price_usd_minor))price.usd=row.price_usd_minor;if(Number.isInteger(row.price_jpy))price.jpy=row.price_jpy;if(Number.isInteger(row.price_thb_minor))price.thb=row.price_thb_minor;prices[row.sku]=price;}
 const quote=await quoteCart({items,locale,prices,catalogSkus:trustedSkusFromInventory(inventory,locale as any)});
 const unavailable=quote.lines.filter(item=>{const stock=inventory.find(row=>row.sku===item.sku);return !stock||!Number.isInteger(stock.on_hand)||!Number.isInteger(stock.reserved)||stock.on_hand-stock.reserved<item.quantity;}).map(item=>item.name);
 if(unavailable.length)throw new HttpError(409,'stock_unavailable',{items:unavailable});
 if(method==='pickup')return{currency:quote.currency,amount:0,weightGrams:0,method:'pickup' as const,country,subtotal:quote.totalAmount,total:quote.totalAmount,fxMarginApplied:false};
 const weights=new Map(inventory.map(row=>[row.sku,row.weight_grams]));
 let weightGrams=0;
 for(const item of quote.lines){const weight=weights.get(item.sku);if(!Number.isInteger(weight)||weight<=0)throw new HttpError(400,'product_weight_unconfigured');weightGrams+=weight*item.quantity;}
 if(weightGrams>SHIPPING_MAX_GRAMS)throw new HttpError(400,'shipping_contact_required');
 const bands=cfg.shipping_rates?.[`${country}:${method}`];
 if(!Array.isArray(bands)||!bands.length)throw new HttpError(400,'shipping_rate_unconfigured');
 const valid=bands.every((band:any)=>Number.isInteger(band.maxGrams)&&band.maxGrams>0&&band.maxGrams<=30000&&(band.thbMinor===null||Number.isSafeInteger(band.thbMinor)&&band.thbMinor>0));
 if(!valid)throw new HttpError(503,'shipping_rate_unconfigured');
 const ordered=[...bands].sort((a:any,b:any)=>a.maxGrams-b.maxGrams);
 if(new Set(ordered.map((b:any)=>b.maxGrams)).size!==ordered.length||ordered.some((b:any,i:number)=>i&&b.maxGrams<=ordered[i-1].maxGrams))throw new HttpError(503,'shipping_rate_unconfigured');
 const band=ordered.find((value:any)=>weightGrams<=value.maxGrams);if(!band)throw new HttpError(400,'shipping_weight_uncovered');
 if(band.thbMinor===null)throw new HttpError(400,'shipping_service_unavailable');
 const thbMinor=country==='TH'?band.thbMinor:Math.max(50000,band.thbMinor);
 const fx=quote.currency==='thb'?undefined:await deps.exchangeRates();
 const amount=convertPostage(thbMinor,quote.currency,fx);
 return{currency:quote.currency,amount,weightGrams,method:method as ShippingMethod,country,subtotal:quote.totalAmount,total:quote.totalAmount+amount,fxMarginApplied:quote.currency!=='thb',referenceThbRate:quote.currency==='thb'?1:quote.currency==='usd'?fx!.usdThb:fx!.jpyThb,referenceFxDate:fx?.date??null};
}
