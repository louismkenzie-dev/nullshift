import { PRICING_TIERS, type PricingTier } from "@nullshift/content/pricing";
import { PARTNER_TERMS } from "@nullshift/content/legal/partnerAgreement";

/**
 * White-label partner prices derived from the public plan ladder, so a
 * change to the list price moves the partner figure with it. Partner price =
 * list × (1 − discount), rounded UP to the pound (brief 2026-10-09).
 */
export type PartnerPlanPrice = {
  id: PricingTier["id"];
  name: string;
  list: number;
  partner: number;
};

export function partnerPrice(
  list: number,
  discountPercent = PARTNER_TERMS.whiteLabelDiscountPercent
) {
  return Math.ceil(list * (1 - discountPercent / 100));
}

const parsePounds = (price: string): number | null => {
  const m = price.replace(/,/g, "").match(/£\s*(\d+(?:\.\d+)?)/);
  return m ? Number(m[1]) : null;
};

/** Core / Pro / Max with their list and partner "from" prices; POA tiers are skipped. */
export function partnerPlanPrices(
  tiers: readonly PricingTier[] = PRICING_TIERS
): PartnerPlanPrice[] {
  return tiers.flatMap((t) => {
    const list = parsePounds(t.price);
    return list === null
      ? []
      : [{ id: t.id, name: t.name, list, partner: partnerPrice(list) }];
  });
}
