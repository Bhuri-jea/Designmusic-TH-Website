import {requireAdmin} from './admin.ts';
import {getEnv} from './env.ts';
import {assertSameOrigin,errorResponse,HttpError,jsonResponse} from './http.ts';
const MAX_IMAGE_BYTES=4194304;
type Dependencies={authorize:(request:Request)=>Promise<unknown>;upload:(bytes:Uint8Array,type:string)=>Promise<string>};
export async function storeProductImage(bytes:Uint8Array,type:string):Promise<string>{
 const base=getEnv('SUPABASE_URL')?.replace(/\/$/,''),key=getEnv('SUPABASE_SECRET_KEY')??getEnv('SUPABASE_SERVICE_ROLE_KEY');
 if(!base||!key)throw new HttpError(503,'image_storage_unavailable');
 const extension=type==='image/jpeg'?'jpg':type==='image/png'?'png':'webp',path=`${crypto.randomUUID()}.${extension}`;
 const response=await fetch(`${base}/storage/v1/object/product-images/${path}`,{method:'POST',headers:{apikey:key,...(!key.startsWith('sb_secret_')?{authorization:`Bearer ${key}`}:{}) ,'content-type':type,'cache-control':'31536000','x-upsert':'false'},body:bytes as BodyInit,signal:AbortSignal.timeout(20000)});
 if(!response.ok)throw new HttpError(503,'image_storage_unavailable');
 return `${base}/storage/v1/object/public/product-images/${path}`;
}
export function createImageUploadHandler(deps:Dependencies={authorize:requireAdmin,upload:storeProductImage}){
 return async(request:Request)=>{try{
  assertSameOrigin(request);await deps.authorize(request);
  const type=request.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
  if(!type||!['image/jpeg','image/png','image/webp'].includes(type))throw new HttpError(400,'invalid_product_image');
  if(Number(request.headers.get('content-length')??0)>MAX_IMAGE_BYTES)throw new HttpError(413,'product_image_too_large');
  const reader=request.body?.getReader();if(!reader)throw new HttpError(400,'invalid_product_image');
  const chunks:Uint8Array[]=[];let size=0;
  try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>MAX_IMAGE_BYTES){await reader.cancel();throw new HttpError(413,'product_image_too_large');}chunks.push(value);}}finally{reader.releaseLock();}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  const detected=bytes[0]===255&&bytes[1]===216&&bytes[2]===255?'image/jpeg':bytes.length>=8&&[137,80,78,71,13,10,26,10].every((value,index)=>bytes[index]===value)?'image/png':bytes.length>=12&&String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP'?'image/webp':null;
  if(detected!==type)throw new HttpError(400,'invalid_product_image');
  return jsonResponse({url:await deps.upload(bytes,type)},201);
 }catch(error){return errorResponse(error);}};
}
