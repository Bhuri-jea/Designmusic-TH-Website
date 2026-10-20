import { bookingUuid } from '../booking.ts';
import { HttpError } from './http.ts';
import { requireCustomer } from './customer.ts';
import { rpc, select, SupabaseRequestError } from './supabase.ts';

type BookingHistoryRow = { id: string; customer_id: string; status: string; archived_at: string | null };
type ArchiveDependencies = {
  customer: typeof requireCustomer;
  select: typeof select;
  rpc: typeof rpc;
};
const dependencies: ArchiveDependencies = { customer: requireCustomer, select, rpc };

export async function archiveCancelledBooking(request: Request, id: string, deps = dependencies) {
  const customer = await deps.customer(request);
  if (!bookingUuid(id)) throw new HttpError(400, 'invalid_booking_id');
  const rows = await deps.select<BookingHistoryRow>('bookings', { id: `eq.${id.toLowerCase()}`, customer_id: `eq.${customer.id}`, limit: '1' });
  const row = rows[0];
  if (!row || row.customer_id !== customer.id) throw new HttpError(404, 'booking_not_found');
  if (row.status !== 'cancelled') throw new HttpError(409, 'booking_not_archivable');
  try {
    const archived = await deps.rpc<{ id: string; customerId: string; status: string; archivedAt: string }>('archive_cancelled_booking', {
      p_customer_id: customer.id, p_booking_id: id.toLowerCase(),
    });
    if (!archived || archived.id !== id.toLowerCase() || archived.customerId !== customer.id || archived.status !== 'cancelled' || !archived.archivedAt) {
      throw new HttpError(409, 'booking_not_archivable');
    }
    return { id: archived.id, archivedAt: archived.archivedAt };
  } catch (error) {
    if (error instanceof SupabaseRequestError && error.databaseCode === 'P0002') throw new HttpError(404, 'booking_not_found');
    if (error instanceof SupabaseRequestError && error.databaseCode === '22023') throw new HttpError(409, 'booking_not_archivable');
    throw error;
  }
}
