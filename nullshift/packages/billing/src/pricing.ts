export type BenefitType = { text: string; checked: boolean };

export interface PricingPlan {
  tier: "Core" | "Grow" | "Pro" | "Partner";
  price: string;
  bestFor: string;
  CTA: string;
  href: string;
  highlighted: boolean;
  benefits: BenefitType[];
  // Additional fields for PLAN_META on the onboard page
  label: string;
  features: string[];
}

export const pricingPlans: PricingPlan[] = [
  {
    tier: "Core",
    price: "£19.99/mo",
    bestFor: "Start learning on your own terms.",
    CTA: "Get started",
    href: "/onboard?plan=core",
    highlighted: false,
    benefits: [
      { text: "Full library of support videos", checked: true },
      { text: "Step-by-step AI tool tutorials", checked: true },
      { text: "New content added monthly", checked: true },
      { text: "Self-paced learning", checked: true },
      { text: "Email support", checked: false },
      { text: "Live chat assistance", checked: false },
      { text: "1-to-1 call support", checked: false },
      { text: "Bespoke workflow strategy", checked: false },
    ],
    label: "Core",
    features: ["Full video library", "AI tool tutorials", "New content monthly", "Self-paced learning"],
  },
  {
    tier: "Grow",
    price: "£49/mo",
    bestFor: "Learn faster with direct guidance.",
    CTA: "Get started",
    href: "/onboard?plan=grow",
    highlighted: false,
    benefits: [
      { text: "Full library of support videos", checked: true },
      { text: "Step-by-step AI tool tutorials", checked: true },
      { text: "New content added monthly", checked: true },
      { text: "Self-paced learning", checked: true },
      { text: "Email support", checked: true },
      { text: "Live chat assistance", checked: true },
      { text: "1-to-1 call support", checked: false },
      { text: "Bespoke workflow strategy", checked: false },
    ],
    label: "Grow",
    features: ["Everything in Core", "Email support", "Live chat assistance", "Priority response"],
  },
  {
    tier: "Pro",
    price: "£249/mo",
    bestFor: "Full access and hands-on support.",
    CTA: "Get started",
    href: "/onboard?plan=pro",
    highlighted: true,
    benefits: [
      { text: "Full library of support videos", checked: true },
      { text: "Step-by-step AI tool tutorials", checked: true },
      { text: "New content added monthly", checked: true },
      { text: "Self-paced learning", checked: true },
      { text: "Email support", checked: true },
      { text: "Live chat assistance", checked: true },
      { text: "1-to-1 call support", checked: true },
      { text: "Bespoke workflow strategy", checked: true },
    ],
    label: "Pro",
    features: ["Everything in Grow", "All resources", "Bespoke 1-to-1 call support", "Workflow strategy"],
  },
  {
    tier: "Partner",
    price: "£749/mo",
    bestFor: "We build it. We teach you to own it. Min. 12-month contract.",
    CTA: "Book a call",
    href: "/book",
    highlighted: false,
    benefits: [
      { text: "Everything in Pro", checked: true },
      { text: "We build your site or system", checked: true },
      { text: "12-month guided handover", checked: true },
      { text: "Monthly training sessions", checked: true },
      { text: "Goal: full independence by month 12", checked: true },
      { text: "Optional maintenance add-on (£249/mo)", checked: true },
    ],
    label: "Partner", // Although Partner isn't part of the onboard flow with direct sign-up, including for consistency
    features: ["Everything in Pro", "We build your site or system", "12-month guided handover", "Monthly training sessions", "Goal: full independence by month 12", "Optional maintenance add-on (£249/mo)"],
  },
];

export const PLAN_META_ONBOARD = pricingPlans.reduce((acc, plan) => {
    // Only include plans that are part of the direct onboard flow (excluding "Partner" for now)
    if (plan.tier === "Core" || plan.tier === "Grow" || plan.tier === "Pro") {
        acc[plan.tier.toLowerCase() as "core" | "grow" | "pro"] = {
            label: plan.label,
            price: plan.price.replace("/mo", " / month"), // Adjust format for onboard page
            features: plan.features,
        };
    }
    return acc;
}, {} as Record<"core" | "grow" | "pro", { label: string; price: string; features: string[] }>);
