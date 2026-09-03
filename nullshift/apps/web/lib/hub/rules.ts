import { planChoiceOpen } from "@/lib/planGate";
import { SCALE_BAND_LABEL, type ScaleBand } from "@/lib/pricing/nsi";

/**
 * Client-state rules for the admin Dashboard grid — one block per client
 * (tenant), seven tiles per block. PURE: no I/O, no dates read from the clock
 * (callers pass `now`), so the traffic-light logic is unit-tested and the grid,
 * the per-client hub and the portal never disagree about a colour.
 *
 * Tones map straight onto the AppKit StatusChip vocabulary: danger (red),
 * warning (amber), success (green) plus muted for "not started / n/a".
 */

export type Tone = "danger" | "warning" | "success" | "muted";

export type TileKey =
  | "passport"
  | "billing"
  | "issues"
  | "carePlan"
  | "scale"
  | "account"
  | "docs";

export const TILE_ORDER: TileKey[] = [
  "passport",
  "billing",
  "issues",
  "carePlan",
  "scale",
  "account",
  "docs",
];

export const TILE_TITLE: Record<TileKey, string> = {
  passport: "Passport",
  billing: "Billing and Payment",
  issues: "Issues and Bugs",
  carePlan: "Care Plan",
  scale: "Scale and Risk",
  account: "Account management",
  docs: "Docs and Legal",
};

/** Path segment under /admin/clients/[id]/ for each tile. */
export const TILE_PATH: Record<TileKey, string> = {
  passport: "passport",
  billing: "billing",
  issues: "issues",
  carePlan: "care-plan",
  scale: "pricing",
  account: "account",
  docs: "docs",
};

export const tileHref = (tenantId: string, tile: TileKey) =>
  `/admin/clients/${tenantId}/${TILE_PATH[tile]}`;

export type TileState = { tone: Tone; label: string; sub: string; href: string };

// ---------------------------------------------------------------------------
// Block colour — the grid cell
// ---------------------------------------------------------------------------

export type BlockColourInput = {
  proposalStatus: string | null;
  orderFormStatus: string | null;
  tenantStatus: string | null;
  stage: string | null;
  isLead?: boolean;
};

/**
 * GREEN = a signed proposal or a signed Order Form. ORANGE = something sent and
 * awaiting signature. RED = nothing sent yet (enquiry / prospect / draft) or a
 * declined proposal. Stage never regresses the colour: a complete stage stays
 * green, and later quotes surface as a badge (see awaitingSignatureCount), not
 * a colour change.
 */
export function blockColour(input: BlockColourInput): { tone: Tone; label: string } {
  if (input.isLead) return { tone: "danger", label: "Enquiry" };
  const accepted =
    input.proposalStatus === "accepted" || input.orderFormStatus === "accepted";
  if (accepted) return { tone: "success", label: "Active" };
  // A document in flight beats a declined proposal: a client who declined the
  // proposal but now has an Order Form awaiting signature is "quote sent".
  const sent =
    input.proposalStatus === "sent" || input.orderFormStatus === "client_review";
  if (sent) return { tone: "warning", label: "Quote sent" };
  if (input.proposalStatus === "declined") return { tone: "danger", label: "Declined" };
  if (input.tenantStatus === "prospect") return { tone: "danger", label: "Enquiry" };
  return { tone: "danger", label: "Not sent" };
}

// ---------------------------------------------------------------------------
// Care plan
// ---------------------------------------------------------------------------

export type CarePlanInput = {
  scored: boolean;
  anyPriced: boolean;
  enterpriseReview: boolean;
  stage: string | null;
  choice: string | null;
  subscriptionStatus: string | null;
  subscriptionProvider: string | null;
  optionsSentAt: string | null;
  ddLinkSentAt: string | null;
  /** Optional display extras for the sub-line. */
  planLabel?: string | null;
  mrr?: number | null;
};

const LIVE_SUB = new Set(["active", "trialing"]);

const providerWord = (p: string | null) =>
  p === "gocardless"
    ? "Direct Debit"
    : p === "stripe"
      ? "card"
      : p === "manual"
        ? "standing order"
        : "plan";

const stageWord = (stage: string | null) => (stage ?? "unknown").replace(/_/g, " ");

/**
 * RED = not scored / no price ready, or past due. AMBER = options sent but not
 * subscribed, or Direct Debit link sent and the mandate not yet authorised.
 * GREEN = subscribed (active / trialing). GREY = the client chose "none", or the
 * chooser is closed because the system is not live yet.
 */
export function carePlanState(input: CarePlanInput): {
  tone: Tone;
  label: string;
  sub: string;
} {
  const price =
    input.mrr !== null && input.mrr !== undefined
      ? `GBP ${Math.round(input.mrr)}/mo`
      : null;
  const planBit = [input.planLabel, price].filter(Boolean).join(" · ");

  if (input.subscriptionStatus && LIVE_SUB.has(input.subscriptionStatus))
    return {
      tone: "success",
      label: "Subscribed",
      sub: planBit
        ? `${planBit} · ${providerWord(input.subscriptionProvider)}`
        : `Paying by ${providerWord(input.subscriptionProvider)}`,
    };

  if (input.subscriptionStatus === "past_due")
    return {
      tone: "danger",
      label: "Past due",
      sub: planBit
        ? `${planBit} · payment failing`
        : "Payment failing — chase the client",
    };

  if (input.choice === "none")
    return {
      tone: "muted",
      label: "No plan by choice",
      sub: "Client chose no care plan for now",
    };

  if (!planChoiceOpen(input.stage))
    return {
      tone: "muted",
      label: "Opens at go-live",
      sub: `Opens at go-live - stage ${stageWord(input.stage)}${
        input.scored ? "" : " · not scored yet"
      }`,
    };

  if (!input.scored)
    return {
      tone: "danger",
      label: "Not scored",
      sub: "Score the client — no price can be offered yet",
    };

  if (!input.anyPriced)
    return {
      tone: "danger",
      label: input.enterpriseReview ? "Needs a quote" : "No price ready",
      sub: input.enterpriseReview
        ? "Enterprise review — agree the monthly figure"
        : "No sellable price resolves from the assessment",
    };

  const mandatePending =
    input.subscriptionStatus === "incomplete" || !!input.ddLinkSentAt;
  if (mandatePending)
    return {
      tone: "warning",
      label: "Awaiting mandate",
      sub:
        input.subscriptionProvider === "stripe"
          ? "Card sign-up sent — not completed"
          : "Direct Debit link sent — mandate not yet authorised",
    };

  if (input.optionsSentAt)
    return {
      tone: "warning",
      label: "Options sent",
      sub:
        input.subscriptionStatus === "canceled"
          ? "Previous plan cancelled — options re-sent, not subscribed"
          : "Plan options sent — client has not subscribed",
    };

  if (input.subscriptionStatus === "canceled")
    return {
      tone: "danger",
      label: "Cancelled",
      sub: "Plan cancelled — send options again",
    };

  return {
    tone: "danger",
    label: "Options not sent",
    sub: "Priced — send the client their plan options",
  };
}

// ---------------------------------------------------------------------------
// Block shape — what tileStates() reads
// ---------------------------------------------------------------------------

export type BlockProject = {
  id: string;
  /** Review-gate approver of the proposal draft (null = awaiting approval). */
  proposalReviewedBy?: string | null;
  name: string;
  stage: string | null;
  proposalStatus: string | null;
  proposalSentAt: string | null;
  acceptedAt: string | null;
  liveUrl: string | null;
  nextAction: string | null;
  nextActionOwner: string | null;
  owners: {
    account: string | null;
    delivery: string | null;
    technical: string | null;
    finance: string | null;
  };
  profile: {
    repo: string | null;
    supabaseRef: string | null;
    health: string | null;
    buildGoal: string | null;
  } | null;
};

export type DocumentReceipt = {
  documentType: string;
  documentId: string;
  title: string;
  sentAt: string | null;
  viewedAt: string | null;
  signedAt: string | null;
  approvedAt: string | null;
  awaitingApproval: boolean;
};

export type DocsSummary = {
  awaitingApproval: number;
  awaitingSignature: number;
  signed: number;
  sent: number;
};

export type Block = {
  tenant: {
    id: string;
    name: string;
    type: string;
    status: string | null;
    vertical: string | null;
    contactName: string | null;
    contactEmail: string | null;
    carePlanChoice: string | null;
    carePlanTermsAcceptedAt: string | null;
    createdAt: string;
  };
  /** Newest first. */
  projects: BlockProject[];
  /** The newest project — "the project" everywhere the hub keys on one. */
  project: BlockProject | null;
  orderForm: {
    id: string;
    reference: string;
    status: string;
    sentAt: string | null;
    acceptedAt: string | null;
  } | null;
  changeOrdersInReview: number;
  subscription: {
    id: string;
    plan: string | null;
    planLabel: string | null;
    status: string;
    provider: string | null;
    mrr: number;
  } | null;
  pricing: {
    scored: boolean;
    anyPriced: boolean;
    enterpriseReview: boolean;
    band: ScaleBand | null;
    multiplier: number | null;
    /** Newest auto-score when unscored: how close it is to scored. */
    scan: { nsi: number | null; band: string | null; pending: number } | null;
  };
  issues: { open: number; critHigh: number; awaitingClient: number };
  invoices: {
    openCount: number;
    openTotal: number;
    overdueCount: number;
    overdueTotal: number;
    paidTotal: number;
    hasAny: boolean;
  };
  carePlan: { optionsSentAt: string | null; ddLinkSentAt: string | null };
  portal: {
    state: "none" | "invited" | "active";
    email: string | null;
    lastSignInAt: string | null;
  };
  /** Per-document read receipts (loaded for one client; [] on the grid). */
  documents: DocumentReceipt[];
  docs: DocsSummary;
  colour: { tone: Tone; label: string };
  /** Later quotes / Change Orders awaiting signature — the small badge. */
  awaitingSignature: number;
};

export const gbp = (n: number) =>
  "GBP " + Math.round(n).toLocaleString("en-GB", { maximumFractionDigits: 0 });

/** Fold a list of document receipts into the numbers the docs tile reads. */
export function summariseReceipts(docs: DocumentReceipt[]): DocsSummary {
  let awaitingApproval = 0;
  let awaitingSignature = 0;
  let signed = 0;
  let sent = 0;
  for (const d of docs) {
    if (d.awaitingApproval) awaitingApproval++;
    if (d.signedAt) signed++;
    if (d.sentAt || d.signedAt) sent++;
    if (d.sentAt && !d.signedAt) awaitingSignature++;
  }
  return { awaitingApproval, awaitingSignature, signed, sent };
}

/**
 * Documents awaiting signature AFTER the first signature — the badge on a green
 * block. Counts the Order Form in review once the proposal is signed (or the
 * reverse), plus every Change Order in client review. Never changes the colour.
 */
export function awaitingSignatureCount(input: {
  proposalStatus: string | null;
  orderFormStatus: string | null;
  changeOrdersInReview: number;
}): number {
  let n = input.changeOrdersInReview;
  const proposalSigned = input.proposalStatus === "accepted";
  const orderFormSigned = input.orderFormStatus === "accepted";
  if (proposalSigned && input.orderFormStatus === "client_review") n++;
  if (orderFormSigned && input.proposalStatus === "sent") n++;
  return n;
}

const STAGE_LABEL: Record<string, string> = {
  discovery: "Discovery",
  onboarding: "Onboarding",
  build: "Build",
  review: "Review",
  launch_prep: "Launch prep",
  live: "Live",
  care: "In care",
  complete: "Complete",
};

const stageLabel = (s: string | null) =>
  s ? (STAGE_LABEL[s] ?? s.replace(/_/g, " ")) : "no stage";

const CRIT_HIGH = new Set(["critical", "high"]);
export const isCritHigh = (severity: string | null | undefined) =>
  !!severity && CRIT_HIGH.has(severity);

// ---------------------------------------------------------------------------
// Tiles
// ---------------------------------------------------------------------------

export function tileStates(block: Block): Record<TileKey, TileState> {
  const id = block.tenant.id;
  const href = (t: TileKey) => tileHref(id, t);

  // Passport ---------------------------------------------------------------
  const passport: TileState = (() => {
    const h = href("passport");
    const p = block.project;
    if (!p)
      return {
        tone: "muted",
        label: "No system yet",
        sub: "Start build project",
        href: h,
      };
    const sub =
      block.projects.length > 1
        ? `${block.projects.length} systems · ${p.name} (${stageLabel(p.stage)})`
        : `${p.name} · ${stageLabel(p.stage)}`;
    const prof = p.profile;
    if (prof?.health === "down") return { tone: "danger", label: "Down", sub, href: h };
    if (!prof) return { tone: "danger", label: "No passport", sub, href: h };
    if (!prof.repo) return { tone: "danger", label: "No repo", sub, href: h };
    if (!prof.supabaseRef || !prof.buildGoal)
      return { tone: "warning", label: "Passport incomplete", sub, href: h };
    if (prof.health === "warning")
      return { tone: "warning", label: "Health warning", sub, href: h };
    return { tone: "success", label: stageLabel(p.stage), sub, href: h };
  })();

  // Billing -----------------------------------------------------------------
  const billing: TileState = (() => {
    const h = href("billing");
    const inv = block.invoices;
    if (inv.overdueCount > 0)
      return {
        tone: "danger",
        label: `Overdue ${gbp(inv.overdueTotal)}`,
        sub: `${inv.overdueCount} overdue · ${inv.openCount} open`,
        href: h,
      };
    if (inv.openCount > 0)
      return {
        tone: "warning",
        label: `Awaiting payment ${gbp(inv.openTotal)}`,
        sub: `${inv.openCount} open invoice${inv.openCount === 1 ? "" : "s"}`,
        href: h,
      };
    if (inv.hasAny)
      return {
        tone: "success",
        label: "Settled",
        sub: `Invested ${gbp(inv.paidTotal)}`,
        href: h,
      };
    return { tone: "muted", label: "No invoices", sub: "Nothing raised yet", href: h };
  })();

  // Issues ------------------------------------------------------------------
  const issues: TileState = (() => {
    const h = href("issues");
    const i = block.issues;
    if (i.critHigh > 0)
      return {
        tone: "danger",
        label: `${i.critHigh} critical/high`,
        sub: `${i.open} open · ${i.awaitingClient} waiting on client`,
        href: h,
      };
    if (i.open > 0)
      return {
        tone: "warning",
        label: `${i.open} open`,
        sub:
          i.awaitingClient > 0
            ? `${i.awaitingClient} waiting on client`
            : "Nothing critical",
        href: h,
      };
    return { tone: "success", label: "Clear", sub: "No open issues", href: h };
  })();

  // Care plan ---------------------------------------------------------------
  const carePlan: TileState = (() => {
    const s = carePlanState({
      scored: block.pricing.scored,
      anyPriced: block.pricing.anyPriced,
      enterpriseReview: block.pricing.enterpriseReview,
      stage: block.project?.stage ?? null,
      choice: block.tenant.carePlanChoice,
      subscriptionStatus: block.subscription?.status ?? null,
      subscriptionProvider: block.subscription?.provider ?? null,
      optionsSentAt: block.carePlan.optionsSentAt,
      ddLinkSentAt: block.carePlan.ddLinkSentAt,
      planLabel: block.subscription?.planLabel ?? null,
      mrr: block.subscription?.mrr ?? null,
    });
    return { ...s, href: href("carePlan") };
  })();

  // Scale and risk ----------------------------------------------------------
  const scale: TileState = (() => {
    const h = href("scale");
    const pr = block.pricing;
    if (!pr.scored) {
      if (pr.scan && pr.scan.nsi !== null)
        return {
          tone: "warning",
          label: `Auto NSI ${pr.scan.nsi} - confirm`,
          sub: `${pr.scan.pending} field${pr.scan.pending === 1 ? "" : "s"} to confirm`,
          href: h,
        };
      return {
        tone: "danger",
        label: "Not scored",
        sub: "Run the scale assessment",
        href: h,
      };
    }
    if (pr.enterpriseReview && !pr.anyPriced)
      return {
        tone: "warning",
        label: "Enterprise review",
        sub: "Agree the monthly figure by hand",
        href: h,
      };
    const band = pr.band ? SCALE_BAND_LABEL[pr.band] : "Enterprise";
    const mult = pr.multiplier !== null ? ` x${pr.multiplier}` : "";
    return { tone: "success", label: `Band ${band}${mult}`, sub: "Scored", href: h };
  })();

  // Account management ------------------------------------------------------
  const account: TileState = (() => {
    const h = href("account");
    const p = block.project;
    const owners = p
      ? [p.owners.account, p.owners.delivery, p.owners.technical, p.owners.finance]
      : [];
    const anyOwner = owners.some((o) => !!o && o.trim().length > 0);
    const portalSub =
      block.portal.state === "active"
        ? "Portal signed in"
        : block.portal.state === "invited"
          ? "Portal invited"
          : "No portal account";
    if (!p?.nextAction)
      return { tone: "warning", label: "No next action", sub: portalSub, href: h };
    if (!anyOwner)
      return {
        tone: "warning",
        label: "No owner",
        sub: `NEXT: ${p.nextAction}`,
        href: h,
      };
    if (block.portal.state === "invited")
      return {
        tone: "warning",
        label: "Never signed in",
        sub: `NEXT: ${p.nextAction}`,
        href: h,
      };
    if (block.portal.state === "none")
      return {
        tone: "warning",
        label: "No portal access",
        sub: `NEXT: ${p.nextAction}`,
        href: h,
      };
    return {
      tone: "success",
      label: "On track",
      sub: `NEXT: ${p.nextAction}${p.nextActionOwner ? ` — ${p.nextActionOwner}` : ""}`,
      href: h,
    };
  })();

  // Docs and legal ----------------------------------------------------------
  const docs: TileState = (() => {
    const h = href("docs");
    const d = block.docs;
    if (d.awaitingApproval > 0)
      return {
        tone: "warning",
        label: `${d.awaitingApproval} awaiting approval`,
        sub: "Needs a second staff member before it can be sent",
        href: h,
      };
    if (d.awaitingSignature > 0)
      return {
        tone: "warning",
        label: `${d.awaitingSignature} awaiting signature`,
        sub: `${d.signed} signed · ${d.sent} sent`,
        href: h,
      };
    if (d.sent === 0 && d.signed === 0)
      return { tone: "muted", label: "Nothing sent", sub: "Draft the proposal", href: h };
    return {
      tone: "success",
      label: "All signed",
      sub: `${d.signed} document${d.signed === 1 ? "" : "s"} signed`,
      href: h,
    };
  })();

  return { passport, billing, issues, carePlan, scale, account, docs };
}
