import type { Locale } from '../lib/catalog';

type ProductCopy = { name: string; shortDesc: string; badge?: string };

const translations: Partial<Record<Locale, Record<string, ProductCopy>>> = {
  ja: {
    'saxophone-end-plug': {
      name: 'サックス用エンドプラグ',
      shortDesc: '35種類以上のカラーやマーブル模様、動物モチーフから選べるカスタムエンドプラグです。',
      badge: '人気商品',
    },
    shakuhachi: {
      name: '尺八',
      shortDesc: '交換式の歌口と音程調整機能を備えた、樹脂製の尺八です。',
      badge: '革新的なアプローチ',
    },
    woodwindaccessories: {
      name: '木管アクセサリー',
      shortDesc: 'リードケースやサムレストなど、演奏を支える木管楽器用アクセサリーです。',
    },
    siliconepads: {
      name: 'シリコンパッド',
      shortDesc: 'オクターブキーの空気音を抑える、円錐形のシリコンパッドです。',
      badge: '新商品',
    },
  },
  'zh-CN': {
    'saxophone-end-plug': {
      name: '萨克斯管端塞',
      shortDesc: '提供35种以上颜色、大理石纹和动物造型的可定制端塞。',
      badge: '热销商品',
    },
    shakuhachi: {
      name: '尺八',
      shortDesc: '采用树脂制作，配有可更换吹口和可调音高控制。',
      badge: '创新设计',
    },
    woodwindaccessories: {
      name: '木管配件',
      shortDesc: '包括簧片盒、拇指托等帮助提升演奏体验的木管乐器配件。',
    },
    siliconepads: {
      name: '硅胶垫',
      shortDesc: '采用尖锥形设计，有助于减少八度键处的气流噪音。',
      badge: '新品',
    },
  },
  th: {
    'saxophone-end-plug': {
      name: 'จุก Endplug แซกโซโฟน',
      shortDesc: 'จุกแบบปรับแต่งได้ มีสีให้เลือกมากกว่า 35 สี ลายหินอ่อน และลายสัตว์',
      badge: 'สินค้าขายดี',
    },
    shakuhachi: {
      name: 'ขลุ่ยญี่ปุ่นชากุฮาจิ',
      shortDesc: 'ชากุฮาจิเรซินพร้อมปากเป่าที่เปลี่ยนได้และระบบปรับระดับเสียง',
      badge: 'วัฒนธรรมญี่ปุ่น',
    },
    woodwindaccessories: {
      name: 'อุปกรณ์เครื่องเป่าลมไม้',
      shortDesc: 'อุปกรณ์สำหรับเครื่องเป่าลมไม้ เช่น กล่องเก็บลิ้นและที่พักนิ้วโป้ง',
    },
    siliconepads: {
      name: 'นวมซิลิโคนนวัตกรรม',
      shortDesc: 'นวมซิลิโคนทรงกรวยปลายแหลมที่ช่วยลดเสียงลมบริเวณคีย์อ็อกเทฟ',
      badge: 'สินค้าใหม่',
    },
  },
};

export function localizeProduct<T extends { slug: string; name: string; shortDesc: string; badge?: string }>(
  product: T,
  lang: Locale,
): T {
  return { ...product, ...translations[lang]?.[product.slug] };
}
