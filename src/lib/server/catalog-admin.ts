import {CATALOG_LOCALES,validateCatalogProduct} from '../catalog-model';
import {requireAdmin} from './admin';
import {HttpError} from './http';
import {rpc,select} from './supabase';

export async function listCatalog(request:Request,search='',lifecycle=''){
 await requireAdmin(request);
 if(search.length>100||lifecycle&&!['draft','published','archived'].includes(lifecycle))throw new HttpError(400,'invalid_catalog_filter');
 const rows=await select<any>('catalog_products',{select:'id,slug,collection_slug,lifecycle,updated_at,catalog_product_translations(locale,name)',order:'updated_at.desc',limit:'500',...(lifecycle?{lifecycle:`eq.${lifecycle}`}:{})});
 const needle=search.trim().toLocaleLowerCase();
 return needle?rows.filter(row=>`${row.slug} ${(row.catalog_product_translations??[]).map((t:any)=>t.name).join(' ')}`.toLocaleLowerCase().includes(needle)):rows;
}
export async function createCatalogDraft(request:Request){await requireAdmin(request);return {id:await rpc<string>('admin_create_catalog_product',{})};}
export async function getCatalogProduct(request:Request,id:string){
 await requireAdmin(request);if(!/^[0-9a-f-]{36}$/i.test(id))throw new HttpError(400,'invalid_catalog_id');
 const [product]=await select<any>('catalog_products',{id:`eq.${id}`,limit:'1'});if(!product)throw new HttpError(404,'catalog_product_not_found');
 const [translations,images,groups,skus]=await Promise.all([
  select<any>('catalog_product_translations',{product_id:`eq.${id}`,order:'locale'}),select<any>('catalog_product_images',{product_id:`eq.${id}`,order:'position'}),
  select<any>('catalog_option_groups',{product_id:`eq.${id}`,order:'position'}),select<any>('inventory',{product_id:`eq.${id}`,order:'sku'})]);
 const groupIds=groups.map(row=>row.id);const values=groupIds.length?await select<any>('catalog_option_values',{group_id:`in.(${groupIds.join(',')})`,order:'position'}):[];
 return {id:product.id,slug:product.slug,collectionSlug:product.collection_slug,lifecycle:product.lifecycle,slugLocked:Boolean(product.published_at),
  translations:CATALOG_LOCALES.map(locale=>{const row=translations.find(item=>item.locale===locale);return{locale,name:row?.name??'',badge:row?.badge??'',shortDescription:row?.short_description??'',description:row?.description??''};}),
  images:images.map(row=>({url:row.url,alt:row.alt,position:row.position,primary:row.is_primary})),
  optionGroups:groups.map(group=>({id:group.id,code:group.code,position:group.position,labels:group.labels,values:values.filter(v=>v.group_id===group.id).map(v=>({id:v.id,code:v.code,position:v.position,labels:v.labels}))})),
  skus:skus.map(row=>({id:row.catalog_sku_id,sku:row.sku,optionValueCodes:values.filter(v=>(row.option_value_ids??[]).includes(v.id)).map(v=>v.code),onHand:row.on_hand,reserved:row.reserved,usd:row.price_usd_minor==null?null:row.price_usd_minor/100,jpy:row.price_jpy,thb:row.price_thb_minor==null?null:row.price_thb_minor/100,weightKg:row.weight_grams==null?null:row.weight_grams/1000,salesMode:row.sales_mode,lifecycle:row.lifecycle}))};
}
function validatedCatalog(payload:unknown,forPublication:boolean,allowedLocalImages:ReadonlySet<string>){
 try{return validateCatalogProduct(payload,forPublication,allowedLocalImages);}catch(error){const code=error instanceof Error&&/^[a-z_]+$/.test(error.message)?error.message:'invalid_catalog_product';throw new HttpError(400,code);}
}
export async function saveCatalogProduct(request:Request,id:string,payload:unknown){await requireAdmin(request);const existing=await getCatalogProduct(request,id),allowed=new Set(existing.images.filter((image:any)=>String(image.url).startsWith('/images/')).map((image:any)=>image.url));const product=validatedCatalog({...payload as object,id},existing.lifecycle==='published',allowed);const saved=await rpc<string>('admin_save_catalog_product',{p_payload:product});return {id:saved,product:await getCatalogProduct(request,saved)};}
export async function setCatalogLifecycle(request:Request,id:string,lifecycle:unknown){await requireAdmin(request);if(!['draft','published','archived'].includes(String(lifecycle)))throw new HttpError(400,'invalid_catalog_lifecycle');if(lifecycle==='published'){const product=await getCatalogProduct(request,id),allowed=new Set(product.images.filter((image:any)=>String(image.url).startsWith('/images/')).map((image:any)=>image.url));validatedCatalog(product,true,allowed);}await rpc('admin_set_catalog_lifecycle',{p_product_id:id,p_lifecycle:lifecycle});return {ok:true};}
