import { type CartInput, type Locale, priceFor } from '../lib/catalog.ts';
import { CART_STORAGE_KEY, emptyCart, restoreCart, addCartItem, removeCartItem, cartItems, submitCart, mergeCartSubmission, bindOrder, reconcilePaid } from '../lib/cart-storage.ts';
class Cart {
 state=$state(emptyCart());
 locale=$state<Locale>('en');
 isOpen=$state(false);
 storageAvailable=$state(true);
 initialized=false;
 init(locale:Locale){this.locale=locale;if(this.initialized)return;this.initialized=true;try{this.state=restoreCart(localStorage.getItem(CART_STORAGE_KEY));}catch{this.storageAvailable=false;}}
 persist(){try{localStorage.setItem(CART_STORAGE_KEY,JSON.stringify($state.snapshot(this.state)));this.storageAvailable=true;}catch{this.storageAvailable=false;}}
 get items(){return cartItems(this.state).map(item=>({...item,name:item.productId==='shakuhachi'?'Shakuhachi S-1/D':'Saxophone End Plug',price:priceFor(item.productId,item.variant,this.locale)??0}));}
 get count(){return this.items.reduce((sum,item)=>sum+item.quantity,0);}
 get total(){return this.items.reduce((sum,item)=>sum+item.price*item.quantity,0);}
 add(item:CartInput){this.state=addCartItem($state.snapshot(this.state),item);this.persist();}
 remove(item:CartInput){this.state=removeCartItem($state.snapshot(this.state),item);this.persist();}
 async submit(locale:Locale){const submission=await submitCart($state.snapshot(this.state),locale);this.state=mergeCartSubmission($state.snapshot(this.state),submission.state,submission.request.requestKey);this.persist();if(!this.storageAvailable)throw Error('storage_unavailable');return submission.request;}
 bind(key:string,id:string){this.state=bindOrder($state.snapshot(this.state),key,id);this.persist();if(!this.storageAvailable)throw Error('storage_unavailable');}
 reconcile(order:unknown){this.state=reconcilePaid($state.snapshot(this.state),order);this.persist();}
}
export const cart=new Cart();
