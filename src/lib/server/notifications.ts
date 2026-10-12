type Locale = 'en' | 'ja' | 'zh-CN' | 'th';
type NotificationTopic = 'booking_buyer' | 'booking_seller' | 'order_paid_buyer' | 'order_paid_seller';
type Environment = (name: string) => string | undefined;
type NotificationMessage = { to: string; from: string; subject: string; html: string };

const locales = new Set<Locale>(['en', 'ja', 'zh-CN', 'th']);

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function escapeHtml(value: unknown): string {
  return text(value).replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[char]!);
}

function email(value: string): boolean {
  return value.length <= 254 && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value);
}

function required(env: Environment, name: string): string {
  const value = env(name);
  if (!value) throw new Error('transport_configuration_unavailable');
  return value;
}

function localeOf(value: unknown): Locale {
  return typeof value === 'string' && locales.has(value as Locale) ? value as Locale : 'en';
}

const bookingSubjects: Record<Locale, string> = {
  en: 'Repair booking received',
  ja: '修理予約を受け付けました',
  'zh-CN': '已收到维修预约',
  th: 'ได้รับคำขอนัดซ่อมแล้ว',
};

const orderSubjects: Record<Locale, string> = {
  en: 'Your Design Music order is paid',
  ja: 'ご注文のお支払いを確認しました',
  'zh-CN': '您的 Design Music 订单已付款',
  th: 'ยืนยันการชำระเงินคำสั่งซื้อแล้ว',
};

function safeMoney(value: unknown, currency: unknown): string {
  if (!Number.isSafeInteger(value) || typeof currency !== 'string' || !/^[a-z]{3}$/.test(currency)) return '';
  const amount = (value as number) / (currency === 'jpy' ? 1 : 100);
  return new Intl.NumberFormat('en', { style: 'currency', currency: currency.toUpperCase() }).format(amount);
}

export function notification(
  topic: string,
  value: unknown,
  env: Environment,
): NotificationMessage {
  if (!['booking_buyer', 'booking_seller', 'order_paid_buyer', 'order_paid_seller'].includes(topic)) {
    throw new Error('notification_topic_invalid');
  }
  const notificationTopic = topic as NotificationTopic;
  const payload = record(value);
  const seller = notificationTopic.endsWith('_seller');
  const sender = required(env, 'EMAIL_FROM');
  const receiver = seller ? required(env, 'SELLER_EMAIL') : text(payload.recipient) || text(record(payload.customer).email);
  if (!email(sender) || !email(receiver)) throw new Error('transport_configuration_unavailable');

  const locale = localeOf(payload.locale);
  const order = notificationTopic.startsWith('order_paid_');
  const subject = order ? orderSubjects[locale] : bookingSubjects[locale];
  const details = order
    ? [
        `<p>Order: ${escapeHtml(payload.orderId)}</p>`,
        `<p>Total: ${escapeHtml(safeMoney(payload.amountTotal, payload.currency))}</p>`,
        `<ul>${(Array.isArray(payload.items) ? payload.items : []).map(item => {
          const line = record(item);
          return `<li>${escapeHtml(line.name)} × ${escapeHtml(line.quantity)}</li>`;
        }).join('')}</ul>`,
      ].join('')
    : [
        `<p>Booking: ${escapeHtml(payload.bookingId)}</p>`,
        `<p>${escapeHtml(payload.startAt)} – ${escapeHtml(payload.endAt)} (${escapeHtml(payload.timeZone)})</p>`,
        `<p>Instrument: ${escapeHtml(payload.instrument)}</p>`,
        `<p>Service: ${escapeHtml(payload.service)}</p>`,
        `<p>Notes: ${escapeHtml(payload.notes)}</p>`,
      ].join('');
  const greeting = seller ? 'A customer transaction was recorded.' : 'Thank you for choosing Design Music.';
  return {
    to: receiver,
    from: sender,
    subject,
    html: `<!doctype html><html lang="${locale}"><body><p>${greeting}</p>${details}</body></html>`,
  };
}
