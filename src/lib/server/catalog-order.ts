import {jsonResponse,errorResponse,readSameOriginJson,HttpError} from './http.ts';
import {requireAdmin} from './admin.ts';
import {select,rpc,SupabaseRequestError} from './supabase.ts';
export const CATALOG_PRODUCT_ORDER='display_order.asc,created_at.asc,id.asc';
export function orderedPublishedProducts(filters:Record<string,string>={}){
 return select<any>('catalog_products',{...filters,lifecycle:'eq.published',order:CATALOG_PRODUCT_ORDER});
}
type Dependencies={authorize:(request:Request)=>Promise<unknown>;load:()=>Promise<any[]>;save:(ids:string[],expectedIds:string[])=>Promise<unknown>};
const defaults:Dependencies={authorize:requireAdmin,load:()=>orderedPublishedProducts({select:'id,slug,catalog_product_translations(locale,name)',limit:'501'}),save:(ids,expectedIds)=>rpc('admin_reorder_catalog_products',{p_product_ids:ids,p_expected_ids:expectedIds})};
function ids(value:unknown):string[]{
 if(!Array.isArray(value)||value.length>500||value.some(id=>typeof id!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)))throw new HttpError(400,'invalid_catalog_order');
 const result=value.map(id=>id.toLowerCase());if(new Set(result).size!==result.length)throw new HttpError(400,'invalid_catalog_order');return result;
}
export function createCatalogOrderHandlers(deps:Dependencies=defaults){
 return {
  get:async(request:Request)=>{try{await deps.authorize(request);const products=await deps.load();if(products.length>500)throw new HttpError(503,'catalog_order_unavailable');return jsonResponse({products});}catch(error){return errorResponse(error);}},
  put:async(request:Request)=>{try{
   await deps.authorize(request);const body=await readSameOriginJson(request,50000);
   if(Object.keys(body).sort().join(',')!=='expectedIds,ids')throw new HttpError(400,'invalid_catalog_order');
   const next=ids(body.ids),expected=ids(body.expectedIds);
   if(next.length!==expected.length||next.some(id=>!expected.includes(id)))throw new HttpError(400,'invalid_catalog_order');
   try{await deps.save(next,expected);}catch(error){if(error instanceof SupabaseRequestError&&['40001','23514'].includes(error.databaseCode??''))throw new HttpError(409,'catalog_order_changed');throw error;}
   return jsonResponse({ok:true});
  }catch(error){return errorResponse(error);}}
 };
}
