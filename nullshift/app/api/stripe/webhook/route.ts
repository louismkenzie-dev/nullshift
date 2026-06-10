// nullshift/app/api/stripe/webhook/route.ts

import Stripe from 'stripe';
import { stripeConfig } from '@/lib/stripeConfig';
import { createServiceClient } from '@/lib/supabase/server';

export async function POST(req: Request) {
  if (!stripeConfig.secretKey) {
    return new Response("Stripe is not configured.", { status: 503 });
  }
  const stripe = new Stripe(stripeConfig.secretKey, { apiVersion: "2026-05-27.dahlia" });
  const body = await req.text();
  const sig = req.headers.get('stripe-signature')!;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, sig, stripeConfig.webhookSecret);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    // On error, log and return the error message.
    if (errorMessage.includes('No signatures found matching the expected signature')) {
      console.log(`❌ Error message: ${errorMessage}`);
    }
    return new Response(`Webhook Error: ${errorMessage}`, { status: 400 });
  }

  // Handle the checkout.session.completed event
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.client_reference_id;
    const subscription = await stripe.subscriptions.retrieve(session.subscription as string);

    if (userId) {
      const supabase = createServiceClient();
      const { error } = await supabase.from('subscriptions').insert({
        user_id: userId,
        tier: subscription.items.data[0].price.product === stripeConfig.productIds.core ? 'core' : 
              subscription.items.data[0].price.product === stripeConfig.productIds.grow ? 'grow' :
              subscription.items.data[0].price.product === stripeConfig.productIds.pro ? 'pro' :
              'partner', // Or handle error for unknown product
        status: 'active',
        stripe_customer_id: subscription.customer as string,
        stripe_subscription_id: subscription.id,
        started_at: new Date(subscription.created * 1000).toISOString(),
        ends_at: subscription.cancel_at ? new Date(subscription.cancel_at * 1000).toISOString() : null,
      });

      if (error) {
        console.error('Supabase error inserting subscription:', error);
        return new Response('Supabase error', { status: 500 });
      }

      console.log(`✅ Subscription created for user ${userId}`);
    }
  }

  return new Response(null, { status: 200 });
}
