import { Document, Font, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { LEGAL_ENTITY } from "@nullshift/content/legalEntity";

/**
 * Server-rendered A4 Service & Support Terms PDF (@react-pdf/renderer).
 * Formal, light-theme counterpart of components/legal/ServiceTermsTemplate.tsx
 * in "proposal" mode — every clause reproduced verbatim; only the presentation
 * differs (white paper, Helvetica, hairline rules, a footer with the legal
 * identity and page numbers, and an execution block).
 *
 * Server-only: rendered by /api/documents/terms/[projectId]. Never import from
 * client components.
 */

// Keep legal text unhyphenated — words wrap whole.
Font.registerHyphenationCallback((word) => [word]);

const INK = "#111418";
const MUTED = "#3F4650";
const FAINT = "#787F88";
const HAIRLINE = "#D8DCE1";
const ACCENT = "#047857";
const WARN = "#8A6300";
const WARN_BG = "#FDF6E3";

const s = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 9.5,
    color: INK,
    backgroundColor: "#FFFFFF",
    paddingTop: 56,
    paddingHorizontal: 56,
    paddingBottom: 76,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: INK,
  },
  wordmark: { fontFamily: "Helvetica-Bold", fontSize: 14, letterSpacing: 2, color: INK },
  headerRight: { alignItems: "flex-end" },
  docKind: {
    fontFamily: "Helvetica-Bold",
    fontSize: 8,
    letterSpacing: 1.6,
    textTransform: "uppercase",
    color: ACCENT,
  },
  docRef: { fontSize: 9.5, color: INK, marginTop: 2 },
  docDate: { fontSize: 8.5, color: FAINT, marginTop: 1 },
  docTitle: {
    fontFamily: "Helvetica-Bold",
    fontSize: 17,
    letterSpacing: 0.2,
    color: INK,
    marginTop: 20,
  },
  h2: {
    fontFamily: "Helvetica-Bold",
    fontSize: 11.5,
    color: INK,
    marginTop: 20,
    marginBottom: 4,
  },
  p: { fontSize: 9.5, color: MUTED, lineHeight: 1.65, marginTop: 6 },
  b: { fontFamily: "Helvetica-Bold", color: INK },
  listRow: { flexDirection: "row", marginTop: 5 },
  listDash: { width: 16, color: ACCENT, fontSize: 9.5 },
  listText: { flex: 1, fontSize: 9.5, color: MUTED, lineHeight: 1.6 },
  rule: {
    borderLeftWidth: 2,
    borderLeftColor: INK,
    paddingLeft: 12,
    marginTop: 10,
  },
  ruleText: { fontFamily: "Helvetica-Bold", fontSize: 10, color: INK, lineHeight: 1.55 },
  callout: {
    marginTop: 12,
    borderWidth: 0.75,
    borderColor: WARN,
    backgroundColor: WARN_BG,
    padding: 14,
  },
  calloutTitle: {
    fontFamily: "Helvetica-Bold",
    fontSize: 8,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: WARN,
  },
  signBlock: { marginTop: 30, borderTopWidth: 1, borderTopColor: INK, paddingTop: 14 },
  signTitle: {
    fontFamily: "Helvetica-Bold",
    fontSize: 9,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: INK,
  },
  signName: { fontFamily: "Helvetica-Oblique", fontSize: 17, color: INK, marginTop: 10 },
  signRule: {
    borderBottomWidth: 0.75,
    borderBottomColor: INK,
    marginTop: 6,
    width: 220,
  },
  signMeta: { fontSize: 8.5, color: MUTED, marginTop: 5 },
  unsigned: {
    fontFamily: "Helvetica-Oblique",
    fontSize: 9.5,
    color: FAINT,
    marginTop: 10,
  },
  footer: {
    position: "absolute",
    bottom: 34,
    left: 56,
    right: 56,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    borderTopWidth: 0.75,
    borderTopColor: HAIRLINE,
    paddingTop: 8,
  },
  footerText: { fontSize: 7, color: FAINT, flex: 1, paddingRight: 16, lineHeight: 1.4 },
  footerPage: { fontSize: 7, color: FAINT },
});

function footerLine() {
  const N = LEGAL_ENTITY;
  return [
    N.name,
    N.companyNumber ? `Company no. ${N.companyNumber}` : null,
    N.ico ? `ICO ${N.ico}` : null,
    N.registeredOffice,
  ]
    .filter(Boolean)
    .join(" · ");
}

function P({ children }: { children: React.ReactNode }) {
  return <Text style={s.p}>{children}</Text>;
}
function B({ children }: { children: React.ReactNode }) {
  return <Text style={s.b}>{children}</Text>;
}
function H2({ children }: { children: React.ReactNode }) {
  return <Text style={s.h2}>{children}</Text>;
}
function UL({ items }: { items: string[] }) {
  return (
    <View style={{ marginTop: 2 }}>
      {items.map((it, i) => (
        <View key={i} style={s.listRow} wrap={false}>
          <Text style={s.listDash}>—</Text>
          <Text style={s.listText}>{it}</Text>
        </View>
      ))}
    </View>
  );
}

export type ServiceTermsPdfProps = {
  reference: string;
  date: string;
  clientName?: string | null;
  effectiveDate?: string | null;
  carePlanLabel?: string | null;
  accepted?: { name: string; at: string } | null;
};

export function ServiceTermsPdf({
  reference,
  date,
  clientName,
  effectiveDate,
  carePlanLabel,
  accepted = null,
}: ServiceTermsPdfProps) {
  const company = LEGAL_ENTITY.name;
  const client = (clientName ?? "").trim() || "the Client";
  const effective = effectiveDate ?? "the date the proposal is accepted";

  return (
    <Document
      title={`Nullshift Service & Support Terms ${reference}`}
      author={company}
      subject="Service & Support Terms"
      creator={company}
      producer={company}
    >
      <Page size="A4" style={s.page}>
        <View style={s.headerRow}>
          <Text style={s.wordmark}>NULLSHIFT</Text>
          <View style={s.headerRight}>
            <Text style={s.docKind}>Service &amp; Support Terms</Text>
            <Text style={s.docRef}>{reference}</Text>
            <Text style={s.docDate}>{date}</Text>
          </View>
        </View>

        <Text style={s.docTitle}>Service &amp; Support Terms</Text>

        <P>
          These terms form part of the agreement between <B>{company}</B> (&quot;
          Nullshift&quot;, &quot;we&quot;) and <B>{client}</B> (&quot;you&quot;). They
          define what the recurring fee buys, what &quot;support&quot; means, how new work
          is priced, and what happens if you do not take a plan. Accepting the proposal
          accepts these terms, with effect from <B>{effective}</B>.
        </P>

        <View wrap={false}>
          <H2>1. What the pricing words mean</H2>
          <P>
            Our recurring pricing has two independent parts, and both appear on your
            proposal:
          </P>
        </View>
        <UL
          items={[
            "Plan level (Core, Pro, Max or Enterprise) — the level of service your platform needs. It determines what is covered and how quickly we respond.",
            "Scale band — a multiplier reflecting the size, usage, complexity and commercial importance of your system. Two businesses on the same plan level can pay different amounts, because the responsibility we carry differs.",
          ]}
        />
        <P>
          Prices published on our website are shown as <B>&quot;from&quot;</B> figures. A
          &quot;from&quot; price is the entry point for that plan level at the smallest
          scale band — it is not a quotation. The rate that binds is the monthly figure
          stated in your proposal, which you see and accept before anything is charged.
        </P>
        <P>
          We may review your scale band no more often than every six months, or after a
          material change to your system or organisation. An increase requires at least{" "}
          <B>30 days&apos; written notice</B>, and you may cancel before it takes effect.
          Where your third-party consumption (hosting, database, AI, email and similar)
          rises materially, we may pass through or re-band that cost on the same notice.
        </P>

        <View wrap={false}>
          <H2>2. What &quot;support&quot; covers</H2>
          <P>
            Support <B>preserves, restores, operates or configures</B> a capability your
            system already has. It does not create new capability. The test we apply, in
            both directions, is this:
          </P>
          <View style={s.rule}>
            <Text style={s.ruleText}>
              If a request changes what your product can do, it is development. If it
              keeps an existing capability working, or configures that capability within
              its original design, it is support.
            </Text>
          </View>
        </View>
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
          at no additional charge, on every plan level. Response targets are stated in
          your proposal and are targets for a first substantive response, not guaranteed
          resolution times, except where an Enterprise agreement states otherwise in
          writing.
        </P>

        <View wrap={false}>
          <H2>3. New capability is quoted and billed separately</H2>
          <P>
            <B>No plan level includes development work.</B> The recurring fee buys the
            platform, the service level and the technical partnership. Anything that
            creates or materially changes a capability is a separate, fixed-price project.
          </P>
        </View>
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
          <B>fixed price</B> and a delivery window. Work starts only once you approve it.
          We do not bill you by the hour, and we will not carry out chargeable work
          without your written agreement.
        </P>
        <P>
          Higher plan levels change the <B>access and priority</B> you get around that
          work — feature discovery and technical scoping are included at Max, and accepted
          projects are scheduled ahead of standard work — but they do not include the
          build itself. Moving up a plan level for a period does not create an entitlement
          to development work, credits or a backlog of free changes.
        </P>

        <View wrap={false}>
          <H2>4. If you do not take a plan</H2>
          <P>
            You own your system outright — the code, the data and every account — so you
            are free to run it yourself or have someone else run it. If you do not take a
            plan, or when a plan ends, responsibility transfers to you.
          </P>
          <View style={s.callout}>
            <Text style={s.calloutTitle}>Please read this clause carefully</Text>
            <P>
              From that point{" "}
              <B>you are responsible for hosting and maintaining the system yourself</B>,
              including: hosting, domain and SSL renewals; database provision and
              capacity; backups and the ability to restore them; security patches and
              dependency updates; monitoring and uptime; third-party accounts, API keys
              and the costs of the services your system consumes; and legal and regulatory
              compliance for the platform in your hands.
            </P>
            <P>
              We are not liable for downtime, data loss, security incidents,
              deliverability failures, expired certificates or third-party suspensions
              arising after that transfer. Without a plan we do not monitor your system,
              we hold no obligation to respond to incidents, and any assistance you
              request is quoted as new work, subject to our availability at the time.
            </P>
          </View>
        </View>
        <P>
          Where we currently hold accounts or pay running costs on your behalf, we will,
          on request, transfer them to you and provide the information reasonably needed
          to take them over. Any credentials or infrastructure remaining under our control
          after that transfer are held as an accommodation only, and we may require you to
          assume them on 30 days&apos; notice.
        </P>

        <View wrap={false}>
          <H2>5. A plan is a separate agreement</H2>
          <P>
            The build agreement and the monthly plan are <B>separate arrangements</B>, and
            neither is conditional on the other:
          </P>
        </View>
        <UL
          items={[
            "Your ownership of the delivered system is NOT conditional on holding a plan. Cancelling a plan does not affect what you own or your licence to use it.",
            "Cancelling a plan does not cancel any separately agreed fixed-price project, and cancelling a project does not cancel your plan.",
            "Plans are monthly and may be cancelled at any time, effective at the end of the current billing period. Fees already paid for the current period are not refunded, and we do not charge an exit fee.",
            "Sums owed for completed build work remain payable whether or not you take, or keep, a plan.",
          ]}
        />
        <P>
          {carePlanLabel
            ? `The plan proposed alongside these terms is ${carePlanLabel}. Its monthly figure is stated in your proposal, and it begins once your system is live.`
            : "No plan is included in this proposal. Unless you take one, clause 4 applies from the point your system is delivered."}
        </P>

        <View wrap={false}>
          <H2>6. Acknowledgement</H2>
          <P>By accepting the proposal, you confirm that you have read and understood:</P>
        </View>
        <UL
          items={[
            "that published prices are “from” figures, and that your rate is the figure stated in your proposal (clause 1);",
            "what support does and does not cover, and that response targets are targets rather than guaranteed resolution times (clause 2);",
            "that no plan includes development work, and that new capability is quoted and invoiced as a separate fixed-price project (clause 3);",
            "that without a plan you are responsible for hosting, maintenance, security and the running costs of your system, and we are not liable for what follows from that (clause 4);",
            "that a plan is a separate agreement from the build, and cancelling it does not affect what you own (clause 5).",
          ]}
        />
        <P>
          These terms sit alongside, and do not replace, the Data Processing Agreement,
          which governs personal data and is provided separately.
        </P>

        <View style={s.signBlock} wrap={false}>
          <Text style={s.signTitle}>Execution</Text>
          {accepted ? (
            <>
              <Text style={s.signName}>{accepted.name}</Text>
              <View style={s.signRule} />
              <Text style={s.signMeta}>
                Signed by {accepted.name} for and on behalf of the Client — accepted
                together with the proposal, electronically via the Nullshift client
                portal.
              </Text>
              <Text style={s.signMeta}>
                Date:{" "}
                {new Date(accepted.at).toLocaleString("en-GB", {
                  timeZone: "Europe/London",
                })}
              </Text>
            </>
          ) : (
            <Text style={s.unsigned}>Unsigned — awaiting signature.</Text>
          )}
        </View>

        <View fixed style={s.footer}>
          <Text style={s.footerText}>{footerLine()}</Text>
          <Text
            style={s.footerPage}
            render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  );
}
