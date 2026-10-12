import type { APIContext, APIRoute } from 'astro';
import type { Customer } from '../../lib/server/customer.ts';
import { requireCustomer, updateCustomerProfile } from '../../lib/server/customer.ts';
import { errorResponse, HttpError, jsonResponse, readSameOriginJson } from '../../lib/server/http.ts';

type ProfileDependencies = {
  requireCustomer: (request: Request) => Promise<Customer>;
  updateProfile: (customerId: string, name: string, phone: string | null) => Promise<Customer>;
};

const dependencies: ProfileDependencies = { requireCustomer, updateProfile: updateCustomerProfile };

function publicProfile(customer: Customer) {
  return { id: customer.id, email: customer.email, name: customer.name, phone: customer.phone };
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
        const updated = await deps.updateProfile(customer.id, body.name.trim(), body.phone === null || body.phone === '' ? null : (body.phone as string).trim());
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
