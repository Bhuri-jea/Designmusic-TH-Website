import type { Locale } from './catalog';

export const CATALOG_LOCALES = ['en','th','ja','zh-CN'] as const;
export type ProductLifecycle = 'draft'|'published'|'archived';
export type SkuLifecycle = 'active'|'archived';
export type SalesMode = 'checkout'|'reservation_only';
export type CatalogTranslation = { locale:Locale; name:string; badge:string; shortDescription:string; description:string };
export type CatalogImage = { url:string; alt:string; position:number; primary:boolean };
export type CatalogOptionValue = { id?:string; code:string; position:number; labels:Record<Locale,string>&Partial<Record<`${Locale}Description`,string>> };
export type CatalogOptionGroup = { id?:string; code:string; position:number; labels:Record<Locale,string>; values:CatalogOptionValue[] };
export type CatalogSku = { id?:string; sku:string; optionValueCodes:string[]; onHand:number; reserved:number; usd:number|null; jpy:number|null; thb:number|null; weightKg:number|null; salesMode:SalesMode; lifecycle:SkuLifecycle };
export type CatalogProduct = { id?:string; slug:string; collectionSlug:string|null; lifecycle:ProductLifecycle; translations:CatalogTranslation[]; images:CatalogImage[]; optionGroups:CatalogOptionGroup[]; skus:CatalogSku[] };

const clean=(value:unknown,max:number,required=true)=>typeof value==='string'&&(!required||value.trim())&&value.trim().length<=max&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)?value.trim():null;
const uuid=(value:unknown)=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)?value:undefined;
export function validateCatalogProduct(value:unknown, forPublication=false, allowedLocalImages:ReadonlySet<string>=new Set()):CatalogProduct {
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('invalid_catalog_product');
 const p={...value as any};
 if(p.collectionSlug==='')p.collectionSlug=null;
 if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(p.slug??'')||!['draft','published','archived'].includes(p.lifecycle)||p.collectionSlug!==null&&p.collectionSlug!==undefined&&!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(p.collectionSlug))throw Error('invalid_catalog_product');
 if(!Array.isArray(p.translations)||!Array.isArray(p.images)||!Array.isArray(p.optionGroups)||!Array.isArray(p.skus))throw Error('invalid_catalog_product');
 const translations=p.translations.map((row:any)=>({locale:row.locale,name:clean(row.name??'',160,false),badge:clean(row.badge??'',80,false)??'',shortDescription:clean(row.shortDescription??'',500,false),description:clean(row.description??'',10000,false)}));
 if(translations.some((r:any)=>!CATALOG_LOCALES.includes(r.locale)||r.name===null||r.shortDescription===null||r.description===null)||new Set(translations.map((r:any)=>r.locale)).size!==translations.length||CATALOG_LOCALES.some(locale=>!translations.some((r:any)=>r.locale===locale))||forPublication&&translations.some((r:any)=>!r.name||!r.shortDescription||!r.description))throw Error('incomplete_translations');
 const images=p.images.map((row:any,index:number)=>({url:clean(row.url,2048),alt:clean(row.alt??'',300,false)??'',position:index,primary:!!row.primary}));
 if(images.some((r:any)=>!r.url||!/^https:\/\//.test(r.url)&&!allowedLocalImages.has(r.url))||forPublication&&(images.length<1||images.filter((r:any)=>r.primary).length!==1))throw Error('invalid_catalog_images');
 const optionGroups=p.optionGroups.map((group:any,gi:number)=>({id:group.id,code:clean(group.code,64),position:gi,labels:group.labels,values:Array.isArray(group.values)?group.values.map((item:any,vi:number)=>({id:item.id,code:clean(item.code,64),position:vi,labels:item.labels})):[]}));
 if(optionGroups.some((g:any)=>!g.code||!g.labels||CATALOG_LOCALES.some(locale=>!clean(g.labels[locale],160))||g.values.some((v:any)=>!v.code||!v.labels||CATALOG_LOCALES.some(locale=>!clean(v.labels[locale],160)))))throw Error('invalid_catalog_options');
 const known=new Set(optionGroups.flatMap((g:any)=>g.values.map((v:any)=>v.code)));
 if(optionGroups.some((group:any)=>group.values.some((value:any)=>CATALOG_LOCALES.some(locale=>{const description=value.labels?.[`${locale}Description`];return description!=null&&(clean(description,240,false)===null||/[\r\n]/.test(description));}))))throw Error('invalid_catalog_options');
 if(known.size!==optionGroups.reduce((count:number,group:any)=>count+group.values.length,0))throw Error('invalid_catalog_options');
 const skus=p.skus.map((row:any)=>({id:row.id==null?undefined:uuid(row.id),sku:clean(row.sku,120),optionValueCodes:row.optionValueCodes,onHand:row.onHand,reserved:row.reserved??0,usd:row.usd,jpy:row.jpy,thb:row.thb,weightKg:row.weightKg,salesMode:row.salesMode,lifecycle:row.lifecycle}));
 if(skus.some((s:any,index:number)=>(p.skus[index].id!=null&&!s.id)||!s.sku||!Array.isArray(s.optionValueCodes)||new Set(s.optionValueCodes).size!==s.optionValueCodes.length||s.optionValueCodes.length!==optionGroups.length||optionGroups.some((group:any)=>s.optionValueCodes.filter((code:string)=>group.values.some((value:any)=>value.code===code)).length!==1)||!Number.isInteger(s.onHand)||s.onHand<0||!Number.isInteger(s.reserved)||s.reserved<0||s.reserved>s.onHand||!['checkout','reservation_only'].includes(s.salesMode)||!['active','archived'].includes(s.lifecycle)||s.salesMode==='checkout'&&(!Number.isFinite(s.usd)||s.usd<=0||!Number.isFinite(s.jpy)||s.jpy<=0||!Number.isFinite(s.thb)||s.thb<=0||!Number.isFinite(s.weightKg)||s.weightKg<=0)))throw Error('invalid_catalog_skus');
 if(new Set(skus.map((s:any)=>s.sku)).size!==skus.length||new Set(skus.map((s:any)=>[...s.optionValueCodes].sort().join('|'))).size!==skus.length||forPublication&&!skus.some((s:any)=>s.lifecycle==='active'))throw Error('invalid_catalog_skus');
 return {id:p.id,slug:p.slug,collectionSlug:p.collectionSlug??null,lifecycle:p.lifecycle,translations,images,optionGroups,skus};
}
