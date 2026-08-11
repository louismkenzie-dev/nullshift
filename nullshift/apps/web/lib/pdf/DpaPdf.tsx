import { Document, Font, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { LEGAL_ENTITY, SUB_PROCESSORS } from "@nullshift/content/legalEntity";

/**
 * Server-rendered A4 Data Processing Agreement PDF (@react-pdf/renderer).
 * Formal, light-theme counterpart of components/legal/DpaTemplate.tsx in
 * "proposal" mode — every legal clause is reproduced verbatim; only the
 * presentation differs (white paper, near-black Helvetica, hairline rules,
 * bordered annex tables, a footer with the legal identity and page numbers,
 * and an execution/signature block).
 *
 * Per-engagement fields that the on-screen template shows as amber "to
 * confirm" chips render here as bracketed oblique placeholders.
 *
 * Server-only: rendered by /api/documents/dpa/[projectId]. Never import from
 * client components.
 */

// Keep legal text unhyphenated — words wrap whole.
Font.registerHyphenationCallback((word) => [word]);

const INK = "#111418";
const MUTED = "#3F4650";
const FAINT = "#787F88";
const HAIRLINE = "#D8DCE1";
const TABLE_HEAD_BG = "#F2F4F6";
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
  fill: { fontFamily: "Helvetica-Oblique", color: FAINT },
  listRow: { flexDirection: "row", marginTop: 5 },
  listDash: { width: 16, color: ACCENT, fontSize: 9.5 },
  listText: { flex: 1, fontSize: 9.5, color: MUTED, lineHeight: 1.6 },
  // Tables
  table: { marginTop: 8, borderWidth: 0.75, borderColor: HAIRLINE },
  tr: { flexDirection: "row" },
  trRule: { borderTopWidth: 0.75, borderTopColor: HAIRLINE },
  th: {
    fontFamily: "Helvetica-Bold",
    fontSize: 7.5,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: MUTED,
    backgroundColor: TABLE_HEAD_BG,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  td: {
    fontSize: 9,
    color: MUTED,
    lineHeight: 1.5,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  cellRule: { borderLeftWidth: 0.75, borderLeftColor: HAIRLINE },
  // Signature
  signBlock: {
    marginTop: 30,
    borderTopWidth: 1,
    borderTopColor: INK,
    paddingTop: 14,
  },
  signTitle: {
    fontFamily: "Helvetica-Bold",
    fontSize: 9,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: INK,
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

/** Render a value, or a bracketed oblique placeholder when it is missing. */
function val(value: string | null | undefined, label: string) {
  const v = (value ?? "").trim();
  return v ? <Text>{v}</Text> : <Text style={s.fill}>[{label}]</Text>;
}

function P({ children }: { children: React.ReactNode }) {
  return <Text style={s.p}>{children}</Text>;
}

function B({ children }: { children: React.ReactNode }) {
  return <Text style={s.b}>{children}</Text>;
}

function H2({ children }: { children: React.ReactNode }) {
  // NB: orphan protection is done by wrapping each heading together with its
  // first clause/table in a wrap={false} View at the call sites — react-pdf
  // 4.x's minPresenceAhead prop is typed but not implemented.
  return <Text style={s.h2}>{children}</Text>;
}

function UL({ items }: { items: React.ReactNode[] }) {
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

/** Simple bordered table. Column widths are fractions summing to 1. */
function Table({
  widths,
  head,
  rows,
}: {
  widths: number[];
  head: string[];
  rows: React.ReactNode[][];
}) {
  return (
    <View style={s.table}>
      <View style={s.tr} wrap={false}>
        {head.map((h, i) => (
          <Text
            key={i}
            style={[
              s.th,
              { width: `${widths[i] * 100}%` },
              ...(i > 0 ? [s.cellRule] : []),
            ]}
          >
            {h}
          </Text>
        ))}
      </View>
      {rows.map((r, ri) => (
        <View key={ri} style={[s.tr, s.trRule]} wrap={false}>
          {r.map((c, ci) => (
            <Text
              key={ci}
              style={[
                s.td,
                { width: `${widths[ci] * 100}%` },
                ...(ci > 0 ? [s.cellRule] : []),
              ]}
            >
              {c}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

export type DpaPdfParty = {
  name?: string | null;
  country?: string | null;
  companyNumber?: string | null;
  registeredAddress?: string | null;
};

export type DpaPdfProps = {
  reference: string;
  date: string;
  client?: DpaPdfParty;
  /** Pre-formatted effective date; null → "On your acceptance of this proposal". */
  effectiveDate?: string | null;
  /** Annex 1 — types of personal data (free text). */
  personalDataTypes?: string | null;
  specialCategory?: { present: boolean; detail?: string | null };
  /** Annex 1 — categories of data subjects (free text; sensible default if omitted). */
  dataSubjects?: string | null;
  /** Set once the proposal is signed. */
  accepted?: { name: string; at: string } | null;
};

export function DpaPdf({
  reference,
  date,
  client = {},
  effectiveDate,
  personalDataTypes,
  specialCategory,
  dataSubjects,
  accepted = null,
}: DpaPdfProps) {
  const N = LEGAL_ENTITY;
  const company = N.name;

  const dataSubjectsText =
    (dataSubjects ?? "").trim() ||
    "The Client's customers, website visitors, account holders, booking customers, and newsletter subscribers.";

  const personalDataCell = (personalDataTypes ?? "").trim() ? (
    <Text>{personalDataTypes}</Text>
  ) : (
    <Text style={s.fill}>[types of personal data — to add]</Text>
  );

  const specialCategoryCell = specialCategory?.present ? (
    val(specialCategory.detail, "special category data & category — to add")
  ) : (
    <Text>None.</Text>
  );

  return (
    <Document
      title={`Nullshift Data Processing Agreement ${reference}`}
      author={company}
      subject="Data Processing Agreement (UK GDPR)"
      creator={company}
      producer={company}
    >
      <Page size="A4" style={s.page}>
        {/* Header — page 1 only */}
        <View style={s.headerRow}>
          <Text style={s.wordmark}>NULLSHIFT</Text>
          <View style={s.headerRight}>
            <Text style={s.docKind}>Data Processing Agreement</Text>
            <Text style={s.docRef}>{reference}</Text>
            <Text style={s.docDate}>{date}</Text>
          </View>
        </View>

        <Text style={s.docTitle}>Data Processing Agreement</Text>

        <P>
          <B>Between:</B>
        </P>
        <P>
          (1) {val(client.name, "Client name")}, a company registered in{" "}
          {val(client.country, "country")} (company number{" "}
          {val(client.companyNumber, "client company number")}) whose registered office
          is at {val(client.registeredAddress, "client registered address")} (the
          &quot;Controller&quot; or &quot;Client&quot;); and
        </P>
        <P>
          (2) {company}, a business registered in the United Kingdom (company number{" "}
          {val(N.companyNumber, "company number — to confirm")}, ICO registration{" "}
          {val(N.ico, "ICO registration — to confirm")}) whose registered office is at{" "}
          {val(N.registeredOffice, "registered office — to confirm")}{" "}
          (&quot;Nullshift&quot;, the &quot;Processor&quot;).
        </P>
        <P>each a &quot;party&quot; and together the &quot;parties&quot;.</P>
        <P>
          Effective date:{" "}
          {effectiveDate ? (
            <Text>{effectiveDate}</Text>
          ) : (
            <Text>On your acceptance of this proposal</Text>
          )}
        </P>

        <View wrap={false}>
          <H2>1. Background and purpose</H2>
          <P>
            1.1 This Data Processing Agreement (&quot;DPA&quot;) governs the Processing
            of Personal Data by Nullshift on behalf of the Client in connection with the
            website development, hosting, maintenance and related services that
            Nullshift provides to the Client (the &quot;Services&quot;), as set out in
            the parties&apos; main services agreement or statement of work (the
            &quot;Principal Agreement&quot;).
          </P>
        </View>
        <P>
          1.2 This DPA forms part of, and is subject to, the Principal Agreement. Where
          there is any conflict between this DPA and the Principal Agreement on the
          subject of data protection, this DPA prevails.
        </P>
        <P>
          1.3 The parties agree that, in respect of the Personal Data processed under
          the Services, the Client is the Controller and Nullshift is the Processor.
        </P>

        <View wrap={false}>
          <H2>2. Definitions</H2>
          <P>2.1 In this DPA:</P>
        </View>
        <UL
          items={[
            <Text key="a">
              &quot;Data Protection Law&quot; means all laws applicable to the
              Processing of Personal Data under this DPA, including the UK GDPR, the
              Data Protection Act 2018, the Data (Use and Access) Act 2025, and the
              Privacy and Electronic Communications Regulations 2003 (PECR), each as
              amended or replaced from time to time.
            </Text>,
            <Text key="b">
              &quot;UK GDPR&quot; means Regulation (EU) 2016/679 as it forms part of the
              law of England and Wales, Scotland and Northern Ireland by virtue of the
              European Union (Withdrawal) Act 2018, as amended.
            </Text>,
            <Text key="c">
              &quot;Controller&quot;, &quot;Processor&quot;, &quot;Data Subject&quot;,
              &quot;Personal Data&quot;, &quot;Personal Data Breach&quot;,
              &quot;Processing&quot;, &quot;Special Category Data&quot; and
              &quot;Sub-processor&quot; have the meanings given in Data Protection Law.
            </Text>,
            <Text key="d">
              &quot;Restricted Transfer&quot; means a transfer of Personal Data to a
              country or territory outside the United Kingdom that is subject to
              restrictions under Data Protection Law.
            </Text>,
            <Text key="e">
              &quot;UK Transfer Mechanism&quot; means the International Data Transfer
              Agreement (IDTA) or the International Data Transfer Addendum to the EU
              Standard Contractual Clauses, as issued by the Information Commissioner,
              or any successor mechanism.
            </Text>,
          ]}
        />

        <View wrap={false}>
          <H2>3. Scope and details of Processing</H2>
          <P>
            3.1 The subject matter, duration, nature and purpose of the Processing, the
            types of Personal Data, and the categories of Data Subjects are set out in
            Annex 1.
          </P>
        </View>
        <P>
          3.2 Nullshift will Process the Personal Data only for the purposes of
          providing the Services and as described in Annex 1, and not for any of its own
          purposes.
        </P>

        <View wrap={false}>
          <H2>4. Nullshift&apos;s obligations</H2>
          <P>Nullshift will:</P>
          <P>
            4.1 <B>Process only on instructions.</B> Process the Personal Data only on
            the Client&apos;s documented instructions, including the instructions set
            out in this DPA and the Principal Agreement, unless required to do otherwise
            by law (in which case Nullshift will, where legally permitted, inform the
            Client before Processing).
          </P>
        </View>
        <P>
          4.2 <B>Flag unlawful instructions.</B> Immediately inform the Client if, in
          Nullshift&apos;s opinion, an instruction infringes Data Protection Law.
        </P>
        <P>
          4.3 <B>Confidentiality.</B> Ensure that persons authorised to Process the
          Personal Data are bound by appropriate obligations of confidentiality.
        </P>
        <P>
          4.4 <B>Security.</B> Implement and maintain the technical and organisational
          measures set out in Annex 2 to ensure a level of security appropriate to the
          risk, in accordance with Article 32 UK GDPR.
        </P>
        <P>
          4.5 <B>Assist with Data Subject rights.</B> Taking into account the nature of
          the Processing, assist the Client by appropriate technical and organisational
          measures, insofar as possible, to respond to requests by Data Subjects
          exercising their rights under Data Protection Law (including access,
          rectification, erasure, restriction, portability and objection).
        </P>
        <P>
          4.6 <B>Assist with compliance.</B> Assist the Client in ensuring compliance
          with its obligations relating to security, Personal Data Breach notification,
          data protection impact assessments and prior consultation with the Information
          Commissioner, taking into account the nature of Processing and the information
          available to Nullshift.
        </P>
        <P>
          4.7 <B>Breach notification.</B> Notify the Client without undue delay, and in
          any event within 72 hours, after becoming aware of a Personal Data Breach
          affecting the Personal Data, and provide the Client with sufficient
          information to allow it to meet any obligations to report the breach to the
          Information Commissioner or affected Data Subjects.
        </P>
        <P>
          4.8 <B>Records and demonstration of compliance.</B> Make available to the
          Client all information reasonably necessary to demonstrate compliance with
          this DPA, and maintain written records of its Processing activities as
          required by Data Protection Law.
        </P>
        <P>
          4.9 <B>Audits.</B> Allow for and contribute to audits, including inspections,
          conducted by the Client or another auditor mandated by the Client, on
          reasonable prior written notice (and no more than once per year except where
          required by a regulator or following a Personal Data Breach), subject to
          reasonable confidentiality and security conditions.
        </P>

        <View wrap={false}>
          <H2>5. Sub-processors</H2>
          <P>
            5.1 The Client provides general authorisation for Nullshift to engage the
            Sub-processors listed in Annex 3 to Process the Personal Data.
          </P>
        </View>
        <P>
          5.2 Nullshift will impose on each Sub-processor, by written contract, data
          protection obligations substantially equivalent to those set out in this DPA,
          and remains fully liable to the Client for the performance of each
          Sub-processor&apos;s obligations.
        </P>
        <P>
          5.3 Nullshift will inform the Client of any intended addition or replacement
          of a Sub-processor at least 14 days in advance, giving the Client the
          opportunity to object on reasonable data protection grounds. If the Client
          objects and the parties cannot agree a resolution, either party may terminate
          the affected Services.
        </P>

        <View wrap={false}>
          <H2>6. International transfers</H2>
          <P>
            6.1 Nullshift will not carry out a Restricted Transfer of the Personal Data
            without the Client&apos;s prior authorisation, except as already described
            in Annex 1 or Annex 3.
          </P>
        </View>
        <P>
          6.2 Where the Services involve a Restricted Transfer, Nullshift will ensure an
          appropriate safeguard is in place, such as a UK Transfer Mechanism, and will
          configure hosting so that Personal Data is stored in a UK or European region
          where reasonably practicable.
        </P>

        <View wrap={false}>
          <H2>7. Deletion and return of data</H2>
          <P>
            7.1 On termination or expiry of the Services, and at the Client&apos;s
            choice, Nullshift will delete or return all the Personal Data to the Client
            and delete existing copies, unless Data Protection Law requires continued
            storage.
          </P>
        </View>
        <P>
          7.2 Nullshift will, on request, certify in writing that it has complied with
          this clause.
        </P>

        <View wrap={false}>
          <H2>8. Liability</H2>
          <P>
            8.1 Each party&apos;s liability arising out of or related to this DPA is
            subject to the limitations and exclusions of liability set out in the
            Principal Agreement.
          </P>
        </View>

        <View wrap={false}>
          <H2>9. General</H2>
          <P>
            9.1 <B>Duration.</B> This DPA takes effect on the Effective Date and
            continues for as long as Nullshift Processes Personal Data on behalf of the
            Client.
          </P>
        </View>
        <P>
          9.2 <B>Governing law.</B> This DPA is governed by the laws of England and
          Wales, and the parties submit to the exclusive jurisdiction of the courts of
          England and Wales.
        </P>
        <P>
          9.3 <B>Order of precedence.</B> Except as stated in clause 1.2, the Principal
          Agreement continues in full force.
        </P>

        <View wrap={false}>
          <H2>Annex 1 — Details of the Processing</H2>
          <Table
            widths={[0.3, 0.7]}
          head={["Item", "Detail"]}
          rows={[
            [
              "Subject matter",
              `Provision of website development, hosting, and maintenance Services by ${company} to the Client.`,
            ],
            [
              "Duration",
              "For the term of the Principal Agreement and until deletion/return of the Personal Data under clause 7.",
            ],
            [
              "Nature and purpose",
              "Hosting and operating the Client's website/application and database; storing, retrieving, backing up, and securing data; technical maintenance and support.",
            ],
            ["Types of Personal Data", personalDataCell],
            ["Special Category Data", specialCategoryCell],
            ["Categories of Data Subjects", dataSubjectsText],
            ["Frequency", "Continuous, for the duration of the Services."],
          ]}
          />
        </View>

        <View wrap={false}>
          <H2>Annex 2 — Technical and organisational security measures</H2>
          <P>Nullshift maintains measures including:</P>
        </View>
        <UL
          items={[
            "Encryption of Personal Data in transit (TLS) and at rest, as provided by the hosting platform.",
            "Row-Level Security and least-privilege access controls on the database, separating each Client's data into its own dedicated project/organisation.",
            "Access to production systems restricted to authorised personnel using strong authentication (including multi-factor authentication where available).",
            "Regular automated backups and a documented restore process.",
            "Logging and monitoring of access to systems holding Personal Data.",
            "Secure software development practices and prompt application of security updates.",
            "A documented Personal Data Breach response process.",
            "Secure deletion of Personal Data on termination.",
          ]}
        />

        <View wrap={false}>
          <H2>Annex 3 — Authorised Sub-processors</H2>
          <Table
            widths={[0.3, 0.4, 0.3]}
            head={["Sub-processor", "Service provided", "Location of Processing"]}
            rows={SUB_PROCESSORS.map((sp) => [sp.name, sp.service, sp.location])}
          />
        </View>
        <P>
          This list reflects the tools currently used and is updated to match the actual
          tools used for each Client.
        </P>

        {/* Execution */}
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

        {/* Footer — every page */}
        <View fixed style={s.footer}>
          <Text style={s.footerText}>{footerLine()}</Text>
          <Text
            style={s.footerPage}
            render={({ pageNumber, totalPages }) =>
              `Page ${pageNumber} of ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  );
}
