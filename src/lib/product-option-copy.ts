import {ui} from '../i18n/ui.ts';
import type {Locale} from './catalog.ts';

export function productOptionDescription(slug:string,group:string,code:string,labels:Record<string,string>,locale:Locale):string {
 const custom=labels?.[`${locale}Description`]?.trim();
 if(custom)return custom;
 if(slug==='shakuhachi'&&['toneHoles','mouthpiece'].includes(group)){
  const key=`product.${group==='toneHoles'?'tone':'mouth'}.${code}.desc` as keyof typeof ui.en;
  return ui[locale][key]||ui.en[key]||'';
 }
 const endPlugs:Record<string,Record<Locale,string>>={
  plain:{en:'Choose a single color for a clean, simple finish.',th:'เลือกสีเดียวสำหรับสไตล์เรียบง่าย',ja:'すっきりとした単色仕上げ。','zh-CN':'选择单色，呈现简洁风格。'},
  twoColor:{en:'Combine two colors in a marble-style pattern.',th:'ผสมสองสีเป็นลวดลายคล้ายหินอ่อน',ja:'2色を組み合わせたマーブル模様。','zh-CN':'结合两种颜色，呈现云石纹效果。'},
  custom:{en:'Contact us to discuss your preferred custom design.',th:'ติดต่อร้านเพื่อปรึกษารูปแบบที่ต้องการ',ja:'ご希望のカスタムデザインをご相談ください。','zh-CN':'联系我们，讨论您喜欢的定制设计。'}
 };
 return slug==='saxophone-end-plug'&&group==='style'?endPlugs[code]?.[locale]??'':'';
}
