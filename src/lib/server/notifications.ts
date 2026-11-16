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
const bookingChangeCopy = {
 en: { rescheduledBuyer: 'Repair appointment changed', rescheduledSeller: 'Customer changed a repair appointment', cancelledBuyer: 'Repair appointment cancelled', cancelledSeller: 'Customer cancelled a repair appointment', adminCancelledBuyer: 'The shop cancelled your repair appointment', adminCancelledSeller: 'Shop cancellation of a repair appointment', previous: 'Previous appointment (Asia/Bangkok)', reason: 'Cancellation reason' },
 ja: { rescheduledBuyer: '修理予約の日時が変更されました', rescheduledSeller: 'お客様が修理予約の日時を変更しました', cancelledBuyer: '修理予約はキャンセルされました', cancelledSeller: 'お客様が修理予約をキャンセルしました', adminCancelledBuyer: '店舗が修理予約をキャンセルしました', adminCancelledSeller: '店舗による修理予約のキャンセル', previous: '変更前の日時（バンコク時間）', reason: 'キャンセル理由' },
 'zh-CN': { rescheduledBuyer: '维修预约时间已更改', rescheduledSeller: '客户更改了维修预约', cancelledBuyer: '维修预约已取消', cancelledSeller: '客户取消了维修预约', adminCancelledBuyer: '店铺取消了您的维修预约', adminCancelledSeller: '店铺取消维修预约', previous: '原预约时间（曼谷时间）', reason: '取消原因' },
 th: { rescheduledBuyer: 'เปลี่ยนเวลานัดหมายซ่อมแล้ว', rescheduledSeller: 'ลูกค้าเปลี่ยนเวลานัดหมายซ่อม', cancelledBuyer: 'ยกเลิกนัดหมายซ่อมแล้ว', cancelledSeller: 'ลูกค้ายกเลิกนัดหมายซ่อม', adminCancelledBuyer: 'ร้านยกเลิกนัดหมายซ่อมของคุณ', adminCancelledSeller: 'ร้านยกเลิกนัดหมายซ่อม', previous: 'เวลานัดหมายเดิม (กรุงเทพฯ)', reason: 'เหตุผลในการยกเลิก' },
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
const shippingCopy = {
 en: { quoteBuyer: 'Shipping quote approved', quoteSeller: 'Shipping quote requested', shipped: 'Your order has shipped', fee: 'Shipping fee', total: 'Order total', expires: 'Pay or cancel before', link: 'Review and pay or cancel your quote', admin: 'Review shipping quote requests', country: 'Destination country', weight: 'Shipment weight', service: 'Shipping service', tracking: 'Tracking number', contact: 'Customer', collected: 'Your order has been collected for pickup.' },
 ja: { quoteBuyer: '送料のお見積もりが確定しました', quoteSeller: '送料見積もりの依頼', shipped: 'ご注文を発送しました', fee: '送料', total: '合計', expires: '支払期限', link: '見積もりを確認して支払う、またはキャンセル', admin: '送料見積もり依頼を確認', country: '配送先の国', weight: '荷物の重量', service: '配送サービス', tracking: '追跡番号', contact: 'お客様', collected: 'ご注文の商品は店頭で受け取り済みです。' },
 'zh-CN': { quoteBuyer: '运费报价已确认', quoteSeller: '收到运费报价请求', shipped: '您的订单已发货', fee: '运费', total: '订单总额', expires: '付款或取消截止时间', link: '查看报价并付款或取消', admin: '查看运费报价请求', country: '目的地国家/地区', weight: '包裹重量', service: '配送服务', tracking: '物流单号', contact: '客户', collected: '您的订单已到店自取。' },
 th: { quoteBuyer: 'ยืนยันค่าจัดส่งแล้ว', quoteSeller: 'มีคำขอใบเสนอค่าจัดส่ง', shipped: 'จัดส่งคำสั่งซื้อของคุณแล้ว', fee: 'ค่าจัดส่ง', total: 'ยอดรวม', expires: 'ชำระเงินหรือยกเลิกก่อน', link: 'ตรวจสอบและชำระเงินหรือยกเลิกใบเสนอราคา', admin: 'ตรวจสอบคำขอใบเสนอค่าจัดส่ง', country: 'ประเทศปลายทาง', weight: 'น้ำหนักพัสดุ', service: 'บริการจัดส่ง', tracking: 'หมายเลขติดตาม', contact: 'ลูกค้า', collected: 'รับคำสั่งซื้อของคุณที่ร้านแล้ว' },
};
function safeOrigin(env: Env) {
 const raw = env('APP_ORIGIN');
 try {
  const url = new URL(raw!);
  if (!raw || url.username || url.password || url.search || url.hash || url.pathname !== '/' || !['https:', 'http:'].includes(url.protocol) || url.protocol === 'http:' && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) throw Error();
  return url.origin;
 } catch { throw new HttpError(503, 'transport_configuration_unavailable'); }
}
function minorCurrency(amount: unknown, currencyValue: unknown, locale: string) {
 const currency = String(currencyValue).toUpperCase();
 const digits = currency === 'JPY' ? 0 : 2;
 if (!['USD', 'JPY', 'THB'].includes(currency) || typeof amount !== 'number' || !Number.isSafeInteger(amount) || amount < 0) throw Error('invalid_notification_payload');
 return new Intl.NumberFormat(locale, { style: 'currency', currency, minimumFractionDigits: digits, maximumFractionDigits: digits }).format(amount / (digits ? 100 : 1));
}
function safeTrackingUrl(value: unknown) {
 if (typeof value !== 'string') return null;
 const allowed = new Set(['https://track.thailandpost.com', 'https://track.thailandpost.co.th/?lang=en', 'https://www.flashexpress.com/fle/tracking']);
 return allowed.has(value) ? value : null;
}
function email(value: unknown): value is string { return typeof value === 'string' && value.length <= 320 && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value); }
export function notification(topic: string, payload: Record<string, unknown>, env: Env) {
 const from = env('EMAIL_FROM');
 const seller = topic.endsWith('_seller');
 const customer = payload.customer as { email?: unknown } | undefined;
 const to = seller ? env('SELLER_EMAIL') : payload.recipient ?? ((topic === 'shipping_quote_buyer' || topic === 'order_shipped_buyer') ? customer?.email : undefined);
 if (!from || /[\r\n]/.test(from) || !email(to)) throw new HttpError(503, 'transport_configuration_unavailable');
 const locale = typeof payload.locale === 'string' && payload.locale in copy ? payload.locale as keyof typeof copy : 'en';
 const c = copy[locale];
 const booking = topic === 'booking_buyer' || topic === 'booking_seller';
 const shippingQuoteBuyer = topic === 'shipping_quote_buyer';
 const shippingQuoteSeller = topic === 'shipping_quote_request_seller';
 const shipped = topic === 'order_shipped_buyer';
 const refundNotice = topic === 'order_refund_buyer' || topic === 'order_refund_seller';
 if(refundNotice){
  const words={en:{title:'Order cancellation / refund update',order:'Order',reason:'Reason',amount:'Refund amount',pending:'Refund requested; confirmation is pending.',succeeded:'Refund completed.',failed:'Refund needs attention. The shipment remains on hold.',canceled:'Refund cancelled; contact the shop.',cancelled:'Order cancelled before payment.',link:'View orders'},th:{title:'แจ้งการยกเลิกคำสั่งซื้อ / คืนเงิน',order:'คำสั่งซื้อ',reason:'เหตุผล',amount:'ยอดคืนเงิน',pending:'ส่งคำขอคืนเงินแล้ว อยู่ระหว่างรอยืนยัน',succeeded:'คืนเงินสำเร็จแล้ว',failed:'การคืนเงินต้องได้รับการตรวจสอบ ยังระงับการจัดส่งอยู่',canceled:'ยกเลิกการคืนเงินแล้ว โปรดติดต่อร้าน',cancelled:'ยกเลิกคำสั่งซื้อก่อนชำระเงินแล้ว',link:'ดูคำสั่งซื้อ'},ja:{title:'注文キャンセル・返金のお知らせ',order:'注文',reason:'理由',amount:'返金額',pending:'返金を申請しました。確認待ちです。',succeeded:'返金が完了しました。',failed:'返金の確認が必要です。発送は保留中です。',canceled:'返金がキャンセルされました。店舗へお問い合わせください。',cancelled:'支払い前に注文がキャンセルされました。',link:'注文を確認'},'zh-CN':{title:'订单取消／退款更新',order:'订单',reason:'原因',amount:'退款金额',pending:'已申请退款，等待确认。',succeeded:'退款已完成。',failed:'退款需要处理，发货仍暂停。',canceled:'退款已取消，请联系商店。',cancelled:'订单已在付款前取消。',link:'查看订单'}}[locale];
  const state=String(payload.refundStatus)==='requires_action'?'pending':String(payload.refundStatus);
  if(!['pending','succeeded','failed','canceled','cancelled'].includes(state)||typeof payload.orderId!=='string')throw Error('invalid_notification_payload');
  const link=safeOrigin(env)+(seller?(locale==='th'?'/th/admin':'/admin'):(locale==='en'?'':`/${locale}`)+'/profile/orders');
  const contactLabel={en:'Contact Design Music',th:'ติดต่อ Design Music',ja:'Design Music へのお問い合わせ','zh-CN':'联系 Design Music'}[locale];
  const contacts='<hr><p>'+escape(contactLabel)+'</p><p><a href="tel:+66850915959">0850915959</a></p><p><a href="https://www.facebook.com/DesignmusicInstrumentmusicAccessories">Facebook</a> · <a href="https://www.instagram.com/designmusic_instrument/">Instagram</a></p><p><a href="mailto:designmusicthailand@gmail.com">designmusicthailand@gmail.com</a></p>';
  return {from,to,subject:words.title,html:'<!doctype html><html lang="'+locale+'"><body><h1>'+escape(words.title)+'</h1><p>'+escape(words.order)+': '+escape(payload.orderId)+'</p><p>'+escape(words[state as keyof typeof words])+'</p><p>'+escape(words.amount)+': '+escape(minorCurrency(payload.amount,payload.currency,locale))+'</p><p>'+escape(words.reason)+': '+escape(payload.reason)+'</p><p><a href="'+escape(link)+'">'+escape(words.link)+'</a></p>'+contacts+'</body></html>'};
 }
 if (!booking && topic !== 'order_paid_buyer' && topic !== 'order_paid_seller' && !shippingQuoteBuyer && !shippingQuoteSeller && !shipped) throw Error('invalid_notification_topic');
 const shipping = shippingCopy[locale];
 if (shippingQuoteBuyer || shippingQuoteSeller || shipped) {
  let subject: string;
  let content: string;
  if (shippingQuoteBuyer) {
   const expires = new Date(String(payload.expiresAt));
   if (!Number.isFinite(expires.getTime())) throw Error('invalid_notification_payload');
   const expiry = new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeStyle: 'short', timeZone: 'Asia/Bangkok' }).format(expires);
   const origin = safeOrigin(env);
   const path = locale === 'en' ? '/profile/orders' : `/${locale}/profile/orders`;
   const link = `${origin}${path}#shipping-quotes-title`;
   subject = shipping.quoteBuyer;
   const customer = payload.customer as { name?: unknown } | undefined;
   content = '<p>' + escape(customer?.name) + '</p><p>' + escape(payload.quoteId) + '</p><p>' + escape(shipping.fee) + ': ' + escape(minorCurrency(payload.shippingAmount, payload.currency, locale)) + '</p><p>' + escape(shipping.total) + ': ' + escape(minorCurrency(payload.amountTotal, payload.currency, locale)) + '</p><p>' + escape(shipping.expires) + ': ' + escape(expiry) + '</p><p><a href="' + escape(link) + '">' + escape(shipping.link) + '</a></p>';
  } else if (shippingQuoteSeller) {
   if (typeof payload.weightGrams !== 'number' || !Number.isSafeInteger(payload.weightGrams) || payload.weightGrams < 0 || typeof payload.country !== 'string' || !/^[A-Z]{2}$/.test(payload.country)) throw Error('invalid_notification_payload');
   const origin = safeOrigin(env);
   const link = `${origin}${locale === 'th' ? '/th/admin' : '/admin'}`;
   const customer = payload.customer as { name?: unknown; email?: unknown } | undefined;
   subject = shipping.quoteSeller;
   content = '<p>' + escape(payload.quoteId) + '</p><p>' + escape(shipping.contact) + ': ' + escape(customer?.name) + ' / ' + escape(customer?.email) + '</p><p>' + escape(shipping.country) + ': ' + escape(payload.country) + '</p><p>' + escape(shipping.weight) + ': ' + escape(payload.weightGrams) + ' g</p><p><a href="' + escape(link) + '">' + escape(shipping.admin) + '</a></p>';
  } else {
   if (typeof payload.shippingService !== 'string' || typeof payload.trackingNumber !== 'string' || !payload.trackingNumber) throw Error('invalid_notification_payload');
   const pickup = payload.shippingService === 'pickup';
   subject = shipping.shipped;
   content = '<p>' + escape(payload.orderId) + '</p>';
   if (pickup) content += '<p>' + escape(shipping.collected) + '</p>';
   else {
    content += '<p>' + escape(shipping.service) + ': ' + escape(payload.shippingService) + '</p><p>' + escape(shipping.tracking) + ': ' + escape(payload.trackingNumber) + '</p>';
    const link = safeTrackingUrl(payload.trackingUrl);
    if (link) content += '<p><a href="' + escape(link) + '">' + escape(link) + '</a></p>';
   }
  }
  return { from, to, subject, html: '<!doctype html><html lang="' + locale + '"><body><h1>' + escape(subject) + '</h1>' + content + '</body></html>' };
 }
 const change = booking ? bookingChangeCopy[locale] : null;
 const event = booking && (payload.event === 'rescheduled' || payload.event === 'cancelled') ? payload.event : null;
 if (event === 'cancelled' && payload.cancelledBy === 'admin' && (typeof payload.cancellationReason !== 'string' || !payload.cancellationReason.trim())) throw Error('invalid_notification_payload');
 const stockReview= !booking && payload.stockReview===true;
 const stockReviewWords={
  en:{buyer:'Payment received — order under review',seller:'Paid order needs stock review',buyerNote:'Payment was received, but we could not allocate the ordered stock. The shop will review the order and contact you about a refund. Your order will not be shipped.',sellerNote:'Payment was received, but stock allocation failed. Dispatch is blocked. Review the order and issue a refund.'},
  th:{buyer:'ได้รับชำระเงินแล้ว — กำลังตรวจสอบคำสั่งซื้อ',seller:'คำสั่งซื้อที่ชำระแล้วต้องตรวจสอบสต๊อก',buyerNote:'ได้รับชำระเงินแล้ว แต่ยังจัดสรรสินค้าไม่ได้ ร้านจะตรวจสอบคำสั่งซื้อและติดต่อเรื่องการคืนเงิน โดยจะยังไม่จัดส่งสินค้า',sellerNote:'ได้รับชำระเงินแล้ว แต่จัดสรรสต๊อกไม่ได้ ระงับการจัดส่ง โปรดตรวจสอบและคืนเงิน'},
  ja:{buyer:'お支払いを確認しました — 注文を確認中',seller:'支払い済み注文の在庫確認が必要です',buyerNote:'お支払いを受け付けましたが、在庫を確保できませんでした。店舗が確認し、返金についてご連絡します。発送は保留中です。',sellerNote:'お支払いを受け付けましたが、在庫を確保できませんでした。発送を停止し、確認と返金を行ってください。'},
  'zh-CN':{buyer:'已收到付款 — 订单待核查',seller:'已付款订单需要库存核查',buyerNote:'已收到付款，但未能分配所购商品的库存。商店将核查订单并联系您处理退款。订单不会发货。',sellerNote:'已收到付款，但库存分配失败。请暂停发货，核查订单并办理退款。'}
 }[locale];
 const subject = stockReview ? seller ? stockReviewWords.seller : stockReviewWords.buyer : booking && event === 'rescheduled' ? seller ? change!.rescheduledSeller : change!.rescheduledBuyer
  : booking && event === 'cancelled' ? payload.cancelledBy === 'admin' ? seller ? change!.adminCancelledSeller : change!.adminCancelledBuyer : seller ? change!.cancelledSeller : change!.cancelledBuyer
  : booking ? seller ? c.sellerBooking : c.booking : seller ? c.sellerOrder : c.order;
 let content: string;
 if (booking) {
  const customer = payload.customer as { name?: string; email?: string; contactName?:string; contactInformation?:string; accountEmail?:string } | undefined;
  const at = new Date(String(payload.startAt));
  if (!Number.isFinite(at.getTime())) throw Error('invalid_notification_payload');
  const instrument = instrumentNames[locale][['soprano','alto','tenor','baritone','bassoon','other'].indexOf(String(payload.instrument))] ?? payload.instrument;
  const service = serviceNames[locale][['basic','standard','overhaul','assessment'].indexOf(String(payload.service))] ?? payload.service;
  const date = new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeStyle: 'short', timeZone: 'Asia/Bangkok' }).format(at);
  content = '<p>' + escape(payload.bookingId) + '</p><p>' + escape(c.time) + ': ' + escape(date) + '</p><p>' + escape(c.instrument) + ': ' + escape(instrument) + '</p><p>' + escape(c.service) + ': ' + escape(service) + '</p><p>' + escape(c.notes) + ': ' + escape(payload.notes) + '</p>';
  if (event === 'rescheduled') {
   const previous = new Date(String(payload.previousStartAt));
   if (!Number.isFinite(previous.getTime())) throw Error('invalid_notification_payload');
   content += '<p>' + escape(change!.previous) + ': ' + escape(new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeStyle: 'short', timeZone: 'Asia/Bangkok' }).format(previous)) + '</p>';
  }
  if (event === 'cancelled' && payload.cancelledBy === 'admin') content += '<p>' + escape(change!.reason) + ': ' + escape(payload.cancellationReason) + '</p>';
  if (seller) {
   const labels={en:{name:'Customer name',account:'Account email',missing:'Not provided'},th:{name:'ชื่อลูกค้า',account:'อีเมลบัญชี',missing:'ไม่ได้ระบุช่องทางติดต่อ'},ja:{name:'お客様名',account:'アカウントのメール',missing:'連絡先未記入'},'zh-CN':{name:'客户姓名',account:'账户邮箱',missing:'未提供联系方式'}}[locale];
   content+='<p>'+escape(labels.name)+': '+escape(customer?.contactName||customer?.name)+'</p><p>'+escape(c.contact)+': '+escape(customer?.contactInformation?.trim()||labels.missing)+'</p>';
   const accountEmail=customer?.accountEmail||customer?.email;
   if(accountEmail)content+='<p>'+escape(labels.account)+': '+escape(accountEmail)+'</p>';
  }
 } else {
  const items = Array.isArray(payload.items) ? payload.items as { name: unknown; quantity: unknown }[] : [];
  const currency = String(payload.currency);
  const amount = Number(payload.amountTotal);
  if (!['usd','jpy','thb'].includes(currency) || !Number.isSafeInteger(amount) || amount < 0 || !items.length) throw Error('invalid_notification_payload');
  const total = new Intl.NumberFormat(locale, { style: 'currency', currency: currency.toUpperCase() }).format(amount / (currency === 'jpy' ? 1 : 100));
  content = '<p>' + escape(payload.orderId) + '</p><ul>' + items.map(item => '<li>' + escape(item.name) + ' × ' + escape(item.quantity) + '</li>').join('') + '</ul><p>' + escape(c.total) + ': ' + escape(total) + '</p>';
  if(stockReview){
   content += '<p>' + escape(seller?stockReviewWords.sellerNote:stockReviewWords.buyerNote) + '</p>';
   if(seller)content += '<p><a href="' + escape(safeOrigin(env)+(locale==='th'?'/th/admin':'/admin')) + '">Review order</a></p>';
  }
 }
 if (!booking && !seller) { const link = safeOrigin(env) + (locale==='en'?'':`/${locale}`) + '/profile/orders'; const label={en:'View your orders',ja:'注文を確認','zh-CN':'查看订单',th:'ดูคำสั่งซื้อของคุณ'}[locale]; content += '<p><a href="' + escape(link) + '">' + escape(label) + '</a></p>'; }
 return { from, to, subject, html: '<!doctype html><html lang="' + locale + '"><body><h1>' + escape(subject) + '</h1>' + content + '</body></html>' };
}
