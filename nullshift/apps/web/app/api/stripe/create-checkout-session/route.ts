import { NextResponse } from "next/server";
import Stripe from "stripe";
import { stripeConfig } from "@nullshift/billing/config";

export async function POST(req: Request) {
  if (!stripeConfig.secretKey) {
    return NextResponse.json({ error: "Stripe is not configured." }, { status: 503 });
  }
  const stripe = new Stripe(stripeConfig.secretKey, { apiVersion: "2026-05-27.dahlia" });
  try {
    const { plan, userId, email } = await req.json();

    if (!plan || !userId) {
      return NextResponse.json({ error: "Missing plan or userId." }, { status: 400 });
    }

    const priceId = stripeConfig.priceIds[plan as keyof typeof stripeConfig.priceIds];

    if (!priceId) {
      return NextResponse.json({ error: "Invalid plan selected." }, { status: 400 });
    }

    const origin = req.headers.get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
    const successUrl = `${origin}/learn?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${origin}/onboard?plan=${plan}&canceled=true`;

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      client_reference_id: userId,
      success_url: successUrl,
      cancel_url: cancelUrl,
      allow_promotion_codes: true,
      subscription_data: {
        metadata: { userId, plan },
      },
    };

    // Pre-fill email if provided
    if (email) {
      sessionParams.customer_email = email;
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    return NextResponse.json({ sessionId: session.id, url: session.url });
  } catch (error) {
    console.error("Error creating checkout session:", error);
    return NextResponse.json({ error: "Failed to create checkout session." }, { status: 500 });
  }
}
