// nullshift/app/api/stripe/create-checkout-session/route.ts

import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { stripeConfig } from '@/lib/stripeConfig';

const stripe = new Stripe(stripeConfig.secretKey, {
  apiVersion: '2023-10-16',
  typescript: true,
});

export async function POST(req: Request) {
  try {
    const { plan, userId } = await req.json();

    if (!plan || !userId) {
      return NextResponse.json({ error: 'Missing plan or userId.' }, { status: 400 });
    }

    const priceId = stripeConfig.priceIds[plan as keyof typeof stripeConfig.priceIds];

    if (!priceId) {
      return NextResponse.json({ error: 'Invalid plan selected.' }, { status: 400 });
    }

    // Determine success and cancel URLs based on your application's routes
    // Ensure these URLs are publicly accessible
    const successUrl = `${req.headers.get('origin')}/learn/dashboard?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${req.headers.get('origin')}/onboard?canceled=true`;

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      customer_email: (await stripe.customers.list({ email: (await stripe.customers.list()).data[0]?.email })).data[0]?.email, // Pre-fill customer email if available or fetch from Supabase user
      client_reference_id: userId, // Link to your internal user ID
      success_url: successUrl,
      cancel_url: cancelUrl,
      allow_promotion_codes: true, // Optional: if you want to allow promo codes
      subscription_data: {
        metadata: {
          userId: userId,
          plan: plan,
        },
      },
    });

    return NextResponse.json({ sessionId: session.id });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    return NextResponse.json({ error: 'Failed to create checkout session.' }, { status: 500 });
  }
}
