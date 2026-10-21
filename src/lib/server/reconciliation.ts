import { paymentDependencies, paymentCredentials, sessionMatches, applySessionEvent, type PaymentDependencies } from './payments.ts';
import type { OrderRecord } from './order-state.ts';

export type ReconciliationOptions = {
    maxBatch?: number;
    budgetMs?: number;
    retrieveTimeoutMs?: number;
    elapsedNow?: () => number;
};

function boundedOption(value: number | undefined, maximum: number): number {
    return Number.isFinite(value) ? Math.max(1, Math.min(maximum, Math.floor(value!))) : maximum;
}

class ReconciliationTimeout extends Error {
    readonly limit: 'budget' | 'provider';
    constructor(limit: 'budget' | 'provider') { super('reconciliation_timeout'); this.limit = limit; }
}
async function boundedAwait<T>(operation: () => Promise<T>, timeoutMs: number, limit: 'budget' | 'provider' = 'budget'): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
        return await Promise.race([
            Promise.resolve().then(operation),
            new Promise<never>((_resolve, reject) => {
                timer = setTimeout(() => reject(new ReconciliationTimeout(limit)), timeoutMs);
            }),
        ]);
    } finally {
        clearTimeout(timer);
    }
}

export async function reconcilePayments(deps: PaymentDependencies = paymentDependencies, options: ReconciliationOptions = {}) {
    const config = paymentCredentials(deps.env);
    const maxBatch = boundedOption(options.maxBatch, 5);
    const budgetMs = boundedOption(options.budgetMs, 25000);
    const retrieveTimeoutMs = boundedOption(options.retrieveTimeoutMs, 5000);
    // Business timestamps can be frozen; scheduler elapsed time must remain monotonic.
    const elapsedNow = options.elapsedNow ?? (() => performance.now());
    const deadline = elapsedNow() + budgetMs;
    const remaining = () => Math.max(0, Math.floor(deadline - elapsedNow()));
    const result = { checked: 0, expired: 0, paid: 0, review: 0, errors: 0, deferred: 0 };
    let rows: { id: string }[];
    try {
        rows = await boundedAwait(() => deps.select<{ id: string }>('orders', {
            status: 'in.(pending,failed)',
            checkout_session_id: 'not.is.null',
            order: 'expires_at.asc',
            limit: String(maxBatch),
        }), remaining());
    } catch {
        result.errors++;
        return result;
    }
    let budgetExpired=false;
    const batch = rows.slice(0, maxBatch);
    for (let index = 0; index < batch.length; index++) {
        if (!remaining()) {
            result.deferred += batch.length - index;
            break;
        }
        try {
            const order = await boundedAwait(() => deps.rpc<OrderRecord>('order_record', {
                p_id: batch[index].id,
            }), remaining());
            if (!order?.checkoutSessionId || !['pending', 'failed'].includes(order.status)) continue;
            const budgetRemaining = remaining();
            const timeout = Math.min(retrieveTimeoutMs, budgetRemaining);
            if (!timeout) {
                result.deferred += batch.length - index;
                break;
            }
            const session = await boundedAwait(() => deps.stripe(config.key).retrieve(order.checkoutSessionId!, {
                timeout,
                maxNetworkRetries: 0,
            }), timeout, timeout >= budgetRemaining ? 'budget' : 'provider');
            sessionMatches(session, order, config.live);
            result.checked++;
            const paid = session.status === 'complete' && session.payment_status === 'paid';
            const expired = session.status === 'expired' && session.payment_status === 'unpaid';
            if (!paid && !expired) continue;
            if (!remaining()) {
                result.deferred += batch.length - index;
                break;
            }
            const intent=session.payment_intent;
            const charge=typeof intent==='object'&&intent?intent.latest_charge:null;
            const paidAt=typeof charge==='object'&&charge&&charge.paid&&charge.status==='succeeded'&&charge.currency===order.currency&&charge.amount===order.amountTotal&&Number.isSafeInteger(charge.created)&&charge.created>0?charge.created:null;
            await boundedAwait(() => applySessionEvent(
                order, session, `reconcile:${paid?'paid':'expired'}:${session.id}`, paid?'checkout.session.completed':'checkout.session.expired',
                paid&&paidAt!==null?paidAt:Math.floor(deps.now() / 1000), deps,
            ), remaining());
            if(paid){
                await boundedAwait(()=>deps.rpc('record_order_payment_time',{p_order_id:order.id,p_paid_at:new Date((paidAt??Math.floor(deps.now()/1000))*1000).toISOString(),p_estimated:paidAt===null}),remaining());
                result.paid++;
            }else result.expired++;
        } catch (error) {
            // A timed-out read never authorizes release or fulfillment.
            result.errors++;
            if (error instanceof ReconciliationTimeout && error.limit === 'budget') {
                budgetExpired=true;
                result.deferred += batch.length - index - 1;
                break;
            }
        }
    }
    if (remaining() && !budgetExpired) {
        try {
            const uncertain = await boundedAwait(()=>deps.select<{id:string}>('orders',{status:'in.(pending,failed)',checkout_session_id:'is.null',expires_at:'lt.'+new Date(deps.now()).toISOString(),order:'expires_at.asc',limit:String(maxBatch)}),remaining());
            for(const row of uncertain.slice(0,maxBatch)){
                if(!remaining()){result.deferred++;break;}
                const order=await boundedAwait(()=>deps.rpc<OrderRecord>('order_record',{p_id:row.id}),remaining());
                if(order?.checkoutSessionId||!['pending','failed'].includes(order?.status)||Date.parse(order.expiresAt)>deps.now())continue;
                await boundedAwait(()=>deps.rpc('flag_checkout_review',{p_order_id:order.id}),remaining());
                result.review++;
            }
        }catch{result.errors++;}
    }
    return result;
}
