"use client";

import React from "react";
import { T } from "@nullshift/ui/tokens";
import { LEGAL_ENTITY } from "@nullshift/content/legalEntity";

/* ============================================================
   Service & Support Terms — the agreement that makes the
   commercial model binding rather than merely explained.

   It exists because the expensive misunderstandings in this
   business are all definitional: what "support" covers, why a
   monthly plan is quoted "from" a price, why a new capability is
   a separate invoice, and — the big one — that a client without a
   care plan is running their own hosting and maintenance from
   handover. Signing the proposal accepts these terms, so they
   have to be readable BEFORE the signature, not after.

   Mirrors DpaTemplate: "template" mode for the public /legal tab,
   "proposal" mode for a specific client's signed copy.
   ============================================================ */

export type ServiceTermsProps = {
  clientName?: string | null;
  /** Pre-formatted; null in proposal mode → "on acceptance". */
  effectiveDate?: string | null;
  /** The plan proposed alongside — null when no care plan is included. */
  carePlanLabel?: string | null;
  /** Set once the proposal is signed. */
  accepted?: { name: string; at: string } | null;
  mode?: "template" | "proposal";
};

/* ── Primitives (matched to DpaTemplate) ────────────────────── */
function H2({ children }: { children: React.ReactNode }) {
  return (
    <h2
      className="mt-12 mb-5 first:mt-0"
      style={{
        fontFamily: T.display,
        fontWeight: 600,
        fontSize: "1.25rem",
        letterSpacing: "-0.015em",
        lineHeight: 1.3,
        color: T.fg,
      }}
    >
      {children}
    </h2>
  );
}
function P({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="mt-4"
      style={{
        fontFamily: T.sans,
        fontSize: "0.9375rem",
        lineHeight: 1.8,
        letterSpacing: "-0.003em",
        color: T.muted,
      }}
    >
      {children}
    </p>
  );
}
function B({ children }: { children: React.ReactNode }) {
  return <strong style={{ color: T.fg }}>{children}</strong>;
}
function UL({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="mt-4 flex flex-col gap-2.5">
      {items.map((it, i) => (
        <li
          key={i}
          className="flex gap-3"
          style={{
            fontFamily: T.sans,
            fontSize: "0.9375rem",
            lineHeight: 1.7,
            letterSpacing: "-0.003em",
            color: T.muted,
          }}
        >
          <span style={{ color: T.primary, flexShrink: 0, marginTop: 1 }}>—</span>
          <span>{it}</span>
        </li>
      ))}
    </ul>
  );
}

/** The clause that carries the most risk gets the most visual weight. */
function Callout({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      className="mt-6"
      style={{
        border: `1px solid ${T.warning}55`,
        background: T.warningSoft,
        borderRadius: T.r.lg,
        padding: "18px 20px",
      }}
    >
      <span
        style={{
          fontFamily: T.mono,
          fontSize: "0.6875rem",
          fontWeight: 600,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: T.warning,
        }}
      >
        {title}
      </span>
      <div style={{ marginTop: 8 }}>{children}</div>
    </div>
  );
}

export function ServiceTermsTemplate({
  clientName,
  effectiveDate,
  carePlanLabel,
  accepted,
  mode = "template",
}: ServiceTermsProps) {
  const company = LEGAL_ENTITY.name;
  const client =
    clientName?.trim() || (mode === "proposal" ? "the Client" : "the Client");
  const effective =
    effectiveDate ?? (mode === "proposal" ? "the date the proposal is accepted" : null);

  return (
    <div>
      <H2>Service &amp; Support Terms</H2>
      <P>
        These terms form part of the agreement between <B>{company}</B>{" "}
        (&ldquo;Nullshift&rdquo;, &ldquo;we&rdquo;) and <B>{client}</B>{" "}
        (&ldquo;you&rdquo;). They define what the recurring fee buys, what
        &ldquo;support&rdquo; means, how new work is priced, and what happens if you do
        not take a plan. Accepting the proposal accepts these terms
        {effective ? (
          <>
            , with effect from <B>{effective}</B>
          </>
        ) : null}
        .
      </P>

      {/* ── 1. Pricing terminology ─────────────────────────── */}
      <H2>1. What the pricing words mean</H2>
      <P>
        Our recurring pricing has two independent parts, and both appear on your proposal:
      </P>
      <UL
        items={[
          <>
            <B>Plan level</B> (Core, Pro, Max or Enterprise) — the level of service your
            platform needs. It determines what is covered and how quickly we respond.
          </>,
          <>
            <B>Scale band</B> — a multiplier reflecting the size, usage, complexity and
            commercial importance of your system. Two businesses on the same plan level
            can pay different amounts, because the responsibility we carry differs.
          </>,
        ]}
      />
      <P>
        Prices published on our website are shown as <B>&ldquo;from&rdquo;</B> figures. A
        &ldquo;from&rdquo; price is the entry point for that plan level at the smallest
        scale band — it is not a quotation. The rate that binds is the monthly figure
        stated in your proposal, which you see and accept before anything is charged.
      </P>
      <P>
        We may review your scale band no more often than every six months, or after a
        material change to your system or organisation. An increase requires at least{" "}
        <B>30 days&rsquo; written notice</B>, and you may cancel before it takes effect.
        Where your third-party consumption (hosting, database, AI, email and similar)
        rises materially, we may pass through or re-band that cost on the same notice.
      </P>

      {/* ── 2. Support ─────────────────────────────────────── */}
      <H2>2. What &ldquo;support&rdquo; covers</H2>
      <P>
        Support <B>preserves, restores, operates or configures</B> a capability your
        system already has. It does not create new capability. The test we apply, in both
        directions, is this:
      </P>
      <P>
        <B>
          If a request changes what your product can do, it is development. If it keeps an
          existing capability working, or configures that capability within its original
          design, it is support.
        </B>
      </P>
      <P>Included in your plan:</P>
      <UL
        items={[
          "Fixing functionality that has stopped behaving as it did when signed off.",
          "Diagnosing outages, errors, integration failures and delivery failures.",
          "Changing a setting, value, content item or rule the system was already built to allow.",
          "Helping you use, administer or understand functionality already present.",
          "Routine technical upkeep required to keep the platform operating safely and reliably.",
        ]}
      />
      <P>
        Defects in our own signed-off implementation are always corrected under support,
        at no additional charge, on every plan level. Response targets are stated in your
        proposal and are targets for a first substantive response, not guaranteed
        resolution times, except where an Enterprise agreement states otherwise in
        writing.
      </P>

      {/* ── 3. New work ────────────────────────────────────── */}
      <H2>3. New capability is quoted and billed separately</H2>
      <P>
        <B>No plan level includes development work.</B> The recurring fee buys the
        platform, the service level and the technical partnership. Anything that creates
        or materially changes a capability is a separate, fixed-price project.
      </P>
      <P>Work that is quoted separately includes:</P>
      <UL
        items={[
          "Letting a user do something the system could not previously do.",
          "A new screen, workflow, user journey, automation, business rule, role or permission model.",
          "Adding a third-party service, or substantially changing an existing integration.",
          "New data structures, reporting, booking, payment, ticketing or portal capability.",
          "Materially redesigning part of the product, as opposed to correcting a defect.",
        ]}
      />
      <P>
        Before any such work begins you will receive a written proposal stating the
        defined capability, what is included and excluded, the acceptance criteria, a{" "}
        <B>fixed price</B> and a delivery window. Work starts only once you approve it. We
        do not bill you by the hour, and we will not carry out chargeable work without
        your written agreement.
      </P>
      <P>
        Higher plan levels change the <B>access and priority</B> you get around that work
        — feature discovery and technical scoping are included at Max, and accepted
        projects are scheduled ahead of standard work — but they do not include the build
        itself. Moving up a plan level for a period does not create an entitlement to
        development work, credits or a backlog of free changes.
      </P>

      {/* ── 4. No plan ─────────────────────────────────────── */}
      <H2>4. If you do not take a plan</H2>
      <P>
        You own your system outright — the code, the data and every account — so you are
        free to run it yourself or have someone else run it. If you do not take a plan, or
        when a plan ends, responsibility transfers to you.
      </P>
      <Callout title="Please read this clause carefully">
        <P>
          From that point{" "}
          <B>you are responsible for hosting and maintaining the system yourself</B>,
          including: hosting, domain and SSL renewals; database provision and capacity;
          backups and the ability to restore them; security patches and dependency
          updates; monitoring and uptime; third-party accounts, API keys and the costs of
          the services your system consumes; and legal and regulatory compliance for the
          platform in your hands.
        </P>
        <P>
          We are not liable for downtime, data loss, security incidents, deliverability
          failures, expired certificates or third-party suspensions arising after that
          transfer. Without a plan we do not monitor your system, we hold no obligation to
          respond to incidents, and any assistance you request is quoted as new work,
          subject to our availability at the time.
        </P>
      </Callout>
      <P>
        Where we currently hold accounts or pay running costs on your behalf, we will, on
        request, transfer them to you and provide the information reasonably needed to
        take them over. Any credentials or infrastructure remaining under our control
        after that transfer are held as an accommodation only, and we may require you to
        assume them on 30 days&rsquo; notice.
      </P>

      {/* ── 5. Separation ──────────────────────────────────── */}
      <H2>5. A plan is a separate agreement</H2>
      <P>
        The build agreement and the monthly plan are <B>separate arrangements</B>, and
        neither is conditional on the other:
      </P>
      <UL
        items={[
          <>
            Your ownership of the delivered system is <B>not</B> conditional on holding a
            plan. Cancelling a plan does not affect what you own or your licence to use
            it.
          </>,
          <>
            Cancelling a plan does not cancel any separately agreed fixed-price project,
            and cancelling a project does not cancel your plan.
          </>,
          <>
            Plans are monthly and may be cancelled at any time, effective at the end of
            the current billing period. Fees already paid for the current period are not
            refunded, and we do not charge an exit fee.
          </>,
          <>
            Sums owed for completed build work remain payable whether or not you take, or
            keep, a plan.
          </>,
        ]}
      />
      <P>
        {carePlanLabel ? (
          <>
            The plan proposed alongside these terms is <B>{carePlanLabel}</B>. Its monthly
            figure is stated in your proposal, and it begins once your system is live.
          </>
        ) : (
          <>
            No plan is included in this proposal. Unless you take one, clause 4 applies
            from the point your system is delivered.
          </>
        )}
      </P>

      {/* ── 6. Acknowledgement ─────────────────────────────── */}
      <H2>6. Acknowledgement</H2>
      <P>By accepting the proposal, you confirm that you have read and understood:</P>
      <UL
        items={[
          "that published prices are “from” figures, and that your rate is the figure stated in your proposal (clause 1);",
          "what support does and does not cover, and that response targets are targets rather than guaranteed resolution times (clause 2);",
          "that no plan includes development work, and that new capability is quoted and invoiced as a separate fixed-price project (clause 3);",
          "that without a plan you are responsible for hosting, maintenance, security and the running costs of your system, and we are not liable for what follows from that (clause 4);",
          "that a plan is a separate agreement from the build, and cancelling it does not affect what you own (clause 5).",
        ]}
      />

      {accepted ? (
        <div
          className="mt-8"
          style={{
            border: `1px solid ${T.primary}55`,
            background: `${T.primary}0f`,
            borderRadius: T.r.lg,
            padding: "16px 20px",
          }}
        >
          <span
            style={{
              fontFamily: T.mono,
              fontSize: "0.6875rem",
              fontWeight: 600,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: T.primary,
            }}
          >
            Accepted
          </span>
          <P>
            Signed by <B>{accepted.name}</B> on{" "}
            <B>{new Date(accepted.at).toLocaleDateString("en-GB")}</B>, electronically, as
            part of the proposal for {client}.
          </P>
        </div>
      ) : (
        <P>
          These terms are accepted by the typed signature on the proposal above. They are
          not a substitute for the Data Processing Agreement, which governs personal data
          and is provided separately.
        </P>
      )}
    </div>
  );
}
