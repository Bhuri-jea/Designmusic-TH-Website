import type { APIRoute } from 'astro';
import { rpc } from '../../lib/server/supabase.ts';
export const prerender = false;
export const GET: APIRoute = async () => {
 try { const settings=await rpc<any>('storefront_config',{});const countries=settings?.allowed_countries??[];const servicesByCountry=Object.fromEntries(countries.map((code:string)=>[code,['ems_local','ems_world','flash'].filter(service=>Array.isArray(settings?.shipping_rates?.[`${code}:${service}`])&&settings.shipping_rates[`${code}:${service}`].length)]));return Response.json({countries,servicesByCountry,pickupEnabled:settings?.pickup_enabled===true},{headers:{'Cache-Control':'public, max-age=60'}}); }
 catch { return Response.json({countries:[],pickupEnabled:false},{status:503,headers:{'Cache-Control':'no-store'}}); }
};
