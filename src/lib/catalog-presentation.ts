import type {CartInput} from './catalog.ts';
export type OptionStyle = 'buttons'|'dropdown'|'radio';
export type CustomerReview = {name:string;rating:number;impression:string};
export const PRODUCT_SECTIONS = ['badge','name','description','options','price','availability','quantity','purchase','reviews'] as const;
export type ProductSection=typeof PRODUCT_SECTIONS[number];
export const DEFAULT_PRODUCT_LAYOUT:ProductSection[][]=PRODUCT_SECTIONS.map(section=>[section]);
export type ProductPresentation = {optionStyles:Record<string,OptionStyle>;reviews:CustomerReview[];layout?:ProductSection[][]};

export function productLifecycleActions(state:string):string[]{
 return state==='published'?['unpublish','archive']:state==='archived'?['restore']:['publish','archive'];
}

export function validatePresentation(value:unknown,groupCodes:readonly string[]):ProductPresentation {
 if(value===undefined)return {optionStyles:{},reviews:[]};
 const invalid=()=>{throw Error('invalid_catalog_presentation');};
 if(!value||typeof value!=='object'||Array.isArray(value))return invalid();
 const data=value as Record<string,unknown>,styles=data.optionStyles??{},reviews=data.reviews??[];
 if(!styles||typeof styles!=='object'||Array.isArray(styles)||!Array.isArray(reviews)||reviews.length>50)return invalid();
 const entries=Object.entries(styles);
 if(entries.some(([code,style])=>!groupCodes.includes(code)||!['buttons','dropdown','radio'].includes(String(style))))return invalid();
 const text=(input:unknown,max:number)=>typeof input==='string'&&input.trim().length>0&&input.trim().length<=max&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(input)?input.trim():invalid();
 if(data.layout!==undefined){
  if(!Array.isArray(data.layout)||data.layout.some(row=>!Array.isArray(row)||row.length<1||row.length>2))return invalid();
  const sections=data.layout.flat();
  if(sections.length!==PRODUCT_SECTIONS.length||new Set(sections).size!==PRODUCT_SECTIONS.length||sections.some(section=>!PRODUCT_SECTIONS.includes(section)))return invalid();
 }
 return {...(data.layout?{layout:(data.layout as ProductSection[][]).map(row=>[...row])}:{}),optionStyles:Object.fromEntries(entries) as Record<string,OptionStyle>,reviews:reviews.map(row=>{
  if(!row||typeof row!=='object'||Array.isArray(row)||!Number.isInteger(row.rating)||row.rating<1||row.rating>5)return invalid();
  return {name:text(row.name,120),rating:row.rating,impression:text(row.impression,2000)};
 })};
}

export function remainingPurchaseQuantity(onHand:number,reserved:number,inCart:number):number {
 if(![onHand,reserved,inCart].every(value=>Number.isSafeInteger(value)&&value>=0))return 0;
 return Math.max(0,Math.min(10-inCart,onHand-reserved-inCart));
}

export function quantityForSku(items:readonly CartInput[],productSlug:string,sku:string,optionCodes:readonly string[]):number {
 return items.filter(item=>{
  if(item.productId!==productSlug)return false;
  if(item.variant===sku)return true;
  const codes=Object.values(item.options??{});
  if(codes.length)return codes.length===optionCodes.length&&optionCodes.every(code=>codes.includes(code));
  return optionCodes.length===1&&item.variant===optionCodes[0];
 }).reduce((total,item)=>total+item.quantity,0);
}
