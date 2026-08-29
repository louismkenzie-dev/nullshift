/**
 * What a client actually owes, as opposed to what has been invoiced.
 *
 * These are not the same number, and conflating them is how a portal ends up
 * telling a client "nothing owed — all settled" while a thousand pounds of
 * built-and-agreed work sits un-invoiced. An invoice is an administrative act
 * that may not have happened yet; the agreed scope is the debt.
 *
 * Pure arithmetic on rows the caller has already read, so the admin hub and the
 * client portal can never disagree about the figure.
 */

/**
 * When the project itself has not been accepted, an item counts as agreed only
 * if its own status says so. `proposed` is a quote we sent, not a debt.
 *
 * Accepting a proposal does NOT rewrite item statuses — it snapshots them onto
 * the project — so the project's acceptance is the other, equally valid signal.
 * Either one makes an item agreed; neither, and it stays a quote.
 */
const AGREED_ITEM_STATUSES = new Set(["accepted", "built", "shipped"]);

export type ScopeItem = {
  project_id?: string | null;
  amount: number | string;
  status?: string | null;
};
export type InvoiceLike = {
  project_id?: string | null;
  amount: number | string;
  status: string;
  type?: string | null;
};
export type ProjectLike = { id: string; proposal_status?: string | null };

const sum = (rows: { amount: number | string }[]) =>
  rows.reduce((t, r) => t + Number(r.amount), 0);

export type Balance = {
  /** Agreed build value, net of any deposit-credit lines. */
  agreedTotal: number;
  /** Already raised as a build invoice (paid or not), excluding drafts and voids. */
  invoicedTotal: number;
  /** Issued and awaiting payment. */
  openTotal: number;
  /** Paid across every invoice. */
  paidTotal: number;
  /**
   * Agreed but never billed. The number that must not be reported as £0 just
   * because nobody has pressed "raise invoice" yet.
   */
  unbilledTotal: number;
  /** What the client owes in total: issued-and-unpaid plus never-issued. */
  outstandingTotal: number;
};

const EMPTY: Balance = {
  agreedTotal: 0,
  invoicedTotal: 0,
  openTotal: 0,
  paidTotal: 0,
  unbilledTotal: 0,
  outstandingTotal: 0,
};

/** Live invoices: a draft was never sent and a void was withdrawn. */
const live = (invoices: InvoiceLike[]) =>
  invoices.filter((i) => i.status !== "void" && i.status !== "draft");

export function projectBalance(
  items: ScopeItem[],
  invoices: InvoiceLike[],
  opts: { projectAccepted?: boolean } = {}
): Balance {
  // Deposit-credit lines are negative and carry an `accepted` status, so they
  // net off the agreed total exactly as they do on the invoice itself.
  const agreed = opts.projectAccepted
    ? items
    : items.filter((i) => !i.status || AGREED_ITEM_STATUSES.has(i.status));
  const agreedTotal = sum(agreed);

  const rows = live(invoices);
  const invoicedTotal = sum(rows.filter((i) => i.type === "build_milestone"));
  const openTotal = sum(rows.filter((i) => i.status === "open"));
  const paidTotal = sum(rows.filter((i) => i.status === "paid"));

  // Never negative: over-invoicing relative to scope is a billing question, not
  // something to show a client as a credit they can spend.
  const unbilledTotal = Math.max(0, agreedTotal - invoicedTotal);

  return {
    agreedTotal,
    invoicedTotal,
    openTotal,
    paidTotal,
    unbilledTotal,
    outstandingTotal: openTotal + unbilledTotal,
  };
}

/**
 * The whole client, folded across their projects.
 *
 * Per-project rather than one flat sum, because acceptance is a property of a
 * project: a client can have one signed build and one live quote, and the quote
 * must not become a debt because the other project was accepted. Invoices that
 * belong to no project (ad-hoc one-offs) are counted once, at the end.
 */
export function tenantBalance(
  projects: ProjectLike[],
  items: ScopeItem[],
  invoices: InvoiceLike[]
): Balance {
  const totals: Balance = { ...EMPTY };
  const add = (b: Balance) => {
    totals.agreedTotal += b.agreedTotal;
    totals.invoicedTotal += b.invoicedTotal;
    totals.openTotal += b.openTotal;
    totals.paidTotal += b.paidTotal;
    totals.unbilledTotal += b.unbilledTotal;
    totals.outstandingTotal += b.outstandingTotal;
  };

  for (const p of projects) {
    add(
      projectBalance(
        items.filter((i) => i.project_id === p.id),
        invoices.filter((i) => i.project_id === p.id),
        { projectAccepted: p.proposal_status === "accepted" }
      )
    );
  }

  // Invoices with no project — ad-hoc bills that no scope backs. They can be
  // owed and paid, but they can never contribute an unbilled balance.
  const ids = new Set(projects.map((p) => p.id));
  const orphans = live(invoices).filter((i) => !i.project_id || !ids.has(i.project_id));
  totals.openTotal += sum(orphans.filter((i) => i.status === "open"));
  totals.paidTotal += sum(orphans.filter((i) => i.status === "paid"));
  totals.outstandingTotal += sum(orphans.filter((i) => i.status === "open"));

  return totals;
}
