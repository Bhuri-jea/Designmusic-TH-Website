import Stripe from 'stripe';
import { quoteCart, type Locale, type CatalogPrices } from '../catalog.ts';
import {trustedSkusFromInventory} from './catalog-trust.ts';
import { requireCustomer, type Customer } from './customer.ts';
import { getEnv } from './env.ts';
import { HttpError } from './http.ts';
import { rpc, select, SupabaseRequestError } from './supabase.ts';
import { quoteShipping } from './shipping.ts';
import type { OrderRecord } from './order-state.ts';
type Country = NonNullable<Stripe.Checkout.SessionCreateParams['shipping_address_collection']>['allowed_countries'][number];
type Sessions = {
    create: (params: Stripe.Checkout.SessionCreateParams, options: Stripe.RequestOptions) => Promise<Stripe.Checkout.Session>;
    retrieve: (id: string, options?: Stripe.RequestOptions) => Promise<Stripe.Checkout.Session>;
};
export type PaymentDependencies = {
    env: (name: string) => string | undefined;
    now: () => number;
    customer: (request: Request) => Promise<Customer>;
    rpc: <T>(name: string, args: Record<string, unknown>) => Promise<T>;
    select: <T>(table: string, filters: Record<string, string>) => Promise<T[]>;
    stripe: (key: string) => Sessions;
    shippingQuote?: typeof quoteShipping;
};
export const paymentDependencies: PaymentDependencies = {
    env: getEnv,
    now: Date.now,
    customer: requireCustomer,
    rpc,
    select,
    stripe: key => {
        const client = new Stripe(key, {
            maxNetworkRetries: 1, timeout: 20000
        });
        return {
            create: (params, options) => client.checkout.sessions.create(params, options),
            retrieve: (id, options) => client.checkout.sessions.retrieve(id, {expand:['payment_intent.latest_charge']}, options),
        };
    },
};
// This set matches stripe@22 SessionCreateParams.ShippingAddressCollection.AllowedCountry.
const countries = new Set('AC AD AE AF AG AI AL AM AO AQ AR AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CD CF CG CH CI CK CL CM CN CO CR CV CW CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HN HR HT HU ID IE IL IM IN IO IQ IS IT JE JM JO JP KE KG KH KI KM KN KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MK ML MM MN MO MQ MR MS MT MU MV MW MX MY MZ NA NC NE NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SZ TA TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG US UY UZ VA VC VE VG VN VU WF WS XK YE YT ZA ZM ZW ZZ'.split(' '));
export const SUPPORTED_SHIPPING_COUNTRIES=[...countries];
export function paymentCredentials(env = getEnv) {
    const key = env('STRIPE_SECRET_KEY');
    const webhookSecret = env('STRIPE_WEBHOOK_SECRET');
    const live = key?.startsWith('sk_live_') ?? false;
    if (!key || !/^sk_(test|live)_.+/.test(key) || !webhookSecret?.startsWith('whsec_') || live && env('PAYMENT_LIVE_ENABLED') !== 'true')
        throw new HttpError(503, 'payment_configuration_unavailable');
    return {
        key, webhookSecret, live
    };
}
export function paymentConfig(env = getEnv, configuredCountries?: string[]) {
    const credentials = paymentCredentials(env);
    const rawOrigin = env('APP_ORIGIN');
    let origin: URL;
    try {
        origin = new URL(rawOrigin!);
    }
    catch {
        throw new HttpError(503, 'payment_configuration_unavailable');
    }
    if (!rawOrigin || origin.username || origin.password || origin.search || origin.hash || origin.pathname !== '/' || !['https:', 'http:'].includes(origin.protocol) || origin.protocol === 'http:' && !['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname))
        throw new HttpError(503, 'payment_configuration_unavailable');
    const allowedCountries = configuredCountries ?? env('SHIPPING_ALLOWED_COUNTRIES')?.split(',').map(c => c.trim());
    if (!allowedCountries?.length || allowedCountries.some(c => !countries.has(c)))
        throw new HttpError(503, 'payment_configuration_unavailable');
    return {
        ...credentials, origin: origin.origin, allowedCountries: [...new Set(allowedCountries)].sort() as Country[]
    };
}
export function uuid(value: unknown): value is string {
    return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
async function checkoutFingerprint(quoteFingerprint: string, key: string): Promise<string> {
    const digest = async (value: string) => {
        const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
        return [...new Uint8Array(bytes)].map(byte => byte.toString(16).padStart(2, '0')).join('');
    };
    // A changed provider credential must never recreate an uncertain hold in another account.
    return digest(JSON.stringify(['checkout-v1', quoteFingerprint, await digest(key)]));
}
function activeUrl(url: string | null | undefined): string {
    try {
        const parsed = new URL(url!);
        if (parsed.protocol === 'https:' && !parsed.username && !parsed.password &&
            (parsed.hostname === 'checkout.stripe.com' || parsed.hostname.endsWith('.checkout.stripe.com'))) {
            return url!;
        }
    }
    catch {
    }
    throw new HttpError(503, 'checkout_unavailable');
}
export function sessionMatches(session: Stripe.Checkout.Session, order: OrderRecord, live: boolean, attached = true) {
    if (session.object !== 'checkout.session' || !['paid', 'unpaid', 'no_payment_required'].includes(session.payment_status) || session.mode !== 'payment' || session.livemode !== live || session.metadata?.order_id !== order.id || session.metadata?.customer_id !== order.customerId || session.client_reference_id !== order.id || session.currency !== order.currency || session.amount_total !== order.amountTotal || !session.id || attached && order.checkoutSessionId !== session.id)
        throw new HttpError(400, 'payment_metadata_mismatch');
}
export async function checkout(request: Request, body: Record<string, unknown>, deps = paymentDependencies): Promise<{
    orderId: string;
    url: string;
}> {
    // Validate credentials/origin before reads; destinations come from the storefront below.
    let config = paymentConfig(deps.env, ['TH']);
    const customer = await deps.customer(request);
    if (Object.keys(body).some(k => !['requestKey', 'locale', 'items','shippingCountry','shippingMethod','quoteId'].includes(k)) || !uuid(body.requestKey))
        throw new HttpError(400, 'invalid_checkout');
    let storefront:any=null,inventory:any[]=[];
    try{storefront=await deps.rpc('storefront_config',{});}catch{}
    try{inventory=await deps.select<any>('inventory',{});}catch{}
    config = paymentConfig(deps.env,Array.isArray(storefront?.allowed_countries)?storefront.allowed_countries:undefined);
    let approved:any=null;
    if(body.quoteId!==undefined){
        if(!uuid(body.quoteId))throw new HttpError(400,'invalid_shipping_quote');
        approved=await deps.rpc<any>('shipping_quote_record',{p_id:body.quoteId});
        if(!approved||approved.customerId!==customer.id)throw new HttpError(404,'shipping_quote_not_found');
        const expiry=Date.parse(approved.expiresAt);
        if(approved.status!=='quoted'||!Number.isFinite(expiry)||expiry<=deps.now()
          ||!Number.isSafeInteger(approved.shippingAmount)||approved.shippingAmount<=0
          ||approved.id!==body.requestKey||approved.locale!==body.locale
          ||approved.country!==body.shippingCountry||approved.shippingService!==body.shippingMethod
          ||!config.allowedCountries.includes(approved.country)||!Array.isArray(approved.items)
          ||!approved.address||approved.address.country!==approved.country)throw new HttpError(409,'shipping_quote_not_ready');
    }
    let quote;
    try {
        const prices:CatalogPrices={};for(const row of inventory){const value:CatalogPrices[string]={};if(Number.isInteger(row.price_usd_minor))value.usd=row.price_usd_minor;if(Number.isInteger(row.price_jpy))value.jpy=row.price_jpy;if(Number.isInteger(row.price_thb_minor))value.thb=row.price_thb_minor;if(Object.keys(value).length)prices[row.sku]=value;}
        if(approved)for(const item of approved.items){if(!Number.isSafeInteger(item.unitAmount)||item.unitAmount<=0)throw Error('invalid_quote_price');prices[item.sku]={[approved.currency]:item.unitAmount};}
        quote = await quoteCart({items: body.items, locale: body.locale, prices,catalogSkus:trustedSkusFromInventory(inventory,body.locale as Locale)});
    }
    catch {
        throw new HttpError(400, 'invalid_cart');
    }
    if(approved&&(quote.fingerprint!==approved.cartFingerprint||quote.totalAmount!==approved.amountSubtotal))throw new HttpError(409,'shipping_quote_changed');
    const method=body.shippingMethod??(body.shippingCountry==='TH'?'ems_local':'epacket');
    const shipping=approved?{currency:quote.currency,amount:approved.shippingAmount,weightGrams:approved.weightGrams,method:approved.shippingService as 'ems_local'|'ems_world',country:approved.country,subtotal:quote.totalAmount,total:quote.totalAmount+approved.shippingAmount,fxMarginApplied:quote.currency!=='thb',referenceThbRate:approved.referenceThbRate??null,referenceFxDate:approved.referenceFxDate??null}:await (deps.shippingQuote??quoteShipping)(body.items,body.locale,body.shippingCountry,method,undefined,customer.shippingAddress);
    if(shipping.currency!==quote.currency||shipping.subtotal!==quote.totalAmount)throw new HttpError(409,'cart_price_changed');
    const locale = body.locale as Locale;
    const prefix = locale === 'en' ? '' : `/${locale}`;
    const fingerprint = await checkoutFingerprint(JSON.stringify([quote.fingerprint,shipping.country,shipping.method,shipping.amount,shipping.weightGrams]), config.key);
    const order = await deps.rpc<OrderRecord>('reserve_order', {
        p_customer_id: customer.id,
        p_request_key: body.requestKey,
        p_fingerprint: fingerprint,
        p_currency: quote.currency,
        p_lines: quote.lines,
        p_amount_total: quote.totalAmount+shipping.amount,
        p_locale: locale,
        p_checkout_parameters: {
            customerEmail: customer.email,
            successUrl: `${config.origin}${prefix}/success?order_id={ORDER_ID}&session_id={CHECKOUT_SESSION_ID}`,
            cancelUrl: `${config.origin}${prefix}/cancel?order_id={ORDER_ID}`,
            allowedCountries:shipping.method!=='pickup'?[shipping.country]:[],
            shippingCountry:shipping.country,fulfillmentMethod:shipping.method,
            shippingAmount:shipping.amount,estimatedWeightGrams:shipping.weightGrams,
            referenceThbRate:shipping.referenceThbRate??(quote.currency==='thb'?1:null),referenceFxDate:shipping.referenceFxDate??null,
            ...(!approved&&shipping.country!=='TH'?{shippingAddressSnapshot:customer.shippingAddress,shippingRecipientSnapshot:{name:customer.name}}:{}),
            ...(approved?{shippingQuoteId:approved.id,shippingQuoteVersion:approved.version,shippingQuoteAddress:approved.address,shippingQuoteRecipient:approved.recipient}:{}),
            expiresAt: approved?Math.min(Math.floor(deps.now()/1000)+3600,Math.floor(Date.parse(approved.expiresAt)/1000)):Math.floor(deps.now() / 1000) + 3600,
        },
    });
    if (order.customerId !== customer.id || order.requestKey !== body.requestKey || order.fingerprint !== fingerprint)
        throw new HttpError(409, 'checkout_conflict');
    if (order.status !== 'pending' || order.cancellationStatus && order.cancellationStatus !== 'none')
        throw new HttpError(409, 'checkout_not_active');
    const stripe = deps.stripe(config.key);
    if (order.checkoutSessionId) {
        const session = await stripe.retrieve(order.checkoutSessionId);
        sessionMatches(session, order, config.live);
        if (session.status !== 'open')
            throw new HttpError(409, 'checkout_not_active');
        return {
            orderId: order.id, url: activeUrl(order.checkoutUrl)
        };
    }
    if (order.checkoutParameters.expiresAt - Math.floor(deps.now() / 1000) <= 1860)
        throw new HttpError(409, 'checkout_requires_review');
    const frozen = order.checkoutParameters;
    const params = {
        mode: 'payment',
        ui_mode: 'hosted_page',
        payment_method_types: ['card'],
        adaptive_pricing: {
            enabled: false
        },
        customer_email: frozen.customerEmail,
        client_reference_id: order.id,
        metadata: {
            order_id: order.id, customer_id: order.customerId
        },
        line_items: [...order.items.map(item => ({
            quantity: item.quantity,
            price_data: {
                currency: order.currency,
                unit_amount: item.unitAmount,
                product_data: {
                    name: item.name
                },
            },
        })), ...(shipping.amount>0?[{quantity:1,price_data:{currency:order.currency,unit_amount:shipping.amount,product_data:{name:`${shipping.method==='flash'?'Flash Express':shipping.method==='ems_world'?'Thailand Post EMS World':shipping.method==='epacket'?'Thailand Post ePacket':'Thailand Post EMS'} shipping`}}}]:[])],
        ...(shipping.method!=='pickup'&&!frozen.shippingQuoteId&&!frozen.shippingAddressSnapshot?{shipping_address_collection:{allowed_countries:[shipping.country] as Country[]}}:{billing_address_collection:'required'}),
        expires_at: frozen.expiresAt,
        locale: order.locale === 'zh-CN' ? 'zh' : order.locale,
        success_url: frozen.successUrl.replace('{ORDER_ID}', order.id),
        cancel_url: frozen.cancelUrl.replace('{ORDER_ID}', order.id),
    } satisfies Stripe.Checkout.SessionCreateParams;
    const session = await stripe.create(params, {
        idempotencyKey: `checkout:${order.id}`
    });
    sessionMatches(session, order, config.live, false);
    if (session.status !== 'open' || session.expires_at !== frozen.expiresAt)
        throw new HttpError(409, 'checkout_not_active');
    const url = activeUrl(session.url);
    const attached = await deps.rpc<OrderRecord>('attach_checkout_session', {
        p_order_id: order.id, p_session_id: session.id, p_checkout_url: url, p_expires_at: new Date(frozen.expiresAt * 1000).toISOString()
    });
    if (attached.customerId !== customer.id || attached.checkoutSessionId !== session.id || attached.status !== 'pending')
        throw new HttpError(503, 'checkout_attachment_pending');
    return {
        orderId: attached.id, url: activeUrl(attached.checkoutUrl)
    };
}

export async function resumeCheckout(request: Request, body: Record<string, unknown>, deps = paymentDependencies): Promise<{ orderId: string; url: string }> {
    const customer = await deps.customer(request);
    if (Object.keys(body).join(',') !== 'orderId' || !uuid(body.orderId))
        throw new HttpError(400, 'invalid_order_id');
    const rows = await deps.select<{ id: string }>('orders', {
        customer_id: `eq.${customer.id}`, id: `eq.${body.orderId}`
    });
    if (rows.length !== 1)
        throw new HttpError(404, 'order_not_found');
    const order = await deps.rpc<OrderRecord>('order_record', { p_id: body.orderId });
    if (!order || order.customerId !== customer.id)
        throw new HttpError(404, 'order_not_found');
    if (order.status !== 'pending' || order.cancellationStatus && order.cancellationStatus !== 'none'
        || order.refundStatus || (order.refundedAmount ?? 0) > 0)
        throw new HttpError(409, 'checkout_not_active');
    if (!order.checkoutSessionId || !order.checkoutUrl)
        throw new HttpError(409, 'checkout_requires_review');
    const config = paymentCredentials(deps.env);
    const session = await deps.stripe(config.key).retrieve(order.checkoutSessionId, { timeout: 8000, maxNetworkRetries: 0 });
    sessionMatches(session, order, config.live);
    const databaseExpiry = Date.parse(order.expiresAt);
    const providerExpiry = session.expires_at * 1000;
    if (!Number.isFinite(databaseExpiry) || !Number.isFinite(providerExpiry) || databaseExpiry !== providerExpiry)
        throw new HttpError(409, 'checkout_requires_review');
    if (session.status === 'expired' || providerExpiry <= deps.now())
        throw new HttpError(409, 'checkout_expired');
    if (session.status !== 'open' || session.payment_status !== 'unpaid')
        throw new HttpError(409, 'payment_confirmation_pending');
    return { orderId: order.id, url: activeUrl(order.checkoutUrl) };
}
const eventTypes = new Set(['checkout.session.completed', 'checkout.session.async_payment_succeeded', 'checkout.session.async_payment_failed', 'checkout.session.expired']);
export async function applySessionEvent(order: OrderRecord, session: Stripe.Checkout.Session, eventId: string, eventType: string, created: number, deps: PaymentDependencies) {
    const shipping = session.collected_information?.shipping_details;
    const pickup=order.checkoutParameters?.fulfillmentMethod==='pickup';
    const manual=order.checkoutParameters?.shippingQuoteId?{recipient:order.checkoutParameters.shippingQuoteRecipient,address:order.checkoutParameters.shippingQuoteAddress}:order.checkoutParameters.shippingAddressSnapshot?{recipient:order.checkoutParameters.shippingRecipientSnapshot,address:order.checkoutParameters.shippingAddressSnapshot}:null;
    try {
        await deps.rpc('apply_stripe_event', {
            p_event_id: eventId,
            p_event_type: eventType,
            p_order_id: order.id,
            p_session_id: session.id,
            p_currency: session.currency,
            p_amount_total: session.amount_total,
            p_payment_status: session.payment_status,
            p_shipping: session.payment_status === 'paid' && manual ? manual : session.payment_status === 'paid' && pickup ? {method:'pickup',recipient:{name:session.customer_details?.name??'Customer pickup'},address:{line1:'Customer pickup at Design Music',city:'Bangkok',state:'Bangkok',postal_code:'10120',country:'TH'}} : session.payment_status === 'paid' && shipping ? {
                recipient: {
                    name: shipping.name
                },
                address: shipping.address,
                phone: session.customer_details?.phone ?? null,
            } : null,
            p_event_created: new Date(created * 1000).toISOString(),
        });
        const intent=session.payment_intent;
        const paymentIntent=typeof intent==='string'?intent:intent?.id;
        if(session.payment_status==='paid'&&paymentIntent)await deps.rpc('link_order_payment',{p_order_id:order.id,p_payment_intent:paymentIntent});
    }
    catch (error) {
        if (error instanceof SupabaseRequestError && error.databaseCode === '40001')
            throw new HttpError(503, 'checkout_attachment_pending');
        throw error;
    }
}
export const MAX_WEBHOOK_BYTES = 262144;
export async function processWebhook(payload: string | Uint8Array, signature: string | null, deps = paymentDependencies): Promise<void> {
    if ((typeof payload === 'string' ? new TextEncoder().encode(payload).byteLength : payload.byteLength) > MAX_WEBHOOK_BYTES)
        throw new HttpError(413, 'body_too_large');
    const config = paymentCredentials(deps.env);
    let event: Stripe.Event;
    try {
        if (!signature)
            throw Error('missing');
        event = new Stripe(config.key).webhooks.constructEvent(payload, signature, config.webhookSecret);
    }
    catch {
        throw new HttpError(400, 'invalid_signature');
    }
    if (event.livemode !== config.live)
        throw new HttpError(400, 'payment_mode_mismatch');
    if (['refund.created','refund.updated','refund.failed','charge.refunded'].includes(event.type)) {
        const {syncRefundEvent}=await import('./refunds.ts');
        await syncRefundEvent(event);
        return;
    }
    if (!eventTypes.has(event.type))
        return;
    const session = event.data.object as Stripe.Checkout.Session;
    if (!uuid(session.metadata?.order_id))
        throw new HttpError(400, 'payment_metadata_mismatch');
    const order = await deps.rpc<OrderRecord | null>('order_record', {
        p_id: session.metadata.order_id
    });
    if (!order)
        throw new HttpError(400, 'payment_metadata_mismatch');
    if (!order.checkoutSessionId)
        throw new HttpError(503, 'checkout_attachment_pending');
    sessionMatches(session, order, config.live);
    if (['checkout.session.completed', 'checkout.session.async_payment_succeeded'].includes(event.type) && session.payment_status !== 'paid')
        return;
    if (event.type === 'checkout.session.expired' && (session.status !== 'expired' || session.payment_status === 'paid'))
        throw new HttpError(400, 'payment_metadata_mismatch');
    await applySessionEvent(order, session, event.id, event.type, event.created, deps);
}
export function publicOrder(order: OrderRecord, paymentSummary: {method:string;brand?:string|null;last4?:string|null}|null=null) {
    const subtotal=order.items.reduce((sum,item)=>sum+item.quantity*item.unitAmount,0);
    return {
        id: order.id,
        currency: order.currency,
        locale: order.locale,
        amountTotal: order.amountTotal,
        amountSubtotal: subtotal,
        shippingAmount: order.shippingAmount??order.checkoutParameters.shippingAmount??Math.max(0,order.amountTotal-subtotal),
        fulfillmentMethod:order.fulfillmentMethod??order.checkoutParameters.fulfillmentMethod??null,
        shippingCountry:order.checkoutParameters.shippingCountry??null,
        paymentSummary:order.status==='paid'?paymentSummary:null,
        items: order.items,
        status: order.status,
        cancellationStatus:order.cancellationStatus??'none',
        cancellationReason:order.cancellationReason??null,
        refundedAmount:order.refundedAmount??0,
        refundStatus:order.refundStatus??null,
        createdAt: order.createdAt,
        expiresAt: order.expiresAt,
        checkoutSessionId: order.checkoutSessionId,
        shipment: order.shipment ?? null,
    };
}
export async function ownedOrders(request: Request, id?: string, deps = paymentDependencies) {
    const customer = await deps.customer(request);
    if (id !== undefined && !uuid(id))
        throw new HttpError(400, 'invalid_order_id');
    const rows = await deps.select<{
        id: string;
    }>('orders', {
        customer_id: `eq.${customer.id}`, ...(id ? {
            id: `eq.${id}`
        } : {
            order: 'created_at.desc', limit: '100'
        })
    });
    if (id && rows.length === 0)
        throw new HttpError(404, 'order_not_found');
    const result = [];
    for (const row of rows) {
        const order = await deps.rpc<OrderRecord>('order_record', {
            p_id: row.id
        });
        if (!order || order.customerId !== customer.id)
            throw new HttpError(404, 'order_not_found');
        let summary:null|{method:string;brand?:string|null;last4?:string|null}=null;
        if(id&&order.status==='paid'&&order.checkoutSessionId){
          try{
            const config=paymentCredentials(deps.env),session=await deps.stripe(config.key).retrieve(order.checkoutSessionId,{timeout:8000,maxNetworkRetries:0});
            sessionMatches(session,order,config.live);
            const intent=session.payment_intent;
            const charge=typeof intent==='object'&&intent?intent.latest_charge:null;
            if(session.payment_status==='paid'&&typeof intent==='object'&&intent?.status==='succeeded'&&typeof charge==='object'&&charge?.paid&&charge.status==='succeeded'&&charge.currency===order.currency&&charge.amount===order.amountTotal){
              const detail=charge.payment_method_details;
              if(detail?.type==='card')summary={method:'card',brand:detail.card?.brand??null,last4:/^\d{4}$/.test(detail.card?.last4??'')?detail.card!.last4:null};
              else if(detail?.type)summary={method:detail.type};
            }
          }catch{/* The verified order remains readable if supplemental payment details cannot be fetched. */}
        }
        result.push(publicOrder(order,summary));
    }
    return result;
}

export async function ownedOrdersPage(request:Request,page=1,pageSize=5,deps=paymentDependencies){
 if(!Number.isSafeInteger(page)||page<1||page>1000000||![5,50].includes(pageSize))throw new HttpError(400,'invalid_order_page');
 const customer=await deps.customer(request);
 const result=await deps.rpc<{orders:OrderRecord[];total:number}>('customer_orders_page',{p_customer_id:customer.id,p_page:page,p_page_size:pageSize});
 if(!result||!Array.isArray(result.orders)||!Number.isSafeInteger(result.total)||result.total<0||result.orders.some(order=>order.customerId!==customer.id))throw new HttpError(503,'service_unavailable');
 return {orders:result.orders.map(order=>publicOrder(order)),pagination:{page,pageSize,total:result.total,totalPages:Math.max(1,Math.ceil(result.total/pageSize))}};
}
