import { Document, Font, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { LEGAL_ENTITY } from "@nullshift/content/legalEntity";

/**
 * Server-rendered A4 proposal PDF (@react-pdf/renderer). Formal, light-theme
 * counterpart of components/portal/ProposalDocument.tsx — same content and
 * section order, restyled for print: white paper, near-black Helvetica,
 * hairline rules, numbered sections, a footer with the legal identity and
 * page numbers on every page, and a proper acceptance/signature block.
 *
 * Server-only: rendered by /api/documents/proposal/[projectId]. Never import
 * from client components.
 */

export const DEFAULT_PAYMENT_TERMS =
  "50% deposit on acceptance, 50% on completion. Invoices are payable within 14 days.";

const gbp = (n: number) => "£" + Math.round(n).toLocaleString("en-GB");

// Keep legal/formal text unhyphenated — words wrap whole.
Font.registerHyphenationCallback((word) => [word]);

const INK = "#111418";
const MUTED = "#3F4650";
const FAINT = "#787F88";
const HAIRLINE = "#D8DCE1";
const ACCENT = "#047857";

const s = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 9.5,
    color: INK,
    backgroundColor: "#FFFFFF",
    paddingTop: 56,
    paddingHorizontal: 56,
    paddingBottom: 76,
    // NB: no page-level lineHeight — react-pdf 4.x mis-positions fixed
    // absolutely-positioned elements (the footer) when the Page style sets
    // one. Line heights live on the individual text styles instead.
  },
  // Header
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: INK,
  },
  wordmark: {
    fontFamily: "Helvetica-Bold",
    fontSize: 14,
    letterSpacing: 2,
    color: INK,
  },
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
  preparedLabel: {
    fontFamily: "Helvetica-Bold",
    fontSize: 7.5,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: FAINT,
    marginTop: 20,
  },
  preparedName: {
    fontFamily: "Helvetica-Bold",
    fontSize: 19,
    letterSpacing: 0.2,
    color: INK,
    marginTop: 4,
  },
  // Sections
  section: { marginTop: 22 },
  secRow: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  secNum: {
    fontFamily: "Helvetica-Bold",
    fontSize: 8,
    color: ACCENT,
    borderWidth: 0.75,
    borderColor: INK,
    paddingVertical: 1.5,
    paddingHorizontal: 5,
    marginRight: 8,
  },
  secTitle: {
    fontFamily: "Helvetica-Bold",
    fontSize: 9,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: INK,
  },
  body: { fontSize: 9.5, color: MUTED, lineHeight: 1.65 },
  // Itemised table
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6.5,
    borderTopWidth: 0.75,
    borderTopColor: HAIRLINE,
  },
  rowName: { fontSize: 9.5, color: INK, flex: 1, paddingRight: 12 },
  rowAmount: { fontSize: 9.5, color: INK, textAlign: "right" },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderTopWidth: 1.4,
    borderTopColor: INK,
  },
  totalLabel: { fontFamily: "Helvetica-Bold", fontSize: 10, color: INK },
  totalAmount: { fontFamily: "Helvetica-Bold", fontSize: 12, color: INK },
  // Phases
  phaseRow: {
    flexDirection: "row",
    paddingVertical: 6.5,
    borderTopWidth: 0.75,
    borderTopColor: HAIRLINE,
  },
  phaseNum: {
    fontFamily: "Helvetica-Bold",
    fontSize: 8,
    color: ACCENT,
    width: 22,
    paddingTop: 1.5,
  },
  phaseBody: { flex: 1 },
  phaseTitle: { fontFamily: "Helvetica-Bold", fontSize: 9.5, color: INK },
  phaseDetail: { fontSize: 9, color: MUTED, lineHeight: 1.5, marginTop: 1 },
  // Care plan
  featureRow: { flexDirection: "row", marginTop: 4 },
  featureBullet: { width: 14, color: ACCENT, fontSize: 9.5 },
  featureText: { flex: 1, fontSize: 9.5, color: MUTED, lineHeight: 1.5 },
  fine: { fontSize: 7.5, letterSpacing: 0.6, color: FAINT, marginTop: 10 },
  // Signature
  signBlock: {
    marginTop: 30,
    borderTopWidth: 1,
    borderTopColor: INK,
    paddingTop: 14,
  },
  signName: {
    fontFamily: "Helvetica-Oblique",
    fontSize: 17,
    color: INK,
    marginTop: 10,
  },
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
  // Footer
  footer: {
    position: "absolute",
    left: 56,
    right: 56,
    bottom: 28,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    borderTopWidth: 0.75,
    borderTopColor: HAIRLINE,
    paddingTop: 7,
  },
  footerText: { fontSize: 7, color: FAINT, flex: 1, paddingRight: 16, lineHeight: 1.4 },
  footerPage: { fontSize: 7, color: FAINT },
});

const PHASES: { title: string; detail: string }[] = [
  {
    title: "Discovery & scope",
    detail: "We confirm requirements, your data model and what success looks like.",
  },
  {
    title: "Design",
    detail: "Screens and flows for the modules above, shared with you for sign-off.",
  },
  {
    title: "Build",
    detail:
      "We develop the modules in iterative milestones you can follow in your portal.",
  },
  {
    title: "Review & QA",
    detail: "Testing, accessibility and your review before anything goes live.",
  },
  {
    title: "Launch",
    detail:
      "We deploy to your domain — you own the code and the infrastructure outright.",
  },
  {
    title: "Care & iterate",
    detail: "Ongoing support and improvements under your care plan.",
  },
];

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

export function PdfFooter() {
  return (
    <View fixed style={s.footer}>
      <Text style={s.footerText}>{footerLine()}</Text>
      <Text
        style={s.footerPage}
        render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
      />
    </View>
  );
}

function SectionTitle({ n, title }: { n: string; title: string }) {
  // NB: orphan protection is done by wrapping this title together with the
  // section's first content block in a wrap={false} View at each call site —
  // react-pdf 4.x's minPresenceAhead prop is typed but not implemented.
  return (
    <View style={s.secRow}>
      <Text style={s.secNum}>{n}</Text>
      <Text style={s.secTitle}>{title}</Text>
    </View>
  );
}

/** First paragraph (grouped with the heading) + the rest, split on blank lines. */
function splitFirstPara(text: string): [string, string | null] {
  const idx = text.indexOf("\n");
  if (idx === -1) return [text, null];
  const rest = text.slice(idx + 1).replace(/^\n+/, "");
  return [text.slice(0, idx), rest.length > 0 ? rest : null];
}

export type ProposalPdfProps = {
  reference: string;
  clientName: string;
  businessName?: string | null;
  date: string;
  overview: string | null;
  items: { name: string; amount: number }[];
  total: number;
  carePlan: {
    label: string;
    mrr: number;
    blurb?: string | null;
    features?: string[] | null;
  } | null;
  paymentTerms: string | null;
  accepted: { name: string; at: string } | null;
  /** true = limited company (full DPA), false = sole trader (terms only),
   *  null/undefined = business type not yet declared. */
  dpaRequired?: boolean | null;
};

export function ProposalPdf({
  reference,
  clientName,
  businessName,
  date,
  overview,
  items,
  total,
  carePlan,
  paymentTerms,
  accepted,
  dpaRequired,
}: ProposalPdfProps) {
  // Sequential section numbers — the overview number is skipped when there's
  // no overview, so adding sections never desyncs the numbering.
  let _sec = 0;
  const sec = () => String(++_sec).padStart(2, "0");

  return (
    <Document
      title={`Nullshift Proposal ${reference}`}
      author={LEGAL_ENTITY.name}
      subject="Project proposal"
      creator={LEGAL_ENTITY.name}
      producer={LEGAL_ENTITY.name}
    >
      <Page size="A4" style={s.page}>
        {/* Header — page 1 only */}
        <View style={s.headerRow}>
          <Text style={s.wordmark}>NULLSHIFT</Text>
          <View style={s.headerRight}>
            <Text style={s.docKind}>Proposal</Text>
            <Text style={s.docRef}>{reference}</Text>
            <Text style={s.docDate}>{date}</Text>
          </View>
        </View>

        <Text style={s.preparedLabel}>Prepared for</Text>
        <Text style={s.preparedName}>{businessName || clientName}</Text>

        {overview
          ? (() => {
              const [first, rest] = splitFirstPara(overview);
              return (
                <View style={s.section}>
                  <View wrap={false}>
                    <SectionTitle n={sec()} title="Overview" />
                    <Text style={s.body}>{first}</Text>
                  </View>
                  {rest ? <Text style={{ ...s.body, marginTop: 6 }}>{rest}</Text> : null}
                </View>
              );
            })()
          : null}

        <View style={s.section}>
          <View wrap={false}>
            <SectionTitle n={sec()} title="What we'll build & you'll own" />
            {items.length === 0 ? (
              <Text style={s.body}>Build modules will be listed here.</Text>
            ) : (
              <View style={s.row}>
                <Text style={s.rowName}>{items[0].name}</Text>
                <Text style={s.rowAmount}>{gbp(Number(items[0].amount))}</Text>
              </View>
            )}
          </View>
          {items.slice(1).map((it, i) => (
            <View key={i} style={s.row} wrap={false}>
              <Text style={s.rowName}>{it.name}</Text>
              <Text style={s.rowAmount}>{gbp(Number(it.amount))}</Text>
            </View>
          ))}
          {items.length > 0 && (
            <View style={s.totalRow} wrap={false}>
              <Text style={s.totalLabel}>Total — one-off build</Text>
              <Text style={s.totalAmount}>{gbp(total)}</Text>
            </View>
          )}
        </View>

        <View style={s.section}>
          <View wrap={false}>
            <SectionTitle n={sec()} title="How we'll build it" />
            <View style={s.phaseRow}>
              <Text style={s.phaseNum}>01</Text>
              <View style={s.phaseBody}>
                <Text style={s.phaseTitle}>{PHASES[0].title}</Text>
                <Text style={s.phaseDetail}>{PHASES[0].detail}</Text>
              </View>
            </View>
          </View>
          {PHASES.slice(1).map((p, i) => (
            <View key={i} style={s.phaseRow} wrap={false}>
              <Text style={s.phaseNum}>{String(i + 2).padStart(2, "0")}</Text>
              <View style={s.phaseBody}>
                <Text style={s.phaseTitle}>{p.title}</Text>
                <Text style={s.phaseDetail}>{p.detail}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={s.section}>
          <View wrap={false}>
            <SectionTitle n={sec()} title="Investment" />
            <View style={s.row}>
              <Text style={{ ...s.rowName, fontFamily: "Helvetica-Bold" }}>
                One-off build (you own it)
              </Text>
              <Text style={s.totalAmount}>{gbp(total)}</Text>
            </View>
          </View>
          {carePlan ? (
            <View style={s.row} wrap={false}>
              <Text style={{ ...s.rowName, fontFamily: "Helvetica-Bold" }}>
                Ongoing care · {carePlan.label}
              </Text>
              <Text style={{ ...s.rowAmount, color: ACCENT }}>
                {gbp(carePlan.mrr)}/mo
              </Text>
            </View>
          ) : null}
        </View>

        {carePlan && (carePlan.blurb || (carePlan.features?.length ?? 0) > 0) ? (
          <View style={s.section}>
            <View wrap={false}>
              <SectionTitle n={sec()} title="Your care plan" />
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  marginBottom: 4,
                }}
              >
                <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 10, color: INK }}>
                  {carePlan.label}
                </Text>
                <Text style={{ fontSize: 9.5, color: ACCENT }}>
                  {gbp(carePlan.mrr)}/mo
                </Text>
              </View>
              {carePlan.blurb ? (
                <Text style={{ ...s.body, marginBottom: 6 }}>{carePlan.blurb}</Text>
              ) : null}
            </View>
            {(carePlan.features ?? []).map((f, i) => (
              <View key={i} style={s.featureRow} wrap={false}>
                <Text style={s.featureBullet}>–</Text>
                <Text style={s.featureText}>{f}</Text>
              </View>
            ))}
            <Text style={s.fine}>Billed monthly · cancel any time · no lock-in.</Text>
          </View>
        ) : null}

        {(() => {
          const [first, rest] = splitFirstPara(paymentTerms || DEFAULT_PAYMENT_TERMS);
          return (
            <View style={s.section}>
              <View wrap={false}>
                <SectionTitle n={sec()} title="Payment terms" />
                <Text style={s.body}>{first}</Text>
              </View>
              {rest ? <Text style={{ ...s.body, marginTop: 6 }}>{rest}</Text> : null}
            </View>
          );
        })()}

        <View style={s.section} wrap={false}>
          <SectionTitle
            n={sec()}
            title={
              dpaRequired === false ? "Data processing" : "Data Processing Agreement"
            }
          />
          <Text style={s.body}>
            {dpaRequired === true
              ? "As a limited company, a Data Processing Agreement (UK GDPR) forms part of this proposal and is provided as a separate document. Signing also accepts the DPA so we can lawfully process data on your behalf and take your project live."
              : dpaRequired === false
                ? "Our standard data-processing terms (UK GDPR) apply to this engagement. As a sole trader / non-limited entity, a separate Data Processing Agreement isn't required — signing this proposal accepts these terms."
                : "Before signing you'll confirm your business type. Limited companies also sign a Data Processing Agreement (UK GDPR); sole traders accept our standard data-processing terms with the proposal."}
          </Text>
        </View>

        {/* Acceptance */}
        <View style={s.signBlock} wrap={false}>
          <Text style={s.secTitle}>Acceptance</Text>
          {accepted ? (
            <>
              <Text style={s.signName}>{accepted.name}</Text>
              <View style={s.signRule} />
              <Text style={s.signMeta}>
                Signed by {accepted.name} — accepted electronically via the Nullshift
                client portal.
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

        <PdfFooter />
      </Page>
    </Document>
  );
}
