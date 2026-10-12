import type { APIRoute } from 'astro';
import { processWebhook, MAX_WEBHOOK_BYTES } from '../../lib/server/payments.ts';
import { HttpError, jsonResponse, errorResponse } from '../../lib/server/http.ts';
export const prerender = false;
export async function rawWebhookBody(request: Request): Promise<Uint8Array> {
    if (Number(request.headers.get('content-length') ?? 0) > MAX_WEBHOOK_BYTES)
        throw new HttpError(413, 'body_too_large');
    const reader = request.body?.getReader();
    if (!reader)
        throw new HttpError(400, 'invalid_signature');
    const chunks: Uint8Array[] = [];
    let total = 0;
    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done)
                break;
            total += value.byteLength;
            if (total > MAX_WEBHOOK_BYTES) {
                await reader.cancel();
                throw new HttpError(413, 'body_too_large');
            }
            chunks.push(value);
        }
    }
    finally {
        reader.releaseLock();
    }
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.byteLength;
    }
    return bytes;
}
export const POST: APIRoute = async ({ request }) => {
    try {
        await processWebhook(await rawWebhookBody(request), request.headers.get('stripe-signature'));
        return jsonResponse({
            received: true
        });
    }
    catch (error) {
        return errorResponse(error);
    }
};
