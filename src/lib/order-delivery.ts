import {WORKSHOP_MAP_URL} from './workshop.ts';
type DeliveryOrder={status:string;cancellationStatus?:string;fulfillmentMethod?:string|null;shipment?:{service?:string;trackingNumber?:string|null;trackingUrl?:string|null}|null};
const tracking:Record<string,string>={ems_local:'https://track.thailandpost.com',ems_world:'https://track.thailandpost.co.th/?lang=en',epacket:'https://track.thailandpost.co.th/?lang=en',flash:'https://www.flashexpress.com/fle/tracking'};
export function orderDelivery(order:DeliveryOrder){
 if(order.status!=='paid'||order.cancellationStatus==='cancelled')return null;
 const service=order.shipment?.service??order.fulfillmentMethod;
 if(!service)return null;
 if(service==='pickup')return {service,trackingNumber:null,url:WORKSHOP_MAP_URL};
 let url=tracking[service]??null;
 try{const supplied=new URL(order.shipment?.trackingUrl??'');if(supplied.protocol==='https:'&&!supplied.username&&!supplied.password)url=supplied.href;}catch{}
 return {service,trackingNumber:order.shipment?.trackingNumber?.trim()||null,url};
}
