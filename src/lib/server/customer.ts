import { HttpError } from './http.ts';
import { rpc } from './supabase.ts';

type SessionLike = { user?: { name?: string | null; image?: string | null; email?: string | null }; googleSubject?: string | null };
type CustomerRow = { id: string; google_subject?: string; googleSubject?: string; email: string; name: string; phone: string | null };
type CustomerRpc = (name: string, args: Record<string, unknown>) => Promise<unknown>;

export type Customer = { id: string; googleSubject: string; email: string; name: string; phone: string | null };

export async function getOptionalSession(request: Request): Promise<SessionLike | null> {
  try { const { getSession } = await import('auth-astro/server'); return await getSession(request) as SessionLike | null; } catch { return null; }
}

export function resolveCustomerRecord(value: unknown): Customer {
  const row = (Array.isArray(value) ? value[0] : value) as CustomerRow | null;
  const googleSubject = row?.google_subject ?? row?.googleSubject;
  if (!row || typeof row.id !== 'string' || typeof googleSubject !== 'string' || typeof row.email !== 'string' || typeof row.name !== 'string') {
    throw new Error('Customer RPC returned an invalid row');
  }
  return { id: row.id, googleSubject, email: row.email, name: row.name, phone: row.phone ?? null };
}

export async function resolveCustomer(googleSubject: string, email: string, name: string, rpcCall: CustomerRpc = rpc): Promise<Customer> {
  const row = await rpcCall('resolve_customer', {
    p_google_subject: googleSubject,
    p_email: email,
    p_name: name,
  });
  return resolveCustomerRecord(row);
}

export async function updateCustomerProfile(customerId: string, name: string, phone: string | null, rpcCall: CustomerRpc = rpc): Promise<Customer> {
  const row = await rpcCall('update_customer_profile', {
    p_customer_id: customerId, p_name: name, p_phone: phone,
  });
  return resolveCustomerRecord(row);
}

export async function requireCustomer(request: Request): Promise<Customer> {
  const session = await getOptionalSession(request);
  const subject = session?.googleSubject;
  if (!subject || typeof subject !== 'string') throw new HttpError(401, 'unauthenticated');
  return resolveCustomer(subject, session.user?.email ?? '', session.user?.name?.trim() ?? '');
}
