import test from 'node:test';
import assert from 'node:assert/strict';
import { createProfileHandlers } from '../src/pages/api/profile.ts';
import { HttpError } from '../src/lib/server/http.ts';
import { requireCustomer } from '../src/lib/server/customer.ts';

const customer = { id: 'customer-1', googleSubject: 'google-123', email: 'a@example.test', name: 'A', phone: '+66123456789', shippingAddress: null };
const deps = (overrides: Record<string, unknown> = {}) => ({
  requireCustomer: async () => customer,
  updateProfile: async (_id: string, name: string, phone: string, shippingAddress: unknown) => ({ ...customer, name, phone, shippingAddress }),
  ...overrides,
});

test('PATCH updates only the signed-in customer profile', async () => {
  let updatedId = '';
  const address = { line1: '1 Main Road', line2: '', city: 'Bangkok', state: 'Bangkok', postal_code: '10120', country: 'TH' };
  const handlers = createProfileHandlers(deps({ updateProfile: async (id: string, name: string, phone: string, shippingAddress: typeof address) => { updatedId = id; return { ...customer, name, phone, shippingAddress }; } }) as never);
  const response = await handlers.PATCH(new Request('https://site.test/api/profile', { method: 'PATCH', headers: { origin: 'https://site.test', 'content-type': 'application/json' }, body: JSON.stringify({ name: 'New Name', phone: '+66111111111', shippingAddress: address, customerId: 'customer-2' }) }));
  assert.equal(response.status, 200);
  assert.equal(updatedId, 'customer-1');
  assert.deepEqual(await response.json(), { customer: { id: 'customer-1', email: 'a@example.test', name: 'New Name', phone: '+66111111111', shippingAddress: address } });
  assert.match(response.headers.get('cache-control') ?? '', /private.*no-store/);
});

test('malformed, oversized and cross-origin profile writes are rejected', async () => {
  const handlers = createProfileHandlers(deps() as never);
  for (const request of [
    new Request('https://site.test/api/profile', { method: 'PATCH', headers: { origin: 'https://evil.test', 'content-type': 'application/json' }, body: '{"name":"X","phone":""}' }),
    new Request('https://site.test/api/profile', { method: 'PATCH', headers: { origin: 'https://site.test', 'content-type': 'application/json' }, body: '{bad' }),
    new Request('https://site.test/api/profile', { method: 'PATCH', headers: { origin: 'https://site.test', 'content-type': 'application/json', 'content-length': '5000' }, body: JSON.stringify({ name: 'A', phone: '' }) }),
    new Request('https://site.test/api/profile', { method: 'PATCH', headers: { origin: 'https://site.test', 'content-type': 'application/json' }, body: JSON.stringify({ name: 'A'.repeat(201), phone: '' }) }),
  ]) {
    const response = await handlers.PATCH(request);
    assert.ok([400, 403, 413, 415].includes(response.status));
  }
});

test('shipping address rejects partial or malformed data and clears when all fields are blank', async () => {
  let savedAddress: unknown = 'unchanged';
  const handlers = createProfileHandlers(deps({ updateProfile: async (_id: string, name: string, phone: string, shippingAddress: unknown) => {
    savedAddress = shippingAddress;
    return { ...customer, name, phone, shippingAddress };
  } }) as never);
  const send = (shippingAddress: unknown) => handlers.PATCH(new Request('https://site.test/api/profile', {
    method: 'PATCH',
    headers: { origin: 'https://site.test', 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'A', phone: null, shippingAddress }),
  }));
  const invalid = await send({ line1: '1 Main Road', line2: '', city: '', state: '', postal_code: '', country: '' });
  assert.equal(invalid.status, 400);
  assert.equal(savedAddress, 'unchanged');
  const unknownCountry = await send({ line1: '1 Main Road', line2: '', city: 'Bangkok', state: '', postal_code: '10120', country: 'ZZ' });
  assert.equal(unknownCountry.status, 400);
  assert.equal(savedAddress, 'unchanged');
  const empty = await send({ line1: '', line2: '', city: '', state: '', postal_code: '', country: '' });
  assert.equal(empty.status, 200);
  assert.equal(savedAddress, null);
  const valid = await send({ line1: '  1 Main Road ', line2: '', city: ' Bangkok ', state: '', postal_code: '10120', country: 'th' });
  assert.equal(valid.status, 200);
  assert.deepEqual(savedAddress, { line1: '1 Main Road', line2: '', city: 'Bangkok', state: '', postal_code: '10120', country: 'TH' });
});

test('GET requires a resolved Google customer and hides internal error details', async () => {
  const handlers = createProfileHandlers(deps({ requireCustomer: async () => { throw new HttpError(401, 'unauthenticated'); } }) as never);
  assert.equal((await handlers.GET(new Request('https://site.test/api/profile'))).status, 401);
  const broken = createProfileHandlers(deps({ requireCustomer: async () => { throw new Error('service-role-secret'); } }) as never);
  const response = await broken.GET(new Request('https://site.test/api/profile'));
  assert.equal(response.status, 503);
  assert.doesNotMatch(await response.text(), /service-role-secret/);
});

test('missing Google subject is unauthorized', async () => {
  await assert.rejects(() => requireCustomer(new Request('https://site.test/api/profile')), (error: unknown) => error instanceof HttpError && error.status === 401);
});
import { createProfileRoutes } from '../src/pages/api/profile.ts';
import { resolveCustomer, resolveCustomerRecord, updateCustomerProfile } from '../src/lib/server/customer.ts';

test('the Astro API route wrapper passes its request to the profile handler', async () => {
  let received: unknown;
  const routes = createProfileRoutes({
    requireCustomer: async (request: Request) => { received = request; return customer; },
    updateProfile: async () => customer,
  });
  const request = new Request('https://site.test/api/profile');
  const response = await routes.GET({ request } as never);
  assert.equal(response.status, 200);
  assert.equal(received, request);
});

test('customer RPC rows map Google identity and refreshed email to the public customer shape', () => {
  assert.deepEqual(resolveCustomerRecord({ id: 'cus-1', google_subject: 'google-123', email: 'new@example.test', name: 'Edited', phone: '+66123' }), {
    id: 'cus-1', googleSubject: 'google-123', email: 'new@example.test', name: 'Edited', phone: '+66123', shippingAddress: null,
  });
});

test('profile update RPC rows retain the customer identity while returning edited fields', async () => {
  const shippingAddress = { line1: '1 Main Road', line2: '', city: 'Bangkok', state: '', postal_code: '10120', country: 'TH' };
  const result = await updateCustomerProfile('cus-1', 'New name', '+66111', shippingAddress, async (name, args) => {
    assert.equal(name, 'update_customer_profile');
    assert.deepEqual(args, { p_customer_id: 'cus-1', p_name: 'New name', p_phone: '+66111', p_shipping_address: shippingAddress });
    return { id: 'cus-1', google_subject: 'google-123', email: 'current@example.test', name: 'New name', phone: '+66111', shipping_address: shippingAddress };
  });
  assert.deepEqual(result, { id: 'cus-1', googleSubject: 'google-123', email: 'current@example.test', name: 'New name', phone: '+66111', shippingAddress });
});

test('customer resolution sends the Google subject and latest verified email to the RPC', async () => {
  let argsSeen: Record<string, unknown> = {};
  const customer = await resolveCustomer('google-123', 'current@example.test', 'Edited name', async (name, args) => {
    assert.equal(name, 'resolve_customer');
    argsSeen = args;
    return { id: 'cus-1', google_subject: 'google-123', email: 'current@example.test', name: 'Edited name', phone: null };
  });
  assert.deepEqual(argsSeen, { p_google_subject: 'google-123', p_email: 'current@example.test', p_name: 'Edited name' });
  assert.deepEqual(customer, { id: 'cus-1', googleSubject: 'google-123', email: 'current@example.test', name: 'Edited name', phone: null, shippingAddress: null });
});
