import { Document, Font, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { LEGAL_ENTITY } from "@nullshift/content/legalEntity";
import type { Block } from "@/lib/signing/blocks";
import {
  formatMinor,
  hashFingerprint,
  KIND_LABEL,
  STATUS_LABEL,
  type SignatureStatus,
  type SigningContent,
  type SigningRecordLine,
} from "@/lib/signing/model";
import type { SignatureBlock } from "@/lib/signing/format";

/**
 * The signed copy and completion certificate (A4, @react-pdf/renderer): the
 * document exactly as frozen at issue, both signature blocks, the SHA-256 of
 * the snapshot, and the time-stamped signing record. This is what each party
 * keeps; it is rendered from the stored snapshot, never from the live row.
 *
 * Server-only — rendered by /api/sign/[id]/certificate.
 */

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
  docKind: { fontFamily: "Helvetica-Bold", fontSize: 8, letterSpacing: 1.6, textTransform: "uppercase", color: ACCENT },
  docRef: { fontSize: 9.5, color: INK, marginTop: 2 },
  docDate: { fontSize: 8.5, color: FAINT, marginTop: 1 },
  title: { fontFamily: "Helvetica-Bold", fontSize: 18, letterSpacing: 0.1, color: INK, marginTop: 20, lineHeight: 1.2 },
  parties: { flexDirection: "row", marginTop: 10, gap: 24 },
  partyLabel: { fontFamily: "Helvetica-Bold", fontSize: 7.5, letterSpacing: 1.4, textTransform: "uppercase", color: FAINT },
  partyName: { fontSize: 9.5, color: INK, marginTop: 2 },
  h1: { fontFamily: "Helvetica-Bold", fontSize: 13, color: INK, marginTop: 18, marginBottom: 6, lineHeight: 1.25 },
  h2: { fontFamily: "Helvetica-Bold", fontSize: 9, letterSpacing: 1.4, textTransform: "uppercase", color: INK, marginTop: 16, marginBottom: 6 },
  body: { fontSize: 9.5, color: MUTED, lineHeight: 1.65, marginBottom: 6 },
  callout: { fontSize: 9.5, color: INK, lineHeight: 1.6, marginVertical: 8, paddingLeft: 10, borderLeftWidth: 1.5, borderLeftColor: ACCENT },
  li: { flexDirection: "row", marginBottom: 3 },
  liBullet: { width: 12, color: ACCENT, fontSize: 9.5 },
  liText: { flex: 1, fontSize: 9.5, color: MUTED, lineHeight: 1.5 },
  table: { marginTop: 4, marginBottom: 10 },
  tr: { flexDirection: "row", borderTopWidth: 0.75, borderTopColor: HAIRLINE },
  th: { fontFamily: "Helvetica-Bold", fontSize: 7, letterSpacing: 1, textTransform: "uppercase", color: FAINT, paddingVertical: 5, paddingRight: 8 },
  td: { fontSize: 8.5, color: INK, lineHeight: 1.45, paddingVertical: 5, paddingRight: 8 },
  costRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6, borderTopWidth: 0.75, borderTopColor: HAIRLINE },
  costLabel: { fontSize: 9.5, color: INK, flex: 1, paddingRight: 12 },
  costAmount: { fontSize: 9.5, color: INK, textAlign: "right" },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, borderTopWidth: 1.4, borderTopColor: INK },
  totalLabel: { fontFamily: "Helvetica-Bold", fontSize: 10, color: INK },
  totalAmount: { fontFamily: "Helvetica-Bold", fontSize: 12, color: INK },
  fine: { fontSize: 8, color: FAINT, marginTop: 6, lineHeight: 1.5 },
  agreement: { fontSize: 8.5, color: MUTED, lineHeight: 1.6, marginBottom: 5 },
  signRow: { flexDirection: "row", gap: 28, marginTop: 22, borderTopWidth: 1, borderTopColor: INK, paddingTop: 14 },
  signCol: { flex: 1 },
  signName: { fontFamily: "Helvetica-Oblique", fontSize: 17, color: INK, marginTop: 14 },
  signRule: { borderBottomWidth: 0.75, borderBottomColor: INK, marginTop: 6 },
  signMeta: { fontSize: 8.5, color: MUTED, marginTop: 5, lineHeight: 1.45 },
  unsigned: { fontFamily: "Helvetica-Oblique", fontSize: 9.5, color: FAINT, marginTop: 14 },
  recRow: { flexDirection: "row", paddingVertical: 5, borderTopWidth: 0.75, borderTopColor: HAIRLINE },
  recAt: { width: 118, fontSize: 8, color: MUTED },
  recLabel: { width: 118, fontFamily: "Helvetica-Bold", fontSize: 8, color: INK },
  recBody: { flex: 1, fontSize: 8, color: MUTED, lineHeight: 1.45 },
  fingerprint: { fontFamily: "Courier", fontSize: 8.5, color: INK, marginTop: 4 },
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

const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "Europe/London",
    timeZoneName: "short",
  });

function footerLine(reference: string, hash: string | null) {
  const N = LEGAL_ENTITY;
  return [
    N.name,
    N.companyNumber ? `Company no. ${N.companyNumber}` : null,
    reference,
    hash ? `SHA-256 ${hash.slice(0, 16)}…` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

function BlockPdf({ block }: { block: Block }) {
  switch (block.type) {
    case "heading":
      return <Text style={block.level === 1 ? s.h1 : s.h2}>{block.text}</Text>;
    case "paragraph":
      return <Text style={s.body}>{block.text}</Text>;
    case "callout":
      return <Text style={s.callout}>{block.text}</Text>;
    case "list":
      return (
        <View style={{ marginBottom: 6 }}>
          {block.items.map((item, i) => (
            <View key={i} style={s.li}>
              <Text style={s.liBullet}>•</Text>
              <Text style={s.liText}>{item}</Text>
            </View>
          ))}
        </View>
      );
    case "table": {
      // Narrow columns (a "#" or a Yes/No) take less room than prose.
      const weights = block.header.map((_, i) => {
        const longest = Math.max(
          block.header[i]?.length ?? 0,
          ...block.rows.map((r) => (r[i] ?? "").length)
        );
        return longest <= 4 ? 0.5 : longest <= 24 ? 1.4 : 3;
      });
      const total = weights.reduce((a, b) => a + b, 0);
      return (
        <View style={s.table}>
          <View style={[s.tr, { borderTopWidth: 0 }]}>
            {block.header.map((h, i) => (
              <Text key={i} style={[s.th, { flex: weights[i] / total }]}>
                {h}
              </Text>
            ))}
          </View>
          {block.rows.map((row, r) => (
            <View key={r} style={s.tr} wrap={false}>
              {row.map((c, i) => (
                <Text
                  key={i}
                  style={[
                    s.td,
                    { flex: weights[i] / total },
                    /^(yes|included)$/i.test(c) ? { color: ACCENT, fontFamily: "Helvetica-Bold" } : {},
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
  }
}

function SignaturePdf({ party, sig, placeholder }: { party: string; sig: SignatureBlock; placeholder: string }) {
  return (
    <View style={s.signCol}>
      <Text style={s.partyLabel}>{party}</Text>
      {sig ? (
        <>
          <Text style={s.signName}>{sig.name}</Text>
          <View style={s.signRule} />
          <Text style={s.signMeta}>
            {sig.name}
            {sig.role ? `, ${sig.role}` : ""}
            {sig.email ? `\n${sig.email}` : ""}
            {`\nSigned electronically ${fmtDateTime(sig.at)}`}
          </Text>
        </>
      ) : (
        <>
          <Text style={s.unsigned}>{placeholder}</Text>
          <View style={s.signRule} />
        </>
      )}
    </View>
  );
}

export function SignedDocumentPdf({
  content,
  hash,
  status,
  signatures,
  record,
  nullshiftName,
}: {
  content: SigningContent;
  hash: string | null;
  status: SignatureStatus;
  signatures: { client: SignatureBlock; nullshift: SignatureBlock };
  record: SigningRecordLine[];
  nullshiftName: string;
}) {
  const c = content.commercial;
  return (
    <Document
      title={`${content.reference} — ${content.title}`}
      author={nullshiftName}
      subject={`${KIND_LABEL[content.kind]} — ${STATUS_LABEL[status]}`}
    >
      <Page size="A4" style={s.page}>
        <View style={s.headerRow} fixed>
          <Text style={s.wordmark}>NULLSHIFT</Text>
          <View style={s.headerRight}>
            <Text style={s.docKind}>{KIND_LABEL[content.kind]}</Text>
            <Text style={s.docRef}>{content.reference}</Text>
            <Text style={s.docDate}>Issued {fmtDateTime(content.issuedAt)}</Text>
          </View>
        </View>

        <Text style={s.title}>{content.title}</Text>
        <View style={s.parties}>
          <View>
            <Text style={s.partyLabel}>Between</Text>
            <Text style={s.partyName}>{nullshiftName}</Text>
          </View>
          <View>
            <Text style={s.partyLabel}>And</Text>
            <Text style={s.partyName}>{content.client.name}</Text>
          </View>
          <View>
            <Text style={s.partyLabel}>Status</Text>
            <Text style={s.partyName}>{STATUS_LABEL[status]}</Text>
          </View>
        </View>

        <View style={{ marginTop: 6 }}>
          {content.blocks.map((b, i) => (
            <BlockPdf key={i} block={b} />
          ))}
        </View>

        {c.lines.length > 0 && (
          <View style={{ marginTop: 14 }} wrap={false}>
            <Text style={s.h2}>Costing</Text>
            {c.lines.map((l, i) => (
              <View key={i} style={s.costRow}>
                <Text style={s.costLabel}>{l.label}</Text>
                <Text style={s.costAmount}>{formatMinor(l.amountMinor, c.currency)}</Text>
              </View>
            ))}
            {c.totalMinor !== null && (
              <View style={s.totalRow}>
                <Text style={s.totalLabel}>Total</Text>
                <Text style={s.totalAmount}>{formatMinor(c.totalMinor, c.currency)}</Text>
              </View>
            )}
            {c.note && <Text style={s.fine}>{c.note}</Text>}
          </View>
        )}

        <View style={{ marginTop: 16 }}>
          <Text style={s.h2}>Agreement</Text>
          {content.agreement.map((p, i) => (
            <Text key={i} style={s.agreement}>
              {p}
            </Text>
          ))}
        </View>

        <View style={s.signRow} wrap={false}>
          <SignaturePdf
            party={`For ${content.client.name}`}
            sig={signatures.client}
            placeholder={`${content.signer.name}${content.signer.role ? `, ${content.signer.role}` : ""} — not yet signed`}
          />
          <SignaturePdf party={`For ${nullshiftName}`} sig={signatures.nullshift} placeholder="Not yet countersigned" />
        </View>

        <View style={{ marginTop: 22 }} break>
          <Text style={s.h2}>Signing record</Text>
          <Text style={s.body}>
            This record is kept by {nullshiftName} and lists each step in the life of this document. The
            document above was frozen when it was issued; its SHA-256 fingerprint is printed below and
            recorded against each signature, so any copy can be checked against what was signed.
          </Text>
          <Text style={s.partyLabel}>SHA-256 of the issued document</Text>
          <Text style={s.fingerprint}>{hash ?? "—"}</Text>
          <Text style={[s.fine, { marginBottom: 8 }]}>Short form: {hashFingerprint(hash)}</Text>
          {record.map((line, i) => (
            <View key={i} style={s.recRow} wrap={false}>
              <Text style={s.recAt}>{fmtDateTime(line.at)}</Text>
              <Text style={s.recLabel}>{line.label}</Text>
              <Text style={s.recBody}>
                {line.who}
                {line.detail ? `\n${line.detail}` : ""}
              </Text>
            </View>
          ))}
          <Text style={[s.fine, { marginTop: 14 }]}>
            Electronic signatures given through this page are signatures for the purposes of the Electronic
            Communications Act 2000 (s.7) and the UK eIDAS Regulation. Times are shown in UK time. Generated{" "}
            {fmtDateTime(new Date().toISOString())}.
          </Text>
        </View>

        <View fixed style={s.footer}>
          <Text style={s.footerText}>{footerLine(content.reference, hash)}</Text>
          <Text style={s.footerPage} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
