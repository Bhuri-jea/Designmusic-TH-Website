import type { APIRoute } from 'astro';
import Stripe from 'stripe';

const stripeSecretKey = import.meta.env.STRIPE_SECRET_KEY || 'sk_test_placeholder';
const stripe = new Stripe(stripeSecretKey, {
  apiVersion: '2023-10-16' as any, // specify recent version
});

export const POST: APIRoute = async ({ request, url }) => {
  try {
    const body = await request.json();
    const { items } = body;

    if (!items || items.length === 0) {
      return new Response(JSON.stringify({ error: 'Cart is empty' }), { status: 400 });
    }

    // Format items for Stripe Checkout
    const lineItems = items.map((item: any) => {
      const description = item.options 
        ? Object.entries(item.options).map(([k, v]) => `${k}: ${v}`).join(', ') 
        : undefined;

      return {
        price_data: {
          currency: 'thb',
          product_data: {
            name: item.name,
            description: description,
            images: item.image ? [item.image] : undefined,
          },
          unit_amount: item.price * 100, // THB smallest unit is Satang, Stripe uses 100x multiplier
        },
        quantity: item.quantity,
      };
    });

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card', 'promptpay'],
      line_items: lineItems,
      mode: 'payment',
      success_url: `${url.origin}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${url.origin}/`,
    });

    return new Response(JSON.stringify({ url: session.url }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  } catch (error: any) {
    console.error('Stripe checkout error:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
};
