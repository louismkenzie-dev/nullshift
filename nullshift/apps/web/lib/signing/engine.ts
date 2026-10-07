import type { createServiceClient } from "@nullshift/db";
import { logAuditAsService } from "@nullshift/db/audit";
import { legalConfig } from "@nullshift/content/legal/config";
import { sendEmail } from "@/lib/sendEmail";
import { portalReplyTo } from "@/lib/portalAccess";
import { recordDocumentEvent } from "@/lib/documentEvents";
import { verifySnapshot } from "@/lib/legal/acceptanceSnapshot";
import {
  signatureCompletedEmail,
  signatureRequestEmail,
  signatureSignedClientEmail,
  signatureStaffNoticeEmail,
  signatureVoidedEmail,
} from "@/lib/clientEmails";
import { parseDocumentSource } from "./blocks";
import {
  agreementClauses,
  buildSigningSnapshot,
  canCountersign,
  canDecline,
  canIssue,
  canResend,
  canSign,
  canVoid,
  formatMinor,
  generateSigningToken,
  hashSigningToken,
  linkExpiresAt,
  parseCommercial,
  type ConsentId,
  type Problem,
  type SignatureRequestRow,
  type SigningContent,
} from "./model";
import {
  adminSigningUrl,
  certificateUrl,
  contentOf,
  dateGB,
  dateTimeGB,
  hasSignatureEvent,
  loadSignatureRequest,
  recordSignatureEvent,
  signingUrl,
} from "./data";

/**
 * The transitions a signature request goes through, each one doing its
 * database writes, its evidence row, its receipt tick, its emails and its
 * audit line in the one place — so the admin actions, the public signing
 * page and the portal page cannot drift in what "signed" means.
 *
 * Not a "use server" module: these take the service client and the
 * already-verified actor, and the callers (which ARE server actions) do the
 * authorisation first — staff guard, link token, or tenant membership.
 *
 * Failure handling, deliberately asymmetric:
 *  - Evidence rows (signature_events) are written FIRST and a failure aborts.
 *    A signature whose record did not persist must not be reported as
 *    recorded. If the status update then fails, the request stays `issued`
 *    with a `signed` event against it — visible, recoverable, and never a
 *    silent loss of a signature.
 *  - Receipts, emails and audit lines are best-effort after that; they are
 *    conveniences and the evidence does not depend on them.
 */

type Service = ReturnType<typeof createServiceClient>;

export type EngineResult<T extends object = object> =
  | ({ ok: true } & T)
  | { ok: false; error: string; problems?: Problem[] };

const fail = <T extends object = object>(error: string, problems?: Problem[]): EngineResult<T> => ({
  ok: false,
  error,
  ...(problems ? { problems } : {}),
});

const firstProblem = (problems: Problem[]) => problems[0]?.detail ?? "That isn't allowed right now.";

export type StaffActor = { userId: string; email: string; name: string | null };
export type Evidence = { ip: string | null; userAgent: string | null };

async function tenantName(service: Service, tenantId: string): Promise<string> {
  const { data } = await service.from("tenants").select("name").eq("id", tenantId).maybeSingle();
  return (data?.name as string | undefined) ?? "the Client";
}

/** The signer-facing content, built from a draft row at the moment of issue. */
function composeContent(row: SignatureRequestRow, clientName: string, issuedAt: string): SigningContent {
  const blocks = parseDocumentSource(row.body_source);
  const commercial = parseCommercial(row.commercial);
  return {
    reference: row.reference,
    title: row.title.trim(),
    kind: row.kind,
    client: { name: clientName },
    signer: {
      name: row.signer_name.trim(),
      email: row.signer_email.trim().toLowerCase(),
      role: row.signer_role?.trim() || null,
    },
    blocks,
    commercial,
    agreement: agreementClauses({
      kind: row.kind,
      clientName,
      nullshiftName: legalConfig.entity.legalName,
      msaVersion: legalConfig.legal.clientAgreementVersion,
      hasCommercial: commercial.lines.length > 0,
    }),
    issuedAt,
  };
}

function totalLabel(content: SigningContent): string | null {
  const c = content.commercial;
  if (c.totalMinor === null) return null;
  return `Total: ${formatMinor(c.totalMinor, c.currency)}${c.note ? ` — ${c.note}` : ""}`;
}

/* ── issue ───────────────────────────────────────────────────────────────── */

export async function issueRequest(
  service: Service,
  input: { requestId: string; staff: StaffActor; message: string | null }
): Promise<EngineResult<{ reference: string }>> {
  const row = await loadSignatureRequest(service, input.requestId);
  if (!row) return fail("Not found.");
  const clientName = await tenantName(service, row.tenant_id);
  const issuedAt = new Date();
  const content = composeContent(row, clientName, issuedAt.toISOString());

  const decision = canIssue({
    status: row.status,
    title: content.title,
    blocks: content.blocks,
    signerName: content.signer.name,
    signerEmail: content.signer.email,
  });
  if (!decision.ok) return fail(firstProblem(decision.problems), decision.problems);

  const incorporated = {
    msaVersion: legalConfig.legal.clientAgreementVersion,
    publicPolicyVersion: legalConfig.legal.publicPolicyVersion,
  };
  const frozen = buildSigningSnapshot(content, incorporated);
  const token = generateSigningToken();
  const expiresAt = linkExpiresAt(issuedAt);

  const { data: updated, error } = await service
    .from("signature_requests")
    .update({
      status: "issued",
      title: content.title,
      body_blocks: content.blocks,
      commercial: content.commercial,
      signer_name: content.signer.name,
      signer_email: content.signer.email,
      signer_role: content.signer.role,
      document_snapshot: frozen.snapshot,
      document_hash: frozen.hash,
      incorporated_versions: incorporated,
      token_hash: hashSigningToken(token),
      issued_at: issuedAt.toISOString(),
      issued_by: input.staff.userId,
      expires_at: expiresAt,
    })
    .eq("id", row.id)
    .eq("status", "draft")
    .select("id")
    .maybeSingle();
  if (error) return fail(`Could not issue: ${error.message}`);
  if (!updated) return fail("This document is no longer a draft.");

  await recordSignatureEvent(service, {
    requestId: row.id,
    tenantId: row.tenant_id,
    kind: "issued",
    actorKind: "staff",
    actorUser: input.staff.userId,
    actorName: input.staff.name,
    actorEmail: input.staff.email,
    documentHash: frozen.hash,
    meta: { to: content.signer.email, expires_at: expiresAt, message: input.message },
  });
  await recordDocumentEvent(service, {
    tenantId: row.tenant_id,
    documentType: "signature_request",
    documentId: row.id,
    event: "sent",
    actor: input.staff.userId,
    actorKind: "staff",
    meta: { reference: row.reference, to: content.signer.email },
  });

  const mail = signatureRequestEmail({
    name: content.signer.name,
    title: content.title,
    reference: row.reference,
    clientName,
    url: signingUrl(token),
    expiresOn: dateGB(expiresAt),
    message: input.message,
    totalLabel: totalLabel(content),
  });
  const sent = await sendEmail({
    purpose: "transactional",
    to: content.signer.email,
    subject: mail.subject,
    html: mail.html,
    text: mail.text,
    replyTo: portalReplyTo(),
  });

  await logAuditAsService({
    action: "signature_request.issued",
    target: `signature_request:${row.id}`,
    tenantId: row.tenant_id,
    metadata: {
      reference: row.reference,
      to: content.signer.email,
      document_hash: frozen.hash,
      expires_at: expiresAt,
      emailed: sent,
      actor_email: input.staff.email,
      total_minor: content.commercial.totalMinor,
    },
  });
  if (!sent)
    return fail(
      "The document was issued but the email did not send. Use “Re-send link” to try again."
    );
  return { ok: true, reference: row.reference };
}

/* ── resend ──────────────────────────────────────────────────────────────── */

export async function resendRequest(
  service: Service,
  input: { requestId: string; staff: StaffActor; message: string | null }
): Promise<EngineResult> {
  const row = await loadSignatureRequest(service, input.requestId);
  if (!row) return fail("Not found.");
  const decision = canResend(row);
  if (!decision.ok) return fail(firstProblem(decision.problems));
  const content = contentOf(row);
  if (!content) return fail("The stored document does not verify; it cannot be re-sent.");

  // A new link invalidates the old one — there is only ever one live link.
  const token = generateSigningToken();
  const expiresAt = linkExpiresAt(new Date());
  const { error } = await service
    .from("signature_requests")
    .update({ token_hash: hashSigningToken(token), expires_at: expiresAt })
    .eq("id", row.id)
    .eq("status", "issued");
  if (error) return fail(`Could not re-send: ${error.message}`);

  await recordSignatureEvent(service, {
    requestId: row.id,
    tenantId: row.tenant_id,
    kind: "resent",
    actorKind: "staff",
    actorUser: input.staff.userId,
    actorName: input.staff.name,
    actorEmail: input.staff.email,
    meta: { to: content.signer.email, expires_at: expiresAt },
  });

  const mail = signatureRequestEmail({
    name: content.signer.name,
    title: content.title,
    reference: row.reference,
    clientName: content.client.name,
    url: signingUrl(token),
    expiresOn: dateGB(expiresAt),
    message: input.message,
    totalLabel: totalLabel(content),
  });
  const sent = await sendEmail({
    purpose: "transactional",
    to: content.signer.email,
    subject: mail.subject,
    html: mail.html,
    text: mail.text,
    replyTo: portalReplyTo(),
  });
  await logAuditAsService({
    action: "signature_request.resent",
    target: `signature_request:${row.id}`,
    tenantId: row.tenant_id,
    metadata: { reference: row.reference, to: content.signer.email, emailed: sent, actor_email: input.staff.email },
  });
  return sent ? { ok: true } : fail("The link was rotated but the email did not send.");
}

/* ── the signer opens the page ───────────────────────────────────────────── */

/**
 * First open of the link: a `link_opened` + `viewed` evidence row and the
 * receipt tick. Later opens are not recorded — one is the fact that matters.
 * Best-effort: a view record must never stop the page rendering.
 */
export async function recordOpened(
  service: Service,
  row: SignatureRequestRow,
  actor: { userId: string | null; email: string | null } & Evidence
): Promise<void> {
  try {
    if (await hasSignatureEvent(service, row.id, "viewed")) return;
    await recordSignatureEvent(service, {
      requestId: row.id,
      tenantId: row.tenant_id,
      kind: "link_opened",
      actorKind: "client",
      actorUser: actor.userId,
      actorEmail: actor.email ?? row.signer_email,
      ip: actor.ip,
      userAgent: actor.userAgent,
    });
    await recordSignatureEvent(service, {
      requestId: row.id,
      tenantId: row.tenant_id,
      kind: "viewed",
      actorKind: "client",
      actorUser: actor.userId,
      actorEmail: actor.email ?? row.signer_email,
      documentHash: row.document_hash,
      ip: actor.ip,
      userAgent: actor.userAgent,
    });
    await recordDocumentEvent(service, {
      tenantId: row.tenant_id,
      documentType: "signature_request",
      documentId: row.id,
      event: "viewed",
      actor: actor.userId,
      actorKind: "client",
      meta: { reference: row.reference },
    });
  } catch (e) {
    console.error("signing: recordOpened failed", e);
  }
}

/* ── sign ────────────────────────────────────────────────────────────────── */

export async function signRequest(
  service: Service,
  input: {
    row: SignatureRequestRow;
    name: string;
    role: string;
    consents: Partial<Record<ConsentId, boolean>>;
    actorUser: string | null;
    /** The signed-in email when there is one; the link's addressee otherwise. */
    actorEmail: string | null;
    /** The link token when the signer came by link — lets their copy be linked without a login. */
    credentialToken: string | null;
  } & Evidence
): Promise<EngineResult<{ certificateUrl: string; signedAt: string }>> {
  const { row } = input;
  const verified = verifySnapshot(row.document_snapshot as never, row.document_hash);
  const decision = canSign(
    { status: row.status, expiresAt: row.expires_at, snapshotVerified: verified },
    { name: input.name, consents: input.consents }
  );
  if (!decision.ok) return fail(firstProblem(decision.problems), decision.problems);
  const content = contentOf(row);
  if (!content || !row.document_hash) return fail("The document does not verify; it cannot be signed.");

  const name = input.name.trim();
  const role = input.role.trim();
  const email = (input.actorEmail ?? row.signer_email).trim().toLowerCase();
  const consent: Record<ConsentId, boolean> = {
    authority: !!input.consents.authority,
    read: !!input.consents.read,
    esign: !!input.consents.esign,
    bound: !!input.consents.bound,
  };

  // Evidence first. If this does not persist, nothing else happens.
  await recordSignatureEvent(service, {
    requestId: row.id,
    tenantId: row.tenant_id,
    kind: "signed",
    actorKind: "client",
    actorUser: input.actorUser,
    actorName: name,
    actorEmail: email,
    actorRole: role || null,
    signatureText: name,
    consent,
    documentHash: row.document_hash,
    ip: input.ip,
    userAgent: input.userAgent,
    meta: { via: input.credentialToken ? "link" : "portal", addressee: row.signer_email },
  });

  const signedAt = new Date().toISOString();
  const { data: updated, error } = await service
    .from("signature_requests")
    .update({ status: "signed", signed_at: signedAt })
    .eq("id", row.id)
    .eq("status", "issued")
    .select("id")
    .maybeSingle();
  if (error) {
    console.error("signing: status update failed after evidence written", error.message);
    return fail("Your signature was recorded but the document could not be updated. Nullshift has been notified.");
  }
  if (!updated) return fail("This document has already been signed.");

  await recordDocumentEvent(service, {
    tenantId: row.tenant_id,
    documentType: "signature_request",
    documentId: row.id,
    event: "signed",
    actor: input.actorUser,
    actorKind: "client",
    meta: { reference: row.reference, by: email, name },
  });

  const certUrl = certificateUrl(row.id, input.credentialToken);
  const mail = signatureSignedClientEmail({
    name,
    title: content.title,
    reference: row.reference,
    signedAt: dateTimeGB(signedAt),
    certificateUrl: certUrl,
  });
  await sendEmail({
    purpose: "transactional",
    to: email,
    subject: mail.subject,
    html: mail.html,
    text: mail.text,
    replyTo: portalReplyTo(),
  });
  const notice = signatureStaffNoticeEmail({
    title: content.title,
    reference: row.reference,
    clientName: content.client.name,
    signerName: `${name}${role ? ` (${role})` : ""}`,
    what: "signed",
    detail: `Signed ${dateTimeGB(signedAt)} from ${input.ip ?? "an unknown IP"}.`,
    adminUrl: adminSigningUrl(row.tenant_id, row.id),
  });
  await sendEmail({
    purpose: "transactional",
    to: legalConfig.contact.legal,
    subject: notice.subject,
    html: notice.html,
    text: notice.text,
  });
  await logAuditAsService({
    action: "signature_request.signed",
    target: `signature_request:${row.id}`,
    tenantId: row.tenant_id,
    metadata: { reference: row.reference, by: email, name, role, document_hash: row.document_hash, ip: input.ip },
  });
  return { ok: true, certificateUrl: certUrl, signedAt };
}

/* ── decline ─────────────────────────────────────────────────────────────── */

export async function declineRequest(
  service: Service,
  input: {
    row: SignatureRequestRow;
    reason: string | null;
    actorUser: string | null;
    actorEmail: string | null;
  } & Evidence
): Promise<EngineResult> {
  const { row } = input;
  const decision = canDecline(row);
  if (!decision.ok) return fail(firstProblem(decision.problems));
  const content = contentOf(row);
  const email = (input.actorEmail ?? row.signer_email).trim().toLowerCase();
  const reason = input.reason?.trim() || null;

  await recordSignatureEvent(service, {
    requestId: row.id,
    tenantId: row.tenant_id,
    kind: "declined",
    actorKind: "client",
    actorUser: input.actorUser,
    actorName: row.signer_name,
    actorEmail: email,
    ip: input.ip,
    userAgent: input.userAgent,
    meta: { reason },
  });
  const declinedAt = new Date().toISOString();
  const { data: updated, error } = await service
    .from("signature_requests")
    .update({ status: "declined", declined_at: declinedAt, decline_reason: reason })
    .eq("id", row.id)
    .eq("status", "issued")
    .select("id")
    .maybeSingle();
  if (error) return fail(`Could not record the decline: ${error.message}`);
  if (!updated) return fail("Nothing is awaiting your decision.");

  const notice = signatureStaffNoticeEmail({
    title: content?.title ?? row.title,
    reference: row.reference,
    clientName: content?.client.name ?? "the client",
    signerName: row.signer_name,
    what: "declined",
    detail: reason,
    adminUrl: adminSigningUrl(row.tenant_id, row.id),
  });
  await sendEmail({
    purpose: "transactional",
    to: legalConfig.contact.legal,
    subject: notice.subject,
    html: notice.html,
    text: notice.text,
  });
  await logAuditAsService({
    action: "signature_request.declined",
    target: `signature_request:${row.id}`,
    tenantId: row.tenant_id,
    metadata: { reference: row.reference, by: email, reason },
  });
  return { ok: true };
}

/* ── countersign ─────────────────────────────────────────────────────────── */

export async function countersignRequest(
  service: Service,
  input: { requestId: string; staff: StaffActor; name: string; role: string } & Evidence
): Promise<EngineResult> {
  const row = await loadSignatureRequest(service, input.requestId);
  if (!row) return fail("Not found.");
  const verified = verifySnapshot(row.document_snapshot as never, row.document_hash);
  const decision = canCountersign({ status: row.status, snapshotVerified: verified });
  if (!decision.ok) return fail(firstProblem(decision.problems));
  const content = contentOf(row);
  if (!content || !row.document_hash) return fail("The document does not verify.");
  const name = input.name.trim();
  const role = input.role.trim();
  if (!name || !role) return fail("Type your name and role to countersign.");

  await recordSignatureEvent(service, {
    requestId: row.id,
    tenantId: row.tenant_id,
    kind: "countersigned",
    actorKind: "staff",
    actorUser: input.staff.userId,
    actorName: name,
    actorEmail: input.staff.email,
    actorRole: role,
    signatureText: name,
    consent: { authority: true, read: true, esign: true, bound: true },
    documentHash: row.document_hash,
    ip: input.ip,
    userAgent: input.userAgent,
  });

  // The completed copy goes to the signer by link, so the link is rotated to a
  // fresh token that can now only VIEW (the status is terminal).
  const token = generateSigningToken();
  const now = new Date().toISOString();
  const { data: updated, error } = await service
    .from("signature_requests")
    .update({
      status: "completed",
      countersigned_at: now,
      countersigned_by: input.staff.userId,
      completed_at: now,
      token_hash: hashSigningToken(token),
      expires_at: linkExpiresAt(new Date(), 365),
    })
    .eq("id", row.id)
    .eq("status", "signed")
    .select("id")
    .maybeSingle();
  if (error) return fail(`Could not complete: ${error.message}`);
  if (!updated) return fail("The document is no longer awaiting countersignature.");

  // A linked structured Change Order becomes accepted with this evidence, so
  // the §8 build gate on tickets sees it.
  if (row.change_order_id) {
    const sig = await service
      .from("signature_events")
      .select("actor_name, actor_email, actor_user, at")
      .eq("request_id", row.id)
      .eq("kind", "signed")
      .order("at", { ascending: true })
      .limit(1)
      .maybeSingle();
    const { error: coErr } = await service
      .from("change_orders")
      .update({
        status: "accepted",
        accepted_by_name: sig.data?.actor_name ?? row.signer_name,
        accepted_by_email: sig.data?.actor_email ?? row.signer_email,
        accepted_by_user: sig.data?.actor_user ?? null,
        accepted_at: sig.data?.at ?? row.signed_at,
        contract_version: legalConfig.legal.clientAgreementVersion,
        contract_hash: row.document_hash,
      })
      .eq("id", row.change_order_id)
      .in("status", ["draft", "client_review"]);
    if (coErr) console.error("signing: linked change order update failed", coErr.message);
  }

  const signedEvent = await service
    .from("signature_events")
    .select("actor_name, actor_role, actor_email, at")
    .eq("request_id", row.id)
    .eq("kind", "signed")
    .order("at", { ascending: true })
    .limit(1)
    .maybeSingle();
  const signedBy = `${signedEvent.data?.actor_name ?? row.signer_name}${
    signedEvent.data?.actor_role ? `, ${signedEvent.data.actor_role}` : ""
  }`;
  const signedAt = dateTimeGB(signedEvent.data?.at ?? row.signed_at);
  const countersignedBy = `${name}, ${role}`;

  const clientMail = signatureCompletedEmail({
    name: row.signer_name,
    title: content.title,
    reference: row.reference,
    signedBy,
    signedAt,
    countersignedBy,
    countersignedAt: dateTimeGB(now),
    certificateUrl: certificateUrl(row.id, token),
  });
  await sendEmail({
    purpose: "transactional",
    to: signedEvent.data?.actor_email ?? row.signer_email,
    subject: clientMail.subject,
    html: clientMail.html,
    text: clientMail.text,
    replyTo: portalReplyTo(),
  });
  const staffMail = signatureCompletedEmail({
    name: input.staff.name ?? "there",
    title: content.title,
    reference: row.reference,
    signedBy,
    signedAt,
    countersignedBy,
    countersignedAt: dateTimeGB(now),
    certificateUrl: certificateUrl(row.id),
  });
  await sendEmail({
    purpose: "transactional",
    to: legalConfig.contact.legal,
    subject: staffMail.subject,
    html: staffMail.html,
    text: staffMail.text,
  });
  await logAuditAsService({
    action: "signature_request.completed",
    target: `signature_request:${row.id}`,
    tenantId: row.tenant_id,
    metadata: {
      reference: row.reference,
      countersigned_by: input.staff.email,
      name,
      role,
      document_hash: row.document_hash,
      change_order_id: row.change_order_id,
    },
  });
  return { ok: true };
}

/* ── void ────────────────────────────────────────────────────────────────── */

export async function voidRequest(
  service: Service,
  input: { requestId: string; staff: StaffActor; reason: string | null }
): Promise<EngineResult> {
  const row = await loadSignatureRequest(service, input.requestId);
  if (!row) return fail("Not found.");
  const decision = canVoid(row);
  if (!decision.ok) return fail(firstProblem(decision.problems));
  const reason = input.reason?.trim() || null;
  const wasIssued = row.status !== "draft";

  const now = new Date().toISOString();
  const { error } = await service
    .from("signature_requests")
    .update({ status: "voided", voided_at: now, void_reason: reason })
    .eq("id", row.id)
    .in("status", ["draft", "issued", "signed"]);
  if (error) return fail(`Could not void: ${error.message}`);

  await recordSignatureEvent(service, {
    requestId: row.id,
    tenantId: row.tenant_id,
    kind: "voided",
    actorKind: "staff",
    actorUser: input.staff.userId,
    actorName: input.staff.name,
    actorEmail: input.staff.email,
    meta: { reason, previous_status: row.status },
  });
  if (wasIssued) {
    const mail = signatureVoidedEmail({
      name: row.signer_name,
      title: row.title,
      reference: row.reference,
      reason,
    });
    await sendEmail({
      purpose: "transactional",
      to: row.signer_email,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
      replyTo: portalReplyTo(),
    });
  }
  await logAuditAsService({
    action: "signature_request.voided",
    target: `signature_request:${row.id}`,
    tenantId: row.tenant_id,
    metadata: { reference: row.reference, reason, previous_status: row.status, actor_email: input.staff.email },
  });
  return { ok: true };
}
