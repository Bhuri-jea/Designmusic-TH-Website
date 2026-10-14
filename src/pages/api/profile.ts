import type { APIContext, APIRoute } from 'astro';
import type { Customer, ShippingAddress } from '../../lib/server/customer.ts';
import { requireCustomer, updateCustomerProfile } from '../../lib/server/customer.ts';
import { errorResponse, HttpError, jsonResponse, readSameOriginJson } from '../../lib/server/http.ts';

type ProfileDependencies = {
  requireCustomer: (request: Request) => Promise<Customer>;
  updateProfile: (customerId: string, name: string, phone: string | null, shippingAddress: ShippingAddress | null) => Promise<Customer>;
};

const dependencies: ProfileDependencies = { requireCustomer, updateProfile: updateCustomerProfile };

function publicProfile(customer: Customer) {
  return { id: customer.id, email: customer.email, name: customer.name, phone: customer.phone, shippingAddress: customer.shippingAddress };
}

function parseShippingAddress(value: unknown): ShippingAddress | null {
  if (value === null) return null;
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new HttpError(400, 'invalid_profile');
  const address = value as Record<string, unknown>;
  const keys: (keyof ShippingAddress)[] = ['line1', 'line2', 'city', 'state', 'postal_code', 'country'];
  if (Object.keys(address).some(key => !keys.some(knownKey => knownKey === key)) || keys.some(key => typeof address[key] !== 'string')) {
    throw new HttpError(400, 'invalid_profile');
  }
  const normalized = Object.fromEntries(keys.map(key => [key, (address[key] as string).trim()])) as ShippingAddress;
  normalized.country = normalized.country.toUpperCase();
  if (keys.every(key => normalized[key] === '')) return null;
  if (!normalized.line1 || normalized.line1.length > 200 || !normalized.city || normalized.city.length > 120 ||
    !normalized.postal_code || normalized.postal_code.length > 32 || !/^[A-Z]{2}$/.test(normalized.country) ||
    normalized.line2.length > 200 || normalized.state.length > 120 ||
    keys.some(key => /[\u0000-\u001f\u007f]/.test(normalized[key]))) throw new HttpError(400, 'invalid_profile');
  return normalized;
}

export function createProfileHandlers(deps: ProfileDependencies = dependencies) {
  return {
    GET: async (request: Request): Promise<Response> => {
      try { return jsonResponse({ customer: publicProfile(await deps.requireCustomer(request)) }); }
      catch (error) { return errorResponse(error); }
    },
    PATCH: async (request: Request): Promise<Response> => {
      try {
        const customer = await deps.requireCustomer(request);
        const body = await readSameOriginJson(request);
        if (typeof body.name !== 'string' || body.name.trim().length < 1 || body.name.trim().length > 120) throw new HttpError(400, 'invalid_profile');
        if (body.phone !== null && (typeof body.phone !== 'string' || body.phone.length > 40 || !/^[+0-9() .-]*$/.test(body.phone))) throw new HttpError(400, 'invalid_profile');
        const shippingAddress = body.shippingAddress === undefined ? customer.shippingAddress : parseShippingAddress(body.shippingAddress);
        const updated = await deps.updateProfile(customer.id, body.name.trim(), body.phone === null || body.phone === '' ? null : (body.phone as string).trim(), shippingAddress);
        return jsonResponse({ customer: publicProfile(updated) });
      } catch (error) { return errorResponse(error); }
    },
  };
}

export function createProfileRoutes(deps: ProfileDependencies = dependencies) {
  const handlers = createProfileHandlers(deps);
  return {
    GET: ({ request }: Pick<APIContext, 'request'>) => handlers.GET(request),
    PATCH: ({ request }: Pick<APIContext, 'request'>) => handlers.PATCH(request),
  };
}

const routes = createProfileRoutes();
export const GET: APIRoute = (context) => routes.GET(context);
export const PATCH: APIRoute = (context) => routes.PATCH(context);
