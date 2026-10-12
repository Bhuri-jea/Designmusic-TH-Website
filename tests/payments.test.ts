import test from 'node:test';
import assert from 'node:assert/strict';
import Stripe from 'stripe';
import { checkout, paymentConfig, processWebhook, ownedOrders, type PaymentDependencies } from '../src/lib/server/payments.ts';
import { reconcilePayments } from '../src/lib/server/reconciliation.ts';
import { HttpError } from '../src/lib/server/http.ts';
import { SupabaseRequestError } from '../src/lib/server/supabase.ts';
import type { OrderRecord } from '../src/lib/server/order-state.ts';
const customer = {
    id: '11111111-1111-4111-8111-111111111111', googleSubject: 'google-1', email: 'buyer@example.test', name: 'Buyer', phone: null
};
const key = '22222222-2222-4222-8222-222222222222';
const values: Record<string, string> = {
    STRIPE_SECRET_KEY: 'sk_test_dummy', STRIPE_WEBHOOK_SECRET: 'whsec_dummy', APP_ORIGIN: 'https://shop.example.test', SHIPPING_ALLOWED_COUNTRIES: 'TH,JP'
};
const sdk = new Stripe('sk_test_dummy');
const body = {
    requestKey: key, locale: 'zh-CN', items: [{
            productId: 'saxophone-end-plug', variant: 'plain', quantity: 2
        }]
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
        rpc: async <T>(name: string, args: Record<string, unknown>) => {
            calls.push({
                name, args
            });
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
        select: async <T>(_table: string, filters: Record<string, string>) => {
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
                ...session(order!), status: 'open'
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
function session(order: OrderRecord) {
    return {
        object: 'checkout.session', id: 'cs_1', client_reference_id: order.id, mode: 'payment', status: 'complete', livemode: false, payment_status: 'paid', metadata: {
            order_id: order.id, customer_id: order.customerId
        }, currency: 'usd', amount_total: 3000, collected_information: {
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
            SHIPPING_ALLOWED_COUNTRIES: 'QQ'
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
    assert.deepEqual(f.calls.map(c => c.name), ['reserve_order']);
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
test('reconciliation releases only retrieved expiration and never confirms retrieved payment', async () => {
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
    assert.equal(f.calls.filter(c => c.name === 'apply_stripe_event').length, 0);
    f.deps.stripe = () => ({
        create: async () => {
            throw Error('unused');
        }, retrieve: async () => ({
            ...session(f.order!), status: 'expired', payment_status: 'unpaid'
        } as unknown as Stripe.Checkout.Session)
    });
    await reconcilePayments(f.deps);
    assert.equal(f.calls.at(-1)!.args.p_event_type, 'checkout.session.expired');
    f.order = {
        ...f.order!, checkoutSessionId: null
    };
    await reconcilePayments(f.deps);
    assert.equal(f.calls.filter(c => c.name === 'apply_stripe_event').length, 1);
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
