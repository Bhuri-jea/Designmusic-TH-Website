<script lang="ts">
 import {onMount} from 'svelte';
 import {ArrowUp,ArrowDown} from 'lucide-svelte';
 let {lang='en',onSaved}=$props<{lang?:'en'|'th';onSaved?:()=>Promise<void>}>();
 type Product={id:string;slug:string;catalog_product_translations?:{locale:string;name:string}[]};
 let products=$state<Product[]>([]),saved=$state<Product[]>([]),loaded=$state(false),loading=$state(false),saving=$state(false),conflicted=$state(false),message=$state('');
 const say=(en:string,th:string)=>lang==='th'?th:en;
 const name=(product:Product)=>product.catalog_product_translations?.find(t=>t.locale===lang)?.name||product.catalog_product_translations?.find(t=>t.locale==='en')?.name||product.slug;
 const dirty=$derived(products.map(p=>p.id).join(',')!==saved.map(p=>p.id).join(','));
 async function load(){
  if(loading||saving)return;loading=true;message='';
  try{const response=await fetch('/api/admin/catalog/order',{cache:'no-store'});if(!response.ok)throw Error();const data=await response.json();products=data.products;saved=[...products];loaded=true;conflicted=false;}
  catch{message=say('Could not load product order. Try reloading.','โหลดลำดับสินค้าไม่สำเร็จ โปรดลองโหลดใหม่');}finally{loading=false;}
 }
 function move(index:number,direction:-1|1){const target=index+direction;if(loading||saving||target<0||target>=products.length)return;const next=[...products];[next[index],next[target]]=[next[target],next[index]];products=next;if(!conflicted)message='';}
 async function save(){
  if(!dirty||loading||saving||conflicted)return;saving=true;message='';
  try{
   const response=await fetch('/api/admin/catalog/order',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({ids:products.map(p=>p.id),expectedIds:saved.map(p=>p.id)})});
   if(!response.ok){conflicted=response.status===409;throw Error();}
   saved=[...products];message=say('Product order saved.','บันทึกลำดับสินค้าแล้ว');await onSaved?.();
  }catch{message=conflicted?say('The catalog changed. Reload the current order, then arrange it again.','รายการสินค้ามีการเปลี่ยนแปลง โปรดโหลดลำดับปัจจุบันแล้วจัดเรียงใหม่'):say('Could not save the order. Your arrangement is kept; try again.','บันทึกลำดับไม่สำเร็จ ลำดับที่จัดไว้ยังอยู่ โปรดลองอีกครั้ง');}finally{saving=false;}
 }
 onMount(()=>{const warn=(event:BeforeUnloadEvent)=>{if(dirty){event.preventDefault();event.returnValue='';}};addEventListener('beforeunload',warn);return()=>removeEventListener('beforeunload',warn);});
</script>

<details class="product-order" ontoggle={event=>{if(event.currentTarget.open&&!loaded)void load();}}>
 <summary>{say('Arrange product order','จัดลำดับสินค้า')}</summary>
 <p class="order-help">{say('Move published products up or down, then save. This order is used on the product list and category views in every language. Newly published products appear at the end.','เลื่อนสินค้าที่เผยแพร่ขึ้นหรือลงแล้วกดบันทึก ลำดับนี้ใช้กับหน้ารายการสินค้าและหมวดหมู่ทุกภาษา สินค้าที่เผยแพร่ใหม่จะแสดงท้ายรายการ')}</p>
 {#if loading}<p role="status">{say('Loading…','กำลังโหลด…')}</p>{/if}
 <ol aria-label={say('Published product order','ลำดับสินค้าที่เผยแพร่')}>
  {#each products as product,index (product.id)}<li><span class="order-number">{index+1}</span><span class="order-name">{name(product)}</span><div class="order-buttons">
   <button type="button" class="btn" disabled={index===0||loading||saving} aria-label={`${say('Move up:','เลื่อนขึ้น:')} ${name(product)}`} onclick={()=>move(index,-1)}><ArrowUp size={18} aria-hidden="true"/></button>
   <button type="button" class="btn" disabled={index===products.length-1||loading||saving} aria-label={`${say('Move down:','เลื่อนลง:')} ${name(product)}`} onclick={()=>move(index,1)}><ArrowDown size={18} aria-hidden="true"/></button>
  </div></li>{/each}
 </ol>
 {#if loaded&&!products.length}<p>{say('Publish a product to arrange it here.','เผยแพร่สินค้าเพื่อจัดลำดับที่นี่')}</p>{/if}
 <div class="order-actions"><button class="btn" type="button" disabled={!dirty||loading||saving||conflicted} onclick={save}>{saving?say('Saving…','กำลังบันทึก…'):say('Save order','บันทึกลำดับ')}</button>
 <button class="btn" type="button" disabled={!dirty||loading||saving} onclick={()=>{products=[...saved];if(!conflicted)message='';}}>{say('Cancel changes','ยกเลิกการเปลี่ยนแปลง')}</button>
 <button class="btn" type="button" disabled={loading||saving} onclick={load}>{say('Reload current order','โหลดลำดับปัจจุบัน')}</button></div>
 <p class="order-message" role="status">{message}</p>
</details>

<style>
 .product-order{border:1px solid #ffffff33;border-radius:.85rem;padding:1rem;background:#1115}.product-order summary{font-weight:600;cursor:pointer;min-height:44px;display:list-item;align-content:center}.order-help{max-width:70ch;line-height:1.6;color:#d5d0c5;margin:.5rem 0 1rem}ol{padding:0;list-style:none;max-width:55rem}li{display:flex;align-items:center;gap:.8rem;border-top:1px solid #ffffff22;padding:.5rem 0}.order-number{width:2rem;flex-shrink:0;color:#d8ba78}.order-name{flex:1;min-width:0;overflow-wrap:anywhere}.order-buttons{display:flex;gap:.4rem;flex-shrink:0}.order-buttons button{min-width:44px;min-height:44px;padding:.6rem}.order-actions{display:flex;flex-wrap:wrap;gap:.6rem;margin-top:1rem}.order-actions button{min-height:44px}.order-message{margin-top:.7rem;line-height:1.5;color:#e7cf98}button:disabled{opacity:.4;cursor:default}button:focus-visible,summary:focus-visible{outline:2px solid #d8ba78;outline-offset:3px}
</style>
