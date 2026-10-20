import { quoteCart, type Currency, type Locale } from '../catalog.ts';
import { HttpError } from './http.ts';
import { select, rpc } from './supabase.ts';

export type ShippingMethod = 'ems_local'|'ems_world'|'flash'|'pickup';
export async function quoteShipping(items:unknown,locale:unknown,country:unknown,method:unknown){
 if(typeof locale!=='string'||!['en','ja','zh-CN','th'].includes(locale)||typeof country!=='string'||!/^[A-Z]{2}$/.test(country)||!['ems_local','ems_world','flash','pickup'].includes(String(method)))throw new HttpError(400,'invalid_shipping');
 const cfg=await rpc<any>('storefront_config',{});
 const allowed:string[]=Array.isArray(cfg?.allowed_countries)?cfg.allowed_countries:[];
 if(!allowed.includes(country))throw new HttpError(400,'shipping_destination_unavailable');
 if(method==='pickup'&&(country!=='TH'||cfg.pickup_enabled!==true)||method==='ems_local'&&country!=='TH'||method==='flash'&&country!=='TH'||method==='ems_world'&&country==='TH')throw new HttpError(400,'shipping_service_unavailable');
 const inventory=await select<any>('inventory',{});
 const prices:any={};for(const row of inventory){const price:any={};if(Number.isInteger(row.price_usd_minor))price.usd=row.price_usd_minor;if(Number.isInteger(row.price_jpy))price.jpy=row.price_jpy;if(Number.isInteger(row.price_thb_minor))price.thb=row.price_thb_minor;prices[row.sku]=price;}
 const quote=await quoteCart({items,locale,prices});
 if(method==='pickup')return{currency:quote.currency,amount:0,weightGrams:0,method:'pickup' as const,country,subtotal:quote.totalAmount,total:quote.totalAmount,fxMarginApplied:false};
 const weights=new Map(inventory.map(row=>[row.sku,row.weight_grams]));
 let weightGrams=0;
 for(const item of quote.lines){const weight=weights.get(item.sku);if(!Number.isInteger(weight)||weight<=0)throw new HttpError(400,'product_weight_unconfigured');weightGrams+=weight*item.quantity;}
 if(weightGrams>30000)throw new HttpError(400,'parcel_too_heavy');
 const bands=cfg.shipping_rates?.[`${country}:${method}`];
 if(!Array.isArray(bands)||!bands.length)throw new HttpError(400,'shipping_rate_unconfigured');
 const valid=bands.every((band:any)=>Number.isInteger(band.maxGrams)&&band.maxGrams>0&&band.maxGrams<=30000&&Number.isInteger(band.thbMinor)&&band.thbMinor>=0);
 if(!valid)throw new HttpError(503,'shipping_rate_unconfigured');
 const ordered=[...bands].sort((a:any,b:any)=>a.maxGrams-b.maxGrams);
 if(new Set(ordered.map((b:any)=>b.maxGrams)).size!==ordered.length||ordered.some((b:any,i:number)=>i&&b.maxGrams<=ordered[i-1].maxGrams))throw new HttpError(503,'shipping_rate_unconfigured');
 const band=ordered.find((value:any)=>weightGrams<=value.maxGrams);if(!band)throw new HttpError(400,'shipping_weight_uncovered');
 const major=band.thbMinor/100;let amount:number;
 if(quote.currency==='thb')amount=band.thbMinor;
 else if(quote.currency==='usd'&&Number(cfg.usd_thb)>0)amount=Math.ceil(major*1.05/Number(cfg.usd_thb)*100);
 else if(quote.currency==='jpy'&&Number(cfg.jpy_thb)>0)amount=Math.ceil(major*1.05/Number(cfg.jpy_thb));
 else throw new HttpError(503,'shipping_fx_unconfigured');
 return{currency:quote.currency,amount,weightGrams,method:method as ShippingMethod,country,subtotal:quote.totalAmount,total:quote.totalAmount+amount,fxMarginApplied:quote.currency!=='thb'};
}
