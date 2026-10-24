<script lang="ts">
 import {onMount} from 'svelte';
 import './catalog-editor.css';
 import CatalogLayoutEditor from './CatalogLayoutEditor.svelte';
 import ProductEditorPreview from './ProductEditorPreview.svelte';
 import {DEFAULT_PRODUCT_LAYOUT,productLifecycleActions} from '../../lib/catalog-presentation';
 let {lang='en'}=$props<{lang?:'en'|'th'}>();
 const locales=['en','th','ja','zh-CN'];
 const languageNames:Record<string,string>={en:'English',th:'ภาษาไทย',ja:'日本語','zh-CN':'中文'};
 const say=(english:string,thai:string)=>lang==='th'?thai:english;
 let list=$state<any[]>([]),selected=$state<any>(null),collections=$state<any[]>([]);
 let query=$state(''),filter=$state(''),categoryName=$state(''),busy=$state(false),message=$state(''),lastSaved=$state('');
 let previewPanel=$state<{open:()=>Promise<void>}|undefined>();
 let listRequest=0;
 const serialized=$derived(selected?JSON.stringify(selected):'');
 const dirty=$derived(Boolean(selected)&&serialized!==lastSaved);
 const actions=$derived(productLifecycleActions(selected?.lifecycle??'draft'));
 const hasActiveSku=$derived(Boolean(selected?.skus?.some((sku:any)=>sku.lifecycle==='active')));
 const collectionChoices=$derived([...collections,...(selected?.collectionSlug&&!collections.some(row=>row.slug===selected.collectionSlug)?[{slug:selected.collectionSlug,labels:{en:'Current category',th:'หมวดหมู่ปัจจุบัน'}}]:[])]);
 const statusLabel=(value:string)=>({draft:say('Draft','ฉบับร่าง'),published:say('Published','เผยแพร่แล้ว'),archived:say('Archived','เก็บถาวร'),active:say('Active','เปิดขาย')} as Record<string,string>)[value]??value;
 const categoryLabel=(slug:string)=>{const row=collections.find(item=>item.slug===slug);return row?.labels?.[lang]||row?.labels?.en||say('Category','หมวดหมู่');};
 const labels=()=>Object.fromEntries(locales.map(locale=>[locale,'']));
 function friendlyError(code:string){
  const words:Record<string,[string,string]>={
   incomplete_translations:['Complete all four language sections before publishing.','กรอกข้อมูลให้ครบทั้ง 4 ภาษาก่อนเผยแพร่'],
   invalid_catalog_images:['Add one primary HTTPS image and check every image URL.','เพิ่มรูป HTTPS และเลือกรูปหลักหนึ่งรูป'],
   invalid_catalog_options:['Check option codes, labels and values. Each value code must be unique.','ตรวจสอบรหัส ชื่อ และค่าตัวเลือก โดยรหัสค่าต้องไม่ซ้ำกัน'],
   invalid_catalog_skus:['Check every SKU, option combination, stock, price and weight.','ตรวจสอบ SKU ตัวเลือก สต๊อก ราคา และน้ำหนัก'],
   invalid_catalog_product:['Check the page address and required product fields.','ตรวจสอบที่อยู่หน้าสินค้าและข้อมูลที่จำเป็น'],
   invalid_catalog_presentation:['Check the layout, option displays and each review: name, impression and 1–5 whole stars.','ตรวจสอบการจัดวาง ตัวเลือก และรีวิว (ชื่อ ความประทับใจ และคะแนน 1–5 ดาว)'],
   invalid_catalog_collection:['Choose an existing category or create a new one.','เลือกหมวดหมู่ที่มีอยู่หรือสร้างหมวดหมู่ใหม่'],
   database_conflict:['This page address, SKU or category name is already in use.','ที่อยู่หน้า รหัส SKU หรือชื่อหมวดหมู่นี้ถูกใช้แล้ว'],
   service_unavailable:['Seller tools are temporarily unavailable. Your edits are preserved.','เครื่องมือผู้ขายไม่พร้อมใช้งานชั่วคราว การแก้ไขยังอยู่']
  };
  const word=words[code];return word?say(...word):say('Could not save. Your edits are preserved.','บันทึกไม่สำเร็จ การแก้ไขยังอยู่');
 }
 async function readResponse(response:Response){const data=await response.json();if(!response.ok)throw Error(data.error??'service_unavailable');return data;}
 function acceptProduct(product:any){
  product.presentation??={optionStyles:{},reviews:[]};product.presentation.optionStyles??={};product.presentation.reviews??=[];
  product.presentation.layout??=DEFAULT_PRODUCT_LAYOUT.map(row=>[...row]);
  selected=product;lastSaved=JSON.stringify(product);categoryName='';
 }
 async function loadList(){const request=++listRequest;const response=await fetch(`/api/admin/catalog?q=${encodeURIComponent(query)}&lifecycle=${encodeURIComponent(filter)}`,{cache:'no-store'});const data=await readResponse(response);if(request===listRequest)list=data.products;}
 async function loadCollections(){const response=await fetch('/api/admin/catalog/collections',{cache:'no-store'});collections=(await readResponse(response)).collections;}
 async function refreshList(){try{await loadList();}catch{message+=' '+say('The product list could not refresh. Reload it before choosing another item.','อัปเดตรายการสินค้าไม่สำเร็จ โปรดโหลดรายการใหม่ก่อนเลือกสินค้าอื่น');}}
 function canDiscard(){return !dirty||confirm(say('Discard unsaved changes?','ละทิ้งการแก้ไขที่ยังไม่ได้บันทึกหรือไม่'));}
 async function open(id:string,force=false){
  if(busy||(!force&&selected?.id===id)||(!force&&!canDiscard()))return;
  busy=true;message='';
  try{const response=await fetch(`/api/admin/catalog/${id}`,{cache:'no-store'});acceptProduct((await readResponse(response)).product);}
  catch(error){message=friendlyError((error as Error).message);}finally{busy=false;}
 }
 async function create(){
  if(busy||!canDiscard())return;busy=true;message='';
  try{const created=await readResponse(await fetch('/api/admin/catalog',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}));acceptProduct((await readResponse(await fetch(`/api/admin/catalog/${created.id}`,{cache:'no-store'}))).product);await refreshList();}
  catch(error){message=friendlyError((error as Error).message);}finally{busy=false;}
 }
 async function save(){
  if(!selected||busy)return false;busy=true;message='';
  try{const data=await readResponse(await fetch(`/api/admin/catalog/${selected.id}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(selected)}));acceptProduct(data.product);message=say('Saved.','บันทึกแล้ว');await refreshList();return true;}
  catch(error){message=friendlyError((error as Error).message);return false;}finally{busy=false;}
 }
 async function lifecycle(value:string){
  if(!selected||busy||value==='published'&&!hasActiveSku)return;
  if(value==='archived'&&!confirm(say('Archive this product?','เก็บสินค้านี้ถาวรหรือไม่')))return;
  if(dirty&&!(await save()))return;
  busy=true;message='';
  try{const data=await readResponse(await fetch(`/api/admin/catalog/${selected.id}/lifecycle`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({lifecycle:value})}));acceptProduct(data.product);message=say('Status updated.','อัปเดตสถานะแล้ว');await refreshList();}
  catch(error){message=friendlyError((error as Error).message);}finally{busy=false;}
 }
 async function addCollection(){
  if(busy||!categoryName.trim())return;busy=true;message='';
  try{const data=await readResponse(await fetch('/api/admin/catalog/collections',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:categoryName.trim(),locale:lang})}));collections=[...collections.filter(row=>row.slug!==data.collection.slug),data.collection];selected.collectionSlug=data.collection.slug;categoryName='';message=say('Category created. Save the product to assign it.','เพิ่มหมวดหมู่แล้ว บันทึกสินค้าเพื่อใช้หมวดหมู่นี้');}
  catch{message=say('Could not add category. The name may already exist.','เพิ่มหมวดหมู่ไม่สำเร็จ อาจมีชื่อนี้แล้ว');}finally{busy=false;}
 }
 async function uploadImages(event:Event){
  const input=event.currentTarget as HTMLInputElement,files=Array.from(input.files??[]);if(!files.length||busy)return;
  busy=true;message=say('Uploading images…','กำลังอัปโหลดรูป…');
  try{for(const file of files){if(file.size>4194304||!['image/jpeg','image/png','image/webp'].includes(file.type))throw Error('invalid_product_image');const data=await readResponse(await fetch('/api/admin/catalog/images',{method:'POST',headers:{'Content-Type':file.type},body:file}));selected.images=[...selected.images,{url:data.url,alt:file.name.replace(/\.[^.]+$/,''),position:selected.images.length,primary:selected.images.length===0}];}message=say('Uploaded. Save the product to keep these images.','อัปโหลดแล้ว กดบันทึกเพื่อเพิ่มรูปในสินค้า');}
  catch{message=say('Upload failed. Use JPG, PNG or WebP up to 4 MB and check Storage setup. Other images are kept.','อัปโหลดไม่สำเร็จ ใช้ JPG, PNG หรือ WebP ไม่เกิน 4 MB ตรวจสอบการตั้งค่า Storage รูปอื่นยังคงอยู่');}
  finally{busy=false;input.value='';}
 }
 function addImage(){selected.images=[...selected.images,{url:'https://',alt:'',position:selected.images.length,primary:selected.images.length===0}];}
 function addGroup(){selected.optionGroups=[...selected.optionGroups,{code:'',position:selected.optionGroups.length,labels:labels(),values:[]}];}
 function addValue(group:any){group.values=[...group.values,{code:'',position:group.values.length,labels:labels()}];}
 function renameGroup(group:any,value:string){const previous=group.code,style=selected.presentation.optionStyles[previous];delete selected.presentation.optionStyles[previous];if(style)selected.presentation.optionStyles[value]=style;group.code=value;}
 function removeGroup(index:number){delete selected.presentation.optionStyles[selected.optionGroups[index].code];selected.optionGroups=selected.optionGroups.filter((_:any,i:number)=>i!==index);}
 function setDisplay(code:string,value:string){selected.presentation.optionStyles={...selected.presentation.optionStyles,[code]:value};}
 function addSku(){selected.skus=[...selected.skus,{sku:'',optionValueCodes:[],onHand:0,reserved:0,usd:null,jpy:null,thb:null,weightKg:null,salesMode:'checkout',lifecycle:'active'}];}
 function addReview(){selected.presentation.reviews=[...selected.presentation.reviews,{name:'',rating:5,impression:''}];}
 function move<T>(items:T[],index:number,direction:-1|1){const target=index+direction;if(target<0||target>=items.length)return items;const next=[...items];[next[index],next[target]]=[next[target],next[index]];return next;}
 function preventNumberArrow(event:KeyboardEvent){if(['ArrowUp','ArrowDown'].includes(event.key))event.preventDefault();}
 onMount(()=>{const beforeUnload=(event:BeforeUnloadEvent)=>{if(dirty){event.preventDefault();event.returnValue='';}};addEventListener('beforeunload',beforeUnload);Promise.all([loadList(),loadCollections()]).catch(error=>message=friendlyError((error as Error).message));return()=>removeEventListener('beforeunload',beforeUnload);});
</script>

<section class="catalog-editor mx-auto max-w-[1800px] space-y-6 px-4 py-10 md:px-6">
 <a class="btn" href={lang==='th'?'/th/admin':'/admin'}>← {say('Seller tools','เครื่องมือผู้ขาย')}</a>
 <h1 class="font-serif text-4xl">{say('Product catalog','แค็ตตาล็อกสินค้า')}</h1>
 <div class="catalog-layout">
  <aside aria-label={say('Products','สินค้า')}>
   <div class="filters">
    <input class="input" type="search" aria-label={say('Search products','ค้นหาสินค้า')} placeholder={say('Search products','ค้นหาสินค้า')} bind:value={query} onchange={()=>loadList().catch(error=>message=friendlyError(error.message))}/>
    <select class="input" aria-label={say('Product status','สถานะสินค้า')} bind:value={filter} onchange={()=>loadList().catch(error=>message=friendlyError(error.message))}><option value="">{say('All','ทั้งหมด')}</option>{#each ['draft','published','archived'] as state}<option value={state}>{statusLabel(state)}</option>{/each}</select>
    <button class="btn btn-primary" disabled={busy} onclick={create}>{say('Create product','สร้างสินค้า')}</button>
   </div>
   {#each list as product}<button class="product-row" class:selected={selected?.id===product.id} aria-current={selected?.id===product.id?'page':undefined} disabled={busy} onclick={()=>open(product.id)}><strong>{product.catalog_product_translations?.find((row:any)=>row.locale===lang)?.name||product.slug}</strong><small>{product.slug} · {statusLabel(product.lifecycle)}</small>{#if product.collection_slug}<span class="category-tag">{categoryLabel(product.collection_slug)}</span>{/if}</button>{/each}
   {#if !busy&&!list.length}<p>{say('No products found.','ไม่พบสินค้า')}</p>{/if}
  </aside>
  {#if selected}
   <form inert={busy} onsubmit={event=>{event.preventDefault();void save();}}>
    <div class="editor-head"><div>
     <label>{say('Page address','ที่อยู่หน้าสินค้า')}<input class="input" bind:value={selected.slug} disabled={selected.slugLocked}/></label>
     <div><label>{say('Category','หมวดหมู่')}<select class="input" bind:value={selected.collectionSlug}><option value={null}>{say('No category','ไม่มีหมวดหมู่')}</option>{#each collectionChoices as category}<option value={category.slug}>{category.labels?.[lang]||category.labels?.en||say('Category','หมวดหมู่')}</option>{/each}</select></label><div class="category-create"><input class="input" maxlength="100" aria-label={say('New category name','ชื่อหมวดหมู่ใหม่')} placeholder={say('e.g. Instrument parts','เช่น อะไหล่เครื่องเป่า')} bind:value={categoryName}/><button type="button" class="btn" disabled={!categoryName.trim()} onclick={addCollection}>{say('New category','เพิ่มหมวดหมู่')}</button></div></div>
    </div><span class="state">{statusLabel(selected.lifecycle)}</span></div>
    <CatalogLayoutEditor bind:layout={selected.presentation.layout} {lang}/>
    <h2>{say('Product details and languages','รายละเอียดสินค้าและภาษา')}</h2>
    <div class="translation-tabs">{#each locales as locale}{@const tr=selected.translations.find((row:any)=>row.locale===locale)}<fieldset><legend>{languageNames[locale]} <span aria-label={tr?.name&&tr?.shortDescription&&tr?.description?say('Complete','ครบถ้วน'):say('Incomplete','ยังไม่ครบ')}>{tr?.name&&tr?.shortDescription&&tr?.description?'✓':'!'}</span></legend>{#if tr}<label>{say('Name','ชื่อสินค้า')}<input class="input" maxlength="160" bind:value={tr.name}/></label><label>{say('Badge','ป้ายสินค้า')}<input class="input" maxlength="80" bind:value={tr.badge}/></label><label>{say('Short description','คำอธิบายสั้น')}<textarea class="input" maxlength="500" bind:value={tr.shortDescription}></textarea></label><label>{say('Description','คำอธิบาย')}<textarea class="input tall" maxlength="10000" bind:value={tr.description}></textarea></label>{/if}</fieldset>{/each}</div>
    <section><h2>{say('Images','รูปภาพ')}</h2><p class="catalog-help">{say('Upload JPG, PNG or WebP up to 4 MB each, or paste image URLs.','อัปโหลดไฟล์ JPG, PNG หรือ WebP ไม่เกิน 4 MB ต่อรูป หรือวางลิงก์รูปภาพ')}</p><label class="btn upload-control">{say('Upload from computer','อัปโหลดจากเครื่อง')}<input type="file" multiple accept="image/jpeg,image/png,image/webp" onchange={uploadImages}/></label>
     {#each selected.images as image,index}<div class="row"><img class="catalog-image-preview" src={image.url} alt={image.alt}/><input class="input grow" type="text" inputmode="url" aria-label={`${say('Image','รูป')} ${index+1} URL`} bind:value={image.url}/><input class="input grow" aria-label={`${say('Image','รูป')} ${index+1} ${say('alternative text','คำอธิบายภาพ')}`} placeholder={say('Alternative text','คำอธิบายภาพ')} bind:value={image.alt}/><label><input type="radio" name="primary" checked={image.primary} onchange={()=>{selected.images.forEach((row:any)=>row.primary=row===image);}}/>{say('Primary','รูปหลัก')}</label><button type="button" class="btn" aria-label={say('Move image up','เลื่อนรูปขึ้น')} disabled={index===0} onclick={()=>selected.images=move(selected.images,index,-1)}>↑</button><button type="button" class="btn" aria-label={say('Move image down','เลื่อนรูปลง')} disabled={index===selected.images.length-1} onclick={()=>selected.images=move(selected.images,index,1)}>↓</button><button type="button" class="btn danger" aria-label={say('Remove image','ลบรูป')} onclick={()=>selected.images=selected.images.filter((_:any,i:number)=>i!==index)}>×</button></div>{/each}
     <button type="button" class="btn" onclick={addImage}>{say('Add image URL','เพิ่มลิงก์รูปภาพ')}</button>
    </section>
    <section><h2>{say('Options','ตัวเลือก')}</h2>
     {#each selected.optionGroups as group,groupIndex}<div class="card"><div class="row"><label>{say('Option code','รหัสตัวเลือก')}<input class="input" value={group.code} oninput={event=>renameGroup(group,event.currentTarget.value)}/></label><label>{say('Option display','รูปแบบตัวเลือก')}<select class="input" value={selected.presentation.optionStyles[group.code]??'buttons'} onchange={event=>setDisplay(group.code,event.currentTarget.value)}><option value="buttons">{say('Buttons','ปุ่ม')}</option><option value="dropdown">{say('Dropdown','รายการแบบเลื่อนลง')}</option><option value="radio">{say('Radio list','รายการตัวเลือกแนวตั้ง')}</option></select></label><button type="button" class="btn" aria-label={say('Move option up','เลื่อนตัวเลือกขึ้น')} disabled={groupIndex===0} onclick={()=>selected.optionGroups=move(selected.optionGroups,groupIndex,-1)}>↑</button><button type="button" class="btn" aria-label={say('Move option down','เลื่อนตัวเลือกลง')} disabled={groupIndex===selected.optionGroups.length-1} onclick={()=>selected.optionGroups=move(selected.optionGroups,groupIndex,1)}>↓</button><button type="button" class="btn danger" onclick={()=>removeGroup(groupIndex)}>{say('Remove option','ลบตัวเลือก')}</button></div>
      <div class="labels">{#each locales as locale}<label>{languageNames[locale]}<input class="input" bind:value={group.labels[locale]}/></label>{/each}</div>
      {#each group.values as value,valueIndex}<div class="row"><input class="input" aria-label={`${say('Option value code','รหัสค่าตัวเลือก')} ${groupIndex+1}-${valueIndex+1}`} placeholder={say('Value code','รหัสค่า')} bind:value={value.code}/>{#each locales as locale}<label>{languageNames[locale]}<input class="input" aria-label={`${languageNames[locale]} ${say('label for','ชื่อของ')} ${value.code||valueIndex+1}`} bind:value={value.labels[locale]}/><input class="input" maxlength="240" aria-label={`${languageNames[locale]} ${say('explanation for','คำอธิบายของ')} ${value.code||valueIndex+1}`} placeholder={say('One-line option explanation','คำอธิบายตัวเลือกหนึ่งบรรทัด')} bind:value={value.labels[`${locale}Description`]}/></label>{/each}<button type="button" class="btn" aria-label={say('Move value up','เลื่อนค่าขึ้น')} disabled={valueIndex===0} onclick={()=>group.values=move(group.values,valueIndex,-1)}>↑</button><button type="button" class="btn" aria-label={say('Move value down','เลื่อนค่าลง')} disabled={valueIndex===group.values.length-1} onclick={()=>group.values=move(group.values,valueIndex,1)}>↓</button><button type="button" class="btn danger" aria-label={say('Remove value','ลบค่า')} onclick={()=>group.values=group.values.filter((_:any,i:number)=>i!==valueIndex)}>×</button></div>{/each}
      <button type="button" class="btn" onclick={()=>addValue(group)}>{say('Add value','เพิ่มค่า')}</button>
     </div>{/each}<button type="button" class="btn" onclick={addGroup}>{say('Add option','เพิ่มตัวเลือก')}</button>
    </section>
    <section><h2>{say('SKUs, stock and prices','SKU สต๊อกและราคา')}</h2><div class="table-wrap"><table><thead><tr><th>SKU</th><th>{say('Options','ตัวเลือก')}</th><th>{say('Stock / reserved','สต๊อก / จองแล้ว')}</th><th>{say('Price','ราคา')} USD / JPY / THB</th><th>kg</th><th>{say('Sales mode','วิธีขาย')}</th><th>{say('State','สถานะ')}</th></tr></thead><tbody>
     {#each selected.skus as sku}<tr><td><input class="input" aria-label={say('SKU code','รหัส SKU')} bind:value={sku.sku} disabled={Boolean(sku.id)}/></td><td><div class="sku-option-selects">{#each selected.optionGroups as group}<label><span>{group.labels[lang]||group.code}</span><select class="input" value={sku.optionValueCodes.find((code:string)=>group.values.some((value:any)=>value.code===code))??''} onchange={event=>{const other=sku.optionValueCodes.filter((code:string)=>!group.values.some((value:any)=>value.code===code));sku.optionValueCodes=[...other,event.currentTarget.value].filter(Boolean);}}><option value="">{say('Choose…','เลือก…')}</option>{#each group.values as value}<option value={value.code}>{value.labels[lang]||value.code}</option>{/each}</select></label>{/each}</div></td><td><input class="input small" aria-label={say('Stock on hand','จำนวนสต๊อกทั้งหมด')} type="number" min="0" step="1" bind:value={sku.onHand} onwheel={event=>event.currentTarget.blur()} onkeydown={preventNumberArrow}/> / {sku.reserved}</td><td>{#each ['usd','jpy','thb'] as currency}<input class="input tiny" aria-label={`${say('Price in','ราคา')} ${currency.toUpperCase()}`} type="number" min="0" step={currency==='jpy'?'1':'0.01'} bind:value={sku[currency]} onwheel={event=>event.currentTarget.blur()} onkeydown={preventNumberArrow}/>{/each}</td><td><input class="input small" aria-label={say('Gross weight in kilograms','น้ำหนักรวมกิโลกรัม')} type="number" min="0" step="0.001" bind:value={sku.weightKg} onwheel={event=>event.currentTarget.blur()} onkeydown={preventNumberArrow}/></td><td><select class="input" aria-label={say('Sales mode','วิธีขาย')} bind:value={sku.salesMode}><option value="checkout">{say('Online purchase','ซื้อออนไลน์')}</option><option value="reservation_only">{say('Contact shop to reserve','ติดต่อร้านเพื่อจอง')}</option></select></td><td><select class="input" aria-label={say('SKU state','สถานะ SKU')} bind:value={sku.lifecycle}><option value="active">{statusLabel('active')}</option><option value="archived">{statusLabel('archived')}</option></select></td></tr>{/each}
    </tbody></table></div><button type="button" class="btn" onclick={addSku}>{say('Add SKU','เพิ่ม SKU')}</button><p class="hint">{say('Saved SKU codes cannot be renamed. Archive a discontinued SKU instead.','รหัส SKU ที่บันทึกแล้วเปลี่ยนชื่อไม่ได้ หากเลิกขายให้เก็บ SKU นั้นถาวร')}</p></section>
    <section><h2>{say('Customer reviews','ความประทับใจจากลูกค้า')}</h2><p class="catalog-help">{say('Add genuine feedback you have permission to publish. Original wording is shown, labelled as added by the shop; no verified-purchase claim is made.','เพิ่มความคิดเห็นจริงที่ได้รับอนุญาตให้เผยแพร่ รีวิวจะแสดงข้อความต้นฉบับและระบุว่าร้านเป็นผู้เพิ่ม ไม่ได้ยืนยันการซื้อผ่านเว็บไซต์')}</p>
     {#each selected.presentation.reviews as review,index}<div class="catalog-entry"><div class="catalog-field-grid"><label>{say('Customer name','ชื่อลูกค้า')}<input class="input" required maxlength="120" bind:value={review.name}/></label><label>{say('Rating','คะแนน')}<select class="input" bind:value={review.rating}>{#each [1,2,3,4,5] as rating}<option value={rating}>{'★'.repeat(rating)} ({rating}/5)</option>{/each}</select></label></div><label>{say('Impression','ความประทับใจ')}<textarea class="input tall" required maxlength="2000" bind:value={review.impression}></textarea></label><div class="row"><button type="button" class="btn" aria-label={say('Move review up','เลื่อนรีวิวขึ้น')} disabled={index===0} onclick={()=>selected.presentation.reviews=move(selected.presentation.reviews,index,-1)}>↑</button><button type="button" class="btn" aria-label={say('Move review down','เลื่อนรีวิวลง')} disabled={index===selected.presentation.reviews.length-1} onclick={()=>selected.presentation.reviews=move(selected.presentation.reviews,index,1)}>↓</button><button type="button" class="btn danger" onclick={()=>selected.presentation.reviews=selected.presentation.reviews.filter((_:any,i:number)=>i!==index)}>{say('Remove review','ลบรีวิว')}</button></div></div>{/each}<button type="button" class="btn" disabled={selected.presentation.reviews.length>=50} onclick={addReview}>{say('Add customer review','เพิ่มรีวิวลูกค้า')}</button>
    </section>
    <div class="actions"><button class="btn btn-primary" disabled={busy||!dirty}>{busy?say('Working…','กำลังดำเนินการ…'):say('Save complete product','บันทึกสินค้าทั้งหมด')}</button>{#if dirty}<span class="unsaved">{say('Unsaved changes','มีการแก้ไขที่ยังไม่ได้บันทึก')}</span>{/if}{#if actions.includes('publish')}<button type="button" class="btn" disabled={busy||!hasActiveSku} aria-describedby={!hasActiveSku?'publish-sku-hint':undefined} onclick={()=>lifecycle('published')}>{say('Publish','เผยแพร่')}</button>{/if}{#if actions.includes('unpublish')}<button type="button" class="btn" disabled={busy} onclick={()=>lifecycle('draft')}>{say('Unpublish','ยกเลิกเผยแพร่')}</button>{/if}{#if actions.includes('archive')}<button type="button" class="btn danger" disabled={busy} onclick={()=>lifecycle('archived')}>{say('Archive','เก็บถาวร')}</button>{/if}{#if actions.includes('restore')}<button type="button" class="btn" disabled={busy} onclick={()=>lifecycle('draft')}>{say('Restore as draft','คืนเป็นฉบับร่าง')}</button>{/if}<button type="button" class="btn" onclick={()=>previewPanel?.open()}>{say('Preview','ดูตัวอย่าง')}</button>{#if selected.lifecycle==='published'}<a class="btn" target="_blank" rel="noopener" href={`${lang==='th'?'/th':''}/product/${selected.slug}`}>{say('Public page','หน้าสินค้า')} ↗</a>{/if}</div>
    {#if actions.includes('publish')&&!hasActiveSku}<p id="publish-sku-hint" class="catalog-help">{say('Set at least one SKU to Active before publishing this product.','เปิดขาย SKU อย่างน้อยหนึ่งรายการก่อนเผยแพร่สินค้า')}</p>{/if}
    {#if selected.lifecycle==='archived'}<p class="catalog-help">{say('This product is hidden. Restore as draft, then reactivate the SKUs you intend to sell before publishing.','สินค้าถูกซ่อนแล้ว คืนเป็นฉบับร่างแล้วเลือก SKU ที่ต้องการขายอีกครั้งก่อนเผยแพร่')}</p>{/if}
   </form><ProductEditorPreview bind:this={previewPanel} product={selected} {lang}/>
  {:else}<p>{busy?say('Loading…','กำลังโหลด…'):say('Select a product to edit or create a new product.','เลือกสินค้าเพื่อแก้ไขหรือสร้างสินค้าใหม่')}</p>{/if}
 </div>
 <p role="status" class="editor-message">{message}</p>
</section>
<style>
 .catalog-layout{display:grid;grid-template-columns:18rem minmax(0,1fr);gap:1.5rem}aside,form{min-width:0;border:1px solid #ffffff22;border-radius:1rem;padding:1rem;background:#1115}.filters{display:grid;gap:.6rem;margin-bottom:1rem}.product-row{display:grid;width:100%;padding:.8rem;text-align:left;border-top:1px solid #ffffff18}.product-row.selected{background:#ffffff12}.product-row small{color:#aaa}.editor-head,.row,.actions,.category-create{display:flex;gap:.7rem;align-items:end;flex-wrap:wrap}.editor-head{justify-content:space-between}.editor-head label{display:grid;gap:.4rem}.category-create{margin-top:.5rem}.category-create .input{flex:1 1 9rem;min-width:0}.category-tag,.state{width:fit-content;padding:.35rem .7rem;border:1px solid #ffffff33;border-radius:99px}.category-tag{margin-top:.4rem;font-size:.9rem}.translation-tabs{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1rem;margin-block:1.5rem}.translation-tabs fieldset,.card,form>section{border:1px solid #ffffff20;border-radius:.7rem;padding:1rem}.translation-tabs label,.card label{display:grid;gap:.25rem;margin-top:.55rem}.tall{min-height:8rem}.grow{flex:1 1 15rem;min-width:0}.labels{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:.5rem}.table-wrap{max-width:100%;overflow:auto}table{min-width:1050px;width:100%;border-collapse:collapse}th,td{padding:.5rem;border-bottom:1px solid #ffffff18;text-align:left}.small{width:5rem}.tiny{width:5.5rem}.danger{border-color:#a55;color:#fcc}.hint,.unsaved{color:#e7cf98;font-size:.9rem}.actions{position:sticky;bottom:0;padding:1rem;background:#101313ef;margin-top:1rem}.upload-control{display:flex;align-items:center;flex-wrap:wrap;gap:.8rem;margin-bottom:1rem}.upload-control input{max-width:100%;min-width:0}.sku-option-selects{display:grid;gap:.45rem}.sku-option-selects label{display:grid;gap:.25rem;font-size:.9rem}.product-row[aria-current=page]{outline:2px solid #d8ba78;outline-offset:-2px}.editor-message{white-space:pre-wrap;overflow-wrap:anywhere}
 @media(max-width:850px){.catalog-layout{grid-template-columns:1fr}.translation-tabs{grid-template-columns:1fr}.labels{grid-template-columns:1fr 1fr}}
</style>


