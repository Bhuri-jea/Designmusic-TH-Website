import { quoteCart, quoteCartDetails, priceFor, type CartInput, type CartQuote, type Locale,type TrustedCatalogSku } from './catalog.ts';
type Lot = CartInput & { entryId: string };
type Attempt = {requestKey:string;locale:Locale;quote:CartQuote;lots:Lot[];orderId?:string;reconciled:boolean};
export type CartState = {version:1;items:Lot[];attempts:Attempt[]};
export const CART_STORAGE_KEY='designmusic.cart.v1';
const MAX_STORAGE_BYTES=1024*1024;
function bounded(state:CartState):CartState{if(new TextEncoder().encode(JSON.stringify(state)).byteLength>MAX_STORAGE_BYTES)throw Error('storage_limit');return state;}
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function canonical(value:unknown):string { if(Array.isArray(value))return `[${value.map(canonical).join(',')}]`; if(value && typeof value==='object')return `{${Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>`${JSON.stringify(k)}:${canonical(v)}`).join(',')}}`; return JSON.stringify(value); }
export function emptyCart():CartState { return {version:1,items:[],attempts:[]}; }
function validLot(value:any):value is Lot {
 if(!value || typeof value!=='object' || Object.keys(value).some(k=>!['entryId','productId','variant','options','quantity'].includes(k)) || !uuid.test(value.entryId) || !Number.isInteger(value.quantity) || value.quantity<1 || value.quantity>10)return false;
 if(value.productId==='saxophone-end-plug'&&priceFor(value.productId,value.variant,'en')!==undefined&&(value.options===undefined||value.options&&typeof value.options==='object'&&!Array.isArray(value.options)&&Object.keys(value.options).length===0))return true;
 if(value.productId==='shakuhachi'&&(!value.variant||value.variant==='standard')&&value.options&&typeof value.options==='object'&&!Array.isArray(value.options)&&Object.keys(value.options).sort().join(',')==='mouthpiece,toneHoles'&&['standard','large'].includes(value.options.toneHoles)&&['balance','traditional','modern'].includes(value.options.mouthpiece))return true;
 return typeof value.productId==='string'&&/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value.productId)&&typeof value.variant==='string'&&/^[A-Za-z0-9_-]{1,120}$/.test(value.variant)&&(value.options===undefined||value.options&&typeof value.options==='object'&&!Array.isArray(value.options)&&Object.keys(value.options).length<=12&&Object.entries(value.options).every(([key,item])=>/^[A-Za-z0-9_-]{1,64}$/.test(key)&&typeof item==='string'&&/^[A-Za-z0-9_-]{1,64}$/.test(item)));
}
export function restoreCart(raw:string|null):CartState {
 try {
  if(!raw || new TextEncoder().encode(raw).byteLength>MAX_STORAGE_BYTES)return emptyCart(); const value=JSON.parse(raw);
  if(value.version!==1 || Object.keys(value).sort().join(',')!=='attempts,items,version' || !Array.isArray(value.items) || value.items.length>100 || !value.items.every(validLot) || new Set(value.items.map((v:Lot)=>v.entryId)).size!==value.items.length || !Array.isArray(value.attempts) || value.attempts.length>30)return emptyCart();
  if(new Set(value.attempts.map((a:Attempt)=>a.requestKey)).size!==value.attempts.length)return emptyCart();
  for(const a of value.attempts){
   if(!a || Object.keys(a).some(k=>!['requestKey','locale','quote','lots','orderId','reconciled'].includes(k)) || !uuid.test(a.requestKey) || !['en','ja','th','zh-CN'].includes(a.locale) || typeof a.reconciled!=='boolean' || a.orderId!==undefined && !uuid.test(a.orderId) || !Array.isArray(a.lots) || !a.lots.length || a.lots.length>100 || !a.lots.every(validLot) || new Set(a.lots.map((lot:Lot)=>lot.entryId)).size!==a.lots.length || !a.quote || Object.keys(a.quote).sort().join(',')!=='currency,fingerprint,lines,totalAmount' || !/^[0-9a-f]{64}$/.test(a.quote.fingerprint))return emptyCart();
   const dynamic=a.lots.some((lot:Lot)=>!['saxophone-end-plug','shakuhachi'].includes(lot.productId));
   if(!dynamic){const expected=quoteCartDetails({items:cartItems({version:1,items:a.lots,attempts:[]}),locale:a.locale});if(canonical({currency:a.quote.currency,lines:a.quote.lines,totalAmount:a.quote.totalAmount})!==canonical(expected))return emptyCart();}
   else if(!Array.isArray(a.quote.lines)||!Number.isSafeInteger(a.quote.totalAmount)||a.quote.totalAmount<=0)return emptyCart();
  }
  cartItems(value); return value;
 } catch {return emptyCart();}
}
function inputKey(item:CartInput):string { return canonical({productId:item.productId,variant:item.productId==='shakuhachi'?'standard':item.variant??'',options:item.options??{}}); }
export function cartItems(state:CartState):CartInput[] {
 const items=new Map<string,CartInput>();
 for(const lot of state.items){const key=inputKey(lot); const quantity=(items.get(key)?.quantity??0)+lot.quantity;if(quantity>10)throw Error('quantity_limit');items.set(key,{productId:lot.productId,...(lot.variant?{variant:lot.variant}:{}),...(lot.options?{options:lot.options}:{}),quantity});}
 if(items.size>20)throw Error('cart_limit');return [...items.values()];
}
export function addCartItem(state:CartState,input:CartInput):CartState {
 const original={...input,entryId:crypto.randomUUID()};if(!validLot(original) || state.items.length>=100)throw Error('invalid_cart');
 const lot:Lot={productId:input.productId,variant:input.productId==='shakuhachi'?'standard':input.variant,quantity:input.quantity,entryId:original.entryId,...(input.options?{options:{...input.options}}:{})};
 const next={...state,items:[...state.items,lot]};cartItems(next);return bounded(next);
}
export function removeCartItem(state:CartState,input:CartInput):CartState {return {...state,items:state.items.filter(lot=>inputKey(lot)!==inputKey(input))};}
export function setCartQuantity(state:CartState,input:CartInput,quantity:number):CartState {
 if(!Number.isInteger(quantity)||quantity<0||quantity>10)throw Error('quantity_limit');
 const key=inputKey(input),current=cartItems(state).find(item=>inputKey(item)===key)?.quantity??0;
 if(quantity>current)return addCartItem(state,{productId:input.productId,...(input.variant?{variant:input.variant}:{}),...(input.options?{options:input.options}:{}),quantity:quantity-current});
 let remove=current-quantity;
 // Remove newest additions first so outstanding payment snapshots keep their lot identity.
 const items=state.items.map(lot=>({...lot}));
 for(let index=items.length-1;index>=0&&remove>0;index--){if(inputKey(items[index])!==key)continue;const count=Math.min(remove,items[index].quantity);items[index].quantity-=count;remove-=count;}
 return {...state,items:items.filter(lot=>lot.quantity>0)};
}
export async function submitCart(state:CartState,locale:Locale,catalogSkus?:TrustedCatalogSku[]) {
 state={...state,attempts:state.attempts.filter(a=>!a.reconciled)};
 const items=cartItems(state);const quote=await quoteCart({items,locale,...(catalogSkus?.length?{catalogSkus}: {})});
 let attempt=state.attempts.find(a=>!a.reconciled && a.locale===locale && a.quote.fingerprint===quote.fingerprint && canonical(a.lots)===canonical(state.items));
 if(!attempt){if(state.attempts.length>=30)throw Error('attempt_limit');attempt={requestKey:crypto.randomUUID(),locale,quote,lots:structuredClone(state.items),reconciled:false};state={...state,attempts:[...state.attempts,attempt]};}
 return {state:bounded(state),request:{requestKey:attempt.requestKey,locale,items}};
}
export function mergeCartSubmission(current:CartState,submitted:CartState,requestKey:string):CartState {
 const attempt=submitted.attempts.find(a=>a.requestKey===requestKey);
 if(!attempt)throw Error('unknown_submission');
 if(current.attempts.some(a=>a.requestKey===requestKey))return current;
 if(current.attempts.length>=30)throw Error('attempt_limit');
 return bounded({...current,attempts:[...current.attempts,attempt]});
}
export function bindOrder(state:CartState,key:string,id:string):CartState {
 if(!uuid.test(id))throw Error('invalid_order');
 if(!state.attempts.some(a=>a.requestKey===key && !a.reconciled))throw Error('unknown_submission');
 return {...state,attempts:state.attempts.map(a=>a.requestKey===key?{...a,orderId:id}:a)};
}
export function reconcilePaid(state:CartState,order:any):CartState {
 const attempt=state.attempts.find(a=>a.orderId===order?.id && !a.reconciled);
 if(!attempt || order.status!=='paid' || order.currency!==attempt.quote.currency || !Array.isArray(order.items) || !order.items.length)return state;
 if(!order.items.every((line:any)=>line&&Number.isSafeInteger(line.quantity)&&line.quantity>0&&Number.isSafeInteger(line.unitAmount)&&line.unitAmount>=0))return state;
 const subtotal=order.items.reduce((sum:number,line:any)=>sum+line.unitAmount*line.quantity,0);
 const shipping=order.shippingAmount??0;
 if(!Number.isSafeInteger(subtotal)||!Number.isSafeInteger(shipping)||shipping<0||order.amountTotal!==subtotal+shipping||(order.amountSubtotal!==undefined&&order.amountSubtotal!==subtotal))return state;
 // Prices belong to the server. Match purchased selections/quantities, not stale catalog prices.
 const selections=(lines:CartInput[])=>lines.map(line=>({key:inputKey(line),quantity:line.quantity})).sort((a,b)=>a.key.localeCompare(b.key));
 if(canonical(selections(order.items))!==canonical(selections(attempt.quote.lines)))return state;
 return consumeSubmittedCart(state,attempt.requestKey);
}
export function consumeSubmittedCart(state:CartState,requestKey:string):CartState {
 const attempt=state.attempts.find(a=>a.requestKey===requestKey&&!a.reconciled);
 if(!attempt)return state;
 const purchased=new Map(attempt.lots.map(lot=>[lot.entryId,lot]));
 return {...state,items:state.items.map(lot=>({...lot,quantity:Math.max(0,lot.quantity-(purchased.get(lot.entryId) && inputKey(purchased.get(lot.entryId)!)===inputKey(lot)?purchased.get(lot.entryId)!.quantity:0))})).filter(lot=>lot.quantity>0),attempts:state.attempts.map(a=>a===attempt?{...a,reconciled:true}:a)};
}
