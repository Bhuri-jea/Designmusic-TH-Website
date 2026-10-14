import test from 'node:test';
import assert from 'node:assert/strict';
import { products } from '../src/lib/products.ts';
import { localizeProduct } from '../src/i18n/products.ts';

test('product titles use the selected locale in shared navigation and product listings', () => {
  const expected = {
    ja: ['サックス用エンドプラグ', '尺八', '木管アクセサリー', 'シリコンパッド'],
    'zh-CN': ['萨克斯管端塞', '尺八', '木管配件', '硅胶垫'],
    th: ['จุก Endplug แซกโซโฟน', 'ขลุ่ยญี่ปุ่นชากุฮาจิ', 'อุปกรณ์เครื่องเป่าลมไม้', 'นวมซิลิโคนนวัตกรรม'],
  } as const;

  for (const [lang, names] of Object.entries(expected) as [keyof typeof expected, readonly string[]][]) {
    assert.deepEqual(products.map(product => localizeProduct(product, lang).name), names);
  }
  assert.deepEqual(products.map(product => localizeProduct(product, 'en').name), products.map(product => product.name));
});
