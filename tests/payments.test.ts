import { quoteCart } from '../src/lib/catalog.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import Stripe from 'stripe';
import { checkout, resumeCheckout, paymentConfig, processWebhook, ownedOrders, ownedOrdersPage, applySessionEvent, type PaymentDependencies } from '../src/lib/server/payments.ts';
import { reconcilePayments } from '../src/lib/server/reconciliation.ts';
import { HttpError } from '../src/lib/server/http.ts';
import { SupabaseRequestError } from '../src/lib/server/supabase.ts';
import type { OrderRecord } from '../src/lib/server/order-state.ts';
const customer = {
    id: '11111111-1111-4111-8111-111111111111', googleSubject: 'google-1', email: 'buyer@example.test', name: 'Buyer', phone: null, shippingAddress: null
};
const key = '22222222-2222-4222-8222-222222222222';
const values: Record<string, string> = {
    STRIPE_SECRET_KEY: 'sk_test_dummy', STRIPE_WEBHOOK_SECRET: 'whsec_dummy', APP_ORIGIN: 'https://shop.example.test', SHIPPING_ALLOWED_COUNTRIES: 'TH,JP'
};
const sdk = new Stripe('sk_test_dummy');
const body = {
    requestKey: key, locale: 'zh-CN', items: [{
            productId: 'saxophone-end-plug', variant: 'plain', quantity: 2
        }], shippingCountry: 'TH', shippingMethod: 'ems_local'
};
function fixture() {
    let order: OrderRecord | null = null;
    const calls: {
        name: string;
        args: Record<string, unknown>;
    }[] = [];
    const creates: unknown[] = [];
    const deps: PaymentDependencies = {
        env: n => values[n], now: () => Date.now(), customer: async () => customer,
        shippingQuote: async (_items, locale, country, method) => ({
            currency: locale === 'ja' ? 'jpy' : locale === 'th' ? 'thb' : 'usd',
            amount: 0, weightGrams: 20, method: method as 'ems_local', country: country as string,
            subtotal: locale === 'ja' ? 4400 : locale === 'th' ? 104000 : 3000,
            total: locale === 'ja' ? 4400 : locale === 'th' ? 104000 : 3000, fxMarginApplied: false
        }),
        rpc: async <T>(name: string, args: Record<string, unknown>) => {
            calls.push({
                name, args
            });
            if (name === 'storefront_config') return {
                allowed_countries: ['TH'], pickup_enabled: true,
                shipping_rates: { 'TH:ems_local': [{ maxGrams: 30000, thbMinor: 0 }] }
            } as T;
            if (name === 'reserve_order') {
                order ??= {
                    id: key, customerId: customer.id, requestKey: key, fingerprint: args.p_fingerprint as string, currency: args.p_currency as OrderRecord['currency'], locale: args.p_locale as OrderRecord['locale'], items: args.p_lines as OrderRecord['items'], amountTotal: args.p_amount_total as number, status: 'pending', createdAt: new Date().toISOString(), expiresAt: new Date((args.p_checkout_parameters as OrderRecord['checkoutParameters']).expiresAt * 1000).toISOString(), checkoutParameters: args.p_checkout_parameters as OrderRecord['checkoutParameters'], checkoutSessionId: null, checkoutUrl: null
                };
                return order as T;
            }
            if (name === 'attach_checkout_session') {
                order = {
                    ...order!, checkoutSessionId: args.p_session_id as string, checkoutUrl: args.p_checkout_url as string
                };
                return order as T;
            }
            if (name === 'order_record')
                return order as T;
            return {} as T;
        },
        select: async <T>(table: string, filters: Record<string, string>) => {
            if (table === 'inventory') return [{
                sku: 'endplug-plain', on_hand: 20, reserved: 0, weight_grams: 10,
                price_usd_minor: 1500, price_jpy: 2200, price_thb_minor: 52000
            }] as T[];
            assert.equal(filters.customer_id, `eq.${customer.id}`);
            return (order ? [{
                    id: order.id
                }] : []) as T[];
        },
        stripe: () => ({
            create: async (params, options) => {
                creates.push({
                    params, options
                });
                return {
                    ...session(order!), url: 'https://checkout.stripe.com/c/pay', expires_at: params.expires_at!, status: 'open'
                } as unknown as Stripe.Checkout.Session;
            }, retrieve: async () => ({
                ...session(order!), status: 'open', payment_status: 'unpaid'
            } as unknown as Stripe.Checkout.Session)
        })
    };
    return {
        deps, calls, creates, get order() {
            return order;
        }, set order(value) {
            order = value;
        }
    };
}
function signed(session: Record<string, unknown>, overrides = {}) {
    const payload = JSON.stringify({
        id: 'evt_1', object: 'event', created: Math.floor(Date.now() / 1000), type: 'checkout.session.completed', livemode: false, data: {
            object: session
        }, ...overrides
    });
    return {
        payload, signature: sdk.webhooks.generateTestHeaderString({
            payload, secret: 'whsec_dummy'
        })
    };
}
test('a cancellation request blocks reopening or creating another Checkout session for that order',async()=>{
 const f=fixture();const request=new Request('https://shop.example.test/api/checkout');
 await checkout(request,body,f.deps);f.order!.cancellationStatus='requested';
 await assert.rejects(checkout(request,body,f.deps),error=>(error as any).code==='checkout_not_active');
 assert.equal(f.creates.length,1);
});

test('customer resumes the same verified open Checkout session without creating another session',async()=>{
 const f=fixture();const request=new Request('https://shop.example.test/api/orders/resume-checkout');
 await checkout(request,body,f.deps);const created=f.creates.length;
 const first=await resumeCheckout(request,{orderId:key},f.deps);
 const second=await resumeCheckout(request,{orderId:key},f.deps);
 assert.deepEqual(first,{orderId:key,url:'https://checkout.stripe.com/c/pay'});
 assert.deepEqual(second,first);assert.equal(f.creates.length,created);
});

test('new checkout policy does not return an open session after stock becomes unavailable',async()=>{
 const f=fixture();const request=new Request('https://shop.example.test/api/checkout');
 await checkout(request,body,f.deps);
 assert.equal(f.order?.checkoutParameters.stockPolicy,'pay_to_secure');
 const previousSelect=f.deps.select;
 f.deps.select=async <T>(table:string,filters:Record<string,string>)=>table==='inventory'
  ? [{sku:'endplug-plain',on_hand:1,reserved:0}] as T[]
  : previousSelect<T>(table,filters);
 await assert.rejects(resumeCheckout(request,{orderId:key},f.deps),error=>(error as HttpError).code==='stock_unavailable');
 await assert.rejects(checkout(request,body,f.deps),error=>(error as HttpError).code==='stock_unavailable');
 assert.equal(f.creates.length,1);
});

test('resume Checkout verifies ownership and rejects inactive financial states',async()=>{
 const request=new Request('https://shop.example.test/api/orders/resume-checkout');
 for(const patch of [{customerId:'other'},{status:'paid'},{cancellationStatus:'requested'},{refundStatus:'pending'},{refundedAmount:1}]){
  const f=fixture();await checkout(request,body,f.deps);f.order={...f.order!,...patch} as OrderRecord;
  await assert.rejects(resumeCheckout(request,{orderId:key},f.deps),error=>['order_not_found','checkout_not_active'].includes((error as any).code));
 }
});

test('resume Checkout distinguishes provider confirmation, expiry and review states',async()=>{
 const request=new Request('https://shop.example.test/api/orders/resume-checkout');
 for(const [providerPatch,code] of [
  [{status:'complete',payment_status:'paid'},'payment_confirmation_pending'],
  [{status:'complete',payment_status:'unpaid'},'payment_confirmation_pending'],
  [{status:'expired',payment_status:'unpaid'},'checkout_expired'],
 ] as const){
  const f=fixture();await checkout(request,body,f.deps);
  f.deps.stripe=()=>({create:async()=>{throw Error('must not create');},retrieve:async()=>({...session(f.order!),...providerPatch}) as any});
  await assert.rejects(resumeCheckout(request,{orderId:key},f.deps),error=>(error as any).code===code);
 }
 const missing=fixture();await checkout(request,body,missing.deps);missing.order={...missing.order!,checkoutSessionId:null,checkoutUrl:null};
 await assert.rejects(resumeCheckout(request,{orderId:key},missing.deps),error=>(error as any).code==='checkout_requires_review');
});

test('resume Checkout rejects expired, mismatched and unsafe stored sessions',async()=>{
 const request=new Request('https://shop.example.test/api/orders/resume-checkout');
 for(const mode of ['past','mismatch','unsafe']){
  const f=fixture();await checkout(request,body,f.deps);
  if(mode==='past')f.deps.now=()=>Date.parse(f.order!.expiresAt)+1;
  if(mode==='mismatch')f.deps.stripe=()=>({create:async()=>{throw Error('unused');},retrieve:async()=>({...session(f.order!),status:'open',payment_status:'unpaid',amount_total:1}) as any});
  if(mode==='unsafe')f.order={...f.order!,checkoutUrl:'https://evil.example/pay'};
  await assert.rejects(resumeCheckout(request,{orderId:key},f.deps));
 }
});
function session(order: OrderRecord) {
    return {
        object: 'checkout.session', id: 'cs_1', client_reference_id: order.id, mode: 'payment', status: 'complete', livemode: false, payment_status: 'paid', metadata: {
            order_id: order.id, customer_id: order.customerId
        }, currency: 'usd', amount_total: 3000, expires_at: Math.floor(Date.parse(order.expiresAt) / 1000), collected_information: {
            shipping_details: {
                name: 'Buyer', address: {
                    line1: '1 Street', city: 'Bangkok', postal_code: '10000', country: 'TH'
                }
            }
        }
    };
}
test('auth and private configuration fail before stock reservation', async () => {
    const f = fixture();
    f.deps.customer = async () => {
        throw new HttpError(401, 'unauthenticated');
    };
    await assert.rejects(checkout(new Request('https://shop.example.test/api/checkout'), body, f.deps), /unauthenticated/);
    assert.equal(f.calls.length, 0);
    const overrides: Record<string, string>[] = [{
            STRIPE_SECRET_KEY: ''
        }, {
            STRIPE_SECRET_KEY: 'sk_live_dummy'
        }, {
            APP_ORIGIN: 'https://shop.example.test/path'
        }];
    for (const override of overrides) {
        const g = fixture();
        g.deps.env = n => ({
            ...values, ...override
        })[n];
        await assert.rejects(checkout(new Request('https://shop.example.test'), body, g.deps));
        assert.equal(g.calls.length, 0);
    }
});
test('canonical hosted card checkout freezes locale amounts and retry parameters', async () => {
    const f = fixture();
    await checkout(new Request('https://evil-host.test'), body, f.deps);
    const first = f.creates[0] as {
        params: Stripe.Checkout.SessionCreateParams;
        options: Stripe.RequestOptions;
    };
    assert.equal(first.params.locale, 'zh');
    assert.equal(first.params.ui_mode, 'hosted_page');
    assert.deepEqual(first.params.payment_method_types, ['card']);
    assert.deepEqual(first.params.adaptive_pricing, {
        enabled: false
    });
    assert.equal(first.params.line_items![0].price_data!.unit_amount, 1500);
    assert.equal(first.params.line_items![0].quantity, 2);
    assert.deepEqual(first.params.metadata, {
        order_id: key, customer_id: customer.id
    });
    assert.equal(first.options.idempotencyKey, `checkout:${key}`);
    assert.ok(first.params.success_url!.startsWith('https://shop.example.test/zh-CN/success'));
    f.order = {
        ...f.order!, checkoutSessionId: null, checkoutUrl: null
    };
    f.deps.customer = async () => ({
        ...customer, email: 'changed@example.test'
    });
    f.deps.env = n => ({
        ...values, APP_ORIGIN: 'https://new.example.test', SHIPPING_ALLOWED_COUNTRIES: 'US'
    })[n];
    await checkout(new Request('https://shop.example.test'), body, f.deps);
    assert.deepEqual(f.creates[1], f.creates[0]);
});
test('uncertain create preserves hold and refuses new creation outside frozen window', async () => {
    const f = fixture();
    f.deps.stripe = () => ({
        create: async () => {
            throw new Error('secret transport timeout');
        }, retrieve: async () => {
            throw new Error('unused');
        }
    });
    await assert.rejects(checkout(new Request('https://shop.example.test'), body, f.deps));
    assert.deepEqual(f.calls.map(c => c.name).filter(name => name === 'reserve_order'), ['reserve_order']);
    f.deps.now = () => f.order!.checkoutParameters.expiresAt * 1000 - 1800000;
    await assert.rejects(checkout(new Request('https://shop.example.test'), body, f.deps), /checkout_requires_review/);
    assert.equal(f.calls.filter(c => c.name.includes('release')).length, 0);
});
test('attached session retrieval reuses URL while closed sessions never return active checkout', async () => {
    const f = fixture();
    await checkout(new Request('https://shop.example.test'), body, f.deps);
    await checkout(new Request('https://shop.example.test'), body, f.deps);
    assert.equal(f.creates.length, 1);
    f.deps.stripe = () => ({
        create: async () => {
            throw Error('unexpected');
        }, retrieve: async () => ({
            ...session(f.order!), status: 'expired'
        } as unknown as Stripe.Checkout.Session)
    });
    await assert.rejects(checkout(new Request('https://shop.example.test'), body, f.deps), /checkout_not_active/);
});
test('real SDK raw signatures reject forged modified stale and oversized payloads', async () => {
    const f = fixture();
    await checkout(new Request('https://shop.example.test'), body, f.deps);
    const e = signed(session(f.order!));
    await processWebhook(e.payload, e.signature, f.deps);
    for (const [raw, signature] of [[e.payload + ' ', e.signature], [e.payload, 'forged'], [e.payload, sdk.webhooks.generateTestHeaderString({
                payload: e.payload, secret: 'whsec_dummy', timestamp: 1
            })], ['x'.repeat(262145), e.signature]])
        await assert.rejects(processWebhook(raw, signature, f.deps));
    assert.equal(f.calls.filter(c => c.name === 'apply_stripe_event').length, 1);
});
test('signed metadata mode amount and attachment races reject without consuming events', async () => {
    const f = fixture();
    await checkout(new Request('https://shop.example.test'), body, f.deps);
    for (const override of [{
            livemode: true
        }, {
            mode: 'subscription'
        }, {
            currency: 'thb'
        }, {
            amount_total: 1
        }, {
            id: 'cs_other'
        }, {
            metadata: {
                order_id: key, customer_id: 'other'
            }
        }]) {
        const e = signed({
            ...session(f.order!), ...override
        });
        await assert.rejects(processWebhook(e.payload, e.signature, f.deps));
    }
    const wrongEvent = signed(session(f.order!), {
        livemode: true
    });
    await assert.rejects(processWebhook(wrongEvent.payload, wrongEvent.signature, f.deps));
    f.order = {
        ...f.order!, checkoutSessionId: null
    };
    const e = signed(session(f.order!));
    await assert.rejects(processWebhook(e.payload, e.signature, f.deps), /checkout_attachment_pending/);
    assert.equal(f.calls.filter(c => c.name === 'apply_stripe_event').length, 0);
});
test('unpaid completion does not fulfill and shipping snapshots never substitute billing', async () => {
    const f = fixture();
    await checkout(new Request('https://shop.example.test'), body, f.deps);
    let e = signed({
        ...session(f.order!), payment_status: 'unpaid'
    });
    await processWebhook(e.payload, e.signature, f.deps);
    assert.equal(f.calls.filter(c => c.name === 'apply_stripe_event').length, 0);
    e = signed({
        ...session(f.order!), collected_information: null, customer_details: {
            address: {
                line1: 'billing'
            }
        }
    });
    await processWebhook(e.payload, e.signature, f.deps);
    assert.equal(f.calls.at(-1)!.args.p_shipping, null);
    const originalRpc = f.deps.rpc;
    f.deps.rpc = async <T>(name: string, args: Record<string, unknown>) => {
        if (name === 'apply_stripe_event')
            throw new SupabaseRequestError(502, '40001');
        return originalRpc<T>(name, args);
    };
    await assert.rejects(processWebhook(e.payload, e.signature, f.deps), /checkout_attachment_pending/);
});
test('owned reads filter customer and exclude private frozen configuration', async () => {
    const f = fixture();
    await checkout(new Request('https://shop.example.test'), body, f.deps);
    const result = await ownedOrders(new Request('https://shop.example.test'), key, f.deps);
    assert.equal(result.length, 1);
    for (const field of ['checkoutParameters', 'requestKey', 'fingerprint', 'customerId'])
        assert.equal(field in result[0], false);
    f.order = {
        ...f.order!, customerId: 'other'
    };
    await assert.rejects(ownedOrders(new Request('https://shop.example.test'), key, f.deps), /order_not_found/);
});
test('paid order summary exposes only validated payment method details and frozen totals',async()=>{
 const f=fixture();await checkout(new Request('https://shop.example.test'),body,f.deps);f.order={...f.order!,status:'paid'};
 const original=f.deps.stripe('dummy');
 f.deps.stripe=()=>({...original,retrieve:async()=>({...session(f.order!),payment_intent:{status:'succeeded',latest_charge:{paid:true,status:'succeeded',currency:'usd',amount:3000,payment_method_details:{type:'card',card:{brand:'visa',last4:'4242',fingerprint:'private'}}}}} as unknown as Stripe.Checkout.Session)});
 const [order]=await ownedOrders(new Request('https://shop.example.test'),key,f.deps);
 assert.equal(order.amountSubtotal,3000);assert.equal(order.shippingAmount,0);assert.equal(order.amountTotal,3000);
 assert.deepEqual(order.paymentSummary,{method:'card',brand:'visa',last4:'4242'});assert.equal(JSON.stringify(order).includes('fingerprint'),false);
 f.deps.stripe=()=>({...original,retrieve:async()=>{throw Error('provider_unavailable');}});
 assert.equal((await ownedOrders(new Request('https://shop.example.test'),key,f.deps))[0].paymentSummary,null);
});
test('reconciliation recovers verified complete payments and only releases retrieved expiry', async () => {
    const f = fixture();
    await checkout(new Request('https://shop.example.test'), body, f.deps);
    f.deps.select = async <T>() => [{
            id: key
        }] as T[];
    for (const status of ['complete', 'open']) {
        f.deps.stripe = () => ({
            create: async () => {
                throw Error('unused');
            }, retrieve: async () => ({
                ...session(f.order!), status
            } as unknown as Stripe.Checkout.Session)
        });
        await reconcilePayments(f.deps);
    }
    assert.equal(f.calls.filter(c => c.name === 'apply_stripe_event').length, 1);
    assert.equal(f.calls.find(c=>c.name==='apply_stripe_event')!.args.p_event_id,'reconcile:paid:cs_1');
    f.deps.stripe = () => ({
        create: async () => {
            throw Error('unused');
        }, retrieve: async () => ({
            ...session(f.order!), status: 'expired', payment_status: 'unpaid'
        } as unknown as Stripe.Checkout.Session)
    });
    await reconcilePayments(f.deps);
    assert.equal(f.calls.filter(c=>c.name==='apply_stripe_event').at(-1)!.args.p_event_type, 'checkout.session.expired');
    f.order = {
        ...f.order!, checkoutSessionId: null
    };
    await reconcilePayments(f.deps);
    assert.equal(f.calls.filter(c => c.name === 'apply_stripe_event').length, 2);
});
test('signed failure and expiration dispatch exact event IDs; unrelated events are no-ops', async () => {
    const f = fixture();
    await checkout(new Request('https://shop.example.test'), body, f.deps);
    for (const type of ['checkout.session.async_payment_failed', 'checkout.session.expired']) {
        const e = signed({
            ...session(f.order!), status: type.endsWith('expired') ? 'expired' : 'complete', payment_status: 'unpaid'
        }, {
            type, id: `evt_${type}`
        });
        await processWebhook(e.payload, e.signature, f.deps);
        assert.equal(f.calls.at(-1)!.args.p_event_id, `evt_${type}`);
        assert.equal(f.calls.at(-1)!.args.p_event_type, type);
    }
    const before = f.calls.length;
    const other = signed({
        object: 'charge'
    }, {
        type: 'charge.succeeded'
    });
    await processWebhook(other.payload, other.signature, f.deps);
    assert.equal(f.calls.length, before);
});
test('checkout cart has a route-specific bound while profile retains 2KB', async () => {
    const { readSameOriginJson } = await import('../src/lib/server/http.ts');
    const cart = {
        ...body, items: Array.from({
            length: 20
        }, () => ({
            productId: 'shakuhachi', variant: 'standard', options: {
                toneHoles: 'standard', mouthpiece: 'modern'
            }, quantity: 1
        }))
    };
    const make = () => new Request('https://shop.example.test/api/checkout', {
        method: 'POST', headers: {
            origin: 'https://shop.example.test', 'content-type': 'application/json'
        }, body: JSON.stringify(cart)
    });
    await assert.rejects(readSameOriginJson(make()), /body_too_large/);
    assert.deepEqual(await readSameOriginJson(make(), 16384), cart);
});
test('webhook raw reader accepts origin-free bytes and rejects streamed overflow', async () => {
    const { rawWebhookBody } = await import('../src/pages/api/stripe-webhook.ts');
    const bytes = new TextEncoder().encode('{ "untouched": true }');
    assert.deepEqual(await rawWebhookBody(new Request('https://shop.example.test/api/stripe-webhook', {
        method: 'POST', body: bytes
    })), bytes);
    await assert.rejects(rawWebhookBody(new Request('https://shop.example.test/api/stripe-webhook', {
        method: 'POST', body: 'x'.repeat(262145)
    })), /body_too_large/);
});
test('signed webhook can recover held orders when checkout shipping configuration is unavailable', async () => {
    const f = fixture();
    await checkout(new Request('https://shop.example.test'), body, f.deps);
    f.deps.env = n => n === 'SHIPPING_ALLOWED_COUNTRIES' ? undefined : values[n];
    const e = signed(session(f.order!));
    await processWebhook(e.payload, e.signature, f.deps);
    assert.equal(f.calls.at(-1)!.name, 'apply_stripe_event');
});
test('invalid provider payment status cannot release stock through a signed expiration', async () => {
    const f = fixture();
    await checkout(new Request('https://shop.example.test'), body, f.deps);
    const e = signed({
        ...session(f.order!), status: 'expired', payment_status: 'unexpected'
    }, {
        type: 'checkout.session.expired'
    });
    await assert.rejects(processWebhook(e.payload, e.signature, f.deps), /payment_metadata_mismatch/);
    assert.equal(f.calls.filter(c => c.name === 'apply_stripe_event').length, 0);
});
test('protected Stripe key changes cannot retry an uncertain order in another account or mode', async () => {
    const f = fixture();
    await checkout(new Request('https://shop.example.test'), body, f.deps);
    f.order = {
        ...f.order!, checkoutSessionId: null, checkoutUrl: null
    };
    let providerCalls = 0;
    f.deps.stripe = () => {
        providerCalls++;
        throw Error('changed credential must not reach provider');
    };
    for (const secret of ['sk_test_another_account', 'sk_live_another_mode']) {
        f.deps.env = n => ({
            ...values, STRIPE_SECRET_KEY: secret, PAYMENT_LIVE_ENABLED: 'true'
        })[n];
        await assert.rejects(checkout(new Request('https://shop.example.test'), body, f.deps), /checkout_conflict/);
    }
    assert.equal(providerCalls, 0);
    assert.equal(f.creates.length, 1);
    assert.equal(f.calls.filter(call => call.name.includes('release')).length, 0);
});

test('reconciliation clamps requested batches to five and honors smaller batch limits', async () => {
    for (const [requested, expected] of [[undefined, 5], [500, 5], [2, 2]]) {
        const f = fixture();
        await checkout(new Request('https://shop.example.test'), body, f.deps);
        f.deps.select = async <T>(_table: string, filters: Record<string, string>) => {
            assert.equal(filters.limit, String(expected));
            return Array.from({length: 8}, () => ({id: key})) as T[];
        };
        let retrieved = 0;
        f.deps.stripe = () => ({
            create: async () => {throw Error('unused');},
            retrieve: async () => {retrieved++; return {...session(f.order!), status:'open'} as unknown as Stripe.Checkout.Session;},
        });
        await reconcilePayments(f.deps, {maxBatch: requested});
        assert.equal(retrieved, expected);
    }
});

test('elapsed reconciliation deadline defers provider calls after a slow order lookup', async () => {
    const f = fixture();
    await checkout(new Request('https://shop.example.test'), body, f.deps);
    let clock = Date.now();
    f.deps.now = () => clock;
    f.deps.select = async <T>() => [{id:key}, {id:key}] as T[];
    const rpc = f.deps.rpc;
    f.deps.rpc = async <T>(name: string, args: Record<string,unknown>) => {
        const value = await rpc<T>(name,args);
        if(name==='order_record') clock += 25001;
        return value;
    };
    let retrieved=0;
    f.deps.stripe = () => ({create: async()=>{throw Error('unused');}, retrieve:async()=>{retrieved++;throw Error('must defer');}});
    const result=await reconcilePayments(f.deps,{elapsedNow:()=>clock});
    assert.equal(retrieved,0);
    assert.equal(result.deferred,2);
    assert.equal(f.calls.filter(call=>call.name==='apply_stripe_event').length,0);
});

test('reconciliation bounds real await time, disables provider retries and preserves timed-out holds', async () => {
    const f=fixture();
    await checkout(new Request('https://shop.example.test'),body,f.deps);
    f.deps.select=async<T>()=>[{id:key}] as T[];
    let options: Stripe.RequestOptions | undefined;
    f.deps.stripe=()=>({create:async()=>{throw Error('unused');},retrieve:async(_id,requestOptions)=>{
        options=requestOptions;
        return new Promise<Stripe.Checkout.Session>(()=>{});
    }});
    const started=Date.now();
    const result=await reconcilePayments(f.deps,{budgetMs:100,retrieveTimeoutMs:10});
    assert.ok(Date.now()-started<500);
    assert.equal(options?.maxNetworkRetries,0);
    assert.equal(options?.timeout,10);
    assert.equal(result.errors,1);
    assert.equal(result.expired,0);
    assert.equal(f.calls.filter(call=>call.name==='apply_stripe_event').length,0);
    assert.equal(f.order!.status,'pending');
});


test('reconciliation total deadline bounds database awaits even when business time is frozen', async () => {
    const f = fixture();
    await checkout(new Request('https://shop.example.test'), body, f.deps);
    f.deps.now = () => 1;
    f.deps.select = async <T>() => [{id:key}, {id:key}] as T[];
    f.deps.rpc = async <T>() => new Promise<T>(() => {});
    let retrieved = 0;
    f.deps.stripe = () => ({create:async()=>{throw Error('unused');},retrieve:async()=>{retrieved++;throw Error('must not retrieve');}});
    const started = Date.now();
    const result = await reconcilePayments(f.deps, {budgetMs: 15});
    assert.ok(Date.now() - started < 500);
    assert.equal(result.errors, 1);
    assert.equal(result.deferred, 1);
    assert.equal(retrieved, 0);
    assert.equal(f.order!.status, 'pending');
});

test('a late provider rejection after timeout stays handled and cannot release stock', async () => {
    const f = fixture();
    await checkout(new Request('https://shop.example.test'), body, f.deps);
    f.deps.select = async <T>() => [{id:key}] as T[];
    let rejectProvider!: (error: Error) => void;
    f.deps.stripe = () => ({create:async()=>{throw Error('unused');},retrieve:async()=>new Promise<Stripe.Checkout.Session>((_resolve,reject)=>{rejectProvider=reject;})});
    const result = await reconcilePayments(f.deps, {budgetMs:100, retrieveTimeoutMs:5});
    rejectProvider(new Error('late provider failure'));
    await new Promise(resolve=>setTimeout(resolve, 10));
    assert.equal(result.errors, 1);
    assert.equal(f.calls.filter(call=>call.name==='apply_stripe_event').length, 0);
});

test('a budget-timed-out database read defers remaining rows even if clock reports a fractional remainder', async () => {
    const f=fixture();
    await checkout(new Request('https://shop.example.test'),body,f.deps);
    f.deps.select=async<T>()=>[{id:key},{id:key}] as T[];
    let reads=0,elapsed=0;
    f.deps.rpc=async<T>()=>{reads++;elapsed=13.5;return new Promise<T>(()=>{});};
    const result=await reconcilePayments(f.deps,{budgetMs:15,elapsedNow:()=>elapsed});
    assert.equal(reads,1);
    assert.equal(result.errors,1);
    assert.equal(result.deferred,1);
});

test('approved oversize quote freezes product prices, shipping fee and delivery address through payment',async()=>{
 const f=fixture();
 const cart=await quoteCart({items:body.items,locale:body.locale,prices:{'endplug-plain':{usd:1500}}});
 const address={line1:'Quoted address',line2:'',city:'Bangkok',state:'',postal_code:'10120',country:'TH'};
 const approved={id:key,customerId:customer.id,status:'quoted',locale:body.locale,currency:'usd',cartFingerprint:cart.fingerprint,items:cart.lines,amountSubtotal:3000,shippingAmount:8000,weightGrams:3000,country:'TH',shippingService:'ems_local',address,recipient:{name:'Quoted Buyer'},expiresAt:new Date(Date.now()+7*86400000).toISOString(),version:2};
 const originalRpc=f.deps.rpc,originalSelect=f.deps.select;
 f.deps.rpc=async <T>(name:string,args:Record<string,unknown>)=>name==='shipping_quote_record'?approved as T:originalRpc<T>(name,args);
 f.deps.select=async <T>(table:string,filters:Record<string,string>)=>table==='inventory'?[{sku:'endplug-plain',on_hand:20,reserved:0,price_usd_minor:9999,weight_grams:1500}] as T[]:originalSelect<T>(table,filters);
 f.deps.shippingQuote=async()=>{throw Error('oversize standard quote must not be used');};
 let created:any;
 f.deps.stripe=()=>({create:async(params)=>{created=params;return {...session(f.order!),amount_total:f.order!.amountTotal,url:'https://checkout.stripe.com/c/quoted',expires_at:params.expires_at!,status:'open'} as any;},retrieve:async()=>({...session(f.order!),amount_total:f.order!.amountTotal,status:'open'}) as any});
 await checkout(new Request('https://shop.example.test'),{...body,quoteId:key},f.deps);
 assert.equal(created.line_items[0].price_data.unit_amount,1500);
 assert.equal(created.line_items[1].price_data.unit_amount,8000);
 assert.equal(created.shipping_address_collection,undefined);
 assert.equal(f.order!.amountTotal,11000);
 assert.deepEqual(f.order!.checkoutParameters.shippingQuoteAddress,address);
 await applySessionEvent(f.order!,{...session(f.order!),amount_total:11000} as any,'evt_manual','checkout.session.completed',Math.floor(Date.now()/1000),f.deps);
 const delivered=f.calls.find(c=>c.name==='apply_stripe_event')!;
 assert.deepEqual(delivered.args.p_shipping,{recipient:{name:'Quoted Buyer'},address});
 await assert.rejects(checkout(new Request('https://shop.example.test'),{...body,quoteId:key,shippingMethod:'ems_world'},f.deps),/shipping_quote_not_ready/);
});

test('checkout uses storefront destinations when legacy country environment is absent',async()=>{
 const f=fixture();f.deps.env=n=>n==='SHIPPING_ALLOWED_COUNTRIES'?undefined:values[n];
 await checkout(new Request('https://shop.example.test'),body,f.deps);
 assert.equal(f.creates.length,1);
});
test('reconciliation flags expired orders without sessions for manual review without release',async()=>{
 const f=fixture();await checkout(new Request('https://shop.example.test'),body,f.deps);
 f.order={...f.order!,checkoutSessionId:null,expiresAt:new Date(Date.now()-60000).toISOString()};
 f.deps.select=async<T>()=>[{id:key}] as T[];
 const result=await reconcilePayments(f.deps);
 assert.equal(result.review,1);
 assert.ok(f.calls.some(c=>c.name==='flag_checkout_review'));
 assert.equal(f.calls.filter(c=>c.name==='apply_stripe_event').length,0);
});

test('customer order history pages are bounded and never expose another customer',async()=>{
 const f=fixture();await checkout(new Request('https://shop.example.test'),body,f.deps);
 const base=f.deps.rpc;f.deps.rpc=async<T>(name:string,args:Record<string,unknown>)=>name==='customer_orders_page'?{orders:[f.order],total:62} as T:base<T>(name,args);
 const page=await ownedOrdersPage(new Request('https://shop.example.test'),2,50,f.deps);
 assert.deepEqual(page.pagination,{page:2,pageSize:50,total:62,totalPages:2});
 assert.equal('checkoutParameters' in page.orders[0],false);
 await assert.rejects(ownedOrdersPage(new Request('https://shop.example.test'),0,50,f.deps),/invalid_order_page/);
 await assert.rejects(ownedOrdersPage(new Request('https://shop.example.test'),1,100,f.deps),/invalid_order_page/);
 f.order={...f.order!,customerId:'other'};
 await assert.rejects(ownedOrdersPage(new Request('https://shop.example.test'),1,5,f.deps),/service_unavailable/);
});

test('paid reconciliation rejects provider mode, customer and amount mismatches',async()=>{
 for(const patch of [{livemode:true},{amount_total:1},{metadata:{order_id:key,customer_id:'foreign'}}]){
  const f=fixture();await checkout(new Request('https://shop.example.test'),body,f.deps);
  f.deps.select=async<T>(_table:string,filters:Record<string,string>)=>filters.checkout_session_id==='is.null'?[] as T[]:[{id:key}] as T[];
  f.deps.stripe=()=>({create:async()=>{throw Error('unused');},retrieve:async()=>({...session(f.order!),status:'complete',...patch}) as any});
  const result=await reconcilePayments(f.deps);
  assert.equal(result.paid,0);assert.equal(result.errors,1);
  assert.equal(f.calls.filter(c=>c.name==='apply_stripe_event').length,0);
 }
});

test('paid recovery preserves charge time for accounting and labels missing charge time estimated',async()=>{
 for(const hasCharge of [true,false]){
  const f=fixture();await checkout(new Request('https://shop.example.test'),body,f.deps);
  f.deps.select=async<T>(_table:string,filters:Record<string,string>)=>filters.checkout_session_id==='is.null'?[] as T[]:[{id:key}] as T[];
  const created=Date.parse('2026-09-30T16:59:59Z')/1000;
  f.deps.stripe=()=>({create:async()=>{throw Error('unused');},retrieve:async()=>({...session(f.order!),status:'complete',...(hasCharge?{payment_intent:{id:'pi_verified',latest_charge:{paid:true,status:'succeeded',currency:'usd',amount:3000,created}}}:{})}) as any});
  const result=await reconcilePayments(f.deps);assert.equal(result.paid,1);
  const time=f.calls.find(c=>c.name==='record_order_payment_time')!;
  assert.equal(time.args.p_estimated,!hasCharge);
  if(hasCharge){assert.equal(time.args.p_paid_at,'2026-09-30T16:59:59.000Z');assert.ok(f.calls.some(c=>c.name==='link_order_payment'));}
 }
});
