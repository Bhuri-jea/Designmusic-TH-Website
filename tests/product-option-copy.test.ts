import test from 'node:test';
import assert from 'node:assert/strict';
import {productOptionDescription} from '../src/lib/product-option-copy.ts';

test('legacy product options have explanations in every customer language',()=>{
 for(const locale of ['en','th','ja','zh-CN'] as const){
  for(const [slug,group,codes] of [['shakuhachi','toneHoles',['standard','large']],['shakuhachi','mouthpiece',['balance','traditional','modern']],['saxophone-end-plug','style',['plain','twoColor','custom']]] as const){
   for(const code of codes)assert.ok(productOptionDescription(slug,group,code,{},locale));
  }
 }
});
test('seller explanation overrides legacy copy without leaking another language',()=>{
 assert.equal(productOptionDescription('shakuhachi','toneHoles','standard',{enDescription:' My description '},'en'),'My description');
 assert.equal(productOptionDescription('new-product','size','small',{enDescription:'English only'},'th'),'');
});
