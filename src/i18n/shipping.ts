import type { Locale } from '../lib/catalog.ts';
const words={
 en:{method:'Shipping method',contact:'Request a shipping quote directly. This service has no rate for your parcel’s weight.',fxError:'Exchange rates are temporarily unavailable. Please retry shortly.',invoice:'A shipping invoice is required because this service has no available rate or the parcel exceeds 2 kg.',direct:'Contact directly'},
 th:{method:'วิธีจัดส่ง',contact:'โปรดติดต่อร้านเพื่อขอใบเสนอราคาค่าจัดส่ง บริการนี้ไม่มีอัตราสำหรับน้ำหนักพัสดุของคุณ',fxError:'อัตราแลกเปลี่ยนยังไม่พร้อมใช้งาน โปรดลองอีกครั้ง',invoice:'โปรดส่งคำสั่งซื้อเพื่อขอใบแจ้งค่าจัดส่ง เนื่องจากไม่มีอัตราที่รองรับหรือน้ำหนักเกิน 2 กก.',direct:'ติดต่อร้านโดยตรง'},
 ja:{method:'配送方法',contact:'この配送方法には荷物の重量に対応する料金がありません。店舗へ直接お見積もりをご依頼ください。',fxError:'為替レートを取得できません。しばらくしてから再試行してください。',invoice:'対応する送料がないか、荷物が2 kgを超えるため、送料見積もり用に注文を送信してください。',direct:'店舗へ直接連絡'},
 'zh-CN':{method:'配送方式',contact:'所选配送方式没有适用于此包裹重量的运费。请直接联系商店询价。',fxError:'暂时无法获取汇率，请稍后重试。',invoice:'此配送方式没有可用运费或包裹超过2公斤，请提交订单申请运费报价。',direct:'直接联系商店'},
};
export function shippingText(locale:Locale,key:keyof typeof words.en){return words[locale][key];}
export function serviceLabel(locale:Locale,method:string){return ({ems_local:locale==='th'?'ไปรษณีย์ไทย EMS':'Thailand Post EMS',flash:'Flash Express',epacket:'Thailand Post ePacket',ems_world:'Thailand Post EMS World',pickup:locale==='th'?'นัดรับสินค้าเอง':locale==='ja'?'店頭受取':locale==='zh-CN'?'到店自提':'Local pickup'} as Record<string,string>)[method]??method;}
