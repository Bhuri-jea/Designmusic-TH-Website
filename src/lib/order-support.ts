import type { Locale } from './catalog.ts';

export const SUPPORT_EMAIL = 'designmusicthailand@gmail.com';
export const supportCopy = {
 en: {
  title: 'Need help with this order?', action: 'Contact us about a return or refund',
  description: 'Returns and refunds are reviewed individually. Email your order number, describe the issue and attach photos if helpful.',
  draft: 'This opens an email draft. Send it from your email app to contact us. No refund or shipping change is made by clicking this link.',
  copy: 'Copy email address', copied: 'Email address copied.', failed: 'Could not copy. Please select and copy the email address below.',
  reference: 'Order number', subject: 'Return or refund enquiry', body: 'Please describe the issue and the help you need. You can attach photos before sending.',
 },
 ja: {
  title: 'この注文についてお困りですか？', action: '返品・返金について問い合わせる',
  description: '返品・返金は個別に確認いたします。注文番号と問題の詳細をメールでお知らせください。必要に応じて写真を添付できます。',
  draft: 'メールの下書きが開きます。メールアプリから送信してください。リンクを押すだけでは返金や配送の変更は行われません。',
  copy: 'メールアドレスをコピー', copied: 'メールアドレスをコピーしました。', failed: 'コピーできませんでした。下のメールアドレスを選択してコピーしてください。',
  reference: '注文番号', subject: '返品・返金のお問い合わせ', body: '問題の詳細とご希望をお知らせください。送信前に写真を添付できます。',
 },
 th: {
  title: 'ต้องการความช่วยเหลือเกี่ยวกับคำสั่งซื้อนี้?', action: 'ติดต่อเรื่องการคืนสินค้าหรือคืนเงิน',
  description: 'เราพิจารณาการคืนสินค้าและคืนเงินเป็นรายกรณี กรุณาส่งอีเมลพร้อมหมายเลขคำสั่งซื้อ รายละเอียดปัญหา และแนบรูปภาพหากมี',
  draft: 'ลิงก์นี้เปิดร่างอีเมล กรุณากดส่งจากแอปอีเมลของคุณ การคลิกลิงก์ไม่ได้ดำเนินการคืนเงินหรือเปลี่ยนแปลงการจัดส่ง',
  copy: 'คัดลอกอีเมล', copied: 'คัดลอกอีเมลแล้ว', failed: 'คัดลอกไม่สำเร็จ กรุณาเลือกและคัดลอกอีเมลด้านล่าง',
  reference: 'หมายเลขคำสั่งซื้อ', subject: 'สอบถามเรื่องการคืนสินค้าหรือคืนเงิน', body: 'กรุณาอธิบายปัญหาและความช่วยเหลือที่ต้องการ คุณสามารถแนบรูปภาพก่อนส่งได้',
 },
 'zh-CN': {
  title: '需要此订单的帮助吗？', action: '咨询退货或退款',
  description: '退货和退款将逐一审核。请通过电子邮件提供订单号和问题说明，必要时可附上照片。',
  draft: '此链接会打开邮件草稿，请从邮件应用发送。点击链接不会发起退款或更改配送。',
  copy: '复制邮箱地址', copied: '邮箱地址已复制。', failed: '无法复制，请选中并复制下方邮箱地址。',
  reference: '订单号', subject: '退货或退款咨询', body: '请描述问题及您需要的帮助。发送前可以添加照片。',
 },
} satisfies Record<Locale, Record<string, string>>;

export function orderSupportMailto(orderId: string, locale: Locale): string {
 if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(orderId)) throw new Error('Invalid order reference');
 const copy = supportCopy[locale];
 const subject = `${copy.subject} — ${orderId}`;
 const body = `${copy.reference}: ${orderId}\n\n${copy.body}\n\n`;
 return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
