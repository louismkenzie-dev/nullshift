import { canonicalJson, snapshotHash } from "@/lib/legal/acceptanceSnapshot";

export type LineItem = { description: string; qty: number; unitPence: number };

export function parseItems(raw: unknown): LineItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((r) => {
      const o = (r ?? {}) as Record<string, unknown>;
      const qty = Number(o.qty);
      const unit = Math.round(Number(o.unitPence));
      return {
        description:
          typeof o.description === "string" ? o.description.trim().slice(0, 300) : "",
        qty: Number.isFinite(qty) && qty > 0 ? Math.round(qty * 100) / 100 : 1,
        unitPence: Number.isFinite(unit)
          ? Math.max(-100_000_000, Math.min(100_000_000, unit))
          : 0,
      };
    })
    .filter((i) => i.description)
    .slice(0, 60);
}

export function subtotalPence(items: LineItem[]): number {
  return items.reduce((a, i) => a + Math.round(i.qty * i.unitPence), 0);
}

export function totals(
  items: LineItem[],
  vatPct: number
): { subtotal: number; vat: number; total: number } {
  const subtotal = subtotalPence(items);
  const vat = Math.round((subtotal * Math.max(0, vatPct)) / 100);
  return { subtotal, vat, total: subtotal + vat };
}

export function gbp(pence: number): string {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(
    pence / 100
  );
}

export function formatNumber(prefix: string, n: number): string {
  return `${prefix}${String(n).padStart(4, "0")}`;
}

/** Everything the client is agreeing to, in a stable shape. */
export type ProposalContent = {
  number: string;
  title: string;
  intro: string;
  scope: string;
  items: LineItem[];
  terms: string;
  validUntil: string | null;
  vatPct: number;
  issuer: { name: string; email: string };
  client: { name: string; company: string; email: string };
};

export function proposalContentHash(content: ProposalContent): string {
  return snapshotHash(content);
}

export function proposalContentCanonical(content: ProposalContent): string {
  return canonicalJson(content);
}

export function addDays(d: Date, n: number): string {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
}
