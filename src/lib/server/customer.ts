import { HttpError } from './http.ts';
import { rpc } from './supabase.ts';
import { subjectFromToken } from './identity.ts';

type SessionLike = { user?: { name?: string | null; image?: string | null; email?: string | null }; googleSubject?: string; supabaseSubject?: string };
export type ShippingAddress = { line1: string; line2: string; city: string; state: string; postal_code: string; country: string };
type CustomerRow = { id: string; google_subject?: string; googleSubject?: string; email: string; name: string; phone: string | null; shipping_address?: ShippingAddress | null; shippingAddress?: ShippingAddress | null };
type CustomerRpc = (name: string, args: Record<string, unknown>) => Promise<unknown>;

export type Customer = { id: string; googleSubject: string; email: string; name: string; phone: string | null; shippingAddress: ShippingAddress | null };

export async function getOptionalSession(request: Request): Promise<SessionLike | null> {
  try { const { getSession } = await import('auth-astro/server'); return await getSession(request) as SessionLike | null; } catch { return null; }
}

export function resolveCustomerRecord(value: unknown): Customer {
  const row = (Array.isArray(value) ? value[0] : value) as CustomerRow | null;
  const googleSubject = row?.google_subject ?? row?.googleSubject;
  if (!row || typeof row.id !== 'string' || typeof googleSubject !== 'string' || typeof row.email !== 'string' || typeof row.name !== 'string') {
    throw new Error('Customer RPC returned an invalid row');
  }
  return {
    id: row.id,
    googleSubject,
    email: row.email,
    name: row.name,
    phone: row.phone ?? null,
    shippingAddress: row.shipping_address ?? row.shippingAddress ?? null,
  };
}

export async function resolveCustomer(googleSubject: string, email: string, name: string, rpcCall: CustomerRpc = rpc): Promise<Customer> {
  const row = await rpcCall('resolve_customer', {
    p_google_subject: googleSubject,
    p_email: email,
    p_name: name,
  });
  return resolveCustomerRecord(row);
}

export async function updateCustomerProfile(customerId: string, name: string, phone: string | null, shippingAddress: ShippingAddress | null, rpcCall: CustomerRpc = rpc): Promise<Customer> {
  const row = await rpcCall('update_customer_profile', {
    p_customer_id: customerId, p_name: name, p_phone: phone, p_shipping_address: shippingAddress,
  });
  return resolveCustomerRecord(row);
}

export async function requireCustomer(request: Request): Promise<Customer> {
  const session = await getOptionalSession(request);
  // The legacy google_subject column also stores namespaced Supabase Auth IDs.
  const subject = session ? subjectFromToken(session) : undefined;
  if (!session || !subject || typeof subject !== 'string') throw new HttpError(401, 'unauthenticated');
  return resolveCustomer(subject, session.user?.email ?? '', session.user?.name?.trim() ?? '');
}
