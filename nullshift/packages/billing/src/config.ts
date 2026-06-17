// nullshift/lib/stripeConfig.ts

export const stripeConfig = {
  publicKey: process.env.NEXT_PUBLIC_STRIPE_PUBLIC_KEY!,
  secretKey: process.env.STRIPE_SECRET_KEY!,
  webhookSecret: process.env.STRIPE_WEBHOOK_SECRET!,
  // Map internal plan tiers to Stripe Price IDs
  priceIds: {
    core: process.env.STRIPE_PRICE_ID_CORE!,
    grow: process.env.STRIPE_PRICE_ID_GROW!,
    pro: process.env.STRIPE_PRICE_ID_PRO!, // Assuming "Max" is "Pro"
    partner: process.env.STRIPE_PRICE_ID_PARTNER!,
    maintenance: process.env.STRIPE_PRICE_ID_MAINTENANCE!,
  },
  productIds: {
    core: "prod_UfsNoiZXBiuWHw",
    grow: "prod_UfsOJJ7cf7Q8iL",
    pro: "prod_UfsO4qjouUXJa3", // Assuming "Max" is "Pro"
    partner: "prod_UfsQ69l39G1u5E",
    maintenance: "prod_UfsXprPo59hDna",
  }
};
