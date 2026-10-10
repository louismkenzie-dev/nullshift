import { createServiceClient } from "@nullshift/db";
import { PRODUCTS } from "@nullshift/content/products";
import { entitlementFor } from "@/lib/products/entitlement";
import { privateToken, sha256 } from "@/lib/products/keys";
import { sendEmail } from "@/lib/sendEmail";
import {
  addDays,
  formatNumber,
  parseItems,
  proposalContentHash,
  totals,
  type LineItem,
  type ProposalContent,
} from "./money";
import { invoiceSentEmail, proposalAcceptedEmail, proposalSentEmail } from "./emails";

export type Brand = {
  name: string;
  colour: string;
  logoUrl?: string | null;
  email: string;
  phone?: string;
  address?: string;
  website?: string;
};
export type Bank = {
  accountName?: string;
  sortCode?: string;
  accountNumber?: string;
  iban?: string;
  reference?: string;
};
export type ProfileRow = {
  tenant_id: string;
  brand: Brand;
  default_terms: string | null;
  bank: Bank;
  payment_link_url: string | null;
  vat: { registered: boolean; ratePct: number; number: string };
  invoice_prefix: string;
  next_invoice_no: number;
  proposal_prefix: string;
  next_proposal_no: number;
};
export type ClientRow = {
  id: string;
  tenant_id: string;
  token: string;
  name: string;
  company: string | null;
  email: string;
  phone: string | null;
  address: string | null;
  archived: boolean;
  created_at: string;
};
export type NoteRow = { id: string; client_id: string; body: string; created_at: string };
export type ProposalRow = {
  id: string;
  tenant_id: string;
  client_id: string;
  number: string;
  title: string;
  intro: string | null;
  scope: string | null;
  items: LineItem[];
  terms: string | null;
  valid_until: string | null;
  status: "draft" | "sent" | "accepted" | "declined" | "expired";
  sent_at: string | null;
  accepted_at: string | null;
  accepted_name: string | null;
  accepted_hash: string | null;
  snapshot: ProposalContent | null;
  declined_at: string | null;
  created_at: string;
  updated_at: string;
};
export type InvoiceRow = {
  id: string;
  tenant_id: string;
  client_id: string;
  proposal_id: string | null;
  number: string;
  items: LineItem[];
  notes: string | null;
  issued_on: string;
  due_on: string | null;
  vat_pct: number;
  status: "draft" | "sent" | "paid" | "void";
  sent_at: string | null;
  paid_at: string | null;
  created_at: string;
};

const site = () =>
  (process.env.NEXT_PUBLIC_SITE_URL ?? "https://nullshift.co.uk").replace(/\/$/, "");
const db = () => createServiceClient();

export const DEFAULT_TERMS = `Payment is due within 14 days of each invoice. Work starts once this proposal is accepted and any deposit invoice is paid. Changes to the scope are quoted separately before work begins. Either side may end the engagement with 14 days' written notice; work completed to that date is invoiced. Ownership of deliverables passes to you on full payment. Neither side is liable to the other for indirect or consequential loss.`;

/* ── profile ─────────────────────────────────────────────────────────── */

export async function getProfile(
  tenantId: string,
  fallbackName: string,
  fallbackEmail: string
): Promise<ProfileRow> {
  const { data } = await db()
    .from("studio_profiles")
    .select("*")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  const row = (data as Partial<ProfileRow> | null) ?? {};
  return {
    tenant_id: tenantId,
    brand: {
      name: fallbackName,
      colour: "#10b981",
      email: fallbackEmail,
      ...((row.brand as Partial<Brand>) ?? {}),
    } as Brand,
    default_terms: row.default_terms ?? DEFAULT_TERMS,
    bank: (row.bank as Bank) ?? {},
    payment_link_url: row.payment_link_url ?? null,
    vat: {
      registered: false,
      ratePct: 20,
      number: "",
      ...((row.vat as Partial<ProfileRow["vat"]>) ?? {}),
    },
    invoice_prefix: row.invoice_prefix ?? "INV-",
    next_invoice_no: row.next_invoice_no ?? 1,
    proposal_prefix: row.proposal_prefix ?? "P-",
    next_proposal_no: row.next_proposal_no ?? 1,
  };
}

export async function saveProfile(
  tenantId: string,
  patch: Partial<Omit<ProfileRow, "tenant_id" | "next_invoice_no" | "next_proposal_no">>
) {
  await db()
    .from("studio_profiles")
    .upsert({ tenant_id: tenantId, ...patch }, { onConflict: "tenant_id" });
}

async function nextNumber(
  tenantId: string,
  kind: "invoice" | "proposal",
  profile: ProfileRow
): Promise<string> {
  const col = kind === "invoice" ? "next_invoice_no" : "next_proposal_no";
  const n = profile[col];
  await db()
    .from("studio_profiles")
    .upsert({ tenant_id: tenantId, [col]: n + 1 }, { onConflict: "tenant_id" });
  return formatNumber(
    kind === "invoice" ? profile.invoice_prefix : profile.proposal_prefix,
    n
  );
}

/* ── clients ─────────────────────────────────────────────────────────── */

export async function listClients(
  tenantId: string,
  includeArchived = false
): Promise<ClientRow[]> {
  let q = db()
    .from("studio_clients")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });
  if (!includeArchived) q = q.eq("archived", false);
  const { data } = await q;
  return (data ?? []) as ClientRow[];
}

export async function getClient(tenantId: string, id: string): Promise<ClientRow | null> {
  const { data } = await db()
    .from("studio_clients")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("id", id)
    .maybeSingle();
  return (data as ClientRow | null) ?? null;
}

export async function createClient(
  tenantId: string,
  c: {
    name: string;
    company: string | null;
    email: string;
    phone: string | null;
    address: string | null;
  }
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const active = await listClients(tenantId);
  if (active.length >= PRODUCTS.studio.limits.clients)
    return {
      ok: false,
      error: `Your plan includes ${PRODUCTS.studio.limits.clients} active clients. Archive one to add another.`,
    };
  const { data, error } = await db()
    .from("studio_clients")
    .insert({ tenant_id: tenantId, token: privateToken(), ...c })
    .select("id")
    .single();
  if (error || !data)
    return { ok: false, error: error?.message ?? "Could not add client" };
  return { ok: true, id: data.id as string };
}

export async function updateClient(
  tenantId: string,
  id: string,
  patch: Partial<
    Pick<ClientRow, "name" | "company" | "email" | "phone" | "address" | "archived">
  >
) {
  await db().from("studio_clients").update(patch).eq("tenant_id", tenantId).eq("id", id);
}

export async function rotateClientToken(tenantId: string, id: string) {
  await db()
    .from("studio_clients")
    .update({ token: privateToken() })
    .eq("tenant_id", tenantId)
    .eq("id", id);
}

export async function addNote(tenantId: string, clientId: string, body: string) {
  await db()
    .from("studio_notes")
    .insert({
      tenant_id: tenantId,
      client_id: clientId,
      body: body.trim().slice(0, 4000),
    });
}

export async function listNotes(clientId: string): Promise<NoteRow[]> {
  const { data } = await db()
    .from("studio_notes")
    .select("*")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(100);
  return (data ?? []) as NoteRow[];
}

/* ── proposals ───────────────────────────────────────────────────────── */

export async function listProposals(
  tenantId: string,
  clientId?: string
): Promise<ProposalRow[]> {
  let q = db()
    .from("studio_proposals")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(300);
  if (clientId) q = q.eq("client_id", clientId);
  const { data } = await q;
  return (data ?? []) as ProposalRow[];
}

export async function getProposal(
  tenantId: string,
  id: string
): Promise<ProposalRow | null> {
  const { data } = await db()
    .from("studio_proposals")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("id", id)
    .maybeSingle();
  return (data as ProposalRow | null) ?? null;
}

export async function createProposal(
  tenantId: string,
  clientId: string,
  profile: ProfileRow
): Promise<string> {
  const number = await nextNumber(tenantId, "proposal", profile);
  const { data, error } = await db()
    .from("studio_proposals")
    .insert({
      tenant_id: tenantId,
      client_id: clientId,
      number,
      title: "Proposal",
      terms: profile.default_terms,
      valid_until: addDays(new Date(), 30),
      items: [],
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Could not create proposal");
  return data.id as string;
}

export async function saveProposal(
  tenantId: string,
  id: string,
  patch: {
    title: string;
    intro: string;
    scope: string;
    items: unknown;
    terms: string;
    valid_until: string | null;
  }
): Promise<{ ok: true } | { ok: false; error: string }> {
  const current = await getProposal(tenantId, id);
  if (!current) return { ok: false, error: "Not found" };
  if (current.status === "accepted")
    return {
      ok: false,
      error: "An accepted proposal cannot be edited. Create a new version instead.",
    };
  const { error } = await db()
    .from("studio_proposals")
    .update({
      title: patch.title.trim().slice(0, 160) || "Proposal",
      intro: patch.intro.trim().slice(0, 2000) || null,
      scope: patch.scope.trim().slice(0, 8000) || null,
      items: parseItems(patch.items),
      terms: patch.terms.trim().slice(0, 8000) || null,
      valid_until: patch.valid_until || null,
      ...(current.status === "sent" ? {} : {}),
    })
    .eq("tenant_id", tenantId)
    .eq("id", id);
  return error ? { ok: false, error: error.message } : { ok: true };
}

export function proposalContent(
  p: ProposalRow,
  profile: ProfileRow,
  client: ClientRow
): ProposalContent {
  return {
    number: p.number,
    title: p.title,
    intro: p.intro ?? "",
    scope: p.scope ?? "",
    items: p.items ?? [],
    terms: p.terms ?? "",
    validUntil: p.valid_until,
    vatPct: profile.vat.registered ? profile.vat.ratePct : 0,
    issuer: { name: profile.brand.name, email: profile.brand.email },
    client: { name: client.name, company: client.company ?? "", email: client.email },
  };
}

export async function sendProposal(
  tenantId: string,
  id: string,
  profile: ProfileRow
): Promise<{ ok: true } | { ok: false; error: string }> {
  const p = await getProposal(tenantId, id);
  if (!p) return { ok: false, error: "Not found" };
  if (!p.items?.length)
    return { ok: false, error: "Add at least one line item before sending." };
  const client = await getClient(tenantId, p.client_id);
  if (!client) return { ok: false, error: "Client missing" };
  await db()
    .from("studio_proposals")
    .update({ status: "sent", sent_at: new Date().toISOString() })
    .eq("id", id);
  const url = `${site()}/c/${client.token}/proposal/${p.id}`;
  const m = proposalSentEmail({
    brand: profile.brand,
    client,
    proposal: p,
    url,
    total: totals(p.items, profile.vat.registered ? profile.vat.ratePct : 0).total,
  });
  void sendEmail({
    to: client.email,
    subject: m.subject,
    html: m.html,
    text: m.text,
    purpose: "transactional",
    replyTo: profile.brand.email,
  });
  return { ok: true };
}

export async function duplicateProposal(
  tenantId: string,
  id: string,
  profile: ProfileRow
): Promise<string | null> {
  const p = await getProposal(tenantId, id);
  if (!p) return null;
  const number = await nextNumber(tenantId, "proposal", profile);
  const { data } = await db()
    .from("studio_proposals")
    .insert({
      tenant_id: tenantId,
      client_id: p.client_id,
      number,
      title: p.title,
      intro: p.intro,
      scope: p.scope,
      items: p.items,
      terms: p.terms,
      valid_until: addDays(new Date(), 30),
    })
    .select("id")
    .single();
  return (data?.id as string) ?? null;
}

/** Client-side acceptance via the private link. Freezes the content. */
export async function acceptProposalByToken(
  token: string,
  proposalId: string,
  typedName: string,
  ip: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const hit = await resolveClientByToken(token);
  if (!hit) return { ok: false, error: "This link is no longer valid." };
  const { client, profile } = hit;
  const p = await getProposal(client.tenant_id, proposalId);
  if (!p || p.client_id !== client.id) return { ok: false, error: "Proposal not found." };
  if (p.status === "accepted") return { ok: true };
  if (p.status !== "sent")
    return { ok: false, error: "This proposal is not open for acceptance." };
  if (p.valid_until && p.valid_until < new Date().toISOString().slice(0, 10))
    return { ok: false, error: "This proposal has expired. Ask for a fresh one." };
  const name = typedName.trim().slice(0, 120);
  if (name.length < 2)
    return { ok: false, error: "Please type your full name to accept." };
  const content = proposalContent(p, profile, client);
  const hash = proposalContentHash(content);
  const { data } = await db()
    .from("studio_proposals")
    .update({
      status: "accepted",
      accepted_at: new Date().toISOString(),
      accepted_name: name,
      accepted_ip_hash: sha256(ip).slice(0, 32),
      accepted_hash: hash,
      snapshot: content,
    })
    .eq("id", p.id)
    .eq("status", "sent")
    .select("id")
    .maybeSingle();
  if (!data)
    return { ok: false, error: "Could not record acceptance. Please try again." };
  const m = proposalAcceptedEmail({
    brand: profile.brand,
    client,
    proposal: p,
    acceptedName: name,
    dashboardUrl: `${site()}/app/studio/proposals/${p.id}`,
  });
  void sendEmail({
    to: profile.brand.email,
    subject: m.subject,
    html: m.html,
    text: m.text,
    purpose: "transactional",
    replyTo: client.email,
  });
  void sendEmail({
    to: client.email,
    subject: `Accepted: ${p.title} (${p.number})`,
    html: m.clientHtml,
    text: `You accepted ${p.number} as ${name}.`,
    purpose: "transactional",
    replyTo: profile.brand.email,
  });
  return { ok: true };
}

export async function declineProposalByToken(
  token: string,
  proposalId: string
): Promise<boolean> {
  const hit = await resolveClientByToken(token);
  if (!hit) return false;
  const { data } = await db()
    .from("studio_proposals")
    .update({ status: "declined", declined_at: new Date().toISOString() })
    .eq("id", proposalId)
    .eq("client_id", hit.client.id)
    .eq("status", "sent")
    .select("id")
    .maybeSingle();
  return !!data;
}

/* ── invoices ────────────────────────────────────────────────────────── */

export async function listInvoices(
  tenantId: string,
  clientId?: string
): Promise<InvoiceRow[]> {
  let q = db()
    .from("studio_invoices")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(300);
  if (clientId) q = q.eq("client_id", clientId);
  const { data } = await q;
  return (data ?? []) as InvoiceRow[];
}

export async function getInvoice(
  tenantId: string,
  id: string
): Promise<InvoiceRow | null> {
  const { data } = await db()
    .from("studio_invoices")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("id", id)
    .maybeSingle();
  return (data as InvoiceRow | null) ?? null;
}

export async function createInvoice(
  tenantId: string,
  clientId: string,
  profile: ProfileRow,
  opts: { proposalId?: string | null; items?: LineItem[]; percent?: number }
): Promise<string> {
  const number = await nextNumber(tenantId, "invoice", profile);
  let items = opts.items ?? [];
  if (opts.percent && opts.percent > 0 && opts.percent < 100) {
    const pct = opts.percent;
    items = items.map((i) => ({
      ...i,
      description: `${i.description} (${pct}% deposit)`,
      unitPence: Math.round((i.unitPence * pct) / 100),
    }));
  }
  const { data, error } = await db()
    .from("studio_invoices")
    .insert({
      tenant_id: tenantId,
      client_id: clientId,
      proposal_id: opts.proposalId ?? null,
      number,
      items,
      due_on: addDays(new Date(), 14),
      vat_pct: profile.vat.registered ? profile.vat.ratePct : 0,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Could not create invoice");
  return data.id as string;
}

export async function saveInvoice(
  tenantId: string,
  id: string,
  patch: {
    items: unknown;
    notes: string;
    issued_on: string;
    due_on: string | null;
    vat_pct: number;
  }
): Promise<{ ok: true } | { ok: false; error: string }> {
  const current = await getInvoice(tenantId, id);
  if (!current) return { ok: false, error: "Not found" };
  if (current.status === "paid" || current.status === "void")
    return { ok: false, error: "A paid or void invoice cannot be edited." };
  const { error } = await db()
    .from("studio_invoices")
    .update({
      items: parseItems(patch.items),
      notes: patch.notes.trim().slice(0, 2000) || null,
      issued_on: patch.issued_on,
      due_on: patch.due_on,
      vat_pct: Math.max(0, Math.min(30, patch.vat_pct)),
    })
    .eq("tenant_id", tenantId)
    .eq("id", id);
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function setInvoiceStatus(
  tenantId: string,
  id: string,
  status: InvoiceRow["status"],
  profile: ProfileRow
): Promise<{ ok: true } | { ok: false; error: string }> {
  const inv = await getInvoice(tenantId, id);
  if (!inv) return { ok: false, error: "Not found" };
  const patch: Record<string, unknown> = { status };
  if (status === "sent") {
    if (!inv.items?.length) return { ok: false, error: "Add a line item first." };
    patch.sent_at = new Date().toISOString();
    const client = await getClient(tenantId, inv.client_id);
    if (client) {
      const m = invoiceSentEmail({
        brand: profile.brand,
        client,
        invoice: inv,
        url: `${site()}/c/${client.token}/invoice/${inv.id}`,
        total: totals(inv.items, inv.vat_pct).total,
      });
      void sendEmail({
        to: client.email,
        subject: m.subject,
        html: m.html,
        text: m.text,
        purpose: "transactional",
        replyTo: profile.brand.email,
      });
    }
  }
  if (status === "paid") patch.paid_at = new Date().toISOString();
  await db().from("studio_invoices").update(patch).eq("tenant_id", tenantId).eq("id", id);
  return { ok: true };
}

/* ── client link ─────────────────────────────────────────────────────── */

export async function resolveClientByToken(
  token: string
): Promise<{ client: ClientRow; profile: ProfileRow; trialing: boolean } | null> {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return null;
  const { data } = await db()
    .from("studio_clients")
    .select("*, tenants(name, contact_email)")
    .eq("token", token)
    .maybeSingle();
  if (!data) return null;
  const row = data as ClientRow & {
    tenants: { name: string; contact_email: string | null } | null;
  };
  if (row.archived) return null;
  const ent = await entitlementFor(row.tenant_id, "studio");
  if (!ent.entitled) return null;
  const profile = await getProfile(
    row.tenant_id,
    row.tenants?.name ?? "Your supplier",
    row.tenants?.contact_email ?? ""
  );
  return { client: row, profile, trialing: ent.trialing };
}
