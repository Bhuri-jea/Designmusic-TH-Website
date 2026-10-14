import test from 'node:test';
import assert from 'node:assert/strict';

test('pending submission preserves later live cart edits while sending its captured snapshot',async()=>{
 const state=(value:unknown)=>value;
 (state as any).snapshot=structuredClone;
 (globalThis as any).$state=state;
 const storage=new Map<string,string>();
 (globalThis as any).localStorage={getItem:(key:string)=>storage.get(key)??null,setItem:(key:string,value:string)=>{storage.set(key,value);}};
 const {cart}=await import('../src/store/cart.svelte.ts');
 cart.init('en');
 cart.add({productId:'saxophone-end-plug',variant:'plain',quantity:1});
 const pending=cart.submit('en');
 cart.add({productId:'saxophone-end-plug',variant:'custom',quantity:1});
 const request=await pending;
 assert.deepEqual(request.items.map(item=>item.variant),['plain']);
 assert.deepEqual(cart.items.map(item=>item.variant),['plain','custom']);
 assert.deepEqual(JSON.parse(storage.get('designmusic.cart.v1')!).items.map((item:any)=>item.variant),['plain','custom']);
});
