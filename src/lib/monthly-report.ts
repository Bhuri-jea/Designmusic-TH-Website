export type MonthlySummary = {
  currency: string; paidOrders: number; refundedOrders: number;
  estimatedPaidDates: number; unknownPaidDates: number; unallocatedRefunds: number;
  merchandiseGrossMinor: number; merchandiseNetMinor: number;
  shippingCollectedMinor: number; shippingRefundedMinor: number; refundMinor: number;
};
export type BahtTotals = {
  merchandiseGrossTHB: number; merchandiseNetTHB: number;
  shippingCollectedTHB: number; shippingRefundedTHB: number; refundTHB: number;
};
export type BahtSummary = {
  status: 'available' | 'stale' | 'unavailable';
  rates: { usdThb: number; jpyThb: number; date: string; source: 'Frankfurter' } | null;
  totals: BahtTotals | null;
};
