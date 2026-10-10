"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { appSessionOrNull } from "@/lib/products/session";
import { entitlementFor } from "@/lib/products/entitlement";
import {
  addNote,
  createClient,
  createInvoice,
  createProposal,
  duplicateProposal,
  getProfile,
  getProposal,
  rotateClientToken,
  saveInvoice,
  saveProfile,
  saveProposal,
  sendProposal,
  setInvoiceStatus,
  updateClient,
  type InvoiceRow,
} from "@/lib/studio/data";

async function guard() {
  const session = await appSessionOrNull();
  if (!session) redirect("/app/login?next=/app/studio");
  const ent = await entitlementFor(session.workspace.tenantId, "studio");
  if (!ent.entitled) redirect("/app/studio");
  const profile = await getProfile(
    session.workspace.tenantId,
    session.workspace.tenantName,
    session.email
  );
  return { session, profile, tid: session.workspace.tenantId };
}
const s = (fd: FormData, k: string, max = 200) =>
  String(fd.get(k) ?? "")
    .trim()
    .slice(0, max);
const fail = (path: string, msg: string): never =>
  redirect(`${path}?error=${encodeURIComponent(msg)}`);

export async function saveProfileAction(formData: FormData) {
  const { tid, profile } = await guard();
  const colour = s(formData, "colour", 7);
  const logo = s(formData, "logoUrl", 400);
  const link = s(formData, "paymentLinkUrl", 400);
  await saveProfile(tid, {
    brand: {
      name: s(formData, "brandName", 80) || profile.brand.name,
      email: s(formData, "email") || profile.brand.email,
      phone: s(formData, "phone", 40),
      address: s(formData, "address", 300),
      website: s(formData, "website", 160),
      colour: /^#[0-9a-fA-F]{6}$/.test(colour) ? colour : profile.brand.colour,
      logoUrl: /^https:\/\//.test(logo) ? logo : null,
    },
    default_terms: s(formData, "defaultTerms", 8000) || null,
    bank: {
      accountName: s(formData, "accountName", 80),
      sortCode: s(formData, "sortCode", 12),
      accountNumber: s(formData, "accountNumber", 20),
      iban: s(formData, "iban", 40),
    },
    payment_link_url: /^https:\/\//.test(link) ? link : null,
    vat: {
      registered: formData.get("vatRegistered") === "on",
      ratePct: Math.max(0, Math.min(30, Number(s(formData, "vatRate", 5)) || 20)),
      number: s(formData, "vatNumber", 20),
    },
    invoice_prefix: s(formData, "invoicePrefix", 10) || "INV-",
    proposal_prefix: s(formData, "proposalPrefix", 10) || "P-",
  });
  revalidatePath("/app/studio");
  redirect("/app/studio/settings?saved=1");
}

export async function createClientAction(formData: FormData) {
  const { tid } = await guard();
  const r = await createClient(tid, {
    name: s(formData, "name", 120),
    company: s(formData, "company", 160) || null,
    email: s(formData, "email"),
    phone: s(formData, "phone", 40) || null,
    address: s(formData, "address", 300) || null,
  });
  if (!r.ok) redirect(`/app/studio?error=${encodeURIComponent(r.error)}`);
  revalidatePath("/app/studio");
  redirect(`/app/studio/clients/${r.id}`);
}

export async function updateClientAction(formData: FormData) {
  const { tid } = await guard();
  const id = s(formData, "id");
  await updateClient(tid, id, {
    name: s(formData, "name", 120),
    company: s(formData, "company", 160) || null,
    email: s(formData, "email"),
    phone: s(formData, "phone", 40) || null,
    address: s(formData, "address", 300) || null,
    archived: formData.get("archived") === "on",
  });
  revalidatePath(`/app/studio/clients/${id}`);
  redirect(`/app/studio/clients/${id}?saved=1`);
}

export async function rotateTokenAction(formData: FormData) {
  const { tid } = await guard();
  const id = s(formData, "id");
  await rotateClientToken(tid, id);
  revalidatePath(`/app/studio/clients/${id}`);
}

export async function addNoteAction(formData: FormData) {
  const { tid } = await guard();
  const id = s(formData, "clientId");
  const body = s(formData, "body", 4000);
  if (body) await addNote(tid, id, body);
  revalidatePath(`/app/studio/clients/${id}`);
}

export async function createProposalAction(formData: FormData) {
  const { tid, profile } = await guard();
  const id = await createProposal(tid, s(formData, "clientId"), profile);
  redirect(`/app/studio/proposals/${id}`);
}

export type SaveProposalInput = {
  id: string;
  title: string;
  intro: string;
  scope: string;
  items: unknown;
  terms: string;
  valid_until: string | null;
};
export async function saveProposalAction(
  input: SaveProposalInput
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { tid } = await guard();
  const r = await saveProposal(tid, input.id, input);
  revalidatePath(`/app/studio/proposals/${input.id}`);
  return r;
}

export async function sendProposalAction(formData: FormData) {
  const { tid, profile } = await guard();
  const id = s(formData, "id");
  const r = await sendProposal(tid, id, profile);
  revalidatePath(`/app/studio/proposals/${id}`);
  if (!r.ok) fail(`/app/studio/proposals/${id}`, r.error);
  redirect(`/app/studio/proposals/${id}?sent=1`);
}

export async function duplicateProposalAction(formData: FormData) {
  const { tid, profile } = await guard();
  const id = await duplicateProposal(tid, s(formData, "id"), profile);
  redirect(id ? `/app/studio/proposals/${id}` : "/app/studio");
}

export async function invoiceFromProposalAction(formData: FormData) {
  const { tid, profile } = await guard();
  const p = await getProposal(tid, s(formData, "id"));
  if (!p) redirect("/app/studio");
  const percent = Number(s(formData, "percent", 3)) || 100;
  const id = await createInvoice(tid, p.client_id, profile, {
    proposalId: p.id,
    items: p.items,
    percent,
  });
  redirect(`/app/studio/invoices/${id}`);
}

export async function createInvoiceAction(formData: FormData) {
  const { tid, profile } = await guard();
  const id = await createInvoice(tid, s(formData, "clientId"), profile, {});
  redirect(`/app/studio/invoices/${id}`);
}

export type SaveInvoiceInput = {
  id: string;
  items: unknown;
  notes: string;
  issued_on: string;
  due_on: string | null;
  vat_pct: number;
};
export async function saveInvoiceAction(
  input: SaveInvoiceInput
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { tid } = await guard();
  const r = await saveInvoice(tid, input.id, input);
  revalidatePath(`/app/studio/invoices/${input.id}`);
  return r;
}

export async function invoiceStatusAction(formData: FormData) {
  const { tid, profile } = await guard();
  const id = s(formData, "id");
  const status = s(formData, "status", 10) as InvoiceRow["status"];
  if (!["sent", "paid", "void", "draft"].includes(status))
    redirect(`/app/studio/invoices/${id}`);
  const r = await setInvoiceStatus(tid, id, status, profile);
  revalidatePath(`/app/studio/invoices/${id}`);
  if (!r.ok) fail(`/app/studio/invoices/${id}`, r.error);
  redirect(`/app/studio/invoices/${id}?saved=1`);
}
