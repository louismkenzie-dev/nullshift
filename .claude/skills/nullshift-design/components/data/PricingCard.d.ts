import * as React from "react";

export interface PricingBenefit {
  text: string;
  checked: boolean;
}

export interface PricingCardProps {
  /** Plan name (mono, uppercase). */
  tier: string;
  /** Display price, e.g. "£1,200" or "Custom". */
  price: string;
  /** One-line "best for" descriptor. */
  bestFor: string;
  /** Benefit rows — string (checked) or { text, checked }. */
  benefits?: (string | PricingBenefit)[];
  /** CTA label. Default "Book a call". */
  cta?: string;
  href?: string;
  /** Promote as the featured plan (emerald edge + badge). Default false. */
  highlighted?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Pricing plan card with benefit checklist and CTA.
 * @startingPoint section="Data" subtitle="Pricing plan tier" viewport="360x460"
 */
export function PricingCard(props: PricingCardProps): React.ReactElement;
