import Link from "next/link";
import { LiveQuotes } from "./quotes/LiveQuotes";
import { quoteBuilderEnabled } from "@/lib/next/quote-data";
import { notFound } from "next/navigation";
import {
  ArrowDownLeft,
  ArrowRight,
  Check,
  FileText,
  Plus,
  Search,
  Users,
  Wallet,
} from "lucide-react";
import { loadOperations } from "@/lib/next/live-data";
import {
  humanise,
  initials,
  money,
  operationsSummary,
  readDraftNotes,
  type OperationsData,
} from "@/lib/next/live-model";
import s from "./next.module.css";

function SourceStatus({ data }: { data: OperationsData }) {
  if (!data.unavailable.length && !data.limited.length) return null;
  return (
    <div className={s.dataWarning} role="status">
      {data.unavailable.length > 0 && (
        <p>
          Could not load: {data.unavailable.join(", ")}. Missing information is not shown
          as zero.
        </p>
      )}
      {data.limited.length > 0 && (
        <p>
          Showing the latest 1,000 records for {data.limited.join(", ")}. Totals cover the
          loaded records only.
        </p>
      )}
    </div>
  );
}

export function Status({ value }: { value: string | null }) {
  const tone = ["paid", "accepted", "live", "care", "active", "complete"].includes(
    value ?? ""
  )
    ? s.statusGood
    : ["past_due", "overdue", "failed"].includes(value ?? "")
      ? s.statusBad
      : "";
  return (
    <span className={`${s.status} ${tone}`}>
      <span aria-hidden="true" />
      {humanise(value)}
    </span>
  );
}

function Heading({
  eyebrow,
  title,
  description,
  action = true,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: boolean;
}) {
  return (
    <div className={s.pageHead}>
      <div>
        <p className={s.eyebrow}>{eyebrow}</p>
        <h1 className={s.h1}>{title}</h1>
        <p className={s.lead}>{description}</p>
      </div>
      {action && (
        <Link href="/admin/next/clients/new" className={s.btnPrimary}>
          <Plus size={16} />
          Add client
        </Link>
      )}
    </div>
  );
}

function Empty({ title, text }: { title: string; text: string }) {
  return (
    <div className={s.empty}>
      <span className={s.emptyIcon}>
        <FileText size={24} />
      </span>
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}

function Stats({ data }: { data: OperationsData }) {
  const stats = operationsSummary(data);
  const entries = [
    {
      label: "Clients",
      value: String(stats.clients),
      detail: "Existing client records",
      href: "/admin/next/clients",
      icon: Users,
    },
    {
      label: "In delivery",
      value: data.unavailable.includes("Projects") ? "—" : String(stats.inDelivery),
      detail: "Projects before live / care",
      href: "/admin/next/delivery",
      icon: ArrowRight,
    },
    {
      label: "Monthly fees",
      value: stats.monthly === null ? "—" : money(stats.monthly),
      detail: "Recorded active subscriptions",
      href: "/admin/next/finance",
      icon: Wallet,
    },
    {
      label: "Open invoices",
      value: stats.openInvoices === null ? "—" : money(stats.openInvoices),
      detail: "Recorded open invoice amounts",
      href: "/admin/next/finance",
      icon: ArrowDownLeft,
    },
  ];
  return (
    <div className={s.statGrid}>
      {entries.map(({ label, value, detail, href, icon: Icon }) => (
        <Link href={href} key={label} className={s.statCell}>
          <div className={s.statLabel}>
            {label}
            <Icon size={15} aria-hidden="true" />
          </div>
          <div className={s.statNumber}>{value}</div>
          <div className={s.statDetail}>{detail}</div>
        </Link>
      ))}
    </div>
  );
}

export async function LiveToday() {
  const data = await loadOperations();
  const stats = operationsSummary(data);
  const clients = new Map(data.clients.map((c) => [c.id, c]));
  const actions = stats.actions.length
    ? stats.actions
    : data.projects.filter((p) =>
        ["discovery", "onboarding", "build", "review"].includes(p.stage)
      );
  const date = new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Europe/London",
  }).format(new Date());
  return (
    <>
      <Heading
        eyebrow={date}
        title="Today"
        description="A clear view of your clients. One next step at a time."
      />
      <SourceStatus data={data} />
      <Stats data={data} />
      <div className={s.dashboardColumns}>
        <section className={s.workPanel}>
          <div className={s.panelHead}>
            <div>
              <h2 className={s.h2}>Keep things moving</h2>
              <p className={s.muted}>
                Your recorded next actions and projects to review.
              </p>
            </div>
            <span className={s.counter}>{actions.length}</span>
          </div>
          {actions.length ? (
            actions.slice(0, 8).map((p) => (
              <Link
                className={s.actionRow}
                key={p.id}
                href={`/admin/next/clients/${p.tenant_id}`}
              >
                <span className={s.avatar}>
                  {initials(clients.get(p.tenant_id)?.name ?? p.name)}
                </span>
                <span className={s.actionBody}>
                  <strong>{clients.get(p.tenant_id)?.name ?? p.name}</strong>
                  <span>{p.next_action || "Set the next step for this project"}</span>
                </span>
                <span className={s.actionOwner}>
                  {p.next_action_owner || p.account_owner || "Unassigned"}
                </span>
                <ArrowRight size={17} />
              </Link>
            ))
          ) : (
            <Empty
              title="No next actions recorded"
              text="Open a client to review their project and set the next step."
            />
          )}
          <div className={s.panelFoot}>
            <Link href="/admin/next/delivery">
              View all projects <ArrowRight size={14} />
            </Link>
          </div>
        </section>
        <aside className={s.stack}>
          <section className={s.startCard}>
            <span className={s.eyebrow}>A better beginning</span>
            <h2>
              A new client.
              <br />A clear next step.
            </h2>
            <p>Capture the essentials, outline the project and start their workspace.</p>
            <Link href="/admin/next/clients/new" className={s.btnPrimary}>
              Add a client <ArrowRight size={16} />
            </Link>
            <span className={s.smallNote}>
              No invitations, contracts or charges are sent.
            </span>
          </section>
          <section className={s.workPanel}>
            <div className={s.panelHead}>
              <h2 className={s.h2}>Your clients</h2>
              <Link href="/admin/next/clients" className={s.subtleLink}>
                View all
              </Link>
            </div>
            {data.clients.slice(0, 5).map((c) => (
              <Link
                className={s.shortRow}
                href={`/admin/next/clients/${c.id}`}
                key={c.id}
              >
                <span className={s.avatarSmall}>{initials(c.name)}</span>
                <span>{c.name}</span>
                <ArrowRight size={14} />
              </Link>
            ))}
          </section>
        </aside>
      </div>
      <p className={s.sourceFoot}>
        Existing Nullshift records · Read{" "}
        {new Date(data.loadedAt).toLocaleTimeString("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
          timeZone: "Europe/London",
        })}{" "}
        · No provider or bank reconciliation was run.
      </p>
    </>
  );
}

export async function LiveClients({ query = "" }: { query?: string }) {
  const data = await loadOperations();
  const rows = data.clients.filter((c) =>
    `${c.name} ${c.contact_name ?? ""} ${c.contact_email ?? ""}`
      .toLowerCase()
      .includes(query.toLowerCase())
  );
  return (
    <>
      <Heading
        eyebrow="Relationships"
        title="Clients"
        description="Everyone you work with, and where things stand."
      />
      <SourceStatus data={data} />
      <div className={s.directoryToolbar}>
        <span className={s.muted}>{data.clients.length} client records</span>
        <form className={s.searchForm} action="/admin/next/clients">
          <Search size={17} />
          <input
            name="q"
            defaultValue={query}
            placeholder="Find a client…"
            aria-label="Find a client"
          />
          <button type="submit" className={s.searchSubmit}>
            Search
          </button>
          {query && (
            <Link href="/admin/next/clients" className={s.subtleLink}>
              Clear
            </Link>
          )}
        </form>
      </div>
      <section className={s.workPanel}>
        <div className={s.directoryHead}>
          <span>Client</span>
          <span>Project</span>
          <span>Active monthly fee</span>
          <span />
        </div>
        {rows.map((c) => {
          const projects = data.projects.filter((p) => p.tenant_id === c.id);
          const subs = data.subscriptions.filter(
            (r) => r.tenant_id === c.id && r.status === "active"
          );
          return (
            <Link
              href={`/admin/next/clients/${c.id}`}
              key={c.id}
              className={s.directoryRow}
            >
              <span className={s.clientIdentity}>
                <span className={s.avatar}>{initials(c.name)}</span>
                <span>
                  <strong>{c.name}</strong>
                  <span className={s.recordSub}>
                    {c.contact_name || c.contact_email || "Contact not recorded"}
                  </span>
                </span>
              </span>
              <span>
                <Status
                  value={
                    projects.length === 1
                      ? projects[0].stage
                      : projects.length
                        ? "multiple projects"
                        : "not started"
                  }
                />
                <span className={s.recordSub}>
                  {projects.length} {projects.length === 1 ? "project" : "projects"}
                </span>
              </span>
              <span className={s.money}>
                {data.unavailable.includes("Subscriptions") ||
                data.limited.includes("Subscriptions") ||
                subs.some((sub) => sub.mrr === null)
                  ? "Unavailable"
                  : subs.length
                    ? `${money(subs.reduce((n, r) => n + Number(r.mrr ?? 0), 0))}/mo`
                    : "No active plan"}
              </span>
              <ArrowRight size={17} />
            </Link>
          );
        })}
        {!rows.length && (
          <Empty
            title={query ? "No matching clients" : "Your first client starts here"}
            text={
              query
                ? "Try a business name or contact email."
                : "Add a client to start their workspace."
            }
          />
        )}
      </section>
      <p className={s.sourceFoot}>
        Existing records are shown as stored. Similar names have not been merged and
        prices have not been changed.
      </p>
    </>
  );
}

export async function LiveClient({ id }: { id: string }) {
  const data = await loadOperations();
  const c = data.clients.find((row) => row.id === id);
  if (!c) notFound();
  const projects = data.projects.filter((p) => p.tenant_id === id);
  const agreements = data.agreements.filter((a) => a.tenant_id === id);
  const invoices = data.invoices.filter((a) => a.tenant_id === id);
  const subs = data.subscriptions.filter((a) => a.tenant_id === id);
  const draft = readDraftNotes(c.notes);
  const current = `/admin/clients/${id}`;
  const nextSteps = [
    {
      label: "Client details",
      description: "Main contact and initial project brief",
      done: !!(c.contact_name && c.contact_email && projects.length),
      href: current,
      action: "Review details",
    },
    {
      label: "Scope & pricing",
      description: "Define deliverables, exclusions and a costed quote",
      done: false,
      href: `/admin/next/quotes/new?client=${id}`,
      action: "Build a quote",
    },
    {
      label: "Agreement",
      description: "Review terms and service route before sending",
      done: agreements.some((a) => a.status === "accepted"),
      href: `${current}/agreement`,
      action: "Review agreement",
    },
    {
      label: "Initial payment",
      description: "Create an invoice only after the agreed terms are ready",
      done: invoices.some((i) => i.status === "paid" && i.type === "build_milestone"),
      href: `${current}/billing`,
      action: "Review billing",
    },
    {
      label: "Build & handover",
      description:
        "Review delivery and confirm build acceptance separately from proposal acceptance",
      done: false,
      href: current,
      action: "Open project",
    },
  ];
  return (
    <>
      <Link href="/admin/next/clients" className={s.backLink}>
        ← All clients
      </Link>
      <Heading
        eyebrow="Client workspace"
        title={c.name}
        description={
          c.contact_name
            ? `Your main contact is ${c.contact_name}.`
            : "Keep the relationship and the work in one place."
        }
        action={false}
      />
      <SourceStatus data={data} />
      {draft && (
        <div className={s.quietNotice}>
          <Check size={18} />
          <div>
            <strong>Workspace created. Nothing has been sent.</strong>
            <p>
              Service preference: {humanise(draft.serviceRoute)}. This is an internal
              note—not an accepted contract or monthly plan.
            </p>
          </div>
        </div>
      )}
      <div className={s.dashboardColumns}>
        <div className={s.stack}>
          <section className={s.workPanel}>
            <div className={s.panelHead}>
              <div>
                <h2 className={s.h2}>The client journey</h2>
                <p className={s.muted}>
                  Review each stage before taking the next action.
                </p>
              </div>
            </div>
            <ol className={s.journey}>
              {nextSteps.map((step, i) => (
                <li key={step.label}>
                  <span className={`${s.stepNumber} ${step.done ? s.stepChecked : ""}`}>
                    {step.done ? <Check size={16} /> : String(i + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <strong>{step.label}</strong>
                    <p>{step.description}</p>
                    <Link href={step.href} prefetch={false}>
                      {step.action} <ArrowRight size={13} />
                    </Link>
                  </div>
                </li>
              ))}
            </ol>
            <div className={s.panelFoot}>
              Manage each stage in this workspace. Sending and payment actions remain
              separate from saving a quote.
            </div>
          </section>
          <section className={s.workPanel}>
            <div className={s.panelHead}>
              <h2 className={s.h2}>Projects</h2>
              <span className={s.counter}>{projects.length}</span>
            </div>
            {projects.map((p) => (
              <div className={s.projectRow} key={p.id}>
                <div className={s.projectTop}>
                  <h3>{p.name}</h3>
                  <Status value={p.stage} />
                </div>
                {p.overview && <p className={s.briefText}>{p.overview}</p>}
                <div className={s.projectNext}>
                  <span className={s.eyebrow}>Next step</span>
                  <p>{p.next_action || "No next action recorded"}</p>
                  <span className={s.muted}>
                    {p.next_action_owner || p.account_owner || "Owner unassigned"}
                  </span>
                </div>
              </div>
            ))}
            {!projects.length && (
              <Empty
                title="Project setup needs completing"
                text="The client record exists. Open project details to complete setup."
              />
            )}
          </section>
        </div>
        <aside className={s.stack}>
          <section className={s.workPanel}>
            <div className={s.panelHead}>
              <h2 className={s.h2}>Contact</h2>
            </div>
            <dl className={s.detailList}>
              <div>
                <dt>Name</dt>
                <dd>{c.contact_name || "Not recorded"}</dd>
              </div>
              <div>
                <dt>Email</dt>
                <dd>{c.contact_email || "Not recorded"}</dd>
              </div>
              <div>
                <dt>Phone</dt>
                <dd>{c.contact_phone || "Not recorded"}</dd>
              </div>
            </dl>
          </section>
          <section className={s.workPanel}>
            <div className={s.panelHead}>
              <h2 className={s.h2}>Managed platform</h2>
            </div>
            <div className={s.panelBody}>
              {subs.length ? (
                subs.map((sub) => (
                  <div key={sub.id} className={s.subscriptionLine}>
                    <Status value={sub.status} />
                    <strong>
                      {sub.mrr === null ? "Amount not recorded" : `${money(sub.mrr)}/mo`}
                    </strong>
                    <span className={s.muted}>
                      {humanise(sub.plan)} · {humanise(sub.provider)}
                    </span>
                  </div>
                ))
              ) : (
                <>
                  <p>No subscription recorded.</p>
                  <p className={s.muted}>
                    Managed package choice comes after build acceptance. Billing needs an
                    accepted amount and an agreed date.
                  </p>
                </>
              )}
            </div>
          </section>
          <section className={s.workPanel}>
            <div className={s.panelHead}>
              <h2 className={s.h2}>Independent handover</h2>
            </div>
            <div className={s.panelBody}>
              <strong className={s.price}>£600</strong>
              <p className={s.muted}>
                The proposed alternative to ongoing management. Scope and tax treatment
                must be agreed before issuing terms. No charge is created here.
              </p>
            </div>
          </section>
          <Link href={current} prefetch={false} className={s.btn}>
            Client & project details <ArrowRight size={15} />
          </Link>
        </aside>
      </div>
    </>
  );
}

export async function LiveSales() {
  const data = await loadOperations();
  const clientEmails = new Set(
    data.clients.map((c) => c.contact_email?.toLowerCase()).filter(Boolean)
  );
  const leads = data.leads.filter(
    (l) => !l.email || !clientEmails.has(l.email.toLowerCase())
  );
  const prospects = data.projects.filter((p) =>
    ["discovery", "onboarding"].includes(p.stage)
  );
  const clients = new Map(data.clients.map((c) => [c.id, c]));
  return (
    <>
      <Heading
        eyebrow="Build the relationship"
        title="Sales & quotes"
        description="New enquiries and projects taking shape."
      />
      <SourceStatus data={data} />
      {quoteBuilderEnabled() && (
        <div style={{ marginBottom: 24 }}>
          <LiveQuotes compact />
        </div>
      )}
      <div className={s.dashboardColumns}>
        <section className={s.workPanel}>
          <div className={s.panelHead}>
            <h2 className={s.h2}>Projects to scope</h2>
            <span className={s.counter}>{prospects.length}</span>
          </div>
          {prospects.map((p) => (
            <Link
              key={p.id}
              href={`/admin/next/clients/${p.tenant_id}`}
              className={s.actionRow}
            >
              <span className={s.avatar}>
                {initials(clients.get(p.tenant_id)?.name ?? p.name)}
              </span>
              <span className={s.actionBody}>
                <strong>{clients.get(p.tenant_id)?.name ?? p.name}</strong>
                <span>{p.name}</span>
              </span>
              <Status value={p.proposal_status || "draft"} />
              <ArrowRight size={16} />
            </Link>
          ))}
          {!prospects.length && (
            <Empty
              title="No projects awaiting scope"
              text="Add a client when you’re ready to shape their first project."
            />
          )}
        </section>
        <section className={s.workPanel}>
          <div className={s.panelHead}>
            <h2 className={s.h2}>Enquiries</h2>
            <span className={s.counter}>{leads.length}</span>
          </div>
          {leads.map((l) => (
            <Link
              href="/admin/pipeline"
              prefetch={false}
              key={l.id}
              className={s.shortRow}
            >
              <span>
                {l.name || "Unnamed enquiry"}
                <span className={s.recordSub}>{humanise(l.status)}</span>
              </span>
              <ArrowRight size={15} />
            </Link>
          ))}
          {!leads.length && (
            <Empty
              title="All caught up"
              text="There are no unmatched enquiries in the current records."
            />
          )}
        </section>
      </div>
      {!quoteBuilderEnabled() && (
        <p className={s.sourceFoot}>Quote saving is not enabled in this environment.</p>
      )}
    </>
  );
}

export async function LiveDelivery() {
  const data = await loadOperations();
  const clients = new Map(data.clients.map((c) => [c.id, c]));
  return (
    <>
      <Heading
        eyebrow="From brief to build"
        title="Delivery"
        description="Every project, its owner and the next step."
      />
      <SourceStatus data={data} />
      <section className={s.workPanel}>
        <div className={s.panelHead}>
          <h2 className={s.h2}>Projects</h2>
          <span className={s.counter}>{data.projects.length}</span>
        </div>
        {data.projects.map((p) => (
          <Link
            className={s.actionRow}
            key={p.id}
            href={`/admin/next/clients/${p.tenant_id}`}
          >
            <span className={s.avatar}>
              {initials(clients.get(p.tenant_id)?.name ?? p.name)}
            </span>
            <span className={s.actionBody}>
              <strong>{p.name}</strong>
              <span>{p.next_action || "No next action recorded"}</span>
              <small>{p.account_owner || "Owner unassigned"}</small>
            </span>
            <Status value={p.stage} />
            <ArrowRight size={16} />
          </Link>
        ))}
        {!data.projects.length && (
          <Empty
            title="No projects yet"
            text="A project workspace is created when you add a client."
          />
        )}
      </section>
    </>
  );
}

export async function LiveFinance() {
  const data = await loadOperations();
  const clients = new Map(data.clients.map((c) => [c.id, c]));
  return (
    <>
      <Heading
        eyebrow="Financial overview"
        title="Finance"
        description="Your recorded invoices and monthly fees. No payment actions are triggered here."
        action={false}
      />
      <SourceStatus data={data} />
      <Stats data={data} />
      <section className={s.workPanel}>
        <div className={s.panelHead}>
          <h2 className={s.h2}>Invoices</h2>
          <span className={s.counter}>{data.invoices.length}</span>
        </div>
        {data.invoices.map((i) => (
          <Link
            key={i.id}
            href={`/admin/clients/${i.tenant_id}/billing`}
            prefetch={false}
            className={s.actionRow}
          >
            <span className={s.avatar}>
              <FileText size={18} />
            </span>
            <span className={s.actionBody}>
              <strong>{clients.get(i.tenant_id)?.name ?? "Client"}</strong>
              <span>
                {humanise(i.type)} ·{" "}
                {i.due_at
                  ? `Due ${new Date(i.due_at).toLocaleDateString("en-GB")}`
                  : "No due date recorded"}
              </span>
            </span>
            <span className={s.invoiceAmount}>
              <strong>{money(i.amount)}</strong>
              <Status value={i.status} />
            </span>
            <ArrowRight size={16} />
          </Link>
        ))}
        {!data.invoices.length && (
          <Empty
            title="No invoices to show"
            text="Issued invoices will appear here from your existing records."
          />
        )}
      </section>
      <div className={s.quietNotice}>
        <Wallet size={18} />
        <div>
          <strong>Recorded amounts, not a live bank balance.</strong>
          <p>
            Opening this view does not sync Xero, refresh provider statuses, collect
            payments or reconcile payouts. Detailed financial actions remain in the
            existing billing workspace.
          </p>
        </div>
      </div>
    </>
  );
}

export async function LiveAgreements() {
  const data = await loadOperations();
  const clients = new Map(data.clients.map((c) => [c.id, c]));
  return (
    <>
      <Heading
        eyebrow="The agreed scope"
        title="Agreements"
        description="Existing Order Forms, with their original status and acceptance records."
        action={false}
      />
      <SourceStatus data={data} />
      <section className={s.workPanel}>
        <div className={s.panelHead}>
          <h2 className={s.h2}>Order Forms</h2>
          <span className={s.counter}>{data.agreements.length}</span>
        </div>
        {data.agreements.map((a) => (
          <Link
            key={a.id}
            className={s.actionRow}
            href={`/admin/clients/${a.tenant_id}/agreement`}
            prefetch={false}
          >
            <span className={s.avatar}>
              <FileText size={18} />
            </span>
            <span className={s.actionBody}>
              <strong>{clients.get(a.tenant_id)?.name ?? "Client"}</strong>
              <span>{a.reference}</span>
            </span>
            <Status value={a.status} />
            <ArrowRight size={16} />
          </Link>
        ))}
        {!data.agreements.length && (
          <Empty
            title="No Order Forms recorded"
            text="Start in the client workspace when scope and pricing are ready."
          />
        )}
      </section>
      <p className={s.sourceFoot}>
        This list shows Order Forms, not every historical proposal or legal document. Open
        an agreement to review its full document history in this workspace.
      </p>
    </>
  );
}
export function LiveSettings({
  flags,
  creationEnabled,
}: {
  flags: string[];
  creationEnabled: boolean;
}) {
  const links = [
    ["Sales & quotes", "Enquiries and projects to scope", "/admin/next/sales"],
    ["Finance", "Existing invoices and recorded monthly fees", "/admin/next/finance"],
    ["Agreements", "Order Forms and their current status", "/admin/next/agreements"],
    ["Automations", "What is and isn’t enabled", "/admin/next/automations"],
    [
      "Account & security",
      "Your sign-in and two-factor authentication",
      "/admin/security",
    ],
    [
      "Billing & integrations",
      "Invoices, collection methods and provider connections",
      "/admin/billing",
    ],
    ["Delivery tasks", "Plan and track the work", "/admin/tasks"],
    ["Issues & support", "Incoming client work", "/admin/issues"],
    ["Business vault", "Internal company records", "/admin/vault"],
    ["Compliance", "Client compliance records", "/admin/compliance"],
  ];
  return (
    <>
      <Heading
        eyebrow="Your workspace"
        title="Tools & settings"
        description="The essentials, without the clutter."
        action={false}
      />
      <div className={s.dashboardColumns}>
        <section className={s.workPanel}>
          <div className={s.panelHead}>
            <h2 className={s.h2}>Quick access</h2>
          </div>
          {links.map(([title, detail, href]) => (
            <Link
              key={href}
              href={href}
              prefetch={href.startsWith("/admin/next") ? undefined : false}
              className={s.actionRow}
            >
              <span className={s.actionBody}>
                <strong>{title}</strong>
                <span>{detail}</span>
              </span>
              <ArrowRight size={16} />
            </Link>
          ))}
        </section>
        <section className={s.workPanel}>
          <div className={s.panelHead}>
            <h2 className={s.h2}>Workspace status</h2>
          </div>
          <dl className={s.detailList}>
            <div>
              <dt>Client records</dt>
              <dd>Connected to existing records</dd>
            </div>
            <div>
              <dt>Client creation</dt>
              <dd>
                {creationEnabled
                  ? "Enabled · internal records only"
                  : "Disabled · practice walkthrough available"}
              </dd>
            </div>
            <div>
              <dt>New-model feature flags</dt>
              <dd>{flags.length ? flags.join(", ") : "All off"}</dd>
            </div>
            <div>
              <dt>Existing pricing</dt>
              <dd>Unchanged</dd>
            </div>
          </dl>
          <div className={s.panelFoot}>
            This is not a connectivity check for Xero, Stripe or Revolut. No provider
            credentials are shown here.
          </div>
        </section>
      </div>
    </>
  );
}

export function LiveAutomations({ flags }: { flags: string[] }) {
  return (
    <>
      <Heading
        eyebrow="Deliberate automation"
        title="Automations"
        description="Automate the handoffs. Keep the important decisions yours."
        action={false}
      />
      <div className={s.quietNotice}>
        <Check size={18} />
        <div>
          <strong>New financial automations remain off.</strong>
          <p>
            Existing operational behaviour remains unchanged. Provider connectivity and
            migration readiness must be checked before the new financial workflows are
            enabled.
          </p>
        </div>
      </div>
      <section className={s.workPanel}>
        <div className={s.panelHead}>
          <h2 className={s.h2}>New-model controls</h2>
        </div>
        {[
          [
            "integrationWorkers",
            "Integration workers",
            "Durable provider events and retries. A flag alone does not prove connectivity.",
          ],
          [
            "billingActivation",
            "Billing activation",
            "Requires accepted terms, an agreed start date and verified collection authority.",
          ],
          [
            "acceptanceGate",
            "Build acceptance",
            "Keeps build acceptance separate from quote or proposal acceptance.",
          ],
          [
            "commercialV2",
            "Commercial records",
            "New quote and service-arrangement storage. Existing agreements stay intact.",
          ],
        ].map(([key, title, detail]) => (
          <div className={s.actionRow} key={key}>
            <span className={s.actionBody}>
              <strong>{title}</strong>
              <span>{detail}</span>
            </span>
            <Status value={flags.includes(key) ? "flag enabled" : "off"} />
          </div>
        ))}
      </section>
    </>
  );
}
