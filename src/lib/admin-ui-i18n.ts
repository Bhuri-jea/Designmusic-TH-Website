export type AdminLocale = 'en' | 'th';

const messages = {
  en: {
    sellerTools: 'Seller tools', products: 'Products', shippingSettings: 'Shipping settings',
    reload: 'Reload', saved: 'Saved', refreshFailed: 'Saved, but refresh failed. Reload to see the latest details.', saving: 'Saving…', save: 'Save', saveError: 'Could not save. Check the entered details.',
    changed: 'The record changed. Reload and check its current state.', unavailable: 'Seller tools are unavailable. Apply the required database migrations and try again.',
    productsTitle: 'Products', searchProducts: 'Search by name or SKU', noProducts: 'No products match your search.',
    stockAndPrices: 'Stock and prices', onHand: 'On hand', reserved: 'Reserved', available: 'Available', grossWeight: 'Packaged weight (kg)',
    price: 'Price', saveProduct: 'Save product', blankPrice: 'Leave the price blank to mark this weight as unavailable.',
    shippingTitle: 'Shipping settings', domestic: 'Thailand', international: 'International', destination: 'Destination',
    service: 'Service', weightLimit: 'Weight limit (kg)', priceTHB: 'Price (THB)', addBand: 'Add rate band', removeBand: 'Remove rate band',
    enableDestination: 'Enable this destination for checkout', pickup: 'Allow free pickup in Thailand',
    rateSource: 'Reference exchange rates', rateDate: 'Date', rateProvider: 'Source', rateUnavailable: 'Reference rates are currently unavailable.',
    noBands: 'No rate bands. Add a rate to offer this service.', saveShipping: 'Save shipping settings',
    paidOrders: 'Paid orders and fulfillment', noShipments: 'No paid shipments loaded.', status: 'Status', fulfillment: 'Fulfillment',
    subtotal: 'Merchandise subtotal', shippingCharge: 'Shipping', totalPaid: 'Total paid', referenceTHB: 'THB reference',
    referenceUnknown: 'THB reference unavailable for this order', referenceDate: 'Reference rate date', hold: 'Dispatch on hold.',
    reasonRelease: 'Reason for releasing this shipment', reasonHold: 'Reason for holding this shipment',
    holdPlaceholder: 'Required: explain the decision for the audit history.', release: 'Release shipment', holdAction: 'Hold shipment',
    confirmDispatch: 'I confirmed the address, weight, postage paid and selected carrier.', shippingService: 'Shipping service',
    trackingNumber: 'Tracking number', markShipped: 'Mark shipped', markCollected: 'Mark collected',
    trackingCollection: 'Tracking / collection', openTracking: 'Open tracking website', holdHistory: 'Hold and release history', held: 'Held', released: 'Released',
    jobsTitle: 'Items needing attention', noJobs: 'No items need attention.', jobOrder: 'Order', jobBooking: 'Booking', jobQuote: 'Shipping quote', jobPurpose: 'Task', jobStatus: 'Status',
    jobAttempts: 'Retries', jobDate: 'Last activity', jobProblem: 'Problem', orderNotice: 'Order notification', bookingNotice: 'Booking notification',
    calendarSync: 'Calendar synchronization', shippingQuote: 'Shipping quote', jobGeneric: 'Store update',
    failed: 'Failed', review: 'Needs review',
  },
  th: {
    sellerTools: 'จัดการร้านค้า', products: 'สินค้า', shippingSettings: 'ตั้งค่าการจัดส่ง',
    reload: 'โหลดใหม่', saved: 'บันทึกแล้ว', refreshFailed: 'บันทึกแล้ว แต่โหลดข้อมูลใหม่ไม่สำเร็จ โปรดโหลดอีกครั้งเพื่อตรวจสอบข้อมูลล่าสุด', saving: 'กำลังบันทึก…', save: 'บันทึก', saveError: 'บันทึกไม่ได้ โปรดตรวจสอบข้อมูล',
    changed: 'ข้อมูลเปลี่ยนแปลงแล้ว โปรดโหลดใหม่และตรวจสอบสถานะ', unavailable: 'เครื่องมือผู้ขายไม่พร้อมใช้งาน โปรดติดตั้ง migration ที่จำเป็นแล้วลองอีกครั้ง',
    productsTitle: 'สินค้า', searchProducts: 'ค้นหาด้วยชื่อหรือ SKU', noProducts: 'ไม่พบสินค้าที่ค้นหา',
    stockAndPrices: 'สต๊อกและราคา', onHand: 'จำนวนทั้งหมด', reserved: 'จองแล้ว', available: 'พร้อมขาย', grossWeight: 'น้ำหนักรวมบรรจุภัณฑ์ (กก.)',
    price: 'ราคา', saveProduct: 'บันทึกสินค้า', blankPrice: 'เว้นราคาว่างเพื่อระบุว่าไม่รองรับน้ำหนักช่วงนี้',
    shippingTitle: 'ตั้งค่าการจัดส่ง', domestic: 'ประเทศไทย', international: 'ต่างประเทศ', destination: 'ประเทศปลายทาง',
    service: 'บริการ', weightLimit: 'น้ำหนักไม่เกิน (กก.)', priceTHB: 'ราคา (บาท)', addBand: 'เพิ่มช่วงอัตรา', removeBand: 'ลบช่วงอัตรา',
    enableDestination: 'เปิดประเทศนี้สำหรับการชำระเงิน', pickup: 'อนุญาตให้นัดรับสินค้าในประเทศไทยฟรี',
    rateSource: 'อัตราแลกเปลี่ยนอ้างอิง', rateDate: 'วันที่', rateProvider: 'แหล่งข้อมูล', rateUnavailable: 'ขณะนี้ไม่มีอัตราแลกเปลี่ยนอ้างอิง',
    noBands: 'ยังไม่มีช่วงอัตรา เพิ่มอัตราเพื่อเปิดบริการนี้', saveShipping: 'บันทึกการจัดส่ง',
    paidOrders: 'คำสั่งซื้อที่ชำระแล้วและการจัดส่ง', noShipments: 'ไม่มีรายการที่ชำระแล้ว', status: 'สถานะ', fulfillment: 'วิธีรับสินค้า',
    subtotal: 'รวมสินค้า', shippingCharge: 'ค่าจัดส่ง', totalPaid: 'ยอดชำระทั้งหมด', referenceTHB: 'มูลค่าอ้างอิงเป็นบาท',
    referenceUnknown: 'ไม่มีมูลค่าอ้างอิงเป็นบาทสำหรับคำสั่งซื้อนี้', referenceDate: 'วันที่อัตราอ้างอิง', hold: 'ระงับการจัดส่ง',
    reasonRelease: 'เหตุผลในการยกเลิกการระงับ', reasonHold: 'เหตุผลในการระงับการจัดส่ง',
    holdPlaceholder: 'จำเป็น: ระบุเหตุผลเพื่อบันทึกในประวัติ', release: 'ยกเลิกการระงับ', holdAction: 'ระงับการจัดส่ง',
    confirmDispatch: 'ยืนยันที่อยู่ น้ำหนัก ค่าส่งที่ชำระ และบริษัทขนส่งแล้ว', shippingService: 'บริการจัดส่ง',
    trackingNumber: 'หมายเลขติดตาม', markShipped: 'บันทึกว่าจัดส่งแล้ว', markCollected: 'บันทึกว่ารับสินค้าแล้ว',
    trackingCollection: 'ติดตาม / รับสินค้า', openTracking: 'เปิดเว็บไซต์ติดตามพัสดุ', holdHistory: 'ประวัติการระงับและยกเลิก', held: 'ระงับ', released: 'ยกเลิกการระงับ',
    jobsTitle: 'รายการที่ต้องตรวจสอบ', noJobs: 'ไม่มีรายการที่ต้องตรวจสอบ', jobOrder: 'คำสั่งซื้อ', jobBooking: 'การจอง', jobQuote: 'ใบเสนอค่าจัดส่ง', jobPurpose: 'งาน', jobStatus: 'สถานะ',
    jobAttempts: 'จำนวนครั้งที่ลองใหม่', jobDate: 'กิจกรรมล่าสุด', jobProblem: 'ปัญหา', orderNotice: 'แจ้งเตือนคำสั่งซื้อ', bookingNotice: 'แจ้งเตือนการจอง',
    calendarSync: 'ซิงก์ปฏิทิน', shippingQuote: 'ใบเสนอค่าจัดส่ง', jobGeneric: 'อัปเดตร้านค้า',
    failed: 'ไม่สำเร็จ', review: 'ต้องตรวจสอบ',
  },
} as const;

export type AdminMessageKey = keyof typeof messages.en;
export function adminText(lang: AdminLocale, key: AdminMessageKey): string {
  return messages[lang][key];
}
