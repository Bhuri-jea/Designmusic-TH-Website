import { HttpError } from './http.ts';
type Env = (name: string) => string | undefined;
function escape(value: unknown) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}
const copy = {
 en: { booking: 'Repair appointment confirmed', order: 'Payment received', sellerBooking: 'New repair appointment', sellerOrder: 'Paid order to prepare', time: 'Appointment (Asia/Bangkok)', instrument: 'Instrument', service: 'Service', notes: 'Notes', total: 'Total', contact: 'Customer contact' },
 ja: { booking: '修理予約を受け付けました', order: 'お支払いを確認しました', sellerBooking: '新しい修理予約', sellerOrder: '発送準備が必要な注文', time: '予約日時（バンコク時間）', instrument: '楽器', service: 'サービス', notes: '備考', total: '合計', contact: 'お客様の連絡先' },
 'zh-CN': { booking: '维修预约已确认', order: '已收到付款', sellerBooking: '新的维修预约', sellerOrder: '待准备的已付款订单', time: '预约时间（曼谷时间）', instrument: '乐器', service: '服务', notes: '备注', total: '总计', contact: '客户联系方式' },
 th: { booking: 'ยืนยันการนัดหมายซ่อมแล้ว', order: 'ได้รับการชำระเงินแล้ว', sellerBooking: 'การนัดหมายซ่อมใหม่', sellerOrder: 'คำสั่งซื้อที่ชำระแล้วรอจัดเตรียม', time: 'เวลานัดหมาย (กรุงเทพฯ)', instrument: 'เครื่องดนตรี', service: 'บริการ', notes: 'หมายเหตุ', total: 'ยอดรวม', contact: 'ข้อมูลติดต่อลูกค้า' },
};
const instrumentNames = {
 en: ['Soprano saxophone','Alto saxophone','Tenor saxophone','Baritone saxophone','Bassoon','Other'],
 ja: ['ソプラノサックス','アルトサックス','テナーサックス','バリトンサックス','ファゴット','その他'],
 'zh-CN': ['高音萨克斯','中音萨克斯','次中音萨克斯','低音萨克斯','巴松管','其他'],
 th: ['โซปราโนแซกโซโฟน','อัลโตแซกโซโฟน','เทเนอร์แซกโซโฟน','บาริโทนแซกโซโฟน','บาสซูน','อื่น ๆ'],
};
const serviceNames = {
 en: ['Basic','Standard','Overhaul','Assessment'],
 ja: ['基本修理','標準修理','オーバーホール','点検'],
 'zh-CN': ['基础维修','标准维修','全面维修','检查评估'],
 th: ['บริการพื้นฐาน','บริการมาตรฐาน','ยกเครื่อง','ตรวจประเมิน'],
};
function email(value: unknown): value is string { return typeof value === 'string' && value.length <= 320 && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value); }
export function notification(topic: string, payload: Record<string, unknown>, env: Env) {
 const from = env('EMAIL_FROM');
 const seller = topic.endsWith('_seller');
 const to = seller ? env('SELLER_EMAIL') : payload.recipient;
 if (!from || /[\r\n]/.test(from) || !email(to)) throw new HttpError(503, 'transport_configuration_unavailable');
 const locale = typeof payload.locale === 'string' && payload.locale in copy ? payload.locale as keyof typeof copy : 'en';
 const c = copy[locale];
 const booking = topic === 'booking_buyer' || topic === 'booking_seller';
 if (!booking && topic !== 'order_paid_buyer' && topic !== 'order_paid_seller') throw Error('invalid_notification_topic');
 const subject = booking ? seller ? c.sellerBooking : c.booking : seller ? c.sellerOrder : c.order;
 let content: string;
 if (booking) {
  const customer = payload.customer as { name?: string; email?: string; phone?: string } | undefined;
  const at = new Date(String(payload.startAt));
  if (!Number.isFinite(at.getTime())) throw Error('invalid_notification_payload');
  const instrument = instrumentNames[locale][['soprano','alto','tenor','baritone','bassoon','other'].indexOf(String(payload.instrument))] ?? payload.instrument;
  const service = serviceNames[locale][['basic','standard','overhaul','assessment'].indexOf(String(payload.service))] ?? payload.service;
  const date = new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeStyle: 'short', timeZone: 'Asia/Bangkok' }).format(at);
  content = '<p>' + escape(payload.bookingId) + '</p><p>' + escape(c.time) + ': ' + escape(date) + '</p><p>' + escape(c.instrument) + ': ' + escape(instrument) + '</p><p>' + escape(c.service) + ': ' + escape(service) + '</p><p>' + escape(c.notes) + ': ' + escape(payload.notes) + '</p>';
  if (seller) content += '<p>' + escape(c.contact) + ': ' + escape(customer?.name) + ' / ' + escape(customer?.email) + ' / ' + escape(customer?.phone) + '</p>';
 } else {
  const items = Array.isArray(payload.items) ? payload.items as { name: unknown; quantity: unknown }[] : [];
  const currency = String(payload.currency);
  const amount = Number(payload.amountTotal);
  if (!['usd','jpy','thb'].includes(currency) || !Number.isSafeInteger(amount) || amount < 0 || !items.length) throw Error('invalid_notification_payload');
  const total = new Intl.NumberFormat(locale, { style: 'currency', currency: currency.toUpperCase() }).format(amount / (currency === 'jpy' ? 1 : 100));
  content = '<p>' + escape(payload.orderId) + '</p><ul>' + items.map(item => '<li>' + escape(item.name) + ' × ' + escape(item.quantity) + '</li>').join('') + '</ul><p>' + escape(c.total) + ': ' + escape(total) + '</p>';
 }
 return { from, to, subject, html: '<!doctype html><html lang="' + locale + '"><body><h1>' + escape(subject) + '</h1>' + content + '</body></html>' };
}
