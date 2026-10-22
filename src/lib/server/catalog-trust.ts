import type {Locale,TrustedCatalogSku} from '../catalog';
export function trustedSkusFromInventory(rows:any[],_locale:Locale):TrustedCatalogSku[]|undefined{
 if(!rows.some(row=>row.product_id))return undefined;
 return rows.filter(row=>row.product_id&&row.product_slug).map(row=>({sku:row.sku,productSlug:row.product_slug,optionCodes:Array.isArray(row.option_codes)?row.option_codes:[],name:typeof row.product_name==='string'?row.product_name:row.product_slug,salesMode:row.sales_mode,productLifecycle:row.product_lifecycle,skuLifecycle:row.lifecycle,prices:{usd:row.price_usd_minor,jpy:row.price_jpy,thb:row.price_thb_minor}}));
}
